"use client";

import { Flame } from "lucide-react";
import type { Streak as StreakData } from "@/lib/calendar/progress";

/**
 * The last finished weeks plus this one, a flame on each that reached 70% (R19). Every week has a text label, so the
 * flame is never the only signal. The copy never shames: a week below the line just shows its count.
 */
export function Streak({ data }: { data: StreakData }) {
  if (data.first) {
    return <p className="text-[0.9rem] text-soft">Your first week. Each week you reach 70% of your plan earns a flame.</p>;
  }
  return (
    <div>
      <p className="text-[0.9rem] text-soft">
        {data.streak > 0 ? `${data.streak} ${data.streak === 1 ? "week" : "weeks"} in a row.` : "A new streak starts with the next week you reach 70%."}
      </p>
      <ol className="mt-2 flex flex-wrap gap-2" aria-label="Your recent weeks">
        {data.weeks.map((w) => (
          <li key={w.weekStart} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.85rem] ${w.current ? "border-accent/50" : "border-line"}`}>
            <Flame size={15} aria-hidden className={w.flame ? "text-accent" : "text-faint opacity-40"} />
            <span>{w.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
