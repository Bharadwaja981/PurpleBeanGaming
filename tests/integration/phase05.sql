begin;
create extension if not exists pgtap with schema extensions;
select plan(28);
select has_column('public','profiles','public_slug','stable public player slug exists');
select has_column('public','tournament_rules','spectator_delay_seconds','server-side spectator delay is configurable');
select has_table('public','draft_snapshots','immutable draft snapshot exists');
select has_table('public','draft_team_snapshots','immutable team snapshot exists');
select has_table('public','draft_player_snapshots','immutable player snapshot exists');
select has_view('public','public_draft_player_analytics','player analytics projection exists');
select has_view('public','public_draft_team_analytics','team analytics projection exists');
select has_view('public','public_draft_events','safe replay projection exists');
select has_function('public','get_public_draft_package',array['text'],'delayed public package RPC exists');
select has_function('public','export_draft_csv',array['uuid'],'organizer CSV export exists');
select ok((select count(*)=count(distinct public_slug) from public.profiles),'generated public player slugs are unique');
select ok((select bool_and(public_slug not like '%'||replace(id::text,'-','')||'%') from public.profiles),'public slugs do not reveal auth UUIDs');

insert into public.draft_snapshots(id,tournament_id,tournament_name,tournament_slug,season,rules_version,team_size,mmr_target,mmr_min,mmr_max,starting_credits,completed_at,total_bids,total_auctions,total_sold,total_unsold)
values('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','DraftGG Test Cup','draftgg-test-cup','S1',1,5,14000,12000,15000,1000,clock_timestamp(),5,2,2,0);
insert into public.draft_team_snapshots(snapshot_id,tournament_id,team_id,team_slug,team_name,team_tag,captain_slug,captain_name,captain_mmr,final_team_mmr,starting_credits,credits_remaining,recruit_count)
values('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','alpha','Alpha','ALP','captain-alpha','Captain Alpha',2050,7050,1000,960,2);
insert into public.draft_player_snapshots(snapshot_id,tournament_id,team_id,player_id,player_slug,ign,primary_role,tournament_mmr_at_draft,purchase_price,acquisition_type,auction_sequence,bid_count)
values
('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007','public-a','Player A','carry',2000,10,'auction',1,2),
('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000008','public-b','Player B','support',3000,30,'auction',2,3);

select is((select credits_per_1000_mmr from public.public_draft_player_analytics where player_slug='public-a'),5.00::numeric,'credits per 1000 MMR is exact numeric arithmetic');
select is((select expected_price from public.public_draft_player_analytics where player_slug='public-a'),15.00::numeric,'expected price uses tournament median normalized rate');
select is((select price_delta from public.public_draft_player_analytics where player_slug='public-a'),-5.00::numeric,'price delta is deterministic');
select is((select price_indicator from public.public_draft_player_analytics where player_slug='public-a'),'Strong Value','neutral price classification is deterministic');
select is((select max(purchase_price) from public.public_draft_player_analytics),30,'most expensive player is reproducible');
select is((select min(purchase_price) from public.public_draft_player_analytics),10,'lowest purchase is reproducible');
select is((select ign from public.public_draft_player_analytics order by bid_count desc limit 1),'Player B','most contested by accepted bids is reproducible');
select is((select credits_spent from public.public_draft_team_analytics where team_slug='alpha'),40,'team credits spent is snapshot-derived');
select is((select lowest_purchase from public.public_draft_team_analytics where team_slug='alpha'),10,'team lowest purchase is correct');
update public.tournament_players set tournament_mmr=9999 where id='30000000-0000-4000-8000-000000000007';
select is((select tournament_mmr_at_draft from public.draft_player_snapshots where player_slug='public-a'),2000,'current rating changes cannot rewrite draft-time MMR');
update public.tournament_rules set spectator_delay_seconds=60 where tournament_id='10000000-0000-4000-8000-000000000001';
insert into public.auctions(tournament_id,player_id,nominating_team_id,sequence_number,status,opening_bid,started_at,closes_at) values('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000009','40000000-0000-4000-8000-000000000001',99,'open',10,clock_timestamp(),clock_timestamp()+interval '30 seconds');
select is(public.get_public_draft_package('draftgg-test-cup')->'auction','null'::jsonb,'server-side delay hides events newer than the database cutoff');
update public.tournament_rules set spectator_delay_seconds=0 where tournament_id='10000000-0000-4000-8000-000000000001';
select is(public.get_public_draft_package('draftgg-test-cup')->'auction'->>'sequence_number','99','zero-delay spectators receive committed auction state');

set local role anon;
select lives_ok($$select * from public.public_draft_events$$,'anonymous replay projection is directly readable');
select lives_ok($$select public.get_public_draft_package('draftgg-test-cup')$$,'anonymous spectator can read approved package');
select ok(public.get_public_draft_package('draftgg-test-cup')::text !~* 'email|discord_username|steam_id|evidence_url|rejection_reason|request_id|actor_user_id','public package omits private and security fields');
select throws_ok($$update public.draft_player_snapshots set purchase_price=999$$,'42501','permission denied for table draft_player_snapshots','anonymous spectators cannot mutate snapshots');
reset role;
select * from finish();
rollback;
