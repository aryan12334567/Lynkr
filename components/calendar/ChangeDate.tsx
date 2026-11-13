"use client";

import { useEffect, useRef, useState } from "react";
import { dateProblem } from "@/lib/calendar/grid";
import type { FeedItem } from "@/lib/calendar/types";
import { Button, inputCls } from "../ui";

/**
 * "Change date" (calendar plan KTD7): a modal with a date and a time, both IST. Focus starts on the date, Esc closes and
 * hands focus back to the chip, a past time is refused here before anything is sent, and Save waits while a request runs.
 */
export function ChangeDate({
  item, today, onSave, onClose,
}: {
  item: FeedItem;
  today: string;
  /** Resolves to null when saved, or the reason it was refused. */
  onSave: (day: string, time: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const [day, setDay] = useState(item.day);
  const [time, setTime] = useState(item.time);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    dateRef.current?.focus();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const p = dateProblem(day, time, today, new Date(Date.now() + 330 * 60_000).toISOString().slice(11, 16));
    if (p) { setProblem(p); return; }
    setBusy(true);
    const refused = await onSave(day, time);
    setBusy(false);
    if (refused) setProblem(refused);
    else onClose();
  }

  return (
    <dialog ref={ref} aria-labelledby="change-date-title" onClose={onClose} className="w-[min(92vw,22rem)] rounded-2xl border border-line bg-surface p-5 text-ink shadow-lg backdrop:bg-black/30">
      <form onSubmit={save} noValidate>
        <h4 id="change-date-title" className="font-semibold">Change date</h4>
        <p className="mt-1 text-sm text-soft">{item.title}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="text-sm text-soft">
            Date
            <input ref={dateRef} type="date" required min={today} value={day} onChange={(e) => { setDay(e.target.value); setProblem(null); }} className={`${inputCls} mt-1 py-1`} />
          </label>
          <label className="text-sm text-soft">
            Time (IST)
            <input type="time" required value={time} onChange={(e) => { setTime(e.target.value); setProblem(null); }} className={`${inputCls} mt-1 py-1`} />
          </label>
        </div>
        {problem && <p role="alert" className="mt-2 text-sm text-bad">{problem}</p>}
        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </dialog>
  );
}
