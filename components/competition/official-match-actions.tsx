"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function OfficialMatchActions({matchId,disputeId,teamAId,teamBId}:{matchId:string;disputeId?:string;teamAId?:string;teamBId?:string}){
  const[reason,setReason]=useState("Competition official decision"),[a,setA]=useState(2),[b,setB]=useState(0),[message,setMessage]=useState(""),router=useRouter();
  async function resolve(action:"change"|"rematch"){
    if(!disputeId)return;
    const{data,error}=await createClient().rpc("resolve_match_dispute",{p_dispute_id:disputeId,p_action:action,p_team_a_score:a,p_team_b_score:b,p_reason:reason,p_request_id:crypto.randomUUID()});
    const replacement=data&&typeof data==="object"&&!Array.isArray(data)?data.replacement_match_id:undefined;
    setMessage(error?.message??(action==="rematch"?`Rematch created: ${String(replacement??"")}`:"Dispute resolved"));router.refresh();
  }
  async function forfeit(teamId?:string){if(!teamId)return;const{error}=await createClient().rpc("award_match_forfeit",{p_match_id:matchId,p_forfeit_team_id:teamId,p_reason:reason,p_request_id:crypto.randomUUID()});setMessage(error?.message??"Forfeit awarded");router.refresh()}
  async function reschedule(){const{error}=await createClient().rpc("reschedule_match",{p_match_id:matchId,p_scheduled_at:new Date(Date.now()+3600000).toISOString(),p_reason:reason});setMessage(error?.message??"Match rescheduled");router.refresh()}
  return <div className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
    <label className="block text-sm">Official reason<input aria-label={`Reason ${matchId}`} className="mt-1 block w-full rounded bg-[#081016] p-2" value={reason} onChange={e=>setReason(e.target.value)}/></label>
    {disputeId?<div className="flex flex-wrap items-end gap-2"><label>Team A score<input aria-label={`Team A score ${matchId}`} className="block w-20 rounded bg-[#081016] p-2" type="number" value={a} onChange={e=>setA(Number(e.target.value))}/></label><label>Team B score<input aria-label={`Team B score ${matchId}`} className="block w-20 rounded bg-[#081016] p-2" type="number" value={b} onChange={e=>setB(Number(e.target.value))}/></label><button className="rounded border px-3 py-2" onClick={()=>resolve("change")}>Resolve corrected result</button><button className="rounded border px-3 py-2" onClick={()=>resolve("rematch")}>Order rematch</button></div>:null}
    <div className="flex flex-wrap gap-2"><button className="rounded border px-3 py-2" onClick={()=>forfeit(teamAId)}>Forfeit team A</button><button className="rounded border px-3 py-2" onClick={()=>forfeit(teamBId)}>Forfeit team B</button><button className="rounded border px-3 py-2" onClick={reschedule}>Reschedule +1 hour</button></div>
    <p role="status" className="text-sm text-[var(--muted)]">{message}</p>
  </div>
}
