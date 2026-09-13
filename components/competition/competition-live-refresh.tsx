"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function CompetitionLiveRefresh({tournamentId,privateAccess=false}:{tournamentId:string;privateAccess?:boolean}){
  const router=useRouter();
  useEffect(()=>{const client=createClient(),refresh=()=>router.refresh(),poll=window.setInterval(refresh,5_000);let channel:RealtimeChannel|undefined,cancelled=false;void(async()=>{const{data:{session}}=await client.auth.getSession();if(session)await client.realtime.setAuth(session.access_token);if(cancelled)return;channel=client.channel(`tournament:${tournamentId}`).on("broadcast",{event:"match_update"},refresh);if(privateAccess)channel=channel.on("postgres_changes",{event:"*",schema:"public",table:"match_check_ins"},refresh).on("postgres_changes",{event:"*",schema:"public",table:"match_lineups"},refresh).on("postgres_changes",{event:"*",schema:"public",table:"match_result_submissions"},refresh).on("postgres_changes",{event:"*",schema:"public",table:"match_disputes"},refresh);channel.subscribe()})();return()=>{cancelled=true;window.clearInterval(poll);if(channel)void client.removeChannel(channel)}},[privateAccess,router,tournamentId]);
  return <span className="sr-only" aria-live="polite">Live competition updates enabled</span>;
}
