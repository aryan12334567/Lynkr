"use client";

import type { Undo } from "./useFeed";

/** "Moved. Undo" (R15). Lives only while the page is open, as the plan says; a reload clears it. */
export function UndoBar({ undo, onUndo }: { undo: Undo | null; onUndo: () => void }) {
  if (!undo) return <p className="sr-only" role="status" aria-live="polite" />;
  return (
    <p role="status" aria-live="polite" className="flex flex-wrap items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm" data-undo-bar>
      <span>{undo.text}</span>
      <button className="font-medium text-accent underline" onClick={onUndo}>Undo</button>
    </p>
  );
}
