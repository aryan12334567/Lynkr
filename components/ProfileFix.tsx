"use client";

import { useMemo, useState } from "react";
import type { ExternalContextPacket, GenerateReply, ProfileInput, StoryFact } from "@/lib/schemas";
import { ExternalContext, type ImportMode } from "./ExternalContext";
import { auditProfile, STATUS_LABEL, topFixes, type FindingStatus, type ProfileFinding } from "@/lib/profileAudit";
import { pick, readExport, SECTION_LABEL, SECTIONS, sectionCount, type ImportedProfile, type ImportResult, type Section } from "@/lib/linkedinExport";
import { PACK } from "@/lib/roles";
import type { DraftEdit } from "@/lib/store";
import { DraftCard, copyText } from "./DraftCard";
import { Button, Card, ErrorNote, Label, Pill, SectionHead, SheetText, inputCls } from "./ui";

const TONE: Record<FindingStatus, "bad" | "warn" | "good" | "neutral" | "accent"> = {
  fix_first: "bad",
  consider: "neutral",
  strong: "good",
  not_applicable: "neutral",
  cannot_assess: "accent",
};

function Finding({ f, done, onDone, numbered }: { f: ProfileFinding; done: boolean; onDone: (v: boolean) => void; numbered?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <li data-finding={f.section} className={`rounded-2xl border border-line bg-surface shadow-sm p-4 ${done ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        {numbered !== undefined && <span className="font-serif text-[1.1rem] font-extrabold text-accent">{numbered}.</span>}
        <h4 className="text-[1rem] font-bold">{f.section}</h4>
        <Pill tone={TONE[f.status]}>{STATUS_LABEL[f.status]}</Pill>
        <span className="ml-auto text-[0.82rem] text-faint">Confidence: {f.confidence}</span>
      </div>
      <p className="mt-2 text-[0.92rem] text-soft">{f.observedSignal}</p>
      <p className="mt-1 text-[0.95rem]">{f.issue}</p>
      <p className="mt-1 text-[0.9rem] text-soft">{f.whyForThisGoal}</p>
      {f.proposedChange && (
        <div className="mt-3">
          <SheetText body={f.proposedChange} fills={[]} className="text-[0.9rem]" />
          {!/\[\[/.test(f.proposedChange) && (
            <Button
              variant="quiet"
              className="mt-1 -ml-2"
              onClick={async () => {
                if (await copyText(f.proposedChange!)) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
            >
              {copied ? "Copied" : "Copy this"}
            </Button>
          )}
        </div>
      )}
      <p className="mt-3 text-[0.92rem]">
        <span className="font-medium">What to do: </span>
        {f.userAction}
      </p>
      {(f.evidenceRefs.length > 0 || f.benchmarkRefs.length > 0) && (
        <p className="mt-2 text-[0.82rem] text-faint">Based on: {[...f.evidenceRefs, ...f.benchmarkRefs].join("; ")}</p>
      )}
      {(f.status === "fix_first" || f.status === "consider") && (
        <label className="mt-3 flex items-center gap-2 text-[0.88rem]">
          <input type="checkbox" className="accent-[var(--accent)]" checked={done} onChange={(e) => onDone(e.target.checked)} />
          Done on LinkedIn
        </label>
      )}
    </li>
  );
}

function ExportImport({ imported, setImported }: { imported: ImportedProfile | null; setImported: (p: ImportedProfile | null) => void }) {
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [keep, setKeep] = useState<Section[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const list = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!list.length) return;
    setBusy(true);
    try {
      const files = await Promise.all(list.map(async (f) => ({ name: f.name, buffer: await f.arrayBuffer() })));
      const r = await readExport(files);
      if (!r.read.length) {
        setError("No profile files found. Use LinkedIn's data export ZIP, or its Profile.csv, Positions.csv, Education.csv or Skills.csv.");
        setPreview(null);
        return;
      }
      setPreview(r);
      setKeep(SECTIONS.filter((s) => sectionCount(r.profile, s) > 0));
    } catch (err) {
      setError((err as Error).message || "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Label>Import your own LinkedIn data export</Label>
      <p className="text-[0.88rem] text-soft">
        In LinkedIn: Settings, Data privacy, Get a copy of your data. Choose the profile data if you can. Lynkr reads it in this browser,
        opens only profile files, and never reads messages, connections or contacts. Nothing is uploaded or saved; reloading the page
        clears it. No LinkedIn password, ever.
      </p>
      <input type="file" accept=".zip,.csv" multiple onChange={onFiles} className="mt-2 text-[0.9rem]" aria-label="Choose your LinkedIn export ZIP or CSV files" />
      {busy && <p className="mt-2 animate-pulse text-[0.9rem] text-soft">Reading…</p>}
      <div className="mt-2">
        <ErrorNote message={error} />
      </div>
      {preview && (
        <div className="mt-3 rounded-md border border-line p-3 text-[0.9rem]" data-import-preview>
          <p className="font-medium">Found in your export. Untick anything you don&apos;t want used.</p>
          <ul className="mt-2 space-y-1">
            {SECTIONS.filter((s) => sectionCount(preview.profile, s) > 0).map((s) => (
              <li key={s}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="accent-[var(--accent)]" checked={keep.includes(s)} onChange={() => setKeep((k) => (k.includes(s) ? k.filter((x) => x !== s) : [...k, s]))} />
                  {SECTION_LABEL[s]} ({sectionCount(preview.profile, s)})
                </label>
              </li>
            ))}
          </ul>
          {preview.skipped.length > 0 && (
            <details className="mt-2 text-faint">
              <summary className="cursor-pointer">{preview.skipped.length} other files not opened</summary>
              <p className="mt-1 break-words">{preview.skipped.slice(0, 40).join(", ")}</p>
            </details>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setImported(pick(preview.profile, keep));
                setPreview(null);
              }}
              disabled={!keep.length}
            >
              Use these
            </Button>
            <Button variant="quiet" onClick={() => setPreview(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {imported && !preview && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.9rem] text-good" data-imported>
          Using your imported profile in this tab.
          <Button variant="quiet" onClick={() => setImported(null)}>
            Remove it
          </Button>
        </p>
      )}
    </div>
  );
}

export function ProfileFix({
  profile,
  facts,
  result,
  fills,
  onFill,
  edits,
  onEdit,
  imported,
  setImported,
  jobDescription,
  setJobDescription,
  done,
  onDone,
  onRewrite,
  mock,
  requirements,
  setRequirements,
  importMode,
}: {
  profile: ProfileInput;
  facts: StoryFact[];
  result: GenerateReply;
  fills: Record<string, string[]>;
  onFill: (id: string, f: string[]) => void;
  edits: Record<string, DraftEdit>;
  onEdit: (id: string, e: DraftEdit | null) => void;
  imported: ImportedProfile | null;
  setImported: (p: ImportedProfile | null) => void;
  jobDescription: string;
  setJobDescription: (s: string) => void;
  done: Record<string, boolean>;
  onDone: (id: string, v: boolean) => void;
  onRewrite: () => void;
  mock: boolean | null;
  requirements: ExternalContextPacket | null;
  setRequirements: (p: ExternalContextPacket | null) => void;
  importMode: ImportMode;
}) {
  const findings = useMemo(
    () => auditProfile({ profile, facts, imported, jobDescription, headlines: result.profile.headlines, about: result.profile.about, requirements }),
    [profile, facts, imported, jobDescription, result, requirements],
  );
  const top = topFixes(findings, profile);
  const rest = findings.filter((f) => !top.includes(f));
  const card = (id: string, title: string, body: string, why: string) => (
    <DraftCard
      key={id}
      kind="profile"
      draft={{ title, body, why, factRefs: [] }}
      fills={fills[id] ?? []}
      onFill={(f) => onFill(id, f)}
      edit={edits[id]}
      onEdit={(e) => onEdit(id, e)}
      facts={facts}
      groundIn={[...facts.filter((f) => f.reviewStatus === "confirmed" && f.useInDrafts).map((f) => f.text), profile.background, profile.targetRole, profile.specialization ?? ""]}
    />
  );

  return (
    <div className="space-y-8">
      <section>
        <SectionHead id="fix-first" title="Fix these first">
          Checked against your goal ({profile.targetRole}), your facts and anything you imported. No score and no ranking: each point says
          what it&apos;s based on. You edit LinkedIn yourself.
        </SectionHead>
        {top.length === 0 ? (
          <Card>
            <p className="text-[0.95rem] text-soft">Nothing urgent from what Lynkr can see. Import your export below for a fuller check.</p>
          </Card>
        ) : (
          <ol className="space-y-3">
            {top.map((f, i) => (
              <Finding key={f.id} f={f} numbered={i + 1} done={!!done[f.id]} onDone={(v) => onDone(f.id, v)} />
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-4">
        <SectionHead title="Headline options">Pick one, fill its blanks, and edit it until it sounds like you.</SectionHead>
        {result.profile.headlines.map((h, i) => card(`profile:headline:${i}`, `Option ${i + 1}`, h, "Role first, then one proof point."))}
        {card("profile:about", "About section", result.profile.about, "Direction, one piece of evidence, then how to reach you.")}
      </section>

      <section>
        <SectionHead title="Every section">Optional sections stay optional. Filling every section isn&apos;t the goal.</SectionHead>
        <ul className="space-y-3">
          {rest.map((f) => (
            <Finding key={f.id} f={f} done={!!done[f.id]} onDone={(v) => onDone(f.id, v)} />
          ))}
        </ul>
      </section>

      <section>
        <Card>
          <h3 className="text-lg font-bold">Make the check sharper</h3>
          <p className="mt-1 text-[0.92rem] text-soft">Both stay in this tab only and are cleared when you reload.</p>
          <div className="mt-5 space-y-6">
            <ExportImport imported={imported} setImported={setImported} />
            <ExternalContext packet={requirements} onPacket={setRequirements} mode={importMode} />
            <label className="block">
              <Label hint="(optional)">A job description you&apos;re targeting</Label>
              <textarea className={`${inputCls} min-h-28`} value={jobDescription} maxLength={6000} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste one posting. Lynkr compares its skills with yours." />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" onClick={onRewrite} disabled={!imported && !jobDescription.trim() && requirements?.reviewStatus !== "approved"}>
                Rewrite drafts using these
              </Button>
              <span className="text-[0.85rem] text-faint">
                {mock ? "Demo mode: the checks above update straight away; the drafts stay templates." : "Sends the fields you chose, the job description and any approved job-page requirements to the AI provider for this one request."}
              </span>
            </div>
          </div>
        </Card>
        <p className="mt-3 text-[0.82rem] text-faint">
          Role patterns: {PACK.note} Checked {PACK.checkedAt}. References:{" "}
          {PACK.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ", "}
              <a className="underline hover:text-ink" href={s.url} target="_blank" rel="noopener noreferrer">
                {s.name}
              </a>
            </span>
          ))}
          .
        </p>
      </section>
    </div>
  );
}
