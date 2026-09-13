import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SECRET_KEY: secret, APP_URL: app } = process.env;
assert(url && anon && secret && app);
const root = createClient(url, secret, { auth: { persistSession: false } });
const linkId = "91000000-0000-4000-8000-000000000304";
const gameId = "91000000-0000-4000-8000-000000000101";
const route = `${app}/tournaments/phase09b/matches/91000000-0000-4000-8000-000000000030`;
async function authCookies(email) {
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: "development-only" });
  assert.ifError(error);
  let jar = [];
  const ssr = createServerClient(url, anon, { cookies: { getAll: () => [], setAll: (next) => { jar = next; } } });
  assert.ifError((await ssr.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })).error);
  return jar;
}

const browser = await chromium.launch({ headless: true });
let assertions = 0;
const anonymous = await browser.newPage();
assert.equal((await anonymous.goto(route))?.status(), 200);
assert.match(await anonymous.locator("body").innerText(), /External match 9910/i);
assert.equal(await anonymous.getByRole("button", { name: "Correct external link" }).count(), 0);
assertions += 3;

const organizer = await browser.newContext();
await organizer.addCookies((await authCookies("player1@draftgg.test")).map((cookie) => ({ name: cookie.name, value: cookie.value, url: app })));
const page = await organizer.newPage();
assert.equal((await page.goto(route))?.status(), 200);
const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Correct external link" }) }).first();
await form.locator('input[name="dotaMatchId"]').fill("9901");
await form.locator('input[name="reason"]').fill("Corrected after organizer evidence review");
await form.getByRole("button", { name: "Correct external link" }).click();
await page.waitForLoadState("networkidle");
assert.match(await page.locator("body").innerText(), /External match 9901/i);
await page.reload();
assert.match(await page.locator("body").innerText(), /External match 9901/i);
assertions += 3;

let { data: link } = await root.from("match_external_links").select("dota_match_id,reconciliation_state").eq("id", linkId).single();
assert.equal(link.dota_match_id, 9901);
assert.equal(link.reconciliation_state, "pending");
assert.ifError((await root.rpc("reconcile_external_dota_match", { p_link_id: linkId })).error);
({ data: link } = await root.from("match_external_links").select("dota_match_id,reconciliation_state").eq("id", linkId).single());
assert.equal(link.reconciliation_state, "result_conflict");
const { data: history } = await root.from("match_external_link_history").select("old_dota_match_id,new_dota_match_id,reason,changed_by,changed_at").eq("match_external_link_id", linkId).eq("new_dota_match_id", 9901).single();
assert.equal(history.old_dota_match_id, 9910);
assert.equal(history.new_dota_match_id, 9901);
assert.match(history.reason, /organizer evidence review/);
assert(history.changed_by && history.changed_at);
const { data: audit } = await root.from("audit_events").select("actor_user_id,entity_id,payload,created_at").eq("event_type", "EXTERNAL_MATCH_RELINKED").eq("entity_id", gameId).order("created_at", { ascending: false }).limit(1).single();
assert.equal(audit.payload.old_match_id, 9910);
assert.equal(audit.payload.new_match_id, 9901);
assert.match(audit.payload.reason, /organizer evidence review/);
assert(audit.actor_user_id && audit.created_at);
assertions += 11;

await page.reload();
assert.match(await page.locator("body").innerText(), /External match 9901 · result conflict/i);
assert.doesNotMatch(await page.locator("body").innerText(), /External match 9910/i);
assertions += 2;

const unauthenticated = createClient(url, anon, { auth: { persistSession: false } });
const forged = await unauthenticated.rpc("relink_external_dota_match", { p_link_id: linkId, p_new_match_id: 9905, p_reason: "Unauthorized forged correction" });
assert(forged.error);
assert.equal((await root.from("match_external_links").select("dota_match_id").eq("id", linkId).single()).data.dota_match_id, 9901);
assertions += 2;

await organizer.close();
await anonymous.close();
await browser.close();
console.log(JSON.stringify({ result: "PASS", assertions, canonical: 9901, history: "PASS", audit: "PASS", unauthorized: "PASS", reconciliation: "RESULT_CONFLICT_SAFE" }));
