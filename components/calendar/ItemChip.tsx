"use client";

import { chipStatus, chipSummary } from "@/lib/calendar/grid";
import { downloadIcs } from "@/lib/ics";
import { eventFor, googleUrlFor, isOpen } from "@/lib/calendar/reminders";
import type { FeedItem } from "@/lib/calendar/types";
import { formatDay } from "@/lib/ist";

const TONE: Record<string, string> = {
  plan: "bg-muted text-ink",
  post: "bg-accent/15 text-accent",
  outreach: "bg-accent/10 text-accent-strong",
};

/**
 * One item on the Calendar (calendar plan U5, R4, R5, R14). It shows the type, the time, the status as words and the goal.
 * Opening it goes to its owner; "Change date" is the keyboard and touch way to move it; a chip that cannot move has no
 * drag handle and says why instead (R14). A replaced item is struck through with its status text.
 */
export function ItemChip({
  item, compact = false, moving = false, problem, onOpen, onChangeDate, onMoveBack, onDragStart,
}: {
  item: FeedItem;
  /** Month cells drop the goal label when space is short (R1). */
  compact?: boolean;
  moving?: boolean;
  problem?: string;
  onOpen: (item: FeedItem) => void;
  onChangeDate: (item: FeedItem) => void;
  onDragStart?: (item: FeedItem) => void;
  /** Puts the item back on the day it started. */
  onMoveBack?: (item: FeedItem) => void;
}) {
  const replaced = item.status === "replaced";
  return (
    <div
      data-chip={item.id}
      data-status={item.status}
      draggable={item.movable && !moving}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); e.dataTransfer.effectAllowed = "move"; onDragStart?.(item); }}
      className={`rounded-lg border ${replaced ? "border-dashed border-line bg-transparent" : "border-line bg-surface"} p-2 text-left text-[0.8rem] ${item.movable ? "cursor-grab" : ""} ${moving ? "opacity-60" : ""} ${item.status === "done" ? "opacity-75" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-1">
        <span className={`rounded px-1.5 py-0.5 font-medium ${replaced ? "bg-transparent text-faint" : TONE[item.owner] ?? TONE.plan}`}>{item.time} IST</span>
        <span className={`ml-auto ${replaced ? "text-faint" : "font-medium text-soft"}`}>{moving ? "Moving…" : chipStatus(item)}</span>
      </div>
      <button
        className={`mt-1 block w-full min-h-8 text-left font-medium leading-snug hover:underline ${replaced ? "line-through text-faint" : ""}`}
        onClick={() => onOpen(item)}
        aria-label={chipSummary(item)}
      >
        {item.title}
      </button>
      {!compact && item.label && <p className="text-faint">{item.label}</p>}
      {item.movedFrom && !moving && (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-faint" data-moved-from>
          <span>Moved from {formatDay(item.movedFrom.day)}</span>
          {item.movable && onMoveBack && (
            <button className="min-h-8 font-medium text-accent hover:underline" onClick={() => onMoveBack(item)} aria-label={`Move back: ${item.title} to ${formatDay(item.movedFrom.day)}`}>Move back</button>
          )}
        </p>
      )}
      <div className="mt-1 flex items-center justify-between gap-2">
        {item.movable ? (
          <button data-change-date className="min-h-11 min-w-11 rounded px-2 text-accent hover:underline sm:min-h-8 sm:min-w-0" onClick={() => onChangeDate(item)} aria-label={`Change date for ${item.title}`}>
            Change date
          </button>
        ) : (
          item.lockedReason && !replaced && <span className="text-faint">{item.lockedReason}</span>
        )}
      </div>
      {isOpen(item) && (
        <details className="mt-1 text-faint">
          <summary className="min-h-8 cursor-pointer select-none hover:underline" aria-label={`Add to calendar: ${item.title}`}>Add to calendar</summary>
          <div className="mt-1 flex flex-wrap gap-2">
            <button className="min-h-8 hover:underline" onClick={() => downloadIcs(`lynkr-${item.day}.ics`, [eventFor(item)])} aria-label={`Download .ics for ${item.title}`}>.ics file</button>
            <a className="min-h-8 hover:underline" href={googleUrlFor(item)} target="_blank" rel="noopener noreferrer" aria-label={`Add ${item.title} to Google Calendar`}>Google Calendar</a>
          </div>
        </details>
      )}
      {problem && <p role="alert" className="mt-1 text-bad">{problem}</p>}
    </div>
  );
}
