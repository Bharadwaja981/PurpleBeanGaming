import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const fixed = ["", "/leaderboards", "/terms", "/privacy", "/conduct"].map((path) => ({ url: `${base}${path}`, changeFrequency: "weekly" as const }));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return fixed;
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });
  const [{ data: tournaments }, { data: players }] = await Promise.all([db.from("public_tournament_summary").select("slug"), db.from("public_player_career_stats").select("public_slug")]);
  return [...fixed, ...(tournaments ?? []).filter((x) => x.slug).map((x) => ({ url: `${base}/tournaments/${x.slug}`, changeFrequency: "daily" as const })), ...(players ?? []).filter((x) => x.public_slug).map((x) => ({ url: `${base}/players/${x.public_slug}`, changeFrequency: "weekly" as const }))];
}
