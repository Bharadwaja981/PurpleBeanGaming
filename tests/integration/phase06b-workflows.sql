begin;
create extension if not exists pgtap with schema extensions;
select plan(19);
insert into public.team_roster(tournament_id,team_id,player_id,acquisition_type,tournament_mmr_at_draft)values
('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007','admin_assignment',2350),
('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000008','admin_assignment',2400);
insert into public.competition_settings(tournament_id,format,lineup_size,configured_by)values('10000000-0000-4000-8000-000000000001','round_robin',1,'00000000-0000-4000-8000-000000000001');
insert into public.competition_stages(id,tournament_id,name,stage_type,sequence_number)values('73000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','League','league',1);
insert into public.matches(id,tournament_id,stage_id,round_number,match_number,team_a_id,team_b_id,scheduled_at,best_of,status,check_in_opens_at,check_in_deadline)values
('73100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001',1,1,'40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',now(),3,'check_in',now()-interval'1 minute',now()+interval'10 minutes'),
('73100000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001',1,2,'40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',now()+interval'1 hour',3,'scheduled',now()+interval'30 minutes',now()+interval'70 minutes');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);set local role authenticated;
select lives_ok($$select public.check_in_team('73100000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001')$$,'team A checks in');
select lives_ok($$select public.confirm_match_lineup('73100000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',array['30000000-0000-4000-8000-000000000007']::uuid[])$$,'team A confirms valid roster snapshot');
reset role;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);set local role authenticated;
select lives_ok($$select public.check_in_team('73100000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002')$$,'team B checks in');
select lives_ok($$select public.confirm_match_lineup('73100000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',array['30000000-0000-4000-8000-000000000008']::uuid[])$$,'team B confirms valid roster snapshot');
reset role;
select is((select status::text from public.matches where id='73100000-0000-4000-8000-000000000001'),'ready','dual check-in and lineups make match ready');
update public.matches set status='live'where id='73100000-0000-4000-8000-000000000001';
select ok((select bool_and(locked_at is not null)from public.match_lineups where match_id='73100000-0000-4000-8000-000000000001'),'lineups lock when match starts');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((public.submit_match_result('73100000-0000-4000-8000-000000000001',2,0,null,'reported','73200000-0000-4000-8000-000000000001')->>'code'),'RESULT_SUBMITTED','captain submits result');
reset role;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);set local role authenticated;
select is((public.respond_to_match_result((select id from public.match_result_submissions where match_id='73100000-0000-4000-8000-000000000001'),true,null,'73200000-0000-4000-8000-000000000002')->>'code'),'RESULT_CONFIRMED','opponent confirms result');
reset role;
select is((select status::text from public.matches where id='73100000-0000-4000-8000-000000000001'),'completed','confirmation completes match');
select is((select count(*)from public.match_snapshots where match_id='73100000-0000-4000-8000-000000000001'),1::bigint,'completion creates exactly one immutable snapshot');
select is((select jsonb_array_length(team_a_lineup)from public.match_snapshots where match_id='73100000-0000-4000-8000-000000000001'),1,'snapshot preserves team A lineup');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);set local role authenticated;
select lives_ok($$select public.reschedule_match('73100000-0000-4000-8000-000000000002',now()+interval'2 hours','Broadcast conflict')$$,'official reschedules pending match');
select is((select count(*)from public.match_schedule_changes where match_id='73100000-0000-4000-8000-000000000002'),1::bigint,'reschedule history is append-only');
select is((public.award_match_forfeit('73100000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','No show','73200000-0000-4000-8000-000000000003')->>'code'),'MATCH_FORFEITED','official awards forfeit');
select throws_ok($$select public.reschedule_match('73100000-0000-4000-8000-000000000002',now(),'invalid')$$,'P0001','MATCH_ALREADY_COMPLETED','terminal match cannot be rescheduled');
select lives_ok($$select public.complete_competition('10000000-0000-4000-8000-000000000001')$$,'organizer completes fully resolved competition');
reset role;
select is((select count(*)from public.competition_result_snapshots where tournament_id='10000000-0000-4000-8000-000000000001'),1::bigint,'completion persists one final result snapshot');
select ok((select count(*)>=8 from public.competition_notifications where tournament_id='10000000-0000-4000-8000-000000000001'),'workflow emits participant notifications');
select ok(exists(select 1 from public.audit_events where event_type='COMPETITION_COMPLETED'),'competition completion is audited');
select * from finish();rollback;
