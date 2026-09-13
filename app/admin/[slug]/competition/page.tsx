import { notFound } from "next/navigation";
import { getOrganizedTournaments } from "@/lib/auth/organizer";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ExportResultsButton } from "@/components/competition/export-results-button";
import { CompetitionControls } from "@/components/competition/competition-controls";
import { OfficialMatchActions } from "@/components/competition/official-match-actions";
import { CompetitionLiveRefresh } from "@/components/competition/competition-live-refresh";
import { CompetitionNotifications } from "@/components/competition/competition-notifications";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const organized = await getOrganizedTournaments();
  if (!organized.some((item) => item.slug === slug)) notFound();
  const s = await createClient(),
    { data: t } = await s
      .from("tournaments")
      .select("id,name")
      .eq("slug", slug)
      .maybeSingle();
  if (!t) notFound();
  const [{ data: matches }, { data: disputes }, { data: stages }, { data: teams }] =
    await Promise.all([
      s
        .from("public_matches")
        .select("id,status,scheduled_at,team_a_id,team_b_id,team_a_name,team_b_name")
        .eq("tournament_id", t.id!)
        .order("scheduled_at"),
      s
        .from("match_disputes")
        .select("id,status,match_id,created_at")
        .eq("status", "open"),
      s
        .from("competition_stages")
        .select("id,name,is_complete")
        .eq("tournament_id", t.id!),
      s.from("teams").select("id,name").eq("tournament_id", t.id!).order("id"),
    ]);
  const matchIds = (matches ?? []).flatMap((match) => (match.id ? [match.id] : []));
  const [{ data: checkIns }, { data: lineups }, { data: submissions }] =
    matchIds.length
      ? await Promise.all([
          s.from("match_check_ins").select("match_id,team_id").in("match_id", matchIds),
          s.from("match_lineups").select("match_id,team_id").in("match_id", matchIds),
          s
            .from("match_result_submissions")
            .select("match_id,status")
            .in("match_id", matchIds)
            .eq("status", "pending"),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];
  const actionable = (matches ?? []).filter((m) =>
    !["completed", "forfeit", "cancelled", "superseded", "rematch_ordered"].includes(
      m.status ?? "",
    ) &&
    (["check_in", "awaiting_confirmation", "disputed"].includes(m.status ?? "") ||
      checkIns?.some((entry) => entry.match_id === m.id) ||
      lineups?.some((entry) => entry.match_id === m.id) ||
      submissions?.some((entry) => entry.match_id === m.id)),
  );
  const { data: notices } = await s
    .from("competition_notifications")
    .select("id,event_type,read_at,created_at")
    .eq("tournament_id", t.id!)
    .order("created_at", { ascending: false })
    .limit(20);
  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 p-4 py-10 md:p-8">
      <CompetitionLiveRefresh tournamentId={t.id!} privateAccess />
      <header>
        <p className="text-sm uppercase tracking-[.2em] text-[var(--accent)]">
          Organizer operations
        </p>
        <h1 className="mt-2 text-3xl font-bold">{t.name} Competition</h1>
      </header>
      <div className="flex flex-wrap gap-3">
        <ExportResultsButton tournamentId={t.id!} kind="matches" />
        <ExportResultsButton tournamentId={t.id!} kind="standings" />
      </div>
      <CompetitionControls tournamentId={t.id!} teams={teams ?? []} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="muted text-sm">Actionable matches</p>
          <strong className="text-3xl">{actionable.length}</strong>
        </Card>
        <Card className="p-5">
          <p className="muted text-sm">Open disputes</p>
          <strong className="text-3xl">{disputes?.length ?? 0}</strong>
        </Card>
        <Card className="p-5">
          <p className="muted text-sm">Stages complete</p>
          <strong className="text-3xl">
            {stages?.filter((x) => x.is_complete).length ?? 0}/
            {stages?.length ?? 0}
          </strong>
        </Card>
      </div>
      <section>
        <h2 className="text-xl font-bold">Operational queue</h2>
        <div className="mt-3 space-y-2">
          {actionable.map((m) => (
            <Card className="p-4" key={m.id}>
              <div className="flex justify-between"><span>{m.team_a_name??"TBD"} vs {m.team_b_name??"TBD"} · {(m.status ?? "scheduled").replaceAll("_", " ")}</span><a
                className="text-[var(--accent)]"
                href={"/tournaments/" + slug + "/matches/" + m.id}
              >
                Open match
              </a></div>
              <p className="muted mt-2 text-xs">
                Check-ins {new Set(checkIns?.filter((entry) => entry.match_id === m.id).map((entry) => entry.team_id)).size}/2
                {" · "}Lineups {new Set(lineups?.filter((entry) => entry.match_id === m.id).map((entry) => entry.team_id)).size}/2
                {submissions?.some((entry) => entry.match_id === m.id) ? " · Result pending" : ""}
              </p>
              <OfficialMatchActions matchId={m.id!} teamAId={m.team_a_id??undefined} teamBId={m.team_b_id??undefined} disputeId={disputes?.find(d=>d.match_id===m.id)?.id} />
            </Card>
          ))}
        </div>
      </section>
      <CompetitionNotifications notices={notices ?? []} />
    </main>
  );
}
