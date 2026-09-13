begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

select has_column('public','matches','rematch_of_match_id','replacement links to original');
select has_column('public','matches','superseded_by_match_id','original links to replacement');
select has_table('public','group_knockout_seed_mappings','group seed mapping is persisted');
select has_view('public','public_group_knockout_seeding','safe public seed mapping exists');

insert into public.competition_settings(tournament_id,format,configured_by)values('10000000-0000-4000-8000-000000000001','single_elimination','00000000-0000-4000-8000-000000000001');
select is(private.build_single_elimination('10000000-0000-4000-8000-000000000001',array(select id from public.teams order by id limit 4),now(),60),3,'four-team rematch fixture built');
insert into public.match_result_submissions(id,match_id,submitting_team_id,submitted_by,team_a_score,team_b_score,winner_team_id,request_id,status)
select '74000000-0000-4000-8000-000000000001',id,team_a_id,'00000000-0000-4000-8000-000000000001',2,0,team_a_id,'74100000-0000-4000-8000-000000000001','disputed' from public.matches where round_number=1 order by match_number limit 1;
insert into public.match_disputes(id,match_id,submission_id,opened_by,opening_team_id,reason,request_id)
select '74200000-0000-4000-8000-000000000001',match_id,id,'00000000-0000-4000-8000-000000000002',(select team_b_id from public.matches where id=match_id),'Conflicting report','74300000-0000-4000-8000-000000000001'from public.match_result_submissions where id='74000000-0000-4000-8000-000000000001';
update public.matches set status='disputed'where id=(select match_id from public.match_disputes where id='74200000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((public.resolve_match_dispute('74200000-0000-4000-8000-000000000001','rematch',null,null,'Replay required','74400000-0000-4000-8000-000000000001')->>'code'),'DISPUTE_RESOLVED','organizer orders rematch');
reset role;
select is((select count(*)from public.matches where rematch_of_match_id=(select match_id from public.match_disputes where id='74200000-0000-4000-8000-000000000001')),1::bigint,'exactly one replacement created');
select is((select status::text from public.matches where id=(select match_id from public.match_disputes where id='74200000-0000-4000-8000-000000000001')),'rematch_ordered','original is marked rematch ordered');
select ok((select superseded_by_match_id is not null from public.matches where id=(select match_id from public.match_disputes where id='74200000-0000-4000-8000-000000000001')),'original links to replacement');
select is((select status::text from public.match_disputes where id='74200000-0000-4000-8000-000000000001'),'resolved','original dispute remains preserved');
select is((select count(*)from public.match_result_submissions where id='74000000-0000-4000-8000-000000000001'),1::bigint,'original submission remains preserved');
select ok((select next_match_id is null from public.matches where id=(select match_id from public.match_disputes where id='74200000-0000-4000-8000-000000000001')),'original progression route is removed');
select ok((select next_match_id is not null from public.matches where rematch_of_match_id is not null),'replacement inherits progression route');
select is((select count(*)from public.audit_events where event_type in('REMATCH_ORDERED','REMATCH_CREATED')),2::bigint,'rematch audit pair recorded');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((public.resolve_match_dispute('74200000-0000-4000-8000-000000000001','rematch',null,null,'Replay required','74400000-0000-4000-8000-000000000002')->>'code'),'DUPLICATE_REQUEST','duplicate resolution is deterministic');
reset role;
select private.complete_match((select id from public.matches where rematch_of_match_id is not null),2,0);
select is((select status::text from public.matches where id=(select match_id from public.match_disputes where id='74200000-0000-4000-8000-000000000001')),'superseded','canonical replacement supersedes original');
select throws_ok(format('select private.complete_match(%L,2,0)',(select match_id from public.match_disputes where id='74200000-0000-4000-8000-000000000001')),'P0001','MATCH_ALREADY_COMPLETED','superseded original cannot be completed independently');
select ok((select team_a_id is not null or team_b_id is not null from public.matches where round_number=2),'replacement winner progresses once');
select is((select count(*)from public.audit_events where event_type='MATCH_SUPERSEDED'),1::bigint,'supersession audited once');
set local role anon;
select lives_ok($$select id,status,rematch_of_match_id,superseded_by_match_id from public.public_matches$$,'public history exposes safe rematch relation');
reset role;

delete from public.match_snapshots;delete from public.matches;delete from public.competition_stages;delete from public.competition_settings;
insert into public.teams(id,tournament_id,name,short_tag,captain_user_id,starting_credits,credits_remaining,captain_mmr,current_team_mmr,max_roster_size)values
('40000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','Test Team 7','T7','00000000-0000-4000-8000-000000000007',1000,1000,2000,2000,5),
('40000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','Test Team 8','T8','00000000-0000-4000-8000-000000000008',1000,1000,2000,2000,5);
insert into public.competition_settings(tournament_id,format,advance_per_group,configured_by)values('10000000-0000-4000-8000-000000000001','groups',2,'00000000-0000-4000-8000-000000000001');
insert into public.competition_stages(id,tournament_id,name,stage_type,sequence_number)values('75000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Groups','group',1);
insert into public.competition_groups(id,tournament_id,stage_id,name,sequence_number)values
('75100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001','A',1),
('75100000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001','B',2);
insert into public.competition_group_teams(group_id,team_id,seed)select case when n<=4 then'75100000-0000-4000-8000-000000000001'::uuid else'75100000-0000-4000-8000-000000000002'::uuid end,('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n<=4 then n else n-4 end from generate_series(1,8)n;
insert into public.matches(tournament_id,stage_id,group_id,round_number,match_number,team_a_id,team_b_id,best_of,status,team_a_score,team_b_score,winner_team_id,loser_team_id,completed_at)
select '10000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001',gt1.group_id,1,row_number()over(order by gt1.group_id,gt1.seed,gt2.seed),gt1.team_id,gt2.team_id,3,'completed',2,0,gt1.team_id,gt2.team_id,now() from public.competition_group_teams gt1 join public.competition_group_teams gt2 on gt2.group_id=gt1.group_id and gt2.seed>gt1.seed;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is(public.advance_groups_to_knockout('10000000-0000-4000-8000-000000000001',now(),60),4,'top two from both groups advance');
select is(public.advance_groups_to_knockout('10000000-0000-4000-8000-000000000001',now(),60),4,'group advancement retry is idempotent');
reset role;
select is((select count(*)from public.group_knockout_seed_mappings),4::bigint,'four source-to-slot mappings persisted');
select ok(exists(select 1 from public.matches where round_number=1 and team_a_id='40000000-0000-4000-8000-000000000001'and team_b_id='40000000-0000-4000-8000-000000000006'),'A1 is paired with B2');
select ok(exists(select 1 from public.matches where round_number=1 and team_a_id='40000000-0000-4000-8000-000000000005'and team_b_id='40000000-0000-4000-8000-000000000002'),'B1 is paired with A2');
select is((select count(*)from public.group_advancement_results),4::bigint,'qualification retry creates no duplicate qualifiers');

select * from finish();rollback;
