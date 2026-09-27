# PurpleBeanGaming Competitive Rating

Version `draftgg_rating_v1` uses deterministic team Elo with explicit uncertainty. Each player's starting rating is `1000 + clamp((Tournament MMR - 3000) / 5, -300, 300)` and starts with uncertainty 350. Tournament MMR is read only for initialization and is never overwritten.

For a canonical match, each team's expectation is calculated from the average pre-match rating of its confirmed active lineup. Player change is `K × (result - expectation)`, rounded to two decimals. K is 24 scaled by uncertainty and bounded to 12–32. Uncertainty decays by 8% per match to a floor of 60. Players become Established after the configured match minimum; others are visibly Provisional.

Only completed, non-forfeit canonical matches with two locked lineups qualify. Cancelled, disputed, superseded and rematch-ordered matches do not qualify. A rematch contributes only through its canonical replacement. Auction price never affects rating.

The ledger is unique by player, match and rating version. Processing uses a transaction lock, so retries and concurrent workers apply once. `rebuild_competitive_ratings()` deletes derived state and replays eligible matches by `completed_at ASC, match_id ASC`; this is the approved historical-result correction mechanism. Career state, season state, and the ledger are published through Supabase Realtime, while reloads always read the same canonical projections. Formula changes require a new version rather than editing historical events.

Limitations: team Elo applies the same result evidence to each confirmed participant, does not ingest game-level performance, and does not infer participation from roster membership.
