# Observability

Monitor HTTP error rate and latency, Supabase health, Auth failures, database connections and slow queries, Realtime disconnects, Storage errors, auction-finalizer state, rating backlog, external-sync backlog, provider circuit state, rate limits, moderation queue, and support queue.

Logs use request ID, route, operation, safe actor identifier, domain error code, status, and duration. Never log passwords, cookies, tokens, API/service keys, private evidence, full authorization headers, or raw provider payloads.

`/api/health` exposes only high-level database availability. `/api/internal/readiness` requires a dedicated bearer secret and returns environment validity, provider state, and external-job backlog. Configure external uptime checks for health and authenticated internal monitoring for readiness.

An error-monitoring provider is not yet selected. Before staging certification, configure a server/client monitoring SDK or Vercel observability drain with environment tags, source maps, sampling, retention, alert ownership, and payload scrubbing.

The provider-neutral monitoring layer exposes message, exception, client, and job-failure capture with centralized redaction and a network-free test adapter. Configure `MONITORING_ENVIRONMENT`, `MONITORING_RELEASE`, and the selected provider's server-only DSN. The guarded `POST /api/internal/monitoring-test` route is unavailable in production and requires `READINESS_SECRET` elsewhere.

Alert guidance: page on sustained readiness failure, critical auction-finalizer failure, or a server-error spike above 5% for five minutes. Warn on external-job backlog above 100 for ten minutes, provider circuit open for ten minutes, or rate-limit rejection rate above 20% for five minutes. Routine 404 and expected 429 events do not page. Remote alerts remain unconfigured until staging infrastructure exists.
