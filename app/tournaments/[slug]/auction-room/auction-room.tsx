"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type Increment = "next" | "plus_5" | "plus_10" | "max_legal";
type Auction = { id:string;status:string;current_bid:number|null;opening_bid:number;leading_team_id:string|null;revision:number;closes_at:string|null;winning_bid:number|null };
type Team = { id:string;name:string;short_tag?:string;credits_remaining:number;current_team_mmr:number;roster_size:number;max_roster_size:number;max_legal_bid?:number };
type Nomination = { id:string;team_id:string;team_name?:string;round_number:number;position:number;status:string };
type Entry = { id:string;team_name?:string;amount?:number;revision?:number;event_type?:string;received_at?:string;created_at?:string };
type AuctionState = {
  server_now:string;tournament:{id:string;name:string;status:string};auction:Auction|null;
  player:{id:string;ign:string;primary_role:string|null;tournament_mmr:number;is_drafted:boolean}|null;
  leader:{id:string;name:string;short_tag:string}|null;active_nomination:Nomination|null;my_team:Team|null;
  team_balances:Team[];nomination_order:Nomination[];recent_bids:Entry[];auction_log:Entry[];
  team_size:number;recruit_cap:number;draft_health:{feasible:boolean;code:string;remaining_slots?:number;remaining_players?:number};
  unsold_round:{round_number:number;status:string}|null;
};
type Player = { id:string;ign:string;tournament_mmr:number|null;primary_role:string|null;is_drafted:boolean };

function secondsLeft(state: AuctionState | null, now: number) {
  if (!state?.auction?.closes_at || state.auction.status === "paused") return null;
  return Math.max(0, Math.ceil((new Date(state.auction.closes_at).getTime() - now) / 1000));
}

export function AuctionRoom({ tournamentId, initialState, players }: { tournamentId:string;initialState:unknown;players:Player[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState(initialState as AuctionState);
  const [now, setNow] = useState(() => Date.now());
  const [increment, setIncrement] = useState<Increment>("next");
  const [playerId, setPlayerId] = useState(players[0]?.id ?? "");
  const [message, setMessage] = useState("Canonical database state loaded.");
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_current_auction_state", { p_tournament_id: tournamentId });
    if (error) { setMessage(error.message); return; }
    setState(data as AuctionState);
    setNow(Date.now());
  }, [supabase, tournamentId]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const channel = supabase.channel(`auction-room:${tournamentId}`);
    for (const table of ["auctions","bids","teams","team_roster","nomination_order","unsold_rounds"] as const) {
      channel.on("postgres_changes", { event:"*", schema:"public", table, filter:`tournament_id=eq.${tournamentId}` }, () => { void refresh(); });
    }
    channel.subscribe(status => {
      if (status === "SUBSCRIBED") void refresh();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setMessage("Live updates interrupted. Reconnecting from canonical state…");
    });
    const reconnect = () => { setMessage("Connection restored. Refreshing canonical state…"); void refresh(); };
    window.addEventListener("online", reconnect);
    return () => { window.clearInterval(clock); window.removeEventListener("online", reconnect); void supabase.removeChannel(channel); };
  }, [refresh, supabase, tournamentId]);

  const run = (work: () => PromiseLike<{ data:unknown;error:{message:string}|null }>, success:string) => startTransition(async () => {
    const { data, error } = await work();
    setMessage(error?.message ?? (data && typeof data === "object" && "code" in data ? String((data as {code:string}).code) : success));
    await refresh();
  });
  const bid = () => {
    if (!state.auction) return;
    run(() => supabase.rpc("place_bid", { p_auction_id:state.auction!.id,p_expected_revision:state.auction!.revision,p_request_id:crypto.randomUUID(),p_increment_type:increment }), "Bid accepted");
  };
  const remaining = secondsLeft(state, now);
  const canNominate = state.my_team?.id === state.active_nomination?.team_id && !["open","paused"].includes(state.auction?.status ?? "");

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Live auction control</p><h1 className="mt-2 text-3xl font-bold">{state.tournament.name}</h1></div><div className="flex gap-2"><Badge tone={state.tournament.status.includes("paused")?"warning":"success"}>{state.tournament.status.replaceAll("_"," ")}</Badge><Badge>Revision {state.auction?.revision ?? 0}</Badge></div></div>
    <p className="rounded-lg border border-[var(--line)] bg-[#0b151b] px-4 py-3 text-sm text-[var(--muted)]" role="status">{isPending?"Submitting to the authoritative server…":message}</p>

    <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <div className="space-y-6">
        <Card className="p-6"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--muted)]">On the Block</p>{state.player?<div className="mt-4 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl font-bold">{state.player.ign}</h2><p className="muted mt-1">{state.player.primary_role ?? "Flexible"} · Tournament MMR {state.player.tournament_mmr}</p></div><div className="text-right"><p className="text-xs uppercase text-[var(--muted)]">Database timer</p><p className="text-4xl font-black tabular-nums text-[var(--amber)]">{state.auction?.status==="paused"?"PAUSED":remaining===null?"—":`${remaining}s`}</p></div></div>:<p className="muted mt-4">Waiting for the active captain to nominate.</p>}</Card>
        <Card className="p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Live Bidding</p><p className="mt-2 text-4xl font-black text-[var(--amber)]">{state.auction?.current_bid ?? state.auction?.opening_bid ?? "—"} CR</p><p className="muted mt-1">Leader: {state.leader?.name ?? "No bids"}</p></div><div className="flex flex-wrap gap-2">{([['next','+1 CR'],['plus_5','+5 CR'],['plus_10','+10 CR'],['max_legal','Max Legal Bid']] as [Increment,string][]).map(([value,label])=><Button key={value} variant={increment===value?"primary":"secondary"} onClick={()=>setIncrement(value)}>{label}</Button>)}</div></div><Button className="mt-5 w-full" disabled={isPending||state.auction?.status!=="open"||!state.my_team} onClick={bid}>Place Bid</Button><p className="muted mt-3 text-xs">All amounts, limits, expiry, and revisions are recalculated by PostgreSQL. “+1” means the next tournament-legal increment.</p></Card>
        <div className="grid gap-6 md:grid-cols-2"><ListCard title="Recent Bids" rows={state.recent_bids.map(row=>`${row.team_name}: ${row.amount} CR · r${row.revision}`)}/><ListCard title="Auction Log" rows={state.auction_log.map(row=>row.event_type?.replaceAll("_"," ") ?? "Event")}/></div>
      </div>
      <div className="space-y-6">
        <Card className="p-5"><h2 className="font-bold">Your Team</h2>{state.my_team?<div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Stat label="Credits" value={state.my_team.credits_remaining}/><Stat label="Max legal" value={state.my_team.max_legal_bid ?? 0}/><Stat label="Team MMR" value={state.my_team.current_team_mmr}/><Stat label="Players" value={`${1+state.my_team.roster_size}/${state.team_size}`}/><Stat label="Recruit slots left" value={Math.max(state.recruit_cap-state.my_team.roster_size,0)}/></div>:<p className="muted mt-3 text-sm">Spectator mode — bidding controls are disabled.</p>}</Card>
        <Card className="p-5"><h2 className="font-bold">Nomination Order</h2><div className="mt-3 max-h-56 space-y-2 overflow-auto">{state.nomination_order.map(row=><div className="flex justify-between rounded-md border border-[var(--line)] px-3 py-2 text-sm" key={row.id}><span>R{row.round_number} · {row.team_name}</span><span className={row.status==="active"?"text-[var(--accent)]":"muted"}>{row.status}</span></div>)}</div>{canNominate?<div className="mt-4 space-y-2"><select aria-label="Player to nominate" className="w-full rounded-md border border-[var(--line)] bg-[#081016] p-2" value={playerId} onChange={event=>setPlayerId(event.target.value)}>{players.filter(player=>!player.is_drafted).map(player=><option value={player.id} key={player.id}>{player.ign} · {player.tournament_mmr} MMR</option>)}</select><Button className="w-full" disabled={!playerId||isPending} onClick={()=>run(()=>supabase.rpc("nominate_player",{p_tournament_id:tournamentId,p_player_id:playerId,p_expected_nomination_id:state.active_nomination!.id}),"Player nominated")}>Nominate Player</Button></div>:null}</Card>
        <Card className="p-5"><h2 className="font-bold">Team Balances</h2><div className="mt-3 space-y-2">{state.team_balances.map(team=><div className="flex items-center justify-between text-sm" key={team.id}><span>{team.short_tag} · {team.name}</span><span className="text-[var(--amber)]">{team.credits_remaining} CR</span></div>)}</div></Card>
        <Card className="p-5"><h2 className="font-bold">Organizer Controls</h2><div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" disabled={isPending} onClick={()=>run(()=>supabase.rpc("validate_draft_configuration",{p_tournament_id:tournamentId}),"Configuration certified")}>Certify</Button><Button variant="secondary" disabled={isPending} onClick={()=>run(()=>supabase.rpc("start_auction",{p_tournament_id:tournamentId}),"Auction started")}>Start</Button><Button variant="secondary" disabled={!state.auction||isPending} onClick={()=>run(()=>supabase.rpc("pause_auction",{p_auction_id:state.auction!.id}),"Paused")}>Pause</Button><Button variant="secondary" disabled={!state.auction||isPending} onClick={()=>run(()=>supabase.rpc("resume_auction",{p_auction_id:state.auction!.id}),"Resumed")}>Resume</Button><Button variant="secondary" disabled={!state.auction||isPending} onClick={()=>run(()=>supabase.rpc("finalize_auction",{p_auction_id:state.auction!.id}),"Finalized")}>Finalize</Button><Button variant="secondary" disabled={isPending} onClick={()=>run(()=>supabase.rpc("start_unsold_round",{p_tournament_id:tournamentId}),"Unsold round started")}>Unsold Round</Button></div></Card>
        <Card className="border-dashed p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Draft Health</h2><Badge tone={state.draft_health.feasible?"success":"warning"}>{state.draft_health.feasible?"Feasible":"Blocked"}</Badge></div><p className="muted mt-2 text-sm">{state.draft_health.code.replaceAll("_"," ")}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><Stat label="Recruit slots" value={state.draft_health.remaining_slots ?? 0}/><Stat label="Players available" value={state.draft_health.remaining_players ?? 0}/></div>{state.unsold_round?<p className="mt-3 text-sm text-[var(--amber)]">Unsold round {state.unsold_round.round_number} is {state.unsold_round.status}.</p>:null}</Card>
      </div>
    </div>
  </div>;
}

function Stat({label,value}:{label:string;value:string|number}){return <div className="rounded-lg border border-[var(--line)] bg-[#081016] p-3"><p className="muted text-xs">{label}</p><p className="mt-1 font-bold">{value}</p></div>}
function ListCard({title,rows}:{title:string;rows:string[]}){return <Card className="p-5"><h2 className="font-bold">{title}</h2><div className="mt-3 space-y-2">{rows.length?rows.slice(0,8).map((row,index)=><p className="border-b border-[var(--line)] pb-2 text-sm last:border-0" key={`${row}-${index}`}>{row}</p>):<p className="muted text-sm">No events yet.</p>}</div></Card>}
