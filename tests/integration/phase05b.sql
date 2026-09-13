begin;create extension if not exists pgtap with schema extensions;select plan(26);
select has_column('public','auctions','anti_snipe_extension_count','canonical anti-snipe count is persisted');
select has_table('public','feasibility_event_snapshots','organizer feasibility history is persisted');
select has_view('public','public_team_spend_progression','spend progression projection exists');
select has_view('public','public_captain_draft_history','captain history projection exists');
select has_function('public','get_public_auction_history',array['text','text','text','text','integer','integer','integer','boolean','integer','integer'],'paginated history RPC exists');

insert into public.auctions(id,tournament_id,player_id,nominating_team_id,sequence_number,status,opening_bid,current_bid,leading_team_id,started_at,closes_at,closed_at,winning_team_id,winning_bid,anti_snipe_extension_count)
values('81000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000001',91,'sold',10,30,'40000000-0000-4000-8000-000000000001',clock_timestamp()-interval '101 seconds',clock_timestamp()-interval '20 seconds',clock_timestamp()-interval '1 second','40000000-0000-4000-8000-000000000001',30,2);
insert into public.bids(tournament_id,auction_id,team_id,captain_user_id,amount,request_id,auction_revision_before,auction_revision_after,accepted,rejection_reason,received_at) values
('10000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',20,'82000000-0000-4000-8000-000000000001',0,1,true,null,clock_timestamp()-interval '50 seconds'),
('10000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',30,'82000000-0000-4000-8000-000000000002',1,2,true,null,clock_timestamp()-interval '40 seconds'),
('10000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',30,'82000000-0000-4000-8000-000000000003',2,null,false,'STALE_REVISION',clock_timestamp()-interval '39 seconds');
insert into public.audit_events(tournament_id,event_type,entity_type,entity_id,created_at) values
('10000000-0000-4000-8000-000000000001','AUCTION_PAUSED','auction','81000000-0000-4000-8000-000000000001',clock_timestamp()-interval '80 seconds'),
('10000000-0000-4000-8000-000000000001','AUCTION_RESUMED','auction','81000000-0000-4000-8000-000000000001',clock_timestamp()-interval '70 seconds');
insert into public.draft_snapshots(id,tournament_id,tournament_name,tournament_slug,rules_version,team_size,starting_credits,completed_at,total_bids,total_auctions,total_sold,total_unsold,mmr_target) values('83000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Cup','draftgg-test-cup',1,5,1000,clock_timestamp(),2,1,1,0,14000);
insert into public.draft_team_snapshots(snapshot_id,tournament_id,team_id,team_slug,team_name,team_tag,captain_slug,captain_name,captain_mmr,final_team_mmr,starting_credits,credits_remaining,recruit_count) values('83000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','alpha','Alpha','ALP','captain-alpha','Captain Alpha',2050,4450,1000,970,1);
insert into public.draft_player_snapshots(snapshot_id,tournament_id,team_id,player_id,player_slug,ign,primary_role,tournament_mmr_at_draft,purchase_price,acquisition_type,auction_id,auction_sequence,bid_count) values('83000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007','player-a','Player A','carry',2400,30,'auction','81000000-0000-4000-8000-000000000001',91,2);
select is((select unique_bidding_teams from public.draft_player_snapshots where player_slug='player-a'),2,'only distinct accepted bidding teams count');
select is((select wall_clock_duration_seconds from public.draft_player_snapshots where player_slug='player-a'),100,'wall-clock duration uses canonical timestamps');
select is((select active_bidding_duration_seconds from public.draft_player_snapshots where player_slug='player-a'),90,'active duration excludes persisted pause interval');
select is((select anti_snipe_extension_count from public.draft_player_snapshots where player_slug='player-a'),2,'anti-snipe count snapshots canonical auction value');
select is((select contested_wins from public.public_draft_team_analytics where team_slug='alpha'),1::bigint,'two bidding teams classify a contested win');
select is((select uncontested_wins from public.public_draft_team_analytics where team_slug='alpha'),0::bigint,'contested win is not also uncontested');
select is((select normal_round_spend from public.public_draft_team_analytics where team_slug='alpha'),30::bigint,'normal-round spend is deterministic');
select is((select credits_before from public.public_team_spend_progression where team_slug='alpha'),1000::bigint,'progression credits-before starts at budget');
select is((select credits_after from public.public_team_spend_progression where team_slug='alpha'),970::bigint,'progression credits-after deducts purchase');
select is((select team_mmr_after from public.public_team_spend_progression where team_slug='alpha'),4450::bigint,'progression MMR includes captain and acquired player');
select is((select contested_wins from public.public_captain_draft_history where captain_slug='captain-alpha'),1::bigint,'captain history aggregates contested acquisitions');
update public.teams set name='Changed Brand',current_team_mmr=9999 where id='40000000-0000-4000-8000-000000000001';
update public.profiles set display_name='Changed Captain' where id='00000000-0000-4000-8000-000000000001';
select is((select team_name from public.draft_team_snapshots where team_slug='alpha'),'Alpha','historical team branding remains immutable');
select is((select captain_name from public.draft_team_snapshots where team_slug='alpha'),'Captain Alpha','historical captain display remains immutable');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);set local role authenticated;
select matches(public.export_draft_csv('10000000-0000-4000-8000-000000000001'),'^team,team_tag,captain,player,role,tournament_mmr,purchase_price,acquisition_round,draft_phase,credits_remaining,team_mmr','CSV contains approved fields');
select ok(public.export_draft_csv('10000000-0000-4000-8000-000000000001') !~* 'email|discord|steam|evidence|appeal|scouting','CSV excludes private fields');reset role;
set local role anon;
select is(jsonb_array_length(public.get_public_draft_package('draftgg-test-cup')->'recent_bids'),2,'public live includes accepted bids only');
select ok(public.get_public_draft_package('draftgg-test-cup') ? 'nomination_order','public live contains nomination order');
select ok((public.get_public_draft_package('draftgg-test-cup')->'draft_health') ? 'message','public health is a safe summary');
select ok(public.get_public_draft_package('draftgg-test-cup')::text !~* 'rejection_reason|request_id|safe_range|actor_user_id|payload','public live excludes private feasibility and rejected-bid detail');
select is((public.get_public_auction_history('draftgg-test-cup',null,null,'sold',20,40,null,null,1,25)->>'total')::integer,1,'database history filters are applied server-side');reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);set local role authenticated;
select is(public.export_draft_csv('10000000-0000-4000-8000-000000000001'),null,'non-organizer cannot export');reset role;
select * from finish();rollback;
