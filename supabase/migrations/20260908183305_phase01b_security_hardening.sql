-- Phase 01B: make grants and view behavior explicit. RLS remains authoritative.
alter view public.public_tournament_summary set (security_invoker = true);
alter view public.public_player_pool set (security_invoker = true);
alter view public.public_teams set (security_invoker = true);
alter view public.public_auction_state set (security_invoker = true);

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Anonymous callers can reach only the columns used by the public views. Direct
-- Data API access is therefore no broader than the view projections.
grant select (id,name,slug,season,status,registration_opens_at,registration_closes_at,auction_starts_at,starts_at,ends_at) on public.tournaments to anon;
grant select (id,tournament_id,ign,primary_role,secondary_role,region,tournament_mmr,is_reserve,is_drafted,is_active,is_eligible) on public.tournament_players to anon;
grant select (id,tournament_id,name,short_tag,logo_url,accent_color,current_team_mmr,roster_size,max_roster_size) on public.teams to anon;
grant select (id,tournament_id,player_id,nominating_team_id,sequence_number,status,opening_bid,current_bid,leading_team_id,started_at,closes_at,closed_at,revision,winning_team_id,winning_bid) on public.auctions to anon;
grant select on public.public_tournament_summary,public.public_player_pool,public.public_teams,public.public_auction_state to anon,authenticated;

create policy public_tournaments_read on public.tournaments for select to anon
using (status not in ('draft','cancelled'));
create policy public_player_pool_read on public.tournament_players for select to anon
using (is_active and is_eligible and exists(select 1 from public.tournaments t where t.id=tournament_id and t.status not in ('draft','registration','verification','rating_review','cancelled')));
create policy public_teams_read on public.teams for select to anon
using (exists(select 1 from public.tournaments t where t.id=tournament_id and t.status not in ('draft','cancelled')));
create policy public_auction_read on public.auctions for select to anon
using (exists(select 1 from public.tournaments t where t.id=tournament_id and t.status in ('auction_live','auction_paused','rosters_locked','competition','completed')));

grant select,insert,update,delete on all tables in schema public to authenticated;

-- SECURITY DEFINER helpers are internal implementation details, not RPC APIs.
revoke all on function public.is_tournament_role(uuid,tournament_role) from public,anon;
grant execute on function public.is_tournament_role(uuid,tournament_role) to authenticated;
revoke all on function public.sync_profile() from public,anon,authenticated;
revoke all on function public.touch_updated_at() from public,anon,authenticated;
revoke all on function public.protect_player_admin_fields() from public,anon,authenticated;

alter function public.sync_profile() set search_path = public, pg_temp;
alter function public.touch_updated_at() set search_path = '';
alter function public.protect_player_admin_fields() set search_path = public, pg_temp;

-- Qualify the outer tournament key. The Phase 01 policy's bare `id` resolved to
-- tournament_members.id inside the EXISTS subquery and hid every tournament.
drop policy tournament_member_read on public.tournaments;
create policy tournament_member_read on public.tournaments for select to authenticated
using (exists(
  select 1 from public.tournament_members m
  where m.tournament_id = tournaments.id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
));

-- Realtime distributes committed tournament state; PostgreSQL remains authoritative.
alter publication supabase_realtime add table public.tournaments;
