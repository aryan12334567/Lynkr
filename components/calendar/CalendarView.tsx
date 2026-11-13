"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { downloadIcs } from "@/lib/ics";
import { dueReminders, weekEvents } from "@/lib/calendar/reminders";
import { Button } from "../ui";
import { monthCells, monthLabel } from "@/lib/calendar/grid";
import type { FeedItem } from "@/lib/calendar/types";
import { addDays, formatDay, mondayOf, todayIST } from "@/lib/ist";
import { MondayTodo } from "../outreach/MondayTodo";
import { ChangeDate } from "./ChangeDate";
import { DayList, MonthGrid, WeekGrid } from "./grids";
import { UndoBar } from "./UndoBar";
import { useFeed } from "./useFeed";

const SOURCE_WORDS: Record<string, string> = { posts: "Posts", outreach: "Outreach", comments: "Comments", plan: "Your plan" };

/**
 * The Calendar for a signed-in person (calendar plan U5, R1 to R5, R14 to R17). It shows one list from the feed as a week
 * grid, a month grid, or a day list on phones, and sends every move back through the feed's move route. When the feed
 * cannot be had at all (no database, the switch off), it renders `fallback`, today's week screen, so nothing is lost.
 */
export function CalendarView({ enabled, fallback, onActive }: { enabled: boolean; fallback: React.ReactNode; onActive?: (on: boolean) => void }) {
  const today = todayIST();
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(today);
  const [chosen, setChosen] = useState(today);
  const [editing, setEditing] = useState<{ item: FeedItem } | null>(null);
  const [gate, setGate] = useState<FeedItem | null>(null);

  const monday = mondayOf(anchor);
  const range = useMemo(() => {
    if (view === "week") return { from: monday, to: addDays(monday, 6) };
    const { days } = monthCells(anchor);
    return { from: days[0], to: days[days.length - 1] };
  }, [view, anchor, monday]);
  const f = useFeed({ enabled, ...range });
  const [notify, setNotify] = useState(false);
  const [notifyNote, setNotifyNote] = useState<string | null>(null);
  const shown = useRef(new Set<string>());
  const feedItems = f.feed?.items;
  const active = !!f.feed;
  useEffect(() => { onActive?.(active); }, [active, onActive]);

  // In-tab reminders (R20): a browser notification when an open item's time arrives, once. Only while this tab is open.
  useEffect(() => {
    if (!notify || !feedItems) return;
    const tick = () => {
      for (const it of dueReminders(feedItems, Date.now(), shown.current)) {
        try {
          // Some browsers (Chrome on Android) refuse the constructor: say so instead of failing the screen.
          new Notification(`Lynkr: ${it.title}`, { body: "Open Lynkr, then do it yourself on LinkedIn." });
          shown.current.add(it.id);
        } catch {
          setNotify(false);
          setNotifyNote("This browser can't show reminders here. Use the calendar file instead.");
          return;
        }
      }
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [notify, feedItems]);

  async function enableNotify() {
    if (typeof Notification === "undefined") { setNotifyNote("This browser can't show notifications. Use the calendar file instead."); return; }
    const perm = await Notification.requestPermission();
    if (perm === "granted") { setNotify(true); setNotifyNote(null); } else setNotifyNote("Notifications are blocked. Use the calendar file instead.");
  }

  if (!enabled || f.failed) return <>{fallback}</>;

  const items = f.feed?.items ?? [];
  const open = (item: FeedItem) => {
    if (!f.feed?.paid && item.gated) { setGate(item); return; }
    setGate(null);
    window.location.hash = item.href;
  };
  const props = {
    items, today, problems: f.problems, moving: f.moving, onOpen: open,
    onChangeDate: (item: FeedItem) => { setEditing({ item }); },
    onDrop: (item: FeedItem, day: string) => { void f.move(item, day); },
  };
  const shiftWeek = (d: number) => { const next = addDays(monday, 7 * d); setAnchor(next); setChosen(next); };
  const shiftMonth = (d: number) => { const [y, m] = anchor.split("-").map(Number); setAnchor(new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 10)); };
  const openDay = (day: string) => { setAnchor(day); setChosen(day); setView("week"); };
  const down = f.feed ? (Object.entries(f.feed.sources).filter(([, v]) => v === "unavailable").map(([k]) => SOURCE_WORDS[k] ?? k)) : [];
  const showTodo = !!f.feed?.paid && today === mondayOf(today) && f.feed.sources.outreach === "ok" && items.some((i) => i.owner === "outreach");

  return (
    <div className="space-y-4" data-calendar-view>
      {showTodo && <MondayTodo />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="tablist" aria-label="Calendar view">
          {(["week", "month"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 text-sm ${view === v ? "bg-ink text-bg" : "text-soft hover:bg-muted"}`}>
              {v === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button className="min-h-9 rounded px-2 hover:bg-muted max-sm:hidden" onClick={() => (view === "week" ? shiftWeek(-1) : shiftMonth(-1))} aria-label={view === "week" ? "Previous week" : "Previous month"}>←</button>
          <span className="text-soft">{view === "week" ? `Week of ${formatDay(monday)}` : monthLabel(anchor)}</span>
          <button className="min-h-9 rounded px-2 hover:bg-muted max-sm:hidden" onClick={() => (view === "week" ? shiftWeek(1) : shiftMonth(1))} aria-label={view === "week" ? "Next week" : "Next month"}>→</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" disabled={!feedItems || weekEvents(feedItems).length === 0} onClick={() => feedItems && downloadIcs(`lynkr-${view === "week" ? monday : range.from}.ics`, weekEvents(feedItems))}>
          Download {view === "week" ? "week" : "month"} (.ics)
        </Button>
        {!notify && <Button variant="ghost" onClick={() => void enableNotify()}>Remind me in this tab</Button>}
        {notify && <span className="text-xs text-good">Reminders on while this tab stays open.</span>}
        {notifyNote && <span role="alert" className="text-xs text-bad">{notifyNote}</span>}
      </div>

      <UndoBar undo={f.undo} onUndo={() => void f.undoLast()} />
      {down.map((name) => <p key={name} role="status" className="text-sm text-warn">{name} couldn&apos;t load.</p>)}

      {gate && (
        <div role="region" aria-label="Subscription needed" className="rounded-2xl border border-line bg-surface p-4 text-sm" data-paywall-card>
          <p className="font-medium">{gate.title} is part of the subscription.</p>
          <p className="mt-1 text-soft">The Calendar, your week, progress and reminders are free. Drafting posts, comments and outreach messages is ₹499 a month.</p>
          <div className="mt-3 flex gap-3">
            <Link className="font-medium text-accent underline" href="/#pricing">See what&apos;s included</Link>
            <button className="text-faint hover:underline" onClick={() => setGate(null)}>Not now</button>
          </div>
        </div>
      )}

      {f.loading ? (
        <div className="grid gap-3 sm:grid-cols-7" aria-busy="true" aria-label="Loading your calendar" role="status">
          {Array.from({ length: 7 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : view === "month" ? (
        <MonthGrid anyDay={anchor} onOpenDay={openDay} {...props} />
      ) : (
        <>
          {items.length === 0 && <p className="rounded-2xl border border-dashed border-line p-5 text-sm text-soft" role="status">Nothing planned. Change the plan by chat or add a post.</p>}
          <WeekGrid monday={monday} {...props} />
          <DayList monday={monday} chosen={chosen} onChoose={setChosen} onWeek={shiftWeek} {...props} />
        </>
      )}

      {editing && (
        <ChangeDate
          item={editing.item}
          today={today}
          onSave={(day, time) => f.move(editing.item, day, time)}
          onClose={() => { const id = editing.item.id; setEditing(null); setTimeout(() => Array.from(document.querySelectorAll<HTMLElement>(`[data-chip="${id}"] [data-change-date]`)).find((el) => el.offsetParent !== null)?.focus(), 0); }}
        />
      )}
    </div>
  );
}
