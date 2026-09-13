import Link from "next/link";
import { BrandLockup } from "@/components/layout/brand-lockup";

const links = ["overview","users","organizers","reports","cases","sanctions","support","announcements","audit","health","integrations","config"];

export function PlatformShell({ children, role }: { children: React.ReactNode; role: string }) {
  const visible = role === "support_agent" ? ["overview", "support"] : role === "platform_moderator" ? links.filter((x) => x !== "config" && x !== "users") : links;
  return <div className="app-frame"><div className="workspace"><aside className="sidebar"><BrandLockup compact/><div><strong className="sidebar-title">Platform Admin</strong><span className="sidebar-subtitle">{role.replaceAll("_", " ")}</span></div><nav aria-label="Platform administration">{visible.map((item) => <Link key={item} href={item === "overview" ? "/platform-admin" : `/platform-admin/${item}`} className="capitalize">{item}</Link>)}</nav></aside><main className="workspace-main">{children}</main></div></div>;
}

export function Metric({ label, value, urgent = false }: { label: string; value: number | string; urgent?: boolean }) {
  return <div className="card metric-card"><span>{label}</span><strong className={urgent ? "text-amber-400" : "text-white"}>{value}</strong></div>;
}
