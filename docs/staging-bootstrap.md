# Staging bootstrap

1. Create a dedicated Supabase staging project and a separate restore-target project; record project references in the approved secret manager.
2. Link the CLI explicitly to staging and verify the selected reference before applying repository migrations.
3. Configure the existing Storage buckets/policies and Realtime publication from the repository baseline.
4. Set the Supabase Auth Site URL and callback allowlist to the staging HTTPS deployment; add distinct Google OAuth credentials only if OAuth will launch.
5. Configure cron authentication, Dota provider secrets, rate-limit salt, readiness secret, and monitoring variables without copying production values.
6. Create a dedicated Vercel staging project and set Preview/Staging environment variables from `.env.example`.
7. Deploy, then run health/readiness, Auth, Storage, Realtime, critical browser E2E, privacy/client-bundle scans, `npm run benchmark:routes`, `npm run load:public`, `npm run load:mixed`, and `npm run load:realtime`.
8. Back up staging using the supported Supabase process, restore into the isolated restore target, and run the consistency matrix in `docs/backups.md`.

Required user-provided infrastructure: staging Supabase project, restore-target project, staging Vercel project, optional staging subdomain, monitoring project, OAuth credentials if used, and Vercel Firewall availability. Store credentials in the platform secret stores, never in chat or source control.
