# OpenDota

OpenDota is PurpleBeanGaming's primary external Dota provider. The adapter has typed normalized outputs, an 8-second default timeout, bounded exponential backoff with jitter, `Retry-After` handling, cancellation, and safe domain errors. Keys remain in `OPENDOTA_API_KEY`; cache keys, logs, audit payloads, and UI never include them.

HTTP 404 is deterministic and is not retried. HTTP 429, 5xx, and transport timeouts may be retried within the bounded policy. Persisted request outcomes and provider health intentionally omit URLs and response bodies.

Normalized responses pass through the persistent cache and circuit-breaker runtime before job ingestion. Provider health records closed/open/half-open state, last success/failure, consecutive failures, rate-limit totals, and next retry time. Transition audit events are emitted only on degradation and recovery to avoid routine request spam.
