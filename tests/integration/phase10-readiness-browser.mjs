import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.APP_URL, readinessSecret = process.env.READINESS_SECRET;
assert(base && readinessSecret);
const browser = await chromium.launch({ headless: true });
let assertions = 0;
for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  const page = await browser.newPage({ viewport });
  const response = await page.goto(base);
  assert.equal(response?.status(), 200);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  assert(await page.locator("main").count());
  assertions += 3;
  await page.close();
}
const page = await browser.newPage();
let response = await page.goto(`${base}/api/health`);
assert.equal(response?.status(), 200);
assert.equal((await response.json()).status, "ok");
assert.equal(response.headers()["cache-control"], "no-store");
assert.match(response.headers()["content-security-policy"], /frame-ancestors 'none'/);
assert.equal(response.headers()["x-content-type-options"], "nosniff");
assertions += 5;
response = await page.goto(`${base}/api/internal/readiness`);
assert.equal(response?.status(), 401);
response = await page.request.get(`${base}/api/internal/readiness`, { headers: { authorization: `Bearer ${readinessSecret}` } });
assert.equal(response.status(), 200);
assert.equal((await response.json()).status, "ready");
assertions += 3;
for (const path of ["/robots.txt", "/sitemap.xml", "/terms", "/privacy", "/conduct"]) {
  response = await page.goto(`${base}${path}`);
  assert.equal(response?.status(), 200);
  assertions++;
}
response = await page.goto(`${base}/definitely-not-a-draftgg-route`);
assert.equal(response?.status(), 404);
assert.match(await page.locator("body").innerText(), /lost in the bracket/i);
assertions += 2;
await page.close();
await browser.close();
console.log(JSON.stringify({ result: "PASS", assertions, viewports: [390, 768, 1440], health: "PASS", readiness: "PASS", headers: "PASS", metadataRoutes: "PASS", legal: "PASS", notFound: "PASS" }));
