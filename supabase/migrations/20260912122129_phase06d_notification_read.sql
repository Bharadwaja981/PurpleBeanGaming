create or replace function public.mark_competition_notification_read(p_notification_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_read_at timestamptz;
begin
  update public.competition_notifications
  set read_at = coalesce(read_at, clock_timestamp())
  where id = p_notification_id
    and recipient_user_id = (select auth.uid())
  returning read_at into v_read_at;

  if v_read_at is null then
    raise exception 'NOTIFICATION_NOT_FOUND' using errcode = 'P0001';
  end if;

  return v_read_at;
end;
$$;

revoke all on function public.mark_competition_notification_read(uuid) from public, anon;
grant execute on function public.mark_competition_notification_read(uuid) to authenticated;
