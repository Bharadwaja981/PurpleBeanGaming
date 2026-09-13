begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

select has_table('public','seasons','seasons exist');
select has_table('public','organizations','organizations exist');
select has_table('public','competitive_rating_events','rating ledger exists');
select has_table('public','player_competitive_ratings','derived career rating exists');
select has_table('public','player_season_ratings','season rating exists');
select has_table('public','achievements','achievement catalogue exists');
select has_table('public','player_achievements','achievement awards exist');
select col_is_null('public','tournaments','season_id','standalone tournaments remain supported');
select has_column('public','teams','organization_id','temporary teams may optionally link to organizations');
select is((select algorithm from public.competitive_rating_versions where active),'elo_with_uncertainty','one explicit rating algorithm');

insert into public.seasons(id,name,slug,year,sequence,status,starts_at,ends_at,created_by)
values('81000000-0000-4000-8000-000000000001','Season One','season-one',2026,1,'active',now()-interval'1 day',now()+interval'30 days','00000000-0000-4000-8000-000000000001');
insert into public.season_rules(season_id,minimum_matches_for_leaderboard)values('81000000-0000-4000-8000-000000000001',2);
update public.tournaments set season_id='81000000-0000-4000-8000-000000000001'where id='10000000-0000-4000-8000-000000000001';
insert into public.competition_settings(tournament_id,format,configured_by)values('10000000-0000-4000-8000-000000000001','round_robin','00000000-0000-4000-8000-000000000001');
insert into public.competition_stages(id,tournament_id,name,stage_type,sequence_number)values('82000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','League','league',1);
insert into public.matches(id,tournament_id,stage_id,round_number,match_number,team_a_id,team_b_id,best_of,status,team_a_score,team_b_score,winner_team_id,loser_team_id,completed_at)
values('83000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001',1,1,'40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',3,'completed',2,0,'40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',now());
insert into public.match_lineups(id,match_id,team_id,confirmed_by,locked_at)values
('84000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',now()),
('84000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',now());
insert into public.match_lineup_players(lineup_id,player_id,player_ign)
select case when n<=5 then'84000000-0000-4000-8000-000000000001'::uuid else'84000000-0000-4000-8000-000000000002'::uuid end,tp.id,tp.ign
from(select tp.*,row_number()over(order by id)n from public.tournament_players tp where tournament_id='10000000-0000-4000-8000-000000000001')tp where n<=10;

create temporary table mmr_before as select id,tournament_mmr from public.tournament_players;

select ok(private.process_match_rating('83000000-0000-4000-8000-000000000001'),'eligible completed match processes');
select is((select count(*)from public.competitive_rating_events where match_id='83000000-0000-4000-8000-000000000001'),10::bigint,'only ten confirmed lineup players receive events');
select is((select count(*)from public.player_competitive_ratings),10::bigint,'non-lineup players receive no update');
select is((select count(*)from public.competitive_rating_events where result=1),5::bigint,'winner lineup receives wins');
select is((select count(*)from public.competitive_rating_events where result=0),5::bigint,'loser lineup receives losses');
select ok((select bool_and(uncertainty_after<uncertainty_before)from public.competitive_rating_events),'uncertainty declines predictably');
select ok((select bool_and(rating_after=rating_before+delta)from public.competitive_rating_events),'ledger arithmetic is exact');
select isnt((select min(rating_before)from public.competitive_rating_events),(select max(rating_before)from public.competitive_rating_events),'Tournament MMR seeds rating with low confidence');
select is((select count(*)from public.tournament_players t join mmr_before b using(id)where t.tournament_mmr<>b.tournament_mmr),0::bigint,'Tournament MMR remains unchanged');
select ok(not private.process_match_rating('83000000-0000-4000-8000-000000000001'),'duplicate processing is idempotent');
select is((select count(*)from public.competitive_rating_events),10::bigint,'duplicate processing creates no events');
select is((select count(*)from public.public_player_match_history),10::bigint,'public match history is lineup-based');
select is((select count(*)from public.public_rating_history),10::bigint,'rating history is public-safe and complete');
select is((select count(*)from public.public_season_player_leaderboard),10::bigint,'season leaderboard is isolated');
select is((select count(*)from public.public_player_leaderboard where confidence='provisional'),10::bigint,'new players are visibly provisional');

insert into public.matches(id,tournament_id,stage_id,round_number,match_number,team_a_id,team_b_id,best_of,status,completed_at)
values('83000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001',2,2,'40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',3,'cancelled',now());
select ok(not private.process_match_rating('83000000-0000-4000-8000-000000000002'),'cancelled match is excluded');
update public.matches set status='disputed'where id='83000000-0000-4000-8000-000000000002';
select ok(not private.process_match_rating('83000000-0000-4000-8000-000000000002'),'disputed match is excluded');
update public.matches set status='forfeit',forfeit_team_id='40000000-0000-4000-8000-000000000002'where id='83000000-0000-4000-8000-000000000002';
select ok(not private.process_match_rating('83000000-0000-4000-8000-000000000002'),'forfeit is excluded');

create temporary table rating_before_rebuild as select player_id,rating,uncertainty,matches_count from public.player_competitive_ratings;
select is(public.rebuild_competitive_ratings(),1,'rebuild replays one canonical match');
select is((select count(*)from public.player_competitive_ratings r full join rating_before_rebuild b using(player_id)where(r.rating,r.uncertainty,r.matches_count)is distinct from(b.rating,b.uncertainty,b.matches_count)),0::bigint,'rebuild reproduces exact ratings');
select is((select count(*)from public.competitive_rating_events),10::bigint,'rebuild leaves no duplicate events');
select ok(position('purchase_price'in pg_get_functiondef('private.process_match_rating(uuid,timestamp with time zone)'::regprocedure))=0,'auction price is irrelevant to rating');
create temporary table corrected_before as select rating from public.player_competitive_ratings where player_id='00000000-0000-4000-8000-000000000001';
update public.matches set team_a_score=0,team_b_score=2,winner_team_id=team_b_id,loser_team_id=team_a_id where id='83000000-0000-4000-8000-000000000001';
select is(public.rebuild_competitive_ratings(),1,'corrected canonical history rebuilds once');
select ok((select rating from public.player_competitive_ratings where player_id='00000000-0000-4000-8000-000000000001')<(select rating from corrected_before),'result correction replaces rather than stacks rating evidence');

select ok(private.award_achievement('00000000-0000-4000-8000-000000000001','FIRST_MATCH',null,null),'achievement first award succeeds');
select ok(not private.award_achievement('00000000-0000-4000-8000-000000000001','FIRST_MATCH',null,null),'achievement retry is idempotent');
select is((select count(*)from public.player_achievements where player_id='00000000-0000-4000-8000-000000000001'and achievement_code='FIRST_MATCH'),1::bigint,'achievement stored once');
select is((select jsonb_array_length(search_public_ecosystem('Player',20)->'players'))>0,true,'public search finds safe player identities');
select is((select count(*)from public.public_player_leaderboard where competitive_rating is not null),10::bigint,'global leaderboard ranks deterministic rating state');

set local role anon;
select lives_ok($$select public_slug,player_name,competitive_rating,confidence from public.public_player_leaderboard$$,'anonymous leaderboard read succeeds');
select throws_ok($$insert into public.competitive_rating_events(player_id,tournament_id,match_id,rating_version,rating_before,rating_after,uncertainty_before,uncertainty_after,delta,result)values('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','draftgg_rating_v1',1,2,3,2,1,1)$$,'42501',null,'anonymous cannot mutate rating ledger');
reset role;
select * from finish();rollback;
