import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;
assert(url && anonKey && serviceKey);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options), anon = createClient(url, anonKey, options);
const player = "00000000-0000-4000-8000-000000000030";
await admin.from("player_achievements").delete().eq("player_id", player).eq("achievement_code", "FIRST_MATCH").is("tournament_id", null).is("match_id", null);
assert.ifError((await admin.from("player_competitive_ratings").upsert({ player_id: player, rating_version: "draftgg_rating_v1", rating: 1000, uncertainty: 350, matches_count: 0, wins: 0, losses: 0, status: "provisional" })).error);
function nextEvent(table, event, accept = () => true) {
  let readyResolve, readyReject, eventResolve, eventReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const eventPromise = new Promise((resolve, reject) => { eventResolve = resolve; eventReject = reject; });
  const timer = setTimeout(() => eventReject(new Error(`${table} event timed out`)), 20000);
  admin.channel(`phase07b-${table}-${Date.now()}`).on("postgres_changes", { event, schema: "public", table, filter: `player_id=eq.${player}` }, payload => { if (accept(payload)) { clearTimeout(timer); eventResolve(payload); } }).subscribe(status => {
    if (status === "SUBSCRIBED") readyResolve("subscribed");
    if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) readyReject(new Error(`${table} ${status}`));
  });
  return { ready, eventPromise };
}
const rating = nextEvent("player_competitive_ratings", "UPDATE", payload => Number(payload.new.rating) === 1012), achievement = nextEvent("player_achievements", "INSERT", payload => payload.new.achievement_code === "FIRST_MATCH");
await Promise.all([rating.ready, achievement.ready]);
assert.ifError((await admin.from("player_competitive_ratings").update({ rating: 1012, updated_at: new Date().toISOString() }).eq("player_id", player).eq("rating_version", "draftgg_rating_v1")).error);
assert.ifError((await admin.rpc("process_achievement", { p_player: player, p_code: "FIRST_MATCH", p_tournament: null, p_match: null })).error);
const [ratingEvent, achievementEvent] = await Promise.all([rating.eventPromise, achievement.eventPromise]);
assert.equal(Number(ratingEvent.new.rating), 1012);
assert.equal(achievementEvent.new.achievement_code, "FIRST_MATCH");
const slug = (await admin.from("profiles").select("public_slug").eq("id", player).single()).data.public_slug;
assert.equal((await anon.from("public_player_leaderboard").select("competitive_rating").eq("public_slug", slug).single()).data.competitive_rating, 1012);
assert.equal((await anon.from("public_player_achievements").select("code").eq("public_slug", slug).eq("code", "FIRST_MATCH").single()).data.code, "FIRST_MATCH");
await admin.removeAllChannels();
console.log(JSON.stringify({ result: "PASS", ratingRealtime: "PASS", achievementRealtime: "PASS", leaderboardReload: "PASS", achievementReload: "PASS" }));
