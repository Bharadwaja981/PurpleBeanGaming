"use client";
import { useEffect } from "react";
import { captureClientException } from "@/lib/monitoring/client";
export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){useEffect(()=>{void captureClientException(error);},[error]);return <html lang="en"><body><main className="auth-page"><section className="card max-w-xl p-8 text-center"><p className="page-kicker">Purple Bean Gaming</p><h1 className="mt-3 text-4xl font-bold">Something interrupted the match</h1><p className="muted mt-4">Your data was not intentionally changed. Retry, then contact support if the problem continues.</p><button className="button button-primary mt-8" onClick={reset}>Try again</button></section></main></body></html>;}
