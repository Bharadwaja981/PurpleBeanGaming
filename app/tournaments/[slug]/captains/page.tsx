import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTournament, requireUser } from "@/lib/tournament/data";
import { availableTeamMmr } from "@/lib/tournament/readiness";
import { confirmCaptain } from "../actions";
export default async function CaptainsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ supabase, tournament }, { user }] = await Promise.all([
    getTournament(slug),
    requireUser(),
  ]);
  const [{ data: teams }, { data: rules }, { data: players }] =
    await Promise.all([
      supabase.from("teams").select("*").eq("tournament_id", tournament.id),
      supabase
        .from("tournament_rules")
        .select("*")
        .eq("tournament_id", tournament.id)
        .single(),
      supabase
        .from("tournament_players")
        .select("user_id,ign,primary_role,secondary_role")
        .eq("tournament_id", tournament.id),
    ]);
  return (
    <AppShell slug={slug}>
      <h1 className="text-3xl font-bold">Captains & teams</h1>
      <p className="muted mt-2">
        Team identity, captain deduction, and pre-draft confirmation.
      </p>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {teams?.map((team) => {
          const captain = players?.find(
            (p) => p.user_id === team.captain_user_id,
          );
          const available = availableTeamMmr(
            rules?.mmr_target ?? null,
            team.captain_mmr,
          );
          const own = team.captain_user_id === user.id;
          return (
            <Card key={team.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: team.accent_color ?? "var(--accent)" }}
                  >
                    {team.short_tag}
                  </p>
                  <h2 className="mt-1 text-xl font-bold">{team.name}</h2>
                  <p className="muted mt-1 text-sm">
                    Captain: {captain?.ign ?? "Assigned"}
                  </p>
                </div>
                <Badge
                  tone={
                    team.confirmation_status === "confirmed"
                      ? "success"
                      : "warning"
                  }
                >
                  {team.confirmation_status}
                </Badge>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <Metric label="Captain MMR" value={team.captain_mmr} />
                <Metric label="Available MMR" value={available ?? "—"} />
                <Metric label="Team target" value={rules?.mmr_target ?? "—"} />
                <Metric
                  label="Allowed range"
                  value={`${rules?.mmr_min ?? "—"}–${rules?.mmr_max ?? "—"}`}
                />
                <Metric
                  label="Starting credits"
                  value={team.starting_credits}
                />
                <Metric
                  label="Preferred roles"
                  value={
                    [captain?.primary_role, captain?.secondary_role]
                      .filter(Boolean)
                      .join(" / ") || "—"
                  }
                />
              </dl>
              {own && team.confirmation_status !== "confirmed" && (
                <form
                  action={confirmCaptain}
                  className="mt-5 space-y-2 border-t border-[var(--line)] pt-4 text-sm"
                >
                  <input type="hidden" name="teamId" value={team.id} />
                  <input type="hidden" name="slug" value={slug} />
                  {[
                    "I confirm my participation and availability",
                    "I approve the team identity",
                    "I accept the tournament rules and captain responsibilities",
                  ].map((label) => (
                    <label className="flex gap-2" key={label}>
                      <input type="checkbox" required />
                      {label}
                    </label>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <Button name="decision" value="confirm">
                      Confirm captain role
                    </Button>
                    <Button name="decision" value="decline" variant="secondary">
                      Decline
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="muted text-xs">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
