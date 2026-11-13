"use client";

import { useRef } from "react";
import { chipStatus, chipSummary } from "@/lib/calendar/grid";
import type { FeedItem } from "@/lib/calendar/types";

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
  item, compact = false, moving = false, problem, onOpen, onChangeDate, onDragStart,
}: {
  item: FeedItem;
  /** Month cells drop the goal label when space is short (R1). */
  compact?: boolean;
  moving?: boolean;
  problem?: string;
  onOpen: (item: FeedItem) => void;
  onChangeDate: (item: FeedItem, opener: HTMLElement | null) => void;
  onDragStart?: (item: FeedItem) => void;
}) {
  const menu = useRef<HTMLButtonElement>(null);
  const replaced = item.status === "replaced";
  return (
    <div
      data-chip={item.id}
      data-status={item.status}
      draggable={item.movable}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); e.dataTransfer.effectAllowed = "move"; onDragStart?.(item); }}
      className={`rounded-lg border border-line bg-surface p-2 text-left text-[0.8rem] ${item.movable ? "cursor-grab" : ""} ${moving ? "opacity-60" : ""} ${item.status === "done" ? "opacity-75" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-1">
        <span className={`rounded px-1.5 py-0.5 font-medium ${TONE[item.owner] ?? TONE.plan}`}>{item.time} IST</span>
        <span className="ml-auto font-medium text-soft">{moving ? "Moving…" : chipStatus(item)}</span>
      </div>
      <button
        className={`mt-1 block w-full min-h-8 text-left font-medium leading-snug hover:underline ${replaced ? "line-through text-faint" : ""}`}
        onClick={() => onOpen(item)}
        aria-label={chipSummary(item)}
      >
        {item.title}
      </button>
      {!compact && item.label && <p className="text-faint">{item.label}</p>}
      <div className="mt-1 flex items-center justify-between gap-2">
        {item.movable ? (
          <button ref={menu} data-change-date className="min-h-11 min-w-11 rounded px-2 text-accent hover:underline sm:min-h-8 sm:min-w-0" onClick={() => onChangeDate(item, menu.current)} aria-label={`Change date for ${item.title}`}>
            Change date
          </button>
        ) : (
          item.lockedReason && !replaced && <span className="text-faint">{item.lockedReason}</span>
        )}
      </div>
      {problem && <p role="alert" className="mt-1 text-bad">{problem}</p>}
    </div>
  );
}
