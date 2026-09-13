"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit, requestIdentity } from "@/lib/rate-limit";

async function context(policy:"externalMatchLink"|"externalMatchRelink"){
  const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
  await enforceRateLimit(policy,await requestIdentity(user?.id));
  return supabase;
}
export async function linkDotaMatch(data:FormData){const supabase=await context("externalMatchLink"),gameId=String(data.get("gameId")??""),raw=String(data.get("dotaMatchId")??"").trim();if(!/^[1-9][0-9]{0,18}$/.test(raw))throw new Error("INVALID_MATCH_ID");const{error}=await supabase.rpc("link_external_dota_match",{p_match_game_id:gameId,p_dota_match_id:Number(raw)});if(error)throw new Error(error.message);revalidatePath(`/tournaments/${String(data.get("slug")??"")}/matches/${String(data.get("matchId")??"")}`);}
export async function relinkDotaMatch(data:FormData){const supabase=await context("externalMatchRelink"),raw=String(data.get("dotaMatchId")??"").trim(),reason=String(data.get("reason")??"").trim();if(!/^[1-9][0-9]{0,18}$/.test(raw)||reason.length<8)throw new Error("INVALID_RELINK");const{error}=await supabase.rpc("relink_external_dota_match",{p_link_id:String(data.get("linkId")??""),p_new_match_id:Number(raw),p_reason:reason});if(error)throw new Error(error.message);revalidatePath(`/tournaments/${String(data.get("slug")??"")}/matches/${String(data.get("matchId")??"")}`);}
