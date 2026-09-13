begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
insert into public.competition_settings(tournament_id,format,advance_per_group,configured_by,tiebreak_rules)values('10000000-0000-4000-8000-000000000001','groups',1,'00000000-0000-4000-8000-000000000001','["points","head_to_head","game_difference","games_won"]');
insert into public.competition_stages(id,tournament_id,name,stage_type,sequence_number)values('76000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Tie fixture','group',1);
insert into public.competition_groups(id,tournament_id,stage_id,name,sequence_number)values('76100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','A',1);
insert into public.competition_group_teams(group_id,team_id,seed)select'76100000-0000-4000-8000-000000000001',('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,n from generate_series(1,4)n;

insert into public.matches(tournament_id,stage_id,group_id,round_number,match_number,team_a_id,team_b_id,best_of,status,team_a_score,team_b_score,winner_team_id,loser_team_id,completed_at)values
('10000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','76100000-0000-4000-8000-000000000001',1,1,'40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',3,'completed',2,0,'40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',now()),
('10000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','76100000-0000-4000-8000-000000000001',1,2,'40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003',3,'completed',2,1,'40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003',now()),
('10000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','76100000-0000-4000-8000-000000000001',1,3,'40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004',3,'completed',0,2,'40000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000001',now()),
('10000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','76100000-0000-4000-8000-000000000001',1,4,'40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003',3,'completed',2,0,'40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003',now()),
('10000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','76100000-0000-4000-8000-000000000001',1,5,'40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000004',3,'completed',2,1,'40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000004',now());
select is((select points from public.public_competition_rankings where team_id='40000000-0000-4000-8000-000000000001'),6::bigint,'case A primary points tie');
select is((select points from public.public_competition_rankings where team_id='40000000-0000-4000-8000-000000000002'),6::bigint,'case A opponent primary points tie');
select ok((select position from public.public_competition_rankings where team_id='40000000-0000-4000-8000-000000000001')<(select position from public.public_competition_rankings where team_id='40000000-0000-4000-8000-000000000002'),'case A head-to-head winner ranks first');

delete from public.matches;
insert into public.matches(tournament_id,stage_id,group_id,round_number,match_number,team_a_id,team_b_id,best_of,status,team_a_score,team_b_score,winner_team_id,loser_team_id,completed_at)values
('10000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','76100000-0000-4000-8000-000000000001',1,1,'40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003',3,'completed',2,0,'40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003',now()),
('10000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','76100000-0000-4000-8000-000000000001',1,2,'40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000004',3,'completed',2,1,'40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000004',now());
select is((select points from public.public_competition_rankings where team_id='40000000-0000-4000-8000-000000000001'),(select points from public.public_competition_rankings where team_id='40000000-0000-4000-8000-000000000002'),'case B primary points tie');
select is((select head_to_head_points from public.public_competition_rankings where team_id='40000000-0000-4000-8000-000000000001'),0::bigint,'case B has no head-to-head result');
select ok((select position from public.public_competition_rankings where team_id='40000000-0000-4000-8000-000000000001')<(select position from public.public_competition_rankings where team_id='40000000-0000-4000-8000-000000000002'),'case B game differential resolves tie');

update public.matches set team_b_score=0 where team_a_id='40000000-0000-4000-8000-000000000002';
select ok((select tiebreak_required from public.public_competition_rankings where team_id='40000000-0000-4000-8000-000000000001'),'case C first team is explicitly unresolved');
select ok((select tiebreak_required from public.public_competition_rankings where team_id='40000000-0000-4000-8000-000000000002'),'case C second team is explicitly unresolved');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);set local role authenticated;
select throws_ok($$select public.advance_groups_to_knockout('10000000-0000-4000-8000-000000000001',now(),60)$$,'P0001','TIEBREAK_REQUIRED','case C unresolved qualification cannot advance');
select * from finish();rollback;
