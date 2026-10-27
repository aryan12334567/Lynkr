"use client";

import { useId, useState } from "react";
import { FileText, Laptop, Mail, Upload } from "lucide-react";
import type { Bucket } from "@/lib/schemas";
import type { Account } from "@/lib/auth-client";
import { EMPTY_FIELDS, prefillFrom, readLinkedInPdf, hasEnoughText, type ImportedFields } from "@/lib/pdf/linkedinPdf";
import { readExport, type ImportedProfile } from "@/lib/linkedinExport";
import { Button, Card, ErrorNote, inputCls, Label } from "./ui";

/**
 * Head start (build plan Part 2): the person's own LinkedIn text, so the interview starts above zero
 * and early questions become "confirm or fix". Three ways in: the PDF LinkedIn saves (read here, never
 * uploaded), a structured paste (the phone path), or the data archive. Nothing is kept until they confirm.
 */

export type ImportSource = "pdf" | "paste" | "archive" | "skip";

type Draft = { headline: string; currentRole: string; roles: string; about: string; skills: string };

const roleLine = (e: ImportedFields["experience"][number]) => `${e.title}${e.company ? ` at ${e.company}` : ""}${e.dates ? ` (${e.dates})` : ""}`.trim();

function draftOf(f: ImportedFields): Draft {
  return {
    headline: f.headline,
    currentRole: prefillFrom(f).currentRole,
    roles: f.experience.slice(1).map(roleLine).join("\n"),
    about: f.about,
    skills: f.skills.join(", "),
  };
}

/** "Title at Company (dates)" back into a role. */
function parseRole(line: string): ImportedFields["experience"][number] {
  const m = line.trim().match(/^(.*?)(?:\s+at\s+(.*?))?(?:\s*\(([^)]*)\))?$/);
  return { title: (m?.[1] ?? line).trim().slice(0, 160), company: (m?.[2] ?? "").trim().slice(0, 120), dates: (m?.[3] ?? "").trim().slice(0, 80), description: "" };
}

/** The confirmed boxes, as fields. Role descriptions survive when the line wasn't edited. */
function fieldsOf(d: Draft, base: ImportedFields): ImportedFields {
  const keep = new Map(base.experience.map((e) => [roleLine(e), e]));
  const lines = [d.currentRole, ...d.roles.split("\n")].map((l) => l.trim()).filter(Boolean);
  const experience = lines.slice(0, 10).map((l, i) => {
    const e = keep.get(l) ?? parseRole(l);
    // The first line is the current role; it stays "current" even if the person retyped it.
    return i === 0 && !/present/i.test(e.dates) ? { ...e, dates: e.dates ? `${e.dates}, Present` : "Present" } : e;
  });
  return {
    ...base,
    headline: d.headline.trim().slice(0, 220),
    about: d.about.trim().slice(0, 2600),
    skills: d.skills.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 20),
    experience,
  };
}

function fromArchive(p: ImportedProfile): ImportedFields {
  return {
    ...EMPTY_FIELDS,
    headline: p.headline,
    location: p.location,
    about: p.summary,
    experience: p.positions.slice(0, 10).map((x) => ({ title: x.title, company: x.company, dates: [x.started, x.finished || "Present"].filter(Boolean).join(" - "), description: x.description })),
    education: p.education.slice(0, 6).map((x) => ({ school: x.school, degree: x.degree, dates: [x.started, x.finished].filter(Boolean).join(" - ") })),
    skills: p.skills.slice(0, 20),
  };
}

/** Phones and small tablets: LinkedIn's app can't save a PDF, so lead with the other routes. */
function onPhone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches === true || window.innerWidth < 640;
}

const STEPS = [
  "Open LinkedIn on a laptop or desktop.",
  "Click Me, then View profile.",
  "Click More (or Resources), then Save to PDF.",
  "Upload that file here.",
];

export function ImportStep({
  bucket,
  account,
  onDone,
  onBack,
}: {
  bucket: Bucket;
  account: Account | null;
  onDone: (r: { fields: ImportedFields | null; source: ImportSource }) => void;
  onBack: () => void;
}) {
  const [phone] = useState(onPhone);
  const [mode, setMode] = useState<"choose" | "review" | "paste">("choose");
  const [source, setSource] = useState<ImportSource>("pdf");
  const [base, setBase] = useState<ImportedFields>(EMPTY_FIELDS);
  const [draft, setDraft] = useState<Draft>(draftOf(EMPTY_FIELDS));
  const [busy, setBusy] = useState<"pdf" | "archive" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showLaptop, setShowLaptop] = useState(!phone);
  const id = useId();

  function review(f: ImportedFields, src: ImportSource) {
    setBase(f);
    setDraft(draftOf(f));
    setSource(src);
    setMode("review");
    setError(null);
  }

  async function onPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("pdf");
    setError(null);
    try {
      const f = await readLinkedInPdf(file);
      if (!hasEnoughText(f)) {
        setError("We couldn't find your profile in that PDF. Set your LinkedIn profile language to English and save it again, or paste your profile instead.");
        return;
      }
      review(f, "pdf");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onArchive(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!list.length) return;
    setBusy("archive");
    setError(null);
    try {
      const r = await readExport(await Promise.all(list.map(async (f) => ({ name: f.name, buffer: await f.arrayBuffer() }))));
      const f = fromArchive(r.profile);
      if (!f.headline && !f.experience.length) {
        setError("We couldn't find profile details in those files. Choose the ZIP LinkedIn emailed you, or paste your profile instead.");
        return;
      }
      review(f, "archive");
    } catch {
      setError("Couldn't read those files. Choose the ZIP LinkedIn emailed you, or paste your profile instead.");
    } finally {
      setBusy(null);
    }
  }

  async function emailLink() {
    setBusy("email");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/me/continue-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (res.ok) setNotice(`We've emailed you a link${account?.email ? ` at ${account.email}` : ""}. Open it on your laptop within 15 minutes to carry on there.`);
      else if (res.status === 401) setError("Sign in first, then we can email you the link.");
      else if (res.status === 409) setError("Emailing a link isn't available right now. Paste your profile instead, or open Lynkr on your laptop.");
      else setError("Couldn't send the email. Please try again, or paste your profile instead.");
    } catch {
      setError("Couldn't send the email. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const canConfirm = !!(draft.headline.trim() || draft.currentRole.trim() || draft.about.trim());

  if (mode === "review" || mode === "paste") {
    const pasting = mode === "paste";
    return (
      <Card>
        <h2 className="text-[1.35rem] font-semibold tracking-tight">{pasting ? "Paste your profile" : "Check what we found"}</h2>
        <p className="mt-1 max-w-[60ch] text-[0.95rem] text-soft">
          {pasting
            ? "Copy each part from your LinkedIn profile into its own box. Leave a box empty if you don't have it."
            : "Fix anything that's wrong or delete what you'd rather not use. Only what you keep here goes into your interview."}
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canConfirm) onDone({ fields: fieldsOf(draft, base), source: pasting ? "paste" : source });
          }}
        >
          <label className="block">
            <Label>Headline</Label>
            <input className={inputCls} value={draft.headline} onChange={set("headline")} maxLength={220} placeholder="Inside Sales Lead | B2B SaaS" />
          </label>
          <label className="block">
            <Label hint="title and company">{bucket === "fresher" ? "Current role or course" : "Current role"}</Label>
            <input className={inputCls} value={draft.currentRole} onChange={set("currentRole")} maxLength={200} placeholder={bucket === "fresher" ? "Final-year B.Com at Symbiosis" : "Inside Sales Lead at Zentrix"} />
          </label>
          <label className="block">
            <Label hint="one per line">{pasting ? "Experience" : "Earlier roles"}</Label>
            <textarea className={`${inputCls} min-h-20`} value={draft.roles} onChange={set("roles")} maxLength={2000} placeholder="Senior SDR at Zentrix (2020 - 2022)" />
          </label>
          <label className="block">
            <Label>About</Label>
            <textarea className={`${inputCls} min-h-28`} value={draft.about} onChange={set("about")} maxLength={2600} />
          </label>
          {!pasting && (
            <label className="block">
              <Label hint="separated by commas">Skills</Label>
              <input className={inputCls} value={draft.skills} onChange={set("skills")} maxLength={800} />
            </label>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" disabled={!canConfirm}>
              {pasting ? "Use this" : "Looks right"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("choose")}>
              Back
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  const pdfInput = `${id}-pdf`;
  const zipInput = `${id}-zip`;

  return (
    <Card>
      <h2 className="text-[1.35rem] font-semibold tracking-tight">Start with what you&apos;ve already written</h2>
      <p className="mt-1 max-w-[60ch] text-[0.95rem] text-soft">
        Bring in your LinkedIn profile and the interview skips what we already know. It takes about a minute, and you can skip it.
      </p>

      <div className="mt-5 space-y-5">
        {phone && (
          <section aria-labelledby={`${id}-phone`} className="rounded-xl border border-line bg-accent-wash/60 p-4">
            <h3 id={`${id}-phone`} className="flex items-center gap-2 font-semibold">
              <Laptop size={18} aria-hidden /> On your phone?
            </h3>
            <p className="mt-1 text-[0.92rem] text-soft">LinkedIn&apos;s app can&apos;t save your profile as a PDF. Pick one:</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {account?.signedIn && (
                <Button variant="ghost" onClick={emailLink} disabled={busy !== null}>
                  <Mail size={16} aria-hidden /> {busy === "email" ? "Sending..." : "Email me a link to continue on my laptop"}
                </Button>
              )}
              <Button variant="ghost" onClick={() => (setDraft(draftOf(EMPTY_FIELDS)), setBase(EMPTY_FIELDS), setMode("paste"))}>
                Paste my profile instead
              </Button>
              {!showLaptop && (
                <Button variant="quiet" onClick={() => setShowLaptop(true)}>
                  I&apos;m on a laptop after all
                </Button>
              )}
            </div>
          </section>
        )}

        {showLaptop && (
          <section aria-labelledby={`${id}-pdf-h`}>
            <h3 id={`${id}-pdf-h`} className="flex items-center gap-2 font-semibold">
              <FileText size={18} aria-hidden /> Upload your LinkedIn PDF
            </h3>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s} className="flex gap-3 rounded-lg border border-line bg-bg p-3 text-[0.92rem]">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[0.8rem] font-semibold text-white" aria-hidden>
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <div className="mt-3">
              <label htmlFor={pdfInput} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md bg-accent px-4 py-2 text-[0.95rem] font-medium text-white hover:bg-accent-strong focus-within:outline focus-within:outline-2 focus-within:outline-accent">
                <Upload size={16} aria-hidden /> {busy === "pdf" ? "Reading your PDF..." : "Choose the PDF"}
              </label>
              <input id={pdfInput} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={onPdf} disabled={busy !== null} />
            </div>
            <p className="mt-2 text-[0.88rem] text-faint">Your file stays in this browser. Lynkr never uploads or stores it.</p>
            <details className="mt-2 text-[0.88rem] text-soft">
              <summary className="cursor-pointer">No &quot;Save to PDF&quot; button, or nothing found?</summary>
              <p className="mt-1">Set your LinkedIn profile language to English (Me, then Settings, then Account preferences, then Language), save the PDF again, or paste your profile instead.</p>
            </details>
          </section>
        )}

        <div aria-live="polite">
          {notice && (
            <p role="status" className="rounded-md bg-good/10 px-3 py-2 text-[0.92rem] text-good">
              {notice}
            </p>
          )}
          <ErrorNote message={error} />
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:flex-wrap sm:items-center">
          {!phone && (
            <Button variant="ghost" onClick={() => (setDraft(draftOf(EMPTY_FIELDS)), setBase(EMPTY_FIELDS), setMode("paste"))}>
              Paste my profile instead
            </Button>
          )}
          <details className="text-[0.92rem]">
            <summary className="cursor-pointer py-2 text-soft">I have my LinkedIn data archive</summary>
            <p className="mt-1 text-soft">The ZIP LinkedIn emails when you ask for a copy of your data. Only profile files are read; messages and contacts are skipped.</p>
            <label htmlFor={zipInput} className="mt-2 inline-block text-ink underline underline-offset-4">
              {busy === "archive" ? "Reading..." : "Choose the ZIP or CSV files"}
            </label>
            <input id={zipInput} type="file" accept=".zip,.csv" multiple className="sr-only" onChange={onArchive} disabled={busy !== null} />
          </details>
          <span className="flex gap-2 sm:ml-auto">
            <Button variant="quiet" onClick={onBack}>
              Back
            </Button>
            <Button variant="quiet" onClick={() => onDone({ fields: null, source: "skip" })}>
              Skip for now
            </Button>
          </span>
        </div>
      </div>
    </Card>
  );
}
