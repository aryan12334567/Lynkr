import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarEvent, outreachGoogleCalendarUrl, outreachIcs, removeOutreachEvent, saveOutreachEvent, type OutreachEvent } from "../lib/outreach/calendar";

const event: OutreachEvent = { id: "evt1", contactId: "C1", person: "Asha", type: "meeting_scheduled", day: "2026-11-02", time: "10:00", goal: "network", intent: "learn_role", reason: "Discuss analytics", connectionStatus: "accepted" };
test("outreach calendar exports contact, reason and IST time as an ICS reminder", () => {
  const ics = outreachIcs([event], new Date("2026-10-29T00:00:00Z"));
  assert.match(ics, /DTSTART:20261102T043000Z/);
  assert.match(ics, /SUMMARY:Meeting scheduled: Asha/);
  assert.match(ics, /Reason: Discuss analytics/);
  assert.match(ics, /Connection status: accepted/);
  assert.equal(calendarEvent(event).uid, "outreach-evt1");
});
test("Google link includes only an explicitly supplied valid attendee", () => {
  assert.equal(new URL(outreachGoogleCalendarUrl(event)).searchParams.has("add"), false);
  assert.match(outreachIcs([{ ...event, attendeeEmail: "asha@example.com" }]), /ATTENDEE:mailto:asha@example.com/);
  assert.equal(new URL(outreachGoogleCalendarUrl({ ...event, attendeeEmail: "asha@example.com" })).searchParams.get("add"), "asha@example.com");
  assert.equal(new URL(outreachGoogleCalendarUrl({ ...event, attendeeEmail: "a@example.com,b@example.com" })).searchParams.has("add"), false);
});
test("updating and removing one event preserves other events", () => {
  const second = { ...event, id: "evt2", contactId: "C2", day: "2026-11-03" };
  const events = saveOutreachEvent([second, event], { ...event, meetingOutcome: "good" });
  assert.equal(events.length, 2);
  assert.equal(events[0].meetingOutcome, "good");
  assert.deepEqual(removeOutreachEvent(events, "evt1"), [second]);
});
