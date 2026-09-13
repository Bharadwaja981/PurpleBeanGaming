import { afterEach, describe, expect, it } from "vitest";
import { validateEnvironment } from "@/lib/env";

const names = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DOTA_SYNC_SECRET", "READINESS_SECRET"] as const;
const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
afterEach(() => { for (const name of names) { if (original[name] === undefined) delete process.env[name]; else process.env[name] = original[name]; } });

describe("production environment validation", () => {
  it("accepts complete HTTPS production configuration", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://draftgg.example";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only";
    process.env.DOTA_SYNC_SECRET = "server-only";
    process.env.READINESS_SECRET = "server-only";
    expect(validateEnvironment({ production: true, server: true })).toEqual({ ok: true, missing: [], invalid: [] });
  });

  it("rejects missing server secrets", () => {
    for (const name of names) delete process.env[name];
    const result = validateEnvironment({ production: true, server: true });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("rejects localhost and insecure production URLs", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public";
    const result = validateEnvironment({ production: true });
    expect(result.ok).toBe(false);
    expect(result.invalid).toContain("NEXT_PUBLIC_SITE_URL_HTTPS_REQUIRED");
    expect(result.invalid).toContain("NEXT_PUBLIC_SITE_URL_LOCALHOST_FORBIDDEN");
  });
});
