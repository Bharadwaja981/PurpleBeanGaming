"use server";
import{revalidatePath}from"next/cache";import{requireUser}from"@/lib/platform/auth";import{enforceRateLimit,requestIdentity}from"@/lib/rate-limit";
const value=(data:FormData,key:string)=>String(data.get(key)??"").trim();
async function context(){const result=await requireUser();await enforceRateLimit("dotaAccountRefresh",await requestIdentity(result.user.id));return result.supabase;}
export async function linkDotaAccount(data:FormData){const supabase=await context(),input=value(data,"dotaIdentity");if(input.length<1||input.length>80)throw new Error("INVALID_DOTA_ACCOUNT");const{data:id,error}=await supabase.rpc("link_dota_account",{p_input:input});if(error)throw new Error(error.message);await supabase.rpc("queue_external_sync",{p_account_id:id,p_job_type:"profile_sync"});revalidatePath("/settings");}
export async function refreshDotaProfile(data:FormData){const supabase=await context(),id=value(data,"accountId");const{error}=await supabase.rpc("queue_external_sync",{p_account_id:id,p_job_type:"profile_sync"});if(error)throw new Error(error.message);revalidatePath("/settings");}
