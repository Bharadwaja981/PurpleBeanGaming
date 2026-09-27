# Production environments

PurpleBeanGaming uses isolated local, staging, and production environments. Each has a separate Supabase project, database, Auth configuration, Storage, Realtime, jobs, provider credentials, and Vercel environment scope. Staging must never use production data or secrets.

Public/build-time variables are `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Server-only runtime secrets are `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `DOTA_SYNC_SECRET`, `READINESS_SECRET`, `CRON_SECRET`, `OPENDOTA_API_KEY`, `STEAM_WEB_API_KEY`, and `ERROR_MONITORING_DSN`.

Production URLs must be HTTPS and must not resolve to localhost. Preview/staging variables must point only to staging infrastructure. Use Vercel environment scopes; do not commit `.env.local`, `.supabase_env`, keys, tokens, or database URLs.

Before deployment, validate all required variables, Supabase Site URL and redirect allowlist, Google OAuth callbacks if enabled, Storage buckets, Realtime publication, provider budgets, and cron authentication.
