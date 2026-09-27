import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key, APP_URL: app } = process.env;
assert(url && key && app, "SUPABASE_URL, SUPABASE_ANON_KEY, and APP_URL are required");

async function cookieFor(email) {
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email, password: "development-only" });
  assert.ifError(error);
  let jar = [];
  const ssr = createServerClient(url, key, { cookies: { getAll: () => [], setAll: (items) => { jar = items; } } });
  assert.ifError((await ssr.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })).error);
  return jar;
}

const publicRoutes = [
  ["home", "/"], ["sign-in", "/sign-in"], ["tournaments", "/tournaments/history"],
  ["leaderboards", "/leaderboards"], ["search", "/search?q=Player"], ["privacy", "/privacy"],
  ["terms", "/terms"], ["conduct", "/conduct"], ["maintenance", "/maintenance"],
  ["not-found", "/purple-bean-missing-page"],
];
const organizerRoutes = [
  ["dashboard", "/dashboard"], ["registration", "/tournaments/draftgg-test-cup/register"],
  ["team-management", "/tournaments/draftgg-test-cup/teams"], ["player-directory", "/tournaments/draftgg-test-cup/players"],
  ["auction-room", "/tournaments/draftgg-test-cup/auction-room"], ["matches", "/tournaments/draftgg-test-cup/matches"],
  ["schedule", "/tournaments/draftgg-test-cup/schedule"], ["standings", "/tournaments/draftgg-test-cup/standings"],
  ["bracket", "/tournaments/draftgg-test-cup/bracket"], ["analytics", "/admin/draftgg-test-cup/analytics"],
  ["competition", "/admin/draftgg-test-cup/competition"], ["settings", "/settings"],
  ["support", "/support"], ["reports", "/reports"], ["platform-admin", "/platform-admin"],
  ["moderation", "/platform-admin/cases"], ["dota-integrations", "/platform-admin/integrations"],
];

await mkdir("test_artifacts/purplebean/desktop", { recursive: true });
await mkdir("test_artifacts/purplebean/mobile", { recursive: true });
const organizerCookies = await cookieFor("player1@draftgg.test");
const browser = await chromium.launch({ headless: true });
let assertions = 0;

for (const [device, viewport] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
  for (const [scope, routes] of [["public", publicRoutes], ["organizer", organizerRoutes]]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    if (scope === "organizer") await context.addCookies(organizerCookies.map(({ name, value }) => ({ name, value, url: app })));
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    for (const [name, route] of routes) {
      consoleErrors.length = 0;
      const response = await page.goto(app + route, { waitUntil: "networkidle" });
      assert([200, 404].includes(response?.status()), `${route} returned ${response?.status()}`);
      const body = await page.locator("body").innerText();
      assert(body.trim().length > 40, `${route} is blank`);
      const brandText = body.replaceAll("draftgg_rating_v1", "").replaceAll("@draftgg.test", "").replaceAll("draftgg-test-cup", "");
      assert(!brandText.match(/draftgg/i), `${route} exposes legacy product branding`);
      assert(!/application error|internal server error|failed to compile/i.test(body), `${route} has a framework error overlay`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, `${route} has page-level overflow`);
      const unexpectedErrors = consoleErrors.filter((line) => !line.includes("favicon") && !line.includes("eval() is not supported in this environment") && !(name === "not-found" && line.includes("404")));
      assert.equal(unexpectedErrors.length, 0, `${route} emitted console errors: ${unexpectedErrors.join(" | ")}`);
      await page.screenshot({ path: `test_artifacts/purplebean/${device}/${name}.png`, fullPage: true });
      assertions += 6;
    }
    await context.close();
  }
}

await browser.close();
console.log(JSON.stringify({ result: "PASS", assertions, routes: publicRoutes.length + organizerRoutes.length, viewports: 2, screenshots: (publicRoutes.length + organizerRoutes.length) * 2 }));
