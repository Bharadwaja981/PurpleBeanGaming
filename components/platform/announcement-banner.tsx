import { createClient } from "@/lib/supabase/server";

export async function AnnouncementBanner() { const { data } = await (await createClient()).from("public_active_announcements").select("id,title,body,severity").order("starts_at", { ascending: false }).limit(3); if (!data?.length) return null; return <aside aria-label="Platform announcements" className="border-b border-amber-400/30 bg-amber-400/10 px-4 py-2 text-center text-sm">{data.map(x => <p key={x.id}><strong>{x.title}:</strong> {x.body}</p>)}</aside>; }
