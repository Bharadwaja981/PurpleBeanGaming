# External data privacy

Public pages expose only normalized statistics from linked games whose canonical match is completed or forfeited. They do not expose provider keys, cache payloads, request internals, jobs, private snapshots, unpublished identity data, or integrity signals.

PurpleBeanGaming does not bypass provider privacy, punish private profiles, or mix public matchmaking history into PurpleBeanGaming Tournament Dota Stats. API payloads are minimized; large raw provider blobs are not retained. External Dota telemetry cannot modify Tournament MMR or `draftgg_rating_v1`.

Public aggregates include completeness counts and exclude unavailable metrics from averages. Reconciliation diagnostics, unknown-account signals, provider job errors, cache payloads, circuit internals, and relink reasons are never part of public projections.
