create type public.game_account_verification_status as enum ('unverified','user_linked','organizer_verified','provider_verified');
create type public.external_provider as enum ('opendota','steam');
create type public.external_job_status as enum ('queued','running','retry_scheduled','succeeded','failed','cancelled');
create type public.dota_parse_state as enum ('unknown','unparsed','requested','parsing','parsed','unavailable');
create type public.dota_reconciliation_state as enum ('pending','matched','partial','participant_mismatch','result_conflict');

create table public.player_game_accounts(
 id uuid primary key default gen_random_uuid(), player_id uuid not null references public.profiles(id) on delete cascade,
 game text not null default 'dota2' check(game='dota2'), steam_id64 bigint not null check(steam_id64 between 76561197960265728 and 76561202255233023),
 dota_account_id bigint not null check(dota_account_id between 0 and 4294967295), profile_url text,
 verification_status public.game_account_verification_status not null default 'user_linked', verified_at timestamptz,
 is_primary boolean not null default true, linked_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(game,steam_id64), unique(game,dota_account_id)
);
create unique index player_game_accounts_one_primary on public.player_game_accounts(player_id,game) where is_primary;
create index player_game_accounts_player_idx on public.player_game_accounts(player_id,game);

create table public.dota_profile_snapshots(
 id uuid primary key default gen_random_uuid(), player_game_account_id uuid not null references public.player_game_accounts(id) on delete cascade,
 provider public.external_provider not null, persona_name text, avatar_url text, profile_visibility text,
 rank_tier integer check(rank_tier between 0 and 99), leaderboard_rank integer check(leaderboard_rank>0),
 source_hash text not null check(length(source_hash) between 16 and 128), captured_at timestamptz not null default now(),
 unique(player_game_account_id,provider,source_hash)
);
create index dota_profile_snapshots_latest_idx on public.dota_profile_snapshots(player_game_account_id,captured_at desc);

create table public.external_provider_cache(
 provider public.external_provider not null, cache_key text not null check(length(cache_key) between 1 and 180),
 payload jsonb not null, etag text, fetched_at timestamptz not null default now(), expires_at timestamptz not null,
 primary key(provider,cache_key), check(expires_at>fetched_at)
);
create table public.external_provider_requests(
 id bigint generated always as identity primary key, provider public.external_provider not null, operation text not null,
 outcome text not null check(outcome in('success','cache_hit','rate_limited','client_error','server_error','timeout','circuit_open')),
 status_code integer, duration_ms integer check(duration_ms is null or duration_ms>=0), retry_after_seconds integer,
 created_at timestamptz not null default now()
);
create index external_provider_requests_metrics_idx on public.external_provider_requests(provider,created_at desc);
create table public.external_provider_health(
 provider public.external_provider primary key, status text not null default 'healthy' check(status in('healthy','degraded','down')),
 consecutive_failures integer not null default 0 check(consecutive_failures>=0), circuit_open_until timestamptz,
 last_success_at timestamptz,last_failure_at timestamptz,last_error_code text,updated_at timestamptz not null default now()
);
insert into public.external_provider_health(provider) values('opendota'),('steam');

create table public.external_sync_jobs(
 id uuid primary key default gen_random_uuid(), provider public.external_provider not null, job_type text not null check(job_type in('profile_sync','match_import','heroes_sync')),
 dedupe_key text not null check(length(dedupe_key) between 1 and 180), player_game_account_id uuid references public.player_game_accounts(id) on delete cascade,
 external_match_id bigint check(external_match_id is null or external_match_id>0), status public.external_job_status not null default 'queued',
 attempts integer not null default 0 check(attempts between 0 and 10), max_attempts integer not null default 4 check(max_attempts between 1 and 10),
 run_after timestamptz not null default now(), locked_at timestamptz,locked_by text,last_error_code text,created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index external_sync_jobs_active_dedupe on public.external_sync_jobs(provider,dedupe_key) where status in('queued','running','retry_scheduled');
create index external_sync_jobs_pick_idx on public.external_sync_jobs(status,run_after,created_at);

create table public.dota_heroes(hero_id integer primary key check(hero_id>0),internal_name text not null unique,localized_name text not null,primary_attribute text,image_path text,provider public.external_provider not null default'opendota',updated_at timestamptz not null default now());
create table public.dota_matches(
 match_id bigint primary key check(match_id>0),provider public.external_provider not null default'opendota',radiant_win boolean,start_time timestamptz,duration_seconds integer check(duration_seconds is null or duration_seconds>=0),
 game_mode integer,lobby_type integer,patch integer,parse_state public.dota_parse_state not null default'unknown',replay_url text,
 source_hash text not null check(length(source_hash) between 16 and 128),fetched_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.dota_match_players(
 match_id bigint not null references public.dota_matches(match_id) on delete cascade,slot smallint not null check(slot between 0 and 255),
 account_id bigint check(account_id between 0 and 4294967295),hero_id integer references public.dota_heroes(hero_id),is_radiant boolean not null,
 kills integer,deaths integer,assists integer,gpm integer,xpm integer,player_game_account_id uuid references public.player_game_accounts(id),
 primary key(match_id,slot),unique(match_id,account_id)
);
create index dota_match_players_account_idx on public.dota_match_players(account_id,match_id desc);
create table public.match_external_links(
 id uuid primary key default gen_random_uuid(),match_game_id uuid not null references public.match_games(id) on delete cascade,
 dota_match_id bigint not null references public.dota_matches(match_id),reconciliation_state public.dota_reconciliation_state not null default'pending',
 radiant_team_id uuid references public.teams(id),dire_team_id uuid references public.teams(id),external_winner_team_id uuid references public.teams(id),
 result_agrees boolean,participant_summary jsonb not null default'{}',linked_by uuid not null references public.profiles(id),linked_at timestamptz not null default now(),
 corrected_from_id uuid references public.match_external_links(id),correction_reason text,
 unique(match_game_id),unique(dota_match_id)
);

create view public.public_dota_match_stats with(security_invoker=true,security_barrier=true) as
select l.match_game_id,m.match_id,m.radiant_win,m.start_time,m.duration_seconds,m.patch,m.parse_state,
 p.slot,p.account_id,p.hero_id,h.localized_name as hero_name,p.is_radiant,p.kills,p.deaths,p.assists,p.gpm,p.xpm
from public.match_external_links l join public.dota_matches m on m.match_id=l.dota_match_id
join public.dota_match_players p on p.match_id=m.match_id left join public.dota_heroes h on h.hero_id=p.hero_id
join public.match_games g on g.id=l.match_game_id join public.matches cm on cm.id=g.match_id
where cm.status in('completed','forfeit') and l.reconciliation_state in('matched','result_conflict');

create function public.link_dota_account(p_input text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_raw text:=trim(p_input);v_steam numeric;v_account bigint;v_id uuid;
begin
 if (select auth.uid()) is null then raise exception 'UNAUTHORIZED' using errcode='P0001';end if;
 if v_raw~'^https://steamcommunity.com/profiles/[0-9]{17}/?$' then v_raw:=regexp_replace(v_raw,'^https://steamcommunity.com/profiles/([0-9]{17})/?$','\1');end if;
 if v_raw~'^[0-9]{17}$' then v_steam:=v_raw::numeric;v_account:=(v_steam-76561197960265728)::bigint;
 elsif v_raw~'^[0-9]{1,10}$' then v_account:=v_raw::bigint;v_steam:=76561197960265728+v_account;
 else raise exception 'INVALID_DOTA_ACCOUNT' using errcode='P0001';end if;
 if v_account<0 or v_account>4294967295 or v_steam>9223372036854775807 then raise exception 'INVALID_DOTA_ACCOUNT' using errcode='P0001';end if;
 insert into public.player_game_accounts(player_id,steam_id64,dota_account_id,profile_url)
 values((select auth.uid()),v_steam::bigint,v_account,'https://steamcommunity.com/profiles/'||v_steam::text)
 returning id into v_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,payload) values((select auth.uid()),'GAME_ACCOUNT_LINKED','player_game_account',v_id,jsonb_build_object('game','dota2'));
 return v_id;
exception when unique_violation then raise exception 'ACCOUNT_ALREADY_LINKED' using errcode='P0001';end$$;

create function public.queue_external_sync(p_account_id uuid,p_job_type text default'profile_sync') returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_owner uuid;
begin select player_id into v_owner from public.player_game_accounts where id=p_account_id;
 if v_owner is distinct from (select auth.uid()) and not public.is_platform_moderator() then raise exception 'UNAUTHORIZED' using errcode='P0001';end if;
 insert into public.external_sync_jobs(provider,job_type,dedupe_key,player_game_account_id,created_by)
 values('opendota',p_job_type,p_job_type||':'||p_account_id,p_account_id,(select auth.uid())) returning id into v_id;return v_id;
exception when unique_violation then select id into v_id from public.external_sync_jobs where provider='opendota' and dedupe_key=p_job_type||':'||p_account_id and status in('queued','running','retry_scheduled');return v_id;end$$;

create function public.link_external_dota_match(p_match_game_id uuid,p_dota_match_id bigint) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_match uuid;v_tid uuid;v_a uuid;v_b uuid;v_allowed boolean;
begin if p_dota_match_id<=0 then raise exception 'INVALID_MATCH_ID' using errcode='P0001';end if;
 select g.match_id,m.tournament_id,m.team_a_id,m.team_b_id into v_match,v_tid,v_a,v_b from public.match_games g join public.matches m on m.id=g.match_id where g.id=p_match_game_id for update of g;
 v_allowed:=public.is_tournament_role(v_tid,'organizer') or public.is_tournament_role(v_tid,'referee') or exists(select 1 from public.teams t where t.id in(v_a,v_b) and t.captain_user_id=(select auth.uid()));
 if not coalesce(v_allowed,false) then raise exception 'UNAUTHORIZED_REFEREE' using errcode='P0001';end if;
 insert into public.dota_matches(match_id,source_hash) values(p_dota_match_id,md5(p_dota_match_id::text)||md5('pending')) on conflict do nothing;
 insert into public.match_external_links(match_game_id,dota_match_id,linked_by) values(p_match_game_id,p_dota_match_id,(select auth.uid())) returning id into v_id;
 update public.match_games set external_match_id=p_dota_match_id::text where id=p_match_game_id;
 insert into public.external_sync_jobs(provider,job_type,dedupe_key,external_match_id,created_by) values('opendota','match_import','match:'||p_dota_match_id,p_dota_match_id,(select auth.uid())) on conflict do nothing;
 insert into public.audit_events(tournament_id,actor_user_id,event_type,entity_type,entity_id,payload) values(v_tid,(select auth.uid()),'EXTERNAL_MATCH_LINKED','match',v_match,jsonb_build_object('match_game_id',p_match_game_id,'dota_match_id',p_dota_match_id));return v_id;
exception when unique_violation then raise exception 'MATCH_ALREADY_LINKED' using errcode='P0001';end$$;

create function public.reconcile_external_dota_match(p_link_id uuid) returns public.dota_reconciliation_state language plpgsql security definer set search_path='' as $$
declare v_match_id bigint;v_game uuid;v_team_a uuid;v_team_b uuid;v_canonical_winner uuid;v_radiant_win boolean;v_a bigint[];v_b bigint[];v_r bigint[];v_d bigint[];v_r_team uuid;v_d_team uuid;v_external_winner uuid;v_state public.dota_reconciliation_state;
begin select l.dota_match_id,l.match_game_id,m.team_a_id,m.team_b_id,g.winner_team_id,dm.radiant_win into v_match_id,v_game,v_team_a,v_team_b,v_canonical_winner,v_radiant_win from public.match_external_links l join public.match_games g on g.id=l.match_game_id join public.matches m on m.id=g.match_id join public.dota_matches dm on dm.match_id=l.dota_match_id where l.id=p_link_id for update of l;if v_match_id is null then raise exception 'MATCH_NOT_FOUND' using errcode='P0001';end if;
 select coalesce(array_agg(a.dota_account_id order by a.dota_account_id),'{}') into v_a from public.match_lineups ml join public.match_lineup_players lp on lp.lineup_id=ml.id join public.tournament_players tp on tp.id=lp.player_id join public.player_game_accounts a on a.player_id=tp.user_id and a.game='dota2' and a.is_primary where ml.match_id=(select match_id from public.match_games where id=v_game) and ml.team_id=v_team_a;
 select coalesce(array_agg(a.dota_account_id order by a.dota_account_id),'{}') into v_b from public.match_lineups ml join public.match_lineup_players lp on lp.lineup_id=ml.id join public.tournament_players tp on tp.id=lp.player_id join public.player_game_accounts a on a.player_id=tp.user_id and a.game='dota2' and a.is_primary where ml.match_id=(select match_id from public.match_games where id=v_game) and ml.team_id=v_team_b;
 select coalesce(array_agg(account_id order by account_id),'{}') into v_r from public.dota_match_players where match_id=v_match_id and is_radiant and account_id is not null;select coalesce(array_agg(account_id order by account_id),'{}') into v_d from public.dota_match_players where match_id=v_match_id and not is_radiant and account_id is not null;
 if cardinality(v_a)=0 or cardinality(v_b)=0 or cardinality(v_r)=0 or cardinality(v_d)=0 then v_state:='partial';elsif v_a=v_r and v_b=v_d then v_r_team:=v_team_a;v_d_team:=v_team_b;v_state:='matched';elsif v_a=v_d and v_b=v_r then v_r_team:=v_team_b;v_d_team:=v_team_a;v_state:='matched';elsif exists(select 1 from unnest(v_a||v_b) x where x=any(v_r||v_d)) then v_state:='partial';else v_state:='participant_mismatch';end if;
 if v_state='matched' and v_radiant_win is not null then v_external_winner:=case when v_radiant_win then v_r_team else v_d_team end;if v_canonical_winner is not null and v_canonical_winner<>v_external_winner then v_state:='result_conflict';end if;end if;
 update public.match_external_links set reconciliation_state=v_state,radiant_team_id=v_r_team,dire_team_id=v_d_team,external_winner_team_id=v_external_winner,result_agrees=case when v_canonical_winner is null or v_external_winner is null then null else v_canonical_winner=v_external_winner end,participant_summary=jsonb_build_object('team_a_linked',cardinality(v_a),'team_b_linked',cardinality(v_b),'radiant_known',cardinality(v_r),'dire_known',cardinality(v_d)) where id=p_link_id;return v_state;end$$;

create function public.claim_external_sync_job(p_worker text) returns setof public.external_sync_jobs language plpgsql security definer set search_path='' as $$
begin return query update public.external_sync_jobs j set status='running',attempts=attempts+1,locked_at=now(),locked_by=left(p_worker,80),updated_at=now() where j.id=(select q.id from public.external_sync_jobs q where q.status in('queued','retry_scheduled') and q.run_after<=now() order by q.run_after,q.created_at for update skip locked limit 1) returning j.*;end$$;
create function public.finish_external_sync_job(p_id uuid,p_success boolean,p_error_code text default null,p_retry_seconds integer default null) returns void language plpgsql security definer set search_path='' as $$
begin update public.external_sync_jobs set status=case when p_success then'succeeded'::public.external_job_status when attempts<max_attempts and p_retry_seconds is not null then'retry_scheduled'::public.external_job_status else'failed'::public.external_job_status end,last_error_code=left(p_error_code,80),run_after=case when p_retry_seconds is not null then now()+make_interval(secs=>greatest(1,least(p_retry_seconds,86400)))else run_after end,locked_at=null,locked_by=null,updated_at=now() where id=p_id;end$$;

alter table public.player_game_accounts enable row level security;alter table public.dota_profile_snapshots enable row level security;alter table public.external_provider_cache enable row level security;alter table public.external_provider_requests enable row level security;alter table public.external_provider_health enable row level security;alter table public.external_sync_jobs enable row level security;alter table public.dota_heroes enable row level security;alter table public.dota_matches enable row level security;alter table public.dota_match_players enable row level security;alter table public.match_external_links enable row level security;
create policy game_accounts_owner_read on public.player_game_accounts for select to authenticated using(player_id=(select auth.uid()) or public.is_platform_moderator());
create policy profile_snapshots_owner_read on public.dota_profile_snapshots for select to authenticated using(exists(select 1 from public.player_game_accounts a where a.id=player_game_account_id and(a.player_id=(select auth.uid()) or public.is_platform_moderator())));
create policy heroes_public_read on public.dota_heroes for select to anon,authenticated using(true);
create policy matches_public_read on public.dota_matches for select to anon,authenticated using(exists(select 1 from public.match_external_links l join public.match_games g on g.id=l.match_game_id join public.matches m on m.id=g.match_id where l.dota_match_id=dota_matches.match_id and m.status in('completed','forfeit')));
create policy match_players_public_read on public.dota_match_players for select to anon,authenticated using(exists(select 1 from public.dota_matches m where m.match_id=dota_match_players.match_id));
create policy links_public_read on public.match_external_links for select to anon,authenticated using(exists(select 1 from public.match_games g join public.matches m on m.id=g.match_id where g.id=match_game_id and m.status in('completed','forfeit')));
create policy provider_health_admin_read on public.external_provider_health for select to authenticated using(public.is_platform_moderator());
create policy provider_requests_admin_read on public.external_provider_requests for select to authenticated using(public.is_platform_moderator());
create policy sync_jobs_admin_or_owner_read on public.external_sync_jobs for select to authenticated using(public.is_platform_moderator() or created_by=(select auth.uid()));

revoke all on public.external_provider_cache from anon,authenticated;revoke all on public.external_provider_requests from anon;revoke all on public.external_sync_jobs from anon;
grant select on public.player_game_accounts,public.dota_profile_snapshots,public.dota_heroes,public.dota_matches,public.dota_match_players,public.match_external_links,public.public_dota_match_stats to anon,authenticated;
revoke select on public.player_game_accounts,public.dota_profile_snapshots from anon;
grant select on public.external_provider_health,public.external_provider_requests,public.external_sync_jobs to authenticated;
revoke all on function public.link_dota_account(text),public.queue_external_sync(uuid,text),public.link_external_dota_match(uuid,bigint) from public,anon;
grant execute on function public.link_dota_account(text),public.queue_external_sync(uuid,text),public.link_external_dota_match(uuid,bigint) to authenticated;
revoke all on function public.claim_external_sync_job(text),public.finish_external_sync_job(uuid,boolean,text,integer) from public,anon,authenticated;
grant execute on function public.claim_external_sync_job(text),public.finish_external_sync_job(uuid,boolean,text,integer) to service_role;
revoke all on function public.reconcile_external_dota_match(uuid) from public,anon,authenticated;grant execute on function public.reconcile_external_dota_match(uuid) to service_role;
