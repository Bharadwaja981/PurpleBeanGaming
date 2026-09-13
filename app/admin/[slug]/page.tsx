import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTournament, requireUser } from "@/lib/tournament/data";
import {
  assignCaptain,
  createTeam,
  lockPool,
  resolveAppeal,
  reviewPlayer,
} from "./actions";
export default async function TournamentAdmin({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ tournament }, { supabase, user }] = await Promise.all([
    getTournament(slug),
    requireUser(),
  ]);
  const { data: m } = await supabase
    .from("tournament_members")
    .select("id")
    .eq("tournament_id", tournament.id)
    .eq("user_id", user.id)
    .single();
  const { data: role } = m
    ? await supabase
        .from("tournament_member_roles")
        .select("role")
        .eq("member_id", m.id)
        .eq("role", "organizer")
        .maybeSingle()
    : { data: null };
  if (!role) redirect("/dashboard");
  const [
    { data: players },
    { data: teams },
    { data: appeals },
    { data: rules },
    { count: evidenceCount },
    { data: signals },
  ] = await Promise.all([
    supabase
      .from("tournament_players")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("ign"),
    supabase.from("teams").select("*").eq("tournament_id", tournament.id),
    supabase
      .from("appeals")
      .select("id,status,appeal_type,reason")
      .eq("tournament_id", tournament.id),
    supabase
      .from("tournament_rules")
      .select("*")
      .eq("tournament_id", tournament.id)
      .single(),
    supabase
      .from("player_evidence")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournament.id),
    supabase
      .from("organizer_rating_review_summary")
      .select("player_id,assessment,review_count")
      .eq("tournament_id", tournament.id),
  ]);
  const captains =
    players?.filter((p) =>
      teams?.some((t) => t.captain_user_id === p.user_id),
    ) ?? [];
  const ready = [
    ["Players registered", players?.length ?? 0],
    [
      "Players verified",
      players?.filter(
        (p) => p.rating_status === "verified" || p.rating_status === "locked",
      ).length ?? 0,
    ],
    ["Players eligible", players?.filter((p) => p.is_eligible).length ?? 0],
    ["Evidence files", evidenceCount ?? 0],
    [
      "Ratings locked",
      players?.filter((p) => p.rating_status === "locked").length ?? 0,
    ],
    [
      "Blocking appeals",
      appeals?.filter(
        (a) => a.status === "submitted" || a.status === "under_review",
      ).length ?? 0,
    ],
    ["Captains assigned", captains.length],
    [
      "Captains confirmed",
      teams?.filter((t) => t.confirmation_status === "confirmed").length ?? 0,
    ],
    ["Teams created", teams?.length ?? 0],
    ["Rules configured", rules ? 1 : 0],
    ["Player pool locked", tournament.status === "player_pool_locked" ? 1 : 0],
  ];
  return (
    <AppShell slug={slug}>
      <p className="text-sm font-semibold text-[var(--accent)]">
        Organizer control
      </p>
      <h1 className="mt-2 text-3xl font-bold">Pre-draft readiness</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ready.map(([k, v]) => (
          <Card key={String(k)}>
            <p className="muted text-xs">{k}</p>
            <p className="mt-2 text-2xl font-bold">{v}</p>
          </Card>
        ))}
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Player", "MMR review", "Decision", "Captain"].map((x) => (
                  <th className="px-4 py-3 text-left muted" key={x}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players?.map((p) => (
                <tr className="border-t border-[var(--line)]" key={p.id}>
                  <td className="px-4 py-3">
                    <b>{p.ign}</b>
                    <br />
                    <span className="muted">Declared {p.declared_mmr}</span>
                    <br />
                    <span className="muted text-xs">
                      Signals:{" "}
                      {signals
                        ?.filter((s) => s.player_id === p.id)
                        .map((s) => `${s.assessment} (${s.review_count})`)
                        .join(", ") || "none"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <form
                      action={reviewPlayer}
                      className="flex min-w-[360px] gap-2"
                    >
                      <input type="hidden" name="playerId" value={p.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <Input
                        name="verified"
                        type="number"
                        defaultValue={p.verified_mmr ?? p.declared_mmr ?? 0}
                      />
                      <Input
                        name="peak"
                        type="number"
                        defaultValue={p.recent_peak_mmr ?? 0}
                      />
                      <Input
                        name="tournamentMmr"
                        type="number"
                        defaultValue={p.tournament_mmr ?? 0}
                      />
                      <select
                        name="confidence"
                        defaultValue={p.rating_confidence ?? "medium"}
                        className="rounded border border-[var(--line)] bg-[#081016]"
                      >
                        <option>low</option>
                        <option>medium</option>
                        <option>high</option>
                      </select>
                      <select
                        name="decision"
                        className="rounded border border-[var(--line)] bg-[#081016]"
                      >
                        <option value="verify">Verify</option>
                        <option value="review_required">Review required</option>
                        <option value="request_evidence">
                          Request evidence
                        </option>
                        <option value="reject">Reject</option>
                      </select>
                      <Button>Save</Button>
                    </form>
                  </td>
                  <td className="px-4 py-3">{p.rating_status}</td>
                  <td className="px-4 py-3">
                    <form action={assignCaptain}>
                      <input
                        type="hidden"
                        name="tournamentId"
                        value={tournament.id}
                      />
                      <input type="hidden" name="userId" value={p.user_id} />
                      <input type="hidden" name="slug" value={slug} />
                      <Button variant="secondary">Assign</Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="space-y-5">
          <Card>
            <h2 className="font-bold">Create team</h2>
            <form action={createTeam} className="mt-4 space-y-3">
              <input type="hidden" name="tournamentId" value={tournament.id} />
              <input type="hidden" name="slug" value={slug} />
              <Input name="name" required placeholder="Team name" />
              <Input name="tag" required maxLength={6} placeholder="TAG" />
              <Input name="accent" type="color" defaultValue="#2dd4a7" />
              <Input
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
              />
              <select
                name="captain"
                required
                className="min-h-11 w-full rounded-lg border border-[var(--line)] bg-[#081016] px-3"
              >
                {players?.map((p) => (
                  <option key={p.id} value={p.user_id}>
                    {p.ign}
                  </option>
                ))}
              </select>
              <Button>Create team</Button>
            </form>
          </Card>
          <Card>
            <h2 className="font-bold">Open appeals</h2>
            <div className="mt-3 space-y-3">
              {appeals
                ?.filter(
                  (a) =>
                    a.status === "submitted" || a.status === "under_review",
                )
                .map((a) => (
                  <form
                    action={resolveAppeal}
                    className="rounded border border-[var(--line)] p-3"
                    key={a.id}
                  >
                    <input type="hidden" name="appealId" value={a.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <p className="text-sm font-semibold">{a.appeal_type}</p>
                    <p className="muted my-2 text-xs">{a.reason}</p>
                    <Input
                      name="resolution"
                      required
                      minLength={10}
                      placeholder="Resolution note"
                    />
                    <div className="mt-2 flex gap-2">
                      <Button name="decision" value="approve">
                        Approve
                      </Button>
                      <Button
                        name="decision"
                        value="reject"
                        variant="secondary"
                      >
                        Reject
                      </Button>
                    </div>
                  </form>
                ))}
            </div>
          </Card>
          <Card>
            <h2 className="font-bold">Lock player pool</h2>
            <p className="muted my-3 text-sm">
              Database preconditions block incomplete ratings, appeals, captain
              confirmations, teams, or rules.
            </p>
            <form action={lockPool}>
              <input type="hidden" name="tournamentId" value={tournament.id} />
              <input type="hidden" name="slug" value={slug} />
              <Button>Lock player pool</Button>
            </form>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
