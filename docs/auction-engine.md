# Auction Engine

PostgreSQL is the sole authority for nominations, bid legality, auction time, winners, credits, team MMR, rosters, and nomination advancement. Browser state is a projection returned by `get_current_auction_state`; Realtime events are invalidation signals that cause a canonical refetch.

## Lifecycle

`start_auction` transitions a locked player pool to `auction_live` and activates the first nomination. `nominate_player` locks the expected active nomination, verifies its captain and player eligibility, and creates one open auction using `tournament_rules.minimum_bid` and database time. `place_bid` accepts only a constrained increment choice and calculates the amount and maximum legal spend server-side. `finalize_auction` records a sold or unsold result and advances one nomination.

Credits and Tournament MMR remain independent. Phase 03 enforces the configured upper MMR cap and the minimum-credit reserve for every mandatory future roster slot. It deliberately does not implement global remaining-pool feasibility or the Phase 04 solver.

## Timer and anti-snipe

`clock_timestamp()` and persisted `closes_at` are authoritative. A client countdown is display-only. An accepted bid inside the configured threshold extends the deadline to at least database-now plus `anti_snipe_extension_seconds`. Expired auctions reject bids even if a browser timer is stale.

## Finalization

The auction, player, and winning team rows are locked. Roster insertion, credit deduction, team-MMR update, roster-size update, drafted status, auction closure, audit event, and nomination advancement execute in one transaction. Any failure rolls everything back. A retry against `sold` or `unsold` returns the stored result without applying changes twice.
