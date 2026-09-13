import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ params }: { params: Promise<{ publicSlug: string }> }) {
  const { publicSlug } = await params;
  const db = await createClient();
  const [{ data: career }, { data: matches }, { data: ratingHistory }, { data: achievements }, { data: drafts }, { data: captainHistory }, { data: timeline }, {data:dota}] = await Promise.all([
    db.from("public_player_career_stats").select("*").eq("public_slug", publicSlug).maybeSingle(),
    db.from("public_player_match_history").select("*").eq("public_slug", publicSlug).order("completed_at", { ascending: false }).limit(20),
    db.from("public_rating_history").select("*").eq("public_slug", publicSlug).order("processed_at", { ascending: false }).limit(30),
    db.from("public_player_achievements").select("*").eq("public_slug", publicSlug).order("awarded_at", { ascending: false }),
    db.from("public_player_draft_history").select("*").eq("player_slug", publicSlug).order("completed_at", { ascending: false }),
    db.from("public_captain_draft_history").select("*").eq("captain_slug", publicSlug).order("completed_at", { ascending: false }),
    db.from("public_career_timeline").select("*").eq("public_slug", publicSlug).order("event_at", { ascending: false }).limit(20),
    db.from("public_player_dota_stats").select("*").eq("public_slug",publicSlug).maybeSingle(),
  ]);
  if (!career && !drafts?.length && !captainHistory?.length) notFound();
  const name = career?.player_name ?? drafts?.[0]?.ign ?? captainHistory?.[0]?.captain_name ?? "Player";
  const stats = [
    ["Competitive Rating", career?.competitive_rating ?? "Provisional"], ["Confidence", career?.confidence ?? "Provisional"],
    ["Match Record", `${career?.series_wins ?? 0}-${career?.series_losses ?? 0}`], ["Win Rate", career?.win_rate == null ? "—" : `${career.win_rate}%`],
    ["Tournaments Entered", career?.tournaments_entered ?? 0], ["Completed", career?.tournaments_completed ?? 0],
    ["Teams Represented", career?.teams_represented ?? 0], ["Championships", career?.championships ?? 0],
    ["Runner-up Finishes", career?.runner_up_finishes ?? 0], ["Times Drafted", career?.times_drafted ?? 0],
    ["Average Price", career?.average_auction_price ?? "—"], ["Highest Price", career?.highest_auction_price ?? "—"],
  ];
  return <main className="mx-auto min-h-screen max-w-6xl space-y-6 p-4 py-10 md:p-8">
    <header className="flex items-center gap-4">{career?.avatar_url ? <div aria-label={`${name} avatar`} role="img" className="h-16 w-16 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${career.avatar_url})` }} /> : null}<div><p className="page-kicker">Purple Bean career</p><h1 className="mt-2 text-4xl font-bold">{name}</h1><Link className="muted mt-2 inline-block" href="/leaderboards">View leaderboards →</Link></div></header>
    <section aria-label="Career statistics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([label, value]) => <Card key={label} className="p-4"><p className="muted text-xs uppercase">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></Card>)}</section>
    <Card><h2 className="text-xl font-bold">Purple Bean Tournament Dota Stats</h2>{dota?<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Games",dota.games_played],["Record",`${dota.wins}-${dota.losses}`],["KDA",dota.kda??"—"],["Avg GPM",dota.avg_gpm??"—"],["Avg XPM",dota.avg_xpm??"—"],["Hero diversity",dota.hero_diversity]].map(([label,value])=><div key={label}><p className="muted text-xs uppercase">{label}</p><strong>{value}</strong></div>)}</div>:<p className="muted mt-2">No verified Purple Bean-linked Dota games yet.</p>}<p className="muted mt-3 text-xs">Only reconciled Purple Bean tournament games are included. Missing telemetry remains unknown.</p></Card>
    <Card><h2 className="text-xl font-bold">Recent form</h2><div className="mt-3 flex gap-2">{matches?.slice(0, 5).map((m, i) => <span className={`rounded px-3 py-1 font-bold ${m.result === "W" ? "bg-emerald-500/20" : "bg-rose-500/20"}`} key={i}>{m.result}{m.forfeit ? "F" : ""}</span>)}{!matches?.length ? <span className="muted">No canonical matches yet.</span> : null}</div></Card>
    <Card><h2 className="text-xl font-bold">Rating history</h2><p className="muted text-sm">Confidence: {career?.confidence ?? "Provisional"}. A text table is provided for every rating change.</p><div className="mt-4 overflow-x-auto"><table className="min-w-[700px] w-full text-left text-sm"><thead><tr><th scope="col">Date</th><th scope="col">Tournament</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Change</th></tr></thead><tbody>{ratingHistory?.map(r => <tr className="border-t border-[var(--line)]" key={r.match_id}><td className="py-3">{new Date(r.processed_at!).toLocaleDateString()}</td><td>{r.tournament}</td><td>{r.rating_before}</td><td>{r.rating_after}</td><td>{r.delta! > 0 ? "+" : ""}{r.delta}</td></tr>)}</tbody></table></div></Card>
    <Card><h2 className="text-xl font-bold">Match history</h2><div className="mt-4 space-y-2">{matches?.map((m, i) => <div className="grid gap-2 border-t border-[var(--line)] py-3 sm:grid-cols-5" key={i}><span>{m.tournament}</span><span>{m.team} vs {m.opponent}</span><span>{m.stage}</span><span>{m.team_a_score}-{m.team_b_score}</span><strong>{m.result}{m.forfeit ? " · Forfeit" : ""}</strong></div>)}</div></Card>
    <Card><h2 className="text-xl font-bold">Draft history</h2><div className="mt-4 overflow-x-auto"><table className="min-w-[720px] w-full text-left text-sm"><thead><tr><th scope="col">Tournament</th><th scope="col">Historical team</th><th scope="col">Historical IGN</th><th scope="col">Role</th><th scope="col">Tournament MMR</th><th scope="col">Price</th></tr></thead><tbody>{drafts?.map(d => <tr className="border-t border-[var(--line)]" key={d.tournament_slug}><td className="py-3">{d.tournament_name}</td><td>{d.team_name}</td><td>{d.ign}</td><td>{d.primary_role ?? "Flexible"}</td><td>{d.tournament_mmr_at_draft}</td><td>{d.purchase_price ?? 0} CR</td></tr>)}</tbody></table></div></Card>
    {captainHistory?.length ? <Card><h2 className="text-xl font-bold">Captain career</h2><p className="muted mt-2">{captainHistory.length} tournament drafts captained</p><div className="mt-4 overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead><tr>{["Tournament", "Team", "Acquired", "Spent", "Remaining", "Contested", "Unsold"].map(x => <th scope="col" key={x}>{x}</th>)}</tr></thead><tbody>{captainHistory.map(r => <tr className="border-t border-[var(--line)]" key={r.tournament_slug}><td className="py-3">{r.tournament_name}</td><td>{r.team_name}</td><td>{r.players_acquired}</td><td>{r.credits_spent}</td><td>{r.credits_remaining}</td><td>{r.contested_wins}</td><td>{r.unsold_round_acquisitions}</td></tr>)}</tbody></table></div></Card> : null}
    <div className="grid gap-6 md:grid-cols-2"><Card><h2 className="text-xl font-bold">Achievements</h2><div className="mt-3 space-y-3">{achievements?.map(a => <div key={`${a.code}-${a.tournament_slug ?? "global"}`}><strong>{a.name}</strong><p className="muted text-sm">{a.description}{a.tournament ? ` · ${a.tournament}` : ""}</p></div>)}{!achievements?.length ? <p className="muted">No achievements yet.</p> : null}</div></Card><Card><h2 className="text-xl font-bold">Career timeline</h2><div className="mt-3 space-y-3">{timeline?.map((e, i) => <div key={i}><strong>{e.event_type}</strong><p className="muted text-sm">{e.tournament} · {e.detail}</p></div>)}</div></Card></div>
  </main>;
}
