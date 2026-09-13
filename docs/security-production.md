# Production security

All exposed tables require RLS and explicit grants. Security-definer functions use fixed empty search paths, internal authorization, and restricted execute grants. Service-role and provider secrets are server-only.

Global headers enforce CSP, HSTS, frame denial, MIME sniffing protection, strict referrer behavior, and a restrictive permissions policy. The CSP permits inline scripts/styles currently required by the Next.js runtime and styling model; remove these allowances only after a nonce/hash rollout is tested.

Supabase Auth production Site URL and redirect allowlists must use the exact staging and production HTTPS origins. Privilege revocation, suspended accounts, administrator changes, Storage access, cross-tournament IDOR, SSRF defenses, and server-only bundle boundaries are release gates.

Rate limits must be durable and shared across serverless instances. Vercel Firewall or another distributed control should protect broad bot traffic; database-backed limits should protect authenticated domain mutations. Do not use per-process memory for production enforcement.

The application limiter stores atomic hashed buckets in Supabase and accepts only server-derived identities through a service-role-only RPC. Central policies cover search, reports, support, provider refresh categories, external link/relink, admin mutations, account deactivation, and client-error intake. Live auction bids deliberately retain their authoritative revision/locking/idempotency controls without a generic low ceiling.

For staging, enable observe/log rules first, exclude Auth callbacks, health checks, internal cron authentication, and normal auction traffic, then exercise report/support/search bursts. For production, promote only reviewed rules, monitor false positives, and keep an immediate disable/rollback procedure. Suggested platform controls include managed bot filtering and high-volume rate rules for public search, report/support entry points, and obvious floods; never rely on robots.txt as enforcement.
