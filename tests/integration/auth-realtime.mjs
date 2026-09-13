import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
assert(url && key, "SUPABASE_URL and SUPABASE_ANON_KEY are required");
const email = `phase01b-${Date.now()}@draftgg.test`;
const password = "DraftGG-test-only-47!";
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: signup, error: signupError } = await client.auth.signUp({ email, password });
assert.ifError(signupError);
assert(signup.user, "sign-up did not return a user");
const { data: profile, error: profileError } = await client.from("profiles").select("id").eq("id", signup.user.id).single();
assert.ifError(profileError);
assert.equal(profile.id, signup.user.id, "auth trigger did not create profile");

const restored = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: restoreError } = await restored.auth.setSession({ access_token: signup.session.access_token, refresh_token: signup.session.refresh_token });
assert.ifError(restoreError);
assert.equal((await restored.auth.getUser()).data.user?.id, signup.user.id, "session restoration failed");
assert.ifError((await restored.auth.signOut()).error);
assert.equal((await restored.auth.getSession()).data.session, null, "logout did not clear session");

const { error: loginError } = await client.auth.signInWithPassword({ email, password });
assert.ifError(loginError);
const { data: duplicateCheck, error: duplicateError } = await client.from("profiles").select("id").eq("id", signup.user.id);
assert.ifError(duplicateError);
assert.equal(duplicateCheck.length, 1, "repeat login created duplicate profile");

const organizer = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
assert.ifError((await organizer.auth.signInWithPassword({ email: "player1@draftgg.test", password: "development-only" })).error);
const organizerSession = (await organizer.auth.getSession()).data.session;
assert(organizerSession?.access_token, "organizer session token missing");
await organizer.realtime.setAuth(organizerSession.access_token);
const smokeSeason = `Realtime smoke ${Date.now()}`;
const event = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Realtime event timed out")), 20000);
  organizer.channel("phase01b-smoke").on("postgres_changes", { event: "UPDATE", schema: "public", table: "tournaments" }, payload => { clearTimeout(timer); resolve(payload); }).subscribe(status => {
    if (status === "SUBSCRIBED") {
      setTimeout(async () => {
        const { error } = await organizer.from("tournaments").update({ season: smokeSeason }).eq("id", "10000000-0000-4000-8000-000000000001");
        if (error) reject(error);
      }, 1000);
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(`Realtime channel ${status}`));
  });
});
const payload = await event;
assert.equal(payload.new.season, smokeSeason);
await organizer.removeAllChannels();
console.log(JSON.stringify({ authProfileSync: "PASS", sessionRestore: "PASS", logout: "PASS", duplicateProfile: "PASS", realtime: "PASS", testUserId: signup.user.id, testEmail: email }));
