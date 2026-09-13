import { AppShell } from "@/components/layout/app-shell";
import { getOrganizedTournaments } from "@/lib/auth/organizer";

export default async function AdminPage() {
  const tournaments = await getOrganizedTournaments();
  return <AppShell><h1 className="text-3xl font-bold">Organizer administration</h1><p className="muted mt-2">Only tournaments where you hold the organizer role are shown.</p><div className="mt-6 space-y-3">{tournaments.map(tournament => <div className="card p-5" key={tournament.id}><h2 className="font-semibold">{tournament.name}</h2><p className="muted mt-1 text-sm">{tournament.status}</p></div>)}</div></AppShell>;
}
