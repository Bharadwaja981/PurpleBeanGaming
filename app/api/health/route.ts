import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";
export async function GET() {
  const started = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ status: "unavailable", checks: { database: "unconfigured" } }, { status: 503 });
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });
  const { error } = await db.from("public_tournament_summary").select("id", { head: true, count: "exact" }).limit(1);
  return Response.json(
    { status: error ? "degraded" : "ok", checks: { database: error ? "unavailable" : "ok" }, durationMs: Date.now() - started, timestamp: new Date().toISOString() },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
