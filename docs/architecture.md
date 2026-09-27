# PurpleBeanGaming architecture

PurpleBeanGaming uses Next.js App Router on Vercel with cookie-backed Supabase Auth. Server and browser clients use only the publishable/anon credential; no normal application path uses a service-role key. PostgreSQL is authoritative for roles, ratings, credits, rosters, and auction decisions. Realtime distributes committed rows but never decides outcomes.

Membership and roles are separate: `tournament_members` identifies participation and `tournament_member_roles` gives it one or more scoped roles. This supports a user who is simultaneously captain and referee while preventing an organizer role in one tournament from leaking into another.

Future auction commands belong in atomic, security-definer database functions with explicit authorization, optimistic `revision` checks, idempotent `request_id`, constraints, and audit writes in one transaction.
