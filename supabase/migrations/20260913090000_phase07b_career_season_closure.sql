-- Phase 07B: closure-only public career, season, organization, and achievement projections.

create or replace view public.public_player_match_history with(security_invoker=false,security_barrier=true) as
select p.public_slug,m.completed_at,t.name tournament,t.slug tournament_slug,s.name stage,
 case when l.team_id=m.team_a_id then coalesce(ms.team_a_name,ta.name) else coalesce(ms.team_b_name,tb.name) end team,
 case when l.team_id=m.team_a_id then coalesce(ms.team_b_name,tb.name) else coalesce(ms.team_a_name,ta.name) end opponent,
 m.team_a_score,m.team_b_score,case when m.winner_team_id=l.team_id then 'W' else 'L' end result,
 m.status='forfeit' forfeit
from public.match_lineups l
join public.match_lineup_players lp on lp.lineup_id=l.id
join public.tournament_players tp on tp.id=lp.player_id
join public.profiles p on p.id=tp.user_id
join public.matches m on m.id=l.match_id
join public.tournaments t on t.id=m.tournament_id
join public.competition_stages s on s.id=m.stage_id
left join public.match_snapshots ms on ms.match_id=m.id
left join public.teams ta on ta.id=m.team_a_id left join public.teams tb on tb.id=m.team_b_id
where m.status in('completed','forfeit') and m.superseded_by_match_id is null;

create or replace view public.public_rating_history with(security_invoker=false,security_barrier=true) as
select p.public_slug,e.processed_at,t.name tournament,t.slug tournament_slug,e.rating_after::integer rating,
 e.delta::integer delta,e.result,e.match_id,e.rating_before::integer rating_before,e.rating_after::integer rating_after,
 e.uncertainty_after::integer uncertainty,e.season_id
from public.competitive_rating_events e join public.profiles p on p.id=e.player_id join public.tournaments t on t.id=e.tournament_id;

create or replace view public.public_player_career_stats with(security_invoker=false,security_barrier=true) as
with participation as(
 select d.player_slug,d.tournament_id,d.team_id from public.draft_player_snapshots d
 union
 select dt.captain_slug,dt.tournament_id,dt.team_id from public.draft_team_snapshots dt
), aggregate as(
 select x.player_slug,count(distinct x.tournament_id) tournaments_entered,
 count(distinct x.tournament_id) filter(where cr.tournament_id is not null) tournaments_completed,
 count(distinct x.team_id) teams_represented,
 count(distinct x.tournament_id) filter(where cr.champion_team_id=x.team_id) championships,
 count(distinct x.tournament_id) filter(where cr.runner_up_team_id=x.team_id) runner_up_finishes
 from participation x left join public.competition_result_snapshots cr on cr.tournament_id=x.tournament_id group by x.player_slug
)
select p.public_slug,coalesce(p.display_name,tp.ign)player_name,r.rating::integer competitive_rating,r.uncertainty::integer uncertainty,r.status confidence,
 coalesce(r.matches_count,0)matches_played,coalesce(r.wins,0)series_wins,coalesce(r.losses,0)series_losses,
 round(100*coalesce(r.wins,0)::numeric/nullif(r.matches_count,0),1)win_rate,
 coalesce(a.tournaments_entered,0)tournaments_entered,
 (select count(*)from public.draft_player_snapshots d where d.player_slug=p.public_slug)times_drafted,
 (select round(avg(purchase_price),2)from public.draft_player_snapshots d where d.player_slug=p.public_slug and purchase_price is not null)average_auction_price,
 (select max(purchase_price)from public.draft_player_snapshots d where d.player_slug=p.public_slug)highest_auction_price,
 coalesce(a.tournaments_completed,0)tournaments_completed,coalesce(a.teams_represented,0)teams_represented,
 coalesce(a.championships,0)championships,coalesce(a.runner_up_finishes,0)runner_up_finishes,p.avatar_url
from public.profiles p left join public.player_competitive_ratings r on r.player_id=p.id and r.rating_version=(select version from public.competitive_rating_versions where active limit 1)
left join lateral(select ign from public.tournament_players where user_id=p.id order by created_at desc limit 1)tp on true
left join aggregate a on a.player_slug=p.public_slug;

create or replace view public.public_tournament_placements with(security_invoker=false,security_barrier=true) as
select x.public_slug,t.slug tournament_slug,ds.tournament_name tournament,s.slug season_slug,x.team_name team,
 case when cr.champion_team_id=x.team_id then 1 when cr.runner_up_team_id=x.team_id then 2 end placement,
 case when cr.champion_team_id=x.team_id then 'Champion' when cr.runner_up_team_id=x.team_id then 'Runner-up' end placement_label
from public.competition_result_snapshots cr join public.tournaments t on t.id=cr.tournament_id left join public.seasons s on s.id=t.season_id
join public.draft_snapshots ds on ds.tournament_id=t.id
join lateral(
 select dp.player_slug public_slug,dt.team_id,dt.team_name from public.draft_player_snapshots dp join public.draft_team_snapshots dt on dt.snapshot_id=dp.snapshot_id and dt.team_id=dp.team_id where dp.snapshot_id=ds.id
 union all select dt.captain_slug public_slug,dt.team_id,dt.team_name from public.draft_team_snapshots dt where dt.snapshot_id=ds.id
)x on x.team_id in(cr.champion_team_id,cr.runner_up_team_id);

create or replace view public.public_organization_history with(security_invoker=false,security_barrier=true) as
select o.slug organization_slug,o.name,o.short_tag,o.logo_url,o.accent_color,o.country_code,o.verified,
 ds.tournament_name tournament,ds.tournament_slug,s.name season,dt.team_name team,
 cr.champion_team_id=dt.team_id champion,cr.runner_up_team_id=dt.team_id runner_up,
 dt.captain_name captain,dt.captain_slug,dt.credits_remaining,dt.starting_credits-dt.credits_remaining credits_spent,
 coalesce((select jsonb_agg(jsonb_build_object('slug',dp.player_slug,'ign',dp.ign,'mmr',dp.tournament_mmr_at_draft,'price',dp.purchase_price)order by dp.ign)
   from public.draft_player_snapshots dp where dp.snapshot_id=dt.snapshot_id and dp.team_id=dt.team_id),'[]') roster,
 count(m.id)filter(where m.status in('completed','forfeit')) matches_played,
 count(m.id)filter(where m.status in('completed','forfeit')and m.winner_team_id=dt.team_id) match_wins,
 count(m.id)filter(where m.status in('completed','forfeit')and m.loser_team_id=dt.team_id) match_losses
from public.organizations o left join public.teams tm on tm.organization_id=o.id
left join public.draft_team_snapshots dt on dt.tournament_id=tm.tournament_id and dt.team_id=tm.id
left join public.draft_snapshots ds on ds.id=dt.snapshot_id left join public.tournaments t on t.id=dt.tournament_id
left join public.seasons s on s.id=t.season_id left join public.competition_result_snapshots cr on cr.tournament_id=t.id
left join public.matches m on m.tournament_id=t.id and dt.team_id in(m.team_a_id,m.team_b_id) and m.superseded_by_match_id is null
group by o.id,ds.id,dt.id,s.id,cr.id;

create or replace view public.public_captain_career_stats with(security_invoker=false,security_barrier=true) as
select h.captain_slug,max(h.captain_name)captain_name,count(*)tournaments_captained,sum(h.players_acquired)players_acquired,
 sum(h.credits_spent)total_credits_spent,round(avg(h.credits_remaining),2)average_credits_remaining,
 round(avg(h.distance_from_target),2)average_team_mmr_vs_target,sum(h.contested_wins)contested_wins,
 sum(h.uncontested_wins)uncontested_wins,sum(h.unsold_round_acquisitions)unsold_round_acquisitions,
 count(*)filter(where p.placement=1)championships,count(*)filter(where p.placement=2)runner_up_finishes,
 sum((select count(*) from public.matches m join public.draft_team_snapshots dt on dt.tournament_id=m.tournament_id and dt.team_id in(m.team_a_id,m.team_b_id)
      where dt.captain_slug=h.captain_slug and dt.team_name=h.team_name and m.status in('completed','forfeit')and m.superseded_by_match_id is null)) matches_played,
 sum((select count(*) from public.matches m join public.draft_team_snapshots dt on dt.tournament_id=m.tournament_id and dt.team_id=m.winner_team_id
      where dt.captain_slug=h.captain_slug and dt.team_name=h.team_name and m.status in('completed','forfeit')and m.superseded_by_match_id is null)) match_wins,
 sum((select count(*) from public.matches m join public.draft_team_snapshots dt on dt.tournament_id=m.tournament_id and dt.team_id=m.loser_team_id
      where dt.captain_slug=h.captain_slug and dt.team_name=h.team_name and m.status in('completed','forfeit')and m.superseded_by_match_id is null)) match_losses
from public.public_captain_draft_history h
left join public.public_tournament_placements p on p.public_slug=h.captain_slug and p.tournament_slug=h.tournament_slug and p.team=h.team_name
group by h.captain_slug;

create view public.public_season_tournaments with(security_invoker=false,security_barrier=true) as
select s.slug season_slug,t.slug tournament_slug,t.name tournament,t.status,t.starts_at,
 dta.team_name champion,dtb.team_name runner_up,cr.created_at completed_at
from public.seasons s join public.tournaments t on t.season_id=s.id
left join public.competition_result_snapshots cr on cr.tournament_id=t.id
left join public.draft_team_snapshots dta on dta.tournament_id=t.id and dta.team_id=cr.champion_team_id
left join public.draft_team_snapshots dtb on dtb.tournament_id=t.id and dtb.team_id=cr.runner_up_team_id
where t.status not in('draft','cancelled');

create view public.public_season_rating_history with(security_invoker=false,security_barrier=true) as
select s.slug season_slug,p.public_slug,e.processed_at,t.name tournament,t.slug tournament_slug,e.match_id,
 e.rating_before::integer rating_before,e.rating_after::integer rating_after,e.uncertainty_after::integer uncertainty,e.delta::integer delta,e.result
from public.competitive_rating_events e join public.seasons s on s.id=e.season_id join public.profiles p on p.id=e.player_id join public.tournaments t on t.id=e.tournament_id;

create view public.public_player_draft_history with(security_invoker=false,security_barrier=true) as
select dp.player_slug,ds.tournament_name,ds.tournament_slug,ds.completed_at,dt.team_name,dt.team_slug,
 dp.ign,dp.primary_role,dp.tournament_mmr_at_draft,dp.purchase_price,dp.acquisition_type
from public.draft_player_snapshots dp join public.draft_snapshots ds on ds.id=dp.snapshot_id
join public.draft_team_snapshots dt on dt.snapshot_id=dp.snapshot_id and dt.team_id=dp.team_id;

create or replace function private.rebuild_achievements()returns integer language plpgsql security definer set search_path=''as $$declare v_count int;begin
 perform pg_advisory_xact_lock(7108);truncate public.player_achievements;
 insert into public.player_achievements(player_id,achievement_code,tournament_id,awarded_at)
 select distinct on(p.id)p.id,'FIRST_DRAFT',x.tournament_id,x.completed_at from(
  select dp.player_slug,dp.tournament_id,ds.completed_at from public.draft_player_snapshots dp join public.draft_snapshots ds on ds.id=dp.snapshot_id
  union all select dt.captain_slug,dt.tournament_id,ds.completed_at from public.draft_team_snapshots dt join public.draft_snapshots ds on ds.id=dt.snapshot_id
 )x join public.profiles p on p.public_slug=x.player_slug order by p.id,x.completed_at,x.tournament_id;
 insert into public.player_achievements(player_id,achievement_code,match_id,awarded_at)
 select distinct on(tp.user_id)tp.user_id,'FIRST_MATCH',m.id,m.completed_at from public.matches m join public.match_lineups l on l.match_id=m.id join public.match_lineup_players lp on lp.lineup_id=l.id join public.tournament_players tp on tp.id=lp.player_id
 where m.status='completed'and m.forfeit_team_id is null and m.superseded_by_match_id is null order by tp.user_id,m.completed_at,m.id;
 insert into public.player_achievements(player_id,achievement_code,match_id,awarded_at)
 select distinct on(tp.user_id)tp.user_id,'FIRST_WIN',m.id,m.completed_at from public.matches m join public.match_lineups l on l.match_id=m.id and l.team_id=m.winner_team_id join public.match_lineup_players lp on lp.lineup_id=l.id join public.tournament_players tp on tp.id=lp.player_id
 where m.status='completed'and m.forfeit_team_id is null and m.superseded_by_match_id is null order by tp.user_id,m.completed_at,m.id;
 insert into public.player_achievements(player_id,achievement_code,tournament_id,awarded_at)
 select p.id,'TOURNAMENT_CHAMPION',cr.tournament_id,cr.created_at from public.competition_result_snapshots cr join public.draft_team_snapshots dt on dt.tournament_id=cr.tournament_id and dt.team_id=cr.champion_team_id
 join lateral(select dp.player_slug from public.draft_player_snapshots dp where dp.snapshot_id=dt.snapshot_id and dp.team_id=dt.team_id union all select dt.captain_slug)x on true join public.profiles p on p.public_slug=x.player_slug on conflict do nothing;
 insert into public.player_achievements(player_id,achievement_code,tournament_id,awarded_at)
 select p.id,'CAPTAIN_CHAMPION',cr.tournament_id,cr.created_at from public.competition_result_snapshots cr join public.draft_team_snapshots dt on dt.tournament_id=cr.tournament_id and dt.team_id=cr.champion_team_id join public.profiles p on p.public_slug=dt.captain_slug on conflict do nothing;
 insert into public.player_achievements(player_id,achievement_code,awarded_at)
 select p.id,'FIVE_TOURNAMENTS',max(ds.completed_at) from public.profiles p join public.draft_player_snapshots dp on dp.player_slug=p.public_slug join public.draft_snapshots ds on ds.id=dp.snapshot_id group by p.id having count(distinct dp.tournament_id)>=5;
 insert into public.player_achievements(player_id,achievement_code,awarded_at)
 select tp.user_id,'TEN_MATCH_WINS',max(m.completed_at) from public.matches m join public.match_lineups l on l.match_id=m.id and l.team_id=m.winner_team_id join public.match_lineup_players lp on lp.lineup_id=l.id join public.tournament_players tp on tp.id=lp.player_id
 where m.status='completed'and m.forfeit_team_id is null and m.superseded_by_match_id is null group by tp.user_id having count(distinct m.id)>=10;
 select count(*)into v_count from public.player_achievements;return v_count;end$$;

grant select on public.public_season_tournaments,public.public_season_rating_history,public.public_player_draft_history to anon,authenticated;
revoke all on function private.rebuild_achievements()from public,anon,authenticated;

alter publication supabase_realtime add table public.player_competitive_ratings;
alter publication supabase_realtime add table public.player_season_ratings;
alter publication supabase_realtime add table public.competitive_rating_events;
alter publication supabase_realtime add table public.player_achievements;
