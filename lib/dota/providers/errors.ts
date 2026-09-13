export type ProviderErrorCode="PROVIDER_UNAVAILABLE"|"PROVIDER_RATE_LIMITED"|"PLAYER_NOT_FOUND"|"MATCH_NOT_FOUND"|"PROFILE_PRIVATE"|"MATCH_NOT_PARSED"|"INVALID_DOTA_ACCOUNT"|"INVALID_MATCH_ID";
export class ProviderError extends Error { constructor(public readonly code:ProviderErrorCode,public readonly retryable=false,public readonly retryAfterMs?:number){super(code);this.name="ProviderError";} }
export function classifyStatus(status:number,retryAfter:string|null,entity:"player"|"match"="match"){
  if(status===404)return new ProviderError(entity==="player"?"PLAYER_NOT_FOUND":"MATCH_NOT_FOUND");
  if(status===429)return new ProviderError("PROVIDER_RATE_LIMITED",true,parseRetryAfter(retryAfter));
  if(status>=500)return new ProviderError("PROVIDER_UNAVAILABLE",true);
  return new ProviderError("PROVIDER_UNAVAILABLE",false);
}
export function parseRetryAfter(value:string|null,now=Date.now()){if(!value)return undefined;const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>=0)return seconds*1000;const date=Date.parse(value);return Number.isFinite(date)?Math.max(0,date-now):undefined;}
