create type public.rating_confidence_level as enum ('low','medium','high');
create type public.player_type as enum ('active','reserve','captain_candidate','willing_substitute');
create type public.evidence_type as enum ('rank_mmr','profile','additional');
create type public.captain_confirmation_status as enum ('pending','confirmed','declined');

alter table public.tournaments add column appeals_close_at timestamptz;
alter table public.tournament_rules add column evidence_required boolean not null default false,
  add column expose_verified_mmr_to_captains boolean not null default false;
alter table public.tournament_players
  drop constraint tournament_players_rating_confidence_check;
alter table public.tournament_players
  alter column rating_confidence drop default,
  alter column rating_confidence type public.rating_confidence_level
    using case
      when rating_confidence is null then null
      when rating_confidence::text::integer >= 80 then 'high'::public.rating_confidence_level
      when rating_confidence::text::integer >= 50 then 'medium'::public.rating_confidence_level
      else 'low'::public.rating_confidence_level
    end,
  add column full_name text,
  add column profile_url text,
  add column player_type public.player_type not null default 'active',
  add column additional_notes text;

-- Recent peak MMR is supplied by the player during registration. RLS limits that
-- edit to registration phase; this trigger protects organizer-owned decisions.
create or replace function public.protect_player_admin_fields() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if not public.is_tournament_role(old.tournament_id,'organizer') and
    (new.verified_mmr is distinct from old.verified_mmr or
     new.tournament_mmr is distinct from old.tournament_mmr or
     new.rating_confidence is distinct from old.rating_confidence or
     new.rating_status is distinct from old.rating_status or
     new.is_eligible is distinct from old.is_eligible or
     new.is_drafted is distinct from old.is_drafted) then
    raise exception 'administrative player fields are protected';
  end if;
  return new;
end$$;
alter table public.teams
  add column confirmation_status public.captain_confirmation_status not null default 'pending',
  add column confirmed_at timestamptz,
  add column confirmed_by uuid references public.profiles(id);

create table public.player_evidence(
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.tournament_players(id) on delete cascade,
  evidence_type public.evidence_type not null,
  storage_path text not null unique,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(player_id,evidence_type,storage_path)
);
create index player_evidence_player_idx on public.player_evidence(player_id,created_at desc);
create index player_evidence_tournament_idx on public.player_evidence(tournament_id);
alter table public.player_evidence enable row level security;
grant select,insert,delete on public.player_evidence to authenticated;

create policy evidence_owner_read on public.player_evidence for select to authenticated using (
  uploaded_by=(select auth.uid()) or (select public.is_tournament_role(tournament_id,'organizer')) or (select public.is_tournament_role(tournament_id,'moderator'))
);
create policy evidence_owner_insert on public.player_evidence for insert to authenticated with check (
  uploaded_by=(select auth.uid()) and exists(select 1 from public.tournament_players p join public.tournaments t on t.id=p.tournament_id where p.id=player_id and p.tournament_id=player_evidence.tournament_id and p.user_id=(select auth.uid()) and t.status='registration')
);
create policy evidence_owner_delete on public.player_evidence for delete to authenticated using (
  (uploaded_by=(select auth.uid()) and exists(select 1 from public.tournaments t where t.id=tournament_id and t.status='registration')) or (select public.is_tournament_role(tournament_id,'organizer'))
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('tournament-evidence','tournament-evidence',false,10485760,array['image/png','image/jpeg','image/webp','application/pdf']),
('team-assets','team-assets',true,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy evidence_object_insert on storage.objects for insert to authenticated with check (
  bucket_id='tournament-evidence' and (storage.foldername(storage.objects.name))[2]=(select auth.uid())::text and exists(
    select 1 from public.tournament_players p join public.tournaments t on t.id=p.tournament_id
    where p.tournament_id=((storage.foldername(storage.objects.name))[1])::uuid and p.user_id=(select auth.uid()) and t.status='registration')
);
create policy evidence_object_read on storage.objects for select to authenticated using (
  bucket_id='tournament-evidence' and ((storage.foldername(storage.objects.name))[2]=(select auth.uid())::text or public.is_tournament_role(((storage.foldername(storage.objects.name))[1])::uuid,'organizer'))
);
create policy evidence_object_update on storage.objects for update to authenticated using (
  bucket_id='tournament-evidence' and (storage.foldername(storage.objects.name))[2]=(select auth.uid())::text and exists(select 1 from public.tournaments t where t.id=((storage.foldername(storage.objects.name))[1])::uuid and t.status='registration')
) with check (bucket_id='tournament-evidence' and (storage.foldername(storage.objects.name))[2]=(select auth.uid())::text);
create policy evidence_object_delete on storage.objects for delete to authenticated using (
  bucket_id='tournament-evidence' and (((storage.foldername(storage.objects.name))[2]=(select auth.uid())::text and exists(select 1 from public.tournaments t where t.id=((storage.foldername(storage.objects.name))[1])::uuid and t.status='registration')) or public.is_tournament_role(((storage.foldername(storage.objects.name))[1])::uuid,'organizer'))
);
create policy team_asset_public_read on storage.objects for select to anon,authenticated using (bucket_id='team-assets');
create policy team_asset_organizer_insert on storage.objects for insert to authenticated with check (bucket_id='team-assets' and public.is_tournament_role(((storage.foldername(storage.objects.name))[1])::uuid,'organizer'));
create policy team_asset_organizer_update on storage.objects for update to authenticated using (bucket_id='team-assets' and public.is_tournament_role(((storage.foldername(storage.objects.name))[1])::uuid,'organizer')) with check (bucket_id='team-assets' and public.is_tournament_role(((storage.foldername(storage.objects.name))[1])::uuid,'organizer'));
create policy team_asset_organizer_delete on storage.objects for delete to authenticated using (bucket_id='team-assets' and public.is_tournament_role(((storage.foldername(storage.objects.name))[1])::uuid,'organizer'));

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create function private.audit(p_tournament uuid,p_event text,p_entity text,p_entity_id uuid,p_payload jsonb default '{}'::jsonb) returns void language sql security definer set search_path='' as $$
  insert into public.audit_events(tournament_id,actor_user_id,event_type,entity_type,entity_id,payload)
  values(p_tournament,(select auth.uid()),p_event,p_entity,p_entity_id,coalesce(p_payload,'{}'::jsonb));
$$;
revoke execute on function private.audit(uuid,text,text,uuid,jsonb) from public,anon,authenticated;

create function private.audit_player_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then perform private.audit(new.tournament_id,'PLAYER_REGISTERED','tournament_player',new.id,'{}');
  else
    if new.verified_mmr is distinct from old.verified_mmr then perform private.audit(new.tournament_id,'PLAYER_VERIFIED','tournament_player',new.id,jsonb_build_object('verified_mmr',new.verified_mmr)); end if;
    if new.tournament_mmr is distinct from old.tournament_mmr then perform private.audit(new.tournament_id,'TOURNAMENT_MMR_SET','tournament_player',new.id,jsonb_build_object('tournament_mmr',new.tournament_mmr)); end if;
    if new.rating_status is distinct from old.rating_status then perform private.audit(new.tournament_id,'RATING_STATUS_CHANGED','tournament_player',new.id,jsonb_build_object('rating_status',new.rating_status)); end if;
    if new.registration_status is distinct from old.registration_status and new.registration_status='rejected' then perform private.audit(new.tournament_id,'PLAYER_REJECTED','tournament_player',new.id,'{}');
    elsif new.rating_status is distinct from old.rating_status and new.rating_status='review_required' then perform private.audit(new.tournament_id,'PLAYER_REVIEW_REQUIRED','tournament_player',new.id,'{}');
    else perform private.audit(new.tournament_id,'PLAYER_REGISTRATION_UPDATED','tournament_player',new.id,'{}'); end if;
  end if; return new;
end$$;
create trigger audit_player_change after insert or update on public.tournament_players for each row execute function private.audit_player_change();

create function private.audit_evidence() returns trigger language plpgsql security definer set search_path='' as $$begin perform private.audit(new.tournament_id,'EVIDENCE_UPLOADED','player_evidence',new.id,jsonb_build_object('evidence_type',new.evidence_type));return new;end$$;
create trigger audit_evidence after insert on public.player_evidence for each row execute function private.audit_evidence();
create function private.audit_appeal() returns trigger language plpgsql security definer set search_path='' as $$begin perform private.audit(new.tournament_id,case when tg_op='INSERT' then 'APPEAL_SUBMITTED' else 'APPEAL_RESOLVED' end,'appeal',new.id,jsonb_build_object('status',new.status));return new;end$$;
create trigger audit_appeal after insert or update on public.appeals for each row execute function private.audit_appeal();

create function public.submit_registration(p_tournament_id uuid,p_full_name text,p_ign text,p_region text,p_primary_role text,p_secondary_role text,p_declared_mmr integer,p_recent_peak_mmr integer,p_availability text,p_profile_url text,p_player_type public.player_type,p_notes text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_status public.tournament_status;
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode='42501'; end if;
  select status into v_status from public.tournaments where id=p_tournament_id;
  if v_status<>'registration' then raise exception 'registration is closed' using errcode='P0001'; end if;
  if p_full_name is null or length(trim(p_full_name))<2 or p_ign is null or length(trim(p_ign))<2 then raise exception 'name and IGN are required'; end if;
  if p_declared_mmr<0 or p_recent_peak_mmr<0 then raise exception 'MMR must be non-negative'; end if;
  insert into public.tournament_members(tournament_id,user_id,status) values(p_tournament_id,(select auth.uid()),'active') on conflict(tournament_id,user_id) do update set status='active';
  insert into public.tournament_member_roles(member_id,role) select id,'player' from public.tournament_members where tournament_id=p_tournament_id and user_id=(select auth.uid()) on conflict do nothing;
  insert into public.tournament_players(tournament_id,user_id,full_name,ign,region,primary_role,secondary_role,declared_mmr,recent_peak_mmr,availability_status,profile_url,player_type,is_reserve,additional_notes,registration_status)
  values(p_tournament_id,(select auth.uid()),trim(p_full_name),trim(p_ign),p_region,p_primary_role,nullif(p_secondary_role,''),p_declared_mmr,p_recent_peak_mmr,p_availability,p_profile_url,p_player_type,p_player_type='reserve',p_notes,'submitted')
  on conflict(tournament_id,user_id) do update set full_name=excluded.full_name,ign=excluded.ign,region=excluded.region,primary_role=excluded.primary_role,secondary_role=excluded.secondary_role,declared_mmr=excluded.declared_mmr,recent_peak_mmr=excluded.recent_peak_mmr,availability_status=excluded.availability_status,profile_url=excluded.profile_url,player_type=excluded.player_type,is_reserve=excluded.is_reserve,additional_notes=p_notes,registration_status='submitted',updated_at=now()
  returning id into v_id; return v_id;
end$$;

create function public.review_player(p_player_id uuid,p_verified_mmr integer,p_recent_peak_mmr integer,p_tournament_mmr integer,p_confidence public.rating_confidence_level,p_decision text) returns void language plpgsql security definer set search_path='' as $$
declare v_tid uuid;
begin
 select tournament_id into v_tid from public.tournament_players where id=p_player_id;
 if not public.is_tournament_role(v_tid,'organizer') then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.tournaments where id=v_tid and status in ('verification','rating_review')) then raise exception 'ratings are not editable in this phase'; end if;
 if p_decision not in ('verify','review_required','reject','request_evidence') then raise exception 'invalid decision'; end if;
 update public.tournament_players set verified_mmr=p_verified_mmr,recent_peak_mmr=p_recent_peak_mmr,tournament_mmr=p_tournament_mmr,rating_confidence=p_confidence,rating_status=case when p_decision='verify' then 'verified'::public.rating_status else 'review_required'::public.rating_status end,is_eligible=p_decision='verify',registration_status=case when p_decision='verify' then 'approved'::public.registration_status when p_decision='reject' then 'rejected'::public.registration_status else registration_status end where id=p_player_id;
end$$;

create function public.assign_captain(p_tournament_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_member uuid;
begin if not public.is_tournament_role(p_tournament_id,'organizer') then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.tournaments where id=p_tournament_id and status in ('verification','rating_review')) then raise exception 'captain assignments are locked'; end if;
 select id into v_member from public.tournament_members where tournament_id=p_tournament_id and user_id=p_user_id and status='active'; if v_member is null then raise exception 'active member required'; end if;
 insert into public.tournament_member_roles(member_id,role) values(v_member,'captain') on conflict do nothing; perform private.audit(p_tournament_id,'CAPTAIN_ASSIGNED','profile',p_user_id,'{}');
end$$;

create function public.create_team(p_tournament_id uuid,p_name text,p_tag text,p_accent text,p_logo text,p_captain uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_rules public.tournament_rules%rowtype;v_mmr integer;
begin if not public.is_tournament_role(p_tournament_id,'organizer') then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.tournaments where id=p_tournament_id and status in ('verification','rating_review')) then raise exception 'team setup is locked'; end if;
 if not exists(select 1 from public.tournament_members m join public.tournament_member_roles r on r.member_id=m.id where m.tournament_id=p_tournament_id and m.user_id=p_captain and r.role='captain') then raise exception 'assigned captain required'; end if;
 select * into v_rules from public.tournament_rules where tournament_id=p_tournament_id; select tournament_mmr into v_mmr from public.tournament_players where tournament_id=p_tournament_id and user_id=p_captain;
 insert into public.teams(tournament_id,name,short_tag,accent_color,logo_url,captain_user_id,starting_credits,credits_remaining,captain_mmr,current_team_mmr,max_roster_size) values(p_tournament_id,trim(p_name),upper(trim(p_tag)),p_accent,p_logo,p_captain,v_rules.starting_credits,v_rules.starting_credits,v_mmr,v_mmr,v_rules.team_size) returning id into v_id;
 perform private.audit(p_tournament_id,'TEAM_CREATED','team',v_id,'{}'); return v_id;
end$$;

create function public.confirm_captain(p_team_id uuid,p_confirm boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_team public.teams%rowtype;begin select * into v_team from public.teams where id=p_team_id;if v_team.captain_user_id<>(select auth.uid()) then raise exception 'forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.tournaments where id=v_team.tournament_id and status in ('verification','rating_review')) then raise exception 'captain confirmation is locked'; end if;
 update public.teams set confirmation_status=case when p_confirm then 'confirmed'::public.captain_confirmation_status else 'declined'::public.captain_confirmation_status end,confirmed_at=case when p_confirm then now() else null end,confirmed_by=(select auth.uid()) where id=p_team_id;perform private.audit(v_team.tournament_id,'CAPTAIN_CONFIRMED','team',p_team_id,jsonb_build_object('confirmed',p_confirm));end$$;

create function public.submit_appeal(p_player_id uuid,p_type text,p_reason text,p_evidence_url text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_player public.tournament_players%rowtype;v_id uuid;begin select * into v_player from public.tournament_players where id=p_player_id;if v_player.user_id<>(select auth.uid()) then raise exception 'forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.tournaments t where t.id=v_player.tournament_id and t.status in ('verification','rating_review') and (t.appeals_close_at is null or t.appeals_close_at>now())) then raise exception 'appeal window closed';end if;
 insert into public.appeals(tournament_id,player_id,appeal_type,reason,evidence_url) values(v_player.tournament_id,p_player_id,p_type,p_reason,p_evidence_url) returning id into v_id;return v_id;end$$;

create function public.resolve_appeal(p_appeal_id uuid,p_approve boolean,p_resolution text) returns void language plpgsql security definer set search_path='' as $$declare v_tid uuid;begin select tournament_id into v_tid from public.appeals where id=p_appeal_id;if not public.is_tournament_role(v_tid,'organizer') then raise exception 'forbidden' using errcode='42501';end if;update public.appeals set status=case when p_approve then 'approved'::public.appeal_status else 'rejected'::public.appeal_status end,reviewed_by=(select auth.uid()),resolution=p_resolution,resolved_at=now() where id=p_appeal_id;end$$;

create function public.lock_player_pool(p_tournament_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin if not public.is_tournament_role(p_tournament_id,'organizer') then raise exception 'forbidden' using errcode='42501';end if;
 if (select status from public.tournaments where id=p_tournament_id)<>'rating_review' then raise exception 'tournament must be in rating_review';end if;
 if not exists(select 1 from public.tournament_players where tournament_id=p_tournament_id) then raise exception 'players required';end if;
 if exists(select 1 from public.tournament_players where tournament_id=p_tournament_id and is_eligible and (registration_status<>'approved' or tournament_mmr is null or rating_status not in ('verified','locked'))) then raise exception 'ratings incomplete';end if;
 if exists(select 1 from public.appeals where tournament_id=p_tournament_id and status in ('submitted','under_review')) then raise exception 'blocking appeals remain';end if;
 if not exists(select 1 from public.teams where tournament_id=p_tournament_id) then raise exception 'teams required'; end if;
 if (select count(*) from public.tournament_players where tournament_id=p_tournament_id and is_eligible) < (select count(*) * max(r.team_size) from public.teams tm join public.tournament_rules r on r.tournament_id=tm.tournament_id where tm.tournament_id=p_tournament_id) then raise exception 'required player count not reached'; end if;
 if exists(select 1 from public.tournament_rules r where r.tournament_id=p_tournament_id and r.evidence_required and exists(select 1 from public.tournament_players p where p.tournament_id=p_tournament_id and p.is_eligible and not exists(select 1 from public.player_evidence e where e.player_id=p.id))) then raise exception 'required evidence missing'; end if;
 if exists(select 1 from public.tournament_members m join public.tournament_member_roles r on r.member_id=m.id where m.tournament_id=p_tournament_id and r.role='captain' and not exists(select 1 from public.teams tm where tm.tournament_id=p_tournament_id and tm.captain_user_id=m.user_id and tm.confirmation_status='confirmed')) then raise exception 'captains or confirmations incomplete';end if;
 if not exists(select 1 from public.tournament_rules where tournament_id=p_tournament_id) then raise exception 'rules required';end if;
 update public.tournament_players set rating_status='locked' where tournament_id=p_tournament_id and is_eligible;update public.tournaments set status='player_pool_locked',ratings_lock_at=coalesce(ratings_lock_at,now()) where id=p_tournament_id;
 perform private.audit(p_tournament_id,'RATING_LOCKED','tournament',p_tournament_id,'{}');perform private.audit(p_tournament_id,'PLAYER_POOL_LOCKED','tournament',p_tournament_id,'{}');end$$;

create function public.submit_rating_review(p_player_id uuid,p_assessment public.rating_assessment) returns uuid language plpgsql security definer set search_path='' as $$
declare v_tid uuid; v_id uuid;
begin
  select tournament_id into v_tid from public.tournament_players where id=p_player_id and is_eligible;
  if v_tid is null or not public.is_tournament_role(v_tid,'captain') then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.tournaments where id=v_tid and status in ('verification','rating_review')) then raise exception 'rating review is closed'; end if;
  insert into public.rating_reviews(tournament_id,player_id,reviewer_user_id,assessment)
  values(v_tid,p_player_id,(select auth.uid()),p_assessment)
  on conflict(tournament_id,player_id,reviewer_user_id) do update set assessment=excluded.assessment
  returning id into v_id;
  return v_id;
end$$;

create view public.organizer_rating_review_summary with (security_invoker=true) as
select tournament_id,player_id,assessment,count(*)::integer as review_count
from public.rating_reviews group by tournament_id,player_id,assessment;
grant select on public.organizer_rating_review_summary to authenticated;

create function private.audit_team_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and row(new.name,new.short_tag,new.logo_url,new.accent_color,new.captain_user_id) is distinct from row(old.name,old.short_tag,old.logo_url,old.accent_color,old.captain_user_id) then
    perform private.audit(new.tournament_id,'TEAM_UPDATED','team',new.id,'{}');
  end if;
  return new;
end$$;
create trigger audit_team_change after update on public.teams for each row execute function private.audit_team_change();

create function public.emergency_correct_player_rating(p_player_id uuid,p_tournament_mmr integer,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v_tid uuid;
begin
  select tournament_id into v_tid from public.tournament_players where id=p_player_id;
  if not public.is_tournament_role(v_tid,'organizer') then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.tournaments where id=v_tid and status='player_pool_locked') then raise exception 'use normal review before ratings lock'; end if;
  if length(trim(coalesce(p_reason,''))) < 10 then raise exception 'correction reason is required'; end if;
  update public.tournament_players set tournament_mmr=p_tournament_mmr,rating_status='locked' where id=p_player_id;
  perform private.audit(v_tid,'EMERGENCY_RATING_CORRECTION','tournament_player',p_player_id,jsonb_build_object('tournament_mmr',p_tournament_mmr,'reason',p_reason));
end$$;

revoke all on function public.submit_registration(uuid,text,text,text,text,text,integer,integer,text,text,public.player_type,text) from public,anon;
revoke all on function public.review_player(uuid,integer,integer,integer,public.rating_confidence_level,text) from public,anon;
revoke all on function public.assign_captain(uuid,uuid) from public,anon;
revoke all on function public.create_team(uuid,text,text,text,text,uuid) from public,anon;
revoke all on function public.confirm_captain(uuid,boolean) from public,anon;
revoke all on function public.submit_appeal(uuid,text,text,text) from public,anon;
revoke all on function public.resolve_appeal(uuid,boolean,text) from public,anon;
revoke all on function public.lock_player_pool(uuid) from public,anon;
revoke all on function public.submit_rating_review(uuid,public.rating_assessment) from public,anon;
revoke all on function public.emergency_correct_player_rating(uuid,integer,text) from public,anon;
grant execute on function public.submit_registration(uuid,text,text,text,text,text,integer,integer,text,text,public.player_type,text),public.review_player(uuid,integer,integer,integer,public.rating_confidence_level,text),public.assign_captain(uuid,uuid),public.create_team(uuid,text,text,text,text,uuid),public.confirm_captain(uuid,boolean),public.submit_appeal(uuid,text,text,text),public.resolve_appeal(uuid,boolean,text),public.lock_player_pool(uuid) to authenticated;
grant execute on function public.submit_rating_review(uuid,public.rating_assessment),public.emergency_correct_player_rating(uuid,integer,text) to authenticated;
