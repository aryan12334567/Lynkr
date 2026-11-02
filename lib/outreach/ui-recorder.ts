"use client";
// One tap at a time: the button is disabled while it is in flight, a failure keeps the same request for Retry
// (the same op_id, so the server never writes it twice), and a lapsed subscription is reported to the screen.
import { useCallback, useRef, useState } from "react";
import { isLapsed } from "./ui-api";
import type { TimelineResult } from "./ui-timeline";

export function useRecorder(onResult: (r: TimelineResult) => void, onLapsed?: () => void) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const last = useRef<(() => Promise<TimelineResult>) | null>(null);
  const live = useRef(true);

  const run = useCallback(async (action: () => Promise<TimelineResult>): Promise<boolean> => {
    last.current = action;
    setBusy(true); setFailed(null);
    try {
      const r = await action();
      last.current = null;
      onResult(r);
      return true;
    } catch (e) {
      if (isLapsed(e)) { last.current = null; onLapsed?.(); }
      else setFailed(e instanceof Error ? e.message : "That didn't save. Try again.");
      return false;
    } finally { if (live.current) setBusy(false); }
  }, [onResult, onLapsed]);

  /** Runs the failed action again, unchanged. */
  const retry = useCallback(() => (last.current ? run(last.current) : Promise.resolve(false)), [run]);
  const clear = useCallback(() => { last.current = null; setFailed(null); }, []);
  return { busy, failed, run, retry, clear };
}
