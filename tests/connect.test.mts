// Unit tests for Connect Coach (acceptance tests C1–C6 in research/acceptance-tests.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CONNECT,
  NOTE_MAX,
  addPerson,
  canAdd,
  mockLookFor,
  mockNote,
  notesLeft,
  personFollowUpDue,
  stepPerson,
  validateImage,
  type Connect,
} from "../lib/connect";

const profile = { goal: "job", targetRole: "Data analyst", background: "B.Com, tier-3", currentProfile: "" } as const;
const turns = ["a", "b", "c", "d", "e", "Analytics firms in Pune, and people like Rahul Sharma at Fractal"].map((a, i) => ({ q: `Q${i}`, a }));
const NOW = new Date("2026-10-16T06:00:00Z"); // Fri 16 Oct, IST

test("C1 who to look for: 5–8 cards, LinkedIn people search, no full names", () => {
  const cards = mockLookFor(profile, turns);
  assert.ok(cards.length >= 5 && cards.length <= 8, `cards ${cards.length}`);
  for (const c of cards) {
    assert.doesNotMatch(c.who + c.why + c.search, /Rahul Sharma/);
    assert.ok(c.search.trim().length > 0);
  }
  assert.ok(cards.some((c) => /Fractal/.test(c.search)), "company kept");
});

test("C2 note budget is per IST month and only counts noted sends", () => {
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

test("C4 tracker states and follow-up timing", () => {
  let c = addPerson({ ...DEFAULT_CONNECT }, "x", "alumni", true, NOW);
  const id = c.people[0].id;
  const statuses = [c.people[0].status];
  for (let i = 0; i < 4; i++) {
    c = stepPerson(c, id, 1, NOW);
    statuses.push(c.people[0].status);
  }
  assert.deepEqual(statuses, ["to_find", "sent", "accepted", "messaged", "replied"]);
  c = stepPerson(c, id, -1, NOW);
  assert.equal(c.people[0].status, "messaged");
  const p = c.people[0];
  assert.equal(personFollowUpDue(p, new Date(NOW.getTime() + 4 * 86_400_000)), false);
  assert.equal(personFollowUpDue(p, new Date(NOW.getTime() + 5 * 86_400_000)), true);
  assert.equal(personFollowUpDue({ ...p, status: "replied" }, new Date(NOW.getTime() + 9 * 86_400_000)), false);
  // Going back to "to find" un-sends it.
  c = stepPerson(stepPerson(stepPerson(c, id, -1, NOW), id, -1, NOW), id, -1, NOW);
  assert.equal(c.people[0].status, "to_find");
  assert.equal(c.people[0].sentAt, undefined);
});

test("C5 demo note fits 200 characters and asks for nothing", () => {
  const n = mockNote(profile, "Priya Nair\nSenior Analyst at Fractal | SQL, Tableau");
  assert.ok(n.note.length <= NOTE_MAX, `length ${n.note.length}`);
  assert.match(n.note, /^Hi \[\[/);
  assert.doesNotMatch(n.note, /refer|job|opening|hire/i);
  assert.doesNotMatch(n.who, /Priya Nair/);
});

test("C6 screenshot validation", () => {
  const small = "A".repeat(1000);
  assert.equal(validateImage("image/png", small), null);
  assert.equal(validateImage("image/jpeg", small), null);
  assert.equal(validateImage("image/webp", small), null);
  assert.match(validateImage("image/gif", small) ?? "", /PNG, JPG or WebP/);
  assert.match(validateImage("image/png", "A".repeat(6_000_000)) ?? "", /over 4 MB/);
});
