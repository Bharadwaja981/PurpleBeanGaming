import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { CaptainMatchActions } from "@/components/competition/captain-match-actions";
import { CompetitionLiveRefresh } from "@/components/competition/competition-live-refresh";
import { CompetitionNotifications } from "@/components/competition/competition-notifications";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    s = await createClient(),
    {
      data: { user },
    } = await s.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: t } = await s
    .from("tournaments")
    .select("id,name")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) notFound();
  const { data: team } = await s
    .from("teams")
    .select("id,name")
    .eq("tournament_id", t.id!)
    .eq("captain_user_id", user.id)
    .maybeSingle();
  if (!team)
    return (
      <main className="p-8">
        No captain match operations are assigned to this account.
      </main>
    );
  const { data: matches } = await s
    .from("public_matches")
    .select("id,status,scheduled_at,team_a_id,team_b_id")
    .eq("tournament_id", t.id!)
    .or("team_a_id.eq." + team.id + ",team_b_id.eq." + team.id)
    .order("scheduled_at");
  const [{ data: captainPlayer }, { data: roster }] = await Promise.all([
    s.from("tournament_players").select("id,ign").eq("tournament_id", t.id!).eq("user_id", user.id).maybeSingle(),
    s.from("team_roster").select("player_id").eq("team_id", team.id!).eq("is_active", true),
  ]);
  const rosterIds = roster?.map((row) => row.player_id) ?? [];
  const { data: recruits } = rosterIds.length
    ? await s.from("tournament_players").select("id,ign").in("id", rosterIds)
    : { data: [] };
  const players = [...(captainPlayer ? [captainPlayer] : []), ...(recruits ?? [])];
  const matchIds = matches?.flatMap((match) => match.id ? [match.id] : []) ?? [];
  const { data: notices } = await s
    .from("competition_notifications")
    .select("id,event_type,read_at,created_at")
    .eq("tournament_id", t.id!)
    .order("created_at", { ascending: false })
    .limit(20);
  const { data: submissions } = matchIds.length
    ? await s.from("match_result_submissions").select("id,match_id,submitting_team_id,status").in("match_id", matchIds).eq("status", "pending")
    : { data: [] };
  const operations = new Map<string, {name?:string;region?:string;password?:string}>();
  for (const match of matches ?? []) {
    const {data} = await s.rpc("get_match_operations", {p_match_id: match.id!});
    const lobby = data && typeof data === "object" && "lobby" in data ? data.lobby : null;
    if (lobby && typeof lobby === "object") operations.set(match.id!, lobby as {name?:string;region?:string;password?:string});
  }
  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 p-4 py-10 md:p-8">
      <CompetitionLiveRefresh tournamentId={t.id!} privateAccess />
      <h1 className="text-3xl font-bold">{team.name} Match Operations</h1>
      <p className="muted">
        Check in, confirm the rostered lineup, and report or respond to results
        through the protected match workflow.
      </p>
      <div className="space-y-3">
        {matches?.map((m) => (
          <Card className="p-5" key={m.id}>
            <div className="flex justify-between">
            <strong>{(m.status ?? "scheduled").replaceAll("_", " ")}</strong>
              <a
                className="text-[var(--accent)]"
                href={"/tournaments/" + slug + "/matches/" + m.id}
              >
                Public match
              </a>
            </div>
            <p className="muted mt-2">
              {m.scheduled_at
                ? new Date(m.scheduled_at).toLocaleString()
                : "Time TBD"}
            </p>
          {operations.get(m.id!)?.name ? (
            <p className="mt-3">
              Lobby: {operations.get(m.id!)?.name} · {operations.get(m.id!)?.region} · Password{" "}
              {operations.get(m.id!)?.password}
              </p>
            ) : null}
            <CaptainMatchActions
              matchId={m.id!}
              teamId={team.id!}
              players={players}
              pendingSubmissionId={submissions?.find((row) => row.match_id === m.id && row.submitting_team_id !== team.id)?.id}
            />
          </Card>
        ))}
      </div>
      <CompetitionNotifications notices={notices ?? []} />
    </main>
  );
}
