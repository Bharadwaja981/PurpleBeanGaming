import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicDraftNav } from "@/components/draft/public-nav";
import { CompetitionLiveRefresh } from "@/components/competition/competition-live-refresh";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    s = await createClient();
  const { data: t } = await s
    .from("public_tournament_summary")
    .select("id,name")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) notFound();
  const [{ data: rows }, { data: settings }] = await Promise.all([
    s
      .from("public_competition_rankings")
      .select("*")
      .eq("tournament_id", t.id!)
      .order("position"),
    s
      .from("competition_settings")
      .select("tiebreak_rules")
      .eq("tournament_id", t.id!)
      .maybeSingle(),
  ]);
  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 p-4 py-10 md:p-8">
      <CompetitionLiveRefresh tournamentId={t.id!} />
      <PublicDraftNav slug={slug} />
      <h1 className="text-3xl font-bold">{t.name} Standings</h1>
      <p className="muted">
        Tiebreak order:{" "}
        {Array.isArray(settings?.tiebreak_rules)
          ? settings.tiebreak_rules.join(" → ")
          : "points → head-to-head → game difference → games won"}
      </p>
      <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
        <table className="w-full min-w-[650px] text-left">
          <thead>
            <tr>
              {["#", "Team", "Played", "W", "L", "Points", "Games", "Diff"].map(
                (x) => (
                  <th className="p-3" key={x}>
                    {x}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => (
              <tr
                className="border-t border-[var(--line)]"
                key={String(r.group_id) + "-" + r.team_id}
              >
                <td className="p-3">{r.position}</td>
                <td>{r.team_name}</td>
                <td>{r.played}</td>
                <td>{r.wins}</td>
                <td>{r.losses}</td>
                <td>{r.points}</td>
                <td>
                  {r.games_won}–{r.games_lost}
                </td>
                <td>{r.game_difference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
