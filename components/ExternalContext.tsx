"use client";

import { useState } from "react";
import { Check, Link2, X } from "lucide-react";
import type { ExternalContextPacket } from "@/lib/schemas";
import { postJson } from "@/lib/store";
import { Button, ErrorNote, Label, Pill, inputCls } from "./ui";

export type ImportMode = "demo" | "on" | "off" | null;

const WORK_MODE: Record<ExternalContextPacket["workMode"], string> = { remote: "Remote", hybrid: "Hybrid", on_site: "On-site", unknown: "" };

/**
 * Import one public job posting (Apify enrichment plan, U3). The packet stays a suggestion
 * until the user approves it, can be edited item by item, and always shows where it came from.
 * It is held in memory only, separate from the Story Vault.
 */
export function ExternalContext({
  packet,
  onPacket,
  mode,
}: {
  packet: ExternalContextPacket | null;
  onPacket: (p: ExternalContextPacket | null) => void;
  mode: ImportMode;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await postJson<{ packet: ExternalContextPacket; demo: boolean }>("/api/enrich", { url });
      onPacket(r.packet);
      setDemo(r.demo);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const removeItem = (field: "responsibilities" | "requiredSkills" | "preferredSkills", i: number) =>
    packet && onPacket({ ...packet, [field]: packet[field].filter((_, j) => j !== i), reviewStatus: packet.reviewStatus });

  if (packet?.reviewStatus === "approved") {
    return (
      <div className="rounded-xl border border-good/30 bg-good/5 p-4 text-[0.92rem]" data-requirements="approved">
        <p className="flex items-center gap-2 font-medium text-good">
          <Check size={16} aria-hidden /> Using the requirements from this job posting
        </p>
        <p className="mt-1">
          {packet.title}
          {packet.company ? `, ${packet.company}` : ""}
        </p>
        <p className="text-[0.85rem] text-soft">
          From {packet.sourceDomain}, fetched {new Date(packet.fetchedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}. These describe the job, not you: they shape the checks and drafts, never your facts.
        </p>
        <Button variant="quiet" className="mt-2 -ml-2" onClick={() => onPacket(null)}>
          <X size={14} aria-hidden /> Stop using it
        </Button>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={run}>
        <label className="block">
          <Label hint="(optional)">Import a job posting link</Label>
          <span className="mb-2 block text-[0.88rem] text-soft">
            From Greenhouse, Lever or Ashby job pages only. Lynkr reads that one page, keeps only the role and its requirements, and removes names,
            emails, phone numbers and links. LinkedIn and other sites can&apos;t be imported: paste the description below instead.
          </span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={inputCls}
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://jobs.lever.co/company/..."
              maxLength={500}
              disabled={mode === "off"}
            />
            <Button type="submit" variant="ghost" className="shrink-0" disabled={busy || !url.trim() || mode === "off"}>
              <Link2 size={15} aria-hidden /> {busy ? "Importing…" : "Import"}
            </Button>
          </div>
        </label>
      </form>
      {mode === "off" && <p className="mt-2 text-[0.85rem] text-faint">Importing from a link is switched off right now. Paste the job description below instead.</p>}
      {busy && <p className="mt-2 animate-pulse text-[0.88rem] text-soft">Reading that one page. Usually 10 to 30 seconds.</p>}
      <div className="mt-2">
        <ErrorNote message={error} />
      </div>

      {packet && (
        <div className="mt-4 rounded-xl border border-accent/60 bg-surface p-4 text-[0.92rem]" data-requirements="review">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="warn">Check before using</Pill>
            {demo && <Pill>Demo sample, not the real page</Pill>}
          </div>
          <p className="mt-2 font-serif text-[1.05rem] font-bold">{packet.title}</p>
          <p className="text-soft">
            {[packet.company, packet.location, WORK_MODE[packet.workMode], packet.experienceLevel].filter(Boolean).join(", ")}
          </p>
          <p className="mt-1 break-all text-[0.82rem] text-faint">
            Source: {packet.sourceUrl}. Fetched {new Date(packet.fetchedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.
          </p>
          {(
            [
              ["responsibilities", "What the job involves"],
              ["requiredSkills", "What they ask for"],
              ["preferredSkills", "Nice to have"],
            ] as const
          ).map(([field, title]) =>
            packet[field].length ? (
              <div key={field} className="mt-3">
                <p className="font-medium">{title}</p>
                <p className="text-[0.8rem] text-faint">{packet.provenance.find((p) => p.field === field)?.source}</p>
                <ul className="mt-1 space-y-1">
                  {packet[field].map((item, i) => (
                    <li key={`${field}-${i}`} className="flex items-start gap-2">
                      <span className="min-w-0 flex-1">{item}</span>
                      <button className="shrink-0 rounded px-1.5 text-[0.8rem] text-faint hover:bg-muted hover:text-bad" onClick={() => removeItem(field, i)} aria-label={`Remove: ${item.slice(0, 60)}`}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
          {packet.education && (
            <p className="mt-3">
              <span className="font-medium">Education asked for: </span>
              {packet.education}
            </p>
          )}
          <p className="mt-3 text-[0.82rem] text-faint">Names, emails, phone numbers, links and anything addressed to an AI were removed. Missing fields were left empty, not guessed.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => onPacket({ ...packet, reviewStatus: "approved", approvedAt: new Date().toISOString() })}>Use these requirements</Button>
            <Button variant="quiet" onClick={() => onPacket(null)}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
