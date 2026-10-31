"use client";

import { useId, useMemo, useState } from "react";
import { Button, Card, ErrorNote, Pill, SectionHead } from "@/components/ui";
import { buildSearchLinks, buildTargetMap, directoriesFor, rankByLamp, type RolePacket, type Signal } from "@/lib/outreach/finder";
import type { OutreachGoal } from "@/lib/outreach/goals";

const LEVELS = [
  { value: 0, label: "Not set" },
  { value: 1, label: "A little" },
  { value: 2, label: "A lot" },
  { value: 3, label: "Top choice" },
];

const linkCls = "inline-flex min-h-10 max-w-full items-center break-words rounded-md border border-line bg-surface px-3 py-2 text-[0.95rem] text-ink underline-offset-2 hover:border-accent/50 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

/**
 * Where to look and whom, for the goal the person chose. Links open LinkedIn or a public directory in a new tab;
 * Lynkr does not search for you. Company news and open roles are about companies, never about people.
 */
export function Finder({ goal, field, subNiche = "", school = "", companies, connections = [], roles = [] }: {
  goal: OutreachGoal;
  field: string;
  subNiche?: string;
  school?: string;
  companies: string[];
  /** From the connections file on this device. Only the company is read here. */
  connections?: readonly { company: string }[];
  /** Roles from job pages already imported. */
  roles?: RolePacket[];
}) {
  const headingId = useId();
  const [motivation, setMotivation] = useState<Record<string, number>>({});
  const [signals, setSignals] = useState<Signal[]>([]);
  const [feedErrors, setFeedErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const map = useMemo(() => buildTargetMap({ goals: [goal], field, subNiche, companies }), [goal, field, subNiche, companies]);
  const links = useMemo(() => buildSearchLinks(goal, map, school), [goal, map, school]);
  const directories = useMemo(() => directoriesFor(goal), [goal]);
  const ranked = useMemo(() => rankByLamp(map.companies, { motivation, connections, signals }), [map.companies, motivation, connections, signals]);

  async function checkSignals() {
    setError(null); setBusy(true);
    try {
      const res = await fetch("/api/outreach/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: map.companies, roles }),
      });
      const data = await res.json().catch(() => ({})) as { signals?: Signal[]; feedErrors?: { error: string }[]; error?: string };
      if (!res.ok || !data.signals) { setError(data.error || "Couldn't check company news. Try again."); return; }
      setSignals(data.signals);
      setFeedErrors([...new Set((data.feedErrors ?? []).map((e) => e.error))]);
      setChecked(true);
    } catch {
      setError("Couldn't check company news. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  if (!field.trim()) {
    return <Card><SectionHead title="Find people">Add your field of work first, and Lynkr will suggest where to look.</SectionHead></Card>;
  }

  return (
    <Card>
      <SectionHead title="Find people" id={headingId}>
        These open in a new tab. You choose who to write to; Lynkr never searches LinkedIn for you.
      </SectionHead>

      <section aria-labelledby={`${headingId}-links`} className="mb-6 min-w-0">
        <h4 id={`${headingId}-links`} className="mb-2 text-[1rem] font-semibold">Searches to run</h4>
        <ul className="flex flex-wrap gap-2">
          {links.map((l) => (
            <li key={l.url} className="min-w-0 max-w-full">
              <a className={linkCls} href={l.url} target="_blank" rel="noopener noreferrer">{l.label}<span className="sr-only"> (opens in a new tab)</span></a>
            </li>
          ))}
        </ul>
      </section>

      {directories.length > 0 && (
        <section aria-labelledby={`${headingId}-dirs`} className="mb-6 min-w-0">
          <h4 id={`${headingId}-dirs`} className="mb-2 text-[1rem] font-semibold">Public lists</h4>
          <ul className="space-y-2">
            {directories.map((d) => (
              <li key={d.url} className="min-w-0">
                <a className={linkCls} href={d.url} target="_blank" rel="noopener noreferrer">{d.label}<span className="sr-only"> (opens in a new tab)</span></a>
                <p className="mt-1 text-[0.9rem] text-soft">{d.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ranked.length > 0 && (
        <section aria-labelledby={`${headingId}-co`} className="mb-6 min-w-0">
          <h4 id={`${headingId}-co`} className="mb-1 text-[1rem] font-semibold">Companies, best first</h4>
          <p className="mb-3 text-[0.9rem] text-soft">Set how much you want each one. People you know there and recent news move a company up.</p>
          <ol className="space-y-3">
            {ranked.map((r) => {
              const id = `${headingId}-m-${r.company.replace(/[^a-z0-9]+/gi, "-")}`;
              return (
                <li key={r.company} className="min-w-0 rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-words font-medium">{r.company}</span>
                    <span className="flex items-center gap-2">
                      <label htmlFor={id} className="text-[0.9rem] text-soft">How much you want it</label>
                      <select id={id} value={r.motivation} onChange={(e) => setMotivation((m) => ({ ...m, [r.company]: Number(e.target.value) }))}
                        className="min-h-10 rounded-md border border-line bg-surface px-2 text-[0.95rem]">
                        {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </span>
                  </div>
                  <p className="mt-1 text-[0.9rem] text-soft">{r.reason}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {map.companies.length > 0 && (
        <section aria-labelledby={`${headingId}-sig`} className="min-w-0">
          <h4 id={`${headingId}-sig`} className="mb-1 text-[1rem] font-semibold">A reason to write now</h4>
          <p className="mb-3 text-[0.9rem] text-soft">Open roles from jobs you imported, and funding or company news from Inc42, Entrackr and YourStory. About companies only.</p>
          <Button variant="ghost" onClick={checkSignals} disabled={busy}>{busy ? "Checking..." : checked ? "Check again" : "Check company news"}</Button>
          <div className="mt-3 space-y-2" aria-live="polite">
            <ErrorNote message={error} />
            {feedErrors.map((m) => <p key={m} role="status" className="text-[0.9rem] text-soft">{m}</p>)}
            {checked && signals.length === 0 && !error && <p role="status" className="text-[0.95rem] text-soft">Nothing new about these companies right now.</p>}
          </div>
          {signals.length > 0 && (
            <ul className="mt-3 space-y-2">
              {signals.map((s) => (
                <li key={`${s.kind}-${s.url}-${s.company}`} className="min-w-0 rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2 text-[0.9rem]">
                    <span className="font-medium">{s.company}</span>
                    <Pill tone={s.stale ? "warn" : "good"}>{s.stale ? "Old" : "Recent"}</Pill>
                    <span className="text-soft">{s.date || "No date"} · {s.source}</span>
                  </div>
                  <a className="mt-1 block break-words text-[0.95rem] underline underline-offset-2" href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.text}<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Card>
  );
}
