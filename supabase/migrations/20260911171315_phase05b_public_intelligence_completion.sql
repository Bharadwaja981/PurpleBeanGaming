-- Phase 05B: complete immutable analytics and public spectator projections.

alter table public.auctions add column anti_snipe_extension_count integer not null default 0 check(anti_snipe_extension_count>=0);
create function private.count_anti_snipe_extension() returns trigger language plpgsql set search_path='' as $$
begin
  if new.current_bid is distinct from old.current_bid and new.closes_at>old.closes_at then new.anti_snipe_extension_count:=old.anti_snipe_extension_count+1;end if;
  return new;
end$$;
create trigger count_anti_snipe_extension before update on public.auctions for each row execute function private.count_anti_snipe_extension();
revoke all on function private.count_anti_snipe_extension() from public,anon,authenticated;

alter table public.draft_player_snapshots add column unique_bidding_teams integer not null default 0;
alter table public.draft_player_snapshots add column wall_clock_duration_seconds integer;
alter table public.draft_player_snapshots add column active_bidding_duration_seconds integer;
alter table public.draft_player_snapshots add column anti_snipe_extension_count integer not null default 0;
alter table public.draft_player_snapshots add column nomination_round integer;
alter table public.draft_player_snapshots add column draft_phase text not null default 'normal' check(draft_phase in ('normal','unsold'));

create function private.enrich_draft_player_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
declare v_auction public.auctions%rowtype;v_paused integer;
begin
  if new.auction_id is null then return new;end if;
  select * into v_auction from public.auctions where id=new.auction_id;
  new.unique_bidding_teams:=(select count(distinct team_id) from public.bids where auction_id=new.auction_id and accepted);
  new.wall_clock_duration_seconds:=greatest(extract(epoch from v_auction.closed_at-v_auction.started_at)::integer,0);
  with ordered as(select event_type,created_at,lead(created_at) over(order by created_at) next_at from public.audit_events where tournament_id=new.tournament_id and entity_id=new.auction_id and event_type in ('AUCTION_PAUSED','AUCTION_RESUMED'))
  select coalesce(sum(extract(epoch from next_at-created_at)) filter(where event_type='AUCTION_PAUSED'),0)::integer into v_paused from ordered;
  new.active_bidding_duration_seconds:=greatest(new.wall_clock_duration_seconds-v_paused,0);
  new.anti_snipe_extension_count:=v_auction.anti_snipe_extension_count;
  new.draft_phase:=case when exists(select 1 from public.auctions prior where prior.tournament_id=new.tournament_id and prior.player_id=new.player_id and prior.sequence_number<v_auction.sequence_number and prior.status='unsold') then 'unsold' else 'normal' end;
  new.nomination_round:=coalesce((select max(round_number) from public.nomination_order where tournament_id=new.tournament_id and team_id=v_auction.nominating_team_id and completed_at<=v_auction.closed_at),1);
  return new;
end$$;
create trigger enrich_draft_player_snapshot before insert on public.draft_player_snapshots for each row execute function private.enrich_draft_player_snapshot();
revoke all on function private.enrich_draft_player_snapshot() from public,anon,authenticated;

create table public.feasibility_event_snapshots(
 id uuid primary key default gen_random_uuid(),tournament_id uuid not null references public.tournaments(id) on delete cascade,
 auction_id uuid references public.auctions(id) on delete set null,team_id uuid references public.teams(id) on delete set null,
 player_id uuid references public.tournament_players(id) on delete set null,reason_code text not null,
 safe_range_min integer,safe_range_max integer,remaining_slots integer not null,current_team_mmr integer not null,
 mmr_min integer,mmr_max integer,rules_version integer not null,created_at timestamptz not null default clock_timestamp()
);
alter table public.feasibility_event_snapshots enable row level security;
create policy feasibility_organizer_read on public.feasibility_event_snapshots for select to authenticated using(public.is_tournament_role(tournament_id,'organizer'));
grant select on public.feasibility_event_snapshots to authenticated;
revoke insert,update,delete on public.feasibility_event_snapshots from anon,authenticated;
create index feasibility_event_tournament_time_idx on public.feasibility_event_snapshots(tournament_id,created_at,team_id);

create function private.capture_feasibility_event() returns trigger language plpgsql security definer set search_path='' as $$
declare v_team public.teams%rowtype;v_rules public.tournament_rules%rowtype;
begin
 if new.event_type not in ('BID_BLOCKED_BY_FEASIBILITY','FINALIZATION_BLOCKED_BY_FEASIBILITY') then return new;end if;
 select * into v_team from public.teams where id=nullif(new.payload->>'team_id','')::uuid;
 select * into v_rules from public.tournament_rules where tournament_id=new.tournament_id;
 insert into public.feasibility_event_snapshots(tournament_id,auction_id,team_id,player_id,reason_code,remaining_slots,current_team_mmr,mmr_min,mmr_max,rules_version,created_at)
 values(new.tournament_id,new.entity_id,v_team.id,nullif(new.payload->>'player_id','')::uuid,coalesce(new.payload->>'code','DRAFT_WOULD_BECOME_IMPOSSIBLE'),greatest(v_rules.team_size-1-coalesce(v_team.roster_size,0),0),coalesce(v_team.current_team_mmr,0),v_rules.mmr_min,v_rules.mmr_max,v_rules.rules_version,new.created_at);
 return new;
end$$;
create trigger capture_feasibility_event after insert on public.audit_events for each row execute function private.capture_feasibility_event();
revoke all on function private.capture_feasibility_event() from public,anon,authenticated;

create view public.public_team_spend_progression with (security_invoker=true,security_barrier=true) as
select p.snapshot_id,p.tournament_id,t.team_slug,t.team_name,p.auction_sequence,p.ign player,p.purchase_price,p.draft_phase,p.nomination_round,
 t.starting_credits-coalesce(sum(p.purchase_price) over(partition by p.snapshot_id,p.team_id order by p.auction_sequence rows between unbounded preceding and 1 preceding),0) credits_before,
 t.starting_credits-sum(p.purchase_price) over(partition by p.snapshot_id,p.team_id order by p.auction_sequence) credits_after,
 sum(p.purchase_price) over(partition by p.snapshot_id,p.team_id order by p.auction_sequence) cumulative_spent,
 greatest(t.recruit_count-row_number() over(partition by p.snapshot_id,p.team_id order by p.auction_sequence),0)::integer remaining_roster_slots,
 t.captain_mmr+sum(p.tournament_mmr_at_draft) over(partition by p.snapshot_id,p.team_id order by p.auction_sequence) team_mmr_after
from public.draft_player_snapshots p join public.draft_team_snapshots t on t.snapshot_id=p.snapshot_id and t.team_id=p.team_id where p.acquisition_type<>'captain';
grant select on public.public_team_spend_progression to anon,authenticated;

create or replace view public.public_draft_player_analytics with (security_invoker=true,security_barrier=true) as
with rates as(select snapshot_id,percentile_cont(.5) within group(order by purchase_price::numeric/nullif(tournament_mmr_at_draft,0)*1000) median_rate from public.draft_player_snapshots where purchase_price is not null and acquisition_type<>'captain' group by snapshot_id),sold as(select d.*,r.median_rate from public.draft_player_snapshots d join rates r using(snapshot_id) where d.purchase_price is not null and d.acquisition_type<>'captain')
select s.snapshot_id,s.tournament_id,s.player_slug,s.ign,s.team_id,s.primary_role,s.tournament_mmr_at_draft,s.purchase_price,round(s.purchase_price::numeric/nullif(s.tournament_mmr_at_draft,0)*1000,2) credits_per_1000_mmr,s.bid_count,
 round(s.median_rate::numeric*s.tournament_mmr_at_draft/1000,2) expected_price,round(s.purchase_price-(s.median_rate::numeric*s.tournament_mmr_at_draft/1000),2) price_delta,round(s.purchase_price/nullif(s.median_rate::numeric*s.tournament_mmr_at_draft/1000,0),3) price_ratio,
 case when s.purchase_price/nullif(s.median_rate*s.tournament_mmr_at_draft/1000,0)<=.75 then 'Strong Value' when s.purchase_price/nullif(s.median_rate*s.tournament_mmr_at_draft/1000,0)<=.9 then 'Good Value' when s.purchase_price/nullif(s.median_rate*s.tournament_mmr_at_draft/1000,0)<1.1 then 'Near Expected' when s.purchase_price/nullif(s.median_rate*s.tournament_mmr_at_draft/1000,0)<1.3 then 'Premium Price' else 'High Premium' end price_indicator,
 rank() over(partition by s.snapshot_id order by s.purchase_price desc) price_rank,rank() over(partition by s.snapshot_id order by s.tournament_mmr_at_draft desc) mmr_rank,s.auction_sequence,s.unique_bidding_teams,s.wall_clock_duration_seconds,s.active_bidding_duration_seconds,s.anti_snipe_extension_count,s.nomination_round,s.draft_phase from sold s;

create or replace view public.public_draft_team_analytics with (security_invoker=true,security_barrier=true) as
select t.snapshot_id,t.tournament_id,t.team_slug,t.team_name,t.team_tag,t.logo_url,t.captain_slug,t.captain_name,t.captain_mmr,t.final_team_mmr,t.starting_credits,t.credits_remaining,t.recruit_count,t.starting_credits-t.credits_remaining credits_spent,
 round(avg(p.purchase_price) filter(where p.acquisition_type<>'captain'),2) average_purchase,max(p.purchase_price) highest_purchase,min(p.purchase_price) filter(where p.acquisition_type<>'captain') lowest_purchase,sum(p.tournament_mmr_at_draft) filter(where p.acquisition_type<>'captain') drafted_mmr,
 round((t.starting_credits-t.credits_remaining)::numeric/nullif(sum(p.tournament_mmr_at_draft) filter(where p.acquisition_type<>'captain'),0)*1000,2) credits_per_1000_mmr,
 count(*) filter(where p.unique_bidding_teams>=2) contested_wins,count(*) filter(where p.unique_bidding_teams=1) uncontested_wins,count(*) filter(where p.draft_phase='unsold') unsold_round_acquisitions,
 coalesce(sum(p.purchase_price) filter(where p.draft_phase='normal'),0) normal_round_spend,coalesce(sum(p.purchase_price) filter(where p.draft_phase='unsold'),0) unsold_round_spend
from public.draft_team_snapshots t left join public.draft_player_snapshots p on p.snapshot_id=t.snapshot_id and p.team_id=t.team_id group by t.id;

create view public.public_captain_draft_history with (security_invoker=true,security_barrier=true) as
select t.captain_slug,t.captain_name,s.tournament_name,s.tournament_slug,s.completed_at,t.team_name,t.team_slug,t.recruit_count players_acquired,t.starting_credits-t.credits_remaining credits_spent,t.credits_remaining,t.final_team_mmr,t.final_team_mmr-s.mmr_target distance_from_target,a.credits_per_1000_mmr average_purchase_efficiency,a.contested_wins,a.uncontested_wins,a.unsold_round_acquisitions
from public.draft_team_snapshots t join public.draft_snapshots s on s.id=t.snapshot_id join public.public_draft_team_analytics a on a.snapshot_id=t.snapshot_id and a.team_slug=t.team_slug;
grant select on public.public_captain_draft_history to anon,authenticated;

create function public.get_public_auction_history(p_slug text,p_player text default null,p_team text default null,p_status text default null,p_price_min integer default null,p_price_max integer default null,p_round integer default null,p_unsold_only boolean default null,p_page integer default 1,p_page_size integer default 25) returns jsonb language sql stable security definer set search_path='' as $$
with context as(select t.id,clock_timestamp()-make_interval(secs=>r.spectator_delay_seconds) visible_at from public.tournaments t join public.tournament_rules r on r.tournament_id=t.id where t.slug=p_slug and t.status not in ('draft','cancelled')),rows as(
 select a.id,a.sequence_number,a.status,tp.ign,nt.name nominating_team,wt.name winning_team,a.winning_bid,a.started_at,a.closed_at,extract(epoch from a.closed_at-a.started_at)::integer wall_clock_duration_seconds,(select count(*) from public.bids b where b.auction_id=a.id and b.accepted) bid_count,(select count(distinct team_id) from public.bids b where b.auction_id=a.id and b.accepted) unique_bidding_teams,a.anti_snipe_extension_count,coalesce((select max(n.round_number) from public.nomination_order n where n.tournament_id=a.tournament_id and n.team_id=a.nominating_team_id and n.completed_at<=a.closed_at),1) nomination_round,exists(select 1 from public.auctions prior where prior.tournament_id=a.tournament_id and prior.player_id=a.player_id and prior.sequence_number<a.sequence_number and prior.status='unsold') unsold_round
 from public.auctions a join context c on c.id=a.tournament_id join public.tournament_players tp on tp.id=a.player_id join public.teams nt on nt.id=a.nominating_team_id left join public.teams wt on wt.id=a.winning_team_id where coalesce(a.closed_at,a.started_at)<=c.visible_at)
select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(r) order by sequence_number desc) from (select * from rows where (p_player is null or ign ilike '%'||p_player||'%') and (p_team is null or nominating_team=p_team or winning_team=p_team) and (p_status is null or status::text=p_status) and (p_price_min is null or winning_bid>=p_price_min) and (p_price_max is null or winning_bid<=p_price_max) and (p_round is null or nomination_round=p_round) and (p_unsold_only is null or unsold_round=p_unsold_only) order by sequence_number desc limit least(greatest(p_page_size,1),100) offset (greatest(p_page,1)-1)*least(greatest(p_page_size,1),100))r),'[]'),'total',(select count(*) from rows where (p_player is null or ign ilike '%'||p_player||'%') and (p_team is null or nominating_team=p_team or winning_team=p_team) and (p_status is null or status::text=p_status) and (p_price_min is null or winning_bid>=p_price_min) and (p_price_max is null or winning_bid<=p_price_max) and (p_round is null or nomination_round=p_round) and (p_unsold_only is null or unsold_round=p_unsold_only)));
$$;
revoke all on function public.get_public_auction_history(text,text,text,text,integer,integer,integer,boolean,integer,integer) from public;
grant execute on function public.get_public_auction_history(text,text,text,text,integer,integer,integer,boolean,integer,integer) to anon,authenticated;

create function public.get_organizer_feasibility_analytics(p_tournament_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
select case when public.is_tournament_role(p_tournament_id,'organizer') then jsonb_build_object('blocked_count',count(*),'by_reason',coalesce((select jsonb_object_agg(reason_code,cnt) from (select reason_code,count(*) cnt from public.feasibility_event_snapshots where tournament_id=p_tournament_id and reason_code is not null group by reason_code) reasons),'{}'),'by_team',coalesce((select jsonb_object_agg(team_id,cnt) from (select team_id,count(*) cnt from public.feasibility_event_snapshots where tournament_id=p_tournament_id and team_id is not null group by team_id) teams),'{}'),'teams_near_lower_bound',(select count(*) from public.teams t join public.tournament_rules r on r.tournament_id=t.tournament_id where t.tournament_id=p_tournament_id and t.current_team_mmr<r.mmr_min),'teams_near_upper_bound',(select count(*) from public.teams t join public.tournament_rules r on r.tournament_id=t.tournament_id where t.tournament_id=p_tournament_id and t.current_team_mmr>r.mmr_max-500),'events',coalesce(jsonb_agg(to_jsonb(e) order by created_at),'[]')) else null end from public.feasibility_event_snapshots e where tournament_id=p_tournament_id;
$$;
revoke all on function public.get_organizer_feasibility_analytics(uuid) from public,anon;
grant execute on function public.get_organizer_feasibility_analytics(uuid) to authenticated;

create or replace function public.export_draft_csv(p_tournament_id uuid) returns text language sql stable security definer set search_path='' as $$
select case when public.is_tournament_role(p_tournament_id,'organizer') then 'team,team_tag,captain,player,role,tournament_mmr,purchase_price,acquisition_round,draft_phase,credits_remaining,team_mmr'||E'\n'||coalesce(string_agg(format('%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s',replace(t.team_name,',',' '),replace(t.team_tag,',',' '),replace(t.captain_name,',',' '),replace(p.ign,',',' '),coalesce(p.primary_role,''),p.tournament_mmr_at_draft,coalesce(p.purchase_price,0),coalesce(p.nomination_round,1),p.draft_phase,t.credits_remaining,t.final_team_mmr),E'\n' order by t.team_name,p.auction_sequence),'') else null end from public.draft_team_snapshots t join public.draft_player_snapshots p on p.snapshot_id=t.snapshot_id and p.team_id=t.team_id where t.tournament_id=p_tournament_id;
$$;

alter function public.get_public_draft_package(text) rename to get_public_draft_package_phase05;
revoke all on function public.get_public_draft_package_phase05(text) from public,anon,authenticated;
create function public.get_public_draft_package(p_slug text) returns jsonb language sql stable security definer set search_path='' as $$
with context as(select t.id,r.spectator_delay_seconds,clock_timestamp()-make_interval(secs=>r.spectator_delay_seconds) visible_at from public.tournaments t join public.tournament_rules r on r.tournament_id=t.id where t.slug=p_slug and t.status not in ('draft','cancelled')),
base as(select public.get_public_draft_package_phase05(p_slug) payload)
select payload||jsonb_build_object(
 'auction',(select to_jsonb(a) from (select au.id,au.sequence_number,case when au.closed_at is not null and au.closed_at<=c.visible_at then au.status::text when au.status='paused' and c.spectator_delay_seconds=0 then 'paused' else 'open' end status,au.opening_bid,visible_bid.amount current_bid,au.started_at,au.closes_at,case when au.closed_at<=c.visible_at then au.closed_at end closed_at,tp.ign,tp.primary_role,tp.secondary_role,tp.tournament_mmr,visible_team.name leading_team from public.auctions au join context c on c.id=au.tournament_id join public.tournament_players tp on tp.id=au.player_id left join lateral(select b.amount,b.team_id from public.bids b where b.auction_id=au.id and b.accepted and b.received_at<=c.visible_at order by b.received_at desc limit 1)visible_bid on true left join public.teams visible_team on visible_team.id=visible_bid.team_id where au.started_at<=c.visible_at order by au.sequence_number desc limit 1)a),
 'teams',(select coalesce(jsonb_agg(to_jsonb(team) order by team.team_name),'[]') from (select tm.id,tm.public_slug team_slug,tm.name team_name,tm.short_tag,tm.logo_url,tm.accent_color,tm.starting_credits-coalesce(sum(tr.purchase_price) filter(where tr.created_at<=c.visible_at and tr.is_active),0) credits_remaining,tm.captain_mmr+coalesce(sum(tr.tournament_mmr_at_draft) filter(where tr.created_at<=c.visible_at and tr.is_active),0) current_team_mmr,1+count(tr.id) filter(where tr.created_at<=c.visible_at and tr.is_active) player_count,p.public_slug captain_slug,coalesce(p.display_name,ctp.ign) captain_name,tm.captain_mmr from public.teams tm join context c on c.id=tm.tournament_id join public.profiles p on p.id=tm.captain_user_id join public.tournament_players ctp on ctp.tournament_id=tm.tournament_id and ctp.user_id=tm.captain_user_id left join public.team_roster tr on tr.team_id=tm.id group by tm.id,p.public_slug,p.display_name,ctp.ign)team),
 'nomination_order',(select coalesce(jsonb_agg(to_jsonb(n) order by round_number,position),'[]') from (select no.id,no.round_number,no.position,tm.name team_name,case when no.completed_at is not null and no.completed_at<=c.visible_at then 'completed' when c.spectator_delay_seconds=0 then no.status::text else 'upcoming' end status from public.nomination_order no join context c on c.id=no.tournament_id join public.teams tm on tm.id=no.team_id)n),
 'recent_bids',(select coalesce(jsonb_agg(to_jsonb(b) order by received_at desc),'[]') from (select b.id,tm.name team_name,b.amount,b.received_at,a.sequence_number from public.bids b join context c on c.id=b.tournament_id join public.teams tm on tm.id=b.team_id join public.auctions a on a.id=b.auction_id where b.accepted and b.received_at<=c.visible_at order by b.received_at desc limit 12)b),
 'draft_health',(select case when spectator_delay_seconds>0 then jsonb_build_object('valid',true,'code','DELAYED_PUBLIC_STATE','message','Public state is displayed after the configured delay') else jsonb_build_object('valid',coalesce((private.evaluate_draft_feasibility(id)->>'feasible')::boolean,true),'code',case when coalesce((private.evaluate_draft_feasibility(id)->>'feasible')::boolean,true) then 'VALID_DRAFT_STATE' else 'COMPLETION_AT_RISK' end,'message',case when coalesce((private.evaluate_draft_feasibility(id)->>'feasible')::boolean,true) then 'All teams remain mathematically completable' else 'The organizer has paused the draft for review' end) end from context),
 'spend_progression',(select coalesce(jsonb_agg(to_jsonb(p) order by team_slug,auction_sequence),'[]') from public.public_team_spend_progression p join context c on c.id=p.tournament_id)
) from base;
$$;
revoke all on function public.get_public_draft_package(text) from public;
grant execute on function public.get_public_draft_package(text) to anon,authenticated;
