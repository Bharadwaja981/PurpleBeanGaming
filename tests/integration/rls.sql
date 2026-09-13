begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into public.tournaments(id,name,slug,status,created_by) values('10000000-0000-4000-8000-000000000002','DraftGG Test Cup B','draftgg-test-cup-b','registration','00000000-0000-4000-8000-000000000002');
insert into public.tournament_members(id,tournament_id,user_id,status) values('20000000-0000-4000-8000-000000000032','10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','active');
insert into public.tournament_member_roles(member_id,role) values('20000000-0000-4000-8000-000000000032','organizer');
insert into public.scouting_entries(id,tournament_id,captain_user_id,player_id,category,notes) values
('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007','priority','Captain A private'),
('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000007','avoid','Captain B private');
insert into public.auctions(id,tournament_id,player_id,nominating_team_id,sequence_number,status,opening_bid,revision) values('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000001',1,'pending',10,0);
insert into public.appeals(id,tournament_id,player_id,appeal_type,reason,evidence_url) values('70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007','rating','Test reason','https://private.invalid/evidence');
insert into public.audit_events(id,tournament_id,event_type,entity_type,payload) values('80000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','TEST_EVENT','test','{"private":true}');
insert into public.team_roster(id,tournament_id,team_id,player_id,acquisition_type,tournament_mmr_at_draft) values('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007','admin_assignment',2350);
insert into public.bids(id,tournament_id,auction_id,team_id,captain_user_id,amount,request_id,auction_revision_before) values('a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',10,'b0000000-0000-4000-8000-000000000001',0);

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*)::integer from public.scouting_entries),1,'captain cannot read another captain scouting entry');
select is((select notes from public.scouting_entries limit 1),'Captain B private','captain reads only own scouting notes');
select lives_ok($$update public.teams set credits_remaining=1 where id='40000000-0000-4000-8000-000000000002'$$,'captain credit mutation is filtered');
select is((select credits_remaining from public.teams where id='40000000-0000-4000-8000-000000000002'),1000,'captain cannot change team credits');
select lives_ok($$update public.teams set current_team_mmr=1 where id='40000000-0000-4000-8000-000000000002'$$,'captain MMR mutation is filtered');
select is((select current_team_mmr from public.teams where id='40000000-0000-4000-8000-000000000002'),2100,'captain cannot change team MMR');
select throws_ok($$insert into public.team_roster(tournament_id,team_id,player_id,acquisition_type,tournament_mmr_at_draft) values('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000008','admin_assignment',2400)$$,'42501');
reset role;

update public.tournaments set status='registration' where id='10000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
set local role authenticated;
select throws_ok($$update public.tournament_players set tournament_mmr=9999 where user_id='00000000-0000-4000-8000-000000000007'$$,'P0001');
select throws_ok($$update public.tournament_players set verified_mmr=9999 where user_id='00000000-0000-4000-8000-000000000007'$$,'P0001');
select throws_ok($$update public.auctions set current_bid=999 where id='60000000-0000-4000-8000-000000000001'$$,'42501','permission denied for table auctions','non-captain auction mutation is denied');
select is((select current_bid from public.auctions where id='60000000-0000-4000-8000-000000000001'),null,'non-captain cannot mutate auction state');
select throws_ok($$insert into public.bids(tournament_id,auction_id,team_id,captain_user_id,amount,request_id,auction_revision_before,accepted) values('10000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000007',20,'b0000000-0000-4000-8000-000000000002',0,true)$$,'42501');
select lives_ok($$update public.audit_events set payload='{}' where id='80000000-0000-4000-8000-000000000001'$$,'audit update is filtered');
select lives_ok($$delete from public.audit_events where id='80000000-0000-4000-8000-000000000001'$$,'audit delete is filtered');
reset role;
select is((select payload from public.audit_events where id='80000000-0000-4000-8000-000000000001'),'{"private": true}'::jsonb,'normal user cannot update or delete audit history');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$update public.tournaments set season='Organizer A managed' where id='10000000-0000-4000-8000-000000000001'$$,'organizer can manage own tournament');
select is((select season from public.tournaments where id='10000000-0000-4000-8000-000000000001'),'Organizer A managed','organizer update persists');
select lives_ok($$update public.tournaments set season='unauthorized' where id='10000000-0000-4000-8000-000000000002'$$,'cross-tournament update is filtered');
reset role;
select isnt((select season from public.tournaments where id='10000000-0000-4000-8000-000000000002'),'unauthorized','organizer cannot manage another tournament');

select throws_ok($$insert into public.team_roster(tournament_id,team_id,player_id,acquisition_type,tournament_mmr_at_draft) values('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000007','admin_assignment',2350)$$,'23505');
select throws_ok($$insert into public.bids(tournament_id,auction_id,team_id,captain_user_id,amount,request_id,auction_revision_before) values('10000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',20,'b0000000-0000-4000-8000-000000000001',0)$$,'23505');

set local role anon;
select throws_ok($$select evidence_url from public.appeals$$,'42501');
select ok(not exists(select 1 from information_schema.columns where table_schema='public' and table_name in ('public_tournament_summary','public_player_pool','public_teams','public_auction_state') and column_name in ('email','user_id','captain_user_id','notes','evidence_url','reviewer_user_id','payload')),'public views omit private columns');
select lives_ok($$select * from public.public_tournament_summary$$,'anonymous can query tournament summary');
select lives_ok($$select * from public.public_player_pool$$,'anonymous can query player pool');
select lives_ok($$select * from public.public_teams$$,'anonymous can query teams');
select lives_ok($$select * from public.public_auction_state$$,'anonymous can query auction state');
reset role;

select * from finish();
rollback;
