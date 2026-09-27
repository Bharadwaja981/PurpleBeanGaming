# Deployment

Deploy staging first. Apply repository migrations with the Supabase CLI using a scoped staging credential, then deploy the Vercel preview/staging build. Never patch a remote database manually.

Run clean install, lint, typecheck, unit/database/security suites, production build, and staging E2E. Confirm `/api/health`, restricted `/api/internal/readiness`, Auth callbacks, Storage, Realtime, external jobs, and provider health.

For production, take and verify a backup, record the current Vercel deployment and migration version, enable maintenance only when required, run `supabase db push` against the explicitly selected production project, deploy the already validated build, perform controlled smoke tests, and observe dashboards before opening traffic.

Schema rollback is forward-fix by default. Application rollback uses Vercel promotion/rollback only when the older application is compatible with the deployed schema. Destructive database rollback requires an approved restore plan.
