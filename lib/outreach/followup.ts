import { addDays, istToUTC, todayIST, weekdayIndex } from "../ist";
import { DEFAULT_TIMES } from "../plan";
import { allowsReferralAsk, recordMeetsGoal } from "./goals";
import type { Contact } from "./contacts-db";
import type { EventKind, InsertOp, SupersededReason, SupersedeOp, TimelineEvent } from "./timeline";

/** Add business days to an IST calendar date. Weekends are excluded. */
export function addBusinessDays(day: string, count: number): string {
  let current = day;
  for (let done = 0; done < count;) {
    current = addDays(current, 1);
    if (weekdayIndex(current) < 5) done++;
  }
  return current;
}

export type FollowupContact = {
  status: string;
  invitedAt?: string | Date | null;
  acceptedAt?: string | Date | null;
  messagedAt?: string | Date | null;
  repliedAt?: string | Date | null;
  outcome?: string | null;
  secondPersonSuggested?: boolean;
  followUpSent?: boolean;
};
export type NextAction = { kind: "second_person" | "follow_up" | "withdraw"; day: string } | null;
const dayOf = (value: string | Date) => todayIST(new Date(value));

/** A suggestion only: the person sends or withdraws manually. */
export function nextAction(contact: FollowupContact, now = new Date()): NextAction {
  if (contact.repliedAt || contact.outcome || ["replied", "outcome", "closed"].includes(contact.status)) return null;
  const today = todayIST(now);
  if (contact.status === "invited" && contact.invitedAt && !contact.acceptedAt) {
    const due = addDays(dayOf(contact.invitedAt), 21);
    return today >= due ? { kind: "withdraw", day: due } : null;
  }
  if (contact.status !== "messaged" || !contact.messagedAt || contact.followUpSent) return null;
  const sent = dayOf(contact.messagedAt);
  const follow = addBusinessDays(sent, 7);
  if (today >= follow) return { kind: "follow_up", day: follow };
  const second = addBusinessDays(sent, 3);
  return today >= second && !contact.secondPersonSuggested ? { kind: "second_person", day: second } : null;
}

/** Always display the denominator; rates are withheld for small samples. */
export function replySummary(replied: number, eligible: number): string {
  return eligible < 5 ? `${replied} of ${eligible}` : `${replied} of ${eligible} (${Math.round(replied / eligible * 100)}%)`;
}

// ---------------------------------------------------------------------------------------------
// Next-step rules (build plan KD12, KTD16, R42, R43). Pure: nothing here reads or writes the database.
// ---------------------------------------------------------------------------------------------

/** D-O2's timings, the lead's defaults until the owner answers. Business days skip weekends (IST); days are calendar days. */
export const TIMINGS = {
  secondPersonBusinessDays: 3, // after a message
  followUpBusinessDays: 7, // after a message
  closeBusinessDays: 7, // after the follow-up
  withdrawDays: 21, // after an invite
  thankYouBusinessDays: 1, // after a meeting
  rescheduleBusinessDays: 1, // after a no-show
  actOnItDays: 7,
  checkInUsefulDays: 28,
  checkInOkDays: 42,
  referralAskDays: 7,
} as const;

type Ev = TimelineEvent;
type Ops = Array<InsertOp | SupersedeOp>;
type Rating = "good" | "neutral" | "bad";

const day = (d: Date) => todayIST(d);
/** A suggested step is due at the person's outreach time on its day. */
const dueOn = (d: string) => istToUTC(d, DEFAULT_TIMES.message);

/**
 * Everything the timeline should suggest or withdraw, given the contact's whole timeline (superseded events
 * included). It is a function of its inputs only, so running it again over its own results returns nothing.
 *
 * Questions come first (R42): a suggested second_person, follow_up, closed or withdraw step carries a rule
 * that opens with "Did ... reply?" or "Accepted?". "Yes" is a record (reply, accepted) which supersedes the step;
 * "No" reveals the step and leaves it due. Nothing closes or withdraws without a tap (KD13).
 */
export function suggest(contact: Pick<Contact, "id" | "name">, events: TimelineEvent[], now: Date): Ops {
  void now; // dates come from the events that cause a step, never from the clock, so a late record gives the same dates
  const ops: Ops = [];
  const byId = new Map(events.map((e) => [e.id, e]));
  const live = events.filter((e) => e.status !== "superseded");
  const dropped = new Set<string>();
  const drop = (e: Ev, reason: SupersededReason) => {
    if (dropped.has(e.id)) return;
    dropped.add(e.id);
    ops.push({ type: "supersede", eventId: e.id, reason });
  };
  const doneOf = (...kinds: EventKind[]) => live.filter((e) => e.status === "done" && e.doneAt && kinds.includes(e.kind))
    .sort((a, b) => a.doneAt!.getTime() - b.doneAt!.getTime() || a.createdAt.getTime() - b.createdAt.getTime());
  const latest = (kind: EventKind) => doneOf(kind).at(-1);
  const sinceDay = (kind: EventKind, from: string) => doneOf(kind).some((e) => day(e.doneAt!) >= from);
  const pending = () => live.filter((e) => e.status === "due" && !dropped.has(e.id));

  // Goal reached or closed finishes the contact: everything still due goes (R46).
  if (doneOf("goal_reached", "closed").length) {
    for (const e of pending()) drop(e, "finished");
    return ops;
  }

  const CHAIN: EventKind[] = ["second_person", "follow_up", "withdraw", "closed"];
  for (const e of pending()) {
    const trigger = e.triggerId ? byId.get(e.triggerId) : undefined;
    // Undoing (or moving) the event that caused a step takes the step with it.
    if (trigger?.status === "superseded") { drop(e, trigger.supersededReason === "moved" ? "moved" : "undone"); continue; }
    if (!trigger?.doneAt) continue;
    const from = day(trigger.doneAt);
    // A reply ends the waiting: no second person, follow-up, close or withdraw is needed.
    if (CHAIN.includes(e.kind) && sinceDay("reply", from)) { drop(e, "reply"); continue; }
    // Accepted (or a message, which needs a connection) answers the 21-day question.
    if (e.kind === "withdraw" && (sinceDay("accepted", from) || sinceDay("message_sent", from))) { drop(e, "finished"); continue; }
    // Only the latest cause keeps its steps: a newer message or invite replaces the older one's.
    if (CHAIN.includes(e.kind) && latest(trigger.kind) && latest(trigger.kind)!.id !== trigger.id) { drop(e, "finished"); continue; }
    // The step was done without using the suggestion.
    if (sinceDay(e.kind, from) && e.kind !== "closed" && e.kind !== "withdraw") { drop(e, "finished"); continue; }
  }

  const name = contact.name;
  // Creates a step once per cause. A step that exists in any status (done, moved, dismissed) is never created again.
  const make = (kind: EventKind, trigger: Ev, onDay: string, rule: string) => {
    if (events.some((e) => e.kind === kind && e.triggerId === trigger.id)) return;
    ops.push({ type: "insert", opId: `sg:${kind}:${trigger.id}`, contactId: contact.id, kind, status: "due", dueAt: dueOn(onDay), rule, triggerId: trigger.id });
  };

  // Invite with no acceptance after 21 days (R42).
  const inv = latest("invite_sent");
  if (inv) {
    const from = day(inv.doneAt!);
    if (!sinceDay("accepted", from) && !sinceDay("message_sent", from) && !sinceDay("reply", from)) {
      make("withdraw", inv, addDays(from, TIMINGS.withdrawDays),
        `No acceptance recorded from ${name} in ${TIMINGS.withdrawDays} days. Accepted? If not, withdraw the invite.`);
    }
  }

  // After a message: second person at 3 business days, one follow-up at 7 (R42).
  const msg = latest("message_sent");
  const replied = msg ? sinceDay("reply", day(msg.doneAt!)) : false;
  if (msg && !replied) {
    const from = day(msg.doneAt!);
    if (!sinceDay("second_person", from)) {
      make("second_person", msg, addBusinessDays(from, TIMINGS.secondPersonBusinessDays),
        `No reply recorded from ${name} in ${TIMINGS.secondPersonBusinessDays} business days. Did ${name} reply? If not, find a second person at the same company.`);
    }
    if (!sinceDay("follow_up", from)) {
      make("follow_up", msg, addBusinessDays(from, TIMINGS.followUpBusinessDays),
        `No reply recorded from ${name} in ${TIMINGS.followUpBusinessDays} business days. Did ${name} reply? If not, send one follow-up.`);
    }
    // The close question follows the follow-up that was sent, not one made after a meeting.
    const fu = doneOf("follow_up").filter((e) => day(e.doneAt!) >= from && byId.get(e.triggerId ?? "")?.kind !== "meeting_done").at(-1);
    if (fu) {
      make("closed", fu, addBusinessDays(day(fu.doneAt!), TIMINGS.closeBusinessDays),
        `No reply recorded from ${name} in ${TIMINGS.closeBusinessDays} business days since your follow-up. Did ${name} reply? If not, Close: no response.`);
    }
  }

  // After a meeting (R43): the thank-you, or the reschedule message after a no-show, the next business day.
  for (const md of doneOf("meeting_done")) {
    const from = day(md.doneAt!);
    if (md.happened === "yes") {
      make("thank_you", md, addBusinessDays(from, TIMINGS.thankYouBusinessDays),
        `You met ${name}${md.rating ? ` (${RATING_WORD[md.rating]})` : ""}. Send a thank-you note the next business day.`);
    } else if (md.happened === "no_show") {
      make("reschedule", md, addBusinessDays(from, TIMINGS.rescheduleBusinessDays),
        `No-show: ${name} didn't make the meeting. Send a short message the next business day to reschedule.`);
    }
  }
  return ops;
}

const RATING_WORD: Record<Rating, string> = { good: "Useful", neutral: "OK", bad: "Not useful" };

export type StepChoice = "thank_you" | "act_on_it" | "check_in" | "referral_ask" | "reschedule" | "close";
export type NextStep = {
  choice: StepChoice; kind: EventKind; label: string;
  /** The step R43 recommends; exactly one per answer. It is also the one `suggest` creates on its own. */
  recommended: boolean;
  /** When the step is due. `null` for Close, which is a record taken at once, not a dated step. */
  dueAt: Date | null;
  rule: string;
};

/**
 * The "What's next?" choices after a meeting (R43), and whether "Goal reached" starts ticked (R40).
 * Keyed by how it went (no rating counts as OK) and the contact's goal. `at` is when the answer was given.
 * Choosing a step other than the recommended one becomes a due event with `triggerId` of the meeting answer.
 */
export function afterMeeting(goal: string, input: { happened: "yes" | "no_show" | "moved"; rating?: Rating | null; at: Date }): { steps: NextStep[]; goalReachedPreticked: boolean } {
  if (input.happened === "moved") return { steps: [], goalReachedPreticked: false };
  const from = day(input.at);
  const bd = (n: number) => dueOn(addBusinessDays(from, n));
  const cal = (n: number) => dueOn(addDays(from, n));
  const step = (choice: StepChoice, kind: EventKind, label: string, dueAt: Date | null, rule: string, recommended = false): NextStep => ({ choice, kind, label, recommended, dueAt, rule });
  const close = step("close", "closed", "Close", null, "Nothing more to do with this person.");
  if (input.happened === "no_show") {
    return { steps: [step("reschedule", "reschedule", "Send a short message to reschedule", bd(TIMINGS.rescheduleBusinessDays), "The meeting didn't happen. Send a short message the next business day to reschedule.", true), close], goalReachedPreticked: false };
  }
  const rating: Rating = input.rating ?? "neutral";
  const thanks = step("thank_you", "thank_you", "Send a thank-you note", bd(TIMINGS.thankYouBusinessDays), "Send a thank-you note the next business day.", true);
  const steps: NextStep[] = [thanks];
  if (rating === "good") {
    steps.push(step("act_on_it", "follow_up", "Act on what they suggested", cal(TIMINGS.actOnItDays), `Act on what they suggested within ${TIMINGS.actOnItDays} days.`));
    steps.push(step("check_in", "check_in", "Check in later", cal(TIMINGS.checkInUsefulDays), `Check in ${TIMINGS.checkInUsefulDays / 7} weeks after a useful meeting.`));
    if (allowsReferralAsk(goal)) steps.push(step("referral_ask", "referral_ask", "Ask for a referral", cal(TIMINGS.referralAskDays), "A useful meeting is a good moment to ask about a referral."));
  } else if (rating === "neutral") {
    steps.push(step("check_in", "check_in", "Check in later", cal(TIMINGS.checkInOkDays), `Check in ${TIMINGS.checkInOkDays / 7} weeks after the meeting.`), close);
  } else steps.push(close);
  return { steps, goalReachedPreticked: recordMeetsGoal(goal, { kind: "meeting_done", happened: "yes", rating }) };
}

export type RateRow = {
  contact: { goal: string; messagedAt: Date | null; repliedAt: Date | null; goalReachedAt: Date | null };
  events: TimelineEvent[];
};
export type GoalRates = {
  goal: string;
  /** People who were messaged or replied. The denominator of every rate. */
  contacted: number; replied: number; meetings: number; goalReached: number;
  /** "2 of 3" below 5 people, "2 of 5 (40%)" from 5. */
  reply: string; meeting: string; goalReachedRate: string;
};

/** R28 by goal: replies, meetings that happened, and goals reached, each with the counts behind it. Goals are listed most-contacted first. */
export function ratesByGoal(rows: readonly RateRow[]): GoalRates[] {
  const groups = new Map<string, { contacted: number; replied: number; meetings: number; goalReached: number }>();
  for (const { contact, events } of rows) {
    if (!contact.messagedAt && !contact.repliedAt) continue;
    const g = groups.get(contact.goal) ?? { contacted: 0, replied: 0, meetings: 0, goalReached: 0 };
    g.contacted++;
    if (contact.repliedAt) g.replied++;
    if (events.some((e) => e.kind === "meeting_done" && e.status === "done" && e.happened === "yes")) g.meetings++;
    if (contact.goalReachedAt) g.goalReached++;
    groups.set(contact.goal, g);
  }
  return [...groups.entries()].sort((a, b) => b[1].contacted - a[1].contacted || a[0].localeCompare(b[0])).map(([goal, g]) => ({
    goal, ...g, reply: replySummary(g.replied, g.contacted), meeting: replySummary(g.meetings, g.contacted), goalReachedRate: replySummary(g.goalReached, g.contacted),
  }));
}
