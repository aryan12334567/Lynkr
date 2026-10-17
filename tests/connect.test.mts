// Connect Coach (C1–C6) plus the outreach plan's packet, contact decision and funnel rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CONNECT,
  addPerson,
  canAdd,
  funnel,
  lookFor,
  migratePerson,
  notesLeft,
  personFollowUpDue,
  setOutcome,
  stepPerson,
  validateImage,
  type Connect,
  type Person,
} from "../lib/connect";
import { composeNote, contactDecision, EMPTY_PACKET } from "../lib/packet";
import { ProfileInput, type Packet } from "../lib/schemas";

const profile = ProfileInput.parse({ goal: "job", targetRole: "Data analyst", background: "B.Com, tier-3", stage: "final_year" });
const facts = [
  { kind: "project" as const, text: "I built a dashboard for 40 sponsors." },
  { kind: "target" as const, text: "Analytics firms in Pune, and people like Rahul Sharma at Fractal" },
];
const NOW = new Date("2026-10-16T06:00:00Z"); // Fri 16 Oct, IST
const DAY = 86_400_000;

test("C1 who to look for: 3–5 cards, known people first, no full names", () => {
  const cards = lookFor(profile, facts);
  assert.ok(cards.length >= 3 && cards.length <= 5, `cards ${cards.length}`);
  assert.equal(cards[0].tier, "known");
  assert.equal(cards[0].firstDegree, true);
  for (const c of cards) {
    assert.doesNotMatch(c.who + c.why + c.search, /Rahul Sharma/);
    assert.ok(c.search.trim().length > 0);
  }
  const company = cards.find((c) => c.tier === "company");
  assert.ok(company && /Fractal/.test(company.search), "company kept");
  assert.match(company!.why, /isn't a reason/, "company-only is marked as weak");
});

test("C2 note budget is per IST month and only counts noted invitations", () => {
  const sentNow = (c: Connect, withNote: boolean, when: Date) => {
    const added = addPerson(c, "x", "stranger", withNote, when);
    return stepPerson(added, added.people.at(-1)!.id, 1, when);
  };
  let c: Connect = { ...DEFAULT_CONNECT };
  assert.equal(notesLeft(c, NOW), 3);
  c = sentNow(c, true, NOW);
  c = sentNow(c, true, NOW);
  c = sentNow(c, false, NOW);
  c = sentNow(c, true, new Date("2026-09-20T06:00:00Z"));
  assert.equal(notesLeft(c, NOW), 1);
  c = sentNow(sentNow(c, true, NOW), true, NOW);
  assert.equal(notesLeft(c, NOW), 0);
});

test("C3 weekly cap counts people added this IST week only", () => {
  let c: Connect = { ...DEFAULT_CONNECT };
  c = addPerson(c, "old", "stranger", false, new Date("2026-10-09T06:00:00Z"));
  for (let i = 0; i < 4; i++) c = addPerson(c, `p${i}`, "stranger", false, NOW);
  assert.equal(canAdd(c, NOW), true);
  c = addPerson(c, "p5", "stranger", false, NOW);
  assert.equal(canAdd(c, NOW), false);
});

test("C4 funnel stages per channel, stamps, and follow-up timing", () => {
  let c = addPerson({ ...DEFAULT_CONNECT }, "x", "alumni", true, NOW);
  const id = c.people[0].id;
  const statuses = [c.people[0].status];
  for (let i = 0; i < 4; i++) {
    c = stepPerson(c, id, 1, NOW);
    statuses.push(c.people[0].status);
  }
  assert.deepEqual(statuses, ["considered", "invited", "accepted", "messaged", "replied"]);
  c = stepPerson(c, id, -1, NOW);
  assert.equal(c.people[0].status, "messaged");
  assert.equal(c.people[0].repliedAt, undefined);
  const p = c.people[0];
  assert.equal(personFollowUpDue(p, new Date(NOW.getTime() + 4 * DAY)), false);
  assert.equal(personFollowUpDue(p, new Date(NOW.getTime() + 5 * DAY)), true);
  assert.equal(personFollowUpDue({ ...p, outcome: "stopped" }, new Date(NOW.getTime() + 9 * DAY)), false, "stopping ends follow-ups");
  // Going back to the start clears the invitation, so the note isn't counted.
  c = stepPerson(stepPerson(stepPerson(c, id, -1, NOW), id, -1, NOW), id, -1, NOW);
  assert.equal(c.people[0].status, "considered");
  assert.equal(c.people[0].invitedAt, undefined);
  // Email has no invitation stage.
  let e = addPerson({ ...DEFAULT_CONNECT }, "y", "knows_me", true, NOW, { channel: "email" });
  assert.equal(e.people[0].withNote, false);
  e = stepPerson(e, e.people[0].id, 1, NOW);
  assert.equal(e.people[0].status, "messaged");
});

test("C4b funnel uses mature cohorts and keeps acceptance and replies separate", () => {
  let c: Connect = { ...DEFAULT_CONNECT, weeklyCap: 20 };
  const old = new Date(NOW.getTime() - 20 * DAY);
  for (let i = 0; i < 3; i++) {
    c = addPerson(c, `o${i}`, "stranger", false, old);
    c = stepPerson(c, c.people.at(-1)!.id, 1, old);
  }
  c = stepPerson(c, c.people[0].id, 1, old); // accepted
  c = addPerson(c, "new", "stranger", false, NOW);
  c = stepPerson(c, c.people.at(-1)!.id, 1, NOW); // invited today: too recent
  c = setOutcome(c, c.people[0].id, "useful_answer", NOW);
  const f = funnel(c.people, NOW);
  assert.equal(f.invited, 4);
  assert.equal(f.invitedMature, 3);
  assert.equal(f.acceptedOfMature, 1);
  assert.equal(f.pendingMature, 2);
  assert.equal(f.messaged, 0);
  assert.equal(f.useful, 1);
});

test("C4c older saves migrate without losing people", () => {
  const old = { id: "p1", label: "x", relationship: "stranger", withNote: true, status: "sent", addedAt: NOW.toISOString(), sentAt: NOW.toISOString() } as unknown as Omit<Person, "status"> & { status: string };
  const m = migratePerson(old);
  assert.equal(m.status, "invited");
  assert.equal(m.invitedAt, NOW.toISOString());
});

const packet = (p: Partial<Packet>): Packet => ({ ...EMPTY_PACKET, ...p });

test("C5 contact decision comes before wording", () => {
  assert.equal(contactDecision(packet({ intent: "referral", bridge: "none", anchor: "post on SQL joins", ask: "refer me" })).status, "hold");
  assert.equal(contactDecision(packet({ bridge: "none", anchor: "works at Fractal", ask: "a question" })).status, "other_route");
  assert.equal(contactDecision(packet({ bridge: "public_work", anchor: "", ask: "a question" })).status, "need_detail");
  assert.equal(contactDecision(packet({ bridge: "public_work", anchor: "post on cleaning survey data", ask: "" })).status, "need_detail");
  assert.equal(contactDecision(packet({ bridge: "public_work", anchor: "post on cleaning survey data", ask: "how do you pick outliers", recipientRole: "Analyst", roleChecked: false })).status, "need_detail");
  assert.equal(contactDecision(packet({ bridge: "public_work", anchor: "post on cleaning survey data", ask: "how do you pick outliers" })).status, "good");
  assert.equal(contactDecision(packet({ intent: "referral", bridge: "knows_me", ask: "would you refer me" })).status, "good");
});

test("C5b demo note: fits 200 characters, uses only picked facts, never fills gaps with praise", () => {
  const p = packet({ bridge: "public_work", anchor: "post on cleaning survey data", ask: "how do you decide which outliers to drop" });
  const n = composeNote(profile, p, [{ id: "F1", kind: "project", text: "I built a dashboard for 40 sponsors" }]);
  assert.equal(n.fitStatus, "ready_for_review");
  assert.ok(n.body.length <= 200, `length ${n.body.length}: ${n.body}`);
  assert.match(n.body, /^Hi \[\[their first name\]\]/);
  assert.match(n.body, /survey data/);
  assert.match(n.body, /How do you decide which outliers to drop\?/, "the ask starts its own sentence with a capital");
  assert.doesNotMatch(n.body, /refer|job|opening|hire|admire|impressive/i);
  for (const id of n.factRefs) assert.equal(id, "F1");
  const missing = composeNote(profile, packet({ bridge: "public_work", anchor: "", ask: "a question" }), []);
  assert.equal(missing.fitStatus, "needs_context");
  assert.equal(missing.body, "");
  assert.ok(missing.question.length > 0);
  const hold = composeNote(profile, packet({ intent: "referral", bridge: "none", anchor: "post", ask: "refer me" }), []);
  assert.equal(hold.fitStatus, "do_not_send");
});

test("C6 screenshot validation", () => {
  const small = "A".repeat(1000);
  assert.equal(validateImage("image/png", small), null);
  assert.equal(validateImage("image/jpeg", small), null);
  assert.equal(validateImage("image/webp", small), null);
  assert.match(validateImage("image/gif", small) ?? "", /PNG, JPG or WebP/);
  assert.match(validateImage("image/png", "A".repeat(6_000_000)) ?? "", /over 4 MB/);
});
