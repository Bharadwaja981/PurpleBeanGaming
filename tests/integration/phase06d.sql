begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_function(
  'public',
  'mark_competition_notification_read',
  array['uuid'],
  'notification read mutation is migration-backed'
);

select matches(
  pg_get_functiondef('public.complete_competition(uuid)'::regprocedure),
  'group_id is not null',
  'competition completion only treats group-stage ties as unresolved'
);

select matches(
  pg_get_functiondef('public.export_standings_csv(uuid)'::regprocedure),
  'public.public_competition_rankings',
  'standings export uses canonical competition rankings'
);

select matches(
  pg_get_functiondef('public.export_standings_csv(uuid)'::regprocedure),
  'settings.format <> ''groups'' or r.group_id is not null',
  'group standings export excludes knockout ranking rows'
);

select matches(
  pg_get_functiondef('public.export_standings_csv(uuid)'::regprocedure),
  'group,placement,team,played,wins,losses,points,game_difference',
  'standings CSV exposes the canonical safe header'
);

select * from finish();
rollback;
