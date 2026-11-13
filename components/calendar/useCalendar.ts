"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { goalFamily, applyMix, commentsDone, weekMix, whyThisWeek, type MixInput, type Plan } from "@/lib/plan";
import { weekProgress, type Streak } from "@/lib/calendar/progress";
import type { ProfileInput } from "@/lib/schemas";
import { CALENDAR_CHANGED } from "@/lib/calendar/events";

/**
 * Calendar v2 for the week screen (calendar plan U1, U2, U6).
 *  - The week's counts follow the person's goals and time (R10), and the why line says how (R11).
 *  - A signed-in person's plan lives in the account: the browser plan moves up once, the account copy is read on every
 *    device, and each change is saved one week at a time. A person without an account keeps the browser plan.
 *  - Progress is always computed here; the streak comes from the account (it needs weeks the browser does not keep).
 * Nothing runs unless `enabled`, so with LYNKR_CALENDAR=v1 the screen is exactly today's.
 */
export function useCalendar({ enabled, signedIn, plan, profile, setPlan }: { enabled: boolean; signedIn: boolean; plan: Plan | null; profile: ProfileInput | null; setPlan: (p: Plan) => void }) {
  const [outreachGoals, setOutreachGoals] = useState<string[]>([]);
  // The week whose account copy has been read. Derived below, so no state is set inside an effect body.
  const [syncedWeek, setSyncedWeek] = useState<string | null>(null);
  const [streakData, setStreakData] = useState<Streak | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const lastSent = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weekStart = plan?.weekStart ?? null;
  const synced = !enabled || !signedIn || !weekStart || syncedWeek === weekStart;

  const input: MixInput = useMemo(() => ({ bucket: profile?.bucket ?? null, wants: profile?.goals ?? [], outreachGoals, weeklyTime: profile?.weeklyTime ?? null }), [profile, outreachGoals]);

  // The person's Outreach goals, in the order they picked them. No account or no goals is fine: the bucket decides.
  useEffect(() => {
    if (!enabled || !signedIn) return;
    fetch("/api/outreach/goals", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { goals?: unknown } | null) => setOutreachGoals(Array.isArray(d?.goals) ? d.goals.filter((g): g is string => typeof g === "string") : []))
      .catch(() => {});
  }, [enabled, signedIn]);

  // Account first: read this week from the account; if it has none, move the browser plan up once.
  useEffect(() => {
    if (!enabled) return;
    if (!signedIn || !weekStart) return;
    const wk = weekStart;
    let live = true;
    (async () => {
      try {
        const r = await fetch(`/api/calendar/plan?week=${wk}`, { cache: "no-store" });
        if (!r.ok) { if (live) setSyncedWeek(wk); return; }
        const d = (await r.json()) as { plan: Plan | null; streak?: Streak };
        if (!live) return;
        if (d.plan) { lastSent.current = JSON.stringify(d.plan); setPlan(d.plan); }
        else if (plan) {
          const up = await fetch("/api/calendar/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ week: wk, plan }) });
          if (up.ok) { const u = (await up.json()) as { plan: Plan | null }; if (u.plan && live) { lastSent.current = JSON.stringify(u.plan); setPlan(u.plan); } }
        }
        if (d.streak && live) setStreakData(d.streak);
      } catch {
        if (live) setProblem("Couldn't reach your account. Your plan is kept in this browser for now.");
      } finally {
        if (live) setSyncedWeek(wk);
      }
    })();
    return () => { live = false; };
    // The account is read once per week and sign-in state; later changes are saved by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signedIn, weekStart]);

  // A move made through the Calendar or by chat changed the account's week: read it back, so this screen's copy is never
  // the stale one that a later save would write over the move.
  useEffect(() => {
    if (!enabled || !signedIn || !weekStart) return;
    const wk = weekStart;
    const on = async () => {
      try {
        const r = await fetch(`/api/calendar/plan?week=${wk}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { plan: Plan | null };
        if (d.plan) { lastSent.current = JSON.stringify(d.plan); setPlan(d.plan); }
      } catch { /* the next load reads it */ }
    };
    window.addEventListener(CALENDAR_CHANGED, on);
    return () => window.removeEventListener(CALENDAR_CHANGED, on);
  }, [enabled, signedIn, weekStart, setPlan]);

  // Comments logged as posted this week count toward the plan (Commenter R16). Only when the Commenter is on and the person is signed in.
  const [postedComments, setPostedComments] = useState(0);
  useEffect(() => {
    if (!enabled || !signedIn || !weekStart) return;
    let live = true;
    (async () => {
      try {
        const st = (await (await fetch("/api/status", { cache: "no-store" })).json()) as { commenter?: string };
        if (st.commenter !== "on") return;
        const r = await fetch(`/api/comments?since=${encodeURIComponent(`${weekStart}T00:00:00+05:30`)}`, { cache: "no-store" });
        if (r.ok && live) setPostedComments(((await r.json()) as { entries?: unknown[] }).entries?.length ?? 0);
      } catch { /* the plan works without it */ }
    })();
    return () => { live = false; };
  }, [enabled, signedIn, weekStart]);
  useEffect(() => {
    if (!enabled || !synced || !plan || postedComments === 0) return;
    const next = commentsDone(plan, postedComments);
    if (next !== plan) setPlan(next);
  }, [enabled, synced, plan, postedComments, setPlan]);

  // The mix rules, once the account copy (if any) has been read. A week the person changed is left alone (R12).
  useEffect(() => {
    if (!enabled || !synced || !plan || plan.changedByUser) return;
    const next = applyMix(plan, weekMix(goalFamily(input), input.weeklyTime));
    if (JSON.stringify(next.items) !== JSON.stringify(plan.items) || JSON.stringify(next.counts) !== JSON.stringify(plan.counts)) setPlan(next);
  }, [enabled, synced, plan, input, setPlan]);

  // Save each change to the account, one week at a time, after a short pause. Then refresh the streak.
  useEffect(() => {
    if (!enabled || !signedIn || !synced || !plan) return;
    const body = JSON.stringify(plan);
    if (body === lastSent.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/calendar/plan", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ week: plan.weekStart, plan }) });
        if (!r.ok) { setProblem("Couldn't save your plan to your account. It is kept in this browser."); return; }
        lastSent.current = body;
        setProblem(null);
        const g = await fetch(`/api/calendar/plan?week=${plan.weekStart}`, { cache: "no-store" });
        if (g.ok) { const d = (await g.json()) as { streak?: Streak }; if (d.streak) setStreakData(d.streak); }
      } catch {
        setProblem("Couldn't save your plan to your account. It is kept in this browser.");
      }
    }, 700);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [enabled, signedIn, synced, plan]);

  const progress = useMemo(() => (plan ? weekProgress(plan.items) : { planned: 0, done: 0 }), [plan]);
  const why = useMemo(() => (plan ? whyThisWeek(plan.counts, input, plan.changedByUser === true) : ""), [plan, input]);
  return { why, progress, streak: signedIn ? streakData : null, problem, ready: synced };
}
