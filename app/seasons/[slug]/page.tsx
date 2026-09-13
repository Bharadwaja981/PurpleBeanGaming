import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await createClient();
  const { data: season } = await db.from("public_seasons").select("*").eq("slug", slug).maybeSingle();
  if (!season?.id || !season.starts_at || !season.ends_at) notFound();
  const [{ data: board }, { data: tournaments }, { data: organizations }, { data: history }] = await Promise.all([
    db.from("public_season_player_leaderboard").select("*").eq("season_slug", slug).order("rank").limit(100),
    db.from("public_season_tournaments").select("*").eq("season_slug", slug).order("starts_at"),
    db.from("public_organization_standings").select("*").eq("season_id", season.id).order("championships", { ascending: false }).order("match_wins", { ascending: false }),
    db.from("public_season_rating_history").select("processed_at,tournament,public_slug,rating_after,delta").eq("season_slug", slug).order("processed_at", { ascending: false }).limit(8),
  ]);
  return <main className="mx-auto min-h-screen max-w-6xl space-y-6 p-4 py-10 md:p-8">
    <header><p className="text-sm uppercase tracking-[.2em] text-[var(--accent)]">{season.status} season</p><h1 className="text-4xl font-bold">{season.name}</h1><p className="muted">{new Date(season.starts_at).toLocaleDateString()} – {new Date(season.ends_at).toLocaleDateString()}</p></header>
    <Card><h2 className="text-xl font-bold">Tournaments and champions</h2><div className="mt-3 space-y-3">{tournaments?.map(t => <Link className="block border-t border-[var(--line)] pt-3" href={`/tournaments/${t.tournament_slug}/status`} key={t.tournament_slug}>{t.tournament} · {t.status}{t.champion ? ` · Champion: ${t.champion}` : ""}{t.runner_up ? ` · Runner-up: ${t.runner_up}` : ""}</Link>)}</div></Card>
    <Card className="min-w-0"><h2 className="text-xl font-bold">Season player leaderboard</h2><div className="mt-3 max-w-full overflow-x-auto"><table className="min-w-[600px] w-full text-left"><thead><tr><th>Rank</th><th>Player</th><th>Rating</th><th>Confidence</th><th>Matches</th></tr></thead><tbody>{board?.map(r => <tr className="border-t border-[var(--line)]" key={r.public_slug}><td className="py-3">{r.rank}</td><td><Link href={`/players/${r.public_slug}`}>{r.player_name}</Link></td><td>{r.competitive_rating}</td><td>{r.confidence}</td><td>{r.matches_count}</td></tr>)}</tbody></table></div></Card>
    <div className="grid min-w-0 gap-6 lg:grid-cols-2"><Card className="min-w-0"><h2 className="text-xl font-bold">Organization standings</h2><div className="mt-3 max-w-full overflow-x-auto"><table className="min-w-[500px] w-full text-left"><thead><tr><th scope="col">Organization</th><th scope="col">Titles</th><th scope="col">Finals</th><th scope="col">Wins</th></tr></thead><tbody>{organizations?.map(o => <tr className="border-t border-[var(--line)]" key={o.organization_slug}><td className="py-3"><Link href={`/organizations/${o.organization_slug}`}>{o.name}</Link></td><td>{o.championships}</td><td>{o.final_appearances}</td><td>{o.match_wins}</td></tr>)}</tbody></table></div></Card><Card className="min-w-0"><h2 className="text-xl font-bold">Recent season rating results</h2><div className="mt-3 space-y-3">{history?.map(h => <div className="border-t border-[var(--line)] pt-3" key={`${h.public_slug}-${h.processed_at}`}><Link href={`/players/${h.public_slug}`}>{h.public_slug}</Link><p className="muted text-sm">{h.tournament} · {h.rating_after} ({h.delta! > 0 ? "+" : ""}{h.delta})</p></div>)}</div></Card></div>
  </main>;
}
