import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { validateEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const expected = process.env.READINESS_SECRET ?? "";
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!expected || expected.length !== provided.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const environment = validateEnvironment({ production: process.env.VERCEL_ENV === "production", server: true });
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const [{ error: database }, { data: providers }, { count: jobBacklog }] = await Promise.all([
    db.from("profiles").select("id", { head: true, count: "exact" }).limit(1),
    db.from("external_provider_health").select("provider,status,circuit_state,last_success_at,last_failure_at"),
    db.from("external_sync_jobs").select("id", { head: true, count: "exact" }).in("status", ["queued", "retry_scheduled"]),
  ]);
  const ready = environment.ok && !database;
  return Response.json({ status: ready ? "ready" : "not_ready", environment, checks: { database: database ? "unavailable" : "ok", providers, externalJobBacklog: jobBacklog ?? 0 }, timestamp: new Date().toISOString() }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
