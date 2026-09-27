import type { DotaHero, DotaMatch, DotaProfile, DotaProvider, ProviderName } from "./types";
import { ProviderError } from "./errors";

export type CacheStatus="hit"|"miss"|"refresh"|"stale";
export type CircuitState="closed"|"open"|"half_open";
export interface CacheEntry<T>{value:T;expiresAt:number;fetchedAt:number;}
export interface ProviderState{state:CircuitState;failures:number;openUntil:number;}
export interface ResilienceStore{
 get<T>(provider:ProviderName,key:string):Promise<CacheEntry<T>|null>;
 put<T>(provider:ProviderName,key:string,entry:CacheEntry<T>):Promise<void>;
 getState(provider:ProviderName):Promise<ProviderState>;
 setState(provider:ProviderName,state:ProviderState,event:"failure"|"rate_limited"|"recovered"|"success"):Promise<void>;
 count(provider:ProviderName,window:"minute"|"hour"|"day"):Promise<number>;
 record(provider:ProviderName,operation:string,outcome:string,durationMs:number):Promise<void>;
}
export interface ResiliencePolicy{failureThreshold:number;cooldownMs:number;budgets:{minute:number;hour:number;day:number};now:()=>number;}
const defaultPolicy:ResiliencePolicy={failureThreshold:3,cooldownMs:30_000,budgets:{minute:45,hour:1500,day:2500},now:Date.now};
const flights=new Map<string,Promise<unknown>>();
export class ResilientDotaProvider implements DotaProvider{
 readonly name:ProviderName;lastCacheStatus:CacheStatus="miss";
 constructor(private upstream:DotaProvider,private store:ResilienceStore,private policy:ResiliencePolicy=defaultPolicy){this.name=upstream.name;}
 getPlayerProfile(id:string,signal?:AbortSignal){return this.cached<DotaProfile>(`player:${id}`,6*3600_000,true,()=>this.upstream.getPlayerProfile(id,signal));}
 getPlayerRecentMatches(id:string,signal?:AbortSignal){return this.cached<DotaMatch[]>(`recent:${id}`,5*60_000,true,()=>this.upstream.getPlayerRecentMatches(id,signal));}
 async getMatch(id:string,signal?:AbortSignal){const value=await this.cached<DotaMatch>(`match:${id}`,2*60_000,false,()=>this.upstream.getMatch(id,signal));if(value.parseState==="parsed")await this.store.put(this.name,`match:${id}`,{value,fetchedAt:this.policy.now(),expiresAt:this.policy.now()+7*86400_000});return value;}
 getHeroes(signal?:AbortSignal){return this.cached<DotaHero[]>("heroes",24*3600_000,true,()=>this.upstream.getHeroes(signal));}
 async healthCheck(signal?:AbortSignal){try{await this.call("health",()=>this.upstream.healthCheck(signal));return true;}catch{return false;}}
 private async cached<T>(key:string,ttl:number,allowStale:boolean,load:()=>Promise<T>):Promise<T>{const now=this.policy.now(),entry=await this.store.get<T>(this.name,key);if(entry&&entry.expiresAt>now){this.lastCacheStatus="hit";await this.store.record(this.name,key,"cache_hit",0);return entry.value;}const flightKey=`${this.name}:${key}`;const existing=flights.get(flightKey) as Promise<T>|undefined;if(existing)return existing;const run=(async()=>{try{const started=this.policy.now(),value=await this.call(key,load);await this.store.put(this.name,key,{value,fetchedAt:now,expiresAt:now+ttl});this.lastCacheStatus=entry?"refresh":"miss";await this.store.record(this.name,key,"success",this.policy.now()-started);return value;}catch(error){if(allowStale&&entry){this.lastCacheStatus="stale";return entry.value;}throw error;}})();flights.set(flightKey,run);try{return await run;}finally{flights.delete(flightKey);}}
 private async call<T>(operation:string,load:()=>Promise<T>):Promise<T>{const now=this.policy.now(),state=await this.store.getState(this.name);if(state.state==="open"&&state.openUntil>now){await this.store.record(this.name,operation,"circuit_open",0);throw new ProviderError("PROVIDER_UNAVAILABLE",true,state.openUntil-now);}if(state.state==="open")await this.store.setState(this.name,{...state,state:"half_open"},"failure");for(const window of ["minute","hour","day"] as const)if(await this.store.count(this.name,window)>=this.policy.budgets[window]){await this.store.record(this.name,operation,"rate_limited",0);throw new ProviderError("PROVIDER_RATE_LIMITED",true,60_000);}try{const result=await load();await this.store.setState(this.name,{state:"closed",failures:0,openUntil:0},state.state==="closed"?"success":"recovered");return result;}catch(error){const providerError=error instanceof ProviderError?error:new ProviderError("PROVIDER_UNAVAILABLE",true);await this.store.record(this.name,operation,providerError.code==="PROVIDER_RATE_LIMITED"?"rate_limited":"server_error",0);if(providerError.code==="PROVIDER_RATE_LIMITED"){await this.store.setState(this.name,state,"rate_limited");throw providerError;}const failures=state.failures+1,open=failures>=this.policy.failureThreshold;await this.store.setState(this.name,{state:open?"open":"closed",failures,openUntil:open?now+this.policy.cooldownMs:0},"failure");throw providerError;}}
}
