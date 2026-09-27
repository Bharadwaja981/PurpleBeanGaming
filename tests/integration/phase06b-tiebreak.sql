begin;create extension if not exists pgtap with schema extensions;select plan(8);
insert into public.competition_settings(tournament_id,format,configured_by,tiebreak_rules)values('10000000-0000-4000-8000-000000000001','groups','00000000-0000-4000-8000-000000000001','["points","head_to_head","game_difference","games_won"]');
insert into public.competition_stages(id,tournament_id,name,stage_type,sequence_number)values('70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Groups','group',1);
insert into public.competition_groups(id,tournament_id,stage_id,name,sequence_number)values('71000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','A',1);
insert into public.competition_group_teams(group_id,team_id,seed)select'71000000-0000-4000-8000-000000000001',('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,n from generate_series(1,3)n;
insert into public.matches(tournament_id,stage_id,group_id,round_number,match_number,team_a_id,team_b_id,best_of,status,team_a_score,team_b_score,winner_team_id,loser_team_id,completed_at)values
('10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001',1,1,'40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',3,'completed',2,0,'40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',now()),
('10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001',1,2,'40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003',3,'completed',2,1,'40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003',now()),
('10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001',1,3,'40000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001',3,'completed',2,1,'40000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001',now());
select is((select points from public.public_competition_rankings where group_id='71000000-0000-4000-8000-000000000001'and team_id='40000000-0000-4000-8000-000000000001'),3::bigint,'three-way cohort points tie');
select is((select head_to_head_points from public.public_competition_rankings where group_id='71000000-0000-4000-8000-000000000001'and team_id='40000000-0000-4000-8000-000000000001'),3::bigint,'mini-table uses tied-team matches');
select is((select position from public.public_competition_rankings where group_id='71000000-0000-4000-8000-000000000001'and team_id='40000000-0000-4000-8000-000000000001'),1::bigint,'game differential deterministically separates first');
select is((select position from public.public_competition_rankings where group_id='71000000-0000-4000-8000-000000000001'and team_id='40000000-0000-4000-8000-000000000003'),2::bigint,'partial mini-table separation is deterministic');
select is((select position from public.public_competition_rankings where group_id='71000000-0000-4000-8000-000000000001'and team_id='40000000-0000-4000-8000-000000000002'),3::bigint,'remaining team ranks from configured metrics');
update public.matches set team_a_score=2,team_b_score=1 where group_id='71000000-0000-4000-8000-000000000001';
select ok((select bool_and(tiebreak_required)from public.public_competition_rankings where group_id='71000000-0000-4000-8000-000000000001'),'complete configured deadlock is surfaced');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);set local role authenticated;
select throws_ok($$select public.advance_groups_to_knockout('10000000-0000-4000-8000-000000000001',now(),60)$$,'P0001','TIEBREAK_REQUIRED','unresolved qualification tie blocks advancement');
reset role;
select is((select count(*)from public.group_advancement_results),0::bigint,'blocked tie advances no team');
select * from finish();rollback;
