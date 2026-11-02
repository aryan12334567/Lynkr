"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DraftResult, DraftVersion } from "@/lib/outreach/draft";
import { api } from "@/lib/outreach/ui-api";
import type { UiContact } from "@/lib/outreach/ui-board";
import { CHANNEL_OPTIONS, angleLabel, canCopy, profileLink, sentPlan, verdictTone, type ChannelId } from "@/lib/outreach/ui-person";
import { boxCls, chipCls } from "@/lib/outreach/ui-style";
import { Button, ErrorNote, Label, Pill, inputCls } from "../ui";
import { copyText } from "../DraftCard";

export type SentPlan = ReturnType<typeof sentPlan>;

/**
 * Two or three complete messages for this person, each already checked (R15, R17). Nothing is sent for you:
 * copy one, send it yourself on LinkedIn, then tap Mark sent. "Write it" on a timeline step opens here with that step.
 */
export function DraftVersions({ contact, readOnly, step, runKey, onMarkSent }: {
  contact: UiContact;
  /** Writing needs a subscription. */
  readOnly: boolean;
  /** A suggested step to write the message for. */
  step: { eventId: string; label: string } | null;
  /** Bump to write straight away (used by "Write it"). */
  runKey: number;
  onMarkSent: (plan: SentPlan, version: DraftVersion, result: DraftResult, step: { eventId: string } | null) => Promise<boolean>;
}) {
  const ids = useId();
  const [channel, setChannel] = useState<ChannelId>(step ? "linkedin_message" : "connection_note");
  const [result, setResult] = useState<DraftResult | null>(null);
  const [forStep, setForStep] = useState<{ eventId: string; label: string } | null>(null);
  const [notesLeft, setNotesLeft] = useState<number | undefined>(undefined);
  const [sent, setSent] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const link = profileLink(contact);

  async function write(opts: { channel?: ChannelId; forceNote?: boolean; answer?: { key: string; text: string }; forStep?: typeof step } = {}) {
    const useStep = opts.forStep === undefined ? forStep : opts.forStep;
    const ch = opts.channel ?? (useStep && channel === "connection_note" ? "linkedin_message" : channel);
    setBusy(true); setError(null); setMessage("");
    try {
      const r = await api<DraftResult>("POST", "/api/outreach/draft", {
        contactId: contact.id, channel: ch, ...(opts.forceNote ? { forceNote: true } : {}), ...(opts.answer ? { answer: opts.answer } : {}), ...(useStep ? { eventId: useStep.eventId } : {}),
      });
      setChannel(ch); setForStep(useStep ?? null); setResult(r); setSent([]); setAnswer("");
      if (r.notesLeft !== undefined) setNotesLeft(r.notesLeft);
      setMessage(`${r.versions.length} ${r.versions.length === 1 ? "message" : "messages"} ready to review.`);
      heading.current?.focus();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const first = useRef(runKey);
  useEffect(() => {
    if (runKey === first.current) return;
    first.current = runKey;
    void write({ forStep: step, channel: "linkedin_message" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  async function copy(v: DraftVersion, open: boolean) {
    if (open) window.open(link.href, "_blank", "noopener,noreferrer");
    setMessage((await copyText(v.body)) ? `Copied.${open ? " Your LinkedIn tab is open." : ""} Review it and send it yourself.` : "Copy was blocked. Select the text and copy it yourself.");
  }
  async function markSent(v: DraftVersion, i: number) {
    if (!result) return;
    const plan = sentPlan(result, notesLeft);
    if (await onMarkSent(plan, v, result, forStep ? { eventId: forStep.eventId } : null)) {
      setSent((s) => [...s, i]); setNotesLeft(plan.notesLeft);
      setMessage(plan.noteUsed && plan.notesLeft !== undefined ? `Marked sent. You have ${plan.notesLeft} ${plan.notesLeft === 1 ? "note" : "notes"} left this month.` : "Marked sent.");
    }
  }

  const channels = CHANNEL_OPTIONS.filter((c) => !forStep || c.id !== "connection_note");
  return (
    <section aria-labelledby={`${ids}-h`} className={boxCls}>
      <h3 id={`${ids}-h`} ref={heading} tabIndex={-1} className="font-bold">{forStep ? `Write: ${forStep.label}` : "Write a message"}</h3>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Where will you send it?">
        {channels.map((c) => <button key={c.id} type="button" aria-pressed={channel === c.id} onClick={() => setChannel(c.id)} className={chipCls(channel === c.id)}>{c.label}</button>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button disabled={busy || readOnly} onClick={() => write()}>{busy ? "Writing" : result ? "Write again" : "Write a message"}</Button>
        {forStep && <Button variant="quiet" onClick={() => { setForStep(null); setResult(null); setChannel("connection_note"); }}>Write a first message instead</Button>}
        {readOnly && <span className="text-[0.88rem] text-soft">Subscribe to write messages.</span>}
      </div>
      <div aria-live="polite" className="mt-2 space-y-2">
        {message && <p role="status" className="text-[0.92rem] text-soft">{message}</p>}
        <ErrorNote message={error} />
      </div>

      {result && (
        <div className="mt-3 space-y-3">
          <p className="text-[0.95rem]">{result.recommendation}</p>
          {result.notesLeft !== undefined || notesLeft !== undefined ? <p className="text-[0.9rem] text-soft">Notes left this month: {notesLeft ?? result.notesLeft}</p> : null}
          {result.canWriteNote && result.advice === "blank_invite" && result.channel !== "connection_note" && (
            <Button variant="ghost" disabled={busy || readOnly} onClick={() => write({ channel: "connection_note", forceNote: true })}>Write a note anyway</Button>
          )}
          <ol className="space-y-3">
            {result.versions.map((v, i) => (
              <li key={i} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[0.95rem] font-medium">Version {i + 1}: {angleLabel(v.angle)}</h4>
                  <Pill tone={verdictTone(v.verdict)}>{v.verdict}</Pill>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words">{v.body}</p>
                {!canCopy(v.verdict) && <p className="mt-1 text-[0.88rem] text-soft">This one can&apos;t be used as it is. Write again, or pick another version.</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="ghost" disabled={!canCopy(v.verdict)} onClick={() => copy(v, false)}>Copy<span className="sr-only"> version {i + 1}</span></Button>
                  <Button variant="ghost" disabled={!canCopy(v.verdict)} onClick={() => copy(v, true)}>{link.known ? "Copy and open profile" : "Copy and find on LinkedIn"}<span className="sr-only"> for version {i + 1}</span></Button>
                  <Button disabled={!canCopy(v.verdict) || readOnly || sent.includes(i)} onClick={() => markSent(v, i)}>{sent.includes(i) ? "Marked sent" : "Mark sent"}<span className="sr-only"> version {i + 1}</span></Button>
                </div>
              </li>
            ))}
          </ol>
          {result.strongerQuestion && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-[0.95rem] font-medium">{result.strongerQuestion}</p>
              <p className="text-[0.85rem] text-soft">Optional. Your answer is saved so we don&apos;t ask again, and the messages are written again with it.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.strongerOptions.map((o) => <Button key={o} variant="ghost" disabled={busy || readOnly} onClick={() => write({ answer: { key: result.strongerKey, text: o } })}>{o}</Button>)}
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1 basis-56"><Label>Or type your own answer</Label><input className={inputCls} maxLength={200} value={answer} onChange={(e) => setAnswer(e.target.value)} /></label>
                <Button variant="ghost" disabled={busy || readOnly || !answer.trim()} onClick={() => write({ answer: { key: result.strongerKey, text: answer.trim() } })}>Use my answer</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
