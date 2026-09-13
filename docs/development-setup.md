# PurpleBeanGaming development setup

1. Install Node.js 20+, Docker, and the Supabase CLI.
2. Copy `.env.example` to `.env.local` and add the local or hosted project URL and anon key. Never add a service-role key to a `NEXT_PUBLIC_` variable.
3. Run `npm install`, `supabase start`, then `supabase db reset`.
4. Run `npm run dev`. Configure Google OAuth and magic-link redirect URLs to `/auth/callback` in Supabase.
5. Validate with `npm run lint`, `npm run typecheck`, `npm test`, `npm run db:lint`, and `npm run build`.

Regenerate database types after migrations with `npx supabase gen types typescript --local > types/database.ts`.

The auth trigger synchronizes a minimal profile at first login. Gaming identities remain optional profile attributes and are not authentication identities.
