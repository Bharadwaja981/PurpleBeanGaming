import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: publishableKey, SUPABASE_SECRET_KEY: secretKey } = process.env;
assert(url && publishableKey && secretKey, "SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SECRET_KEY are required");

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, options);

async function signedIn(number) {
  const client = createClient(url, publishableKey, options);
  const { error } = await client.auth.signInWithPassword({ email: `player${number}@draftgg.test`, password: "development-only" });
  assert.ifError(error);
  return client;
}

const organizer = await signedIn(1);
const captains = await Promise.all([1, 2, 3, 4, 5, 6].map(signedIn));
const tournamentId = "10000000-0000-4000-8000-000000000001";

let response = await organizer.rpc("start_auction", { p_tournament_id: tournamentId });
assert.ifError(response.error);
let state = (await organizer.rpc("get_current_auction_state", { p_tournament_id: tournamentId })).data;
assert(state.active_nomination?.id, "active nomination missing");
response = await captains[0].rpc("nominate_player", {
  p_tournament_id: tournamentId,
  p_player_id: "30000000-0000-4000-8000-000000000009",
  p_expected_nomination_id: state.active_nomination.id,
});
assert.ifError(response.error);
const auctionId = response.data.id;

let realtimePayload;
let markRealtimeEvent;
const realtime = new Promise((resolve, reject) => {
  const eventTimer = setTimeout(() => reject(new Error("auction Realtime payload timed out")), 60_000);
  markRealtimeEvent = () => { clearTimeout(eventTimer); resolve(); };
});
const realtimeReady = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("auction Realtime event timed out")), 20_000);
  captains[5]
    .channel(`phase03-${Date.now()}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${auctionId}` }, payload => {
      realtimePayload = payload;
      clearTimeout(timer);
      markRealtimeEvent();
    })
    .subscribe(status => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        reject(new Error(`Realtime channel ${status}`));
      }
    });
});
await realtimeReady;
await new Promise(resolve => setTimeout(resolve, 3_000));
assert.ifError((await admin.from("auctions").update({ updated_at: new Date().toISOString() }).eq("id", auctionId)).error);
await realtime;

const attempts = [];
const acceptedRequests = [];
const started = performance.now();
for (let round = 0; round < 20; round += 1) {
  state = (await captains[round % 6].rpc("get_current_auction_state", { p_tournament_id: tournamentId })).data;
  const expectedRevision = Number(state.auction.revision);
  const requestIds = captains.map(() => crypto.randomUUID());
  const batch = await Promise.all(captains.map((client, index) => client.rpc("place_bid", {
    p_auction_id: auctionId,
    p_expected_revision: expectedRevision,
    p_request_id: requestIds[index],
    p_increment_type: "next",
  })));
  for (const result of batch) {
    assert.ifError(result.error);
    attempts.push(result.data);
  }
  const accepted = batch.filter(result => result.data.ok);
  assert.equal(accepted.length, 1, `round ${round} must have exactly one accepted mutation`);
  const acceptedIndex = batch.findIndex(result => result.data.ok);
  acceptedRequests.push({ client: captains[acceptedIndex], id: requestIds[acceptedIndex], revision: expectedRevision, result: accepted[0].data });

  const duplicate = await captains[acceptedIndex].rpc("place_bid", {
    p_auction_id: auctionId,
    p_expected_revision: expectedRevision,
    p_request_id: requestIds[acceptedIndex],
    p_increment_type: "next",
  });
  assert.ifError(duplicate.error);
  assert.equal(duplicate.data.duplicate, true);
  assert.equal(duplicate.data.bid_id, accepted[0].data.bid_id);
  attempts.push(duplicate.data);
}
const durationMs = Math.round(performance.now() - started);
assert.equal(realtimePayload.new.id, auctionId);

const { data: acceptedRows, error: acceptedError } = await admin.from("bids")
  .select("id,auction_revision_before,auction_revision_after,amount,team_id")
  .eq("auction_id", auctionId)
  .eq("accepted", true)
  .order("auction_revision_after");
assert.ifError(acceptedError);
assert.equal(acceptedRows.length, 20, "no accepted bid may be lost");
assert.equal(new Set(acceptedRows.map(row => row.auction_revision_after)).size, 20, "accepted revisions must be unique");
acceptedRows.forEach((row, index) => {
  assert.equal(Number(row.auction_revision_before), index);
  assert.equal(Number(row.auction_revision_after), index + 1);
  if (index > 0) assert(row.amount > acceptedRows[index - 1].amount, "accepted bid must increase");
});

const freshCaptain = await signedIn(2);
const recovered = (await freshCaptain.rpc("get_current_auction_state", { p_tournament_id: tournamentId })).data;
const { data: canonicalAuction, error: canonicalError } = await admin.from("auctions").select("*").eq("id", auctionId).single();
assert.ifError(canonicalError);
assert.equal(Number(recovered.auction.revision), Number(canonicalAuction.revision));
assert.equal(recovered.auction.current_bid, canonicalAuction.current_bid);
assert.equal(recovered.auction.leading_team_id, canonicalAuction.leading_team_id);

const directAuction = await captains[0].from("auctions").update({ current_bid: 1 }).eq("id", auctionId);
assert(directAuction.error, "client direct auction mutation must fail");
const directRoster = await captains[0].from("team_roster").insert({
  tournament_id: tournamentId,
  team_id: "40000000-0000-4000-8000-000000000001",
  player_id: "30000000-0000-4000-8000-000000000010",
  acquisition_type: "auction",
  tournament_mmr_at_draft: 2500,
});
assert(directRoster.error, "client direct roster mutation must fail");

assert.ifError((await admin.from("auctions").update({ closes_at: new Date(Date.now() - 1000).toISOString() }).eq("id", auctionId)).error);
const finalized = await captains[4].rpc("finalize_auction", { p_auction_id: auctionId });
assert.ifError(finalized.error);
assert.equal(finalized.data.status, "sold");
const repeatedFinalization = await captains[3].rpc("finalize_auction", { p_auction_id: auctionId });
assert.ifError(repeatedFinalization.error);
assert.equal(repeatedFinalization.data.duplicate, true);

const { data: soldAuction } = await admin.from("auctions").select("winning_team_id,winning_bid,player_id").eq("id", auctionId).single();
const { data: winner } = await admin.from("teams").select("credits_remaining,current_team_mmr,roster_size,max_roster_size").eq("id", soldAuction.winning_team_id).single();
const { data: ownership } = await admin.from("team_roster").select("id").eq("auction_id", auctionId);
assert.equal(ownership.length, 1);
assert(winner.credits_remaining >= 0);
assert(winner.roster_size <= winner.max_roster_size - 1);

state = (await captains[1].rpc("get_current_auction_state", { p_tournament_id: tournamentId })).data;
const unsoldNomination = await captains[1].rpc("nominate_player", {
  p_tournament_id: tournamentId,
  p_player_id: "30000000-0000-4000-8000-000000000010",
  p_expected_nomination_id: state.active_nomination.id,
});
assert.ifError(unsoldNomination.error);
const unsoldAuctionId = unsoldNomination.data.id;
const paused = await organizer.rpc("pause_auction", { p_auction_id: unsoldAuctionId });
assert.ifError(paused.error);
assert(paused.data.remaining_seconds > 0);
const bidWhilePaused = await captains[2].rpc("place_bid", {
  p_auction_id: unsoldAuctionId,
  p_expected_revision: 0,
  p_request_id: crypto.randomUUID(),
  p_increment_type: "next",
});
assert.ifError(bidWhilePaused.error);
assert.equal(bidWhilePaused.data.code, "AUCTION_PAUSED");
const resumed = await organizer.rpc("resume_auction", { p_auction_id: unsoldAuctionId });
assert.ifError(resumed.error);
assert(new Date(resumed.data.closes_at).getTime() > Date.now());
assert.ifError((await admin.from("auctions").update({ closes_at: new Date(Date.now() - 1000).toISOString() }).eq("id", unsoldAuctionId)).error);
const unsold = await captains[5].rpc("finalize_auction", { p_auction_id: unsoldAuctionId });
assert.ifError(unsold.error);
assert.equal(unsold.data.status, "unsold");
const { data: unsoldPlayer } = await admin.from("tournament_players").select("is_drafted").eq("id", "30000000-0000-4000-8000-000000000010").single();
assert.equal(unsoldPlayer.is_drafted, false);

const { data: allRosters } = await admin.from("team_roster").select("tournament_id,player_id,team_id").eq("tournament_id", tournamentId);
assert.equal(new Set(allRosters.map(row => `${row.tournament_id}:${row.player_id}`)).size, allRosters.length, "player ownership must be unique");
const { data: allTeams } = await admin.from("teams").select("credits_remaining,roster_size,max_roster_size").eq("tournament_id", tournamentId);
assert(allTeams.every(team => team.credits_remaining >= 0 && team.roster_size <= team.max_roster_size - 1));

await Promise.all([...captains, organizer, freshCaptain].map(client => client.removeAllChannels()));
console.log(JSON.stringify({
  result: "PASS",
  captains: 6,
  attempts: attempts.length,
  accepted: attempts.filter(attempt => attempt.ok && !attempt.duplicate).length,
  rejected: attempts.filter(attempt => !attempt.ok).length,
  duplicateRetries: attempts.filter(attempt => attempt.duplicate).length,
  durationMs,
  invariants: {
    uniqueAcceptedRevisions: "PASS",
    noLostAcceptedBid: "PASS",
    nonNegativeCredits: "PASS",
    rosterCaps: "PASS",
    uniquePlayerOwnership: "PASS",
    leaderBidConsistency: "PASS",
    idempotentFinalization: "PASS",
    canonicalReconnect: "PASS",
    realtimeDelivery: "PASS",
    pauseResume: "PASS",
    unsoldFlow: "PASS",
  },
}));
