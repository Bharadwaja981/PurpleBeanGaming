create or replace function public.export_standings_csv(p_tournament_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.is_competition_official(p_tournament_id) then
      'group,placement,team,played,wins,losses,points,game_difference'
      || E'\n'
      || coalesce(
        string_agg(
          format(
            '%s,%s,%s,%s,%s,%s,%s,%s',
            coalesce(replace(g.name, ',', ' '), ''),
            r.position,
            replace(r.team_name, ',', ' '),
            r.played,
            r.wins,
            r.losses,
            r.points,
            r.game_difference
          ),
          E'\n'
          order by g.sequence_number nulls first, r.position
        ),
        ''
      )
  end
  from public.public_competition_rankings r
  join public.competition_settings settings
    on settings.tournament_id = r.tournament_id
  left join public.competition_groups g on g.id = r.group_id
  where r.tournament_id = p_tournament_id
    and (settings.format <> 'groups' or r.group_id is not null)
$$;
