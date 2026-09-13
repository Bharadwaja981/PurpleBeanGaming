# Dota integrations

PurpleBeanGaming treats OpenDota and Steam as evidence sources. PostgreSQL remains authoritative for identity permissions, Tournament MMR, canonical results, Competitive Rating, and sanctions. External telemetry never changes those values automatically.

## Provider assumptions (reviewed 13 September 2026)

OpenDota is the primary profile, match, parse-state, hero, and telemetry source. Its upstream project documents that match data comes from Valve APIs and replay parsing. Current upstream configuration advertises free and keyed minute/day budgets, but these are deployment configuration—not an eternal contract. PurpleBeanGaming therefore responds to HTTP 429 and `Retry-After`, uses bounded retries, caching, an internal request budget, and health/circuit state rather than hard-coding provider limits as business rules.

OpenDota player reads use `/players/{account_id}` and `/players/{account_id}/recentMatches`; match reads use `/matches/{match_id}`; hero constants use `/heroes`. A match `version` indicates enhanced parsed data in the normalized adapter. Missing fields remain null.

Steam Web API is supporting-only. `ISteamUser/GetPlayerSummaries/v2` supplies permitted public persona/avatar/visibility data. Steam privacy is respected. Steam does not replace OpenDota gameplay ingestion.

SteamID64 conversion uses decimal strings/BigInt: `SteamID64 = 76561197960265728 + Dota account_id`. The account ID is constrained to unsigned 32-bit range. JavaScript `number` is never used for SteamID64.

Sources: OpenDota API UI (`https://docs.opendota.com/`), OpenDota upstream core (`https://github.com/odota/core`), Steam Web API documentation (`https://steamcommunity.com/dev`), and Valve SteamID documentation (`https://developer.valvesoftware.com/wiki/SteamID`).

## Operations

Profile cache TTL is normally hours; active imported matches may refresh over minutes until stable; historical parsed matches are effectively immutable and should not be polled. Jobs use unique active dedupe keys and bounded attempts. A degraded provider must not block auction, competition, manual results, or moderation.

Provider base URLs are constants in server-only adapters. User input is parsed as numeric identifiers or a strict `https://steamcommunity.com/profiles/{steamid64}` form. There is no generic URL-fetch endpoint.

## Phase 09B resilience and reconciliation

The provider runtime persistently caches normalized player profiles for six hours, recent-match lists for five minutes, hero constants for 24 hours, unparsed matches for two minutes, and parsed matches for seven days. Concurrent misses are single-flighted within one worker. Expired profile/static data may be returned with an explicit stale outcome when refresh fails; match verification never consumes stale data as fresh evidence.

The circuit opens after three consecutive non-rate-limit failures for 30 seconds. Requests are suppressed while open, one controlled half-open probe is allowed after cooldown, and success closes the circuit. HTTP 429 remains a distinct rate-limit condition. Default internal safety budgets are 45/minute, 1,500/hour, and 2,500/day and are operational configuration rather than claims about OpenDota's permanent quotas.

Ten-player reconciliation compares sorted account membership, derives Radiant/Dire rather than assuming Team A is Radiant, and records matched, partial, participant-mismatch, or result-conflict state. External winners remain evidence: agreement never finalizes a result, conflict never overwrites it, and an unavailable winner stays null. Each BO3/BO5 game owns a distinct external link.

Only organizers, referees, and platform moderators may correct a link. Corrections require a reason, retain old/new IDs in append-only history, and emit `EXTERNAL_MATCH_RELINKED`. Captains may initially link games in their match but cannot rewrite historical evidence.

Public career and tournament aggregates include only completed/forfeit, reconciled PurpleBeanGaming-linked games. KDA is `(kills + assists) / max(deaths, 1)`. Null GPM/XPM are excluded from averages rather than treated as zero, and tournament projections expose imported/parsed completeness counts.
