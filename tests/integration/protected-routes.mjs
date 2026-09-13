import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import assert from "node:assert/strict";

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key, APP_URL: appUrl } = process.env;
assert(url && key && appUrl, "Supabase and app URLs are required");
async function cookieFor(email) {
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email, password: "development-only" });
  assert.ifError(error);
  let cookies = [];
  const ssr = createServerClient(url, key, { cookies: { getAll: () => [], setAll: items => { cookies = items; } } });
  assert.ifError((await ssr.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })).error);
  return cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}
const anonymous = await fetch(`${appUrl}/dashboard`, { redirect: "manual" });
assert.equal(anonymous.status, 307);
assert.equal(new URL(anonymous.headers.get("location"), appUrl).pathname, "/sign-in");
const playerCookie = await cookieFor("player7@draftgg.test");
assert.equal((await fetch(`${appUrl}/dashboard`, { headers: { cookie: playerCookie } })).status, 200);
const playerAdmin = await fetch(`${appUrl}/admin`, { headers: { cookie: playerCookie }, redirect: "manual" });
assert.equal(playerAdmin.status, 307);
assert.equal(new URL(playerAdmin.headers.get("location"), appUrl).pathname, "/dashboard");
const organizerCookie = await cookieFor("player1@draftgg.test");
const organizerAdmin = await fetch(`${appUrl}/admin`, { headers: { cookie: organizerCookie } });
assert.equal(organizerAdmin.status, 200);
assert.match(await organizerAdmin.text(), /Purple Bean Test Cup/);
const slug="draftgg-test-cup";
for(const section of ["register","status","players","captains","auction-room"]){
  const response=await fetch(`${appUrl}/tournaments/${slug}/${section}`,{headers:{cookie:playerCookie},redirect:"manual"});
  assert.equal(response.status,200,`${section} route should load for an authenticated member`);
  if(section==="auction-room")assert.match(await response.text(),/Live auction control/);
}
const anonymousRegistration=await fetch(`${appUrl}/tournaments/${slug}/register`,{redirect:"manual"});
assert.equal(anonymousRegistration.status,307);
assert.equal(new URL(anonymousRegistration.headers.get("location"),appUrl).pathname,"/sign-in");
const scopedAdmin=await fetch(`${appUrl}/admin/${slug}`,{headers:{cookie:organizerCookie}});
assert.equal(scopedAdmin.status,200);
assert.match(await scopedAdmin.text(),/Pre-draft readiness/);
console.log(JSON.stringify({ anonymousDashboard: "PASS", playerDashboard: "PASS", playerAdminDenied: "PASS", organizerAdmin: "PASS", phase02Routes: "PASS", anonymousRegistrationDenied:"PASS", scopedOrganizerControls:"PASS", tournamentScope: "PASS (database suite)" }));
