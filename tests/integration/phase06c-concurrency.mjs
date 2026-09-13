import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const {SUPABASE_URL:url,SUPABASE_ANON_KEY:anon,SUPABASE_SECRET_KEY:secret}=process.env;
assert(url&&anon&&secret);
const options={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(url,secret,options);
async function login(number){const client=createClient(url,anon,options),result=await client.auth.signInWithPassword({email:`player${number}@draftgg.test`,password:"development-only"});assert.ifError(result.error);return client}
const organizer=await login(1),tid="10000000-0000-4000-8000-000000000001";
assert.ifError((await organizer.rpc("configure_competition",{p_tournament_id:tid,p_format:"single_elimination"})).error);
assert.ifError((await organizer.rpc("generate_competition_schedule",{p_tournament_id:tid,p_scheduled_start:new Date().toISOString(),p_interval_minutes:60})).error);
const first=await admin.from("matches").select("id,team_a_id,team_b_id,next_match_id,next_match_slot").eq("tournament_id",tid).eq("round_number",1).not("next_match_id","is",null).limit(1).single();assert.ifError(first.error);
const original=first.data;
const teams=await admin.from("teams").select("id,captain_user_id").in("id",[original.team_a_id,original.team_b_id]);assert.ifError(teams.error);
const numberFor=id=>Number(teams.data.find(team=>team.id===id).captain_user_id.slice(-12));
const teamA=await login(numberFor(original.team_a_id)),teamB=await login(numberFor(original.team_b_id));
const outcomes={rematchRaces:0,duplicateResolution:0,bracketRaces:0,duplicateRematches:0,duplicateBracketSlots:0};

async function clearMatchArtifacts(matchId){for(const table of["competition_action_requests","match_snapshots","match_disputes","match_result_submissions"]){const column=table==="competition_action_requests"?"match_id":"match_id";assert.ifError((await admin.from(table).delete().eq(column,matchId)).error)}}

for(let index=0;index<20;index++){
  await clearMatchArtifacts(original.id);
  assert.ifError((await admin.from("matches").update({status:"disputed",superseded_by_match_id:null,next_match_id:original.next_match_id,next_match_slot:original.next_match_slot,team_a_score:null,team_b_score:null,winner_team_id:null,loser_team_id:null,completed_at:null}).eq("id",original.id)).error);
  const submissionId=crypto.randomUUID(),disputeId=crypto.randomUUID();
  assert.ifError((await admin.from("match_result_submissions").insert({id:submissionId,match_id:original.id,submitting_team_id:original.team_a_id,submitted_by:teams.data.find(team=>team.id===original.team_a_id).captain_user_id,team_a_score:2,team_b_score:0,winner_team_id:original.team_a_id,request_id:crypto.randomUUID(),status:"disputed"})).error);
  assert.ifError((await admin.from("match_disputes").insert({id:disputeId,match_id:original.id,submission_id:submissionId,opened_by:teams.data.find(team=>team.id===original.team_b_id).captain_user_id,opening_team_id:original.team_b_id,reason:"Concurrent rematch fixture",request_id:crypto.randomUUID()})).error);
  const requestA=crypto.randomUUID(),requestB=crypto.randomUUID();
  const[r1,r2]=await Promise.all([organizer.rpc("resolve_match_dispute",{p_dispute_id:disputeId,p_action:"rematch",p_team_a_score:null,p_team_b_score:null,p_reason:"Replay required",p_request_id:requestA}),organizer.rpc("resolve_match_dispute",{p_dispute_id:disputeId,p_action:"rematch",p_team_a_score:null,p_team_b_score:null,p_reason:"Replay required",p_request_id:requestB})]);
  assert.ifError(r1.error);assert.ifError(r2.error);
  const replacements=await admin.from("matches").select("id").eq("rematch_of_match_id",original.id);assert.ifError(replacements.error);
  if(replacements.data.length!==1)outcomes.duplicateRematches++;
  assert.equal(replacements.data.length,1);assert([r1.data.code,r2.data.code].includes("DUPLICATE_REQUEST"));
  outcomes.rematchRaces++;outcomes.duplicateResolution++;
  assert.ifError((await admin.from("matches").update({superseded_by_match_id:null,status:"scheduled"}).eq("id",original.id)).error);
  assert.ifError((await admin.from("matches").delete().eq("id",replacements.data[0].id)).error);
}

for(let index=0;index<20;index++){
  await clearMatchArtifacts(original.id);
  const downstreamColumn=original.next_match_slot===1?"team_a_id":"team_b_id";
  assert.ifError((await admin.from("matches").update({[downstreamColumn]:null}).eq("id",original.next_match_id)).error);
  assert.ifError((await admin.from("matches").update({status:"live",team_a_score:null,team_b_score:null,winner_team_id:null,loser_team_id:null,completed_at:null,next_match_id:original.next_match_id,next_match_slot:original.next_match_slot}).eq("id",original.id)).error);
  const[a,b]=await Promise.all([teamA.rpc("submit_match_result",{p_match_id:original.id,p_team_a_score:2,p_team_b_score:0,p_evidence_path:"",p_notes:"",p_request_id:crypto.randomUUID()}),teamB.rpc("submit_match_result",{p_match_id:original.id,p_team_a_score:0,p_team_b_score:2,p_evidence_path:"",p_notes:"",p_request_id:crypto.randomUUID()})]);
  assert.ifError(a.error);assert.ifError(b.error);
  const downstream=await admin.from("matches").select("team_a_id,team_b_id").eq("id",original.next_match_id).single();assert.ifError(downstream.error);
  const slots=[downstream.data.team_a_id,downstream.data.team_b_id].filter(id=>id===original.team_a_id).length;
  if(slots!==1)outcomes.duplicateBracketSlots++;
  assert.equal(slots,1);outcomes.bracketRaces++;
}
assert.equal(outcomes.duplicateRematches,0);assert.equal(outcomes.duplicateBracketSlots,0);
console.log(JSON.stringify({result:"PASS",iterations:{rematchCreation:20,duplicateResolution:20,bracketProgression:20},outcomes}));
