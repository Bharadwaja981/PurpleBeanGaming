begin;
create extension if not exists pgtap with schema extensions;
select plan(62);

select has_type('public','bid_increment_type','constrained bid increment type exists');
select has_column('public','auctions','paused_remaining_seconds','pause remainder is persisted');
select has_function('public','start_auction',array['uuid'],'start RPC exists');
select has_function('public','nominate_player',array['uuid','uuid','uuid'],'nomination RPC exists');
select has_function('public','place_bid',array['uuid','bigint','uuid','bid_increment_type'],'bid RPC exists');
select has_function('public','finalize_auction',array['uuid'],'finalization RPC exists');
select has_function('public','pause_auction',array['uuid'],'pause RPC exists');
select has_function('public','resume_auction',array['uuid'],'resume RPC exists');
select has_function('public','get_current_auction_state',array['uuid'],'canonical state RPC exists');
select has_function('public','get_max_legal_bid',array['uuid'],'max legal bid RPC exists');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='one_live_auction_per_tournament'),'one live auction index exists');
select ok((select count(*)=5 from pg_publication_tables where pubname='supabase_realtime' and tablename in ('auctions','bids','teams','team_roster','nomination_order')),'auction tables are published to Realtime');
select ok(exists(select 1 from cron.job where jobname='draftgg-finalize-expired-auctions' and schedule='* * * * *'),'background finalization cron is installed');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.start_auction('10000000-0000-4000-8000-000000000001')$$,'organizer starts the auction');
select is((select status::text from public.tournaments where id='10000000-0000-4000-8000-000000000001'),'auction_live','tournament becomes live');
select is((select count(*)::integer from public.nomination_order where tournament_id='10000000-0000-4000-8000-000000000001' and status='active'),1,'exactly one nomination is active');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($$select public.nominate_player('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007',(select id from public.nomination_order where status='active' and tournament_id='10000000-0000-4000-8000-000000000001'))$$,'42501','only the active nominating captain may nominate','inactive captain cannot nominate');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
set local role authenticated;
select throws_ok($$select public.place_bid('00000000-0000-0000-0000-000000000000',0,'a1000000-0000-4000-8000-000000000001','next')$$,'P0001','auction not found','non-captain cannot use bidding as a write primitive');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.nominate_player('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007',(select id from public.nomination_order where status='active' and tournament_id='10000000-0000-4000-8000-000000000001'))$$,'active captain nominates eligible player');
select is((select opening_bid from public.auctions where status='open'),10,'opening bid comes from tournament rules');
select is((select count(*)::integer from public.auctions where status='open'),1,'one open auction exists');
select throws_ok($$select public.nominate_player('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007',(select id from public.nomination_order where status='active' and tournament_id='10000000-0000-4000-8000-000000000001'))$$,'P0001','an auction is already active','player cannot be nominated into a second live auction');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is(public.get_max_legal_bid((select id from public.auctions where status='open')),970,'maximum bid reserves three future recruit bids after the proposed first recruit');
select is((public.place_bid((select id from public.auctions where status='open'),0,'a1000000-0000-4000-8000-000000000002','next')->>'code'),'ACCEPTED','valid bid is accepted');
select is((select current_bid from public.auctions where status='open'),10,'first accepted bid uses opening price');
select is((select revision::integer from public.auctions where status='open'),1,'accepted bid increments revision once');
select is((public.place_bid((select id from public.auctions where status='open'),0,'a1000000-0000-4000-8000-000000000002','next')->>'duplicate'),'true','request retry returns deterministic duplicate');
reset role;
select is((select count(*)::integer from public.bids where request_id='a1000000-0000-4000-8000-000000000002'),1,'duplicate request creates one bid row');
set local role authenticated;
select is((select revision::integer from public.auctions where status='open'),1,'duplicate request does not increment revision');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is((public.place_bid((select id from public.auctions where status='open'),0,'a1000000-0000-4000-8000-000000000003','next')->>'code'),'STALE_REVISION','stale revision is rejected');
select is((select revision::integer from public.auctions where status='open'),1,'rejected bid does not mutate revision');
reset role;

update public.auctions set closes_at=clock_timestamp()+interval '2 seconds' where status='open';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is((public.place_bid((select id from public.auctions where status='open'),1,'a1000000-0000-4000-8000-000000000004','next')->>'code'),'ACCEPTED','competing higher bid is accepted');
reset role;
select ok((select closes_at>=clock_timestamp()+interval '8 seconds' from public.auctions where status='open'),'anti-snipe extends the database deadline');
select is((select current_bid from public.auctions where status='open'),15,'current bid only increases');
select is((select leading_team_id from public.auctions where status='open'),'40000000-0000-4000-8000-000000000003'::uuid,'leader matches accepted highest bid');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($$select public.pause_auction((select id from public.auctions where status='open'))$$,'42501','forbidden','non-organizer cannot pause');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.pause_auction((select id from public.auctions where status='open'))$$,'organizer pauses');
select ok((select paused_remaining_seconds>0 from public.auctions where status='paused'),'remaining time is stored');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
set local role authenticated;
select is((public.place_bid((select id from public.auctions where status='paused'),2,'a1000000-0000-4000-8000-000000000005','next')->>'code'),'AUCTION_PAUSED','bids fail during pause');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.resume_auction((select id from public.auctions where status='paused'))$$,'organizer resumes');
reset role;
select ok((select closes_at>clock_timestamp() and paused_remaining_seconds is null from public.auctions where status='open'),'resume restores a deterministic deadline');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select throws_ok($$update public.auctions set current_bid=999 where status='open'$$,'42501','permission denied for table auctions','client cannot update auction directly');
select throws_ok($$update public.teams set credits_remaining=1 where id='40000000-0000-4000-8000-000000000001'$$,'42501','auction-controlled team totals are RPC-only','organizer cannot directly alter credits');
select throws_ok($$insert into public.team_roster(tournament_id,team_id,player_id,acquisition_type,tournament_mmr_at_draft) values('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000008','auction',2400)$$,'42501','permission denied for table team_roster','client cannot directly insert roster');
select throws_ok($$update public.tournament_players set is_drafted=true where id='30000000-0000-4000-8000-000000000008'$$,'42501','drafted state is RPC-only','organizer cannot directly set drafted state');
select throws_ok($$update public.nomination_order set status='completed' where status='active'$$,'42501','permission denied for table nomination_order','client cannot directly advance nomination');
reset role;

update public.auctions set closes_at=clock_timestamp()-interval '1 second' where status='open';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
set local role authenticated;
select is((public.place_bid((select id from public.auctions where status='open'),2,'a1000000-0000-4000-8000-000000000006','next')->>'code'),'AUCTION_EXPIRED','expired auction rejects bids');
select is((public.finalize_auction((select id from public.auctions where status='open'))->>'status'),'sold','expired auction finalizes sold');
reset role;
select is((select revision::integer from public.auctions where status='sold'),3,'finalization increments revision exactly once');
select is((select credits_remaining from public.teams where id='40000000-0000-4000-8000-000000000003'),985,'credits deduct exactly once');
select is((select roster_size from public.teams where id='40000000-0000-4000-8000-000000000003'),1,'roster size increments exactly once');
select is((select current_team_mmr from public.teams where id='40000000-0000-4000-8000-000000000003'),4500,'team MMR increments exactly once');
select ok((select is_drafted from public.tournament_players where id='30000000-0000-4000-8000-000000000007'),'sold player is marked drafted');
select is((select count(*)::integer from public.team_roster where player_id='30000000-0000-4000-8000-000000000007'),1,'sold player has one owner');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((public.finalize_auction((select id from public.auctions where status='sold'))->>'duplicate'),'true','finalization retry is idempotent');
reset role;
select is((select credits_remaining from public.teams where id='40000000-0000-4000-8000-000000000003'),985,'finalization retry does not deduct twice');
select is((select count(*)::integer from public.nomination_order where status='active' and tournament_id='10000000-0000-4000-8000-000000000001'),1,'nomination advances exactly once');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select lives_ok($$select public.nominate_player('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000008',(select id from public.nomination_order where status='active' and tournament_id='10000000-0000-4000-8000-000000000001'))$$,'next captain nominates an unsold candidate');
reset role;
update public.auctions set closes_at=clock_timestamp()-interval '1 second' where status='open';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
set local role authenticated;
select is((public.finalize_auction((select id from public.auctions where status='open'))->>'status'),'unsold','no-bid auction finalizes unsold');
reset role;
select ok(not (select is_drafted from public.tournament_players where id='30000000-0000-4000-8000-000000000008'),'unsold player remains undrafted');
select ok((select public.get_current_auction_state('10000000-0000-4000-8000-000000000001')->'auction'->>'status')='unsold','reconnect RPC returns canonical persisted state');
select ok((select count(*)>=8 from public.audit_events where event_type in ('AUCTION_STARTED','PLAYER_NOMINATED','BID_ACCEPTED','BID_REJECTED','AUCTION_PAUSED','AUCTION_RESUMED','AUCTION_SOLD','AUCTION_UNSOLD')),'auction lifecycle is audited');

select * from finish();
rollback;
