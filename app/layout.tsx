import type { Metadata } from "next";
import "./globals.css";
import { brand } from "@/lib/config";
import { AnnouncementBanner } from "@/components/platform/announcement-banner";
import { SiteHeader } from "@/components/layout/site-header";
const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: brand.productName, template: `%s | ${brand.productName}` },
  description: brand.tagline,
  applicationName: brand.productName,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: brand.productName, title: brand.productName, description: brand.tagline, url: "/" },
  twitter: { card: "summary", title: brand.productName, description: brand.tagline },
};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body><AnnouncementBanner/><SiteHeader/>{children}</body></html>; }
