-- Phase 04: exact global draft feasibility and unsold-round state.

create type public.player_draft_state as enum ('available','in_auction','unsold','reentered','sold','withdrawn');
alter table public.tournament_players add column draft_state public.player_draft_state not null default 'available';
update public.tournament_players set draft_state=case when is_drafted then 'sold'::public.player_draft_state else 'available'::public.player_draft_state end;
alter table public.tournament_rules add column required_roles text[] not null default '{}';
alter table public.tournament_rules add constraint required_roles_when_enforced check (not roles_enforced or cardinality(required_roles)>0);

create table public.unsold_rounds(
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number integer not null check(round_number>0),
  status text not null check(status in ('pending','open','completed','cancelled')) default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(tournament_id,round_number)
);
alter table public.unsold_rounds enable row level security;
create policy unsold_round_member_read on public.unsold_rounds for select to authenticated using (
  exists(select 1 from public.tournament_members m where m.tournament_id=unsold_rounds.tournament_id and m.user_id=(select auth.uid()) and m.status='active')
);
grant select on public.unsold_rounds to authenticated;
revoke insert,update,delete on public.unsold_rounds from authenticated;

create index tournament_players_draft_state_idx on public.tournament_players(tournament_id,draft_state,is_eligible,is_active);

create function private.feasibility_dfs(
  p_team_index integer,
  p_team_mmrs integer[],
  p_team_slots integer[],
  p_mmr_min integer,
  p_mmr_max integer,
  p_player_mmrs integer[],
  p_player_roles text[],
  p_used_mask bigint,
  p_team_roles jsonb,
  p_required_roles text[]
) returns boolean language plpgsql immutable set search_path='' as $$
declare
  v_team_count integer:=coalesce(array_length(p_team_slots,1),0);
  v_player_count integer:=coalesce(array_length(p_player_mmrs,1),0);
  v_candidate record;v_roles jsonb;v_combined_roles jsonb;
begin
  if p_team_index>v_team_count then return true; end if;
  if p_team_slots[p_team_index]=0 then
    if p_team_mmrs[p_team_index] not between p_mmr_min and p_mmr_max then return false; end if;
    return private.feasibility_dfs(p_team_index+1,p_team_mmrs,p_team_slots,p_mmr_min,p_mmr_max,p_player_mmrs,p_player_roles,p_used_mask,p_team_roles,p_required_roles);
  end if;
  for v_candidate in
    with recursive combinations(last_i,picked,total_mmr,mask,roles) as (
      select 0,0,0,0::bigint,'[]'::jsonb
      union all
      select i,picked+1,total_mmr+p_player_mmrs[i],mask|(1::bigint<<(i-1)),roles||case when p_player_roles[i] is null then '[]'::jsonb else to_jsonb(p_player_roles[i]) end
      from combinations c cross join lateral generate_series(c.last_i+1,v_player_count) i
      where c.picked<p_team_slots[p_team_index] and (p_used_mask&(1::bigint<<(i-1)))=0
    )
    select mask,total_mmr,roles from combinations
    where picked=p_team_slots[p_team_index]
      and p_team_mmrs[p_team_index]+total_mmr between p_mmr_min and p_mmr_max
    order by abs((p_team_mmrs[p_team_index]+total_mmr)-((p_mmr_min+p_mmr_max)/2)),mask
  loop
    v_combined_roles:=coalesce(p_team_roles->(p_team_index-1),'[]'::jsonb)||v_candidate.roles;
    if cardinality(p_required_roles)>0 and exists(select 1 from unnest(p_required_roles) r where not (v_combined_roles ? r)) then continue; end if;
    v_roles:=jsonb_set(p_team_roles,array[(p_team_index-1)::text],v_combined_roles);
    if private.feasibility_dfs(p_team_index+1,p_team_mmrs,p_team_slots,p_mmr_min,p_mmr_max,p_player_mmrs,p_player_roles,p_used_mask|v_candidate.mask,v_roles,p_required_roles) then return true; end if;
  end loop;
  return false;
end$$;
revoke all on function private.feasibility_dfs(integer,integer[],integer[],integer,integer,integer[],text[],bigint,jsonb,text[]) from public,anon,authenticated;

create function private.evaluate_draft_feasibility(
  p_tournament_id uuid,
  p_award_team_id uuid default null,
  p_award_player_id uuid default null,
  p_proposed_bid integer default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_rules public.tournament_rules%rowtype;v_team_ids uuid[];v_mmrs integer[];v_slots integer[];
  v_player_ids uuid[];v_player_mmrs integer[];v_player_roles text[];v_team_roles jsonb;
  v_team_idx integer;v_player_idx integer;v_total_slots integer;v_feasible boolean;v_code text:='FEASIBLE';
  v_team_count integer;v_current_total bigint;v_low_total bigint;v_high_total bigint;
begin
  select * into v_rules from public.tournament_rules where tournament_id=p_tournament_id;
  if v_rules.tournament_id is null then return jsonb_build_object('feasible',false,'code','RULES_MISSING'); end if;
  select array_agg(id order by greatest(v_rules.team_size-1-roster_size,0),id),array_agg(current_team_mmr order by greatest(v_rules.team_size-1-roster_size,0),id),array_agg(greatest(v_rules.team_size-1-roster_size,0) order by greatest(v_rules.team_size-1-roster_size,0),id)
    into v_team_ids,v_mmrs,v_slots from public.teams where tournament_id=p_tournament_id;
  v_total_slots:=(select coalesce(sum(x),0) from unnest(v_slots) x);
  if exists(select 1 from public.teams where tournament_id=p_tournament_id and credits_remaining<greatest(v_rules.team_size-1-roster_size,0)*v_rules.minimum_bid) then
    return jsonb_build_object('feasible',false,'code','INSUFFICIENT_REMAINING_CREDITS');
  end if;
  select array_agg(p.id order by p.tournament_mmr,p.id),array_agg(p.tournament_mmr order by p.tournament_mmr,p.id),array_agg(p.primary_role order by p.tournament_mmr,p.id)
    into v_player_ids,v_player_mmrs,v_player_roles
    from public.tournament_players p
    where p.tournament_id=p_tournament_id and p.is_active and p.is_eligible and not p.is_reserve and not p.is_drafted
      and (p.draft_state not in ('sold','withdrawn','in_auction') or p.id=p_award_player_id)
      and not exists(select 1 from public.teams tm where tm.tournament_id=p_tournament_id and tm.captain_user_id=p.user_id);
  if coalesce(array_length(v_player_ids,1),0)<v_total_slots then return jsonb_build_object('feasible',false,'code','INSUFFICIENT_REMAINING_PLAYERS'); end if;
  v_team_count:=coalesce(array_length(v_team_ids,1),0);
  select coalesce(sum(x),0) into v_current_total from unnest(v_mmrs) x;
  select coalesce(sum(mmr),0) into v_low_total from (select unnest(v_player_mmrs) mmr order by mmr limit v_total_slots) q;
  select coalesce(sum(mmr),0) into v_high_total from (select unnest(v_player_mmrs) mmr order by mmr desc limit v_total_slots) q;
  if v_current_total+v_low_total>v_team_count*coalesce(v_rules.mmr_max,2147483647)::bigint then return jsonb_build_object('feasible',false,'code','GLOBAL_MMR_EXCEEDS_MAXIMUM'); end if;
  if v_current_total+v_high_total<v_team_count*coalesce(v_rules.mmr_min,0)::bigint then return jsonb_build_object('feasible',false,'code','GLOBAL_MMR_CANNOT_REACH_MINIMUM'); end if;

  v_team_roles:=(select jsonb_agg(coalesce(roles,'[]'::jsonb) order by ord) from (
    select u.ord,coalesce((select jsonb_agg(role) from (
      select p.primary_role role from public.teams tm join public.tournament_players p on p.tournament_id=tm.tournament_id and p.user_id=tm.captain_user_id where tm.id=u.id
      union all select p.primary_role from public.team_roster tr join public.tournament_players p on p.id=tr.player_id where tr.team_id=u.id and tr.is_active
    ) r where role is not null),'[]'::jsonb) roles from unnest(v_team_ids) with ordinality u(id,ord)
  ) z);

  if p_award_team_id is not null then
    v_team_idx:=array_position(v_team_ids,p_award_team_id);v_player_idx:=array_position(v_player_ids,p_award_player_id);
    if v_team_idx is null or v_player_idx is null then return jsonb_build_object('feasible',false,'code','PLAYER_OR_TEAM_UNAVAILABLE'); end if;
    if v_slots[v_team_idx]<=0 then return jsonb_build_object('feasible',false,'code','ROSTER_FULL'); end if;
    if p_proposed_bid is not null and (select credits_remaining from public.teams where id=p_award_team_id)-p_proposed_bid < (v_slots[v_team_idx]-1)*v_rules.minimum_bid then return jsonb_build_object('feasible',false,'code','INSUFFICIENT_REMAINING_CREDITS'); end if;
    v_mmrs[v_team_idx]:=v_mmrs[v_team_idx]+v_player_mmrs[v_player_idx];v_slots[v_team_idx]:=v_slots[v_team_idx]-1;
    if v_mmrs[v_team_idx]>v_rules.mmr_max then return jsonb_build_object('feasible',false,'code','TEAM_WOULD_EXCEED_MAX_MMR'); end if;
    v_team_roles:=jsonb_set(v_team_roles,array[(v_team_idx-1)::text],coalesce(v_team_roles->(v_team_idx-1),'[]'::jsonb)||to_jsonb(v_player_roles[v_player_idx]));
    v_player_ids:=v_player_ids[1:v_player_idx-1]||v_player_ids[v_player_idx+1:array_length(v_player_ids,1)];
    v_player_mmrs:=v_player_mmrs[1:v_player_idx-1]||v_player_mmrs[v_player_idx+1:array_length(v_player_mmrs,1)];
    v_player_roles:=v_player_roles[1:v_player_idx-1]||v_player_roles[v_player_idx+1:array_length(v_player_roles,1)];
  end if;
  if exists(select 1 from generate_subscripts(v_slots,1) i where v_mmrs[i] + v_slots[i]*(select max(x) from unnest(v_player_mmrs)x)<v_rules.mmr_min) then return jsonb_build_object('feasible',false,'code','TEAM_CANNOT_REACH_MIN_MMR'); end if;
  if coalesce(array_length(v_player_mmrs,1),0)>63 then return jsonb_build_object('feasible',false,'code','SOLVER_SCALE_LIMIT'); end if;
  v_feasible:=private.feasibility_dfs(1,v_mmrs,v_slots,coalesce(v_rules.mmr_min,0),coalesce(v_rules.mmr_max,2147483647),v_player_mmrs,v_player_roles,0::bigint,v_team_roles,case when v_rules.roles_enforced then v_rules.required_roles else '{}'::text[] end);
  if not v_feasible then v_code:=case when v_rules.roles_enforced then 'ROLE_COMPLETION_IMPOSSIBLE' else 'DRAFT_WOULD_BECOME_IMPOSSIBLE' end;end if;
  return jsonb_build_object('feasible',v_feasible,'code',v_code,'remaining_slots',v_total_slots,'remaining_players',coalesce(array_length(v_player_ids,1),0));
end$$;
revoke all on function private.evaluate_draft_feasibility(uuid,uuid,uuid,integer) from public,anon,authenticated;

create function public.is_draft_state_feasible(p_tournament_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_tournament_role(p_tournament_id,'organizer') then raise exception 'forbidden' using errcode='42501';end if;
  return private.evaluate_draft_feasibility(p_tournament_id);
end$$;

create function public.check_award_feasibility(p_tournament_id uuid,p_team_id uuid,p_player_id uuid,p_proposed_bid integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_tournament_role(p_tournament_id,'organizer') and not exists(select 1 from public.teams where id=p_team_id and tournament_id=p_tournament_id and captain_user_id=(select auth.uid())) then raise exception 'forbidden' using errcode='42501';end if;
  return private.evaluate_draft_feasibility(p_tournament_id,p_team_id,p_player_id,p_proposed_bid);
end$$;

revoke all on function public.is_draft_state_feasible(uuid),public.check_award_feasibility(uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.is_draft_state_feasible(uuid),public.check_award_feasibility(uuid,uuid,uuid,integer) to authenticated;

create function private.sync_player_draft_state() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' and new.status in ('pending','open','paused') then
    update public.tournament_players set draft_state='in_auction' where id=new.player_id and not is_drafted;
  elsif tg_op='UPDATE' and new.status is distinct from old.status then
    if new.status='sold' then update public.tournament_players set draft_state='sold' where id=new.player_id;
    elsif new.status='unsold' then update public.tournament_players set draft_state='unsold' where id=new.player_id and not is_drafted;
    elsif new.status in ('cancelled','reversed') then update public.tournament_players set draft_state='available' where id=new.player_id and not is_drafted;
    end if;
  end if;
  return new;
end$$;
create trigger sync_player_draft_state after insert or update of status on public.auctions for each row execute function private.sync_player_draft_state();
revoke all on function private.sync_player_draft_state() from public,anon,authenticated;

alter function public.place_bid(uuid,bigint,uuid,public.bid_increment_type) rename to place_bid_phase03;
revoke all on function public.place_bid_phase03(uuid,bigint,uuid,public.bid_increment_type) from public,anon,authenticated;

create function public.place_bid(p_auction_id uuid,p_expected_revision bigint,p_request_id uuid,p_increment_type public.bid_increment_type)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;v_feasibility jsonb;v_auction public.auctions%rowtype;v_team public.teams%rowtype;v_rules public.tournament_rules%rowtype;v_detail text;
begin
  select * into v_auction from public.auctions where id=p_auction_id;
  if v_auction.id is null then raise exception 'auction not found';end if;
  select * into v_team from public.teams where tournament_id=v_auction.tournament_id and captain_user_id=(select auth.uid());
  if v_team.id is not null then
    select * into v_rules from public.tournament_rules where tournament_id=v_auction.tournament_id;
    if v_team.roster_size>=v_rules.team_size-1 then return private.record_rejected_bid(v_auction,v_team,p_request_id,p_expected_revision,coalesce(v_auction.current_bid,v_auction.opening_bid),'ROSTER_FULL');end if;
  end if;
  begin
    v_result:=public.place_bid_phase03(p_auction_id,p_expected_revision,p_request_id,p_increment_type);
    if coalesce((v_result->>'ok')::boolean,false) and not coalesce((v_result->>'duplicate')::boolean,false) then
      v_feasibility:=private.evaluate_draft_feasibility(v_auction.tournament_id,v_team.id,v_auction.player_id,(v_result->>'amount')::integer);
      if not (v_feasibility->>'feasible')::boolean then
        raise exception 'feasibility rejection' using errcode='P0400',detail=v_feasibility->>'code';
      end if;
    end if;
    return v_result || jsonb_build_object('feasibility',coalesce(v_feasibility,jsonb_build_object('feasible',true,'code','NOT_EVALUATED')));
  exception when sqlstate 'P0400' then
    get stacked diagnostics v_detail = pg_exception_detail;
    select * into v_auction from public.auctions where id=p_auction_id for update;
    select * into v_team from public.teams where tournament_id=v_auction.tournament_id and captain_user_id=(select auth.uid()) for update;
    perform private.audit(v_auction.tournament_id,'BID_BLOCKED_BY_FEASIBILITY','auction',v_auction.id,jsonb_build_object('team_id',v_team.id,'player_id',v_auction.player_id,'reason',sqlerrm,'code',v_detail));
    return private.record_rejected_bid(v_auction,v_team,p_request_id,p_expected_revision,coalesce((v_result->>'amount')::integer,v_auction.opening_bid),coalesce(v_detail,'DRAFT_WOULD_BECOME_IMPOSSIBLE'));
  end;
end$$;
revoke all on function public.place_bid(uuid,bigint,uuid,public.bid_increment_type) from public,anon;
grant execute on function public.place_bid(uuid,bigint,uuid,public.bid_increment_type) to authenticated;

alter function public.finalize_auction(uuid) rename to finalize_auction_phase03;
revoke all on function public.finalize_auction_phase03(uuid) from public,anon,authenticated;
create function public.finalize_auction(p_auction_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_auction public.auctions%rowtype;v_team public.teams%rowtype;v_rules public.tournament_rules%rowtype;v_check jsonb;
begin
  select * into v_auction from public.auctions where id=p_auction_id for update;
  if v_auction.id is null then raise exception 'auction not found';end if;
  if v_auction.status in ('sold','unsold') then return public.finalize_auction_phase03(p_auction_id);end if;
  if v_auction.leading_team_id is not null then
    select * into v_team from public.teams where id=v_auction.leading_team_id for update;
    select * into v_rules from public.tournament_rules where tournament_id=v_auction.tournament_id;
    if v_team.roster_size>=v_rules.team_size-1 then v_check:=jsonb_build_object('feasible',false,'code','ROSTER_FULL');
    else v_check:=private.evaluate_draft_feasibility(v_auction.tournament_id,v_team.id,v_auction.player_id,v_auction.current_bid);end if;
    if not (v_check->>'feasible')::boolean then
      update public.auctions set status='paused',paused_remaining_seconds=0 where id=v_auction.id;
      update public.tournaments set status='auction_paused' where id=v_auction.tournament_id;
      perform private.audit(v_auction.tournament_id,'FINALIZATION_BLOCKED_BY_FEASIBILITY','auction',v_auction.id,v_check);
      return jsonb_build_object('ok',false,'code',v_check->>'code','status','paused','auction_id',v_auction.id);
    end if;
  end if;
  return public.finalize_auction_phase03(p_auction_id);
end$$;
revoke all on function public.finalize_auction(uuid) from public,anon;
grant execute on function public.finalize_auction(uuid) to authenticated;

alter function public.start_auction(uuid) rename to start_auction_phase03;
revoke all on function public.start_auction_phase03(uuid) from public,anon,authenticated;

create function public.validate_draft_configuration(p_tournament_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_check jsonb;v_diagnostics jsonb:='[]'::jsonb;v_pass boolean:=true;v_rules public.tournament_rules%rowtype;v_players integer;v_teams integer;v_captains integer;
begin
  if not public.is_tournament_role(p_tournament_id,'organizer') then raise exception 'forbidden' using errcode='42501';end if;
  select * into v_rules from public.tournament_rules where tournament_id=p_tournament_id;
  select count(*) into v_teams from public.teams where tournament_id=p_tournament_id;
  select count(*) into v_players from public.tournament_players where tournament_id=p_tournament_id and is_active and is_eligible and not is_reserve;
  select count(*) into v_captains from public.teams where tournament_id=p_tournament_id and confirmation_status='confirmed' and captain_user_id is not null;
  if not exists(select 1 from public.tournaments where id=p_tournament_id and status in ('player_pool_locked','auction_ready')) then v_pass:=false;v_diagnostics:=v_diagnostics||'"PLAYER_POOL_NOT_LOCKED"'::jsonb;end if;
  if v_teams<2 then v_pass:=false;v_diagnostics:=v_diagnostics||'"INVALID_TEAM_COUNT"'::jsonb;end if;
  if v_captains<>v_teams then v_pass:=false;v_diagnostics:=v_diagnostics||'"CAPTAINS_NOT_CONFIRMED"'::jsonb;end if;
  if v_players < v_teams*v_rules.team_size then v_pass:=false;v_diagnostics:=v_diagnostics||'"INSUFFICIENT_REMAINING_PLAYERS"'::jsonb;end if;
  if exists(select 1 from public.tournament_players where tournament_id=p_tournament_id and is_active and is_eligible and tournament_mmr is null) then v_pass:=false;v_diagnostics:=v_diagnostics||'"UNLOCKED_TOURNAMENT_MMR"'::jsonb;end if;
  if exists(select 1 from public.appeals where tournament_id=p_tournament_id and status in ('submitted','under_review')) then v_pass:=false;v_diagnostics:=v_diagnostics||'"BLOCKING_APPEALS"'::jsonb;end if;
  if exists(select 1 from public.team_roster where tournament_id=p_tournament_id and is_active group by player_id having count(*)>1) then v_pass:=false;v_diagnostics:=v_diagnostics||'"DUPLICATE_ROSTER_ASSIGNMENT"'::jsonb;end if;
  if v_pass then v_check:=private.evaluate_draft_feasibility(p_tournament_id);v_pass:=(v_check->>'feasible')::boolean;if not v_pass then v_diagnostics:=v_diagnostics||to_jsonb(v_check->>'code');end if;end if;
  perform private.audit(p_tournament_id,case when v_pass then 'DRAFT_CERTIFICATION_PASSED' else 'DRAFT_CERTIFICATION_FAILED' end,'tournament',p_tournament_id,jsonb_build_object('diagnostics',v_diagnostics,'captains',v_captains,'teams',v_teams,'eligible_players',v_players,'required_recruits',v_teams*(v_rules.team_size-1)));
  return jsonb_build_object('ready',v_pass,'diagnostics',v_diagnostics,'players_locked',not exists(select 1 from public.tournament_players where tournament_id=p_tournament_id and is_eligible and rating_status<>'locked'),'captains_confirmed',v_captains=v_teams,'mmr_rules_valid',v_rules.mmr_min<=v_rules.mmr_max,'credit_rules_valid',not exists(select 1 from public.teams where tournament_id=p_tournament_id and credits_remaining<(v_rules.team_size-1-roster_size)*v_rules.minimum_bid),'complete_assignment_exists',coalesce((v_check->>'feasible')::boolean,false),'feasibility_solver_healthy',v_check is not null,'captain_count',v_captains,'recruit_slots',v_teams*(v_rules.team_size-1));
end$$;

create function public.start_auction(p_tournament_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_cert jsonb;
begin
  v_cert:=public.validate_draft_configuration(p_tournament_id);
  if not (v_cert->>'ready')::boolean then raise exception 'draft configuration is not certified' using errcode='P0001',detail=v_cert::text;end if;
  return public.start_auction_phase03(p_tournament_id)||jsonb_build_object('certification',v_cert);
end$$;
revoke all on function public.validate_draft_configuration(uuid),public.start_auction(uuid) from public,anon;
grant execute on function public.validate_draft_configuration(uuid),public.start_auction(uuid) to authenticated;

-- Candidate eligibility and safe-range diagnostics are derived from the same
-- exact solver used by bid acceptance and finalization.
create function public.get_team_recruit_eligibility(p_tournament_id uuid,p_team_id uuid,p_player_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_team public.teams%rowtype;v_rules public.tournament_rules%rowtype;v_player public.tournament_players%rowtype;v_check jsonb;
begin
  if not public.is_tournament_role(p_tournament_id,'organizer') and not exists(select 1 from public.teams where id=p_team_id and captain_user_id=(select auth.uid())) then raise exception 'forbidden' using errcode='42501';end if;
  select * into v_team from public.teams where id=p_team_id and tournament_id=p_tournament_id;
  select * into v_rules from public.tournament_rules where tournament_id=p_tournament_id;
  select * into v_player from public.tournament_players where id=p_player_id and tournament_id=p_tournament_id;
  if v_team.id is null or v_player.id is null or not v_player.is_active or not v_player.is_eligible or v_player.is_reserve or v_player.is_drafted or v_player.draft_state in ('sold','withdrawn') then return jsonb_build_object('eligible',false,'code','PLAYER_OR_TEAM_UNAVAILABLE');end if;
  if v_team.roster_size>=v_rules.team_size-1 then return jsonb_build_object('eligible',false,'code','ROSTER_FULL');end if;
  if v_team.current_team_mmr+v_player.tournament_mmr>v_rules.mmr_max then return jsonb_build_object('eligible',false,'code','TEAM_WOULD_EXCEED_MAX_MMR');end if;
  v_check:=private.evaluate_draft_feasibility(p_tournament_id,p_team_id,p_player_id,v_rules.minimum_bid);
  return jsonb_build_object('eligible',(v_check->>'feasible')::boolean,'code',v_check->>'code','player_mmr',v_player.tournament_mmr,'projected_team_mmr',v_team.current_team_mmr+v_player.tournament_mmr);
end$$;

create function public.get_safe_recruit_range(p_tournament_id uuid,p_team_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_candidate record;v_check jsonb;v_safe_ids uuid[]:='{}'::uuid[];v_safe_mmrs integer[]:='{}'::integer[];v_rules public.tournament_rules%rowtype;
begin
  if not public.is_tournament_role(p_tournament_id,'organizer') and not exists(select 1 from public.teams where id=p_team_id and captain_user_id=(select auth.uid())) then raise exception 'forbidden' using errcode='42501';end if;
  select * into v_rules from public.tournament_rules where tournament_id=p_tournament_id;
  for v_candidate in select p.id,p.tournament_mmr from public.tournament_players p where p.tournament_id=p_tournament_id and p.is_active and p.is_eligible and not p.is_reserve and not p.is_drafted and p.draft_state not in ('sold','withdrawn','in_auction') and not exists(select 1 from public.teams t where t.tournament_id=p_tournament_id and t.captain_user_id=p.user_id) order by p.tournament_mmr,p.id loop
    v_check:=private.evaluate_draft_feasibility(p_tournament_id,p_team_id,v_candidate.id,v_rules.minimum_bid);
    if (v_check->>'feasible')::boolean then v_safe_ids:=array_append(v_safe_ids,v_candidate.id);v_safe_mmrs:=array_append(v_safe_mmrs,v_candidate.tournament_mmr);end if;
  end loop;
  return jsonb_build_object('safe',cardinality(v_safe_ids)>0,'min_mmr',(select min(x) from unnest(v_safe_mmrs)x),'max_mmr',(select max(x) from unnest(v_safe_mmrs)x),'eligible_player_ids',to_jsonb(v_safe_ids),'candidate_count',cardinality(v_safe_ids));
end$$;

create function public.suggest_mmr_tolerance(p_tournament_id uuid,p_max_percent integer default 10)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rules public.tournament_rules%rowtype;v_team_count integer;v_total_mmr bigint;v_target bigint;v_required integer;
begin
  if not public.is_tournament_role(p_tournament_id,'organizer') then raise exception 'forbidden' using errcode='42501';end if;
  select * into v_rules from public.tournament_rules where tournament_id=p_tournament_id;
  select count(*),coalesce(sum(current_team_mmr),0)+(select coalesce(sum(tournament_mmr),0) from public.tournament_players p where p.tournament_id=p_tournament_id and p.is_active and p.is_eligible and not p.is_reserve and not p.is_drafted and not exists(select 1 from public.teams t where t.tournament_id=p_tournament_id and t.captain_user_id=p.user_id)) into v_team_count,v_total_mmr from public.teams where tournament_id=p_tournament_id;
  v_target:=round(v_total_mmr/greatest(v_team_count,1));
  v_required:=ceil(greatest(abs(v_target-v_rules.mmr_min),abs(v_target-v_rules.mmr_max))*100.0/greatest(v_rules.mmr_target,1));
  return jsonb_build_object('diagnostic_only',true,'suggested_percent',least(v_required,p_max_percent),'bounded',v_required<=p_max_percent,'current_min',v_rules.mmr_min,'current_max',v_rules.mmr_max,'average_final_mmr',v_target);
end$$;

revoke all on function public.get_team_recruit_eligibility(uuid,uuid,uuid),public.get_safe_recruit_range(uuid,uuid),public.suggest_mmr_tolerance(uuid,integer) from public,anon;
grant execute on function public.get_team_recruit_eligibility(uuid,uuid,uuid),public.get_safe_recruit_range(uuid,uuid),public.suggest_mmr_tolerance(uuid,integer) to authenticated;

-- Unsold rounds reuse Phase 03 nomination atomicity but use the configured
-- unsold opening price and a fresh deterministic nomination cycle.
alter function public.nominate_player(uuid,uuid,uuid) rename to nominate_player_phase03;
revoke all on function public.nominate_player_phase03(uuid,uuid,uuid) from public,anon,authenticated;
create function public.nominate_player(p_tournament_id uuid,p_player_id uuid,p_expected_nomination_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_prior public.player_draft_state;v_result jsonb;v_min integer;
begin
  select draft_state into v_prior from public.tournament_players where id=p_player_id and tournament_id=p_tournament_id;
  v_result:=public.nominate_player_phase03(p_tournament_id,p_player_id,p_expected_nomination_id);
  if v_prior='reentered' then
    select unsold_minimum_bid into v_min from public.tournament_rules where tournament_id=p_tournament_id;
    update public.auctions set opening_bid=coalesce(v_min,opening_bid) where id=(v_result->>'id')::uuid;
    v_result:=v_result||jsonb_build_object('opening_bid',coalesce(v_min,(v_result->>'opening_bid')::integer),'unsold_round',true);
  end if;
  return v_result;
end$$;

create function public.start_unsold_round(p_tournament_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rules public.tournament_rules%rowtype;v_round integer;v_first uuid;v_count integer;
begin
  if not public.is_tournament_role(p_tournament_id,'organizer') then raise exception 'forbidden' using errcode='42501';end if;
  select * into v_rules from public.tournament_rules where tournament_id=p_tournament_id;
  if not v_rules.allow_unsold_round then raise exception 'unsold round disabled';end if;
  if exists(select 1 from public.auctions where tournament_id=p_tournament_id and status in ('pending','open','paused')) then raise exception 'an auction is still active';end if;
  if exists(select 1 from public.nomination_order where tournament_id=p_tournament_id and status in ('upcoming','active')) then raise exception 'normal nomination order is not complete';end if;
  select count(*) into v_count from public.tournament_players where tournament_id=p_tournament_id and draft_state='unsold' and not is_drafted;
  if v_count=0 then raise exception 'no unsold players available';end if;
  select coalesce(max(round_number),0)+1 into v_round from public.nomination_order where tournament_id=p_tournament_id;
  insert into public.unsold_rounds(tournament_id,round_number,status,started_at) values(p_tournament_id,v_round,'open',clock_timestamp());
  insert into public.nomination_order(tournament_id,round_number,position,team_id,status)
    select p_tournament_id,v_round,row_number() over(order by t.created_at,t.id),t.id,'upcoming' from public.teams t where t.tournament_id=p_tournament_id and t.roster_size<v_rules.team_size-1;
  select id into v_first from public.nomination_order where tournament_id=p_tournament_id and round_number=v_round order by position limit 1;
  update public.nomination_order set status='active' where id=v_first;
  update public.tournament_players set draft_state='reentered' where tournament_id=p_tournament_id and draft_state='unsold' and not is_drafted;
  perform private.audit(p_tournament_id,'UNSOLD_ROUND_STARTED','unsold_round',p_tournament_id,jsonb_build_object('round_number',v_round,'players',v_count));
  return jsonb_build_object('ok',true,'round_number',v_round,'reentered_players',v_count,'active_nomination_id',v_first);
end$$;

create function public.get_draft_completion_state(p_tournament_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rules public.tournament_rules%rowtype;v_slots integer;v_players integer;v_check jsonb;v_complete boolean;
begin
  if not exists(select 1 from public.tournament_members where tournament_id=p_tournament_id and user_id=(select auth.uid()) and status='active') then raise exception 'forbidden' using errcode='42501';end if;
  select * into v_rules from public.tournament_rules where tournament_id=p_tournament_id;
  select coalesce(sum(greatest(v_rules.team_size-1-roster_size,0)),0) into v_slots from public.teams where tournament_id=p_tournament_id;
  select count(*) into v_players from public.tournament_players p where p.tournament_id=p_tournament_id and p.is_active and p.is_eligible and not p.is_reserve and not p.is_drafted and p.draft_state not in ('sold','withdrawn','in_auction') and not exists(select 1 from public.teams t where t.tournament_id=p_tournament_id and t.captain_user_id=p.user_id);
  v_check:=private.evaluate_draft_feasibility(p_tournament_id);v_complete:=v_slots=0;
  return jsonb_build_object('complete',v_complete,'remaining_recruit_slots',v_slots,'remaining_players',v_players,'feasible',(v_check->>'feasible')::boolean,'code',v_check->>'code','forced_pool',not v_complete and v_slots=v_players);
end$$;

revoke all on function public.nominate_player(uuid,uuid,uuid),public.start_unsold_round(uuid),public.get_draft_completion_state(uuid) from public,anon;
grant execute on function public.nominate_player(uuid,uuid,uuid),public.start_unsold_round(uuid),public.get_draft_completion_state(uuid) to authenticated;

alter publication supabase_realtime add table public.unsold_rounds;

alter function public.get_current_auction_state(uuid) rename to get_current_auction_state_phase03;
revoke all on function public.get_current_auction_state_phase03(uuid) from public,anon,authenticated;
create function public.get_current_auction_state(p_tournament_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_state jsonb;v_rules public.tournament_rules%rowtype;v_health jsonb;
begin
  v_state:=public.get_current_auction_state_phase03(p_tournament_id);
  select * into v_rules from public.tournament_rules where tournament_id=p_tournament_id;
  v_health:=private.evaluate_draft_feasibility(p_tournament_id);
  return v_state||jsonb_build_object('draft_health',v_health,'team_size',v_rules.team_size,'recruit_cap',v_rules.team_size-1,'unsold_round',(select to_jsonb(u) from public.unsold_rounds u where u.tournament_id=p_tournament_id and u.status='open' order by u.round_number desc limit 1));
end$$;
revoke all on function public.get_current_auction_state(uuid) from public;
grant execute on function public.get_current_auction_state(uuid) to anon,authenticated;
