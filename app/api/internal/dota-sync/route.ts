import{timingSafeEqual}from"node:crypto";import{processOneDotaJob}from"@/lib/dota/jobs";
async function run(request:Request,expected:string){const provided=request.headers.get("authorization")?.replace(/^Bearer /,"")??"";if(!expected||expected.length!==provided.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))return Response.json({error:"UNAUTHORIZED"},{status:401});return Response.json(await processOneDotaJob(),{headers:{"Cache-Control":"no-store"}});}
export async function POST(request:Request){return run(request,process.env.DOTA_SYNC_SECRET??"");}
export async function GET(request:Request){return run(request,process.env.CRON_SECRET??"");}
