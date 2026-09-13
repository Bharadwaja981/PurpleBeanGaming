#!/usr/bin/env node
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { chromium } from 'playwright';

const execFileP = promisify(execFile);
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// If Supabase env not present, try to obtain them from local supabase CLI
async function ensureSupabaseEnv() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SECRET_KEY) return;
  try {
    // query supabase status -o env and parse key=val lines
    let out;
    try {
      out = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' });
    } catch {
      // fallback to npx if supabase binary not installed globally
      out = execFileSync('npx supabase status -o env', { encoding: 'utf8', shell: true });
    }
    const lines = out.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      // handle both 'export KEY=VAL' and 'KEY=VAL'
      const m = line.match(/(?:export\s+)?([A-Z0-9_]+)=(.*)/i);
      if (m) {
        const k = m[1];
        let v = m[2] || '';
        // strip surrounding quotes
        if ((v.startsWith("\'") && v.endsWith("\'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1);
        // only set local dev vars
        if (!process.env[k]) process.env[k] = v;
      }
    }
    // map common supabase CLI names to expected env vars
    if (!process.env.SUPABASE_URL && process.env.API_URL) process.env.SUPABASE_URL = process.env.API_URL;
    if (!process.env.SUPABASE_ANON_KEY && process.env.ANON_KEY) process.env.SUPABASE_ANON_KEY = process.env.ANON_KEY;
    if (!process.env.SUPABASE_ANON_KEY && process.env.PUBLISHABLE_KEY) process.env.SUPABASE_ANON_KEY = process.env.PUBLISHABLE_KEY;
    if (!process.env.SUPABASE_SECRET_KEY && process.env.SECRET_KEY) process.env.SUPABASE_SECRET_KEY = process.env.SECRET_KEY;
    if (!process.env.SUPABASE_SECRET_KEY && process.env.SERVICE_ROLE_KEY) process.env.SUPABASE_SECRET_KEY = process.env.SERVICE_ROLE_KEY;
  } catch {
    // supabase CLI not present or failed; we will proceed and let earlier checks surface missing envs
  }
}

await ensureSupabaseEnv();

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon } = process.env;
if (!url || !anon) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in the environment or obtainable via the local supabase CLI');
  process.exit(2);
}

async function runFixture() {
  console.log('Running DB fixture to provision tournaments...');
  const res = await execFileP(process.execPath, ['tests/integration/phase06d-browser-fixtures.mjs'], { env: process.env });
  const out = res.stdout.trim();
  try {
    return JSON.parse(out);
  } catch (e) {
    console.error('Fixture did not return JSON. stdout:\n', out);
    throw e;
  }
}

async function organizerCookies(email = 'phase06d-user1@draftgg.test', password = 'development-only') {
  const auth = createClient(url, anon, { auth: { persistSession: false } });
  const login = await auth.auth.signInWithPassword({ email, password });
  assert.ifError(login.error);
  let cookies = [];
  const ssr = createServerClient(url, anon, { cookies: { getAll: () => [], setAll: (items) => { cookies = items; } } });
  assert.ifError((await ssr.auth.setSession({ access_token: login.data.session.access_token, refresh_token: login.data.session.refresh_token })).error);
  const mapped = [];
  for (const item of cookies) {
    if (!item) continue;
    if (typeof item === 'string') {
      // parse 'name=value; Path=...; HttpOnly' style
      const parts = item.split(';').map(p => p.trim());
      const [nv] = parts;
      const idx = nv.indexOf('=');
      if (idx <= 0) continue;
      const name = nv.slice(0, idx);
      const value = nv.slice(idx + 1);
      mapped.push({ name, value, url: APP_URL, path: '/' });
    } else {
      const name = item.name ?? item.key ?? null;
      const value = item.value ?? item.val ?? null;
      const options = item.options ?? item.opts ?? {};
      if (!name || value == null) continue;
      mapped.push({ name, value, url: APP_URL, path: options.path ?? '/' , httpOnly: !!options.httpOnly, secure: !!options.secure });
    }
  }
  // log cookie names for debugging (do not log values)
  console.log('Mapped cookies:', mapped.map((c) => ({ name: c.name, hasUrl: !!c.url, hasPath: !!c.path })));
  return mapped;
}

function csvHasPrivateField(csvText) {
  const privatePatterns = ['email', 'discord', 'steam', 'lobby_password', 'evidence', 'appeal', 'notes', 'request_id', 'auth', 'uuid', 'private'];
  const lower = csvText.toLowerCase();
  return privatePatterns.filter(p => lower.includes(p));
}

async function run() {
  const fixture = await runFixture();
  console.log('Fixture created:', fixture);
  const tournament = fixture.groups ?? fixture.elimination8 ?? fixture.elimination6 ?? fixture.incidents;
  const tournamentId = tournament?.id ?? (fixture.groups?.id ?? fixture.elimination8?.id ?? fixture.elimination6?.id);
  const tournamentSlug = fixture.groups?.slug ?? fixture.elimination8?.slug ?? fixture.elimination6?.slug;
  if (!tournamentId || !tournamentSlug) {
    console.error('Could not determine tournament id/slug from fixture output');
    process.exit(2);
  }

  const cookies = await organizerCookies();

  const browser = await chromium.launch();
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  // set auth cookies by assigning document.cookie in the page (workaround for addCookies issues)
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  for (const c of cookies) {
    const safeVal = encodeURIComponent(c.value || '');
    const cookieStr = `${c.name}=${safeVal}; Path=${c.path || '/'};` + (c.httpOnly ? '' : '');
    await page.evaluate((s) => { document.cookie = s; }, cookieStr);
  }
  // Navigate to organizer competition page
  const organizerUrl = `${APP_URL}/admin/${tournamentSlug}/competition`;
  console.log('Opening organizer page:', organizerUrl);
  const resp = await page.goto(organizerUrl, { waitUntil: 'networkidle' });
  if (!resp || resp.status() >= 400) {
    console.error('Failed to load organizer page', resp && resp.status());
    await browser.close();
    process.exit(2);
  }

  // Export Match Results
  console.log('Triggering match results export...');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('text=Export Match Results'),
  ]);
  const downloadPath = path.join(process.cwd(), 'tmp', `match-results-${Date.now()}.csv`);
  await fs.mkdir(path.dirname(downloadPath), { recursive: true });
  await download.saveAs(downloadPath);
  const csv = await fs.readFile(downloadPath, 'utf8');
  console.log('Downloaded match CSV size:', csv.length);
  const privateHits = csvHasPrivateField(csv);
  if (privateHits.length) {
    console.error('CSV contains private fields:', privateHits);
    process.exit(3);
  }
  // Basic header/row checks
  const lines = csv.split(/\r?\n/).filter(Boolean);
  assert(lines.length >= 1, 'CSV should contain header and possibly rows');
  const header = lines[0];
  console.log('Match CSV header:', header);

  // Export Standings
  console.log('Triggering standings export...');
  const [download2] = await Promise.all([
    page.waitForEvent('download'),
    page.click('text=Export Standings'),
  ]);
  const standingsPath = path.join(process.cwd(), 'tmp', `standings-${Date.now()}.csv`);
  await download2.saveAs(standingsPath);
  const standingsCsv = await fs.readFile(standingsPath, 'utf8');
  const privateHits2 = csvHasPrivateField(standingsCsv);
  if (privateHits2.length) {
    console.error('Standings CSV contains private fields:', privateHits2);
    process.exit(3);
  }
  const sLines = standingsCsv.split(/\r?\n/).filter(Boolean);
  assert(sLines.length >= 1, 'Standings CSV should contain header and rows');
  console.log('Standings CSV header:', sLines[0]);

  console.log('CSV export validation PASSED');
  await browser.close();
}

run().catch((err) => { console.error(err); process.exit(99); });
