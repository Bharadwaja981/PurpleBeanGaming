import { Metric } from "@/components/platform/platform-shell";
import { requirePlatformRole } from "@/lib/platform/auth";

export default async function PlatformAdminPage() {
  const { supabase, role } = await requirePlatformRole(["super_admin", "platform_moderator", "support_agent"]);
  if (role === "support_agent") {
    const { count } = await supabase.from("support_tickets").select("id", { count: "exact", head: true }).not("status", "in", '("resolved","closed")');
    return <><h1 className="text-3xl font-bold">Support operations</h1><p className="muted mt-2">Your access is limited to user-safe support context.</p><div className="mt-6 max-w-xs"><Metric label="Open support tickets" value={count ?? 0} urgent={Boolean(count)} /></div></>;
  }
  const { data } = await supabase.from("platform_health").select("*").single();
  const metrics = [
    ["Active tournaments", data?.active_tournaments ?? 0], ["Open reports", data?.open_reports ?? 0],
    ["Open cases", data?.open_cases ?? 0], ["Open support", data?.open_support ?? 0],
    ["Active sanctions", data?.active_sanctions ?? 0], ["Unresolved disputes", data?.unresolved_disputes ?? 0],
    ["Rating backlog", data?.rating_backlog ?? 0],
  ] as const;
  return <><h1 className="text-3xl font-bold">Platform operations</h1><p className="muted mt-2">Live, privacy-safe operational priorities.</p><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label,value], i) => <Metric key={label} label={label} value={value} urgent={i > 0 && Number(value) > 0} />)}</div></>;
}
