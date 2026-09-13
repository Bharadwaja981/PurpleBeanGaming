"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import type {Database} from "@/types/database";

type Assessment=Database["public"]["Enums"]["rating_assessment"];
const value=(data:FormData,key:string)=>String(data.get(key)??"");

export async function submitRatingReview(data:FormData){
  const supabase=await createClient();
  const {error}=await supabase.rpc("submit_rating_review",{p_player_id:value(data,"playerId"),p_assessment:value(data,"assessment") as Assessment});
  if(error)throw new Error(error.message);
  revalidatePath(`/tournaments/${value(data,"slug")}/players`);
}

export async function confirmCaptain(data:FormData){
  const supabase=await createClient();
  const {error}=await supabase.rpc("confirm_captain",{p_team_id:value(data,"teamId"),p_confirm:value(data,"decision")==="confirm"});
  if(error)throw new Error(error.message);
  revalidatePath(`/tournaments/${value(data,"slug")}/captains`);
}
