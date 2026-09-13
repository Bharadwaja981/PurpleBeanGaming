# Competition engine

PostgreSQL owns competition configuration, schedule generation, match state, standings, bracket progression, and completion. Phase 06 implements deterministic round robin, deterministic within-group round robin, and generic single elimination. Double elimination is intentionally deferred because a fully tested lower-bracket progression graph is outside this phase's safe implementation.

Round-robin generation creates each unordered team pair once. Group generation only pairs teams assigned to the same group. Single elimination creates a power-of-two bracket graph; upstream winners fill protected downstream slots. Existing schedules are never silently overwritten.

Competition settings store scoring and the ordered tiebreak rules. Final completion requires every canonical match to be completed, forfeited, cancelled, or superseded and no open dispute. `rematch_ordered` remains non-terminal until its replacement completes. Completion creates one immutable result snapshot containing settings, public match results, standings, champion, and runner-up.

Group qualification is persisted by the organizer-only advancement RPC. It refuses incomplete groups and blocks the qualification boundary with TIEBREAK_REQUIRED when configured metrics do not separate the relevant teams. Qualifiers are passed to the same protected single-elimination builder used by direct knockout formats.

For two groups with two qualifiers each, persisted server-side mappings produce A1 vs B2 and B1 vs A2. Repeated or concurrent advancement returns the existing four qualifiers without duplicating slots.

In-app notifications are emitted transactionally for scheduling, results, disputes, resolutions, rescheduling, and completion. A database cron job emits check-in-open and deadline-approaching events once per team and match.

Phase 06B benchmark (local Supabase, 11 September 2026): single-elimination generation completed in 24 ms for 6 teams, 12 ms for 16 teams, and 32 ms for 100 teams. The corresponding public schedule reads completed in 9 ms, 4 ms, and 5 ms. The executable guardrails are 5,000 ms for generation and 2,000 ms for the public read.

Phase 06C production-route benchmark (20 requests per route, 12 September 2026) kept every median below 200 ms. Schedule/standings/bracket/match/organizer medians were 16.37/12.24/11.36/9.27/103.65 ms for 6 teams; 19.46/11.84/9.97/7.98/103.01 ms for 16 teams; and 19.69/14.82/10.46/7.53/103.06 ms for 120 completed matches.
