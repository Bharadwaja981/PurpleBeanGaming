import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicDraftNav } from "@/components/draft/public-nav";
import { Card } from "@/components/ui/card";
import { CompetitionLiveRefresh } from "@/components/competition/competition-live-refresh";
import {linkDotaMatch,relinkDotaMatch} from "./dota-actions";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; matchId: string }>;
}) {
  const { slug, matchId } = await params,
    s = await createClient();
  const [{ data: t }, { data: m }, { data: games },{data:dotaStats}] = await Promise.all([
    s
      .from("public_tournament_summary")
      .select("name")
      .eq("slug", slug)
      .maybeSingle(),
    s.from("public_matches").select("*").eq("id", matchId).maybeSingle(),
    s
      .from("public_match_games")
      .select("*")
      .eq("match_id", matchId)
      .order("game_number"),
    s.from("public_dota_match_stats").select("*").in("match_game_id",(await s.from("public_match_games").select("id").eq("match_id",matchId)).data?.map(x=>x.id)??[]),
  ]);
  if (!t || !m) notFound();
  const { data: { user } } = await s.auth.getUser();
  let canRelink = false;
  if (user) {
    const { data: member } = await s.from("tournament_members").select("id").eq("tournament_id", m.tournament_id!).eq("user_id", user.id).maybeSingle();
    if (member) {
      const { data: roles } = await s.from("tournament_member_roles").select("role").eq("member_id", member.id).in("role", ["organizer", "referee"]);
      canRelink = Boolean(roles?.length);
    }
    const { data: platformAdmin } = await s.from("platform_admins").select("user_id").eq("user_id", user.id).eq("status", "active").maybeSingle();
    canRelink ||= Boolean(platformAdmin);
  }
  const { data: externalLinks } = await s
    .from("match_external_links")
    .select("id,match_game_id,reconciliation_state,result_agrees")
    .in(
      "match_game_id",
      games?.map((game) => game.id!).filter(Boolean) ?? [],
    );
  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-6 p-4 py-10 md:p-8">
      <CompetitionLiveRefresh tournamentId={m.tournament_id!} />
      <PublicDraftNav slug={slug} />
      <header>
        <p className="text-sm uppercase tracking-[.2em] text-[var(--accent)]">
          {m.stage_name}
          {m.group_name ? " · " + m.group_name : ""} · Round {m.round_number}
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          {m.team_a_name ?? "TBD"} vs {m.team_b_name ?? "TBD"}
        </h1>
        <p className="muted mt-2">
          {m.scheduled_at
            ? new Date(m.scheduled_at).toLocaleString()
            : "Time TBD"}{" "}
          · Best of {m.best_of} · {(m.status ?? "scheduled").replaceAll("_", " ")}
        </p>
      </header>
      <Card className="grid grid-cols-3 items-center p-8 text-center">
        <strong>{m.team_a_name ?? "TBD"}</strong>
        <span className="text-4xl font-black">
          {m.team_a_score ?? "–"} : {m.team_b_score ?? "–"}
        </span>
        <strong>{m.team_b_name ?? "TBD"}</strong>
        {m.winner_name ? (
          <p className="col-span-3 mt-4 text-[var(--accent)]">
            Winner: {m.winner_name}
          </p>
        ) : null}
        {m.forfeit_team_id ? (
          <p className="col-span-3 mt-2 text-amber-300">Completed by forfeit</p>
        ) : null}
        {m.rematch_of_match_id?<p className="col-span-3 mt-2 text-[var(--accent)]">Official rematch of the previous disputed match</p>:null}
        {m.status==="rematch_ordered"?<p className="col-span-3 mt-2 text-amber-300">Rematch ordered · this result is superseded</p>:null}
      </Card>
      <section>
        <h2 className="text-xl font-bold">Games</h2>
        <div className="mt-3 space-y-2">
          {games?.length ? (
            games.map((g) => (
              <Card className="p-4" key={g.id}><div className="flex justify-between">
                <span>Game {g.game_number}</span>
                <span>
                  {g.team_a_score}–{g.team_b_score}
                  {g.replay_url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a className="text-[var(--accent)]" href={g.replay_url}>
                        Replay
                      </a>
                    </>
                  ) : null}
                </span>
                </div>{g.external_match_id?<div className="mt-2 text-xs"><p className="muted">External match {g.external_match_id} · {(externalLinks?.find(x=>x.match_game_id===g.id)?.reconciliation_state??"pending").replaceAll("_"," ")}{externalLinks?.find(x=>x.match_game_id===g.id)?.result_agrees===false?" · Result conflict":""}</p>{canRelink&&externalLinks?.find(x=>x.match_game_id===g.id)?<form action={relinkDotaMatch} className="mt-2 grid gap-2 sm:grid-cols-3"><input type="hidden" name="linkId" value={externalLinks.find(x=>x.match_game_id===g.id)!.id}/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="matchId" value={matchId}/><input name="dotaMatchId" inputMode="numeric" placeholder="Correct match ID" className="rounded border border-[var(--line)] bg-[#081016] px-2"/><input name="reason" minLength={8} placeholder="Correction reason" className="rounded border border-[var(--line)] bg-[#081016] px-2"/><button className="rounded border border-[var(--line)] px-2 py-1">Correct external link</button></form>:null}</div>:<form action={linkDotaMatch} className="mt-3 flex gap-2"><input type="hidden" name="gameId" value={g.id??""}/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="matchId" value={matchId}/><input aria-label={`Dota match ID for game ${g.game_number}`} name="dotaMatchId" inputMode="numeric" placeholder="Dota match ID" className="min-h-10 flex-1 rounded border border-[var(--line)] bg-[#081016] px-3"/><button className="rounded bg-[var(--accent)] px-3 font-semibold text-[#06110f]">Link Dota game</button></form>}{dotaStats?.filter(x=>x.match_game_id===g.id).length?<div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">{dotaStats.filter(x=>x.match_game_id===g.id).map(p=><span key={`${p.match_id}-${p.slot}`}>{p.hero_name??`Hero ${p.hero_id??"?"}`} · {p.kills??"–"}/{p.deaths??"–"}/{p.assists??"–"} · GPM {p.gpm??"–"}</span>)}</div>:null}</Card>
            ))
          ) : (
            <p className="muted">No public game details yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
