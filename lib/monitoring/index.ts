export type MonitoringLevel = "info" | "warning" | "error";
export type MonitoringEvent = { level: MonitoringLevel; message: string; errorClass?: string; requestId?: string; tags?: Record<string,string>; context?: Record<string,unknown> };
export interface MonitoringAdapter { capture(event: MonitoringEvent): void | Promise<void>; }

const sensitive=/password|token|secret|cookie|authorization|api[_-]?key|service[_-]?role|database[_-]?url|evidence|internal[_-]?note|raw[_-]?payload/i;
export function redact(value: unknown, depth=0): unknown {
  if (depth>5) return "[MAX_DEPTH]";
  if (Array.isArray(value)) return value.slice(0,50).map((item)=>redact(item,depth+1));
  if (value&&typeof value==="object") return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([key,item])=>[key,sensitive.test(key)?"[REDACTED]":redact(item,depth+1)]));
  if (typeof value==="string") return value.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi,"Bearer [REDACTED]").slice(0,1000);
  return value;
}
class ConsoleAdapter implements MonitoringAdapter { capture(event:MonitoringEvent){const safe=redact({...event,timestamp:new Date().toISOString(),environment:process.env.MONITORING_ENVIRONMENT??process.env.VERCEL_ENV??process.env.NODE_ENV,release:process.env.MONITORING_RELEASE}) as Record<string,unknown>;(event.level==="error"?console.error:console.log)(JSON.stringify(safe));} }
let adapter:MonitoringAdapter=new ConsoleAdapter();
export function setMonitoringAdapter(next:MonitoringAdapter){adapter=next;}
export function resetMonitoringAdapter(){adapter=new ConsoleAdapter();}
export function captureMessage(message:string,context:Omit<MonitoringEvent,"message">={level:"info"}){return adapter.capture({...context,message,context:redact(context.context) as Record<string,unknown>});}
export function captureException(error:unknown,context:Omit<MonitoringEvent,"message"|"errorClass">={level:"error"}){const item=error instanceof Error?error:new Error("UNKNOWN_ERROR");return adapter.capture({...context,level:"error",message:item.message,errorClass:item.name,context:redact(context.context) as Record<string,unknown>});}
export function captureJobFailure(jobType:string,error:unknown,context:Record<string,unknown>={}){return captureException(error,{level:"error",tags:{kind:"job",jobType},context});}
export function isExpectedDomainError(error:unknown){return error instanceof Error&&/^(RATE_LIMITED|UNAUTHORIZED|INVALID_|MATCH_|PLAYER_|AUCTION_|NOT_FOUND)/.test(error.message);}
