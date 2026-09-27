# Auction Recovery

All live state is persisted in PostgreSQL. An application restart, browser refresh, WebSocket loss, or device reconnect cannot erase or replace the auction. On initial load, reconnect, and every relevant Realtime event, the UI calls `get_current_auction_state` and replaces its local projection.

Realtime is transport, never authority. Subscriptions cover auctions, bids, teams, rosters, and nomination order. A missed or delayed event is repaired by the next canonical fetch. Channel errors show a degraded status and the browser's `online` event triggers a fresh read.

Expired open auctions can be finalized idempotently by any authenticated participant through `finalize_auction`. The migration schedules `private.finalize_expired_auctions()` with Supabase Cron once per minute as an abandoned-auction safety net. It locks expired rows with `SKIP LOCKED`, so overlapping workers are safe. User/server calls provide second-level closure while the cron job guarantees eventual progress without an open browser.

Pause persists the exact remaining seconds calculated from database time and sets the tournament to `auction_paused`. Resume constructs a new deadline from database-now plus that stored duration, clears the pause remainder, and returns the tournament to `auction_live`.
