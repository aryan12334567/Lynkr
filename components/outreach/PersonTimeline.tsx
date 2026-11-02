"use client";

import { useId, useMemo, useState } from "react";
import { Check, Circle, Mic, Square, Undo2 } from "lucide-react";
import { todayIST } from "@/lib/ist";
import type { UiContact } from "@/lib/outreach/ui-board";
import { goalSuccess, replyMeetsGoal } from "@/lib/outreach/ui-goals";
import { useRecorder } from "@/lib/outreach/ui-recorder";
import { boxCls, fieldCls } from "@/lib/outreach/ui-style";
import {
  RECORD_LABEL, WHY_MAX, canWriteIt, completeLabel, completeRequest, dismissRequest, doneDateProblem, moveDateProblem, moveRequest, newOpId, nextStep,
  pendingMeeting, questionFor, recordChoices, recordRequest, stepActions, timeValue, timelineAccess, timelineRows, undoRequest, whyLine, whyProblem,
  type RecordKind, type Send, type TimelineResult, type TimelineRow, type UiEvent,
} from "@/lib/outreach/ui-timeline";
import { Button, ErrorNote, Pill } from "../ui";
import { useSpeech } from "../useSpeech";

const SOURCE_NOTE: Record<string, string> = { comment: "from your comment", finder: "from the finder", connections: "from your connections file", manual: "written by you" };

/**
 * The person's timeline (R38): why you connected, the next step, every step in date order with a text status, and the records
 * you can still add. Replaced steps stay visible; the strike-through is only a look, the words say what happened.
 */
export function PersonTimeline({ contact, events, lapsed, send, onResult, onLapsed, onWriteIt, onSaveWhy }: {
  contact: UiContact;
  /** null while loading. */
  events: UiEvent[] | null;
  lapsed: boolean;
  send: Send;
  onResult: (r: TimelineResult) => void;
  onLapsed: () => void;
  onWriteIt: (e: UiEvent) => void;
  onSaveWhy: (text: string) => Promise<void>;
}) {
  const ids = useId();
  const now = useMemo(() => new Date(), []);
  const today = todayIST(now);
  const access = timelineAccess(lapsed);
  const rec = useRecorder(onResult, onLapsed);
  const [recDay, setRecDay] = useState(today);
  const [dateError, setDateError] = useState<string | null>(null);
  const [answeredNo, setAnsweredNo] = useState<string[]>([]);
  const [changing, setChanging] = useState<{ id: string; meeting: boolean } | null>(null);
  const [moveDay, setMoveDay] = useState("");
  const [moveTime, setMoveTime] = useState("");
  const [booking, setBooking] = useState(false);
  const [meetDay, setMeetDay] = useState("");
  const [meetTime, setMeetTime] = useState("10:00");
  const [tickGoal, setTickGoal] = useState(true);

  if (events === null) return <div role="status" aria-busy="true" className={boxCls}><p className="text-soft">Loading the timeline</p><div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-muted" /><div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-muted" /></div>;

  const rows = timelineRows(events, now);
  const next = nextStep(events);
  const live = events.filter((e) => e.status !== "superseded" && e.kind !== "why");
  const card = pendingMeeting(events, now);
  const choices = recordChoices(contact.status, { hasEvents: live.length > 0, pendingMeeting: Boolean(card) });
  const isNew = contact.status === "to_contact" && live.length === 0;
  const why = whyLine(contact);
  const disabled = rec.busy || !access.canRecord;

  function tap(req: Parameters<Send>[0], extra?: () => Parameters<Send>[0]) {
    void rec.run(async () => { const r = await send(req); return extra ? send(extra()) : r; });
  }
  function record(kind: RecordKind) {
    setDateError(null);
    if (kind === "meeting_booked") { setBooking(true); return; }
    const op = newOpId();
    const made = recordRequest(contact.id, kind, recDay, op, undefined, today);
    if (!made.ok) { setDateError(made.message); return; }
    const goal = kind === "reply" && tickGoal && replyMeetsGoal(contact.goal);
    tap(made.req, goal ? () => ({ route: "timeline", contactId: contact.id, body: { type: "insert", op_id: `${op}:goal`, contactId: contact.id, kind: "goal_reached", status: "done", doneAt: recDay } }) : undefined);
  }
  function saveMeeting() {
    const made = recordRequest(contact.id, "meeting_booked", meetDay, newOpId(), meetTime, today);
    if (!made.ok) { setDateError(made.message); return; }
    setDateError(null); setBooking(false);
    tap(made.req);
  }
  function answerYes(kind: "reply" | "accepted", e: UiEvent) {
    const made = recordRequest(contact.id, kind, today, newOpId(), undefined, today);
    if (made.ok) tap(made.req);
    else complete(e);
  }
  function complete(e: UiEvent) {
    const problem = doneDateProblem(recDay, today);
    if (problem) { setDateError(problem); return; }
    setDateError(null);
    tap(completeRequest(contact.id, e.id, recDay));
  }
  function saveMove() {
    if (!changing) return;
    const problem = moveDateProblem(moveDay, today);
    if (problem) { setDateError(problem); return; }
    if (changing.meeting && !moveTime) { setDateError("Pick the time of the meeting."); return; }
    setDateError(null);
    const req = moveRequest(contact.id, changing.id, moveDay, changing.meeting ? moveTime : undefined, newOpId());
    setChanging(null);
    tap(req);
  }
  function openMove(e: UiEvent) {
    setChanging({ id: e.id, meeting: e.kind === "meeting_booked" });
    const at = e.kind === "meeting_booked" ? e.meetingAt : e.dueAt;
    setMoveDay(at ? todayIST(new Date(at)) : today);
    setMoveTime(e.kind === "meeting_booked" && e.meetingAt ? timeValue(e.meetingAt) : "");
    setDateError(null);
  }

  const dateEditor = (meeting: boolean) => (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <label className="block"><span className="mb-1 block text-[0.88rem]">New day</span><input type="date" className={fieldCls} min={today} value={moveDay} onChange={(e) => setMoveDay(e.target.value)} /></label>
      {meeting && <label className="block"><span className="mb-1 block text-[0.88rem]">New time (India time)</span><input type="time" className={fieldCls} value={moveTime} onChange={(e) => setMoveTime(e.target.value)} /></label>}
      <Button disabled={disabled} onClick={saveMove}>Save date</Button>
      <Button variant="quiet" onClick={() => { setChanging(null); setDateError(null); }}>Cancel</Button>
    </div>
  );
  const rowActions = (row: TimelineRow) => {
    const e = row.event;
    const upcomingMeeting = e.kind === "meeting_booked" && row.tone === "scheduled" && e.meetingAt && new Date(e.meetingAt) > now;
    if (!access.canRecord) return null;
    if (changing?.id === e.id) return dateEditor(changing.meeting);
    const acts = stepActions(row);
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {acts.includes("change_date") && <Button variant="ghost" disabled={disabled} onClick={() => openMove(e)}>Change date<span className="sr-only">: {row.label}</span></Button>}
        {acts.includes("not_now") && <Button variant="ghost" disabled={disabled} onClick={() => tap(dismissRequest(contact.id, e.id))}>Not now<span className="sr-only">: {row.label}</span></Button>}
        {upcomingMeeting && <Button variant="ghost" disabled={disabled} onClick={() => openMove(e)}>Change date<span className="sr-only">: {row.label}</span></Button>}
        {row.tone === "done" && e.kind !== "why" && <Button variant="quiet" disabled={disabled} onClick={() => tap(undoRequest(contact.id, e.id))}><Undo2 size={15} aria-hidden /> Undo<span className="sr-only">: {row.label}</span></Button>}
      </div>
    );
  };

  const q = next ? questionFor(next, events, contact.name) : null;
  const asking = q && next && !answeredNo.includes(next.id);
  const nextRow = next ? rows.find((r) => r.event.id === next.id) : undefined;

  return (
    <div className="space-y-4">
      <WhyEditor contact={contact} line={why} canEdit={access.canRecord} onSave={onSaveWhy} />

      {!access.canRecord && (
        <p role="note" className="rounded-lg border border-line bg-muted/50 p-3 text-[0.95rem]">
          {access.notice}. You can still read everything below.
        </p>
      )}

      <div aria-live="polite" className="space-y-2">
        {dateError && <p role="alert" className="rounded-md border border-bad/30 bg-bad/10 px-3 py-2 text-[0.92rem] text-bad">{dateError}</p>}
        {rec.failed && (
          <div className="flex flex-wrap items-center gap-2">
            <ErrorNote message={rec.failed} />
            <Button variant="ghost" onClick={() => void rec.retry()} disabled={rec.busy}>Retry</Button>
          </div>
        )}
        {rec.busy && <p role="status" className="text-[0.9rem] text-soft">Saving</p>}
      </div>

      {contact.goalReachedAt && <p className="rounded-lg border border-good/40 bg-good/10 p-3 text-[0.95rem]"><strong>Goal reached</strong>{goalSuccess(contact.goal) ? `: ${goalSuccess(contact.goal)}` : ""}. This timeline is finished.</p>}
      {contact.closedAt && !contact.goalReachedAt && <p className="rounded-lg border border-line bg-muted/50 p-3 text-[0.95rem]"><strong>Closed.</strong> This timeline is finished.</p>}

      {next && nextRow && !contact.goalReachedAt && !contact.closedAt && (
        <section aria-labelledby={`${ids}-next`} className="rounded-xl border-2 border-accent/50 p-4">
          <h4 id={`${ids}-next`} className="font-bold">Next step: {nextRow.label}</h4>
          <p className="text-[0.88rem] text-soft">{nextRow.statusText}</p>
          {next.rule && <p className="mt-1 text-[0.95rem]">{next.rule}</p>}
          {access.canRecord && (
            changing?.id === next.id ? dateEditor(false) : (
              <div className="mt-3 space-y-2">
                {asking ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{q.ask}</p>
                    <Button disabled={disabled} onClick={() => answerYes(q.yes, next)}>{q.yesLabel}</Button>
                    <Button variant="ghost" disabled={disabled} onClick={() => setAnsweredNo((a) => [...a, next.id])}>{q.noLabel}</Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-end gap-2">
                    {canWriteIt(next) && <Button disabled={rec.busy} onClick={() => onWriteIt(next)}>Write it</Button>}
                    <label className="block"><span className="mb-1 block text-[0.88rem]">Date it happened</span><input type="date" className={fieldCls} max={today} value={recDay} onChange={(e) => setRecDay(e.target.value)} aria-invalid={Boolean(dateError) || undefined} /></label>
                    <Button variant={canWriteIt(next) ? "ghost" : "primary"} disabled={disabled} onClick={() => complete(next)}>{completeLabel(next.kind)}</Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" disabled={disabled} onClick={() => openMove(next)}>Change date<span className="sr-only">: {nextRow.label}</span></Button>
                  <Button variant="ghost" disabled={disabled} onClick={() => tap(dismissRequest(contact.id, next.id))}>Not now<span className="sr-only">: {nextRow.label}</span></Button>
                </div>
              </div>
            )
          )}
        </section>
      )}

      {rows.length > 0 && (
        <section aria-labelledby={`${ids}-tl`}>
          <h4 id={`${ids}-tl`} className="mb-2 font-bold">Timeline</h4>
          <ol className="space-y-3">
            {rows.map((row) => (
              <li key={row.event.id} className="flex gap-3">
                <span aria-hidden className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${row.tone === "done" ? "border-good/50 bg-good/10 text-good" : row.tone === "superseded" ? "border-line text-faint" : "border-accent/50 text-accent"}`}>
                  {row.tone === "done" ? <Check size={14} /> : row.tone === "superseded" ? <span>-</span> : <Circle size={10} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words">
                    <span className={row.struck ? "text-soft line-through" : "font-medium"}>{row.label}</span>
                    <span className="sr-only">, </span>
                    <span className="text-[0.92rem] text-soft"> {row.statusText}</span>
                    {row.onCalendar && <Pill tone="accent" className="ml-2">On Calendar</Pill>}
                    {next?.id === row.event.id && <Pill className="ml-2">Next step</Pill>}
                  </p>
                  {row.detail && <p className="text-[0.88rem] text-soft">{row.detail}</p>}
                  {row.reason && next?.id !== row.event.id && <p className="text-[0.88rem] text-soft">{row.reason}</p>}
                  {row.noteLine && <p className="mt-1 rounded bg-muted/50 px-2 py-1 text-[0.9rem]">{row.noteLine}</p>}
                  {next?.id !== row.event.id && rowActions(row)}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {access.canRecord && choices.length > 0 && !contact.goalReachedAt && !contact.closedAt && (
        isNew ? (
          <div className={boxCls}>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block"><span className="mb-1 block text-[0.88rem]">Date it happened</span><input type="date" className={fieldCls} max={today} value={recDay} onChange={(e) => setRecDay(e.target.value)} aria-invalid={Boolean(dateError) || undefined} /></label>
              <Button disabled={disabled} onClick={() => record("invite_sent")}>Record Invite sent</Button>
            </div>
          </div>
        ) : (
          <details className={boxCls}>
            <summary className="min-h-10 cursor-pointer py-2 font-medium">Record something else</summary>
            <div className="mt-2 space-y-3">
              <label className="block"><span className="mb-1 block text-[0.88rem]">Date it happened</span><input type="date" className={fieldCls} max={today} value={recDay} onChange={(e) => setRecDay(e.target.value)} aria-invalid={Boolean(dateError) || undefined} /></label>
              <div className="flex flex-wrap gap-2">
                {choices.map((k) => <Button key={k} variant="ghost" disabled={disabled} onClick={() => record(k)}>{RECORD_LABEL[k]}</Button>)}
              </div>
              {choices.includes("reply") && replyMeetsGoal(contact.goal) && (
                <label className="flex min-h-10 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={tickGoal} onChange={(e) => setTickGoal(e.target.checked)} /><span>A reply also meets your goal ({goalSuccess(contact.goal)})</span></label>
              )}
              {booking && (
                <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-3">
                  <label className="block"><span className="mb-1 block text-[0.88rem]">Meeting day</span><input type="date" className={fieldCls} value={meetDay} onChange={(e) => setMeetDay(e.target.value)} /></label>
                  <label className="block"><span className="mb-1 block text-[0.88rem]">Time (India time)</span><input type="time" className={fieldCls} value={meetTime} onChange={(e) => setMeetTime(e.target.value)} /></label>
                  <Button disabled={disabled} onClick={saveMeeting}>Save meeting</Button>
                  <Button variant="quiet" onClick={() => setBooking(false)}>Cancel</Button>
                </div>
              )}
            </div>
          </details>
        )
      )}
    </div>
  );
}

function WhyEditor({ contact, line, canEdit, onSave }: { contact: UiContact; line: { text: string; empty: boolean }; canEdit: boolean; onSave: (text: string) => Promise<void> }) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const speech = useSpeech((t) => setText((x) => `${x}${x && !x.endsWith(" ") ? " " : ""}${t}`));
  const problem = whyProblem(text);
  async function save() {
    if (problem) return;
    setBusy(true); setError(null);
    try { await onSave(text.trim()); setEditing(false); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 basis-60 break-words">
          {line.empty ? <span className="text-soft">Why you connected: not added yet.</span> : <span>{line.text}</span>}
          {!line.empty && contact.whySource && <span className="text-[0.85rem] text-soft"> ({SOURCE_NOTE[contact.whySource]})</span>}
        </p>
        {canEdit && <Button variant="quiet" onClick={() => { setText(contact.whyText ?? ""); setEditing(true); }}>{line.empty ? "Add why" : "Edit why"}</Button>}
      </div>
    );
  }
  return (
    <div className={boxCls}>
      <label htmlFor={id} className="mb-1 block font-medium">Why you connected <span className="font-normal text-soft">(one line, optional)</span></label>
      <input id={id} className={fieldCls} value={text} onChange={(e) => setText(e.target.value)} aria-describedby={`${id}-count`} aria-invalid={Boolean(problem) || undefined} autoFocus />
      <p id={`${id}-count`} className={`mt-1 text-[0.85rem] ${problem ? "text-bad" : "text-soft"}`}>{text.length} / {WHY_MAX}{problem ? `. ${problem}` : ""}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button disabled={busy || Boolean(problem)} onClick={save}>Save</Button>
        <Button variant="quiet" onClick={() => setEditing(false)}>Cancel</Button>
        {speech.supported && (
          <Button variant="ghost" aria-pressed={speech.listening} onClick={speech.listening ? speech.stop : speech.start}>
            {speech.listening ? <><Square size={14} aria-hidden /> Stop listening</> : <><Mic size={14} aria-hidden /> Say it instead</>}
          </Button>
        )}
      </div>
      <div aria-live="polite">{speech.error && <p role="status" className="mt-1 text-[0.88rem] text-soft">{speech.error}</p>}<ErrorNote message={error} /></div>
    </div>
  );
}
