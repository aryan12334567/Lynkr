import { test } from "node:test";
import assert from "node:assert/strict";
import { draftProblem, generateOutreach, type ExtendedDraftInput, type Candidate } from "../lib/outreach/draft";
const input: ExtendedDraftInput = {goal:"network",relationship:"stranger",channel:"connection_note",name:"Asha",facts:[]};
const candidate = (body: string): Candidate => ({angle:"direct",body,factRefs:[],briefRefs:[]});
test("trace guard rejects unsupported numbers, names, quotes and placeholders", () => {
 assert.equal(draftProblem(input,candidate("Hi Asha, I improved sales by 12%. What do you think?")),"number");
 assert.equal(draftProblem(input,candidate("Hi Asha, I work at OpenAI. What do you think?")),"name");
 assert.equal(draftProblem(input,candidate("Hi Asha, I read \"growth report\". What do you think?")),"quote");
 assert.equal(draftProblem(input,candidate("Hi [name], what do you think?")),"placeholder");
});
test("model failures are retried then replaced by a safe deterministic draft", async () => {
 let calls = 0;
 const out = await generateOutreach(input,{mock:false,model:async () => {calls++; return [candidate("Hi Asha, I improved sales by 12%. What do you think?"),candidate("Hi Asha, I improved sales by 12%. What do you think?")];}});
 assert.equal(calls,2); assert.ok(out.versions.every(v => !v.body.includes("12%")));
});
test("note limit follows user setting and spent tier 2 suggests a blank invitation", async () => {
 const long = candidate(`Hi Asha, ${"a ".repeat(105)}?`);
 assert.equal(draftProblem(input,long),"length");
 assert.notEqual(draftProblem({...input,noteLimit:300},long),"length");
 const out=await generateOutreach({...input,tier:"tier_2",notesLeft:0},{mock:true});
 assert.match(out.recommendation,/blank invitation/i);
});
