begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

select is((select count(*) from public.public_season_tournaments where season_slug='draftgg-season-one'),2::bigint,'Season 1 contains exactly tournaments A and B');
select is((select count(*) from public.public_season_tournaments where season_slug='draftgg-season-one'and tournament_slug='isolation-cup-charlie'),0::bigint,'Tournament C cannot leak into Season 1');
select is((select count(distinct tournament_slug)from public.public_season_rating_history where season_slug='draftgg-season-one'),2::bigint,'Season 1 rating history spans two tournaments');
select is((select count(*)from public.public_season_rating_history where season_slug='draftgg-season-one'and tournament_slug='isolation-cup-charlie'),0::bigint,'season rating history excludes Tournament C');

select is((select tournaments_entered from public.public_player_career_stats where public_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000003')),3::bigint,'persistent player career includes three tournaments');
select is((select tournaments_completed from public.public_player_career_stats where public_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000003')),3::bigint,'completed tournament count derives from result snapshots');
select is((select teams_represented from public.public_player_career_stats where public_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000003')),3::bigint,'teams represented spans independent historical teams');
select is((select matches_played from public.public_player_career_stats where public_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000003')),7,'forfeit is excluded from competitive match count');
select is((select count(*)from public.public_player_match_history where public_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000003')),8::bigint,'public match history retains forfeit');
select is((select count(*)from public.public_player_match_history where public_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000003')and forfeit),1::bigint,'forfeit is explicitly marked');
select is((select count(*)from public.draft_player_snapshots where player_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000003')),3::bigint,'draft history has independent A B C entries');
select is((select count(distinct tournament_mmr_at_draft)from public.draft_player_snapshots where player_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000003')),3::bigint,'historical Tournament MMR snapshots remain independent');
select is((select count(distinct purchase_price)from public.draft_player_snapshots where player_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000003')),3::bigint,'historical auction prices remain independent');

select is((select confidence from public.public_player_career_stats where public_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000003')),'established'::public.rating_confidence_status,'real canonical matches establish confidence');
select is((select count(*)from public.public_rating_history where public_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000003')),7::bigint,'rating ledger has one event per eligible match');
select ok((select bool_and(rating_after=rating_before+delta)from public.competitive_rating_events where player_id='00000000-0000-4000-8000-000000000003'),'rating ledger arithmetic is exact before public rounding');
select is((select count(*)from(select match_id,count(*)from public.public_rating_history where public_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000003')group by match_id having count(*)>1)x),0::bigint,'rating history contains no duplicate match event');
select is((select count(*)from public.competitive_rating_events e join public.matches m on m.id=e.match_id where m.status='forfeit'),0::bigint,'forfeit has no Competitive Rating impact');

create temporary table rating_canonical as select * from public.player_competitive_ratings;
create temporary table season_canonical as select * from public.player_season_ratings;
create temporary table ledger_canonical as select player_id,match_id,rating_before,rating_after,uncertainty_before,uncertainty_after,delta,result,processed_at from public.competitive_rating_events;
select is(public.rebuild_competitive_ratings(),7,'protected rebuild replays seven eligible matches');
select is((select count(*)from public.player_competitive_ratings a full join rating_canonical b using(player_id,rating_version)where(a.rating,a.uncertainty,a.matches_count,a.wins,a.losses,a.status)is distinct from(b.rating,b.uncertainty,b.matches_count,b.wins,b.losses,b.status)),0::bigint,'career rating rebuild has exact equality');
select is((select count(*)from public.player_season_ratings a full join season_canonical b using(player_id,season_id,rating_version)where(a.rating,a.uncertainty,a.matches_count,a.wins,a.losses,a.status)is distinct from(b.rating,b.uncertainty,b.matches_count,b.wins,b.losses,b.status)),0::bigint,'season rating rebuild has exact equality');
select is((select count(*)from public.competitive_rating_events a full join ledger_canonical b using(player_id,match_id)where(a.rating_before,a.rating_after,a.uncertainty_before,a.uncertainty_after,a.delta,a.result,a.processed_at)is distinct from(b.rating_before,b.rating_after,b.uncertainty_before,b.uncertainty_after,b.delta,b.result,b.processed_at)),0::bigint,'rating ledger order and values rebuild exactly');

create temporary table before_correction as select rating from public.player_competitive_ratings where player_id='00000000-0000-4000-8000-000000000003';
update public.matches set winner_team_id=loser_team_id,loser_team_id=winner_team_id,team_a_score=case when team_a_score=2 then 1 else 2 end,team_b_score=case when team_b_score=2 then 1 else 2 end where id='87710001-0000-4000-8000-000000000001';
select is(public.rebuild_competitive_ratings(),7,'approved historical correction rebuild processes canonical history once');
select isnt((select rating from public.player_competitive_ratings where player_id='00000000-0000-4000-8000-000000000003'),(select rating from before_correction),'corrected result replaces old rating influence');
select is((select count(*)from(select player_id,match_id,count(*)from public.competitive_rating_events group by player_id,match_id having count(*)>1)x),0::bigint,'result correction leaves no duplicate or orphan ledger events');

select is(public.rebuild_achievements(),48,'achievement rebuild produces deterministic canonical awards');
select is(public.rebuild_achievements(),48,'achievement re-evaluation is idempotent');
select is((select count(*)from(select player_id,achievement_code,tournament_id,match_id,count(*)from public.player_achievements group by player_id,achievement_code,tournament_id,match_id having count(*)>1)x),0::bigint,'achievement awards never duplicate in their canonical context');
select is((select count(distinct achievement_code)from public.player_achievements where player_id='00000000-0000-4000-8000-000000000003'and achievement_code in('FIRST_DRAFT','FIRST_MATCH','FIRST_WIN','TOURNAMENT_CHAMPION')),4::bigint,'objective core achievements derive from real history');

select is((select tournaments_captained from public.public_captain_career_stats where captain_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000001')),3::bigint,'captain career spans multiple tournaments');
select is((select matches_played from public.public_captain_career_stats where captain_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000001')),8::numeric,'captain match record includes canonical completed and forfeit history');
select is((select count(*)from public.public_organization_history where organization_slug='persistent-phoenix'),3::bigint,'organization history spans three tournament snapshots');
select ok((select bool_and(jsonb_array_length(roster)=4)from public.public_organization_history where organization_slug='persistent-phoenix'),'organization historical roster is snapshot-based and complete');

update public.profiles set display_name='Current Renamed Ace',avatar_url='https://example.test/current.png'where id='00000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
update public.tournament_players set tournament_mmr=9999 where user_id='00000000-0000-4000-8000-000000000003';
update public.organizations set name='Current Phoenix Branding'where slug='persistent-phoenix';
update public.teams set name='Current Team Branding'where id='87410000-0000-4000-8000-000000000001';
select is((select ign from public.draft_player_snapshots where tournament_id='87200000-0000-4000-8000-000000000001'and player_slug=(select public_slug from profiles where id='00000000-0000-4000-8000-000000000003')),'HistoricAceA','current identity cannot rewrite historical draft identity');
select is((select team_name from public.draft_team_snapshots where team_id='87410000-0000-4000-8000-000000000001'),'Alpha Phoenix','current team branding cannot rewrite historical team snapshot');

select * from finish();
rollback;
