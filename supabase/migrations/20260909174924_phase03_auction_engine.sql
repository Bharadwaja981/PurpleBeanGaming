-- Phase 03: server-authoritative nomination and live-auction engine.

create type public.bid_increment_type as enum ('next', 'plus_5', 'plus_10', 'max_legal');

alter table public.auctions
  add column paused_remaining_seconds numeric(12,3),
  add constraint auctions_state_shape check (
    (status in ('open','paused') and started_at is not null and closes_at is not null and closed_at is null)
    or (status in ('sold','unsold','cancelled','reversed') and closed_at is not null)
    or status = 'pending'
  ),
  add constraint auctions_bid_shape check (
    (current_bid is null and leading_team_id is null)
    or (current_bid is not null and leading_team_id is not null and current_bid >= opening_bid)
  );

create unique index one_live_auction_per_tournament
  on public.auctions(tournament_id) where status in ('open','paused');
create unique index one_live_auction_per_player
  on public.auctions(tournament_id, player_id) where status in ('pending','open','paused');
create index bids_accepted_revision_idx
  on public.bids(auction_id, auction_revision_after) where accepted;
create index nomination_next_idx
  on public.nomination_order(tournament_id, status, round_number, position);

-- Critical auction state is RPC-only for normal Data API clients. SELECT remains
-- governed by the existing RLS policies and public projections.
revoke insert, update, delete on public.auctions from authenticated;
revoke insert, update, delete on public.bids from authenticated;
revoke insert, update, delete on public.team_roster from authenticated;
revoke insert, update, delete on public.nomination_order from authenticated;

create function private.protect_team_auction_totals() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('postgres','service_role') and
     row(new.credits_remaining,new.current_team_mmr,new.roster_size)
       is distinct from row(old.credits_remaining,old.current_team_mmr,old.roster_size) then
    raise exception 'auction-controlled team totals are RPC-only' using errcode='42501';
  end if;
  return new;
end$$;
create trigger protect_team_auction_totals before update on public.teams
for each row execute function private.protect_team_auction_totals();

create function private.protect_player_drafted() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('postgres','service_role') and new.is_drafted is distinct from old.is_drafted then
    raise exception 'drafted state is RPC-only' using errcode='42501';
  end if;
  return new;
end$$;
create trigger protect_player_drafted before update on public.tournament_players
for each row execute function private.protect_player_drafted();

-- Phase 01's guard remains authoritative for user-originated administrative
-- edits, while trusted owner-executed RPCs may perform their narrow updates.
create or replace function public.protect_player_admin_fields() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user not in ('postgres','service_role')
     and not public.is_tournament_role(old.tournament_id,'organizer')
     and (new.verified_mmr is distinct from old.verified_mmr
       or new.recent_peak_mmr is distinct from old.recent_peak_mmr
       or new.tournament_mmr is distinct from old.tournament_mmr
       or new.rating_confidence is distinct from old.rating_confidence
       or new.rating_status is distinct from old.rating_status
       or new.is_eligible is distinct from old.is_eligible
       or new.is_drafted is distinct from old.is_drafted) then
    raise exception 'administrative player fields are protected';
  end if;
  return new;
end$$;

revoke all on function private.protect_team_auction_totals() from public,anon,authenticated;
revoke all on function private.protect_player_drafted() from public,anon,authenticated;

create function private.bid_result(p_bid public.bids, p_duplicate boolean default false)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'ok',p_bid.accepted,
    'code',case when p_bid.accepted then 'ACCEPTED' else p_bid.rejection_reason end,
    'duplicate',p_duplicate,
    'bid_id',p_bid.id,
    'auction_id',p_bid.auction_id,
    'amount',p_bid.amount,
    'revision_before',p_bid.auction_revision_before,
    'revision_after',p_bid.auction_revision_after,
    'received_at',p_bid.received_at
  )
$$;
revoke all on function private.bid_result(public.bids,boolean) from public,anon,authenticated;

create function private.record_rejected_bid(
  p_auction public.auctions,
  p_team public.teams,
  p_request_id uuid,
  p_expected_revision bigint,
  p_amount integer,
  p_code text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_bid public.bids%rowtype;
begin
  insert into public.bids(tournament_id,auction_id,team_id,captain_user_id,amount,request_id,
    auction_revision_before,auction_revision_after,accepted,rejection_reason)
  values(p_auction.tournament_id,p_auction.id,p_team.id,(select auth.uid()),greatest(p_amount,1),p_request_id,
    p_expected_revision,p_auction.revision,false,p_code)
  returning * into v_bid;
  perform private.audit(p_auction.tournament_id,'BID_REJECTED','auction',p_auction.id,
    jsonb_build_object('team_id',p_team.id,'request_id',p_request_id,'code',p_code,'expected_revision',p_expected_revision,'actual_revision',p_auction.revision));
  return private.bid_result(v_bid,false);
end$$;
revoke all on function private.record_rejected_bid(public.auctions,public.teams,uuid,bigint,integer,text) from public,anon,authenticated;

create function public.start_auction(p_tournament_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_nomination public.nomination_order%rowtype;
begin
  if not public.is_tournament_role(p_tournament_id,'organizer') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  perform 1 from public.tournaments where id=p_tournament_id and status in ('player_pool_locked','auction_ready') for update;
  if not found then raise exception 'tournament is not ready for auction'; end if;
  if exists(select 1 from public.teams where tournament_id=p_tournament_id and confirmation_status<>'confirmed') then
    raise exception 'all captains must be confirmed';
  end if;
  select * into v_nomination from public.nomination_order
    where tournament_id=p_tournament_id and status='upcoming'
    order by round_number,position for update limit 1;
  if v_nomination.id is null then raise exception 'nomination order is empty'; end if;
  update public.nomination_order set status='active' where id=v_nomination.id;
  update public.tournaments set status='auction_live',auction_starts_at=coalesce(auction_starts_at,clock_timestamp()) where id=p_tournament_id;
  perform private.audit(p_tournament_id,'AUCTION_STARTED','tournament',p_tournament_id,jsonb_build_object('nomination_id',v_nomination.id));
  return jsonb_build_object('tournament_id',p_tournament_id,'nomination_id',v_nomination.id,'status','auction_live');
end$$;

create function public.nominate_player(p_tournament_id uuid,p_player_id uuid,p_expected_nomination_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_nomination public.nomination_order%rowtype;
  v_player public.tournament_players%rowtype;
  v_rules public.tournament_rules%rowtype;
  v_auction public.auctions%rowtype;
  v_sequence integer;
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not exists(select 1 from public.tournaments where id=p_tournament_id and status='auction_live') then
    raise exception 'tournament auction is not live';
  end if;
  select * into v_nomination from public.nomination_order
    where id=p_expected_nomination_id and tournament_id=p_tournament_id for update;
  if v_nomination.id is null or v_nomination.status<>'active' then raise exception 'stale nomination turn'; end if;
  if not exists(select 1 from public.teams where id=v_nomination.team_id and tournament_id=p_tournament_id and captain_user_id=(select auth.uid())) then
    raise exception 'only the active nominating captain may nominate' using errcode='42501';
  end if;
  if exists(select 1 from public.auctions where tournament_id=p_tournament_id and status in ('open','paused')) then
    raise exception 'an auction is already active';
  end if;
  select * into v_player from public.tournament_players where id=p_player_id and tournament_id=p_tournament_id for update;
  if v_player.id is null or not v_player.is_active or not v_player.is_eligible or v_player.registration_status<>'approved' or v_player.tournament_mmr is null then
    raise exception 'player is not eligible for nomination';
  end if;
  if v_player.is_drafted or exists(select 1 from public.team_roster where tournament_id=p_tournament_id and player_id=p_player_id and is_active) then
    raise exception 'player is already drafted';
  end if;
  if exists(select 1 from public.auctions where tournament_id=p_tournament_id and player_id=p_player_id and status in ('pending','open','paused','sold')) then
    raise exception 'player is already in an auction';
  end if;
  select * into v_rules from public.tournament_rules where tournament_id=p_tournament_id;
  select coalesce(max(sequence_number),0)+1 into v_sequence from public.auctions where tournament_id=p_tournament_id;
  insert into public.auctions(tournament_id,player_id,nominating_team_id,sequence_number,status,opening_bid,started_at,closes_at)
  values(p_tournament_id,p_player_id,v_nomination.team_id,v_sequence,'open',v_rules.minimum_bid,clock_timestamp(),clock_timestamp()+make_interval(secs=>v_rules.initial_bid_seconds))
  returning * into v_auction;
  perform private.audit(p_tournament_id,'PLAYER_NOMINATED','auction',v_auction.id,
    jsonb_build_object('player_id',p_player_id,'team_id',v_nomination.team_id,'nomination_id',v_nomination.id,'opening_bid',v_rules.minimum_bid));
  return to_jsonb(v_auction);
exception when unique_violation then
  raise exception 'nomination conflict; refresh canonical state' using errcode='40001';
end$$;

create function public.get_max_legal_bid(p_auction_id uuid) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare v_auction public.auctions%rowtype;v_team public.teams%rowtype;v_rules public.tournament_rules%rowtype;v_mmr integer;v_slots integer;v_max integer;v_next integer;
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into v_auction from public.auctions where id=p_auction_id;
  if v_auction.id is null then raise exception 'auction not found'; end if;
  select * into v_team from public.teams where tournament_id=v_auction.tournament_id and captain_user_id=(select auth.uid());
  if v_team.id is null or not public.is_tournament_role(v_auction.tournament_id,'captain') then raise exception 'captain team required' using errcode='42501'; end if;
  select * into v_rules from public.tournament_rules where tournament_id=v_auction.tournament_id;
  select tournament_mmr into v_mmr from public.tournament_players where id=v_auction.player_id;
  if v_team.roster_size>=v_rules.team_size-1 or (v_rules.mmr_max is not null and v_team.current_team_mmr+v_mmr>v_rules.mmr_max) then return 0; end if;
  -- roster_size counts drafted recruits; the captain already occupies one team slot.
  v_slots := greatest(v_rules.team_size-v_team.roster_size-2,0);
  v_max := greatest(v_team.credits_remaining-(v_slots*v_rules.minimum_bid),0);
  v_next := case when v_auction.current_bid is null then v_auction.opening_bid else v_auction.current_bid+v_rules.bid_increment end;
  return case when v_max<v_next then 0 else v_max end;
end$$;

create function public.place_bid(p_auction_id uuid,p_expected_revision bigint,p_request_id uuid,p_increment_type public.bid_increment_type)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_existing public.bids%rowtype;
  v_auction public.auctions%rowtype;
  v_team public.teams%rowtype;
  v_rules public.tournament_rules%rowtype;
  v_player_mmr integer;
  v_amount integer;
  v_max integer;
  v_slots integer;
  v_bid public.bids%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into v_existing from public.bids where request_id=p_request_id;
  if v_existing.id is not null then
    if v_existing.captain_user_id<>v_uid or v_existing.auction_id<>p_auction_id then raise exception 'request_id belongs to another request' using errcode='42501'; end if;
    return private.bid_result(v_existing,true);
  end if;

  select * into v_auction from public.auctions where id=p_auction_id for update;
  if v_auction.id is null then raise exception 'auction not found'; end if;
  select * into v_team from public.teams where tournament_id=v_auction.tournament_id and captain_user_id=v_uid for update;
  if v_team.id is null or not public.is_tournament_role(v_auction.tournament_id,'captain') then raise exception 'captain team required' using errcode='42501'; end if;
  select * into v_rules from public.tournament_rules where tournament_id=v_auction.tournament_id;
  select tournament_mmr into v_player_mmr from public.tournament_players where id=v_auction.player_id;

  -- Reserve only for recruit purchases that remain after this proposed award.
  v_slots := greatest(v_rules.team_size-v_team.roster_size-2,0);
  v_max := greatest(v_team.credits_remaining-(v_slots*v_rules.minimum_bid),0);
  v_amount := case p_increment_type
    when 'next' then case when v_auction.current_bid is null then v_auction.opening_bid else v_auction.current_bid+v_rules.bid_increment end
    when 'plus_5' then case when v_auction.current_bid is null then v_auction.opening_bid else v_auction.current_bid+(ceil(5.0/v_rules.bid_increment)::integer*v_rules.bid_increment) end
    when 'plus_10' then case when v_auction.current_bid is null then v_auction.opening_bid else v_auction.current_bid+(ceil(10.0/v_rules.bid_increment)::integer*v_rules.bid_increment) end
    when 'max_legal' then v_max
  end;

  if v_auction.status='paused' then return private.record_rejected_bid(v_auction,v_team,p_request_id,p_expected_revision,v_amount,'AUCTION_PAUSED'); end if;
  if not exists(select 1 from public.tournaments where id=v_auction.tournament_id and status='auction_live') then return private.record_rejected_bid(v_auction,v_team,p_request_id,p_expected_revision,v_amount,'TOURNAMENT_NOT_LIVE'); end if;
  if v_auction.status<>'open' then return private.record_rejected_bid(v_auction,v_team,p_request_id,p_expected_revision,v_amount,'AUCTION_NOT_OPEN'); end if;
  if v_auction.closes_at<=v_now then return private.record_rejected_bid(v_auction,v_team,p_request_id,p_expected_revision,v_amount,'AUCTION_EXPIRED'); end if;
  if v_auction.revision<>p_expected_revision then return private.record_rejected_bid(v_auction,v_team,p_request_id,p_expected_revision,v_amount,'STALE_REVISION'); end if;
  if v_auction.leading_team_id=v_team.id then return private.record_rejected_bid(v_auction,v_team,p_request_id,p_expected_revision,v_amount,'ALREADY_LEADING'); end if;
  if exists(select 1 from public.tournament_players where id=v_auction.player_id and is_drafted) then return private.record_rejected_bid(v_auction,v_team,p_request_id,p_expected_revision,v_amount,'PLAYER_DRAFTED'); end if;
  if v_team.roster_size>=v_rules.team_size-1 then return private.record_rejected_bid(v_auction,v_team,p_request_id,p_expected_revision,v_amount,'ROSTER_FULL'); end if;
  if v_rules.mmr_max is not null and v_team.current_team_mmr+v_player_mmr>v_rules.mmr_max then return private.record_rejected_bid(v_auction,v_team,p_request_id,p_expected_revision,v_amount,'MMR_CAP_EXCEEDED'); end if;
  if v_amount<=coalesce(v_auction.current_bid,v_auction.opening_bid-1) then return private.record_rejected_bid(v_auction,v_team,p_request_id,p_expected_revision,v_amount,'BID_NOT_HIGHER'); end if;
  if v_amount>v_team.credits_remaining then return private.record_rejected_bid(v_auction,v_team,p_request_id,p_expected_revision,v_amount,'INSUFFICIENT_CREDITS'); end if;
  if v_amount>v_max then return private.record_rejected_bid(v_auction,v_team,p_request_id,p_expected_revision,v_amount,'CREDIT_RESERVE_REQUIRED'); end if;

  update public.auctions set current_bid=v_amount,leading_team_id=v_team.id,revision=revision+1,
    closes_at=case when closes_at-v_now<=make_interval(secs=>v_rules.anti_snipe_threshold_seconds)
      then greatest(closes_at,v_now+make_interval(secs=>v_rules.anti_snipe_extension_seconds)) else closes_at end
    where id=v_auction.id returning * into v_auction;
  insert into public.bids(tournament_id,auction_id,team_id,captain_user_id,amount,request_id,auction_revision_before,auction_revision_after,accepted)
    values(v_auction.tournament_id,v_auction.id,v_team.id,v_uid,v_amount,p_request_id,p_expected_revision,v_auction.revision,true)
    returning * into v_bid;
  perform private.audit(v_auction.tournament_id,'BID_ACCEPTED','auction',v_auction.id,
    jsonb_build_object('team_id',v_team.id,'amount',v_amount,'request_id',p_request_id,'revision',v_auction.revision,'closes_at',v_auction.closes_at));
  return private.bid_result(v_bid,false) || jsonb_build_object('closes_at',v_auction.closes_at,'leading_team_id',v_team.id);
exception when unique_violation then
  select * into v_existing from public.bids where request_id=p_request_id;
  if v_existing.id is not null and v_existing.captain_user_id=v_uid and v_existing.auction_id=p_auction_id then return private.bid_result(v_existing,true); end if;
  raise;
end$$;

create function private.advance_nomination(p_auction public.auctions) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_current uuid;v_next uuid;
begin
  select id into v_current from public.nomination_order
    where tournament_id=p_auction.tournament_id and team_id=p_auction.nominating_team_id and status='active' for update;
  if v_current is not null then update public.nomination_order set status='completed',completed_at=clock_timestamp() where id=v_current; end if;
  select id into v_next from public.nomination_order where tournament_id=p_auction.tournament_id and status='upcoming'
    order by round_number,position for update skip locked limit 1;
  if v_next is not null then update public.nomination_order set status='active' where id=v_next; end if;
  return v_next;
end$$;
revoke all on function private.advance_nomination(public.auctions) from public,anon,authenticated;

create function public.finalize_auction(p_auction_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_auction public.auctions%rowtype;v_team public.teams%rowtype;v_player public.tournament_players%rowtype;v_rules public.tournament_rules%rowtype;v_next uuid;v_now timestamptz:=clock_timestamp();
begin
  if (select auth.uid()) is null and current_user not in ('postgres','service_role') then raise exception 'authentication required' using errcode='42501'; end if;
  select * into v_auction from public.auctions where id=p_auction_id for update;
  if v_auction.id is null then raise exception 'auction not found'; end if;
  if v_auction.status in ('sold','unsold') then return jsonb_build_object('auction_id',v_auction.id,'status',v_auction.status,'winner_team_id',v_auction.winning_team_id,'winning_bid',v_auction.winning_bid,'duplicate',true); end if;
  if v_auction.status='paused' then raise exception 'paused auction cannot be finalized'; end if;
  if v_auction.status<>'open' or v_auction.closes_at>v_now then raise exception 'auction has not expired'; end if;
  select * into v_player from public.tournament_players where id=v_auction.player_id for update;
  select * into v_rules from public.tournament_rules where tournament_id=v_auction.tournament_id;
  if v_auction.leading_team_id is null then
    update public.auctions set status='unsold',closed_at=v_now,winning_team_id=null,winning_bid=null,revision=revision+1 where id=v_auction.id returning * into v_auction;
    v_next:=private.advance_nomination(v_auction);
    perform private.audit(v_auction.tournament_id,'AUCTION_UNSOLD','auction',v_auction.id,jsonb_build_object('player_id',v_auction.player_id,'next_nomination_id',v_next));
    return jsonb_build_object('auction_id',v_auction.id,'status','unsold','next_nomination_id',v_next,'duplicate',false);
  end if;
  select * into v_team from public.teams where id=v_auction.leading_team_id and tournament_id=v_auction.tournament_id for update;
  if v_player.is_drafted or exists(select 1 from public.team_roster where tournament_id=v_auction.tournament_id and player_id=v_player.id and is_active) then raise exception 'player already assigned'; end if;
  if v_team.roster_size>=v_rules.team_size-1 then raise exception 'winning roster is full'; end if;
  if v_team.credits_remaining<v_auction.current_bid then raise exception 'winning team lacks credits'; end if;
  if v_rules.mmr_max is not null and v_team.current_team_mmr+v_player.tournament_mmr>v_rules.mmr_max then raise exception 'winning team exceeds MMR cap'; end if;
  if v_team.credits_remaining-v_auction.current_bid < greatest(v_rules.team_size-v_team.roster_size-2,0)*v_rules.minimum_bid then raise exception 'winning team violates credit reserve'; end if;
  insert into public.team_roster(tournament_id,team_id,player_id,acquisition_type,auction_id,purchase_price,tournament_mmr_at_draft)
    values(v_auction.tournament_id,v_team.id,v_player.id,'auction',v_auction.id,v_auction.current_bid,v_player.tournament_mmr);
  update public.teams set credits_remaining=credits_remaining-v_auction.current_bid,current_team_mmr=current_team_mmr+v_player.tournament_mmr,roster_size=roster_size+1 where id=v_team.id;
  update public.tournament_players set is_drafted=true where id=v_player.id;
  update public.auctions set status='sold',closed_at=v_now,winning_team_id=v_team.id,winning_bid=current_bid,revision=revision+1 where id=v_auction.id returning * into v_auction;
  v_next:=private.advance_nomination(v_auction);
  perform private.audit(v_auction.tournament_id,'AUCTION_SOLD','auction',v_auction.id,jsonb_build_object('player_id',v_player.id,'team_id',v_team.id,'price',v_auction.winning_bid,'next_nomination_id',v_next));
  return jsonb_build_object('auction_id',v_auction.id,'status','sold','winner_team_id',v_team.id,'winning_bid',v_auction.winning_bid,'next_nomination_id',v_next,'duplicate',false);
end$$;

create function public.pause_auction(p_auction_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_auction public.auctions%rowtype;v_now timestamptz:=clock_timestamp();
begin
  select * into v_auction from public.auctions where id=p_auction_id for update;
  if v_auction.id is null or not public.is_tournament_role(v_auction.tournament_id,'organizer') then raise exception 'forbidden' using errcode='42501'; end if;
  if v_auction.status='paused' then return jsonb_build_object('auction_id',v_auction.id,'status','paused','remaining_seconds',v_auction.paused_remaining_seconds,'duplicate',true); end if;
  if v_auction.status<>'open' or v_auction.closes_at<=v_now then raise exception 'only an unexpired open auction can be paused'; end if;
  update public.auctions set status='paused',paused_remaining_seconds=greatest(extract(epoch from closes_at-v_now),0) where id=v_auction.id returning * into v_auction;
  update public.tournaments set status='auction_paused' where id=v_auction.tournament_id;
  perform private.audit(v_auction.tournament_id,'AUCTION_PAUSED','auction',v_auction.id,jsonb_build_object('remaining_seconds',v_auction.paused_remaining_seconds));
  return jsonb_build_object('auction_id',v_auction.id,'status','paused','remaining_seconds',v_auction.paused_remaining_seconds,'duplicate',false);
end$$;

create function public.resume_auction(p_auction_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_auction public.auctions%rowtype;v_now timestamptz:=clock_timestamp();
begin
  select * into v_auction from public.auctions where id=p_auction_id for update;
  if v_auction.id is null or not public.is_tournament_role(v_auction.tournament_id,'organizer') then raise exception 'forbidden' using errcode='42501'; end if;
  if v_auction.status='open' then return jsonb_build_object('auction_id',v_auction.id,'status','open','closes_at',v_auction.closes_at,'duplicate',true); end if;
  if v_auction.status<>'paused' or v_auction.paused_remaining_seconds is null then raise exception 'auction is not paused'; end if;
  update public.auctions set status='open',closes_at=v_now+(v_auction.paused_remaining_seconds*interval '1 second'),paused_remaining_seconds=null where id=v_auction.id returning * into v_auction;
  update public.tournaments set status='auction_live' where id=v_auction.tournament_id;
  perform private.audit(v_auction.tournament_id,'AUCTION_RESUMED','auction',v_auction.id,jsonb_build_object('closes_at',v_auction.closes_at));
  return jsonb_build_object('auction_id',v_auction.id,'status','open','closes_at',v_auction.closes_at,'duplicate',false);
end$$;

create function public.get_current_auction_state(p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_auction public.auctions%rowtype;v_nomination public.nomination_order%rowtype;v_team public.teams%rowtype;v_max integer;
begin
  if not exists(select 1 from public.tournaments t where t.id=p_tournament_id and (t.status not in ('draft','cancelled') or public.is_tournament_role(p_tournament_id,'organizer'))) then raise exception 'tournament not found' using errcode='42501'; end if;
  select * into v_auction from public.auctions where tournament_id=p_tournament_id order by sequence_number desc limit 1;
  select * into v_nomination from public.nomination_order where tournament_id=p_tournament_id and status='active';
  if (select auth.uid()) is not null then select * into v_team from public.teams where tournament_id=p_tournament_id and captain_user_id=(select auth.uid()); end if;
  if v_auction.id is not null and v_team.id is not null then v_max:=public.get_max_legal_bid(v_auction.id); end if;
  return jsonb_build_object(
    'server_now',clock_timestamp(),
    'tournament',(select jsonb_build_object('id',id,'slug',slug,'name',name,'status',status) from public.tournaments where id=p_tournament_id),
    'auction',case when v_auction.id is null then null else to_jsonb(v_auction) end,
    'player',case when v_auction.id is null then null else (select jsonb_build_object('id',id,'ign',ign,'primary_role',primary_role,'tournament_mmr',tournament_mmr,'is_drafted',is_drafted) from public.tournament_players where id=v_auction.player_id) end,
    'leader',case when v_auction.leading_team_id is null then null else (select jsonb_build_object('id',id,'name',name,'short_tag',short_tag) from public.teams where id=v_auction.leading_team_id) end,
    'active_nomination',case when v_nomination.id is null then null else to_jsonb(v_nomination) end,
    'my_team',case when v_team.id is null then null else jsonb_build_object('id',v_team.id,'name',v_team.name,'credits_remaining',v_team.credits_remaining,'current_team_mmr',v_team.current_team_mmr,'roster_size',v_team.roster_size,'max_roster_size',v_team.max_roster_size,'max_legal_bid',v_max) end,
    'team_balances',case when (select auth.uid()) is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id',id,'name',name,'short_tag',short_tag,'credits_remaining',credits_remaining,'current_team_mmr',current_team_mmr,'roster_size',roster_size,'max_roster_size',max_roster_size) order by name)
      from public.teams where tournament_id=p_tournament_id
    ),'[]'::jsonb) end,
    'nomination_order',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'round_number',n.round_number,'position',n.position,'status',n.status,'team_id',n.team_id,'team_name',tm.name) order by n.round_number,n.position)
      from public.nomination_order n join public.teams tm on tm.id=n.team_id where n.tournament_id=p_tournament_id),'[]'::jsonb),
    'recent_bids',case when v_auction.id is null then '[]'::jsonb else coalesce((select jsonb_agg(x.item order by x.received_at desc) from (
      select b.received_at,jsonb_build_object('id',b.id,'team_id',b.team_id,'team_name',tm.name,'amount',b.amount,'revision',b.auction_revision_after,'received_at',b.received_at) item
      from public.bids b join public.teams tm on tm.id=b.team_id where b.auction_id=v_auction.id and b.accepted order by b.received_at desc limit 10
    ) x),'[]'::jsonb) end,
    'auction_log',case when not public.is_tournament_role(p_tournament_id,'organizer') then '[]'::jsonb else coalesce((select jsonb_agg(x.item order by x.created_at desc) from (
      select e.created_at,jsonb_build_object('id',e.id,'event_type',e.event_type,'entity_id',e.entity_id,'created_at',e.created_at) item
      from public.audit_events e where e.tournament_id=p_tournament_id and e.event_type in ('AUCTION_STARTED','PLAYER_NOMINATED','BID_ACCEPTED','BID_REJECTED','AUCTION_PAUSED','AUCTION_RESUMED','AUCTION_SOLD','AUCTION_UNSOLD') order by e.created_at desc limit 20
    ) x),'[]'::jsonb) end
  );
end$$;

create function private.finalize_expired_auctions() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;v_count integer:=0;
begin
  for v_id in select id from public.auctions where status='open' and closes_at<=clock_timestamp() order by closes_at for update skip locked
  loop perform public.finalize_auction(v_id);v_count:=v_count+1;end loop;
  return v_count;
end$$;
revoke all on function private.finalize_expired_auctions() from public,anon,authenticated;

-- Minute-level background safety complements second-level client/server finalize
-- calls. The persisted closes_at remains the only expiry authority.
create extension if not exists pg_cron;
select cron.schedule(
  'draftgg-finalize-expired-auctions',
  '* * * * *',
  'select private.finalize_expired_auctions()'
) where not exists(select 1 from cron.job where jobname='draftgg-finalize-expired-auctions');

-- Public RPC surface is explicit. SECURITY DEFINER functions do their own authz.
revoke all on function public.start_auction(uuid) from public,anon;
revoke all on function public.nominate_player(uuid,uuid,uuid) from public,anon;
revoke all on function public.get_max_legal_bid(uuid) from public,anon;
revoke all on function public.place_bid(uuid,bigint,uuid,public.bid_increment_type) from public,anon;
revoke all on function public.finalize_auction(uuid) from public,anon;
revoke all on function public.pause_auction(uuid) from public,anon;
revoke all on function public.resume_auction(uuid) from public,anon;
revoke all on function public.get_current_auction_state(uuid) from public;
grant execute on function public.start_auction(uuid),public.nominate_player(uuid,uuid,uuid),public.get_max_legal_bid(uuid),public.place_bid(uuid,bigint,uuid,public.bid_increment_type),public.finalize_auction(uuid),public.pause_auction(uuid),public.resume_auction(uuid) to authenticated;
grant execute on function public.get_current_auction_state(uuid) to anon,authenticated;

-- Postgres Changes is transport only; RLS remains authoritative.
alter publication supabase_realtime add table public.auctions;
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.team_roster;
alter publication supabase_realtime add table public.nomination_order;
