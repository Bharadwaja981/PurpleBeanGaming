-- Phase 05: privacy-safe public draft intelligence and immutable history.

alter table public.profiles add column public_slug text;
alter table public.profiles add column show_region_publicly boolean not null default false;
alter table public.profiles add column show_mmr_history_publicly boolean not null default false;
alter table public.profiles add column show_steam_publicly boolean not null default false;
alter table public.profiles add column show_discord_publicly boolean not null default false;
update public.profiles set public_slug='player-'||substr(md5(id::text),1,16) where public_slug is null;
alter table public.profiles alter column public_slug set not null;
alter table public.profiles add constraint profiles_public_slug_unique unique(public_slug);
create function private.assign_profile_public_slug() returns trigger language plpgsql set search_path='' as $$begin new.public_slug:=coalesce(new.public_slug,'player-'||substr(md5(new.id::text),1,16));return new;end$$;
create trigger assign_profile_public_slug before insert on public.profiles for each row execute function private.assign_profile_public_slug();
revoke all on function private.assign_profile_public_slug() from public,anon,authenticated;

alter table public.teams add column public_slug text;
update public.teams set public_slug=lower(regexp_replace(trim(both '-' from regexp_replace(name,'[^a-zA-Z0-9]+','-','g')),'-+','-','g')) where public_slug is null;
alter table public.teams alter column public_slug set not null;
alter table public.teams add constraint teams_tournament_public_slug_unique unique(tournament_id,public_slug);
create function private.assign_team_public_slug() returns trigger language plpgsql set search_path='' as $$begin new.public_slug:=coalesce(new.public_slug,lower(regexp_replace(trim(both '-' from regexp_replace(new.name,'[^a-zA-Z0-9]+','-','g')),'-+','-','g'))||'-'||substr(md5(new.id::text),1,6));return new;end$$;
create trigger assign_team_public_slug before insert on public.teams for each row execute function private.assign_team_public_slug();
revoke all on function private.assign_team_public_slug() from public,anon,authenticated;

alter table public.tournament_rules add column spectator_delay_seconds integer not null default 0 check(spectator_delay_seconds between 0 and 3600);

create table public.draft_snapshots(
  id uuid primary key default gen_random_uuid(),tournament_id uuid not null unique references public.tournaments(id),
  tournament_name text not null,tournament_slug text not null,season text,rules_version integer not null,
  team_size integer not null,mmr_target integer,mmr_min integer,mmr_max integer,starting_credits integer not null,
  started_at timestamptz,completed_at timestamptz not null,snapshot_at timestamptz not null default clock_timestamp(),
  total_bids integer not null,total_auctions integer not null,total_sold integer not null,total_unsold integer not null
);
create table public.draft_team_snapshots(
  id uuid primary key default gen_random_uuid(),snapshot_id uuid not null references public.draft_snapshots(id) on delete cascade,
  tournament_id uuid not null,team_id uuid not null,team_slug text not null,team_name text not null,team_tag text not null,
  logo_url text,accent_color text,captain_slug text not null,captain_name text not null,captain_mmr integer not null,
  final_team_mmr integer not null,starting_credits integer not null,credits_remaining integer not null,recruit_count integer not null,
  unique(snapshot_id,team_id),unique(tournament_id,team_slug)
);
create table public.draft_player_snapshots(
  id uuid primary key default gen_random_uuid(),snapshot_id uuid not null references public.draft_snapshots(id) on delete cascade,
  tournament_id uuid not null,team_id uuid not null,player_id uuid not null,player_slug text not null,ign text not null,
  primary_role text,secondary_role text,region text,tournament_mmr_at_draft integer not null,purchase_price integer,
  acquisition_type public.acquisition_type not null,auction_id uuid,auction_sequence integer,bid_count integer not null default 0,
  unique(snapshot_id,player_id)
);
create index draft_player_history_slug_idx on public.draft_player_snapshots(player_slug,snapshot_id);
create index draft_team_history_slug_idx on public.draft_team_snapshots(team_slug,snapshot_id);

alter table public.draft_snapshots enable row level security;
alter table public.draft_team_snapshots enable row level security;
alter table public.draft_player_snapshots enable row level security;
create policy public_snapshot_read on public.draft_snapshots for select to anon,authenticated using(true);
create policy public_team_snapshot_read on public.draft_team_snapshots for select to anon,authenticated using(true);
create policy public_player_snapshot_read on public.draft_player_snapshots for select to anon,authenticated using(true);
grant select on public.draft_snapshots,public.draft_team_snapshots,public.draft_player_snapshots to anon,authenticated;
revoke insert,update,delete on public.draft_snapshots,public.draft_team_snapshots,public.draft_player_snapshots from anon,authenticated;

create function public.snapshot_completed_draft(p_tournament_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_snapshot uuid;v_t public.tournaments%rowtype;v_r public.tournament_rules%rowtype;
begin
  if not public.is_tournament_role(p_tournament_id,'organizer') then raise exception 'forbidden' using errcode='42501';end if;
  select * into v_t from public.tournaments where id=p_tournament_id for update;
  if v_t.status not in ('rosters_locked','competition','completed') then raise exception 'draft must be complete before snapshot';end if;
  if exists(select 1 from public.teams tm join public.tournament_rules r on r.tournament_id=tm.tournament_id where tm.tournament_id=p_tournament_id and tm.roster_size<>r.team_size-1) then raise exception 'all teams must have complete recruit rosters';end if;
  select id into v_snapshot from public.draft_snapshots where tournament_id=p_tournament_id;
  if v_snapshot is not null then return jsonb_build_object('ok',true,'snapshot_id',v_snapshot,'duplicate',true);end if;
  select * into v_r from public.tournament_rules where tournament_id=p_tournament_id;
  insert into public.draft_snapshots(tournament_id,tournament_name,tournament_slug,season,rules_version,team_size,mmr_target,mmr_min,mmr_max,starting_credits,started_at,completed_at,total_bids,total_auctions,total_sold,total_unsold)
  select v_t.id,v_t.name,v_t.slug,v_t.season,v_r.rules_version,v_r.team_size,v_r.mmr_target,v_r.mmr_min,v_r.mmr_max,v_r.starting_credits,min(a.started_at),clock_timestamp(),
    (select count(*) from public.bids b where b.tournament_id=p_tournament_id and b.accepted),count(*),count(*) filter(where a.status='sold'),count(*) filter(where a.status='unsold')
  from public.auctions a where a.tournament_id=p_tournament_id returning id into v_snapshot;
  insert into public.draft_team_snapshots(snapshot_id,tournament_id,team_id,team_slug,team_name,team_tag,logo_url,accent_color,captain_slug,captain_name,captain_mmr,final_team_mmr,starting_credits,credits_remaining,recruit_count)
  select v_snapshot,t.tournament_id,t.id,t.public_slug,t.name,t.short_tag,t.logo_url,t.accent_color,p.public_slug,coalesce(p.display_name,tp.ign),t.captain_mmr,t.current_team_mmr,t.starting_credits,t.credits_remaining,t.roster_size
  from public.teams t join public.profiles p on p.id=t.captain_user_id join public.tournament_players tp on tp.tournament_id=t.tournament_id and tp.user_id=t.captain_user_id where t.tournament_id=p_tournament_id;
  insert into public.draft_player_snapshots(snapshot_id,tournament_id,team_id,player_id,player_slug,ign,primary_role,secondary_role,region,tournament_mmr_at_draft,purchase_price,acquisition_type,auction_id,auction_sequence,bid_count)
  select v_snapshot,tr.tournament_id,tr.team_id,tr.player_id,p.public_slug,tp.ign,tp.primary_role,tp.secondary_role,case when p.show_region_publicly then tp.region end,tr.tournament_mmr_at_draft,tr.purchase_price,tr.acquisition_type,tr.auction_id,a.sequence_number,coalesce((select count(*) from public.bids b where b.auction_id=tr.auction_id and b.accepted),0)
  from public.team_roster tr join public.tournament_players tp on tp.id=tr.player_id join public.profiles p on p.id=tp.user_id left join public.auctions a on a.id=tr.auction_id where tr.tournament_id=p_tournament_id and tr.is_active;
  perform private.audit(p_tournament_id,'DRAFT_HISTORY_SNAPSHOTTED','draft_snapshot',v_snapshot,jsonb_build_object('snapshot_id',v_snapshot));
  return jsonb_build_object('ok',true,'snapshot_id',v_snapshot,'duplicate',false);
end$$;
revoke all on function public.snapshot_completed_draft(uuid) from public,anon;
grant execute on function public.snapshot_completed_draft(uuid) to authenticated;

create view public.public_draft_player_analytics with (security_invoker=true,security_barrier=true) as
with rates as (
 select snapshot_id,percentile_cont(.5) within group(order by purchase_price::numeric/nullif(tournament_mmr_at_draft,0)*1000) median_rate
 from public.draft_player_snapshots where purchase_price is not null and acquisition_type<>'captain' group by snapshot_id
),sold as (
 select d.*,r.median_rate from public.draft_player_snapshots d join rates r using(snapshot_id) where d.purchase_price is not null and d.acquisition_type<>'captain'
)
select s.snapshot_id,s.tournament_id,s.player_slug,s.ign,s.team_id,s.primary_role,s.tournament_mmr_at_draft,s.purchase_price,
 round(s.purchase_price::numeric/nullif(s.tournament_mmr_at_draft,0)*1000,2) credits_per_1000_mmr,s.bid_count,
 round(s.median_rate::numeric*s.tournament_mmr_at_draft/1000,2) expected_price,
 round(s.purchase_price-(s.median_rate::numeric*s.tournament_mmr_at_draft/1000),2) price_delta,
 round(s.purchase_price/nullif(s.median_rate::numeric*s.tournament_mmr_at_draft/1000,0),3) price_ratio,
 case when s.purchase_price/nullif(s.median_rate*s.tournament_mmr_at_draft/1000,0)<=.75 then 'Strong Value' when s.purchase_price/nullif(s.median_rate*s.tournament_mmr_at_draft/1000,0)<=.9 then 'Good Value' when s.purchase_price/nullif(s.median_rate*s.tournament_mmr_at_draft/1000,0)<1.1 then 'Near Expected' when s.purchase_price/nullif(s.median_rate*s.tournament_mmr_at_draft/1000,0)<1.3 then 'Premium Price' else 'High Premium' end price_indicator,
 rank() over(partition by s.snapshot_id order by s.purchase_price desc) price_rank,rank() over(partition by s.snapshot_id order by s.tournament_mmr_at_draft desc) mmr_rank,s.auction_sequence
from sold s;

create view public.public_draft_team_analytics with (security_invoker=true,security_barrier=true) as
select t.snapshot_id,t.tournament_id,t.team_slug,t.team_name,t.team_tag,t.logo_url,t.captain_slug,t.captain_name,t.captain_mmr,t.final_team_mmr,t.starting_credits,t.credits_remaining,t.recruit_count,
 t.starting_credits-t.credits_remaining credits_spent,round(avg(p.purchase_price) filter(where p.acquisition_type<>'captain'),2) average_purchase,
 max(p.purchase_price) highest_purchase,min(p.purchase_price) filter(where p.acquisition_type<>'captain') lowest_purchase,
 sum(p.tournament_mmr_at_draft) filter(where p.acquisition_type<>'captain') drafted_mmr,
 round((t.starting_credits-t.credits_remaining)::numeric/nullif(sum(p.tournament_mmr_at_draft) filter(where p.acquisition_type<>'captain'),0)*1000,2) credits_per_1000_mmr
from public.draft_team_snapshots t left join public.draft_player_snapshots p on p.snapshot_id=t.snapshot_id and p.team_id=t.team_id group by t.id;

create view public.public_draft_events with (security_barrier=true) as
select a.tournament_id,a.id event_id,a.started_at event_at,'PLAYER_NOMINATED'::text event_type,a.sequence_number,a.player_id,a.nominating_team_id team_id,null::integer amount from public.auctions a
union all select b.tournament_id,b.id,b.received_at,'BID_ACCEPTED',a.sequence_number,a.player_id,b.team_id,b.amount from public.bids b join public.auctions a on a.id=b.auction_id where b.accepted
union all select a.tournament_id,a.id,a.closed_at,case when a.status='sold' then 'PLAYER_SOLD' else 'PLAYER_UNSOLD' end,a.sequence_number,a.player_id,a.winning_team_id,a.winning_bid from public.auctions a where a.status in ('sold','unsold');

grant select on public.public_draft_player_analytics,public.public_draft_team_analytics,public.public_draft_events to anon,authenticated;

create function public.get_public_draft_package(p_slug text) returns jsonb language sql stable security definer set search_path='' as $$
with t as(select t.*,r.spectator_delay_seconds,r.team_size,r.mmr_target,r.mmr_min,r.mmr_max from public.tournaments t join public.tournament_rules r on r.tournament_id=t.id where t.slug=p_slug and t.status not in ('draft','cancelled')),
cutoff as(select *,clock_timestamp()-make_interval(secs=>spectator_delay_seconds) visible_at from t)
select jsonb_build_object(
 'tournament',(select jsonb_build_object('id',id,'name',name,'slug',slug,'season',season,'status',status,'team_size',team_size,'mmr_target',mmr_target,'mmr_min',mmr_min,'mmr_max',mmr_max,'spectator_delay_seconds',spectator_delay_seconds) from cutoff),
 'auction',(select to_jsonb(x) from (select a.id,a.sequence_number,a.status,a.opening_bid,a.current_bid,a.started_at,a.closes_at,a.closed_at,tp.ign,tp.primary_role,tp.secondary_role,tp.tournament_mmr,lead.name leading_team from public.auctions a join cutoff c on c.id=a.tournament_id join public.tournament_players tp on tp.id=a.player_id left join public.teams lead on lead.id=a.leading_team_id where coalesce(a.started_at,a.created_at)<=c.visible_at order by a.sequence_number desc limit 1)x),
 'teams',(select coalesce(jsonb_agg(to_jsonb(x) order by x.team_name),'[]') from (select tm.id,tm.public_slug team_slug,tm.name team_name,tm.short_tag,tm.logo_url,tm.accent_color,tm.current_team_mmr,tm.credits_remaining,1+tm.roster_size player_count,c.public_slug captain_slug,coalesce(c.display_name,ctp.ign) captain_name,tm.captain_mmr from public.teams tm join cutoff x on x.id=tm.tournament_id join public.profiles c on c.id=tm.captain_user_id join public.tournament_players ctp on ctp.tournament_id=tm.tournament_id and ctp.user_id=tm.captain_user_id)x),
 'rosters',(select coalesce(jsonb_agg(to_jsonb(x) order by x.team_id,x.ign),'[]') from (select tr.team_id,p.public_slug player_slug,tp.ign,tp.primary_role,tp.secondary_role,tr.tournament_mmr_at_draft,tr.purchase_price from public.team_roster tr join cutoff c on c.id=tr.tournament_id join public.tournament_players tp on tp.id=tr.player_id join public.profiles p on p.id=tp.user_id where tr.created_at<=c.visible_at and tr.is_active)x),
 'history',(select coalesce(jsonb_agg(to_jsonb(x) order by x.sequence_number desc),'[]') from (select a.id,a.sequence_number,a.status,tp.ign,nt.name nominating_team,wt.name winning_team,a.winning_bid,a.started_at,a.closed_at,extract(epoch from a.closed_at-a.started_at)::integer duration_seconds,(select count(*) from public.bids b where b.auction_id=a.id and b.accepted) bid_count,(select count(distinct team_id) from public.bids b where b.auction_id=a.id and b.accepted) bidding_teams from public.auctions a join cutoff c on c.id=a.tournament_id join public.tournament_players tp on tp.id=a.player_id join public.teams nt on nt.id=a.nominating_team_id left join public.teams wt on wt.id=a.winning_team_id where coalesce(a.closed_at,a.started_at)<=c.visible_at)x),
 'events',(select coalesce(jsonb_agg(to_jsonb(e) order by event_at),'[]') from public.public_draft_events e join cutoff c on c.id=e.tournament_id where e.event_at<=c.visible_at),
 'snapshot',(select to_jsonb(s) from public.draft_snapshots s join cutoff c on c.id=s.tournament_id),
 'player_analytics',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.public_draft_player_analytics a join cutoff c on c.id=a.tournament_id),
 'team_analytics',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.public_draft_team_analytics a join cutoff c on c.id=a.tournament_id)
) from cutoff;
$$;
revoke all on function public.get_public_draft_package(text) from public;
grant execute on function public.get_public_draft_package(text) to anon,authenticated;

create function public.export_draft_csv(p_tournament_id uuid) returns text language sql stable security definer set search_path='' as $$
select 'team,captain,player,role,tournament_mmr,purchase_price,credits_remaining,team_mmr'||E'\n'||coalesce(string_agg(format('%s,%s,%s,%s,%s,%s,%s,%s',replace(t.team_name,',',' '),replace(t.captain_name,',',' '),replace(p.ign,',',' '),coalesce(p.primary_role,''),p.tournament_mmr_at_draft,coalesce(p.purchase_price,0),t.credits_remaining,t.final_team_mmr),E'\n' order by t.team_name,p.ign),'') from public.draft_team_snapshots t join public.draft_player_snapshots p on p.snapshot_id=t.snapshot_id and p.team_id=t.team_id where t.tournament_id=p_tournament_id and public.is_tournament_role(p_tournament_id,'organizer');
$$;
revoke all on function public.export_draft_csv(uuid) from public,anon;
grant execute on function public.export_draft_csv(uuid) to authenticated;
