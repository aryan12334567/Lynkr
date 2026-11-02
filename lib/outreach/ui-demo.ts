// Demo mode (R37): an example person with a seeded timeline, and a small in-memory stand-in for the timeline routes.
// Nothing here is saved or sent anywhere. It lets someone with no account or keys try every tap on the card.
import { addDays, istToUTC, todayIST } from "../ist";
import { afterMeeting } from "./followup";
import type { UiContact } from "./ui-board";
import { deriveStatus, type Send, type TimelineRequest, type TimelineResult, type UiEvent } from "./ui-timeline";

export const DEMO_CONTACT_ID = "demo-priya";
export const DEMO_NOTICE = "This is an example person. Nothing here is saved.";

function baseContact(now: Date): UiContact {
  const iso = now.toISOString();
  return {
    id: DEMO_CONTACT_ID, userId: "demo", name: "Priya Nair", company: "Northwind Analytics", role: "Analytics lead", profileUrl: null,
    relationship: "stranger", bridge: "public_work", goal: "job", intent: "learn_role", tier: "tier_1", source: "manual", status: "to_contact",
    invitedAt: null, acceptedAt: null, messagedAt: null, repliedAt: null, outcomeAt: null, nextActionAt: null, outcome: null, noteUsed: false,
    angleUsed: null, brief: null, whyText: null, whySource: "comment", goalReachedAt: null, closedAt: null, createdAt: iso, updatedAt: iso,
  };
}

/** The example person: done, suggested and replaced steps, and a meeting that needs its answer. */
export function demoSeed(now = new Date()): { contact: UiContact; events: UiEvent[] } {
  const today = todayIST(now);
  const at = (offset: number, time = "10:30") => istToUTC(addDays(today, offset), time).toISOString();
  const e = (id: string, kind: UiEvent["kind"], o: Partial<UiEvent>): UiEvent => ({
    id, contactId: DEMO_CONTACT_ID, kind, status: "done", dueAt: null, doneAt: null, meetingAt: null, happened: null, rating: null, note: null, rule: null,
    supersededReason: null, supersedesId: null, triggerId: null, opId: `demo-op-${id}`, createdAt: o.doneAt ?? o.dueAt ?? at(0), ...o,
  });
  const events: UiEvent[] = [
    e("demo-e1", "invite_sent", { doneAt: at(-12) }),
    e("demo-e2", "accepted", { doneAt: at(-10) }),
    e("demo-e3", "message_sent", { doneAt: at(-10, "11:00") }),
    e("demo-e4", "reply", { doneAt: at(-8) }),
    e("demo-e5", "meeting_booked", { doneAt: at(-8, "12:00"), meetingAt: at(-5, "18:00"), status: "superseded", supersededReason: "moved" }),
    e("demo-e6", "meeting_booked", { doneAt: at(-5, "12:00"), meetingAt: at(-1, "18:00"), supersedesId: "demo-e5" }),
    e("demo-e7", "follow_up", { status: "superseded", dueAt: at(-3), supersededReason: "moved", rule: "No reply recorded from Priya Nair in 7 business days. Did Priya Nair reply? If not, send one follow-up.", triggerId: "demo-e3" }),
    e("demo-e8", "follow_up", { status: "due", dueAt: at(1), rule: "No reply recorded from Priya Nair in 7 business days. Did Priya Nair reply? If not, send one follow-up.", triggerId: "demo-e3", supersedesId: "demo-e7" }),
  ];
  const day = new Date(now.getTime() - 4 * 86_400_000).toISOString().slice(0, 10);
  const contact = { ...baseContact(now), whyText: `You commented on her post on ${new Date(day).getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][new Date(day).getUTCMonth()]}` };
  return { contact: withSummary(contact, events), events };
}

function withSummary(contact: UiContact, events: UiEvent[]): UiContact {
  const live = events.filter((x) => x.status !== "superseded");
  const first = (kind: UiEvent["kind"]) => live.filter((x) => x.kind === kind && x.status === "done" && x.doneAt).map((x) => x.doneAt!).sort()[0] ?? null;
  const due = live.filter((x) => x.status === "due" && x.dueAt).map((x) => x.dueAt!).sort()[0] ?? null;
  const goalReachedAt = first("goal_reached"), closedAt = first("closed");
  return {
    ...contact, status: deriveStatus(events), invitedAt: first("invite_sent"), acceptedAt: first("accepted"), messagedAt: first("message_sent"), repliedAt: first("reply"),
    goalReachedAt, closedAt, outcomeAt: goalReachedAt ?? closedAt, nextActionAt: goalReachedAt || closedAt ? null : due,
  };
}

const when = (v: unknown, fallback: Date): Date => {
  if (typeof v !== "string") return fallback;
  return v.length === 10 ? istToUTC(v, "10:30") : new Date(v);
};

/** The timeline routes, in memory. It applies the same rules the server does for the taps on the card, and suggests the thank-you after a meeting. */
export function createDemoApi(now = new Date()): { send: Send; events: () => UiEvent[]; contact: () => UiContact } {
  const seed = demoSeed(now);
  let events = seed.events;
  let n = 100;
  const today = todayIST(now);
  const snapshot = (event: UiEvent | undefined, replayed = false): TimelineResult => ({ events: [...events], contact: withSummary(seed.contact, events), event, replayed });
  const make = (kind: UiEvent["kind"], o: Partial<UiEvent>): UiEvent => ({
    id: `demo-e${++n}`, contactId: DEMO_CONTACT_ID, kind, status: "done", dueAt: null, doneAt: null, meetingAt: null, happened: null, rating: null, note: null, rule: null,
    supersededReason: null, supersedesId: null, triggerId: null, opId: `demo-op-${n}`, createdAt: now.toISOString(), ...o,
  });
  const supersede = (id: string, reason: UiEvent["supersededReason"]) => { events = events.map((x) => (x.id === id && x.status !== "superseded" ? { ...x, status: "superseded", supersededReason: reason } : x)); };

  const send: Send = async (req: TimelineRequest) => {
    if (req.route === "calendar") {
      const { op_id: opId, id, day, time } = req.body;
      const prior = events.find((x) => x.opId === opId);
      if (prior) return snapshot(prior, true);
      const old = events.find((x) => x.id === id);
      if (!old) throw new Error("Step not found.");
      if (old.status === "superseded") throw new Error("Only a step that is still due can be moved.");
      const at = istToUTC(day, time ?? (old.kind === "meeting_booked" && old.meetingAt ? new Date(new Date(old.meetingAt).getTime() + 330 * 60_000).toISOString().slice(11, 16) : "10:30")).toISOString();
      const next = old.kind === "meeting_booked" ? make("meeting_booked", { opId, doneAt: old.doneAt, meetingAt: at, supersedesId: old.id }) : make(old.kind, { opId, status: "due", dueAt: at, rule: old.rule, triggerId: old.triggerId, supersedesId: old.id });
      supersede(old.id, "moved");
      events = [...events, next];
      return snapshot(next);
    }
    const b = req.body as Record<string, unknown>;
    if (b.type === "supersede") { supersede(String(b.eventId), b.reason as UiEvent["supersededReason"]); return snapshot(events.find((x) => x.id === b.eventId)); }
    if (b.type === "update") {
      const old = events.find((x) => x.id === b.eventId);
      if (!old) throw new Error("Step not found.");
      if (old.status === "superseded") throw new Error("A replaced step can't be changed.");
      const patch = b.patch as { done?: boolean; doneAt?: string };
      const doneAt = patch.done ? when(patch.doneAt, now) : null;
      if (doneAt && todayIST(doneAt) > today) throw new Error("A done step can be dated today or earlier.");
      const updated: UiEvent = { ...old, ...(patch.done ? { status: "done", doneAt: doneAt!.toISOString() } : {}) };
      events = events.map((x) => (x.id === old.id ? updated : x));
      return snapshot(updated);
    }
    const prior = events.find((x) => x.opId === b.op_id);
    if (prior) return snapshot(prior, true);
    const kind = b.kind as UiEvent["kind"];
    const status = (b.status as "done" | "due" | undefined) ?? "done";
    const doneAt = status === "done" ? when(b.doneAt, now) : null;
    if (doneAt && todayIST(doneAt) > today) throw new Error("A done step can be dated today or earlier.");
    if (kind === "meeting_booked" && typeof b.meetingAt !== "string") throw new Error("A booked meeting needs its date and time.");
    if (kind === "meeting_done" && !b.happened) throw new Error("Say whether the meeting happened.");
    const event = make(kind, {
      opId: String(b.op_id), status, doneAt: doneAt?.toISOString() ?? null, dueAt: status === "due" && typeof b.dueAt === "string" ? when(b.dueAt, now).toISOString() : null,
      meetingAt: typeof b.meetingAt === "string" ? new Date(b.meetingAt).toISOString() : null, happened: (b.happened as UiEvent["happened"]) ?? null,
      rating: (b.rating as UiEvent["rating"]) ?? null, note: typeof b.note === "string" ? b.note : null, rule: typeof b.rule === "string" ? b.rule : null, triggerId: typeof b.triggerId === "string" ? b.triggerId : null,
    });
    events = [...events, event];
    if (kind === "reply") events.filter((x) => x.status === "due" && ["second_person", "follow_up", "closed", "withdraw"].includes(x.kind)).forEach((x) => supersede(x.id, "reply"));
    if (kind === "goal_reached" || kind === "closed") events.filter((x) => x.status === "due").forEach((x) => supersede(x.id, "finished"));
    if (kind === "meeting_done" && (event.happened === "yes" || event.happened === "no_show")) {
      const step = afterMeeting("job", { happened: event.happened, rating: event.rating, at: now }).steps.find((s) => s.recommended);
      if (step) events = [...events, make(step.kind, { opId: `sg:${step.kind}:${event.id}`, status: "due", dueAt: step.dueAt!.toISOString(), rule: step.rule, triggerId: event.id })];
    }
    return snapshot(event);
  };
  return { send, events: () => [...events], contact: () => withSummary(seed.contact, events) };
}
