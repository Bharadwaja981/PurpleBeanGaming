# Production bootstrap

Production work begins only after staging E2E, privacy, load, Realtime, restore, monitoring, firewall, and legal gates pass. Create production Supabase and Vercel projects separately from staging. Configure exact HTTPS Site URL/callbacks, Storage, Realtime, cron, monitoring, firewall, rate-limit salt, and provider secrets.

Verify backup and restore evidence, migration list, environment target, release identifier, Node runtime, and rollback compatibility. Apply tracked migrations once, deploy the staging-certified artifact, run safe health/Auth/public/admin/job/provider/privacy smoke tests, and observe for one hour before opening traffic. Never run load or destructive suites against production without explicit authorization.
