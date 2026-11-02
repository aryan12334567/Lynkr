"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadLicense } from "@/lib/store";
import type { CalendarItem, TodoItem } from "@/lib/outreach/calendar";
import {
  ALL_CAUGHT_UP, GROUP_HEADING, KIND_LABEL, answersFor, bodyFor, dueNow, isQuestion, questionFor, recordError, withoutAnswered,
} from "@/lib/outreach/ui-today";
import { formatDay, todayIST } from "@/lib/ist";

type Row = CalendarItem & Partial<Pick<TodoItem, "group" | "overdue">>;

function headers(json = false): Record<string, string> {
  const license = loadLicense();
  return { ...(json ? { "Content-Type": "application/json" } : {}), ...(license ? { "x-lynkr-license": license.key, "x-lynkr-instance": license.instanceId } : {}) };
}

/** Loads a list of owed outreach items and lets one be answered in place. `read` returns the items for this view. */
function useOwed(read: () => Promise<Row[]>, onCount?: (n: number) => void) {
  const [items, setItems] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const answered = useRef(new Set<string>());
  const count = useRef(onCount);
  count.current = onCount;
  const load = useCallback(async () => {
    try {
      const next = withoutAnswered(await read(), answered.current);
      setItems(next);
      setFailed(false);
      count.current?.(next.length);
    } catch {
      setFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void load(); }, [load]);
  /** Takes the item off the list at once, then reloads so steps the record changed (a reply ends the waiting) are right. */
  const finish = (id: string) => {
    answered.current.add(id);
    setItems((cur) => {
      const next = withoutAnswered(cur ?? [], answered.current);
      count.current?.(next.length);
      return next;
    });
    void load();
  };
  return { items, failed, finish, retry: load };
}

/** The Monday to-do (R45): meetings with an unanswered card, then "did they reply / accept?", then due steps. */
export function MondayTodo({ onCount }: { onCount?: (n: number) => void }) {
  const o = useOwed(async () => {
    const res = await fetch("/api/outreach/todo", { headers: headers() });
    if (!res.ok) throw new Error("todo");
    return ((await res.json()) as { items: TodoItem[] }).items;
  }, onCount);
  return <OwedList title="Your Monday to-do" owed={o} grouped />;
}

/** Any other day: whatever is due today or overdue, from the calendar feed. */
export function DueToday({ onCount }: { onCount?: (n: number) => void }) {
  const o = useOwed(async () => {
    const res = await fetch("/api/outreach/calendar", { headers: headers() });
    if (!res.ok) throw new Error("calendar");
    return dueNow(((await res.json()) as { items: CalendarItem[] }).items);
  }, onCount);
  return <OwedList title="Outreach due" owed={o} />;
}

function OwedList({ title, owed, grouped = false }: { title: string; owed: ReturnType<typeof useOwed>; grouped?: boolean }) {
  const { items, failed, finish, retry } = owed;
  const groups: Array<{ heading: string | null; rows: Row[] }> = [];
  for (const it of items ?? []) {
    const heading = grouped && it.group ? GROUP_HEADING[it.group] : null;
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.rows.push(it);
    else groups.push({ heading, rows: [it] });
  }
  return (
    <section aria-labelledby="owed-title" data-testid="outreach-owed">
      <h3 id="owed-title" className="text-lg font-bold">{title}</h3>
      {failed && !items ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line p-5 text-[0.95rem] text-soft" role="status">
          Could not load your outreach steps.{" "}
          <button className="font-medium text-accent underline" onClick={() => void retry()}>Try again</button>
        </p>
      ) : items === null ? (
        <p className="mt-3 text-[0.95rem] text-soft" role="status">Loading...</p>
      ) : items.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line p-5 text-[0.95rem] text-soft" role="status">{ALL_CAUGHT_UP}</p>
      ) : (
        groups.map((g, i) => (
          <div key={g.heading ?? i} className="mt-3">
            {g.heading && <h4 className="mb-2 text-[0.85rem] font-bold uppercase tracking-wide text-soft">{g.heading}</h4>}
            <ul className="space-y-2">
              {g.rows.map((it) => <OwedRow key={it.id} item={it} onAnswered={() => finish(it.id)} />)}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function OwedRow({ item, onAnswered }: { item: Row; onAnswered: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const day = todayIST(new Date(item.at));
  const question = questionFor(item);
  const late = day < todayIST();

  async function answer(id: string) {
    if (id === "no") { setRevealed(true); return; }
    const body = bodyFor(item, id);
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      // The op_id is the same for this item and answer, so a retry replays the first record instead of adding another.
      const res = await fetch("/api/outreach/timeline", { method: "POST", headers: headers(true), body: JSON.stringify(body) });
      if (!res.ok) { setError(recordError(res.status)); return; }
      onAnswered();
    } catch {
      setError(recordError(0));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-line bg-surface px-4 py-3 shadow-sm" data-item={item.id}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-bold">{item.person}</span>
        <span className="text-[0.85rem] text-soft">{KIND_LABEL[item.kind]}</span>
        <span className={`ml-auto text-[0.85rem] ${late ? "text-bad" : "text-faint"}`}>{late ? `Due ${formatDay(day)}` : "Due today"}</span>
      </div>
      {item.kind === "meeting" ? (
        <p className="mt-1 text-[0.95rem]">Did the meeting happen?</p>
      ) : isQuestion(item) && !revealed ? (
        <p className="mt-1 text-[0.95rem]">{question}</p>
      ) : (
        <p className="mt-1 text-[0.95rem] text-soft">{item.rule ?? `${KIND_LABEL[item.kind]} is due.`}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Answer for ${item.person}`}>
        {answersFor(item, revealed).map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={busy}
            onClick={() => void answer(a.id)}
            className={`min-h-10 rounded-md px-3 py-2 text-[0.9rem] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 ${
              a.tone === "primary" ? "bg-accent text-bg hover:bg-accent-strong" : a.tone === "quiet" ? "text-soft hover:bg-muted" : "border border-line bg-surface hover:border-accent/50"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-[0.85rem] text-bad" role="alert">{error}</p>}
    </li>
  );
}
