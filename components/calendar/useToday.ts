"use client";

import { useEffect, useState } from "react";
import { todayIST } from "@/lib/ist";
import { msUntilNextDayIST } from "@/lib/calendar/today";

/**
 * Today's date in India, kept current: it changes when the clock passes midnight and when a tab that slept comes back,
 * so a screen left open overnight stops showing yesterday as today.
 */
export function useToday(): string {
  const [day, setDay] = useState(() => todayIST());
  useEffect(() => {
    const refresh = () => setDay((d) => { const t = todayIST(); return t === d ? d : t; });
    // A little past midnight, so the new day is certain; then this effect runs again for the day after.
    const timer = setTimeout(refresh, msUntilNextDayIST(new Date()) + 1000);
    const wake = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", refresh);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", refresh); };
  }, [day]);
  return day;
}
