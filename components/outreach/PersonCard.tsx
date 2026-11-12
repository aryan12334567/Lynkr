"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayIST } from "@/lib/ist";
import type { DraftVersion } from "@/lib/outreach/draft";
import { api } from "@/lib/outreach/ui-api";
import type { UiContact } from "@/lib/outreach/ui-board";
import { GOAL_CHIPS, goalLabel } from "@/lib/outreach/ui-goals";
import { DEMO_NOTICE } from "@/lib/outreach/ui-demo";
import { INTENTS, angleValue, profileLink } from "@/lib/outreach/ui-person";
import { useRecorder } from "@/lib/outreach/ui-recorder";
import { boxCls, chipCls, linkCls } from "@/lib/outreach/ui-style";
import { completeRequest, newOpId, pendingMeeting, recordRequest, stepLabel, timelineAccess, type Send, type TimelineResult, type UiEvent } from "@/lib/outreach/ui-timeline";
import { Button, Card, ErrorNote, Pill } from "../ui";
import { BriefPanel } from "./BriefPanel";
import { DraftVersions, type SentPlan } from "./DraftVersions";
import { MeetingCard } from "./MeetingCard";
import { PersonTimeline } from "./PersonTimeline";
import { CommentBridge } from "./CommentBridge";

/** Meeting cards hidden with "Later" stay hidden until the page is reloaded (R41). */
const hiddenForSession = new Set<string>();

/**
 * Everything about one person, in the order R38 gives: a meeting that needs answering, why you connected, the next step,
 * the timeline, then what we know about them and the messages. The stage is never picked by hand; it follows the timeline.
 */
export function PersonCard({ contact, events, example, lapsed, send, onTimeline, onContact, onLapsed }: {
  contact: UiContact;
  events: UiEvent[] | null;
  /** The made-up example person: nothing is saved. */
  example: boolean;
  lapsed: boolean;
  send: Send;
  onTimeline: (r: TimelineResult) => void;
  onContact: (c: UiContact) => void;
  onLapsed: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [, bump] = useState(0);
  const [step, setStep] = useState<{ eventId: string; label: string } | null>(null);
  const [runKey, setRunKey] = useState(0);
  const now = useMemo(() => new Date(), []);
  const access = timelineAccess(lapsed);
  const link = profileLink(contact);
  const card = events ? pendingMeeting(events, now) : null;
  const sentRec = useRecorder(onTimeline, onLapsed);

  useEffect(() => { heading.current?.focus(); }, []);

  const patch = useCallback(async (data: Record<string, unknown>) => {
    if (example) { onContact({ ...contact, ...data } as UiContact); return; }
    const r = await api<{ contact: UiContact }>("PATCH", "/api/outreach/contacts", { id: contact.id, ...data });
    onContact(r.contact);
  }, [contact, example, onContact]);

  async function change(data: Record<string, unknown>) {
    setError(null);
    try { await patch(data); } catch (e) { setError((e as Error).message); }
  }

  function markSent(plan: SentPlan, version: DraftVersion, _result: unknown, forStep: { eventId: string } | null): Promise<boolean> {
    void _result;
    const today = todayIST();
    if (forStep) return sentRec.run(() => send(completeRequest(contact.id, forStep.eventId, today)));
    const made = recordRequest(contact.id, plan.kind, today, newOpId(), undefined, today);
    if (!made.ok) { setError(made.message); return Promise.resolve(false); }
    return sentRec.run(async () => {
      await patch({ angleUsed: angleValue(version.angle), ...(plan.noteUsed ? { noteUsed: true } : {}) });
      return send(made.req);
    });
  }

  function writeIt(e: UiEvent) {
    setStep({ eventId: e.id, label: stepLabel(e, events ?? []) });
    setRunKey((k) => k + 1);
  }

  async function saveWhy(text: string) {
    await patch({ whyText: text || null, whySource: text ? "manual" : null });
  }

  return (
    <Card className="space-y-4">
      <div>
        <h3 ref={heading} tabIndex={-1} className="text-xl font-bold">{contact.name}</h3>
        <p className="text-soft">{[contact.role, contact.company].filter(Boolean).join(" at ") || goalLabel(contact.goal)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <a className={linkCls} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<span className="sr-only"> for {contact.name} (opens in a new tab)</span></a>
          {contact.tier === "tier_1" && <Pill tone="accent">Tier 1</Pill>}
          {example && <Pill>Example</Pill>}
        </div>
        {example && <p role="note" className="mt-1 text-[0.88rem] text-soft">{DEMO_NOTICE}</p>}
      </div>

      {card && !hiddenForSession.has(card.id) && (
        <MeetingCard contactId={contact.id} name={contact.name} goal={contact.goal} booked={card} send={send} onResult={onTimeline}
          onLater={() => { hiddenForSession.add(card.id); bump((n) => n + 1); }} canRecord={access.canRecord} onLapsed={onLapsed} />
      )}

      <fieldset className={boxCls} disabled={!access.canRecord}>
        <legend className="px-1 text-[0.92rem] font-medium">Goal for {contact.name}</legend>
        <div className="flex flex-wrap gap-2">
          {GOAL_CHIPS.map((g) => <button key={g.id} type="button" aria-pressed={contact.goal === g.id} onClick={() => change({ goal: g.id })} className={chipCls(contact.goal === g.id)}>{g.label}</button>)}
        </div>
        <p className="mb-1 mt-3 text-[0.92rem] font-medium">What this message asks for</p>
        <div className="flex flex-wrap gap-2">
          {INTENTS.map((i) => <button key={i.id} type="button" aria-pressed={contact.intent === i.id} onClick={() => change({ intent: i.id })} className={chipCls(contact.intent === i.id)}>{i.label}</button>)}
        </div>
        {error && <div className="mt-2"><ErrorNote message={error} /></div>}
      </fieldset>

      {!example && <CommentBridge contactId={contact.id} name={contact.name} lapsed={lapsed} />}
      <PersonTimeline contact={contact} events={events} lapsed={lapsed} send={send} onResult={onTimeline} onLapsed={onLapsed} onWriteIt={writeIt} onSaveWhy={saveWhy} />

      <BriefPanel contact={contact} disabled={!access.canRecord || example} onContact={onContact} />

      <DraftVersions contact={contact} readOnly={!access.canRecord} step={step} runKey={runKey} onMarkSent={markSent} />
      {sentRec.failed && (
        <div className="flex flex-wrap items-center gap-2">
          <ErrorNote message={sentRec.failed} />
          <Button variant="ghost" onClick={() => void sentRec.retry()} disabled={sentRec.busy}>Retry</Button>
        </div>
      )}
    </Card>
  );
}
