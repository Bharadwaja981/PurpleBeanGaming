# Launch runbook

1. Confirm launch owner, communications channel, rollback owner, and maintenance decision.
2. Verify a current backup and successful isolated restore evidence.
3. Verify production and staging environment variables without printing values.
4. Confirm Supabase Auth URLs, OAuth callbacks, Storage, Realtime, cron, provider budgets, monitoring, and alerts.
5. Enable maintenance only if the migration requires it.
6. Apply tracked migrations to the explicitly selected production project.
7. Verify migration version, database advisors, RLS, grants, and critical invariants.
8. Promote/deploy the staging-certified Vercel artifact.
9. Verify health/readiness, Auth, jobs, one public tournament, one controlled authenticated flow, and privacy boundaries.
10. Disable maintenance and open the platform.
11. Observe errors, database load, Auth failures, auction failures, job backlog, provider health, rate limits, and moderation queues continuously for the first hour and regularly for 24 hours.

Abort when migrations fail, secrets/configuration are missing, health is degraded, critical smoke tests fail, privacy data is exposed, or rollback compatibility is uncertain.
