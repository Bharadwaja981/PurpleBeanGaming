-- Development-only deterministic identities. Never use in production.
do $$
declare i int; uid uuid;
begin
  for i in 1..30 loop
    uid := ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated','player'||i||'@draftgg.test',crypt('development-only',gen_salt('bf')),now(),'','','','',jsonb_build_object('provider','email','providers',jsonb_build_array('email')),jsonb_build_object('full_name','Test Player '||i),now(),now()) on conflict(id) do nothing;
    insert into auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    values(uid::text,uid,jsonb_build_object('sub',uid::text,'email','player'||i||'@draftgg.test','email_verified',true),'email',now(),now(),now())
    on conflict(provider_id,provider) do nothing;
  end loop;
end $$;

insert into tournaments(id,name,slug,season,status,created_by)
values('10000000-0000-4000-8000-000000000001','Purple Bean Test Cup','draftgg-test-cup','Development 2026','player_pool_locked','00000000-0000-4000-8000-000000000001') on conflict do nothing;

insert into tournament_members(id,tournament_id,user_id,status)
select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001',('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'active' from generate_series(1,30)n on conflict do nothing;
insert into tournament_member_roles(member_id,role) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n<=6 then 'captain'::tournament_role else 'player'::tournament_role end from generate_series(1,30)n on conflict do nothing;
insert into tournament_member_roles(member_id,role) values('20000000-0000-4000-8000-000000000001','organizer') on conflict do nothing;
insert into tournament_players(id,tournament_id,user_id,ign,primary_role,region,declared_mmr,verified_mmr,tournament_mmr,rating_confidence,rating_status,is_eligible,registration_status)
select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001',('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'TestPlayer'||lpad(n::text,2,'0'),(array['Tank','Support','DPS'])[(n%3)+1],'EU',2000+n*50,2000+n*50,2000+n*50,'high','locked',true,'approved' from generate_series(1,30)n on conflict do nothing;
insert into teams(id,tournament_id,name,short_tag,captain_user_id,starting_credits,credits_remaining,captain_mmr,current_team_mmr,max_roster_size,confirmation_status,confirmed_at,confirmed_by)
select ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001','Test Team '||n,'T'||n,('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,1000,1000,2000+n*50,2000+n*50,5,'confirmed',now(),('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,6)n on conflict do nothing;
insert into tournament_rules(tournament_id,team_size,starting_credits,minimum_bid,bid_increment,initial_bid_seconds,anti_snipe_threshold_seconds,anti_snipe_extension_seconds,mmr_target,mmr_min,mmr_max,nomination_seconds,replacement_mmr_tolerance)
values('10000000-0000-4000-8000-000000000001',5,1000,10,5,30,5,10,14000,12000,15000,30,200) on conflict do nothing;
insert into nomination_order(tournament_id,round_number,position,team_id)
select '10000000-0000-4000-8000-000000000001',r,n,('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,4)r cross join generate_series(1,6)n on conflict do nothing;

-- Local development bootstrap only. Production role bootstrap is an explicit service-role operation.
insert into platform_admins(user_id,role,status,granted_by)values
('00000000-0000-4000-8000-000000000001','super_admin','active','00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000002','platform_moderator','active','00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000003','support_agent','active','00000000-0000-4000-8000-000000000001') on conflict(user_id)do nothing;
