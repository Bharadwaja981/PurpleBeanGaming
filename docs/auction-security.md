# Auction Security

Normal `authenticated` clients have no `INSERT`, `UPDATE`, or `DELETE` privilege on `auctions`, `bids`, `team_roster`, or `nomination_order`. Triggers also prevent direct changes to team credits/MMR/roster totals and player drafted state, including organizer-originated table updates. Mutations are available only through narrow, explicitly granted RPCs.

Each `SECURITY DEFINER` RPC has an empty `search_path`, fully qualifies objects, checks `auth.uid()` and tournament-scoped roles, and derives the captain's team from the authenticated identity. No RPC accepts a client-selected team ID for bidding. Internal helpers live in the unexposed `private` schema and have execution revoked from `PUBLIC`, `anon`, and `authenticated`.

RLS remains enabled on all exposed tables. Realtime evaluates the same read policies. Public auction projections omit captain identity and private audit payloads. The canonical RPC returns private team balances only to authenticated callers and detailed audit-log entries only to a tournament organizer.

Accepted and meaningful rejected bids are immutable audit records. Lifecycle actions also write `audit_events`. The service/secret key is used only by local integration fixtures and must never appear in browser code or a `NEXT_PUBLIC_` variable.
