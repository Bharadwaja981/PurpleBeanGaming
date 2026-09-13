import { AppShell } from "@/components/layout/app-shell";
import { getTournament, requireUser } from "@/lib/tournament/data";
import { RegistrationForm } from "./registration-form";
export default async function RegisterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ tournament }, { supabase, user }] = await Promise.all([
    getTournament(slug),
    requireUser(),
  ]);
  const { data: player } = await supabase
    .from("tournament_players")
    .select("*")
    .eq("tournament_id", tournament.id)
    .eq("user_id", user.id)
    .maybeSingle();
  return (
    <AppShell slug={slug}>
      <p className="page-kicker">
        {tournament.name}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title font-bold">Player registration</h1>
          <p className="muted mt-2">
            Complete your competitive profile and submit MMR evidence.
          </p>
        </div>
        <span className="muted text-sm">Status: {tournament.status}</span>
      </div>
      <ol aria-label="Registration progress" className="mt-8 grid grid-cols-2 gap-2 text-center text-xs font-bold sm:grid-cols-4"><li className="rounded-full bg-emerald-500/70 px-3 py-2">1 Profile</li><li className="rounded-full bg-emerald-500/70 px-3 py-2">2 Game account</li><li className="rounded-full bg-[var(--accent)] px-3 py-2">3 Eligibility</li><li className="rounded-full bg-[#172238] px-3 py-2">4 Review</li></ol>
      <RegistrationForm
        tournamentId={tournament.id}
        userId={user.id}
        editable={tournament.status === "registration"}
        initial={player}
      />
    </AppShell>
  );
}
