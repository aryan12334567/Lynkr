import { test } from "node:test";
import assert from "node:assert/strict";
import { addBusinessDays, nextAction, replySummary } from "../lib/outreach/followup";
const at = (day: string) => new Date(`${day}T12:00:00+05:30`);
test("3B7 uses IST business days and stops after reply or follow-up", () => {
  const contact = { status: "messaged", messagedAt: "2026-11-02T10:00:00+05:30" };
  assert.equal(addBusinessDays("2026-11-02", 3), "2026-11-05");
  assert.deepEqual(nextAction(contact, at("2026-11-05")), { kind: "second_person", day: "2026-11-05" });
  assert.deepEqual(nextAction(contact, at("2026-11-11")), { kind: "follow_up", day: "2026-11-11" });
  assert.equal(nextAction({ ...contact, repliedAt: "2026-11-04T12:00:00+05:30" }, at("2026-11-11")), null);
  assert.equal(nextAction({ ...contact, followUpSent: true }, at("2026-11-12")), null);
  assert.equal(addBusinessDays("2026-11-06", 3), "2026-11-11");
});
test("old unanswered invitations and honest rates", () => {
  assert.deepEqual(nextAction({ status: "invited", invitedAt: "2026-11-02T10:00:00+05:30" }, at("2026-11-23")), { kind: "withdraw", day: "2026-11-23" });
  assert.equal(replySummary(3, 4), "3 of 4");
  assert.equal(replySummary(3, 5), "3 of 5 (60%)");
});
