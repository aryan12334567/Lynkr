"use client";

import { useId, useState } from "react";
import { api, loadTimeline } from "@/lib/outreach/ui-api";
import type { UiContact } from "@/lib/outreach/ui-board";
import { boxCls, linkCls } from "@/lib/outreach/ui-style";
import { Button, ErrorNote, Label, inputCls } from "../ui";

type Candidate = { title: string; url: string; date: string };
type Fact = { text: string; quote: string; source: string; date: string };
type Brief = { candidates?: Candidate[]; facts?: Fact[]; noHook?: boolean; bridge?: string; priority?: string; offer?: string; angle?: string };

/**
 * What Lynkr knows about this person (R10-R13). Search public pages outside LinkedIn, say which results are really them,
 * and build up to three facts, each with its source. "No hook found" is fine: drafts then use their role and company.
 */
export function BriefPanel({ contact, disabled, onContact }: { contact: UiContact; disabled: boolean; onContact: (c: UiContact) => void }) {
  const ids = useId();
  const brief = (contact.brief ?? {}) as Brief;
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [selectedText, setSelectedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const shown = (candidates ?? brief.candidates ?? []).filter((c) => !rejected.includes(c.url));

  async function search() {
    setBusy(true); setError(null); setNote("");
    try {
      const r = await api<{ candidates: Candidate[]; note?: string }>("POST", "/api/outreach/brief", { action: "search", contactId: contact.id });
      setCandidates(r.candidates); setPicked([]); setRejected([]);
      setNote(r.note || (r.candidates.length ? "Tick the results that are really this person." : "No public pages found. You can paste text you selected, or skip the brief."));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function build() {
    setBusy(true); setError(null); setNote("");
    try {
      await api("POST", "/api/outreach/brief", { action: "confirm", contactId: contact.id, urls: picked, rejected, selectedText });
      onContact((await loadTimeline(contact.id)).contact);
      setNote("Brief updated. Check each fact and its source before you rely on it.");
      setPicked([]); setSelectedText("");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const facts = brief.facts ?? [];
  const canBuild = !disabled && !busy && (picked.length > 0 || selectedText.trim().length > 0);
  return (
    <section aria-labelledby={`${ids}-h`} className={boxCls}>
      <h3 id={`${ids}-h`} className="font-bold">What we know about {contact.name}</h3>
      {brief.facts ? (
        <div className="mt-2 space-y-2 text-[0.95rem]">
          {facts.length === 0 && <p className="text-soft">No hook found. Messages will use their role and company only.</p>}
          {facts.length > 0 && (
            <ul className="space-y-2">
              {facts.map((f, i) => (
                <li key={i}>
                  <p>{f.text}</p>
                  <p className="text-[0.88rem] text-soft">
                    Source: {/^https?:\/\//.test(f.source) ? <a className="text-accent underline" href={f.source} target="_blank" rel="noopener noreferrer">{f.source}<span className="sr-only"> (opens in a new tab)</span></a> : f.source}
                    {f.date ? `, ${f.date}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {brief.bridge && <p><span className="font-medium">What you share:</span> {brief.bridge}</p>}
          {brief.priority && <p><span className="font-medium">Likely focus right now:</span> {brief.priority}</p>}
          {brief.offer && <p><span className="font-medium">What you can give:</span> {brief.offer}</p>}
          {brief.angle && <p><span className="font-medium">Best way in:</span> {brief.angle}</p>}
        </div>
      ) : (
        <p className="mt-1 text-[0.92rem] text-soft">No brief yet. Search public pages, then choose which results are really this person.</p>
      )}

      <div className="mt-3 space-y-3">
        <Button variant="ghost" disabled={disabled || busy} onClick={search}>{busy ? "Working" : brief.candidates || candidates ? "Search again" : "Search public pages"}</Button>
        <div aria-live="polite" className="space-y-2">
          {note && <p role="status" className="text-[0.92rem] text-soft">{note}</p>}
          <ErrorNote message={error} />
        </div>
        {shown.length > 0 && (
          <fieldset>
            <legend className="mb-1 text-[0.92rem] font-medium">Is this the right person?</legend>
            <ul className="space-y-2">
              {shown.map((c) => (
                <li key={c.url} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <label className="flex min-h-10 min-w-0 flex-1 basis-60 items-center gap-2">
                    <input type="checkbox" className="h-5 w-5 shrink-0" checked={picked.includes(c.url)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, c.url] : x.filter((u) => u !== c.url)))} />
                    <span className="min-w-0 break-words">{c.title || c.url}{c.date ? ` (${c.date})` : ""}</span>
                  </label>
                  <a className={linkCls} href={c.url} target="_blank" rel="noopener noreferrer">Open<span className="sr-only"> {c.title || c.url} (opens in a new tab)</span></a>
                  <Button variant="quiet" onClick={() => { setRejected((x) => [...x, c.url]); setPicked((x) => x.filter((u) => u !== c.url)); }}>Not this person<span className="sr-only">: {c.title || c.url}</span></Button>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        <label className="block">
          <Label hint="(optional)">Or paste text you selected on LinkedIn</Label>
          <textarea className={`${inputCls} min-h-20`} maxLength={4000} value={selectedText} onChange={(e) => setSelectedText(e.target.value)} disabled={disabled} />
        </label>
        <Button variant="ghost" disabled={!canBuild} onClick={build}>Build the brief from these</Button>
        {disabled && <p className="text-[0.88rem] text-soft">Subscribe to search and build briefs.</p>}
      </div>
    </section>
  );
}
