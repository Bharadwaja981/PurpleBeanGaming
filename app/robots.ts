import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return { rules: { userAgent: "*", allow: ["/", "/tournaments/", "/players/", "/organizations/", "/seasons/", "/leaderboards"], disallow: ["/admin", "/dashboard", "/platform-admin", "/reports", "/support", "/settings", "/api/internal"] }, sitemap: `${base}/sitemap.xml`, host: base };
}
