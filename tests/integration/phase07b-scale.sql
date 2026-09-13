\set ON_ERROR_STOP on
begin;
do $$declare n int;uid uuid;begin for n in 1..1000 loop
 uid:=('99000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
 insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated','scale'||n||'@example.test',crypt('not-used',gen_salt('bf')),now(),'','','','',jsonb_build_object('provider','email'),jsonb_build_object('full_name','Scale Player '||lpad(n::text,4,'0')),now(),now());
end loop;end$$;
insert into public.tournament_players(id,tournament_id,user_id,ign,primary_role,region,tournament_mmr,rating_confidence,rating_status,is_eligible,registration_status)
select ('99100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'87200000-0000-4000-8000-000000000003',('99000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Scale Player '||lpad(n::text,4,'0'),'DPS','EU',2500+(n%1500),'high','locked',true,'approved' from generate_series(1,1000)n;
insert into public.matches(id,tournament_id,stage_id,round_number,match_number,team_a_id,team_b_id,best_of,status,team_a_score,team_b_score,winner_team_id,loser_team_id,completed_at)
select ('99200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'87200000-0000-4000-8000-000000000003','87630000-0000-4000-8000-000000000001',100+n,100+n,'87430000-0000-4000-8000-000000000001','87430000-0000-4000-8000-000000000002',3,'completed',2,0,'87430000-0000-4000-8000-000000000001','87430000-0000-4000-8000-000000000002','2026-10-01'::timestamptz+n*interval'1 minute' from generate_series(1,10)n;
insert into public.player_competitive_ratings(player_id,rating_version,rating,uncertainty,matches_count,wins,losses,status)
select ('99000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'draftgg_rating_v1',900+(n%400),80,10,n%11,10-(n%11),'established' from generate_series(1,1000)n;
insert into public.player_season_ratings(player_id,season_id,rating_version,rating,uncertainty,matches_count,wins,losses,status)
select ('99000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'87000000-0000-4000-8000-000000000002','draftgg_rating_v1',900+(n%400),80,10,n%11,10-(n%11),'established' from generate_series(1,1000)n;
insert into public.competitive_rating_events(player_id,tournament_id,match_id,season_id,rating_version,rating_before,rating_after,uncertainty_before,uncertainty_after,delta,result,processed_at)
select ('99000000-0000-4000-8000-'||lpad(p::text,12,'0'))::uuid,'87200000-0000-4000-8000-000000000003',('99200000-0000-4000-8000-'||lpad(m::text,12,'0'))::uuid,'87000000-0000-4000-8000-000000000002','draftgg_rating_v1',900+(p%400),901+(p%400),100-m,99-m,1,(p+m)%2,'2026-10-01'::timestamptz+m*interval'1 minute'
from generate_series(1,1000)p cross join generate_series(1,10)m;
commit;
