create type public.season_status as enum ('upcoming','active','completed','archived');
create type public.rating_confidence_status as enum ('provisional','established');

create table public.seasons(
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  year integer not null check(year between 2000 and 2200), sequence integer not null,
  status public.season_status not null default 'upcoming', starts_at timestamptz not null,
  ends_at timestamptz not null, created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(ends_at>starts_at), unique(year,sequence)
);
create table public.season_rules(
  season_id uuid primary key references public.seasons(id) on delete cascade,
  placement_points_enabled boolean not null default false, season_rating_enabled boolean not null default true,
  minimum_matches_for_leaderboard integer not null default 5 check(minimum_matches_for_leaderboard>=0),
  minimum_tournaments_for_ranking integer not null default 1 check(minimum_tournaments_for_ranking>=0),
  placement_points jsonb not null default '{"1":100,"2":70,"3":50,"4":50}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.tournaments add column season_id uuid references public.seasons(id) on delete set null;
create index tournaments_season_idx on public.tournaments(season_id,status);

create table public.organizations(
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  short_tag text not null, logo_url text, accent_color text, country_code text,
  created_by uuid not null references public.profiles(id), verified boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(country_code is null or country_code~'^[A-Z]{2}$')
);
alter table public.teams add column organization_id uuid references public.organizations(id) on delete set null;
create index teams_organization_idx on public.teams(organization_id,tournament_id);

create table public.competitive_rating_versions(
  version text primary key, algorithm text not null, parameters jsonb not null,
  effective_at timestamptz not null, active boolean not null default false, created_at timestamptz not null default now()
);
create unique index one_active_rating_version on public.competitive_rating_versions(active) where active;
insert into public.competitive_rating_versions(version,algorithm,parameters,effective_at,active)
values('draftgg_rating_v1','elo_with_uncertainty',jsonb_build_object(
  'baseline',1000,'mmr_center',3000,'mmr_divisor',5,'seed_cap',300,
  'initial_uncertainty',350,'minimum_uncertainty',60,'uncertainty_decay',0.92,
  'base_k',24,'minimum_k',12,'maximum_k',32,'established_matches',5,
  'forfeit_policy','excluded','order','completed_at ASC, match_id ASC'
),now(),true);

create table public.player_competitive_ratings(
  player_id uuid not null references public.profiles(id) on delete cascade,
  rating_version text not null references public.competitive_rating_versions(version),
  rating numeric(10,2) not null, uncertainty numeric(10,2) not null,
  matches_count integer not null default 0, wins integer not null default 0, losses integer not null default 0,
  status public.rating_confidence_status not null default 'provisional', updated_at timestamptz not null default now(),
  primary key(player_id,rating_version)
);
create table public.player_season_ratings(
  player_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  rating_version text not null references public.competitive_rating_versions(version),
  rating numeric(10,2) not null, uncertainty numeric(10,2) not null,
  matches_count integer not null default 0, wins integer not null default 0, losses integer not null default 0,
  status public.rating_confidence_status not null default 'provisional', updated_at timestamptz not null default now(),
  primary key(player_id,season_id,rating_version)
);
create table public.competitive_rating_events(
  id uuid primary key default gen_random_uuid(), player_id uuid not null references public.profiles(id),
  tournament_id uuid not null references public.tournaments(id), match_id uuid not null references public.matches(id),
  season_id uuid references public.seasons(id), rating_version text not null references public.competitive_rating_versions(version),
  rating_before numeric(10,2) not null, rating_after numeric(10,2) not null,
  uncertainty_before numeric(10,2) not null, uncertainty_after numeric(10,2) not null,
  delta numeric(10,2) not null, result numeric(3,2) not null check(result in(0,1)),
  processed_at timestamptz not null default now(), unique(player_id,match_id,rating_version)
);
create index rating_events_player_history_idx on public.competitive_rating_events(player_id,processed_at,match_id);
create index rating_events_season_rank_idx on public.competitive_rating_events(season_id,player_id,processed_at);
create index lineup_players_player_idx on public.match_lineup_players(player_id,lineup_id);

create table public.achievements(
  code text primary key, name text not null, description text not null, icon text,
  active boolean not null default true, created_at timestamptz not null default now()
);
create table public.player_achievements(
  id uuid primary key default gen_random_uuid(), player_id uuid not null references public.profiles(id) on delete cascade,
  achievement_code text not null references public.achievements(code), tournament_id uuid references public.tournaments(id),
  match_id uuid references public.matches(id), awarded_at timestamptz not null default now(), metadata jsonb not null default '{}',
  unique(player_id,achievement_code,tournament_id,match_id)
);
create unique index player_achievement_once_global on public.player_achievements(player_id,achievement_code)
where tournament_id is null and match_id is null;
insert into public.achievements(code,name,description) values
('FIRST_DRAFT','First Draft','Completed a first DraftGG draft.'),('FIRST_MATCH','First Match','Played a first canonical match.'),
('FIRST_WIN','First Win','Won a first canonical match.'),('TOURNAMENT_CHAMPION','Tournament Champion','Won a completed tournament.'),
('CAPTAIN_CHAMPION','Captain Champion','Captained a tournament-winning team.'),('FIVE_TOURNAMENTS','Five Tournaments','Completed five tournaments.'),
('TEN_MATCH_WINS','Ten Match Wins','Won ten canonical matches.');

create function private.rating_seed(p_mmr integer) returns numeric language sql immutable set search_path='' as $$
 select round((1000+greatest(-300,least(300,(coalesce(p_mmr,3000)-3000)/5.0)))::numeric,2)
$$;
create function private.process_match_rating(p_match_id uuid,p_replay_time timestamptz default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare m public.matches%rowtype; v_version text; v_params jsonb; v_a numeric;v_b numeric;v_expected_a numeric;
 v_player record;v_before numeric;v_unc numeric;v_result numeric;v_k numeric;v_delta numeric;v_after numeric;v_new_unc numeric;v_count int;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_match_id::text,7107));
 select * into m from public.matches where id=p_match_id for update;
 if m.id is null or m.status<>'completed' or m.completed_at is null or m.forfeit_team_id is not null
   or m.superseded_by_match_id is not null or exists(select 1 from public.match_disputes d where d.match_id=m.id and d.status='open') then return false; end if;
 select version,parameters into v_version,v_params from public.competitive_rating_versions where active order by effective_at desc limit 1;
 if exists(select 1 from public.competitive_rating_events where match_id=m.id and rating_version=v_version) then return false; end if;
 if (select count(*) from public.match_lineups where match_id=m.id and locked_at is not null)<>2 then return false; end if;
 insert into public.player_competitive_ratings(player_id,rating_version,rating,uncertainty)
 select distinct tp.user_id,v_version,private.rating_seed(tp.tournament_mmr),(v_params->>'initial_uncertainty')::numeric
 from public.match_lineups l join public.match_lineup_players lp on lp.lineup_id=l.id join public.tournament_players tp on tp.id=lp.player_id
 where l.match_id=m.id on conflict do nothing;
 select avg(r.rating) filter(where l.team_id=m.team_a_id),avg(r.rating) filter(where l.team_id=m.team_b_id) into v_a,v_b
 from public.match_lineups l join public.match_lineup_players lp on lp.lineup_id=l.id join public.tournament_players tp on tp.id=lp.player_id
 join public.player_competitive_ratings r on r.player_id=tp.user_id and r.rating_version=v_version where l.match_id=m.id;
 if v_a is null or v_b is null then return false; end if;
 v_expected_a:=1/(1+power(10,(v_b-v_a)/400));
 for v_player in select distinct tp.user_id player_id,l.team_id,tp.tournament_mmr from public.match_lineups l
   join public.match_lineup_players lp on lp.lineup_id=l.id join public.tournament_players tp on tp.id=lp.player_id where l.match_id=m.id loop
   select rating,uncertainty,matches_count into v_before,v_unc,v_count from public.player_competitive_ratings
     where player_id=v_player.player_id and rating_version=v_version for update;
   v_result:=case when v_player.team_id=m.winner_team_id then 1 else 0 end;
   v_k:=greatest((v_params->>'minimum_k')::numeric,least((v_params->>'maximum_k')::numeric,(v_params->>'base_k')::numeric*v_unc/(v_params->>'initial_uncertainty')::numeric));
   v_delta:=round((v_k*(v_result-case when v_player.team_id=m.team_a_id then v_expected_a else 1-v_expected_a end))::numeric,2);
   v_after:=round(v_before+v_delta,2);v_new_unc:=round(greatest((v_params->>'minimum_uncertainty')::numeric,v_unc*(v_params->>'uncertainty_decay')::numeric),2);
   insert into public.competitive_rating_events(player_id,tournament_id,match_id,season_id,rating_version,rating_before,rating_after,uncertainty_before,uncertainty_after,delta,result,processed_at)
   values(v_player.player_id,m.tournament_id,m.id,(select season_id from public.tournaments where id=m.tournament_id),v_version,v_before,v_after,v_unc,v_new_unc,v_delta,v_result,coalesce(p_replay_time,m.completed_at));
   update public.player_competitive_ratings set rating=v_after,uncertainty=v_new_unc,matches_count=matches_count+1,
     wins=wins+(v_result=1)::int,losses=losses+(v_result=0)::int,status=case when matches_count+1>=(v_params->>'established_matches')::int then'established'::public.rating_confidence_status else'provisional'::public.rating_confidence_status end,updated_at=coalesce(p_replay_time,m.completed_at)
     where player_id=v_player.player_id and rating_version=v_version;
   if exists(select 1 from public.tournaments t left join public.season_rules sr on sr.season_id=t.season_id where t.id=m.tournament_id and t.season_id is not null and coalesce(sr.season_rating_enabled,true))then
     insert into public.player_season_ratings(player_id,season_id,rating_version,rating,uncertainty,matches_count,wins,losses,status,updated_at)
     select v_player.player_id,t.season_id,v_version,v_after,v_new_unc,1,(v_result=1)::int,(v_result=0)::int,'provisional',coalesce(p_replay_time,m.completed_at)from public.tournaments t where t.id=m.tournament_id
     on conflict(player_id,season_id,rating_version)do update set rating=excluded.rating,uncertainty=excluded.uncertainty,
       matches_count=public.player_season_ratings.matches_count+1,wins=public.player_season_ratings.wins+excluded.wins,losses=public.player_season_ratings.losses+excluded.losses,
       status=case when public.player_season_ratings.matches_count+1>=coalesce((select minimum_matches_for_leaderboard from public.season_rules where season_id=excluded.season_id),5)then'established'::public.rating_confidence_status else'provisional'::public.rating_confidence_status end,updated_at=excluded.updated_at;
   end if;
 end loop;
 return true;
end$$;
create function public.process_match_rating(p_match_id uuid) returns boolean language sql security definer set search_path='' as $$select private.process_match_rating(p_match_id)$$;
create function public.rebuild_competitive_ratings() returns integer language plpgsql security definer set search_path='' as $$
declare r record;v_count int:=0;begin
 perform pg_advisory_xact_lock(7107);
 truncate public.competitive_rating_events,public.player_competitive_ratings,public.player_season_ratings;
 for r in select id,completed_at from public.matches where status='completed' and completed_at is not null and forfeit_team_id is null and superseded_by_match_id is null order by completed_at,id loop
   if private.process_match_rating(r.id,r.completed_at) then v_count:=v_count+1;end if;
 end loop;
 insert into public.audit_events(actor_user_id,event_type,entity_type,payload)values((select auth.uid()),'RATING_REBUILT','rating_system',jsonb_build_object('matches',v_count));return v_count;
end$$;

create function private.award_achievement(p_player uuid,p_code text,p_tournament uuid default null,p_match uuid default null)returns boolean
language plpgsql security definer set search_path='' as $$begin
 insert into public.player_achievements(player_id,achievement_code,tournament_id,match_id)values(p_player,p_code,p_tournament,p_match)on conflict do nothing;
 return found;
end$$;

create view public.public_seasons with(security_invoker=false,security_barrier=true)as select id,name,slug,year,sequence,status,starts_at,ends_at from public.seasons where status<>'archived';
create view public.public_organizations with(security_invoker=false,security_barrier=true)as select id,name,slug,short_tag,logo_url,accent_color,country_code,verified,created_at from public.organizations;
create view public.public_player_leaderboard with(security_invoker=false,security_barrier=true)as
select row_number()over(order by r.rating desc,r.matches_count desc,p.public_slug)rank,p.public_slug,coalesce(p.display_name,tp.ign)player_name,
 r.rating::integer competitive_rating,r.status confidence,r.matches_count,r.wins,r.losses,round(100*r.wins::numeric/nullif(r.matches_count,0),1)win_rate,
 tp.primary_role,case when p.show_region_publicly then tp.region end region
from public.player_competitive_ratings r join public.profiles p on p.id=r.player_id
left join lateral(select primary_role,region,ign from public.tournament_players where user_id=p.id order by created_at desc limit 1)tp on true
where r.rating_version=(select version from public.competitive_rating_versions where active limit 1);
create view public.public_season_player_leaderboard with(security_invoker=false,security_barrier=true)as
select row_number()over(partition by r.season_id order by r.rating desc,r.matches_count desc,p.public_slug)rank,r.season_id,s.slug season_slug,
 p.public_slug,coalesce(p.display_name,tp.ign)player_name,r.rating::integer competitive_rating,r.status confidence,r.matches_count,r.wins,r.losses,
 round(100*r.wins::numeric/nullif(r.matches_count,0),1)win_rate,tp.primary_role
from public.player_season_ratings r join public.seasons s on s.id=r.season_id join public.profiles p on p.id=r.player_id
left join lateral(select primary_role,ign from public.tournament_players where user_id=p.id order by created_at desc limit 1)tp on true;
create view public.public_player_match_history with(security_invoker=false,security_barrier=true)as
select p.public_slug,m.completed_at,t.name tournament,t.slug tournament_slug,s.name stage,tm.name team,opp.name opponent,
 m.team_a_score,m.team_b_score,case when m.winner_team_id=l.team_id then'W'else'L'end result,false forfeit
from public.match_lineups l join public.match_lineup_players lp on lp.lineup_id=l.id join public.tournament_players tp on tp.id=lp.player_id
join public.profiles p on p.id=tp.user_id join public.matches m on m.id=l.match_id join public.tournaments t on t.id=m.tournament_id
join public.competition_stages s on s.id=m.stage_id join public.teams tm on tm.id=l.team_id join public.teams opp on opp.id=case when m.team_a_id=l.team_id then m.team_b_id else m.team_a_id end
where m.status='completed'and m.forfeit_team_id is null and m.superseded_by_match_id is null;
create view public.public_player_career_stats with(security_invoker=false,security_barrier=true)as
select p.public_slug,coalesce(p.display_name,tp.ign)player_name,r.rating::integer competitive_rating,r.uncertainty::integer uncertainty,r.status confidence,
 coalesce(r.matches_count,0)matches_played,coalesce(r.wins,0)series_wins,coalesce(r.losses,0)series_losses,
 round(100*coalesce(r.wins,0)::numeric/nullif(r.matches_count,0),1)win_rate,
 (select count(distinct tournament_id)from public.draft_player_snapshots d where d.player_slug=p.public_slug)tournaments_entered,
 (select count(*)from public.draft_player_snapshots d where d.player_slug=p.public_slug)times_drafted,
 (select round(avg(purchase_price),2)from public.draft_player_snapshots d where d.player_slug=p.public_slug and purchase_price is not null)average_auction_price,
 (select max(purchase_price)from public.draft_player_snapshots d where d.player_slug=p.public_slug)highest_auction_price
from public.profiles p left join public.player_competitive_ratings r on r.player_id=p.id and r.rating_version=(select version from public.competitive_rating_versions where active limit 1)
left join lateral(select ign from public.tournament_players where user_id=p.id order by created_at desc limit 1)tp on true;
create view public.public_rating_history with(security_invoker=false,security_barrier=true)as
select p.public_slug,e.processed_at,t.name tournament,t.slug tournament_slug,e.rating_after::integer rating,e.delta::integer delta,e.result
from public.competitive_rating_events e join public.profiles p on p.id=e.player_id join public.tournaments t on t.id=e.tournament_id;
create view public.public_organization_history with(security_invoker=false,security_barrier=true)as
select o.slug organization_slug,o.name,o.short_tag,o.logo_url,o.accent_color,o.country_code,o.verified,t.name tournament,t.slug tournament_slug,s.name season,
 tm.name team,crs.champion_team_id=tm.id champion,crs.runner_up_team_id=tm.id runner_up
from public.organizations o left join public.teams tm on tm.organization_id=o.id left join public.tournaments t on t.id=tm.tournament_id
left join public.seasons s on s.id=t.season_id left join public.competition_result_snapshots crs on crs.tournament_id=t.id;
create view public.public_player_achievements with(security_invoker=false,security_barrier=true)as
select p.public_slug,a.code,a.name,a.description,a.icon,pa.awarded_at,t.name tournament,t.slug tournament_slug
from public.player_achievements pa join public.profiles p on p.id=pa.player_id join public.achievements a on a.code=pa.achievement_code left join public.tournaments t on t.id=pa.tournament_id;
create view public.public_career_timeline with(security_invoker=false,security_barrier=true)as
select public_slug,processed_at event_at,'RATING_UPDATED'event_type,tournament,rating::text detail from public.public_rating_history
union all select public_slug,awarded_at,'ACHIEVEMENT',coalesce(tournament,name),name from public.public_player_achievements;
create view public.public_tournament_placements with(security_invoker=false,security_barrier=true)as
select p.public_slug,t.slug tournament_slug,t.name tournament,s.slug season_slug,tm.name team,
 case when cr.champion_team_id=tm.id then 1 when cr.runner_up_team_id=tm.id then 2 end placement,
 case when cr.champion_team_id=tm.id then'Champion'when cr.runner_up_team_id=tm.id then'Runner-up'end placement_label
from public.competition_result_snapshots cr join public.tournaments t on t.id=cr.tournament_id left join public.seasons s on s.id=t.season_id
join public.teams tm on tm.tournament_id=t.id and tm.id in(cr.champion_team_id,cr.runner_up_team_id)
join public.tournament_players tp on tp.tournament_id=t.id join public.profiles p on p.id=tp.user_id
left join public.team_roster tr on tr.player_id=tp.id and tr.team_id=tm.id and tr.is_active
where tp.user_id=tm.captain_user_id or tr.id is not null;
create view public.public_captain_career_stats with(security_invoker=false,security_barrier=true)as
select h.captain_slug,max(h.captain_name)captain_name,count(*)tournaments_captained,sum(h.players_acquired)players_acquired,
 sum(h.credits_spent)total_credits_spent,round(avg(h.credits_remaining),2)average_credits_remaining,
 round(avg(h.distance_from_target),2)average_team_mmr_vs_target,sum(h.contested_wins)contested_wins,
 sum(h.uncontested_wins)uncontested_wins,sum(h.unsold_round_acquisitions)unsold_round_acquisitions,
 count(*)filter(where exists(select 1 from public.public_tournament_placements p where p.tournament_slug=h.tournament_slug and p.team=h.team_name and p.placement=1))championships,
 count(*)filter(where exists(select 1 from public.public_tournament_placements p where p.tournament_slug=h.tournament_slug and p.team=h.team_name and p.placement=2))runner_up_finishes
from public.public_captain_draft_history h group by h.captain_slug;
create view public.public_organization_standings with(security_invoker=false,security_barrier=true)as
select o.slug organization_slug,o.name,o.short_tag,t.season_id,count(distinct t.id)tournaments,
 count(distinct t.id)filter(where cr.champion_team_id=tm.id)championships,count(distinct t.id)filter(where cr.runner_up_team_id=tm.id)final_appearances,
 count(m.id)filter(where m.status='completed'and m.winner_team_id=tm.id)match_wins
from public.organizations o left join public.teams tm on tm.organization_id=o.id left join public.tournaments t on t.id=tm.tournament_id
left join public.competition_result_snapshots cr on cr.tournament_id=t.id left join public.matches m on m.tournament_id=t.id and tm.id in(m.team_a_id,m.team_b_id)
group by o.id,t.season_id;

create function private.rebuild_achievements()returns integer language plpgsql security definer set search_path=''as $$declare v_count int;begin
 perform pg_advisory_xact_lock(7108);
 truncate public.player_achievements;
 insert into public.player_achievements(player_id,achievement_code,match_id,awarded_at)
 select distinct on(tp.user_id)tp.user_id,'FIRST_MATCH',m.id,m.completed_at from public.matches m join public.match_lineups l on l.match_id=m.id
 join public.match_lineup_players lp on lp.lineup_id=l.id join public.tournament_players tp on tp.id=lp.player_id
 where m.status='completed'and m.forfeit_team_id is null and m.superseded_by_match_id is null order by tp.user_id,m.completed_at,m.id;
 insert into public.player_achievements(player_id,achievement_code,match_id,awarded_at)
 select distinct on(tp.user_id)tp.user_id,'FIRST_WIN',m.id,m.completed_at from public.matches m join public.match_lineups l on l.match_id=m.id and l.team_id=m.winner_team_id
 join public.match_lineup_players lp on lp.lineup_id=l.id join public.tournament_players tp on tp.id=lp.player_id
 where m.status='completed'and m.forfeit_team_id is null and m.superseded_by_match_id is null order by tp.user_id,m.completed_at,m.id;
 insert into public.player_achievements(player_id,achievement_code,tournament_id,awarded_at)
 select distinct tp.user_id,'TOURNAMENT_CHAMPION',cr.tournament_id,cr.created_at from public.competition_result_snapshots cr join public.teams tm on tm.id=cr.champion_team_id
 join public.tournament_players tp on tp.tournament_id=tm.tournament_id left join public.team_roster tr on tr.player_id=tp.id and tr.team_id=tm.id and tr.is_active
 where tp.user_id=tm.captain_user_id or tr.id is not null on conflict do nothing;
 insert into public.player_achievements(player_id,achievement_code,tournament_id,awarded_at)
 select tm.captain_user_id,'CAPTAIN_CHAMPION',cr.tournament_id,cr.created_at from public.competition_result_snapshots cr join public.teams tm on tm.id=cr.champion_team_id on conflict do nothing;
 select count(*)into v_count from public.player_achievements;return v_count;end$$;
create function public.rebuild_achievements()returns integer language sql security definer set search_path=''as $$select private.rebuild_achievements()$$;
create function public.process_achievement(p_player uuid,p_code text,p_tournament uuid default null,p_match uuid default null)returns boolean language sql security definer set search_path=''as $$select private.award_achievement(p_player,p_code,p_tournament,p_match)$$;

create function public.search_public_ecosystem(p_query text,p_limit integer default 20)returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object(
 'players',coalesce((select jsonb_agg(x)from(select public_slug slug,player_name name,'player'kind from public.public_player_career_stats where player_name ilike'%'||p_query||'%' order by player_name limit least(p_limit,50))x),'[]'),
 'organizations',coalesce((select jsonb_agg(x)from(select slug,name,'organization'kind from public.organizations where name ilike'%'||p_query||'%' order by name limit least(p_limit,50))x),'[]'),
 'tournaments',coalesce((select jsonb_agg(x)from(select slug,name,'tournament'kind from public.tournaments where status not in('draft','cancelled')and name ilike'%'||p_query||'%' order by starts_at desc nulls last limit least(p_limit,50))x),'[]'),
 'seasons',coalesce((select jsonb_agg(x)from(select slug,name,'season'kind from public.seasons where status<>'archived'and name ilike'%'||p_query||'%' order by starts_at desc limit least(p_limit,50))x),'[]'))
$$;

alter table public.seasons enable row level security;alter table public.season_rules enable row level security;alter table public.organizations enable row level security;
alter table public.competitive_rating_versions enable row level security;alter table public.player_competitive_ratings enable row level security;
alter table public.player_season_ratings enable row level security;alter table public.competitive_rating_events enable row level security;
alter table public.achievements enable row level security;alter table public.player_achievements enable row level security;
create policy public_seasons_read on public.seasons for select to anon,authenticated using(status<>'archived');
create policy public_season_rules_read on public.season_rules for select to anon,authenticated using(true);
create policy public_organizations_read on public.organizations for select to anon,authenticated using(true);
create policy public_rating_versions_read on public.competitive_rating_versions for select to anon,authenticated using(true);
create policy public_ratings_read on public.player_competitive_ratings for select to anon,authenticated using(true);
create policy public_season_ratings_read on public.player_season_ratings for select to anon,authenticated using(true);
create policy public_rating_events_read on public.competitive_rating_events for select to anon,authenticated using(true);
create policy public_achievements_read on public.achievements for select to anon,authenticated using(active);
create policy public_player_achievements_read on public.player_achievements for select to anon,authenticated using(true);
grant select on public.season_rules,public.competitive_rating_versions,public.achievements to anon,authenticated;
grant select on public.public_seasons,public.public_organizations,public.public_player_leaderboard,public.public_season_player_leaderboard,public.public_player_match_history,public.public_player_career_stats,public.public_rating_history,public.public_organization_history,public.public_player_achievements,public.public_career_timeline,public.public_tournament_placements,public.public_captain_career_stats,public.public_organization_standings to anon,authenticated;
revoke insert,update,delete on public.player_competitive_ratings,public.player_season_ratings,public.competitive_rating_events,public.player_achievements from anon,authenticated;
revoke all on function private.rating_seed(integer),private.process_match_rating(uuid,timestamptz),private.award_achievement(uuid,text,uuid,uuid)from public,anon,authenticated;
revoke all on function private.rebuild_achievements()from public,anon,authenticated;
revoke all on function public.process_match_rating(uuid),public.rebuild_competitive_ratings(),public.rebuild_achievements(),public.process_achievement(uuid,text,uuid,uuid),public.search_public_ecosystem(text,integer)from public;
grant execute on function public.process_match_rating(uuid),public.rebuild_competitive_ratings(),public.rebuild_achievements(),public.process_achievement(uuid,text,uuid,uuid)to service_role;
grant execute on function public.search_public_ecosystem(text,integer)to anon,authenticated;
