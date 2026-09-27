begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into public.competition_settings(tournament_id,format,configured_by)
values('10000000-0000-4000-8000-000000000001','groups','00000000-0000-4000-8000-000000000001');
insert into public.competition_stages(id,tournament_id,name,stage_type,sequence_number)
values('72000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Five-team group','group',1);
insert into public.competition_groups(id,tournament_id,stage_id,name,sequence_number)
values('72100000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','A',1);
insert into public.competition_group_teams(group_id,team_id,seed)
select '72100000-0000-4000-8000-000000000001',id,row_number()over(order by id) from(select id from public.teams order by id limit 5)t;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(public.generate_competition_schedule('10000000-0000-4000-8000-000000000001',now(),60),10,'five-team group creates ten fixtures');
reset role;
select is((select count(distinct least(team_a_id,team_b_id)::text||greatest(team_a_id,team_b_id)::text)from public.matches),10::bigint,'five-team fixtures are unique');
select is((select count(*)from public.matches where team_a_id=team_b_id),0::bigint,'five-team group has no self match');

delete from public.matches;delete from public.competition_group_teams;delete from public.competition_groups;delete from public.competition_stages;delete from public.competition_settings;
insert into public.competition_settings(tournament_id,format,configured_by)
values('10000000-0000-4000-8000-000000000001','groups','00000000-0000-4000-8000-000000000001');
insert into public.competition_stages(id,tournament_id,name,stage_type,sequence_number)
values('72000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Six-team group','group',1);
insert into public.competition_groups(id,tournament_id,stage_id,name,sequence_number)
values('72100000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000002','A',1);
insert into public.competition_group_teams(group_id,team_id,seed)
select '72100000-0000-4000-8000-000000000002',id,row_number()over(order by id) from(select id from public.teams order by id limit 6)t;
set local role authenticated;
select is(public.generate_competition_schedule('10000000-0000-4000-8000-000000000001',now(),60),15,'six-team group creates fifteen fixtures');
reset role;
select is((select count(distinct least(team_a_id,team_b_id)::text||greatest(team_a_id,team_b_id)::text)from public.matches),15::bigint,'six-team fixtures are unique');
select is((select count(*)from public.matches where team_a_id=team_b_id),0::bigint,'six-team group has no self match');
select is((select count(*)from public.matches where group_id is distinct from '72100000-0000-4000-8000-000000000002'),0::bigint,'six-team fixtures remain group-scoped');
select is((select count(*)from public.matches where team_a_id is null or team_b_id is null),0::bigint,'group fixtures contain both participants');
select is((select count(*)from public.competition_notifications where event_type='MATCH_SCHEDULED'),30::bigint,'each six-team fixture notifies both captains');
select ok(exists(select 1 from public.audit_events where event_type='SCHEDULE_GENERATED'),'group schedule generation is audited');
select is((select count(*)from public.matches where status<>'scheduled'),0::bigint,'new group fixtures start scheduled');
select * from finish();
rollback;
