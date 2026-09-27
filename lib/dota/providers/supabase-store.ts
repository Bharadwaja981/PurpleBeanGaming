import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { ProviderName } from "./types";
import type { CacheEntry, ProviderState, ResilienceStore } from "./resilience";
export class SupabaseResilienceStore implements ResilienceStore {
  constructor(private db: SupabaseClient<Database>) {}
  async get<T>(provider:ProviderName,key:string){const{data}=await this.db.from("external_provider_cache").select("payload,fetched_at,expires_at").eq("provider",provider).eq("cache_key",key).maybeSingle();return data?{value:data.payload as T,fetchedAt:Date.parse(data.fetched_at),expiresAt:Date.parse(data.expires_at)}:null;}
  async put<T>(provider:ProviderName,key:string,e:CacheEntry<T>){await this.db.from("external_provider_cache").upsert({provider,cache_key:key,payload:e.value as Json,fetched_at:new Date(e.fetchedAt).toISOString(),expires_at:new Date(e.expiresAt).toISOString()});}
  async getState(provider:ProviderName){const{data}=await this.db.from("external_provider_health").select("circuit_state,consecutive_failures,circuit_open_until").eq("provider",provider).maybeSingle();if(!data)return{state:"closed" as const,failures:0,openUntil:0};return{state:data.circuit_state as ProviderState["state"],failures:data.consecutive_failures,openUntil:data.circuit_open_until?Date.parse(data.circuit_open_until):0};}
  async setState(provider:ProviderName,state:ProviderState,event:"failure"|"rate_limited"|"recovered"|"success"){await this.db.rpc("record_provider_state",{p_provider:provider,p_state:state.state,p_failures:state.failures,p_open_until:new Date(state.openUntil||0).toISOString(),p_event:event});}
  async count(provider:ProviderName,window:"minute"|"hour"|"day"){const since=new Date(Date.now()-{minute:60000,hour:3600000,day:86400000}[window]).toISOString();const{count}=await this.db.from("external_provider_requests").select("id",{count:"exact",head:true}).eq("provider",provider).neq("outcome","cache_hit").gte("created_at",since);return count??0;}
  async record(provider:ProviderName,operation:string,outcome:string,durationMs:number){await this.db.from("external_provider_requests").insert({provider,operation,outcome,duration_ms:durationMs});}
}
