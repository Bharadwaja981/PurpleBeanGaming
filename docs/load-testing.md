# Staging load testing

Run load tests only against an isolated staging or local environment. Every harness requires `BASE_URL` and refuses an obvious production hostname unless `ALLOW_PRODUCTION_LOAD_TEST=true` is explicitly set. Never set that override as a persistent environment variable.

- `npm run load:public`: set `PUBLIC_PATHS` to comma-separated home, public tournament, auction spectator, standings, leaderboard, and match URLs; set `CONCURRENCY` and `REQUESTS`.
- `npm run load:mixed`: additionally set a staging-only `AUCTION_MUTATION_URL`, short-lived `AUCTION_TEST_TOKEN`, JSON `AUCTION_TEST_PAYLOAD`, `AUCTION_ACTORS`, and `AUCTION_REQUESTS`. Afterward, run the auction concurrency/invariant suite independently.
- `npm run load:realtime`: set staging `SUPABASE_URL`, public anon key, and `SUBSCRIBERS` (100 or more). It verifies subscription delivery, disconnect/reconnect, and canonical database refetch.
- `npm run benchmark:routes`: set `ROUTE_MATRIX` to JSON containing HOME, TOURNAMENT, AUCTION_STATE, PLAYER_CAREER, LEADERBOARD, MATCH_PAGE, ADMIN_DASHBOARD, and MODERATION_QUEUE paths, plus `SAMPLES`.

Outputs are JSON with request counts, errors, median, p95, and worst latency where applicable. Use disposable test accounts and never store tokens in source, logs, or chat.
