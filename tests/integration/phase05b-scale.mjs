import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";
const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = process.env;
assert(url && key);
const db = createClient(url, key, { auth: { persistSession: false } });
const base = "10000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000001";
const teams = (await db.from("teams").select("id").eq("tournament_id", base))
  .data;
const players = (
  await db
    .from("tournament_players")
    .select("id")
    .eq("tournament_id", base)
    .eq("is_eligible", true)
).data;
assert(teams?.length === 6 && players?.length >= 30);
const tournamentIds = [],
  snapshotIds = [];
for (let i = 0; i < 10; i++) {
  tournamentIds.push(crypto.randomUUID());
  snapshotIds.push(crypto.randomUUID());
}
const created = [];
try {
  assert.ifError(
    (
      await db
        .from("tournaments")
        .insert(
          tournamentIds.map((id, i) => ({
            id,
            name: `Scale Cup ${i + 1}`,
            slug: `scale-cup-${i + 1}`,
            season: "Scale",
            status: "completed",
            created_by: owner,
          })),
        )
    ).error,
  );
  assert.ifError(
    (
      await db
        .from("draft_snapshots")
        .insert(
          snapshotIds.map((id, i) => ({
            id,
            tournament_id: tournamentIds[i],
            tournament_name: `Scale Cup ${i + 1}`,
            tournament_slug: `scale-cup-${i + 1}`,
            season: "Scale",
            rules_version: 1,
            team_size: 5,
            starting_credits: 1000,
            completed_at: new Date().toISOString(),
            total_bids: 30,
            total_auctions: 30,
            total_sold: 30,
            total_unsold: 0,
            mmr_target: 14000,
          })),
        )
    ).error,
  );
  const teamRows = [],
    playerRows = [];
  for (let t = 0; t < 10; t++)
    for (let team = 0; team < 6; team++) {
      const teamId = crypto.randomUUID();
      teamRows.push({
        snapshot_id: snapshotIds[t],
        tournament_id: tournamentIds[t],
        team_id: teamId,
        team_slug: `team-${team}`,
        team_name: `Team ${team}`,
        team_tag: `T${team}`,
        captain_slug: "captain-scale",
        captain_name: "Scale Captain",
        captain_mmr: 2000,
        final_team_mmr: 14000,
        starting_credits: 1000,
        credits_remaining: 800,
        recruit_count: 5,
      });
      for (let p = 0; p < 5; p++)
        playerRows.push({
          snapshot_id: snapshotIds[t],
          tournament_id: tournamentIds[t],
          team_id: teamId,
          player_id: crypto.randomUUID(),
          player_slug:
            p === 0 && team === 0 ? "player-scale" : `scale-${t}-${team}-${p}`,
          ign: `Scale Player ${t}-${team}-${p}`,
          primary_role: "flex",
          tournament_mmr_at_draft: 2400,
          purchase_price: 40,
          acquisition_type: "auction",
          auction_sequence: team * 5 + p + 1,
          bid_count: 1,
        });
    }
  assert.equal(playerRows.length, 300);
  assert.ifError(
    (await db.from("draft_team_snapshots").insert(teamRows)).error,
  );
  assert.ifError(
    (await db.from("draft_player_snapshots").insert(playerRows)).error,
  );
  const now = Date.now(),
    auctionRows = [];
  for (let i = 0; i < 500; i++) {
    const id = crypto.randomUUID();
    created.push(id);
    auctionRows.push({
      id,
      tournament_id: base,
      player_id: players[i % players.length].id,
      nominating_team_id: teams[i % 6].id,
      sequence_number: 1000 + i,
      status: i % 10 === 0 ? "unsold" : "sold",
      opening_bid: 10,
      current_bid: i % 10 === 0 ? null : 10,
      leading_team_id: i % 10 === 0 ? null : teams[i % 6].id,
      started_at: new Date(now - (i + 2) * 1000).toISOString(),
      closes_at: new Date(now - (i + 1) * 1000).toISOString(),
      closed_at: new Date(now - i * 1000).toISOString(),
      winning_team_id: i % 10 === 0 ? null : teams[i % 6].id,
      winning_bid: i % 10 === 0 ? null : 10,
    });
  }
  for (let i = 0; i < auctionRows.length; i += 100)
    assert.ifError(
      (await db.from("auctions").insert(auctionRows.slice(i, i + 100))).error,
    );
  const bidRows = auctionRows
    .filter((a) => a.status === "sold")
    .map((a) => ({
      tournament_id: base,
      auction_id: a.id,
      team_id: a.winning_team_id,
      captain_user_id: owner,
      amount: 10,
      request_id: crypto.randomUUID(),
      auction_revision_before: 0,
      auction_revision_after: 1,
      accepted: true,
      received_at: a.started_at,
    }));
  for (let i = 0; i < bidRows.length; i += 100)
    assert.ifError(
      (await db.from("bids").insert(bidRows.slice(i, i + 100))).error,
    );
  async function measure(name, work) {
    const values = [];
    for (let i = 0; i < 11; i++) {
      const start = performance.now();
      const result = await work();
      assert.ifError(result.error);
      if (i) values.push(performance.now() - start);
    }
    values.sort((a, b) => a - b);
    return {
      name,
      medianMs: +values[5].toFixed(2),
      p95Ms: +values[9].toFixed(2),
    };
  }
  const results = [];
  results.push(
    await measure("public-package-1500-events", () =>
      db.rpc("get_public_draft_package", { p_slug: "draftgg-test-cup" }),
    ),
  );
  results.push(
    await measure("history-page-500-auctions", () =>
      db.rpc("get_public_auction_history", {
        p_slug: "draftgg-test-cup",
        p_page: 1,
        p_page_size: 25,
      }),
    ),
  );
  results.push(
    await measure("captain-history-10-tournaments", () =>
      db
        .from("public_captain_draft_history")
        .select("*")
        .eq("captain_slug", "captain-scale"),
    ),
  );
  results.push(
    await measure("player-history-10-tournaments", () =>
      db
        .from("draft_player_snapshots")
        .select("*")
        .eq("player_slug", "player-scale"),
    ),
  );
  console.log(
    JSON.stringify({
      result: "PASS",
      fixtures: {
        tournaments: 10,
        teams: 60,
        players: 300,
        auctions: 500,
        publicEvents: 1450,
      },
      results,
    }),
  );
} finally {
  await db.from("tournaments").delete().in("id", tournamentIds);
  if (created.length) await db.from("auctions").delete().in("id", created);
}
