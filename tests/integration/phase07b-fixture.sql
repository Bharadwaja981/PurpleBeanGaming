\set ON_ERROR_STOP on
begin;

insert into public.seasons(id,name,slug,year,sequence,status,starts_at,ends_at,created_by) values
('87000000-0000-4000-8000-000000000001','DraftGG Season One','draftgg-season-one',2026,1,'completed','2026-01-01','2026-08-01','00000000-0000-4000-8000-000000000001'),
('87000000-0000-4000-8000-000000000002','DraftGG Season Two','draftgg-season-two',2026,2,'active','2026-08-02','2026-12-31','00000000-0000-4000-8000-000000000001');
insert into public.season_rules(season_id,minimum_matches_for_leaderboard)values
('87000000-0000-4000-8000-000000000001',5),('87000000-0000-4000-8000-000000000002',5);
insert into public.organizations(id,name,slug,short_tag,country_code,verified,created_by)
values('87100000-0000-4000-8000-000000000001','Persistent Phoenix','persistent-phoenix','PHX','GB',true,'00000000-0000-4000-8000-000000000001');

insert into public.tournaments(id,name,slug,season,status,starts_at,ends_at,created_by,season_id)values
('87200000-0000-4000-8000-000000000001','Career Cup Alpha','career-cup-alpha','Season One','completed','2026-02-01','2026-02-03','00000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001'),
('87200000-0000-4000-8000-000000000002','Career Cup Bravo','career-cup-bravo','Season One','completed','2026-06-01','2026-06-03','00000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001'),
('87200000-0000-4000-8000-000000000003','Isolation Cup Charlie','isolation-cup-charlie','Season Two','completed','2026-09-01','2026-09-03','00000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000002');
insert into public.tournament_rules(tournament_id,team_size,starting_credits,minimum_bid,bid_increment,initial_bid_seconds,nomination_seconds)select id,5,1000,10,5,30,30 from public.tournaments where id::text like '87200000-%';
insert into public.competition_settings(tournament_id,format,lineup_size,configured_by)select id,'round_robin',5,'00000000-0000-4000-8000-000000000001' from public.tournaments where id::text like '87200000-%';
insert into public.tournament_members(id,tournament_id,user_id,status)select ('87900000-0000-4000-8000-'||right(id::text,12))::uuid,id,'00000000-0000-4000-8000-000000000001','active' from public.tournaments where id::text like '87200000-%';
insert into public.tournament_member_roles(member_id,role)select id,'organizer' from public.tournament_members where id::text like '87900000-%';

do $$declare ti int;u int;tid uuid;begin
 for ti in 1..3 loop
  tid:=('87200000-0000-4000-8000-'||lpad(ti::text,12,'0'))::uuid;
  for u in 1..10 loop
   insert into public.tournament_players(id,tournament_id,user_id,ign,primary_role,region,tournament_mmr,rating_confidence,rating_status,is_eligible,is_drafted,registration_status)
   values(('873'||ti::text||'0000-0000-4000-8000-'||lpad(u::text,12,'0'))::uuid,tid,('00000000-0000-4000-8000-'||lpad(u::text,12,'0'))::uuid,
    case when u=3 then case ti when 1 then 'HistoricAceA' when 2 then 'HistoricAceB' else 'HistoricAceC' end else 'CareerPlayer'||u end,
    (array['Tank','Support','DPS'])[(u%3)+1],'EU',2800+u*100+ti*50,'high','locked',true,true,'approved');
  end loop;
 end loop;
end$$;

insert into public.teams(id,tournament_id,name,short_tag,captain_user_id,starting_credits,credits_remaining,captain_mmr,current_team_mmr,roster_size,max_roster_size,organization_id)values
('87410000-0000-4000-8000-000000000001','87200000-0000-4000-8000-000000000001','Alpha Phoenix','APH','00000000-0000-4000-8000-000000000001',1000,540,2950,13350,4,5,'87100000-0000-4000-8000-000000000001'),
('87410000-0000-4000-8000-000000000002','87200000-0000-4000-8000-000000000001','Alpha Wolves','AWO','00000000-0000-4000-8000-000000000002',1000,600,3050,13750,4,5,null),
('87420000-0000-4000-8000-000000000001','87200000-0000-4000-8000-000000000002','Bravo Phoenix','BPH','00000000-0000-4000-8000-000000000001',1000,510,3000,13700,4,5,'87100000-0000-4000-8000-000000000001'),
('87420000-0000-4000-8000-000000000002','87200000-0000-4000-8000-000000000002','Bravo Ravens','BRA','00000000-0000-4000-8000-000000000002',1000,570,3100,14100,4,5,null),
('87430000-0000-4000-8000-000000000001','87200000-0000-4000-8000-000000000003','Charlie Phoenix','CPH','00000000-0000-4000-8000-000000000001',1000,500,3050,14000,4,5,'87100000-0000-4000-8000-000000000001'),
('87430000-0000-4000-8000-000000000002','87200000-0000-4000-8000-000000000003','Charlie Owls','COW','00000000-0000-4000-8000-000000000002',1000,620,3150,14250,4,5,null);

do $$declare ti int;u int;team_no int;tid uuid;team_id uuid;tp uuid;begin
 for ti in 1..3 loop
  tid:=('87200000-0000-4000-8000-'||lpad(ti::text,12,'0'))::uuid;
  for u in 3..10 loop
   team_no:=case when ti=2 and u=3 then 2 when ti=2 and u=7 then 1 when u<=6 then 1 else 2 end;
   team_id:=('874'||ti::text||'0000-0000-4000-8000-'||lpad(team_no::text,12,'0'))::uuid;
   tp:=('873'||ti::text||'0000-0000-4000-8000-'||lpad(u::text,12,'0'))::uuid;
   insert into public.team_roster(tournament_id,team_id,player_id,acquisition_type,purchase_price,tournament_mmr_at_draft,is_active)
   values(tid,team_id,tp,'auction',80+u*10+ti*5,2800+u*100+ti*50,true);
  end loop;
 end loop;
end$$;

insert into public.draft_snapshots(id,tournament_id,tournament_name,tournament_slug,season,rules_version,team_size,starting_credits,completed_at,total_bids,total_auctions,total_sold,total_unsold)values
('87500000-0000-4000-8000-000000000001','87200000-0000-4000-8000-000000000001','Career Cup Alpha','career-cup-alpha','Season One',1,5,1000,'2026-02-01 10:00Z',20,8,8,0),
('87500000-0000-4000-8000-000000000002','87200000-0000-4000-8000-000000000002','Career Cup Bravo','career-cup-bravo','Season One',1,5,1000,'2026-06-01 10:00Z',22,8,8,0),
('87500000-0000-4000-8000-000000000003','87200000-0000-4000-8000-000000000003','Isolation Cup Charlie','isolation-cup-charlie','Season Two',1,5,1000,'2026-09-01 10:00Z',18,8,8,0);
insert into public.draft_team_snapshots(snapshot_id,tournament_id,team_id,team_slug,team_name,team_tag,captain_slug,captain_name,captain_mmr,final_team_mmr,starting_credits,credits_remaining,recruit_count)
select ('87500000-0000-4000-8000-'||right(t.tournament_id::text,12))::uuid,t.tournament_id,t.id,t.public_slug,t.name,t.short_tag,p.public_slug,
 case right(t.tournament_id::text,1) when '1' then 'HistoricCaptainA' when '2' then 'HistoricCaptainB' else 'HistoricCaptainC' end,
 t.captain_mmr,t.current_team_mmr,t.starting_credits,t.credits_remaining,t.roster_size from public.teams t join public.profiles p on p.id=t.captain_user_id where t.tournament_id::text like '87200000-%';
insert into public.draft_player_snapshots(snapshot_id,tournament_id,team_id,player_id,player_slug,ign,primary_role,region,tournament_mmr_at_draft,purchase_price,acquisition_type,bid_count)
select ('87500000-0000-4000-8000-'||right(tr.tournament_id::text,12))::uuid,tr.tournament_id,tr.team_id,tr.player_id,p.public_slug,tp.ign,tp.primary_role,tp.region,tr.tournament_mmr_at_draft,tr.purchase_price,tr.acquisition_type,2
from public.team_roster tr join public.tournament_players tp on tp.id=tr.player_id join public.profiles p on p.id=tp.user_id where tr.tournament_id::text like '87200000-%';

do $$declare ti int;mi int;tid uuid;stage uuid;mid uuid;ta uuid;tb uuid;la uuid;lb uuid;u int;winner uuid;begin
 for ti in 1..3 loop
  tid:=('87200000-0000-4000-8000-'||lpad(ti::text,12,'0'))::uuid;stage:=('876'||ti::text||'0000-0000-4000-8000-000000000001')::uuid;
  insert into public.competition_stages(id,tournament_id,name,stage_type,sequence_number,is_complete)values(stage,tid,'Final Series','grand_final',1,true);
  for mi in 1..(case when ti<3 then 3 else 2 end) loop
   mid:=('877'||ti::text||lpad(mi::text,4,'0')||'-0000-4000-8000-000000000001')::uuid;
   ta:=('874'||ti::text||'0000-0000-4000-8000-000000000001')::uuid;tb:=('874'||ti::text||'0000-0000-4000-8000-000000000002')::uuid;
   winner:=case when (ti+mi)%2=0 then ta else tb end;
   insert into public.matches(id,tournament_id,stage_id,round_number,match_number,team_a_id,team_b_id,best_of,status)
   values(mid,tid,stage,mi,mi,ta,tb,3,'scheduled');
   la:=gen_random_uuid();lb:=gen_random_uuid();
   insert into public.match_lineups(id,match_id,team_id,confirmed_by,locked_at)values(la,mid,ta,'00000000-0000-4000-8000-000000000001',now()),(lb,mid,tb,'00000000-0000-4000-8000-000000000002',now());
   insert into public.match_lineup_players(lineup_id,player_id,player_ign)
   select case when tm.id=ta then la else lb end,tp.id,tp.ign from public.teams tm join public.tournament_players tp on tp.tournament_id=tid
   left join public.team_roster tr on tr.player_id=tp.id and tr.team_id=tm.id and tr.is_active
   where tm.id in(ta,tb)and(tp.user_id=tm.captain_user_id or tr.id is not null);
   update public.matches set status=case when ti=3 and mi=2 then 'forfeit'::public.match_status else 'completed'::public.match_status end,
    team_a_score=case when winner=ta then 2 else 1 end,team_b_score=case when winner=tb then 2 else 1 end,
    winner_team_id=winner,loser_team_id=case when winner=ta then tb else ta end,
    forfeit_team_id=case when ti=3 and mi=2 then case when winner=ta then tb else ta end end,
    forfeit_reason=case when ti=3 and mi=2 then 'Phase 07B rating exclusion fixture' end,
    completed_at=('2026-'||lpad((ti*2)::text,2,'0')||'-0'||mi||' 12:00Z')::timestamptz where id=mid;
  end loop;
 end loop;
end$$;

insert into public.competition_result_snapshots(tournament_id,champion_team_id,runner_up_team_id,settings,standings,matches,created_at)values
('87200000-0000-4000-8000-000000000001','87410000-0000-4000-8000-000000000001','87410000-0000-4000-8000-000000000002','{}','[]','[]','2026-02-04'),
('87200000-0000-4000-8000-000000000002','87420000-0000-4000-8000-000000000002','87420000-0000-4000-8000-000000000001','{}','[]','[]','2026-06-04'),
('87200000-0000-4000-8000-000000000003','87430000-0000-4000-8000-000000000001','87430000-0000-4000-8000-000000000002','{}','[]','[]','2026-09-04');

select public.rebuild_competitive_ratings();
select public.rebuild_achievements();
commit;
