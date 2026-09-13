# Match security

Canonical match tables have RLS and no client write grants. Captains act through RPCs scoped to their participating team; organizers and referees are checked against active tournament roles. Public views project schedule, scores, winner, stage, group, and replay links only.

Lobby passwords, private evidence paths, report notes, dispute reasons, and internal audit payloads are absent from public projections. Base match access grants only safe columns. The protected operations RPC reveals lobby credentials only to participating captains and tournament-scoped officials, and dispute details only to officials.

The private match-evidence bucket accepts participating captains and officials under the tournament/match path. Anonymous access is denied. Realtime publishes canonical state tables, but reconnecting clients must fetch current database state before subscribing.

Public score/status updates use a database-triggered public Broadcast containing only match ID, status, scores, winner, schedule, and revision. Lobby and dispute fields never enter the payload. Participant operational tables also publish through RLS-protected Postgres Changes. This follows Supabase's recommended database Broadcast model while retaining canonical reconnect reads.

Rematch relations are safe public identifiers, while dispute reasons, resolution notes, evidence, request IDs, actor UUIDs, and audit payloads remain private. Public views explicitly project allowed fields. Browser reconnects reload canonical state before continuing with live updates.

The Phase 06C validation matrix includes 338 pgTAP assertions, 120 competition race iterations, captain-inclusive lineup submission, public result/standings verification, route privacy scans, storage authorization, protected routes, and CSV allowlist checks. Snapshot policy is append-only: later edits to current team, player, roster, logo, or profile records do not rewrite stored competition snapshots.
