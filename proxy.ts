import {createServerClient} from "@supabase/ssr";
import {NextResponse,type NextRequest} from "next/server";

export async function proxy(request:NextRequest){
  const requestId=request.headers.get("x-request-id")??crypto.randomUUID();
  const forwardedHeaders=new Headers(request.headers);forwardedHeaders.set("x-request-id",requestId);
  let response=NextResponse.next({request:{headers:forwardedHeaders}});response.headers.set("x-request-id",requestId);
  const supabase=createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {cookies:{
      getAll:()=>request.cookies.getAll(),
      setAll:items=>{
        items.forEach(({name,value})=>request.cookies.set(name,value));
        response=NextResponse.next({request:{headers:forwardedHeaders}});response.headers.set("x-request-id",requestId);
        items.forEach(({name,value,options})=>response.cookies.set(name,value,options));
      },
    }},
  );
  const {data:{user}}=await supabase.auth.getUser();
  if(!user&&(request.nextUrl.pathname.startsWith("/dashboard")||request.nextUrl.pathname.startsWith("/admin"))){
    return NextResponse.redirect(new URL("/sign-in",request.url));
  }
  return response;
}

export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
