# Auction Concurrency

Every bid locks its `auctions` row with `SELECT … FOR UPDATE`. The caller must submit the last observed `revision`; only the first request at that revision can mutate the row. The accepted mutation increments the revision exactly once and stores both revision values on the bid. Requests arriving later at the old revision are persisted as `STALE_REVISION` rejections without changing auction state.

`bids.request_id` is globally unique. Before any mutation, `place_bid` checks for that identifier and returns the original result when the authenticated captain and auction match. Reuse by another identity or auction is rejected. The unique constraint closes the remaining race window.

The stress harness uses six authenticated captains and repeated six-way races. It verifies one accepted mutation per observed revision, unique sequential accepted revisions, deterministic duplicate retries, increasing bids, consistent leader/current-bid state, nonnegative credits, roster caps, and unique player ownership.

Finalization uses the same row-lock discipline. The partial unique indexes permit one live auction per tournament and one live auction per player, while the active-roster and active-nomination unique indexes protect ownership and turn invariants.
