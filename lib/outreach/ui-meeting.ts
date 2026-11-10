// The meeting card (R41, R43). The rules for the next step come from followup.ts; this file only turns the answers into taps.
import { afterMeeting, type NextStep, type StepChoice } from "./followup";
import type { Happened, Rating } from "./timeline";
import { NOTE_MAX, noteProblem, moveDateProblem, type Send, type TimelineResult } from "./ui-timeline";

export const HAPPENED_OPTIONS: readonly { value: Happened; label: string }[] = [
  { value: "yes", label: "Yes" }, { value: "no_show", label: "No-show" }, { value: "moved", label: "Moved" },
];
export const RATING_OPTIONS: readonly { value: Rating; label: string }[] = [
  { value: "good", label: "Useful" }, { value: "neutral", label: "OK" }, { value: "bad", label: "Not useful" },
];
export const NOTE_HINT = "Skip health, money, family or ID details";

export type MeetingForm = {
  happened: Happened | null; movedDay: string; movedTime: string; rating: Rating | null;
  next: StepChoice | null; goalReached: boolean; note: string;
};
export const initialForm = (): MeetingForm => ({ happened: null, movedDay: "", movedTime: "", rating: null, next: null, goalReached: false, note: "" });

/** The "What's next?" choices for the answers so far. Empty until the first question is answered, and for Moved. */
export function nextChoices(goal: string, form: Pick<MeetingForm, "happened" | "rating">, at: Date): NextStep[] {
  if (!form.happened || form.happened === "moved") return [];
  return afterMeeting(goal, { happened: form.happened, rating: form.rating, at }).steps;
}
const recommendedOf = (goal: string, form: Pick<MeetingForm, "happened" | "rating">, at: Date): StepChoice | null => nextChoices(goal, form, at).find((s) => s.recommended)?.choice ?? null;
const goalDefault = (goal: string, form: Pick<MeetingForm, "happened" | "rating">, at: Date): boolean =>
  form.happened && form.happened !== "moved" ? afterMeeting(goal, { happened: form.happened, rating: form.rating, at }).goalReachedPreticked : false;

/** The first answer: the recommended next step starts selected. A rating is cleared when there was no meeting. */
export function onHappened(form: MeetingForm, happened: Happened, goal: string, at: Date): MeetingForm {
  const next = { ...form, happened, rating: happened === "yes" ? form.rating : null };
  return { ...next, next: recommendedOf(goal, next, at), goalReached: goalDefault(goal, next, at) };
}
/** How it went: the recommended step and the Goal reached tick follow the rating (a person can untick it). */
export function onRating(form: MeetingForm, rating: Rating | null, goal: string, at: Date): MeetingForm {
  const next = { ...form, rating };
  const choices = nextChoices(goal, next, at);
  return { ...next, next: choices.some((s) => s.choice === form.next) && form.next !== recommendedOf(goal, form, at) ? form.next : recommendedOf(goal, next, at), goalReached: goalDefault(goal, next, at) };
}

export function formState(form: MeetingForm, goal: string, today: string): { canSave: boolean; problems: string[] } {
  void goal;
  const problems: string[] = [];
  if (!form.happened) problems.push("Say whether the meeting happened.");
  if (form.happened === "moved") {
    if (!form.movedDay || !form.movedTime) problems.push("Pick the new day and time.");
    else { const p = moveDateProblem(form.movedDay, today); if (p) problems.push(p); }
  }
  const note = noteProblem(form.note);
  if (note) problems.push(note);
  return { canSave: problems.length === 0, problems };
}
export { NOTE_MAX };

/**
 * Saves the answers. Every tap has an id built from `baseOp`, so running it again after a failure repeats what already
 * worked as a no-op and finishes the rest: the person never gets a second thank-you.
 */
export async function answerMeeting(send: Send, c: { contactId: string; goal: string; bookedEventId: string; form: MeetingForm; baseOp: string; now: Date }): Promise<TimelineResult> {
  const { form, contactId } = c;
  if (!form.happened) throw new Error("Say whether the meeting happened.");
  if (form.happened === "moved") {
    return send({ route: "calendar", contactId, body: { op_id: `${c.baseOp}:move`, id: c.bookedEventId, day: form.movedDay, time: form.movedTime } });
  }
  const note = form.note.trim();
  let last = await send({
    route: "timeline", contactId,
    body: { type: "insert", op_id: `${c.baseOp}:done`, contactId, kind: "meeting_done", status: "done", happened: form.happened, ...(form.happened === "yes" && form.rating ? { rating: form.rating } : {}), ...(note ? { note } : {}) },
  });
  const answered = last.event!;
  const chosen = nextChoices(c.goal, form, c.now).find((s) => s.choice === form.next);
  if (chosen && !chosen.recommended) {
    last = await send({
      route: "timeline", contactId,
      body: chosen.choice === "close"
        ? { type: "insert", op_id: `${c.baseOp}:close`, contactId, kind: "closed", status: "done" }
        : { type: "insert", op_id: `${c.baseOp}:next`, contactId, kind: chosen.kind, status: "due", dueAt: chosen.dueAt!.toISOString(), rule: chosen.rule, triggerId: answered.id },
    });
  }
  if (form.goalReached) last = await send({ route: "timeline", contactId, body: { type: "insert", op_id: `${c.baseOp}:goal`, contactId, kind: "goal_reached", status: "done" } });
  return { ...last, event: answered };
}
