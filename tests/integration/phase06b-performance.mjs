import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SECRET_KEY: secret } = process.env;
assert(url && anon && secret);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const organizer = createClient(url, anon, options);
assert.ifError((await organizer.auth.signInWithPassword({ email: "player1@draftgg.test", password: "development-only" })).error);
const tid = "10000000-0000-4000-8000-000000000001";
const results = [];

for (const size of [6, 16, 100]) {
  assert.ifError((await admin.from("matches").delete().eq("tournament_id", tid)).error);
  assert.ifError((await admin.from("competition_stages").delete().eq("tournament_id", tid)).error);
  assert.ifError((await admin.from("competition_settings").delete().eq("tournament_id", tid)).error);
  assert.ifError((await admin.from("teams").delete().eq("tournament_id", tid).like("short_tag", "PX%")).error);
  if (size > 6) {
    const extras = Array.from({ length: size - 6 }, (_, index) => ({
      tournament_id: tid,
      name: `Performance Extra ${index + 1}`,
      short_tag: `PX${index + 1}`,
      captain_user_id: "00000000-0000-4000-8000-000000000030",
      starting_credits: 1000,
      credits_remaining: 1000,
      captain_mmr: 2000,
      current_team_mmr: 2000,
      max_roster_size: 5,
    }));
    assert.ifError((await admin.from("teams").insert(extras)).error);
  }
  assert.ifError((await organizer.rpc("configure_competition", { p_tournament_id: tid, p_format: "single_elimination" })).error);
  const generationStarted = performance.now();
  const generated = await organizer.rpc("generate_competition_schedule", { p_tournament_id: tid, p_scheduled_start: new Date().toISOString(), p_interval_minutes: 60 });
  const generationMs = performance.now() - generationStarted;
  assert.ifError(generated.error);
  assert.equal(generated.data, size - 1);
  const readStarted = performance.now();
  const schedule = await admin.from("public_matches").select("id,status,round_number,match_number,team_a_name,team_b_name").eq("tournament_id", tid).order("round_number").order("match_number");
  const publicReadMs = performance.now() - readStarted;
  assert.ifError(schedule.error);
  assert.equal(schedule.data.length, size - 1);
  assert(generationMs < 5_000 && publicReadMs < 2_000, `performance threshold exceeded for ${size} teams`);
  results.push({ teams: size, matches: generated.data, generationMs: Math.round(generationMs), publicReadMs: Math.round(publicReadMs) });
}

assert.ifError((await admin.from("matches").delete().eq("tournament_id", tid)).error);
assert.ifError((await admin.from("competition_stages").delete().eq("tournament_id", tid)).error);
assert.ifError((await admin.from("competition_settings").delete().eq("tournament_id", tid)).error);
assert.ifError((await admin.from("teams").delete().eq("tournament_id", tid).like("short_tag", "PX%")).error);
console.log(JSON.stringify({ result: "PASS", thresholdsMs: { generation: 5000, publicRead: 2000 }, results }));
