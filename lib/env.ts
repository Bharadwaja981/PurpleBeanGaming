const requiredPublic = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
const requiredServer = ["SUPABASE_SERVICE_ROLE_KEY", "DOTA_SYNC_SECRET", "READINESS_SECRET"] as const;

export function validateEnvironment(options: { production?: boolean; server?: boolean } = {}) {
  const production = options.production ?? process.env.NODE_ENV === "production";
  const names = [...requiredPublic, ...(options.server ? requiredServer : [])];
  const missing = names.filter((name) => !process.env[name]?.trim());
  const invalid: string[] = [];
  for (const name of requiredPublic.filter((item) => item.endsWith("_URL"))) {
    const value = process.env[name];
    if (!value) continue;
    try {
      const url = new URL(value);
      if (production && url.protocol !== "https:") invalid.push(`${name}_HTTPS_REQUIRED`);
      if (production && ["localhost", "127.0.0.1"].includes(url.hostname)) invalid.push(`${name}_LOCALHOST_FORBIDDEN`);
    } catch { invalid.push(`${name}_INVALID_URL`); }
  }
  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid };
}
