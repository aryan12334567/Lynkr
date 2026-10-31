import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { GOALS, GOAL_IDS, goalFor, preselectGoals, defaultIntent, unansweredGoalDetails, goalDetailFact, saveOutreachGoals, readOutreachGoals } from "../lib/outreach/goals";
import { PLAYBOOKS, playbookFor } from "../lib/outreach/playbooks";
import { composeDrafts } from "../lib/outreach/draft";
import { checkMessage, CHANNEL_RULES, type Relationship } from "../lib/checker";
import { CHANNELS, OUTREACH_ONLY_KINDS, FACT_KINDS, type StoryFact } from "../lib/schemas";
import { getBrief, saveBrief, listFacts, saveFacts, type Db } from "../lib/db";

const RELATIONSHIPS: Relationship[] = ["stranger", "alumni", "knows_me"];

async function fresh() {
 const pg = new PGlite();
 await pg.exec(`create table "user" (id text primary key); insert into "user" values ('a'),('b');`);
 await pg.exec(readFileSync(new URL("../scripts/migrations/001_vertical1.sql", import.meta.url), "utf8"));
 const db: Db = { query: async <R = Record<string, unknown>,>(sql: string, params?: unknown[]) => ({ rows: (await pg.query(sql, params)).rows as R[] }) };
 return { pg, db };
}
const fact = (over: Partial<StoryFact> & Pick<StoryFact, "id">): StoryFact => ({ kind: "goal_detail", text: "x", sourceTurnIds: [], reviewStatus: "confirmed", useInDrafts: true, ...over });

test("goals and playbooks cover all goals and relationships", () => {
 assert.equal(GOALS.length, 10); assert.equal(PLAYBOOKS.length, 30);
 assert.ok(GOALS.every(g => g.details.length <= 3));
 assert.deepEqual(preselectGoals(["job", "clients"]), ["job", "clients"]);
 assert.notEqual(playbookFor("referral", "stranger").intent, "referral");
});

test("interview goals preselect outreach goals, by want or by label", () => {
 assert.deepEqual(preselectGoals(["A new job", "Clients"]), ["job", "clients"]);
 assert.deepEqual(preselectGoals(["Referrals", "Meeting people in my field", "A mentor"]), ["referral", "network", "mentor"]);
 assert.deepEqual(preselectGoals(["internship"]), ["job"]);
 assert.deepEqual(preselectGoals([]), []);
 assert.deepEqual(preselectGoals(["nonsense" as never]), []);
});

test("every goal has the full definition", () => {
 assert.deepEqual(GOALS.map(g => g.id), [...GOAL_IDS]);
 for (const g of GOALS) {
  assert.ok(g.label && g.description && g.success, g.id);
  assert.ok(g.targets.length > 0 && g.signals.length > 0, g.id);
  assert.ok(g.details.length >= 1 && g.details.length <= 3, g.id);
  assert.equal(new Set(g.details.map(d => d.key)).size, g.details.length, `${g.id} detail keys are unique`);
  for (const d of g.details) { assert.ok(d.question.endsWith("?")); assert.ok(d.options.length >= 2); assert.equal(d.freeText, true); }
  for (const r of RELATIONSHIPS) assert.equal(defaultIntent(g.id, r), g.intents[r]);
  assert.equal(goalFor(g.id), g);
 }
});

// The table test: all 10 goals x 3 relationships.
for (const goal of GOAL_IDS) for (const relationship of RELATIONSHIPS) {
 test(`playbook ${goal} x ${relationship}`, () => {
  const book = playbookFor(goal, relationship);
  assert.equal(book.goal, goal); assert.equal(book.relationship, relationship);
  assert.equal(book.intent, defaultIntent(goal, relationship));
  assert.ok(book.angles.length >= 2 && book.angles.length <= 3, "2 to 3 opening angles");
  assert.equal(new Set(book.angles.map(a => a.id)).size, book.angles.length);
  for (const a of book.angles) assert.ok(a.id && a.label && a.use);
  assert.ok(book.ask.endsWith("?"));
  assert.ok(book.proof.length > 0 && book.proof.every(k => (FACT_KINDS as readonly string[]).includes(k)));
  assert.ok(!book.proof.includes("goal_detail"), "goal details steer the draft, they are not proof");
  for (const ch of CHANNELS) { assert.ok(book.lengths[ch] > 0 && book.lengths[ch] <= CHANNEL_RULES[ch].max, ch); }
  assert.ok(book.followUp.length > 0);
  assert.ok(book.forbidden.length > 0);
  assert.doesNotMatch(JSON.stringify(book), /\[\[|\{\{|TODO/);
  // Never a deadline in the playbook copy.
  assert.doesNotMatch(JSON.stringify(book), /deadline/i);
  if (relationship === "stranger") assert.ok(book.forbidden.includes("referral ask to a stranger"));
  if (book.intent !== "referral") assert.doesNotMatch(book.ask, /referr?/i, "only a referral playbook may ask for a referral");
  for (const ch of CHANNELS) {
   const r = checkMessage(`Hi Asha, ${book.ask}`, relationship, { channel: ch, intent: book.intent });
   assert.ok(!r.flags.some(f => f.severity === "block"), `${ch}: ${r.flags.map(f => f.phrase).join(",")}`);
  }
  assert.equal(book.fallback === null, !(goal === "referral" && relationship !== "knows_me") && !(goal === "reconnect" && relationship === "stranger"));
 });
}

test("a referral ask is only set for someone who knows the user", () => {
 const referrals = PLAYBOOKS.filter(p => p.intent === "referral");
 assert.deepEqual(referrals.map(p => `${p.goal}:${p.relationship}`), ["referral:knows_me"]);
 for (const rel of ["stranger", "alumni"] as const) {
  const b = playbookFor("referral", rel);
  assert.equal(b.intent, "learn_role");
  assert.ok(b.fallback && b.fallback.explanation.length > 20);
  assert.match(b.fallback.explanation, /learn/i);
 }
 assert.equal(playbookFor("referral", "knows_me").fallback, null);
 assert.equal(playbookFor("reconnect", "stranger").intent !== "follow_up", true);
 assert.ok(playbookFor("reconnect", "stranger").fallback);
});

test("method-specific asks and limits", () => {
 assert.match(playbookFor("clients", "stranger").angles.map(a => a.id).join(), /teardown/);
 assert.match(playbookFor("funding", "knows_me").angles.map(a => a.id).join(), /traction/);
 assert.match(playbookFor("buy_business", "stranger").ask, /confidential/i);
 assert.ok(playbookFor("buy_business", "stranger").lengths.linkedin_message < playbookFor("job", "stranger").lengths.linkedin_message + 1);
 assert.ok(playbookFor("job", "stranger").angles.some(a => a.id === "insight"));
});

test("offline drafts have no placeholders or fabricated shared history and fit a note", () => {
 for (const book of PLAYBOOKS) {
  const out = composeDrafts({ goal: book.goal, relationship: book.relationship, channel: "connection_note", name: "Asha", company: "Example", facts: [] });
  assert.equal(out.versions.length, 2);
  for (const v of out.versions) { assert.ok(v.body.length <= 200); assert.doesNotMatch(v.body, /\[|\]|\{\{/); assert.doesNotMatch(v.body, /we met|our conversation/i); }
 }
});

test("goal_detail is a private outreach fact kind", () => {
 assert.ok((FACT_KINDS as readonly string[]).includes("goal_detail"));
 assert.ok(OUTREACH_ONLY_KINDS.includes("goal_detail"));
});

test("a goal detail already present as a confirmed fact is not asked again", () => {
 const all = goalFor("job").details.map(d => d.key);
 assert.deepEqual(unansweredGoalDetails("job", []).map(d => d.key), all);
 const answered = goalDetailFact("job", all[0], "Full time");
 assert.equal(answered.kind, "goal_detail"); assert.equal(answered.reviewStatus, "confirmed");
 assert.ok(answered.text.includes("Full time") && answered.id.length <= 12);
 assert.deepEqual(unansweredGoalDetails("job", [answered]).map(d => d.key), all.slice(1));
 // A candidate or excluded fact does not count as answered, nor does another goal's fact.
 assert.deepEqual(unansweredGoalDetails("job", [{ ...answered, reviewStatus: "candidate" }]).map(d => d.key), all);
 assert.deepEqual(unansweredGoalDetails("job", [{ ...answered, reviewStatus: "excluded" }]).map(d => d.key), all);
 assert.deepEqual(unansweredGoalDetails("referral", [answered]).map(d => d.key), goalFor("referral").details.map(d => d.key));
 assert.deepEqual(unansweredGoalDetails("job", [fact({ id: "F9", kind: "project", sourceQid: answered.sourceQid })]).map(d => d.key), all);
 for (const d of goalFor("job").details) assert.ok(!unansweredGoalDetails("job", [goalDetailFact("job", d.key, "Remote")]).some(x => x.key === d.key));
 assert.throws(() => goalDetailFact("job", "nope", "x"));
 assert.throws(() => goalDetailFact("job", all[0], "   "));
});

test("saving goals bumps the brief version and leaves other brief fields unchanged", async () => {
 const { pg, db } = await fresh();
 const before = { bucket: "fresher", field: "Data", targets: ["Analyst"], outreach: { other: 1, goals: ["network"] } };
 await saveBrief(db, "a", before);
 const v1 = (await getBrief(db, "a"))!.version;
 const res = await saveOutreachGoals(db, "a", ["job", "clients", "job"], []);
 assert.deepEqual(res.goals, ["job", "clients"]);
 assert.equal(res.version, v1 + 1);
 const now = (await getBrief<Record<string, unknown>>(db, "a"))!;
 assert.equal(now.version, v1 + 1);
 assert.deepEqual({ ...now.data, outreach: undefined }, { ...before, outreach: undefined });
 assert.deepEqual(now.data.outreach, { other: 1, goals: ["job", "clients"] });
 assert.equal((await getBrief(db, "a"))!.version, v1 + 1);
 assert.equal((await getBrief(db, "b")), null);
 // Saving the same goals again changes nothing.
 assert.equal((await saveOutreachGoals(db, "a", ["job", "clients"], [])).version, v1 + 1);
 assert.deepEqual(await readOutreachGoals(db, "a"), ["job", "clients"]);
 assert.deepEqual(await readOutreachGoals(db, "b"), []);
 await pg.close();
});

test("saving goals with no existing brief creates one holding only the goals", async () => {
 const { pg, db } = await fresh();
 const res = await saveOutreachGoals(db, "a", ["mentor"], []);
 assert.equal(res.version, 1);
 assert.deepEqual((await getBrief(db, "a"))!.data, { outreach: { goals: ["mentor"] } });
 await pg.close();
});

test("goal details are saved as confirmed goal_detail facts and not asked again", async () => {
 const { pg, db } = await fresh();
 await saveFacts(db, "a", [fact({ id: "F1", kind: "project", text: "Built a thing" })]);
 const role = goalFor("job").details[0];
 const res = await saveOutreachGoals(db, "a", ["job"], [{ goal: "job", key: role.key, answer: "  Full time  " }]);
 assert.equal(res.detailsSaved, 1);
 const facts = await listFacts(db, "a");
 const saved = facts.filter(f => f.kind === "goal_detail");
 assert.equal(saved.length, 1);
 assert.equal(saved[0].reviewStatus, "confirmed"); assert.equal(saved[0].useInDrafts, true);
 assert.ok(saved[0].text.includes("Full time") && !saved[0].text.includes("  "));
 assert.equal(facts.find(f => f.id === "F1")!.text, "Built a thing");
 assert.equal((await listFacts(db, "b")).length, 0);
 const left = unansweredGoalDetails("job", facts);
 assert.ok(!left.some(d => d.key === role.key) && left.length === goalFor("job").details.length - 1);
 // Answering again replaces the answer rather than adding a second fact.
 await new Promise(r => setTimeout(r, 5));
 await saveOutreachGoals(db, "a", ["job"], [{ goal: "job", key: role.key, answer: "Internship" }]);
 const again = (await listFacts(db, "a")).filter(f => f.kind === "goal_detail");
 assert.equal(again.length, 1); assert.ok(again[0].text.includes("Internship"));
 await pg.close();
});

test("goal details for an unknown goal, unknown key, unselected goal or empty answer are rejected", async () => {
 const { pg, db } = await fresh();
 await assert.rejects(saveOutreachGoals(db, "a", ["job"], [{ goal: "clients", key: "offer", answer: "x" }]), /goal/i);
 await assert.rejects(saveOutreachGoals(db, "a", ["job"], [{ goal: "job", key: "nope", answer: "x" }]), /question/i);
 await assert.rejects(saveOutreachGoals(db, "a", ["job"], [{ goal: "job", key: "role", answer: " " }]), /answer/i);
 await assert.rejects(saveOutreachGoals(db, "a", ["bogus" as never], []), /goal/i);
 assert.equal(await getBrief(db, "a"), null);
 await pg.close();
});
