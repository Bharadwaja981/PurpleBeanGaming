begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

select has_type('public','player_draft_state','draft lifecycle enum exists');
select has_table('public','unsold_rounds','unsold round state is persisted');
select has_function('public','is_draft_state_feasible',array['uuid'],'global feasibility RPC exists');
select has_function('public','check_award_feasibility',array['uuid','uuid','uuid','integer'],'award feasibility RPC exists');
select has_function('public','validate_draft_configuration',array['uuid'],'certification RPC exists');
select has_function('public','get_safe_recruit_range',array['uuid','uuid'],'safe recruit range RPC exists');
select has_function('public','get_team_recruit_eligibility',array['uuid','uuid','uuid'],'eligibility RPC exists');
select has_function('public','start_unsold_round',array['uuid'],'unsold round RPC exists');
select has_function('public','get_draft_completion_state',array['uuid'],'completion RPC exists');

select is((select sum(5-1-roster_size)::integer from public.teams where tournament_id='10000000-0000-4000-8000-000000000001'),24,'six captains with no recruits report 24 remaining recruit slots');
select is((private.evaluate_draft_feasibility('10000000-0000-4000-8000-000000000001')->>'remaining_slots')::integer,24,'solver uses four recruit assignments per team');
select ok((private.evaluate_draft_feasibility('10000000-0000-4000-8000-000000000001')->>'feasible')::boolean,'seed draft has a complete feasible assignment');
select is((select current_team_mmr from public.teams where id='40000000-0000-4000-8000-000000000001'),2050,'captain Tournament MMR is already included in team MMR');

update public.teams set roster_size=4 where id='40000000-0000-4000-8000-000000000001';
select is((select 1+roster_size from public.teams where id='40000000-0000-4000-8000-000000000001'),5,'captain plus four recruits is complete');
select is((private.evaluate_draft_feasibility('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007',10)->>'code'),'ROSTER_FULL','captain plus a fifth recruit is rejected');
update public.teams set roster_size=2,credits_remaining=19 where id='40000000-0000-4000-8000-000000000001';
select is((private.evaluate_draft_feasibility('10000000-0000-4000-8000-000000000001')->>'code'),'INSUFFICIENT_REMAINING_CREDITS','captain plus two recruits reserves exactly two future minimum bids');
update public.teams set credits_remaining=20 where id='40000000-0000-4000-8000-000000000001';
select isnt((private.evaluate_draft_feasibility('10000000-0000-4000-8000-000000000001')->>'code'),'INSUFFICIENT_REMAINING_CREDITS','two remaining recruits require no more than two minimum bids');
update public.teams set roster_size=0,credits_remaining=1000 where id='40000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((public.validate_draft_configuration('10000000-0000-4000-8000-000000000001')->>'captain_count')::integer,6,'certification counts six captains');
select is((public.validate_draft_configuration('10000000-0000-4000-8000-000000000001')->>'recruit_slots')::integer,24,'certification requires 24 recruit slots, not 30');
select lives_ok($$select public.get_safe_recruit_range('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001')$$,'safe recruit range evaluates captain-inclusive team MMR');
select is((public.get_draft_completion_state('10000000-0000-4000-8000-000000000001')->>'remaining_recruit_slots')::integer,24,'endgame state excludes captain slots');
select lives_ok($$select public.start_auction('10000000-0000-4000-8000-000000000001')$$,'certified feasible draft starts');
select lives_ok($$select public.nominate_player('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000007',(select id from public.nomination_order where tournament_id='10000000-0000-4000-8000-000000000001' and status='active'))$$,'captain nominates under the certified model');
select is(public.get_max_legal_bid((select id from public.auctions where status='open')),970,'Phase 03 max legal bid reserves only three future purchases after first recruit');
reset role;

set local statement_timeout='3s';
select ok(private.feasibility_dfs(1,array_fill(4000,array[12]),array_fill(4,array[12]),12000,12000,array_fill(2000,array[48]),array_fill('flex'::text,array[48]),0,'[[],[],[],[],[],[],[],[],[],[],[],[]]'::jsonb,'{}'),'60-player / 12-team stress fixture finds a complete assignment within timeout');

update public.auctions set status='unsold',closes_at=clock_timestamp()-interval '1 second',closed_at=clock_timestamp(),revision=revision+1 where tournament_id='10000000-0000-4000-8000-000000000001';
update public.nomination_order set status='completed' where tournament_id='10000000-0000-4000-8000-000000000001';
update public.tournament_players set draft_state='unsold' where id='30000000-0000-4000-8000-000000000008';
update public.tournament_rules set allow_unsold_round=true,unsold_minimum_bid=5 where tournament_id='10000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.start_unsold_round('10000000-0000-4000-8000-000000000001')$$,'organizer starts an unsold round only after normal nominations complete');
select is((select draft_state::text from public.tournament_players where id='30000000-0000-4000-8000-000000000008'),'reentered','unsold player explicitly re-enters the pool');
select is((select count(*)::integer from public.nomination_order where tournament_id='10000000-0000-4000-8000-000000000001' and status='active'),1,'unsold round creates exactly one active nomination');
select throws_ok($$update public.unsold_rounds set status='cancelled' where tournament_id='10000000-0000-4000-8000-000000000001'$$,'42501','permission denied for table unsold_rounds','authenticated clients cannot mutate unsold workflow state directly');
reset role;

select * from finish();
rollback;
