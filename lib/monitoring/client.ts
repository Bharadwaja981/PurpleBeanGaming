"use client";
export async function captureClientException(error:Error&{digest?:string}){try{await fetch("/api/internal/client-error",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:error.message.slice(0,300),errorClass:error.name,digest:error.digest})});}catch{/* monitoring must never break recovery UI */}}
