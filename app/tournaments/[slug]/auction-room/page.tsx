import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import { AuctionRoom } from "./auction-room";

export default async function AuctionRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: tournament } = await supabase.from("public_tournament_summary").select("id,name").eq("slug", slug).single();
  if (!tournament?.id) notFound();

  const [{ data: initialState, error }, { data: players }] = await Promise.all([
    supabase.rpc("get_current_auction_state", { p_tournament_id: tournament.id }),
    supabase.from("public_player_pool").select("id,ign,tournament_mmr,primary_role,is_drafted").eq("tournament_id", tournament.id).eq("is_drafted", false).order("ign"),
  ]);
  if (error) throw error;
  const availablePlayers = (players ?? []).flatMap(player => player.id && player.ign ? [{
    id: player.id,
    ign: player.ign,
    tournament_mmr: player.tournament_mmr,
    primary_role: player.primary_role,
    is_drafted: Boolean(player.is_drafted),
  }] : []);

  return <AppShell slug={slug}><AuctionRoom tournamentId={tournament.id} initialState={initialState} players={availablePlayers} /></AppShell>;
}
