import { createClient } from "@/lib/supabase/server";

const exports = {
  matches: "export_match_results_csv",
  standings: "export_standings_csv",
} as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tournamentId = url.searchParams.get("tournamentId");
  const kind = url.searchParams.get("kind");

  if (!tournamentId || (kind !== "matches" && kind !== "standings")) {
    return new Response("Invalid export request", { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(exports[kind], {
    p_tournament_id: tournamentId,
  });

  if (error || !data) {
    return new Response("Export unavailable", { status: 403 });
  }

  return new Response(data, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="purplebean-${kind}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
