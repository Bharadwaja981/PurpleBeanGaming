import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret } = process.env;
assert(url && secret, "local Supabase environment required");
const db = createClient(url, secret, { auth: { persistSession: false } });
const stamp = Date.now();

async function ensureUser(index) {
  const email = `phase06d-user${index}@draftgg.test`;
  const listed = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert.ifError(listed.error);
  let user = listed.data.users.find((item) => item.email === email);
  if (!user) {
    const created = await db.auth.admin.createUser({ email, password: "development-only", email_confirm: true });
    assert.ifError(created.error);
    user = created.data.user;
  }
  return user;
}

const users = [];
for (let i = 1; i <= 42; i += 1) users.push(await ensureUser(i));

async function makeTournament(label, teamCount) {
  const id = crypto.randomUUID(), slug = `phase06d-${label.replaceAll(" ", "-")}-${stamp}`;
  assert.ifError((await db.from("tournaments").insert({ id, name: `Phase 06D ${label}`, slug, status: "rosters_locked", created_by: users[0].id })).error);
  const members = users.map((user) => ({ id: crypto.randomUUID(), tournament_id: id, user_id: user.id, status: "active" }));
  assert.ifError((await db.from("tournament_members").insert(members)).error);
  const roles = [
    { member_id: members[0].id, role: "organizer" },
    { member_id: members[1].id, role: "referee" },
    ...Array.from({ length: teamCount }, (_, i) => ({ member_id: members[i + 2].id, role: "captain" })),
  ];
  assert.ifError((await db.from("tournament_member_roles").insert(roles)).error);
  const players = [];
  for (let i = 0; i < teamCount * 5; i += 1) {
    const userIndex = i < teamCount ? i + 2 : teamCount + 2 + (i - teamCount);
    players.push({ id: crypto.randomUUID(), tournament_id: id, user_id: users[userIndex].id, ign: `${label} Player ${i + 1}`, primary_role: i % 2 ? "Support" : "DPS", region: "EU", tournament_mmr: 2000 + i * 7, rating_status: "locked", is_eligible: true, registration_status: "approved" });
  }
  assert.ifError((await db.from("tournament_players").insert(players)).error);
  const teams = Array.from({ length: teamCount }, (_, i) => ({ id: crypto.randomUUID(), tournament_id: id, name: `${label} Team ${String.fromCharCode(65 + i)}`, short_tag: `${label.slice(0, 2).toUpperCase()}${i + 1}`, captain_user_id: users[i + 2].id, starting_credits: 1000, credits_remaining: 1000, captain_mmr: players[i].tournament_mmr, current_team_mmr: players[i].tournament_mmr, max_roster_size: 5 }));
  assert.ifError((await db.from("teams").insert(teams)).error);
  const roster = [];
  for (let team = 0; team < teamCount; team += 1) for (let recruit = 0; recruit < 4; recruit += 1) {
    const player = players[teamCount + team * 4 + recruit];
    roster.push({ tournament_id: id, team_id: teams[team].id, player_id: player.id, acquisition_type: "admin_assignment", tournament_mmr_at_draft: player.tournament_mmr });
  }
  assert.ifError((await db.from("team_roster").insert(roster)).error);
  assert.ifError((await db.from("tournament_rules").insert({ tournament_id: id, team_size: 5, starting_credits: 1000, minimum_bid: 10, bid_increment: 5, initial_bid_seconds: 30, nomination_seconds: 30 })).error);
  return { id, slug, teams: teams.map(({ id: teamId, name }) => ({ id: teamId, name })) };
}

const groups = await makeTournament("Groups", 8);
const elimination8 = await makeTournament("Elimination 8", 8);
const elimination6 = await makeTournament("Elimination 6", 6);
const incidents = await makeTournament("Incidents", 2);

console.log(JSON.stringify({ result: "PASS", organizer: "phase06d-user1@draftgg.test", referee: "phase06d-user2@draftgg.test", captains: Array.from({ length: 8 }, (_, i) => `phase06d-user${i + 3}@draftgg.test`), groups, elimination8, elimination6, incidents }));
