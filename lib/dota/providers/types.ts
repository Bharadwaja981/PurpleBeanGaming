export type ProviderName = "opendota" | "steam";
export type ParseState = "unknown" | "unparsed" | "requested" | "parsing" | "parsed" | "unavailable";
export interface DotaProfile { provider: ProviderName; accountId: string; steamId64?: string; personaName: string | null; avatarUrl: string | null; profileVisibility: "public"|"private"|"unknown"; rankTier: number|null; leaderboardRank: number|null; }
export interface DotaMatchPlayer { slot:number; accountId:string|null; heroId:number|null; isRadiant:boolean; kills:number|null; deaths:number|null; assists:number|null; gpm:number|null; xpm:number|null; }
export interface DotaMatch { provider:ProviderName;matchId:string;radiantWin:boolean|null;startTime:string|null;durationSeconds:number|null;gameMode:number|null;lobbyType:number|null;patch:number|null;parseState:ParseState;replayUrl:string|null;players:DotaMatchPlayer[]; }
export interface DotaHero { heroId:number;internalName:string;localizedName:string;primaryAttribute:string|null; }
export interface DotaProvider { readonly name:ProviderName;getPlayerProfile(accountId:string,signal?:AbortSignal):Promise<DotaProfile>;getPlayerRecentMatches(accountId:string,signal?:AbortSignal):Promise<DotaMatch[]>;getMatch(matchId:string,signal?:AbortSignal):Promise<DotaMatch>;getHeroes(signal?:AbortSignal):Promise<DotaHero[]>;healthCheck(signal?:AbortSignal):Promise<boolean>; }
export interface RequestPolicy { timeoutMs?:number;maxRetries?:number;baseDelayMs?:number;maxDelayMs?:number;random?:()=>number;sleep?:(ms:number,signal?:AbortSignal)=>Promise<void>; }
