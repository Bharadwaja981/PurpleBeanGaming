# Draft analytics

Core analytics use immutable `draft_player_snapshots` and `draft_team_snapshots`.

`credits_per_1000_mmr = purchase_price / tournament_mmr_at_draft * 1000`, calculated with PostgreSQL `numeric`. Zero MMR yields null.

Expected price is transparent: calculate every sold recruit's credits-per-1,000-MMR rate, take the tournament median, then multiply that rate by the player's draft-time MMR. Price ratio bands are Strong Value (≤0.75), Good Value (≤0.90), Near Expected (<1.10), Premium Price (<1.30), and High Premium. These labels describe auction price relative to the baseline, not player or team quality.

Draft MMR Balance reports distribution only. It is not a strength ranking.

Unique bidding teams count distinct teams with accepted bids. An acquisition is contested when at least two such teams bid; otherwise it is uncontested. Wall-clock duration is the auction close time minus start time, while active duration subtracts persisted pause/resume intervals. Anti-snipe extensions are counted by the accepted-bid extension trigger. Normal and unsold-round spend are reported separately.

Team spending progression is an accessible chart backed by an equivalent table. Each step records the auction sequence, price, credits before and after, captain-inclusive team MMR after the purchase, and remaining recruit slots. Organizer feasibility analytics are sourced from persisted blocked-event snapshots; unavailable historical bounds remain null rather than being inferred.

## Local Phase 05B benchmark

Warm production-route medians for the normal fixture were 138.40 ms for summary, 126.24 ms for the team board, 130.17 ms for history, and 133.14 ms for replay/paginated history. The deterministic large fixture contained 10 tournaments, 60 teams, 300 snapshot players, 500 auctions, and 1,450 public events. Its database p95 measurements were 247.27 ms for the consolidated package, 19.75 ms for paginated history, 6.13 ms for captain history, and 4.25 ms for player history. This evidence supports retaining the consolidated live package while keeping heavy history pagination in its purpose-built RPC.
