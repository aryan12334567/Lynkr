"use client";

import { useId, useMemo, useRef, useState } from "react";
import { todayIST } from "@/lib/ist";
import { goalSuccess } from "@/lib/outreach/ui-goals";
import { HAPPENED_OPTIONS, NOTE_HINT, RATING_OPTIONS, answerMeeting, formState, initialForm, nextChoices, onHappened, onRating, type MeetingForm } from "@/lib/outreach/ui-meeting";
import { useRecorder } from "@/lib/outreach/ui-recorder";
import { NOTE_MAX, clockTime, newOpId, noteCount, shortDate, type Send, type TimelineResult, type UiEvent } from "@/lib/outreach/ui-timeline";
import { Button, ErrorNote, inputCls } from "../ui";

function Radio({ name, value, checked, onChange, children, hint }: { name: string; value: string; checked: boolean; onChange: () => void; children: React.ReactNode; hint?: string }) {
  return (
    <label className={`flex min-h-10 cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${checked ? "border-accent bg-accent-wash" : "border-line bg-surface"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1 h-5 w-5 shrink-0" />
      <span><span className="block">{children}</span>{hint && <span className="block text-[0.85rem] text-soft">{hint}</span>}</span>
    </label>
  );
}

/**
 * Shown when a booked meeting is more than an hour past (R41). Nothing is pushed: it waits until you open Lynkr.
 * The first answer is required; the rest is optional. Also used compactly in the Monday to-do and Today.
 */
export function MeetingCard({ contactId, name, goal, booked, send, onResult, onLater, canRecord = true, onLapsed, compact = false }: {
  contactId: string;
  name: string;
  goal: string;
  /** The booked-meeting event waiting for an answer. */
  booked: Pick<UiEvent, "id" | "meetingAt">;
  send: Send;
  onResult: (r: TimelineResult) => void;
  onLater: () => void;
  canRecord?: boolean;
  onLapsed?: () => void;
  compact?: boolean;
}) {
  const ids = useId();
  const [form, setForm] = useState<MeetingForm>(initialForm);
  const baseOp = useRef(newOpId());
  const now = useMemo(() => new Date(), []);
  const today = todayIST(now);
  const rec = useRecorder(onResult, onLapsed);
  const state = formState(form, goal, today);
  const steps = nextChoices(goal, form, now);
  const over = form.note.length > NOTE_MAX;
  const when = booked.meetingAt ? `${shortDate(booked.meetingAt)}, ${clockTime(booked.meetingAt)} IST` : "";
  const set = (patch: Partial<MeetingForm>) => setForm((f) => ({ ...f, ...patch }));

  function save() {
    if (!state.canSave) return;
    const ctx = { contactId, goal, bookedEventId: booked.id, form, baseOp: baseOp.current, now };
    void rec.run(() => answerMeeting(send, ctx));
  }

  return (
    <section aria-labelledby={`${ids}-h`} className={`rounded-xl border-2 border-accent/60 bg-surface p-4 ${compact ? "" : "sm:p-5"}`}>
      <h3 id={`${ids}-h`} className="text-lg font-bold">Did your meeting with {name} happen?</h3>
      {when && <p className="text-[0.92rem] text-soft">It was planned for {when}.</p>}

      <fieldset className="mt-3" disabled={!canRecord || rec.busy}>
        <legend className="mb-1 text-[0.95rem] font-medium">Did it happen? <span className="font-normal text-soft">(required)</span></legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {HAPPENED_OPTIONS.map((o) => (
            <Radio key={o.value} name={`${ids}-happened`} value={o.value} checked={form.happened === o.value} onChange={() => setForm((f) => onHappened(f, o.value, goal, now))}>{o.label}</Radio>
          ))}
        </div>
      </fieldset>

      {form.happened === "moved" && (
        <fieldset className="mt-3" disabled={!canRecord || rec.busy}>
          <legend className="mb-1 text-[0.95rem] font-medium">New day and time (India time)</legend>
          <div className="flex flex-wrap gap-3">
            <label className="block"><span className="mb-1 block text-[0.9rem]">Day</span><input type="date" className={inputCls} min={today} value={form.movedDay} onChange={(e) => set({ movedDay: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-[0.9rem]">Time</span><input type="time" className={inputCls} value={form.movedTime} onChange={(e) => set({ movedTime: e.target.value })} /></label>
          </div>
          <p className="mt-1 text-[0.85rem] text-soft">The new time replaces the old one. This card comes back after it.</p>
        </fieldset>
      )}

      {form.happened === "yes" && (
        <fieldset className="mt-3" disabled={!canRecord || rec.busy}>
          <legend className="mb-1 text-[0.95rem] font-medium">How was it? <span className="font-normal text-soft">(optional)</span></legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {RATING_OPTIONS.map((o) => (
              <Radio key={o.value} name={`${ids}-rating`} value={o.value} checked={form.rating === o.value} onChange={() => setForm((f) => onRating(f, o.value, goal, now))}>{o.label}</Radio>
            ))}
          </div>
        </fieldset>
      )}

      {steps.length > 0 && (
        <fieldset className="mt-3" disabled={!canRecord || rec.busy}>
          <legend className="mb-1 text-[0.95rem] font-medium">What&apos;s next?</legend>
          <div className="space-y-2">
            {steps.map((s) => (
              <Radio key={s.choice} name={`${ids}-next`} value={s.choice} checked={form.next === s.choice} onChange={() => set({ next: s.choice })}
                hint={`${s.dueAt ? `Due ${shortDate(s.dueAt.toISOString())}. ` : ""}${s.recommended ? "Recommended." : ""}`.trim() || undefined}>
                {s.label}
              </Radio>
            ))}
          </div>
        </fieldset>
      )}

      {form.happened === "yes" && (
        <label className="mt-3 flex min-h-10 items-start gap-2">
          <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={form.goalReached} onChange={(e) => set({ goalReached: e.target.checked })} disabled={!canRecord || rec.busy} />
          <span>Goal reached{goalSuccess(goal) ? `: ${goalSuccess(goal)}` : ""}<span className="block text-[0.85rem] text-soft">Ticking this finishes {name}&apos;s timeline.</span></span>
        </label>
      )}

      <div className="mt-3">
        <label htmlFor={`${ids}-note`} className="mb-1 block text-[0.95rem] font-medium">A note for yourself <span className="font-normal text-soft">(optional)</span></label>
        <textarea id={`${ids}-note`} className={`${inputCls} min-h-20`} value={form.note} aria-describedby={`${ids}-hint ${ids}-count`} aria-invalid={over || undefined}
          onChange={(e) => set({ note: e.target.value })} disabled={!canRecord || rec.busy} />
        <div className="mt-1 flex flex-wrap justify-between gap-2 text-[0.85rem]">
          <span id={`${ids}-hint`} className="text-soft">{NOTE_HINT}. Only you see this note.</span>
          <span id={`${ids}-count`} className={over ? "font-medium text-bad" : "text-soft"}>{noteCount(form.note)}</span>
        </div>
        {over && <p role="alert" className="mt-1 text-[0.9rem] text-bad">Keep the note to {NOTE_MAX} characters or fewer.</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
        {canRecord ? <Button disabled={!state.canSave || rec.busy} onClick={save}>{rec.busy ? "Saving" : "Save answer"}</Button> : <p className="text-[0.92rem] text-soft">Subscribe to record steps</p>}
        <Button variant="quiet" onClick={onLater} disabled={rec.busy}>Later</Button>
        {canRecord && !state.canSave && form.happened === null && <span className="text-[0.88rem] text-soft">Say whether it happened to save.</span>}
        {canRecord && form.happened !== null && state.problems.filter((p) => !p.startsWith("Keep the note")).map((p) => <span key={p} className="text-[0.88rem] text-soft">{p}</span>)}
      </div>
      {rec.failed && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ErrorNote message={rec.failed} />
          <Button variant="ghost" onClick={() => void rec.retry()} disabled={rec.busy}>Retry</Button>
        </div>
      )}
    </section>
  );
}
