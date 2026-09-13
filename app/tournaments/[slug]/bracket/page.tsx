import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicDraftNav } from "@/components/draft/public-nav";
import { CompetitionLiveRefresh } from "@/components/competition/competition-live-refresh";
import { Card } from "@/components/ui/card";
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
  const { data: matches } = await s
    .from("public_matches")
    .select("*")
    .eq("tournament_id", t.id!)
    .in("stage_type", ["knockout", "grand_final"])
    .order("round_number")
    .order("match_number");
  const { data: result } = await s
    .from("competition_result_snapshots")
    .select("champion_team_id,runner_up_team_id,created_at")
    .eq("tournament_id", t.id!)
    .maybeSingle();
  const resultTeamIds = [result?.champion_team_id, result?.runner_up_team_id].filter(
    (id): id is string => Boolean(id),
  );
  const { data: resultTeams } = resultTeamIds.length
    ? await s.from("public_teams").select("id,name").in("id", resultTeamIds)
    : { data: [] };
  const resultTeamName = new Map(
    (resultTeams ?? []).map((team) => [team.id, team.name]),
  );
  const rounds = Map.groupBy(matches ?? [], (m) => m.round_number);
  const firstRound = rounds.get(1) ?? [];
  const firstRoundTeamIds = new Set(
    firstRound.flatMap((match) => [match.team_a_id, match.team_b_id]),
  );
  const byeTeams = (rounds.get(2) ?? [])
    .flatMap((match) => [
      match.team_a_id ? { id: match.team_a_id, name: match.team_a_name } : null,
      match.team_b_id ? { id: match.team_b_id, name: match.team_b_name } : null,
    ])
    .filter(
      (team): team is { id: string; name: string | null } =>
        Boolean(team && !firstRoundTeamIds.has(team.id)),
    );
  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-6 p-4 py-10 md:p-8">
      <CompetitionLiveRefresh tournamentId={t.id!} />
      <PublicDraftNav slug={slug} />
      <h1 className="text-3xl font-bold">{t.name} Bracket</h1>
      {result ? (
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <p className="muted text-xs uppercase tracking-widest">Champion</p>
            <p className="mt-1 text-xl font-bold">
              {result.champion_team_id
                ? (resultTeamName.get(result.champion_team_id) ?? "Unknown team")
                : "—"}
            </p>
          </div>
          <div>
            <p className="muted text-xs uppercase tracking-widest">Runner-up</p>
            <p className="mt-1 text-xl font-bold">
              {result.runner_up_team_id
                ? (resultTeamName.get(result.runner_up_team_id) ?? "Unknown team")
                : "—"}
            </p>
          </div>
        </Card>
      ) : null}
      <p className="muted">
        Winners advance only after a result becomes canonical. Round lists
        remain usable at every viewport.
      </p>
      {byeTeams.length ? (
        <section aria-labelledby="bye-seeds">
          <h2 id="bye-seeds" className="mb-3 text-xl font-bold">Bye seeds</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {byeTeams.map((team) => (
              <Card className="p-4" key={team.id}>
                <p className="font-semibold">{team.name ?? "Qualified team"}</p>
                <p className="muted mt-1 text-xs uppercase">
                  Bye to Round 2 · no check-in or result required
                </p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[...rounds].map(([round, items]) => (
          <section key={round}>
            <h2 className="mb-3 font-bold">Round {round}</h2>
            <div className="space-y-3">
              {items.map((m) => (
                <Card className="p-4" key={m.id}>
                  <p>
                    {m.team_a_name ?? "TBD"}{" "}
                    <strong>{m.team_a_score ?? "–"}</strong>
                  </p>
                  <p>
                    {m.team_b_name ?? "TBD"}{" "}
                    <strong>{m.team_b_score ?? "–"}</strong>
                  </p>
                  <p className="muted mt-2 text-xs uppercase">
                    {(m.status ?? "scheduled").replaceAll("_", " ")}
                  </p>
                  {(m.team_a_id&&!m.team_b_id)||(!m.team_a_id&&m.team_b_id)?<p className="mt-2 text-xs text-amber-300">Bye awarded · opponent pending</p>:null}
                  {m.rematch_of_match_id?<p className="mt-2 text-xs text-[var(--accent)]">Official rematch</p>:null}
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
