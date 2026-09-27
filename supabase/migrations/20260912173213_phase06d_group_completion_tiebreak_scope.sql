-- Knockout rows deliberately share a NULL group_id.  Equal records among
-- eliminated semifinalists are not unresolved group-stage qualification ties.
create or replace function public.complete_competition(p_tournament_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_format public.competition_format;
  v_champion uuid;
  v_runner uuid;
  v_final public.matches%rowtype;
begin
  if not public.is_tournament_role(p_tournament_id, 'organizer') then
    raise exception 'UNAUTHORIZED_REFEREE' using errcode = 'P0001';
  end if;

  select format
  into v_format
  from public.competition_settings
  where tournament_id = p_tournament_id;

  if v_format is null then
    raise exception 'COMPETITION_NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.matches
    where tournament_id = p_tournament_id
      and status not in ('completed', 'forfeit', 'cancelled', 'superseded')
  ) or exists (
    select 1
    from public.match_disputes d
    join public.matches m on m.id = d.match_id
    where m.tournament_id = p_tournament_id
      and d.status = 'open'
  ) then
    raise exception 'COMPETITION_INCOMPLETE' using errcode = 'P0001';
  end if;

  if v_format = 'groups' and exists (
    select 1
    from public.public_competition_rankings
    where tournament_id = p_tournament_id
      and group_id is not null
      and tiebreak_required
  ) then
    raise exception 'TIEBREAK_REQUIRED' using errcode = 'P0001';
  end if;

  if v_format in ('single_elimination', 'groups') and exists (
    select 1
    from public.competition_stages
    where tournament_id = p_tournament_id
      and stage_type = 'knockout'
  ) then
    select *
    into v_final
    from public.matches
    where tournament_id = p_tournament_id
      and stage_id = (
        select id
        from public.competition_stages
        where tournament_id = p_tournament_id
          and stage_type = 'knockout'
        order by sequence_number desc
        limit 1
      )
      and next_match_id is null
    order by round_number desc, match_number desc
    limit 1;

    if v_final.id is null
      or v_final.status not in ('completed', 'forfeit')
      or v_final.winner_team_id is null then
      raise exception 'COMPETITION_INCOMPLETE' using errcode = 'P0001';
    end if;

    v_champion := v_final.winner_team_id;
    v_runner := v_final.loser_team_id;
  else
    select team_id
    into v_champion
    from public.public_competition_rankings
    where tournament_id = p_tournament_id
    order by group_id nulls first, position
    limit 1;

    select team_id
    into v_runner
    from public.public_competition_rankings
    where tournament_id = p_tournament_id
    order by group_id nulls first, position
    offset 1
    limit 1;
  end if;

  if v_champion is null then
    raise exception 'COMPETITION_INCOMPLETE' using errcode = 'P0001';
  end if;

  insert into public.competition_result_snapshots(
    tournament_id,
    champion_team_id,
    runner_up_team_id,
    settings,
    standings,
    matches
  )
  select
    p_tournament_id,
    v_champion,
    v_runner,
    to_jsonb(s),
    coalesce((
      select jsonb_agg(to_jsonb(x) order by group_id, position)
      from public.public_competition_rankings x
      where x.tournament_id = p_tournament_id
    ), '[]'),
    coalesce((
      select jsonb_agg(to_jsonb(x) order by round_number, match_number)
      from public.public_matches x
      where x.tournament_id = p_tournament_id
    ), '[]')
  from public.competition_settings s
  where s.tournament_id = p_tournament_id
  on conflict (tournament_id) do nothing;

  update public.tournaments
  set status = 'completed'
  where id = p_tournament_id;

  insert into public.audit_events(
    tournament_id,
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    payload
  )
  values (
    p_tournament_id,
    (select auth.uid()),
    'COMPETITION_COMPLETED',
    'tournament',
    p_tournament_id,
    jsonb_build_object(
      'champion_team_id', v_champion,
      'runner_up_team_id', v_runner
    )
  )
  on conflict do nothing;

  return p_tournament_id;
end
$$;
