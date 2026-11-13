"use client";

import { useState } from "react";
import { WEEKDAY_NAMES, daysWithItems, dropAllowed, groupByDay, monthCells, monthSlice, weekDays } from "@/lib/calendar/grid";
import type { FeedItem } from "@/lib/calendar/types";
import { formatDay, formatMonth } from "@/lib/ist";
import { ItemChip } from "./ItemChip";

/** What every grid needs: the items, today, and what to do with a chip or a drop. */
export type GridProps = {
  items: readonly FeedItem[];
  today: string;
  problems: Record<string, string>;
  moving: string | null;
  onOpen: (item: FeedItem) => void;
  onChangeDate: (item: FeedItem, opener: HTMLElement | null) => void;
  onDrop: (item: FeedItem, day: string) => void;
};

const byId = (items: readonly FeedItem[], id: string) => items.find((i) => i.id === id);

/** A day that takes drops: valid days are marked while a chip is being dragged (R14). */
function DropDay({ day, props, dragging, setDragging, className, children }: { day: string; props: GridProps; dragging: FeedItem | null; setDragging: (i: FeedItem | null) => void; className: string; children: React.ReactNode }) {
  const ok = dragging ? dropAllowed(dragging, day, props.today) : false;
  return (
    <div
      data-day={day}
      data-drop-ok={dragging ? String(ok) : undefined}
      className={`${className} ${dragging && ok ? "ring-2 ring-accent/50" : ""} ${dragging && !ok ? "opacity-60" : ""}`}
      onDragOver={(e) => { if (ok) e.preventDefault(); }}
      onDrop={(e) => {
        e.preventDefault();
        const item = byId(props.items, e.dataTransfer.getData("text/plain"));
        setDragging(null);
        if (item && dropAllowed(item, day, props.today)) props.onDrop(item, day);
      }}
    >
      {children}
    </div>
  );
}

function Chips({ list, props, compact, setDragging }: { list: readonly FeedItem[]; props: GridProps; compact?: boolean; setDragging: (i: FeedItem | null) => void }) {
  return (
    <>
      {list.map((it) => (
        <ItemChip key={it.id} item={it} compact={compact} moving={props.moving === it.id} problem={props.problems[it.id]} onOpen={props.onOpen} onChangeDate={props.onChangeDate} onDragStart={setDragging} />
      ))}
    </>
  );
}

/** Seven columns, Monday to Sunday (R2). Hidden under 640 px, where the day list takes over (R3). */
export function WeekGrid({ monday, ...props }: GridProps & { monday: string }) {
  const [dragging, setDragging] = useState<FeedItem | null>(null);
  const by = groupByDay(props.items);
  return (
    <div className="hidden gap-3 sm:grid sm:grid-cols-7" data-view="week" onDragEnd={() => setDragging(null)}>
      {weekDays(monday).map((day, i) => {
        const list = by.get(day) ?? [];
        return (
          <DropDay key={day} day={day} props={props} dragging={dragging} setDragging={setDragging} className="min-w-0 rounded-lg">
            <section aria-label={formatDay(day)}>
              <h4 className={`mb-2 border-b pb-1 text-[0.9rem] font-bold ${day === props.today ? "border-accent text-ink" : "border-line text-soft"}`}>
                {WEEKDAY_NAMES[i]} {Number(day.slice(8))}
                {day === props.today && <span className="ml-1 text-[0.75rem] font-normal text-faint">today</span>}
              </h4>
              <div className="space-y-2">{list.length === 0 ? <p className="text-xs text-faint">Free</p> : <Chips list={list} props={props} setDragging={setDragging} />}</div>
            </section>
          </DropDay>
        );
      })}
    </div>
  );
}

/** A month of days. Three chips a day, then "+N more", which opens that day in the week view (R1). */
export function MonthGrid({ anyDay, onOpenDay, ...props }: GridProps & { anyDay: string; onOpenDay: (day: string) => void }) {
  const [dragging, setDragging] = useState<FeedItem | null>(null);
  const { first, days } = monthCells(anyDay);
  const by = groupByDay(props.items);
  return (
    <div data-view="month" onDragEnd={() => setDragging(null)}>
      <h4 className="mb-2 font-semibold">{formatMonth(first)}</h4>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {WEEKDAY_NAMES.map((d) => <div key={d} className="pb-1 text-center font-medium text-faint">{d}</div>)}
        {days.map((day) => {
          const { shown, more } = monthSlice(by.get(day) ?? []);
          const inMonth = day.slice(0, 7) === first.slice(0, 7);
          return (
            <DropDay key={day} day={day} props={props} dragging={dragging} setDragging={setDragging} className={`min-h-16 min-w-0 rounded border p-1 ${inMonth ? "border-line" : "border-transparent bg-muted/60"} ${day === props.today ? "ring-1 ring-accent" : ""}`}>
              <button className="text-soft hover:underline" onClick={() => onOpenDay(day)} aria-label={`Open ${formatDay(day)} in the week view`}>{Number(day.slice(8))}</button>
              <div className="space-y-1">
                <Chips list={shown} props={props} compact setDragging={setDragging} />
                {more > 0 && <button className="text-accent hover:underline" onClick={() => onOpenDay(day)}>+{more} more</button>}
              </div>
            </DropDay>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Phones (R3): a week strip with a dot under each day that has items, week arrows, and the chosen day's list. No drag here:
 * "Change date" is the way to move on touch, and the page never scrolls sideways.
 */
export function DayList({ monday, chosen, onChoose, onWeek, ...props }: GridProps & { monday: string; chosen: string; onChoose: (day: string) => void; onWeek: (delta: number) => void }) {
  const dots = daysWithItems(props.items);
  const list = groupByDay(props.items).get(chosen) ?? [];
  return (
    <div className="sm:hidden" data-view="day-list">
      <div className="flex items-center justify-between gap-1" role="group" aria-label="Choose a day">
        <button className="min-h-11 min-w-11 rounded hover:bg-muted" onClick={() => onWeek(-1)} aria-label="Previous week">←</button>
        {weekDays(monday).map((day, i) => (
          <button key={day} onClick={() => onChoose(day)} aria-pressed={day === chosen}
            className={`flex min-h-11 min-w-9 flex-col items-center justify-center rounded-lg px-1 text-[0.8rem] ${day === chosen ? "bg-ink text-bg" : "hover:bg-muted"}`}>
            <span>{WEEKDAY_NAMES[i]}</span>
            <span className="font-medium">{Number(day.slice(8))}</span>
            {dots.has(day) && <span className="sr-only">, has items</span>}
            <span aria-hidden className={`mt-0.5 h-1 w-1 rounded-full ${dots.has(day) ? "bg-accent" : "bg-transparent"}`} />
          </button>
        ))}
        <button className="min-h-11 min-w-11 rounded hover:bg-muted" onClick={() => onWeek(1)} aria-label="Next week">→</button>
      </div>
      <h4 className="mt-3 font-semibold">{formatDay(chosen)}</h4>
      <div className="mt-2 space-y-2">
        {list.length === 0 ? <p className="text-sm text-faint">Nothing planned for this day.</p> : list.map((it) => (
          <ItemChip key={it.id} item={{ ...it, movable: it.movable }} moving={props.moving === it.id} problem={props.problems[it.id]} onOpen={props.onOpen} onChangeDate={props.onChangeDate} />
        ))}
      </div>
    </div>
  );
}
