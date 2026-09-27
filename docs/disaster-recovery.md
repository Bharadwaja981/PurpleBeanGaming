# Disaster recovery

For database corruption or an accidental migration: stop writes or enable maintenance, capture evidence, identify the last safe recovery point, restore into isolation, validate invariants, then cut over using the approved Supabase process. Prefer forward fixes when integrity is intact.

For Vercel deployment failure: keep the database unchanged, roll back/promote the last schema-compatible deployment, then validate health, Auth, jobs, and one public route.

For Supabase outage: keep public failure states safe, pause mutation-dependent operations, preserve queued work, monitor vendor status, and validate Auth, database, Storage, and Realtime after recovery.

For Realtime outage: polling fallbacks continue where implemented; do not infer missed auction state. Reconnect clients and confirm canonical database state.

For provider outage: the circuit breaker suppresses repeated calls, cached non-critical data may be marked stale, and manual competition results remain authoritative.

For job failure: inspect leases/backlog, correct the cause, and replay only idempotent jobs. For credential compromise: revoke/rotate the credential, redeploy affected environments, invalidate sessions where applicable, audit access, and notify stakeholders under the incident policy.
