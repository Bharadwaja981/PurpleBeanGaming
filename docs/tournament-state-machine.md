# PurpleBeanGaming tournament state machine

Normal flow: `draft → registration → verification → rating_review → player_pool_locked → auction_ready → auction_live → rosters_locked → competition → completed`. `auction_live ↔ auction_paused` is the only normal reversible edge. Active states may transition to `cancelled`; completed and cancelled are terminal. Any correction outside this graph requires a future audited administrative database function, not a direct client update.
