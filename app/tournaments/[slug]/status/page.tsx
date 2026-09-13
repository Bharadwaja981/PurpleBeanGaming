import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getTournament, requireUser } from "@/lib/tournament/data";
import { AppealForm } from "./appeal-form";
export default async function StatusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ tournament }, { supabase, user }] = await Promise.all([
    getTournament(slug),
    requireUser(),
  ]);
  const { data: p } = await supabase
    .from("tournament_players")
    .select("*")
    .eq("tournament_id", tournament.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: appeals } = p
    ? await supabase
        .from("appeals")
        .select("status,appeal_type")
        .eq("player_id", p.id)
    : { data: [] };
  const { data: evidence } = p
    ? await supabase.from("player_evidence").select("id").eq("player_id", p.id)
    : { data: [] };
  const appealOpen =
    ["verification", "rating_review"].includes(tournament.status) &&
    (!tournament.appeals_close_at ||
      new Date(tournament.appeals_close_at) > new Date());
  return (
    <AppShell slug={slug}>
      <h1 className="text-3xl font-bold">Player status</h1>
      {!p ? (
        <Card className="mt-6">
          <p className="muted">You have not registered for this tournament.</p>
        </Card>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Registration", p.registration_status],
              ["Verification", p.rating_status],
              ["Current MMR", p.declared_mmr ?? "Pending"],
              ["Verified MMR", p.verified_mmr ?? "Pending"],
              ["Recent peak", p.recent_peak_mmr ?? "Pending"],
              ["Tournament MMR", p.tournament_mmr ?? "Pending"],
              ["Confidence", p.rating_confidence ?? "Pending"],
              ["Eligibility", p.is_eligible ? "Eligible" : "Not eligible"],
              ["Availability", p.availability_status],
              ["Evidence", `${evidence?.length ?? 0} file(s)`],
              ["Appeal", appeals?.at(-1)?.status ?? "None"],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <p className="muted text-xs uppercase tracking-wider">
                  {label}
                </p>
                <div className="mt-3">
                  <Badge
                    tone={
                      String(value).match(/approved|verified|eligible|locked/i)
                        ? "success"
                        : "neutral"
                    }
                  >
                    {value}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
          <AppealForm playerId={p.id} enabled={appealOpen} />
        </>
      )}
    </AppShell>
  );
}
