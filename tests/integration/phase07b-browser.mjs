import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.APP_URL;
assert(base);
const player = "/players/player-68ea715b81d4e086";
const captain = "/players/player-459c7999f440244b";
const routes = [player, captain, "/leaderboards", "/seasons/draftgg-season-one", "/organizations/persistent-phoenix", "/search?q=Career", "/search?q=Test%20Player", "/search?q=Persistent", "/search?q=Season%20One"];
const required = {
  [player]: ["Tournaments Entered", "Completed", "Teams Represented", "Championships", "HistoricAceA", "HistoricAceB", "Career Cup Alpha", "Career Cup Bravo", "Established", "Rating history", "Achievements", "Forfeit"],
  [captain]: ["Captain career", "3 tournament drafts captained", "Career Cup Alpha", "Career Cup Bravo", "Alpha Phoenix", "Bravo Phoenix", "Spent", "Remaining", "Acquired"],
  "/leaderboards": ["Player leaderboards", "Career rating", "Confidence"],
  "/seasons/draftgg-season-one": ["Career Cup Alpha", "Career Cup Bravo", "Season player leaderboard", "Organization standings", "Recent season rating results"],
  "/organizations/persistent-phoenix": ["Persistent Phoenix", "Alpha Phoenix", "Bravo Phoenix", "Historical team", "Roster", "Match record"],
  "/search?q=Career": ["Career Cup Alpha", "Career Cup Bravo"],
  "/search?q=Test%20Player": ["Test Player 1", "player"],
  "/search?q=Persistent": ["Persistent Phoenix", "organization"],
  "/search?q=Season%20One": ["DraftGG Season One", "season"],
};
const forbidden = /@draftgg\.test|discord_username|steam_id|evidence|appeal|scouting|rating_review|moderation|private dispute/i;
const browser = await chromium.launch({ headless: true });
let assertions = 0;
for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport });
  for (const route of routes) {
    const response = await page.goto(base + route, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, route); assertions++;
    const text = await page.locator("body").innerText();
    for (const expected of required[route]) { assert(text.toLowerCase().includes(expected.toLowerCase()), `${route} missing ${expected}`); assertions++; }
    assert(!forbidden.test(text), `${route} leaked a private marker`); assertions++;
    assert(await page.locator("h1").count() === 1, `${route} needs one h1`); assertions++;
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(overflow, false, `${route} has page-level overflow at ${viewport.width}`); assertions++;
    const tablesContained = await page.evaluate(() => [...document.querySelectorAll("table")].every(table => {
      const parent = table.parentElement; return !parent || table.scrollWidth <= parent.clientWidth || ["auto", "scroll"].includes(getComputedStyle(parent).overflowX);
    }));
    assert(tablesContained, `${route} has an unusable table`); assertions++;
    const controls = await page.locator("a,button,input,select,textarea").count();
    if (controls) { await page.keyboard.press("Tab"); assert(await page.evaluate(() => document.activeElement !== document.body), `${route} keyboard focus did not advance`); }
    assertions++;
  }
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ result: "PASS", assertions, routes: routes.length, viewports: 3 }));
