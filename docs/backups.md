# Backups and restore

Use Supabase project backups appropriate to the selected plan and enable point-in-time recovery when the launch plan supports it. Record retention, region, encryption, responsible operator, and restore permissions. Vercel deployment history is not a database backup.

Storage objects and configuration require separate inventory/export where platform backups do not cover them. Preserve migration files, Auth configuration, bucket/policy configuration, provider configuration names, and operational runbooks without exporting secrets into source control.

Quarterly and before high-risk migrations, restore into an isolated non-production project. Verify profile relationships, tournaments, auction events, competition history, ratings, sanctions, audit records, external match links, Storage references, and row counts/checksums. Never restore production over staging or vice versa without explicit incident approval.

Initial targets pending plan confirmation: RPO 24 hours with daily backups, improved to the configured PITR window when enabled; RTO 4 hours for database restoration and controlled application recovery. These are operational targets, not contractual guarantees.

## Isolated restore procedure

Create a separate Supabase restore project of the same Postgres major version. Use the supported dashboard/PITR restore or a logical export compatible with Supabase-managed extensions. Apply required platform configuration, restore schema and data using credentials supplied through the secret manager, and never target staging or production by an ambiguous CLI link.

Capture source/target migration versions and counts for profiles, tournaments, teams, auction events, bids, matches, ratings/events, achievements, moderation cases, sanctions, support tickets, Dota accounts/matches/links/telemetry, and audit events. Check every foreign-key orphan class, public reads, Auth-compatible profile linkage, Storage references, and representative histories. Record duration, failures, operator, timestamp, and destroy the restore target only after evidence is retained.
