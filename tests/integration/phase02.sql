begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

select has_type('public','rating_confidence_level','rating confidence enum exists');
select has_type('public','player_type','player type enum exists');
select has_table('public','player_evidence','evidence metadata table exists');
select ok((select not public from storage.buckets where id='tournament-evidence'),'evidence bucket is private');
select ok((select public from storage.buckets where id='team-assets'),'team assets bucket is public');

insert into public.tournaments(id,name,slug,status,created_by,appeals_close_at)
values('10000000-0000-4000-8000-000000000003','Phase 02 Test','phase-02-test','registration','00000000-0000-4000-8000-000000000002',now()+interval '1 day');
insert into public.tournament_members(id,tournament_id,user_id,status) values
('20000000-0000-4000-8000-000000000040','10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','active'),
('20000000-0000-4000-8000-000000000041','10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000021','active'),
('20000000-0000-4000-8000-000000000042','10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000023','active');
insert into public.tournament_member_roles(member_id,role) values
('20000000-0000-4000-8000-000000000040','organizer'),
('20000000-0000-4000-8000-000000000041','captain'),
('20000000-0000-4000-8000-000000000042','captain');
insert into public.tournament_rules(tournament_id,team_size,starting_credits,minimum_bid,bid_increment,initial_bid_seconds,nomination_seconds,replacement_mmr_tolerance,mmr_target,mmr_min,mmr_max)
values('10000000-0000-4000-8000-000000000003',2,1000,10,5,30,30,100,5000,4500,5500);
insert into public.tournament_players(id,tournament_id,user_id,ign,tournament_mmr,rating_confidence,rating_status,is_eligible,registration_status)
values
('30000000-0000-4000-8000-000000000121','10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000021','Captain21',2400,'high','verified',true,'approved'),
('30000000-0000-4000-8000-000000000123','10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000023','Captain23',2500,'high','verified',true,'approved');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000020',true);
set local role authenticated;
select lives_ok($$select public.submit_registration('10000000-0000-4000-8000-000000000003','Player Twenty','P20','EU','Carry','Mid',2200,2300,'available','https://example.test/p20','active','ready')$$,'player registers self through RPC');
select is((select count(*)::integer from public.tournament_players where tournament_id='10000000-0000-4000-8000-000000000003' and user_id='00000000-0000-4000-8000-000000000020'),1,'one registration is created');
select lives_ok($$select public.submit_registration('10000000-0000-4000-8000-000000000003','Player Twenty','P20-updated','EU','Carry','Mid',2250,2350,'available','https://example.test/p20','active','ready')$$,'resubmission updates the existing registration');
select is((select count(*)::integer from public.tournament_players where tournament_id='10000000-0000-4000-8000-000000000003' and user_id='00000000-0000-4000-8000-000000000020'),1,'duplicate registration is prevented');
select throws_ok($$update public.tournament_players set tournament_mmr=9999 where user_id='00000000-0000-4000-8000-000000000020'$$,'P0001',null,'player cannot change Tournament MMR');
reset role;

insert into public.player_evidence(id,tournament_id,player_id,evidence_type,storage_path,uploaded_by)
select '51000000-0000-4000-8000-000000000001',tournament_id,id,'rank_mmr','10000000-0000-4000-8000-000000000003/00000000-0000-4000-8000-000000000020/proof.png',user_id
from public.tournament_players where tournament_id='10000000-0000-4000-8000-000000000003' and user_id='00000000-0000-4000-8000-000000000020';

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000022',true);
set local role authenticated;
select is((select count(*)::integer from public.player_evidence where tournament_id='10000000-0000-4000-8000-000000000003'),0,'other player cannot read private evidence metadata');
select lives_ok($$update public.tournament_players set ign='stolen' where user_id='00000000-0000-4000-8000-000000000020'$$,'cross-player update is filtered');
reset role;
select isnt((select ign from public.tournament_players where user_id='00000000-0000-4000-8000-000000000020' and tournament_id='10000000-0000-4000-8000-000000000003'),'stolen','another registration remains unchanged');

update public.tournaments set status='verification' where id='10000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000020',true);
set local role authenticated;
select throws_ok($$select public.submit_registration('10000000-0000-4000-8000-000000000003','Player Twenty','Late','EU','Carry','',2200,2300,'available','https://example.test/p20','active','late')$$,'P0001','registration is closed', 'registration state is enforced');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select lives_ok($$select public.review_player(id,2250,2350,2300,'medium','verify') from public.tournament_players where tournament_id='10000000-0000-4000-8000-000000000003' and user_id='00000000-0000-4000-8000-000000000020'$$,'organizer verifies a managed player');
select is((select rating_confidence::text from public.tournament_players where tournament_id='10000000-0000-4000-8000-000000000003' and user_id='00000000-0000-4000-8000-000000000020'),'medium','rating confidence is stored as enum');
select is((select registration_status::text from public.tournament_players where tournament_id='10000000-0000-4000-8000-000000000003' and user_id='00000000-0000-4000-8000-000000000020'),'approved','verification approves registration');
select lives_ok($$select public.create_team('10000000-0000-4000-8000-000000000003','Emerald','EMR','#2dd4a7',null,'00000000-0000-4000-8000-000000000021')$$,'organizer creates a team for assigned captain');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000022',true);
set local role authenticated;
select throws_ok($$select public.review_player('30000000-0000-4000-8000-000000000121',2400,2400,2400,'high','verify')$$,'42501','forbidden','organizer scoping blocks outsider review');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000021',true);
set local role authenticated;
select lives_ok($$select public.submit_rating_review(id,'slightly_stronger') from public.tournament_players where tournament_id='10000000-0000-4000-8000-000000000003' and user_id='00000000-0000-4000-8000-000000000020'$$,'captain submits private review');
select is((select count(*)::integer from public.rating_reviews where tournament_id='10000000-0000-4000-8000-000000000003'),1,'captain sees own review');
select lives_ok($$select public.confirm_captain(id,true) from public.teams where tournament_id='10000000-0000-4000-8000-000000000003'$$,'captain confirms own team');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000023',true);
set local role authenticated;
select is((select count(*)::integer from public.rating_reviews where tournament_id='10000000-0000-4000-8000-000000000003'),0,'another captain cannot read private review');
select throws_ok($$select public.confirm_captain(id,true) from public.teams where tournament_id='10000000-0000-4000-8000-000000000003'$$,'42501','forbidden','other captain cannot confirm team');
reset role;

delete from public.tournament_member_roles where member_id='20000000-0000-4000-8000-000000000042' and role='captain';

update public.tournaments set status='rating_review' where id='10000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000020',true);
set local role authenticated;
select lives_ok($$select public.submit_appeal(id,'tournament_mmr','My recent results support review',null) from public.tournament_players where tournament_id='10000000-0000-4000-8000-000000000003' and user_id='00000000-0000-4000-8000-000000000020'$$,'player submits appeal during open window');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select sum(review_count)::integer from public.organizer_rating_review_summary where tournament_id='10000000-0000-4000-8000-000000000003'),1,'organizer sees aggregate captain signal');
select throws_ok($$select public.lock_player_pool('10000000-0000-4000-8000-000000000003')$$,'P0001','blocking appeals remain','unresolved appeal blocks pool lock');
select lives_ok($$select public.resolve_appeal(id,false,'Verified evidence does not support adjustment') from public.appeals where tournament_id='10000000-0000-4000-8000-000000000003'$$,'organizer resolves appeal');
select lives_ok($$select public.lock_player_pool('10000000-0000-4000-8000-000000000003')$$,'ready player pool locks');
select is((select status::text from public.tournaments where id='10000000-0000-4000-8000-000000000003'),'player_pool_locked','tournament transitions to player_pool_locked');
select throws_ok($$select public.review_player(id,2250,2350,2400,'high','verify') from public.tournament_players where tournament_id='10000000-0000-4000-8000-000000000003' and user_id='00000000-0000-4000-8000-000000000020'$$,'P0001','ratings are not editable in this phase','normal rating changes are blocked after lock');
select ok((select count(*)>=8 from public.audit_events where tournament_id='10000000-0000-4000-8000-000000000003'),'workflow actions are audited');
reset role;

set local role anon;
select is((select count(*)::integer from public.player_evidence),0,'anonymous cannot read evidence metadata');
select ok(not exists(select 1 from information_schema.columns where table_schema='public' and table_name='public_player_pool' and column_name in ('full_name','user_id','declared_mmr','verified_mmr','rating_confidence','additional_notes')),'public player pool omits private fields');
reset role;

select * from finish();
rollback;
