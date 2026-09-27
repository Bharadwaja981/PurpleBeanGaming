import {ProviderError,classifyStatus} from "./errors";import type{RequestPolicy}from"./types";
const defaults={timeoutMs:8000,maxRetries:3,baseDelayMs:250,maxDelayMs:5000};
export async function providerJson<T>(url:URL,init:RequestInit,policy:RequestPolicy={},entity:"player"|"match"="match"):Promise<T>{
 const p={...defaults,...policy};let last:unknown;
 for(let attempt=0;attempt<=p.maxRetries;attempt++){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),p.timeoutMs);const forward=()=>controller.abort();init.signal?.addEventListener("abort",forward,{once:true});
  try{const response=await fetch(url,{...init,signal:controller.signal});if(response.ok)return await response.json() as T;throw classifyStatus(response.status,response.headers.get("retry-after"),entity);}
  catch(error){last=error;const classified=error instanceof ProviderError?error:new ProviderError("PROVIDER_UNAVAILABLE",true);if(!classified.retryable||attempt===p.maxRetries||init.signal?.aborted)throw classified;const jitter=0.5+(p.random?.()??Math.random());const delay=Math.min(p.maxDelayMs,classified.retryAfterMs??p.baseDelayMs*2**attempt)*jitter;await(p.sleep??sleep)(delay,init.signal??undefined);}
  finally{clearTimeout(timer);init.signal?.removeEventListener("abort",forward);}
 }
 throw last;
}
function sleep(ms:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal?.addEventListener("abort",()=>{clearTimeout(timer);reject(new ProviderError("PROVIDER_UNAVAILABLE"));},{once:true});});}
