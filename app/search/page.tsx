import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit, requestIdentity } from "@/lib/rate-limit";
type Hit={slug:string;name:string;kind:string};
export default async function Page({searchParams}:{searchParams:Promise<{q?:string}>}){
  const q=(await searchParams).q?.trim()??"",db=await createClient();
  if(q){const{data:{user}}=await db.auth.getUser();await enforceRateLimit("search",await requestIdentity(user?.id));}
  const{data}=q?await db.rpc("search_public_ecosystem",{p_query:q,p_limit:20}):{data:null};
  const groups=(data??{})as unknown as Record<string,Hit[]>;
  return <main className="public-page space-y-6"><div><p className="page-kicker">Directory</p><h1 className="page-title mt-2 font-bold">Search Purple Bean Gaming</h1><p className="muted mt-2">Find public players, organizations, tournaments and seasons.</p></div><form className="flex gap-2"><input aria-label="Search players, organizations, tournaments, and seasons" className="min-w-0 flex-1" defaultValue={q} name="q"/><button className="button button-primary">Search</button></form>{q?<div className="grid gap-4 md:grid-cols-2">{Object.entries(groups).map(([kind,hits])=><Card key={kind}><h2 className="text-xl font-bold capitalize">{kind}</h2><div className="mt-3 space-y-2">{hits.map(h=><Link className="block border-t border-[var(--line)] pt-3 hover:text-[var(--accent)]" href={h.kind==="player"?`/players/${h.slug}`:h.kind==="organization"?`/organizations/${h.slug}`:h.kind==="season"?`/seasons/${h.slug}`:`/tournaments/${h.slug}/status`} key={`${h.kind}-${h.slug}`}>{h.name}</Link>)}{!hits.length?<p className="muted">No results</p>:null}</div></Card>)}</div>:<p className="muted">Search uses public names and slugs only.</p>}</main>;
}
