alter type public.match_status add value if not exists 'rematch_ordered' after 'disputed';
alter type public.match_status add value if not exists 'superseded' after 'rematch_ordered';

alter table public.matches
  add column rematch_of_match_id uuid references public.matches(id),
  add column superseded_by_match_id uuid references public.matches(id);
create unique index one_replacement_per_match on public.matches(rematch_of_match_id) where rematch_of_match_id is not null;
create unique index one_superseding_match on public.matches(superseded_by_match_id) where superseded_by_match_id is not null;
create index matches_rematch_history_idx on public.matches(tournament_id,rematch_of_match_id,superseded_by_match_id);

create table public.group_knockout_seed_mappings(
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  source_group_id uuid not null references public.competition_groups(id),
  source_position integer not null check(source_position>0),
  team_id uuid not null references public.teams(id),
  destination_match_id uuid not null references public.matches(id) on delete cascade,
  destination_slot smallint not null check(destination_slot in(1,2)),
  created_at timestamptz not null default now(),
  unique(tournament_id,source_group_id,source_position),
  unique(destination_match_id,destination_slot)
);
alter table public.group_knockout_seed_mappings enable row level security;
create policy group_seed_member_read on public.group_knockout_seed_mappings for select to authenticated using(exists(select 1 from public.tournament_members tm where tm.tournament_id=group_knockout_seed_mappings.tournament_id and tm.user_id=(select auth.uid())and tm.status='active'));
grant select on public.group_knockout_seed_mappings to authenticated;
create view public.public_group_knockout_seeding with(security_invoker=false,security_barrier=true)as select s.tournament_id,s.source_group_id,g.name source_group,s.source_position,s.team_id,t.name team_name,t.short_tag,s.destination_match_id,s.destination_slot from public.group_knockout_seed_mappings s join public.competition_groups g on g.id=s.source_group_id join public.teams t on t.id=s.team_id;
grant select on public.public_group_knockout_seeding to anon,authenticated;

create or replace function public.resolve_match_dispute(p_dispute_id uuid,p_action text,p_team_a_score integer,p_team_b_score integer,p_reason text,p_request_id uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.match_disputes%rowtype;m public.matches%rowtype;v_response jsonb;v_replacement uuid;
begin
  select response into v_response from public.competition_action_requests where request_id=p_request_id;
  if v_response is not null then return v_response;end if;
  select * into d from public.match_disputes where id=p_dispute_id for update;
  if d.id is null then raise exception 'DISPUTE_NOT_FOUND'using errcode='P0001';end if;
  select * into m from public.matches where id=d.match_id for update;
  if not private.is_competition_official(m.tournament_id)then raise exception 'UNAUTHORIZED_REFEREE'using errcode='P0001';end if;
  if d.status='resolved'then select id into v_replacement from public.matches where rematch_of_match_id=m.id;return jsonb_build_object('code','DUPLICATE_REQUEST','replacement_match_id',v_replacement);end if;
  if nullif(trim(p_reason),'')is null then raise exception 'RESOLUTION_REASON_REQUIRED'using errcode='P0001';end if;
  if p_action not in('uphold','change','rematch','cancel')then raise exception 'INVALID_RESOLUTION'using errcode='P0001';end if;
  update public.match_disputes set status='resolved',resolution=p_reason,resolved_by=(select auth.uid()),resolved_at=clock_timestamp()where id=d.id;
  if p_action in('uphold','change')then
    perform private.complete_match(m.id,p_team_a_score,p_team_b_score);
  elsif p_action='cancel'then
    update public.matches set status='cancelled',revision=revision+1 where id=m.id;
  else
    insert into public.matches(tournament_id,stage_id,group_id,round_number,match_number,team_a_id,team_b_id,scheduled_at,best_of,status,check_in_opens_at,check_in_deadline,lobby_region,next_match_id,next_match_slot,rematch_of_match_id)
    values(m.tournament_id,m.stage_id,m.group_id,m.round_number,(select coalesce(max(match_number),0)+1 from public.matches where stage_id=m.stage_id and round_number=m.round_number),m.team_a_id,m.team_b_id,coalesce(m.scheduled_at,clock_timestamp())+interval'1 hour',m.best_of,'scheduled',coalesce(m.scheduled_at,clock_timestamp())+interval'30 minutes',coalesce(m.scheduled_at,clock_timestamp())+interval'70 minutes',m.lobby_region,m.next_match_id,m.next_match_slot,m.id)returning id into v_replacement;
    update public.matches set status='rematch_ordered',superseded_by_match_id=v_replacement,next_match_id=null,next_match_slot=null,revision=revision+1 where id=m.id;
    perform private.audit_match(m.id,'REMATCH_ORDERED',jsonb_build_object('replacement_match_id',v_replacement,'reason',p_reason));
    perform private.audit_match(v_replacement,'REMATCH_CREATED',jsonb_build_object('original_match_id',m.id,'reason',p_reason));
  end if;
  perform private.audit_match(m.id,'DISPUTE_RESOLVED',jsonb_build_object('action',p_action,'reason',p_reason,'replacement_match_id',v_replacement));
  v_response:=jsonb_build_object('code','DISPUTE_RESOLVED','replacement_match_id',v_replacement);
  insert into public.competition_action_requests(request_id,action,match_id,response)values(p_request_id,'resolve_dispute',m.id,v_response);
  return v_response;
end$$;
revoke all on function public.resolve_match_dispute(uuid,text,integer,integer,text,uuid)from public,anon;
grant execute on function public.resolve_match_dispute(uuid,text,integer,integer,text,uuid)to authenticated;

create function private.supersede_original_after_rematch()returns trigger language plpgsql security definer set search_path='' as $$begin if new.rematch_of_match_id is not null and new.status in('completed','forfeit')and old.status not in('completed','forfeit')then update public.matches set status='superseded',revision=revision+1 where id=new.rematch_of_match_id and superseded_by_match_id=new.id and status='rematch_ordered';perform private.audit_match(new.rematch_of_match_id,'MATCH_SUPERSEDED',jsonb_build_object('replacement_match_id',new.id));end if;return new;end$$;
create trigger supersede_original_on_replacement_completion after update of status on public.matches for each row execute function private.supersede_original_after_rematch();
revoke all on function private.supersede_original_after_rematch()from public,anon,authenticated;

create or replace function public.advance_groups_to_knockout(p_tournament_id uuid,p_scheduled_start timestamptz default null,p_interval_minutes integer default 60)returns integer language plpgsql security definer set search_path='' as $$
declare v_top int;v_group_count int;v_qualifiers uuid[];v_count int;v_boundary bigint[];grp record;
begin
  if not public.is_tournament_role(p_tournament_id,'organizer')then raise exception 'UNAUTHORIZED_REFEREE'using errcode='P0001';end if;
  perform pg_advisory_xact_lock(hashtextextended('group-advance:'||p_tournament_id::text,0));
  if exists(select 1 from public.group_advancement_results where tournament_id=p_tournament_id)then return(select count(*)::int from public.group_advancement_results where tournament_id=p_tournament_id);end if;
  if exists(select 1 from public.matches where tournament_id=p_tournament_id and group_id is not null and status not in('completed','forfeit'))then raise exception 'GROUP_STAGE_INCOMPLETE'using errcode='P0001';end if;
  select advance_per_group into v_top from public.competition_settings where tournament_id=p_tournament_id;
  select count(*)into v_group_count from public.competition_groups where tournament_id=p_tournament_id;
  for grp in select cg.id from public.competition_groups cg where cg.tournament_id=p_tournament_id order by cg.sequence_number loop select sort_key into v_boundary from public.public_competition_rankings where group_id=grp.id order by position offset v_top-1 limit 1;if v_boundary is null or exists(select 1 from public.public_competition_rankings where group_id=grp.id and sort_key=v_boundary and position>v_top)then raise exception 'TIEBREAK_REQUIRED'using errcode='P0001';end if;end loop;
  insert into public.group_advancement_results(tournament_id,group_id,team_id,group_position,knockout_seed)
  select p_tournament_id,r.group_id,r.team_id,r.position,row_number()over(order by r.position,cg.sequence_number)::int from public.public_competition_rankings r join public.competition_groups cg on cg.id=r.group_id where r.tournament_id=p_tournament_id and r.position<=v_top order by r.position,cg.sequence_number;
  if v_group_count=2 and v_top=2 then
    select array_agg(team_id order by seed_order)into v_qualifiers from(select a.team_id,case when g.sequence_number=1 and a.group_position=1 then 1 when g.sequence_number=2 and a.group_position=2 then 2 when g.sequence_number=2 and a.group_position=1 then 3 else 4 end seed_order from public.group_advancement_results a join public.competition_groups g on g.id=a.group_id where a.tournament_id=p_tournament_id)x;
  else select array_agg(team_id order by knockout_seed)into v_qualifiers from public.group_advancement_results where tournament_id=p_tournament_id;end if;
  v_count:=private.build_single_elimination(p_tournament_id,v_qualifiers,p_scheduled_start,p_interval_minutes,'Group Knockout');
  insert into public.group_knockout_seed_mappings(tournament_id,source_group_id,source_position,team_id,destination_match_id,destination_slot)
  select p_tournament_id,a.group_id,a.group_position,a.team_id,m.id,case when m.team_a_id=a.team_id then 1 else 2 end from public.group_advancement_results a join public.matches m on m.tournament_id=p_tournament_id and m.group_id is null and m.round_number=1 and a.team_id in(m.team_a_id,m.team_b_id)where a.tournament_id=p_tournament_id;
  insert into public.audit_events(tournament_id,actor_user_id,event_type,entity_type,entity_id,payload)values(p_tournament_id,(select auth.uid()),'GROUP_ADVANCEMENT_CONFIRMED','tournament',p_tournament_id,jsonb_build_object('qualifiers',v_qualifiers,'matches',v_count));
  return cardinality(v_qualifiers);
end$$;

create or replace view public.public_matches with(security_invoker=false,security_barrier=true)as select m.id,m.tournament_id,m.stage_id,m.group_id,m.round_number,m.match_number,m.team_a_id,m.team_b_id,m.scheduled_at,m.best_of,m.status,m.winner_team_id,m.team_a_score,m.team_b_score,m.started_at,m.completed_at,m.forfeit_team_id,s.name stage_name,s.stage_type,g.name group_name,a.name team_a_name,a.short_tag team_a_tag,b.name team_b_name,b.short_tag team_b_tag,w.name winner_name,m.rematch_of_match_id,m.superseded_by_match_id from public.matches m join public.tournaments t on t.id=m.tournament_id join public.competition_stages s on s.id=m.stage_id left join public.competition_groups g on g.id=m.group_id left join public.teams a on a.id=m.team_a_id left join public.teams b on b.id=m.team_b_id left join public.teams w on w.id=m.winner_team_id where t.status not in('draft','cancelled');
grant select on public.public_matches to anon,authenticated;

-- Historical originals become immutable as soon as a rematch is ordered. Only
-- the replacement may complete and advance the bracket.
create or replace function private.complete_match(p_match_id uuid,p_a integer,p_b integer,p_status public.match_status default 'completed') returns void language plpgsql security definer set search_path='' as $$declare m public.matches%rowtype;v_winner uuid;begin select * into m from public.matches where id=p_match_id for update;if m.status in('completed','forfeit','cancelled','rematch_ordered','superseded') then raise exception 'MATCH_ALREADY_COMPLETED' using errcode='P0001';end if;if exists(select 1 from public.match_disputes where match_id=p_match_id and status='open') then raise exception 'UNRESOLVED_DISPUTE' using errcode='P0001';end if;v_winner:=private.validate_match_score(m,p_a,p_b);update public.matches set status=p_status,team_a_score=p_a,team_b_score=p_b,winner_team_id=v_winner,loser_team_id=case when v_winner=team_a_id then team_b_id else team_a_id end,completed_at=clock_timestamp(),revision=revision+1 where id=p_match_id;update public.match_lineups set locked_at=clock_timestamp() where match_id=p_match_id;perform private.audit_match(p_match_id,'MATCH_COMPLETED',jsonb_build_object('winner_team_id',v_winner));perform private.advance_bracket(p_match_id);end$$;

-- Superseded originals are terminal history. A merely rematch-ordered original
-- remains non-terminal until its replacement completes and supersedes it.
create or replace function public.complete_competition(p_tournament_id uuid)returns uuid language plpgsql security definer set search_path='' as $$declare v_format public.competition_format;v_champion uuid;v_runner uuid;v_final public.matches%rowtype;begin if not public.is_tournament_role(p_tournament_id,'organizer')then raise exception 'UNAUTHORIZED_REFEREE'using errcode='P0001';end if;select format into v_format from public.competition_settings where tournament_id=p_tournament_id;if v_format is null then raise exception 'COMPETITION_NOT_CONFIGURED'using errcode='P0001';end if;if exists(select 1 from public.matches where tournament_id=p_tournament_id and status not in('completed','forfeit','cancelled','superseded'))or exists(select 1 from public.match_disputes d join public.matches m on m.id=d.match_id where m.tournament_id=p_tournament_id and d.status='open')then raise exception 'COMPETITION_INCOMPLETE'using errcode='P0001';end if;if v_format='groups'and exists(select 1 from public.public_competition_rankings where tournament_id=p_tournament_id and tiebreak_required)then raise exception 'TIEBREAK_REQUIRED'using errcode='P0001';end if;if v_format in('single_elimination','groups')and exists(select 1 from public.competition_stages where tournament_id=p_tournament_id and stage_type='knockout')then select * into v_final from public.matches where tournament_id=p_tournament_id and stage_id=(select id from public.competition_stages where tournament_id=p_tournament_id and stage_type='knockout'order by sequence_number desc limit 1)and next_match_id is null order by round_number desc,match_number desc limit 1;if v_final.id is null or v_final.status not in('completed','forfeit')or v_final.winner_team_id is null then raise exception 'COMPETITION_INCOMPLETE'using errcode='P0001';end if;v_champion:=v_final.winner_team_id;v_runner:=v_final.loser_team_id;else select team_id into v_champion from public.public_competition_rankings where tournament_id=p_tournament_id order by group_id nulls first,position limit 1;select team_id into v_runner from public.public_competition_rankings where tournament_id=p_tournament_id order by group_id nulls first,position offset 1 limit 1;end if;if v_champion is null then raise exception 'COMPETITION_INCOMPLETE'using errcode='P0001';end if;insert into public.competition_result_snapshots(tournament_id,champion_team_id,runner_up_team_id,settings,standings,matches)select p_tournament_id,v_champion,v_runner,to_jsonb(s),coalesce((select jsonb_agg(to_jsonb(x)order by group_id,position)from public.public_competition_rankings x where x.tournament_id=p_tournament_id),'[]'),coalesce((select jsonb_agg(to_jsonb(x)order by round_number,match_number)from public.public_matches x where x.tournament_id=p_tournament_id),'[]')from public.competition_settings s where s.tournament_id=p_tournament_id on conflict(tournament_id)do nothing;update public.tournaments set status='completed'where id=p_tournament_id;insert into public.audit_events(tournament_id,actor_user_id,event_type,entity_type,entity_id,payload)values(p_tournament_id,(select auth.uid()),'COMPETITION_COMPLETED','tournament',p_tournament_id,jsonb_build_object('champion_team_id',v_champion,'runner_up_team_id',v_runner))on conflict do nothing;return p_tournament_id;end$$;
