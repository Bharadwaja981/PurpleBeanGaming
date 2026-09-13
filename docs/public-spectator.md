# Public spectator experience

Anonymous pages consume `get_public_draft_package`, never private base tables. The RPC projects only public tournament, auction, team, roster, history, and analytics fields.

`spectator_delay_seconds` defaults to zero and is enforced in PostgreSQL. The package uses a database cutoff of `clock_timestamp() - delay`; the browser polls this already-delayed projection. Accepted bids, auction state, completed nominations, roster additions, team credits, team MMR, and player counts are reconstructed at that cutoff. Reconnecting produces the same delayed state. Captain and organizer RPCs remain immediate.

The live page includes the current nomination, accepted bid feed, nomination order, public-safe draft health, team balances, captain-inclusive player counts, and rosters. Rejected bids never enter the public feed.

The public client cannot nominate, bid, pause, resume, finalize, snapshot, or export. It never receives rejected bids, request IDs, actor IDs, raw audit payloads, evidence, appeals, reviews, or scouting.
