"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import type {Database} from "@/types/database";
import {enforceRateLimit,requestIdentity} from "@/lib/rate-limit";

type Confidence=Database["public"]["Enums"]["rating_confidence_level"];
const text=(data:FormData,key:string)=>String(data.get(key)??"");
const number=(data:FormData,key:string)=>Number(data.get(key));
async function limitedClient(){const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();await enforceRateLimit("adminMutation",await requestIdentity(user?.id));return supabase;}

export async function reviewPlayer(data:FormData){
  const supabase=await limitedClient();
  const {error}=await supabase.rpc("review_player",{p_player_id:text(data,"playerId"),p_verified_mmr:number(data,"verified"),p_recent_peak_mmr:number(data,"peak"),p_tournament_mmr:number(data,"tournamentMmr"),p_confidence:text(data,"confidence") as Confidence,p_decision:text(data,"decision")});
  if(error)throw new Error(error.message);
  revalidatePath(`/admin/${text(data,"slug")}`);
}

export async function assignCaptain(data:FormData){
  const supabase=await limitedClient();
  const {error}=await supabase.rpc("assign_captain",{p_tournament_id:text(data,"tournamentId"),p_user_id:text(data,"userId")});
  if(error)throw new Error(error.message);
  revalidatePath(`/admin/${text(data,"slug")}`);
}

export async function createTeam(data:FormData){
  const supabase=await limitedClient();
  const tournamentId=text(data,"tournamentId");
  let logo="";
  const file=data.get("logo");
  if(file instanceof File&&file.size){
    if(file.size>5*1024*1024)throw new Error("Logo must be at most 5 MB");
    const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");
    const path=`${tournamentId}/${crypto.randomUUID()}-${safe}`;
    const {error:uploadError}=await supabase.storage.from("team-assets").upload(path,file);
    if(uploadError)throw new Error(uploadError.message);
    logo=supabase.storage.from("team-assets").getPublicUrl(path).data.publicUrl;
  }
  const {error}=await supabase.rpc("create_team",{p_tournament_id:tournamentId,p_name:text(data,"name"),p_tag:text(data,"tag"),p_accent:text(data,"accent"),p_logo:logo,p_captain:text(data,"captain")});
  if(error)throw new Error(error.message);
  revalidatePath(`/admin/${text(data,"slug")}`);
}

export async function lockPool(data:FormData){
  const supabase=await limitedClient();
  const {error}=await supabase.rpc("lock_player_pool",{p_tournament_id:text(data,"tournamentId")});
  if(error)throw new Error(error.message);
  revalidatePath(`/admin/${text(data,"slug")}`);
}

export async function resolveAppeal(data:FormData){
  const supabase=await limitedClient();
  const {error}=await supabase.rpc("resolve_appeal",{p_appeal_id:text(data,"appealId"),p_approve:text(data,"decision")==="approve",p_resolution:text(data,"resolution")});
  if(error)throw new Error(error.message);
  revalidatePath(`/admin/${text(data,"slug")}`);
}
