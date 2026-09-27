import assert from "node:assert/strict";
import {createClient} from "@supabase/supabase-js";

const {SUPABASE_URL:url,SUPABASE_ANON_KEY:key}=process.env;
assert(url&&key,"SUPABASE_URL and SUPABASE_ANON_KEY are required");
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const signIn=async(email)=>{const c=client();const {error}=await c.auth.signInWithPassword({email,password:"development-only"});assert.ifError(error);return c};
const organizer=await signIn("player1@draftgg.test");
const moderator=await signIn("player2@draftgg.test");
const owner=await signIn("player7@draftgg.test");
const outsider=await signIn("player8@draftgg.test");
const anonymous=client();
const tournament="10000000-0000-4000-8000-000000000001";
const ownerId="00000000-0000-4000-8000-000000000007";
assert.ifError((await organizer.from("tournaments").update({status:"registration"}).eq("id",tournament)).error);

const proofPath=`${tournament}/${ownerId}/storage-policy-proof.png`;
const proof=new Uint8Array([137,80,78,71,13,10,26,10]);
assert.ifError((await owner.storage.from("tournament-evidence").upload(proofPath,proof,{contentType:"image/png"})).error);
assert.ifError((await owner.storage.from("tournament-evidence").download(proofPath)).error);
assert.ifError((await organizer.storage.from("tournament-evidence").download(proofPath)).error);
assert((await outsider.storage.from("tournament-evidence").download(proofPath)).error,"other player read must be denied");
assert((await outsider.storage.from("tournament-evidence").update(proofPath,proof,{contentType:"image/png"})).error,"other player overwrite must be denied");
assert.ifError((await owner.storage.from("tournament-evidence").remove([proofPath])).error);

const logoPath=`${tournament}/storage-policy-logo.png`;
assert.ifError((await organizer.storage.from("team-assets").upload(logoPath,proof,{contentType:"image/png",upsert:true})).error);
assert.ifError((await anonymous.storage.from("team-assets").download(logoPath)).error);
assert((await outsider.storage.from("team-assets").update(logoPath,proof,{contentType:"image/png"})).error,"normal user overwrite must be denied");
await outsider.storage.from("team-assets").remove([logoPath]);
assert.ifError((await anonymous.storage.from("team-assets").download(logoPath)).error,"normal user delete must leave the logo intact");
assert.ifError((await organizer.storage.from("team-assets").remove([logoPath])).error);

const moderationPath=`${ownerId}/reports/storage-policy-evidence.png`;
assert.ifError((await owner.storage.from("moderation-evidence").upload(moderationPath,proof,{contentType:"image/png"})).error);
assert.ifError((await owner.storage.from("moderation-evidence").download(moderationPath)).error);
assert.ifError((await moderator.storage.from("moderation-evidence").download(moderationPath)).error);
assert((await outsider.storage.from("moderation-evidence").download(moderationPath)).error,"outsider moderation evidence read must be denied");
assert((await anonymous.storage.from("moderation-evidence").download(moderationPath)).error,"anonymous moderation evidence read must be denied");

console.log(JSON.stringify({evidenceUpload:"PASS",ownerRead:"PASS",organizerRead:"PASS",unauthorizedRead:"PASS",unauthorizedOverwrite:"PASS",ownerDelete:"PASS",teamLogoUpload:"PASS",publicLogoRead:"PASS",teamLogoProtection:"PASS",organizerDelete:"PASS",moderationEvidenceOwner:"PASS",moderationEvidenceModerator:"PASS",moderationEvidenceOutsiderDenied:"PASS",moderationEvidenceAnonymousDenied:"PASS"}));
