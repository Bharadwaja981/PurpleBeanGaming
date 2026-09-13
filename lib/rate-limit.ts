import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const rateLimitPolicies = {
  search: [{ scope: "search_burst", limit: 12, windowSeconds: 10 }, { scope: "search_sustained", limit: 120, windowSeconds: 3600 }],
  report: [{ scope: "report", limit: 3, windowSeconds: 3600 }],
  supportTicket: [{ scope: "support_ticket", limit: 5, windowSeconds: 3600 }],
  supportReply: [{ scope: "support_reply", limit: 20, windowSeconds: 3600 }],
  providerRefresh: [{ scope: "provider_refresh", limit: 6, windowSeconds: 3600 }],
  dotaAccountRefresh: [{ scope: "dota_account_refresh", limit: 6, windowSeconds: 3600 }],
  externalMatchLink: [{ scope: "external_match_link", limit: 12, windowSeconds: 3600 }],
  externalMatchRelink: [{ scope: "external_match_relink", limit: 6, windowSeconds: 3600 }],
  adminMutation: [{ scope: "admin_mutation", limit: 60, windowSeconds: 600 }],
  accountDeactivation: [{ scope: "account_deactivation", limit: 3, windowSeconds: 86400 }],
  clientError: [{ scope: "client_error", limit: 10, windowSeconds: 60 }],
} as const;
export type RateLimitPolicy = keyof typeof rateLimitPolicies;

export class RateLimitError extends Error {
  readonly code = "RATE_LIMITED";
  constructor(readonly retryAfterSeconds: number) { super("RATE_LIMITED"); }
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("RATE_LIMIT_NOT_CONFIGURED");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function hashRateLimitIdentity(identity: string) {
  const salt = process.env.RATE_LIMIT_SALT ?? process.env.DOTA_SYNC_SECRET;
  if (!salt) throw new Error("RATE_LIMIT_SALT_NOT_CONFIGURED");
  return createHash("sha256").update(`${salt}:${identity}`).digest("hex");
}
export async function requestIdentity(userId?: string | null) {
  if (userId) return `user:${userId}`;
  const values = await headers();
  const platformIp = values.get("x-vercel-forwarded-for") ?? values.get("x-real-ip") ?? values.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `anonymous:${platformIp ?? "unknown"}`;
}
export async function enforceRateLimit(policy: RateLimitPolicy, identity: string) {
  const key = hashRateLimitIdentity(identity), db = admin();
  for (const rule of rateLimitPolicies[policy]) {
    const { data, error } = await db.rpc("consume_rate_limit", { p_scope: rule.scope, p_key_hash: key, p_limit: rule.limit, p_window_seconds: rule.windowSeconds });
    if (error) throw error;
    const result = data?.[0];
    if (!result?.allowed) throw new RateLimitError(result?.retry_after_seconds ?? rule.windowSeconds);
  }
}
