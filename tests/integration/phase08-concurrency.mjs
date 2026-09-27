import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SECRET_KEY: secret } = process.env;
assert(url && anon && secret);
const root = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
async function session(email) { const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } }); const { error } = await client.auth.signInWithPassword({ email, password: "development-only" }); assert.ifError(error); return client; }
const admin = await session("player1@draftgg.test"), moderator = await session("player2@draftgg.test"), subject = await session("player5@draftgg.test");
const reportId = crypto.randomUUID(), caseId = crypto.randomUUID();
assert.ifError((await root.from("reports").insert({ id: reportId, reporter_user_id: "00000000-0000-4000-8000-000000000006", reported_user_id: "00000000-0000-4000-8000-000000000005", report_type: "other", reason: "Concurrency fixture", description: "Concurrency fixture report description" })).error);
assert.ifError((await root.from("moderation_cases").insert({ id: caseId, report_id: reportId, subject_user_id: "00000000-0000-4000-8000-000000000005", case_type: "conduct", summary: "Concurrent resolution fixture" })).error);
const resolutions = await Promise.all(Array.from({ length: 20 }, (_, i) => moderator.rpc("resolve_moderation_case", { p_id: caseId, p_resolution: `resolution-${i}`, p_revision: 0 })));
resolutions.forEach(x => assert.ifError(x.error)); assert.equal(resolutions.filter(x => x.data === true).length, 1);
const sanctionCalls = await Promise.all(Array.from({ length: 20 }, () => admin.rpc("issue_sanction", { p_user: "00000000-0000-4000-8000-000000000005", p_case: caseId, p_tournament: null, p_scope: "platform", p_type: "warning", p_reason: "Concurrent warning", p_expires: null })));
assert.equal(sanctionCalls.filter(x => !x.error).length, 1); assert.equal((await root.from("sanctions").select("id", { count: "exact", head: true }).eq("user_id", "00000000-0000-4000-8000-000000000005").eq("sanction_type", "warning").eq("active", true)).count, 1);
const sanction = sanctionCalls.find(x => !x.error)?.data; assert(sanction);
const appeal = await subject.rpc("submit_moderation_appeal", { p_sanction: sanction, p_reason: "Please independently review this warning" }); assert.ifError(appeal.error);
const appealResolutions = await Promise.all(Array.from({ length: 20 }, (_, i) => moderator.rpc("resolve_moderation_appeal", { p_id: appeal.data, p_approve: false, p_resolution: `review-${i}` })));
appealResolutions.forEach(x => assert.ifError(x.error)); assert.equal(appealResolutions.filter(x => x.data === true).length, 1);
console.log(JSON.stringify({ result: "PASS", caseWorkers: 20, canonicalCaseResolutions: 1, sanctionWorkers: 20, activeEquivalentSanctions: 1, appealWorkers: 20, canonicalAppealResolutions: 1 }));
