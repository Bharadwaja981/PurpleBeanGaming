import { createClient } from "@supabase/supabase-js";
import { target } from "./common.mjs";

target();
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;
const subscribers=Number(process.env.SUBSCRIBERS??100),channelName=process.env.REALTIME_CHANNEL??"phase10c-load";
if(!url||!key)throw new Error("SUPABASE_CONFIGURATION_REQUIRED");
const options={auth:{persistSession:false}},clients=Array.from({length:subscribers},()=>createClient(url,key,options));
const received=Array(subscribers).fill(0),channels=[];
await Promise.all(clients.map((client,i)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error("SUBSCRIBE_TIMEOUT")),15000);
  const channel=client.channel(channelName).on("broadcast",{event:"probe"},()=>received[i]++);
  channels[i]=channel;
  channel.subscribe(status=>{if(status==="SUBSCRIBED"){clearTimeout(timer);resolve();}if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")reject(new Error(`SUBSCRIBE_${status}`));});
})));
const publisher=createClient(url,key,options),publication=publisher.channel(channelName,{config:{broadcast:{self:true}}});
await new Promise((resolve,reject)=>publication.subscribe(status=>status==="SUBSCRIBED"?resolve():status==="CHANNEL_ERROR"?reject(new Error("PUBLISHER_ERROR")):undefined));
await publication.send({type:"broadcast",event:"probe",payload:{id:crypto.randomUUID()}});
await new Promise(resolve=>setTimeout(resolve,1500));
await clients[0].removeChannel(channels[0]);
let reconnected=false;
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("RECONNECT_TIMEOUT")),15000);const replacement=clients[0].channel(channelName);replacement.subscribe(status=>{if(status==="SUBSCRIBED"){clearTimeout(timer);reconnected=true;resolve();}if(status==="CHANNEL_ERROR")reject(new Error("RECONNECT_ERROR"));});});
const {data,error}=await clients[0].from("public_tournament_summary").select("id").limit(1);
if(error)throw error;
await Promise.all([...clients.map(client=>client.removeAllChannels()),publisher.removeAllChannels()]);
const deliveryErrors=received.filter(x=>x===0).length;
console.log(JSON.stringify({result:deliveryErrors===0&&reconnected?"PASS":"FAIL",subscribers,events:received.reduce((a,b)=>a+b,0),errors:deliveryErrors,reconnected,canonicalRefetch:Array.isArray(data)?"PASS":"FAIL"}));
if(deliveryErrors||!reconnected)process.exitCode=1;
