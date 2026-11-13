"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Feed, FeedItem } from "@/lib/calendar/types";
import { shortDay } from "@/lib/calendar/sources";
import { CALENDAR_CHANGED } from "@/lib/calendar/events";

export type FeedWithAccess = Feed & { paid: boolean };
export type Undo = { id: string; day: string; time: string; text: string };

const newOp = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

export async function fetchFeed(from: string, to: string): Promise<FeedWithAccess | null> {
  try {
    const r = await fetch(`/api/calendar?from=${from}&to=${to}`, { cache: "no-store" });
    return r.ok ? ((await r.json()) as FeedWithAccess) : null;
  } catch {
    return null;
  }
}

/**
 * The Calendar feed for the days on screen, and the one way to move an item (calendar plan U5, KTD5, KTD6). Every move
 * is one POST with its own op id; Undo is the reverse move with a new op id and is gone after a reload (R15).
 */
export function useFeed({ enabled, from, to }: { enabled: boolean; from: string; to: string }) {
  const key = `${from}:${to}`;
  // `got` says which range the feed in hand is for, so a range change reads as loading without setting state in an effect.
  const [got, setGot] = useState<{ key: string; feed: FeedWithAccess | null } | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [moving, setMoving] = useState<string | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const range = useRef({ from, to, key });
  useEffect(() => { range.current = { from, to, key }; });

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    fetchFeed(from, to).then((feed) => { if (live) setGot({ key, feed }); });
    return () => { live = false; };
  }, [enabled, from, to, key]);

  const reload = useCallback(async () => {
    const r = range.current;
    setGot({ key: r.key, feed: await fetchFeed(r.from, r.to) });
  }, []);

  // A change made elsewhere (a chat move) refreshes this grid.
  useEffect(() => {
    if (!enabled) return;
    const on = () => { void reload(); };
    window.addEventListener(CALENDAR_CHANGED, on);
    return () => window.removeEventListener(CALENDAR_CHANGED, on);
  }, [enabled, reload]);

  /** Sends one move. Resolves to null on success, or the words to show next to the item. */
  const post = useCallback(async (id: string, day: string, time?: string): Promise<string | null> => {
    const r = await fetch("/api/calendar/move", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op_id: newOp(), id, day, ...(time ? { time } : {}) }) });
    if (r.ok) return null;
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    return r.status === 402 ? "Moving this is part of the subscription." : body.error ?? "Couldn't move that.";
  }, []);

  const move = useCallback(async (item: FeedItem, day: string, time?: string): Promise<boolean> => {
    setProblems((p) => { const n = { ...p }; delete n[item.id]; return n; });
    setMoving(item.id);
    const problem = await post(item.id, day, time);
    setMoving(null);
    if (problem) { setProblems((p) => ({ ...p, [item.id]: problem })); return false; }
    setUndo({ id: item.id, day: item.day, time: item.time, text: `Moved ${item.title} to ${shortDay(day)}.` });
    window.dispatchEvent(new Event(CALENDAR_CHANGED));
    return true;
  }, [post]);

  const undoLast = useCallback(async () => {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    const problem = await post(u.id, u.day, u.time);
    if (problem) setProblems((p) => ({ ...p, [u.id]: `Couldn't undo: ${problem}` }));
    window.dispatchEvent(new Event(CALENDAR_CHANGED));
  }, [undo, post]);

  const ready = got?.key === key;
  return { feed: ready ? got!.feed : null, loading: enabled && !ready, failed: ready && got!.feed === null, problems, moving, undo, move, undoLast, reload };
}
