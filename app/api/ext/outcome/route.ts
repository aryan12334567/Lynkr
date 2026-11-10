import { z } from "zod";
import { bumpMetric } from "@/lib/db";
import { readJson } from "@/lib/http";
import { istToUTC, todayIST } from "@/lib/ist";
import { getContact } from "@/lib/outreach/contacts-db";
import { extensionAuth, extJson, preflight } from "@/lib/outreach/ext-auth";
import { afterMeeting } from "@/lib/outreach/followup";
import { recordMeetsGoal } from "@/lib/outreach/goals";
import { NOTE_MAX, TimelineError, listEvents, recordEvent, type EventKind, type RecordResult, type TimelineEvent } from "@/lib/outreach/timeline";

/**
 * One-tap records from the side panel (R40, KTD20). Every tap is one `recordEvent` op, the only writer (KTD15), so the
 * contact's summary, the next step and the suggestions follow from it exactly as they do from the web app. A lapsed
 * subscription is refused by `extensionAuth` before anything is read or written. Undo stays in the web card.
 */
const STATUSES = ["invited", "accepted", "messaged", "replied", "outcome", "meeting_booked", "meeting_done", "goal_reached", "close"] as const;
const NEXT = ["thank_you", "act_on_it", "check_in", "referral_ask", "reschedule", "close"] as const;
const Body = z.object({
  contactId: z.string().uuid(),
  status: z.enum(STATUSES),
  /** Earlier clients send `status: "outcome"` with how it went. */
  outcome: z.enum(["positive", "negative", "no_response"]).optional(),
  /** A retried tap with the same id changes nothing. */
  opId: z.string().min(8).max(100).optional(),
  meetingAt: z.string().max(40).optional(),
  happened: z.enum(["yes", "no_show", "moved"]).optional(),
  rating: z.enum(["good", "neutral", "bad"]).optional(),
  next: z.enum(NEXT).optional(),
  note: z.string().trim().max(NOTE_MAX).optional(),
}).strict();

const KIND: Record<"invited" | "accepted" | "messaged" | "replied" | "goal_reached" | "close", EventKind> = {
  invited: "invite_sent", accepted: "accepted", messaged: "message_sent", replied: "reply", goal_reached: "goal_reached", close: "closed",
};
const NEED_TIME = "Add the meeting's date and time (IST), like 2026-11-05T15:30.";

/** A local date and time means IST; a full ISO time with an offset is taken as written. `null` when it isn't a real moment. */
function parseMeetingTime(text: string): Date | null {
  const local = /^(\d{4}-\d{2}-\d{2})[T ]([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/.exec(text);
  if (local) {
    const at = istToUTC(local[1], `${local[2]}:${local[3]}`);
    return todayIST(istToUTC(local[1], "12:00")) === local[1] ? at : null; // 2031-02-30 rolls over to March, so it fails here
  }
  if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(text)) return null;
  const at = new Date(text);
  return Number.isNaN(at.getTime()) ? null : at;
}

const fail = (req: Request, message: string, status = 400) => extJson(req, { error: message }, status);

export const OPTIONS = preflight;

export async function POST(req: Request) {
  const auth = await extensionAuth(req); if ("error" in auth) return auth.error;
  const read = await readJson(req, 2048); if ("error" in read) return extJson(req, { error: "Invalid request." }, read.error.status);
  const parsed = Body.safeParse(read.body); if (!parsed.success) return fail(req, "Invalid request.");
  const b = parsed.data;
  const contact = await getContact(auth.db, auth.userId, b.contactId);
  if (!contact) return fail(req, "Contact not found.", 404);

  // Everything is checked before the first write, so a refused tap leaves nothing behind.
  const meetingAt = b.meetingAt === undefined ? null : parseMeetingTime(b.meetingAt);
  if (b.meetingAt !== undefined && !meetingAt) return fail(req, NEED_TIME);
  const opId = b.opId ?? crypto.randomUUID();
  let kind: EventKind;
  if (b.status === "outcome") {
    if (!b.outcome) return fail(req, "Say how it went.");
    kind = b.outcome === "positive" ? "goal_reached" : "closed";
  } else if (b.status === "meeting_booked") {
    if (!meetingAt) return fail(req, NEED_TIME);
    kind = "meeting_booked";
  } else if (b.status === "meeting_done") {
    if (!b.happened) return fail(req, "Say whether the meeting happened.");
    if (b.happened === "moved" && !meetingAt) return fail(req, `Moved: ${NEED_TIME}`);
    if (b.rating && b.happened !== "yes") return fail(req, "Only a meeting that happened can be rated.");
    kind = "meeting_done";
  } else kind = KIND[b.status];
  if (b.next && (b.status !== "meeting_done" || b.happened === "moved")) return fail(req, "A next step goes with a meeting that happened or was missed.");

  try {
    let out: RecordResult;
    let goalCheck: boolean | null = null;
    if (b.status === "meeting_done" && b.happened === "moved") {
      const booked = (await listEvents(auth.db, auth.userId, contact.id)).filter((e) => e.kind === "meeting_booked" && e.status === "done").at(-1);
      if (!booked) return fail(req, "There is no booked meeting to move.");
      out = await recordEvent(auth.db, auth.userId, { type: "insert", opId, contactId: contact.id, kind: "meeting_booked", meetingAt: meetingAt!, note: b.note, supersedes: { id: booked.id, reason: "moved" } });
    } else {
      // The step the user chose after a meeting, checked against what R43 offers for this answer.
      const offered = b.status === "meeting_done" ? afterMeeting(contact.goal, { happened: b.happened!, rating: b.rating ?? null, at: new Date() }).steps : [];
      const chosen = b.next ? offered.find((s) => s.choice === b.next) : undefined;
      if (b.next && !chosen) return fail(req, "That next step isn't offered for this answer.");

      out = await recordEvent(auth.db, auth.userId, {
        type: "insert", opId, contactId: contact.id, kind, meetingAt: meetingAt ?? undefined,
        happened: b.status === "meeting_done" ? b.happened : undefined, rating: b.status === "meeting_done" ? b.rating : undefined, note: b.note,
      });
      if (!out.replayed && chosen && !chosen.recommended) {
        // A step other than the recommended one replaces it: the suggestion made for this answer is dismissed.
        if (chosen.choice === "close") {
          out = { ...(await recordEvent(auth.db, auth.userId, { type: "insert", opId: `${opId}:next`, contactId: contact.id, kind: "closed", note: undefined })), event: out.event };
        } else {
          const auto = out.events.find((e: TimelineEvent) => e.triggerId === out.event.id && e.status === "due");
          await recordEvent(auth.db, auth.userId, { type: "insert", opId: `${opId}:next`, contactId: contact.id, kind: chosen.kind, status: "due", dueAt: chosen.dueAt!, rule: chosen.rule, triggerId: out.event.id });
          if (auto) await recordEvent(auth.db, auth.userId, { type: "supersede", eventId: auto.id, reason: "dismissed" });
        }
        out = { ...out, contact: (await getContact(auth.db, auth.userId, contact.id))! };
      }
      if (b.status === "meeting_done") goalCheck = recordMeetsGoal(contact.goal, { kind: "meeting_done", happened: b.happened!, rating: b.rating ?? null });
      else if (b.status === "replied") goalCheck = recordMeetsGoal(contact.goal, { kind: "reply" });
    }

    if (!out.replayed && !(b.status === "meeting_done" && b.happened !== "yes")) await count(auth.db, kind, contact.goal, b.rating);
    const c = out.contact;
    return extJson(req, {
      contact: { id: c.id, status: c.status, outcome: c.outcome, nextActionAt: c.nextActionAt },
      event: { id: out.event.id, kind: out.event.kind, status: out.event.status, meetingAt: out.event.meetingAt },
      // The record meets the goal's success text (R40): the panel offers the Goal reached tap; nothing is ticked for the user.
      goalReachedSuggested: goalCheck === true && !c.goalReachedAt,
      replayed: out.replayed,
    });
  } catch (e) {
    if (e instanceof TimelineError) return fail(req, e.message, e.code === "not_found" ? 404 : e.code === "conflict" ? 409 : 400);
    return fail(req, "Could not save that step.", 500);
  }
}

/** Count-only measurement (KTD21): the kind of tap, the rating or goal as the label, and nothing about the person. */
async function count(db: Parameters<typeof bumpMetric>[0], kind: EventKind, goal: string, rating: string | undefined) {
  try {
    if (kind === "meeting_booked") await bumpMetric(db, "outreach_meeting_booked");
    else if (kind === "meeting_done") await bumpMetric(db, "outreach_meeting_done", rating ?? "none");
    else if (kind === "goal_reached") await bumpMetric(db, "outreach_goal_reached", goal);
  } catch {
    // Measurement must never break a tap.
  }
}
