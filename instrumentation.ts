import type { Instrumentation } from "next";

export async function register(){if(process.env.NEXT_RUNTIME==="nodejs"){const{captureMessage}=await import("./lib/monitoring");await captureMessage("monitoring_initialized",{level:"info",tags:{runtime:"nodejs"}});}}

export const onRequestError: Instrumentation.onRequestError = async (error,request,context) => {
  const { captureException, isExpectedDomainError } = await import("./lib/monitoring");
  if (isExpectedDomainError(error)) return;
  const requestId=Array.isArray(request.headers["x-request-id"])?request.headers["x-request-id"][0]:request.headers["x-request-id"];
  await captureException(error,{level:"error",requestId,tags:{routeType:context.routeType,routerKind:context.routerKind},context:{method:request.method,routePath:context.routePath,renderSource:context.renderSource}});
};
