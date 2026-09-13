import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SECRET_KEY: secret } = process.env;
assert(url && anon && secret, "Supabase test environment is required");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const listener = createClient(url, anon, options);
const admin = createClient(url, secret, options);
const tournamentId = "10000000-0000-4000-8000-000000000001";
const stage = await admin.from("competition_stages").insert({ tournament_id: tournamentId, name: `Realtime ${Date.now()}`, stage_type: "league", sequence_number: Math.floor(Date.now() / 1000) }).select("id").single();
assert.ifError(stage.error);
const match = await admin.from("matches").insert({ tournament_id: tournamentId, stage_id: stage.data.id, round_number: 1, match_number: 1, team_a_id: "40000000-0000-4000-8000-000000000001", team_b_id: "40000000-0000-4000-8000-000000000002", best_of: 3 }).select("id").single();
assert.ifError(match.error);

const received = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("safe match broadcast timed out")), 20_000);
  listener.channel(`tournament:${tournamentId}`)
    .on("broadcast", { event: "match_update" }, payload => {
      if (payload.payload?.match_id !== match.data.id) return;
      clearTimeout(timer);
      resolve(payload.payload);
    })
    .subscribe(async status => {
      if (status === "SUBSCRIBED") {
        await new Promise(resolve => setTimeout(resolve, 2_000));
        const result = await admin.from("matches").update({ status: "live" }).eq("id", match.data.id);
        if (result.error) reject(result.error);
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(`Realtime ${status}`));
    });
});
const payload = await received;
assert.equal(payload.status, "live");
assert.equal(payload.lobby_password, undefined, "broadcast must not leak lobby password");
assert.deepEqual(Object.keys(payload).sort(), ["id", "match_id", "revision", "scheduled_at", "status", "team_a_score", "team_b_score", "winner_team_id"].sort());
await listener.removeAllChannels();
await admin.from("matches").delete().eq("id", match.data.id);
await admin.from("competition_stages").delete().eq("id", stage.data.id);
console.log(JSON.stringify({ result: "PASS", broadcast: "received", privacy: "safe" }));
