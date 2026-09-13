import { AppShell } from "@/components/layout/app-shell";
import { SupportForm } from "@/components/platform/user-operations";
import { requireUser } from "@/lib/platform/auth";
import Link from "next/link";

export default async function SupportPage() { const { supabase } = await requireUser(); const { data } = await supabase.from("support_tickets").select("id,category,subject,status,updated_at").order("updated_at", { ascending: false }); return <AppShell><h1 className="text-3xl font-bold">Support</h1><p className="muted mt-2">Get help with your account, tournaments, or technical issues.</p><SupportForm/><h2 className="mt-10 text-xl font-semibold">Your tickets</h2><div className="mt-4 space-y-3">{data?.map(x => <Link href={`/support/${x.id}`} key={x.id} className="card block p-4"><div className="flex justify-between gap-3"><strong>{x.subject}</strong><span className="muted text-sm">{x.status}</span></div><p className="muted mt-1 text-sm capitalize">{x.category}</p></Link>)}{!data?.length && <p className="muted">No support tickets.</p>}</div></AppShell>; }
