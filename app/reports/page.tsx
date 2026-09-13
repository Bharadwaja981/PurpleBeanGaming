import { AppShell } from "@/components/layout/app-shell";
import { ReportForm } from "@/components/platform/user-operations";
import { requireUser } from "@/lib/platform/auth";

export default async function ReportsPage() { const { supabase } = await requireUser(); const { data } = await supabase.from("reports").select("id,report_type,status,created_at").order("created_at", { ascending: false }); return <AppShell><h1 className="text-3xl font-bold">Confidential reports</h1><p className="muted mt-2">Submit misconduct for the moderation team. Reporter identity and evidence remain private.</p><ReportForm/><h2 className="mt-10 text-xl font-semibold">Your reports</h2><div className="mt-4 space-y-3">{data?.map(x => <div key={x.id} className="card flex justify-between gap-3 p-4"><span className="capitalize">{x.report_type.replaceAll("_"," ")}</span><span className="muted text-sm">{x.status}</span></div>)}{!data?.length && <p className="muted">No reports submitted.</p>}</div></AppShell>; }
