import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key } = process.env;
assert(url && key, "SUPABASE_URL and SUPABASE_ANON_KEY are required");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
assert.ifError((await client.auth.signInWithPassword({ email: "player1@draftgg.test", password: "development-only" })).error);
const tournamentId = "10000000-0000-4000-8000-000000000001";
const timings = [];
for (let index = 0; index < 31; index += 1) {
  const started = performance.now();
  const result = await client.rpc("is_draft_state_feasible", { p_tournament_id: tournamentId });
  assert.ifError(result.error);
  assert.equal(result.data.feasible, true);
  if (index > 0) timings.push(performance.now() - started);
}
timings.sort((a, b) => a - b);
const medianMs = timings[Math.floor(timings.length / 2)];
const p95Ms = timings[Math.floor(timings.length * 0.95)];
assert(medianMs < 50, `median feasibility latency ${medianMs.toFixed(2)}ms exceeded 50ms`);
assert(p95Ms < 100, `p95 feasibility latency ${p95Ms.toFixed(2)}ms exceeded 100ms`);
console.log(JSON.stringify({ result: "PASS", runs: timings.length, medianMs: Number(medianMs.toFixed(2)), p95Ms: Number(p95Ms.toFixed(2)) }));
