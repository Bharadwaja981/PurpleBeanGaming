create table private.rate_limit_buckets(
  scope text not null,
  key_hash text not null check(length(key_hash)=64),
  window_start timestamptz not null,
  window_seconds integer not null check(window_seconds between 1 and 86400),
  request_count integer not null default 0 check(request_count>=0),
  updated_at timestamptz not null default now(),
  primary key(scope,key_hash,window_start,window_seconds)
);
create index rate_limit_buckets_expiry_idx on private.rate_limit_buckets(window_start,window_seconds);

create table public.rate_limit_events(
  id bigint generated always as identity primary key,
  scope text not null,
  bucket text not null,
  allowed boolean not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_scope_created_idx on public.rate_limit_events(scope,created_at desc);
alter table public.rate_limit_events enable row level security;
revoke all on public.rate_limit_events from public,anon,authenticated;
grant select,insert,delete on public.rate_limit_events to service_role;

create function public.consume_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
) returns table(allowed boolean,retry_after_seconds integer,remaining integer)
language plpgsql security definer set search_path=''
as $$
declare
  v_start timestamptz;
  v_count integer;
begin
  if p_scope not in('search_burst','search_sustained','report','support_ticket','support_reply','provider_refresh','dota_account_refresh','external_match_link','external_match_relink','admin_mutation','account_deactivation','client_error')
     or p_key_hash !~ '^[0-9a-f]{64}$'
     or p_limit not between 1 and 1000
     or p_window_seconds not between 1 and 86400 then
    raise exception 'INVALID_RATE_LIMIT_POLICY' using errcode='P0001';
  end if;
  v_start:=to_timestamp(floor(extract(epoch from clock_timestamp())/p_window_seconds)*p_window_seconds);
  insert into private.rate_limit_buckets(scope,key_hash,window_start,window_seconds,request_count)
  values(p_scope,p_key_hash,v_start,p_window_seconds,1)
  on conflict(scope,key_hash,window_start,window_seconds) do update
    set request_count=private.rate_limit_buckets.request_count+1,updated_at=now()
  returning request_count into v_count;
  allowed:=v_count<=p_limit;
  retry_after_seconds:=case when allowed then 0 else greatest(1,ceil(extract(epoch from(v_start+make_interval(secs=>p_window_seconds)-clock_timestamp())))::integer)end;
  remaining:=greatest(0,p_limit-v_count);
  insert into public.rate_limit_events(scope,bucket,allowed)values(p_scope,left(p_key_hash,12),allowed);
  return next;
end$$;
revoke all on function public.consume_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,text,integer,integer) to service_role;

create function private.prune_rate_limits()returns integer language plpgsql security definer set search_path=''as $$declare n integer;begin
  delete from private.rate_limit_buckets where window_start+make_interval(secs=>window_seconds)<now()-interval'1 day';get diagnostics n=row_count;
  delete from public.rate_limit_events where created_at<now()-interval'30 days';return n;
end$$;
revoke all on function private.prune_rate_limits() from public,anon,authenticated;
