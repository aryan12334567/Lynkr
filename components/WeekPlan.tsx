"use client";

import { useEffect, useState } from "react";
import type { Draft, GenerateReply } from "@/lib/schemas";
import { openSlots, parseSlots, renderFilled } from "@/lib/slots";
import { addDays, formatDay, formatMonth, istToUTC, mondayOf, todayIST } from "@/lib/ist";
import {
  TAG_LABEL,
  addFollowUp,
  followUpDue,
  hasFollowUp,
  planForWeek,
  setStatus,
  updateItem,
  withCounts,
  type Plan,
  type PlanChange,
  type PlanItem,
  type Tag,
} from "@/lib/plan";
import { downloadIcs, googleCalendarUrl, type CalEvent } from "@/lib/ics";
import { postJson } from "@/lib/store";
import { Button, Card, ErrorNote, inputCls } from "./ui";

const TAG_CLS: Record<Tag, string> = {
  proof: "bg-accent/15 text-accent",
  setback: "bg-warn/15 text-warn",
  observation: "bg-good/15 text-good",
  comment: "bg-muted text-soft",
  outreach: "bg-accent/10 text-accent-strong",
  follow_up: "bg-bad/10 text-bad",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function draftFor(result: GenerateReply, draftId: string): Draft | null {
  const [kind, key] = draftId.split(":");
  if (kind === "post") return result.posts[Number(key)] ?? null;
  if (kind === "comment") return result.comments[Number(key)] ?? null;
  if (draftId === "out:stranger") return result.outreach.stranger ?? null;
  if (draftId === "out:alumni") return result.outreach.alumni ?? null;
  if (draftId === "out:referral") return result.outreach.referral;
  if (draftId === "out:hm") return result.outreach.hiring_manager;
  if (draftId === "out:follow") return result.outreach.follow_up;
  return null;
}

const isMessage = (it: PlanItem) => it.kind === "message" || it.kind === "follow_up";
const doneLabel = (it: PlanItem) => (isMessage(it) ? "Sent" : "Posted");

export function WeekPlan({
  plan,
  onPlan,
  result,
  fills,
}: {
  plan: Plan;
  onPlan: (p: Plan) => void;
  result: GenerateReply;
  fills: Record<string, string[]>;
}) {
  const [view, setView] = useState<"week" | "month">("week");
  const [offset, setOffset] = useState(0);
  const [chat, setChat] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [notify, setNotify] = useState(false);

  const shownWeek = addDays(plan.weekStart, offset * 7);
  const today = todayIST();

  // Reminder in this tab: a browser notification when a scheduled item's time arrives.
  useEffect(() => {
    if (!notify) return;
    const tick = () => {
      const now = Date.now();
      const due = plan.items.filter(
        (it) => it.status === "scheduled" && !plan.notified.includes(it.id) && istToUTC(it.day, it.time).getTime() <= now,
      );
      if (due.length === 0) return;
      for (const it of due) {
        new Notification(`Lynkr: ${titleFor(it)}`, { body: "Open Lynkr, copy the draft and post or send it yourself." });
      }
      onPlan({ ...plan, notified: [...plan.notified, ...due.map((d) => d.id)] });
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  });

  function titleFor(it: PlanItem): string {
    const d = draftFor(result, it.draftId);
    const verb = it.kind === "post" ? "Post" : it.kind === "comment" ? "Comment" : it.kind === "follow_up" ? "Send follow-up" : "Send outreach";
    return `${verb}: ${d?.title ?? TAG_LABEL[it.tag]}`;
  }

  function eventFor(it: PlanItem): CalEvent {
    const d = draftFor(result, it.draftId);
    const f = fills[it.draftId] ?? [];
    let description = "Draft not found. Open Lynkr.";
    if (d) {
      description =
        openSlots(d.body, f) === 0
          ? renderFilled(d.body, f)
          : parseSlots(d.body).map((s) => (s.type === "text" ? s.text : (f[s.index] ?? "").trim() || `[${s.label}]`)).join("") +
            "\n\nFill the blanks in Lynkr before posting.";
    }
    return { uid: `${plan.weekStart}-${it.id}`, title: titleFor(it), description: `${description}\n\nYou post or send this yourself. Lynkr never posts for you.`, day: it.day, time: it.time };
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chat.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const change = await postJson<PlanChange>("/api/plan", { text: chat.trim(), counts: plan.counts, times: plan.times });
      if (change.understood) onPlan(withCounts(plan, change.counts, change.times));
      setReply(change.reply);
      if (change.understood) setChat("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function enableNotify() {
    if (typeof Notification === "undefined") {
      setError("This browser can't show notifications. Use the calendar files instead.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") setNotify(true);
    else setError("Notifications are blocked. Use the calendar files instead.");
  }

  const weekItems = (week: string) => plan.items.filter((it) => it.day >= week && it.day <= addDays(week, 6));
  const open = plan.items.filter((it) => it.status !== "done");

  function renderItem(it: PlanItem) {
    const d = draftFor(result, it.draftId);
    const blanks = d ? openSlots(d.body, fills[it.draftId] ?? []) : 0;
    const ev = eventFor(it);
    const due = followUpDue(it);
    return (
      <div key={it.id} data-item={it.id} className={`rounded-lg border border-line bg-surface p-3 text-sm ${it.status === "done" ? "opacity-70" : ""}`}>
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TAG_CLS[it.tag]}`}>{TAG_LABEL[it.tag]}</span>
          <span className="text-xs text-faint">{it.time} IST</span>
          <span className="ml-auto text-xs font-medium text-soft">
            {it.status === "draft" ? "Draft" : it.status === "scheduled" ? "Scheduled" : doneLabel(it)}
          </span>
        </div>
        <p className="mb-2 font-medium leading-snug">{d?.title ?? TAG_LABEL[it.tag]}</p>
        {blanks > 0 && it.status !== "done" && (
          <p className="mb-2 text-xs text-warn">
            {blanks} blank{blanks === 1 ? "" : "s"} to fill in the draft
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {it.status === "draft" && (
            <button className="rounded border border-line px-2 py-1 text-xs hover:bg-muted" onClick={() => onPlan(setStatus(plan, it.id, "scheduled"))}>
              Schedule
            </button>
          )}
          {it.status === "scheduled" && (
            <button className="rounded border border-line px-2 py-1 text-xs hover:bg-muted" onClick={() => onPlan(setStatus(plan, it.id, "done"))}>
              Mark {doneLabel(it).toLowerCase()}
            </button>
          )}
          {it.status !== "draft" && (
            <button className="rounded px-2 py-1 text-xs text-faint hover:bg-muted" onClick={() => onPlan(setStatus(plan, it.id, "draft"))}>
              Back to draft
            </button>
          )}
          <button className="rounded px-2 py-1 text-xs text-faint hover:bg-muted" onClick={() => setEditing(editing === it.id ? null : it.id)} aria-expanded={editing === it.id}>
            Move
          </button>
        </div>

        {editing === it.id && (
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="text-xs text-soft">
              Day
              <select
                className={`${inputCls} mt-1 py-1`}
                value={it.day}
                onChange={(e) => onPlan(updateItem(plan, it.id, { day: e.target.value }))}
              >
                {WEEKDAYS.map((w, i) => {
                  const day = addDays(mondayOf(it.day), i);
                  return (
                    <option key={day} value={day}>
                      {formatDay(day)}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="text-xs text-soft">
              Time (IST)
              <input
                type="time"
                className={`${inputCls} mt-1 py-1`}
                value={it.time}
                onChange={(e) => e.target.value && onPlan(updateItem(plan, it.id, { time: e.target.value }))}
              />
            </label>
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <button className="text-accent hover:underline" onClick={() => downloadIcs(`lynkr-${it.id}.ics`, [ev])}>
            .ics
          </button>
          <a className="text-accent hover:underline" href={googleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer">
            Google Calendar
          </a>
        </div>

        {it.kind === "message" && it.status === "done" && (
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={!!it.replied} onChange={(e) => onPlan(updateItem(plan, it.id, { replied: e.target.checked }))} />
            Got a reply
          </label>
        )}
        {due && !hasFollowUp(plan, it.id) && (
          <button className="mt-2 rounded bg-bad/10 px-2 py-1 text-xs font-medium text-bad" onClick={() => onPlan(addFollowUp(plan, it.id, today))}>
            Follow-up due: add it to today
          </button>
        )}
      </div>
    );
  }

  function renderWeek() {
    const items = weekItems(shownWeek);
    if (items.length === 0) {
      return (
        <Card>
          <p className="text-sm text-soft">Nothing planned for this week.</p>
          {shownWeek > plan.weekStart && (
            <Button className="mt-3" onClick={() => { onPlan(planForWeek(shownWeek, plan.counts, plan.times)); setOffset(0); }}>
              Plan this week
            </Button>
          )}
        </Card>
      );
    }
    return (
      <div className="grid gap-3 sm:grid-cols-5">
        {WEEKDAYS.map((w, i) => {
          const day = addDays(shownWeek, i);
          const list = items.filter((it) => it.day === day);
          return (
            <section key={day} aria-label={formatDay(day)} className="min-w-0">
              <h4 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${day === today ? "text-accent" : "text-faint"}`}>
                {formatDay(day)}
                {day === today && " · today"}
              </h4>
              <div className="space-y-2">
                {list.length === 0 ? <p className="text-xs text-faint">Free</p> : list.map(renderItem)}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  function renderMonth() {
    const first = shownWeek.slice(0, 8) + "01";
    const gridStart = mondayOf(first);
    const month = first.slice(0, 7);
    const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    return (
      <Card className="p-3">
        <h4 className="mb-3 font-semibold">{formatMonth(first)}</h4>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="pb-1 text-center font-medium text-faint">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const list = plan.items.filter((it) => it.day === day);
            return (
              <div
                key={day}
                className={`min-h-16 rounded border p-1 ${day.slice(0, 7) === month ? "border-line" : "border-transparent opacity-40"} ${day === today ? "ring-1 ring-accent" : ""}`}
              >
                <div className="text-faint">{Number(day.slice(8))}</div>
                {list.map((it) => (
                  <div key={it.id} className={`mt-0.5 truncate rounded px-1 ${TAG_CLS[it.tag]} ${it.status === "done" ? "line-through" : ""}`} title={titleFor(it)}>
                    {it.time} {TAG_LABEL[it.tag]}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">
              Week of {formatDay(plan.weekStart)}: {plan.counts.messages} messages, {plan.counts.comments} comments, {plan.counts.posts}{" "}
              post{plan.counts.posts === 1 ? "" : "s"}
            </h3>
            <p className="mt-1 text-sm text-soft">
              Scheduling sets a reminder. Nothing is posted or sent for you. Times are IST defaults, not &quot;best times&quot;.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" disabled={open.length === 0} onClick={() => downloadIcs(`lynkr-week-${plan.weekStart}.ics`, open.map(eventFor))}>
              Download week (.ics)
            </Button>
            {!notify && (
              <Button variant="ghost" onClick={enableNotify}>
                Remind me in this tab
              </Button>
            )}
          </div>
        </div>

        <form onSubmit={sendChat} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="plan-chat">
            Change this week
          </label>
          <input
            id="plan-chat"
            className={inputCls}
            value={chat}
            onChange={(e) => setChat(e.target.value)}
            placeholder='Change the plan, e.g. "2 posts, no comments" or "posts at 8am"'
            maxLength={500}
          />
          <Button type="submit" disabled={busy || !chat.trim()} className="shrink-0 whitespace-nowrap">
            {busy ? "Updating…" : "Update plan"}
          </Button>
        </form>
        {reply && <p className="mt-2 text-sm text-soft">{reply}</p>}
        {notify && <p className="mt-2 text-xs text-good">Reminders on while this tab stays open.</p>}
        <div className="mt-2">
          <ErrorNote message={error} />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="tablist" aria-label="Calendar view">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-lg px-3 py-1.5 text-sm ${view === v ? "bg-ink text-bg" : "text-soft hover:bg-muted"}`}
            >
              {v === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
        {view === "week" && (
          <div className="flex items-center gap-2 text-sm">
            <button className="rounded px-2 py-1 hover:bg-muted" onClick={() => setOffset(offset - 1)} aria-label="Previous week">
              ←
            </button>
            <span className="text-soft">{offset === 0 ? "Plan week" : formatDay(shownWeek)}</span>
            <button className="rounded px-2 py-1 hover:bg-muted" onClick={() => setOffset(offset + 1)} aria-label="Next week">
              →
            </button>
          </div>
        )}
      </div>

      {view === "week" ? renderWeek() : renderMonth()}
      {plan.weekStart > today && offset === 0 && (
        <p className="text-xs text-faint">It&apos;s late in the week (IST), so this plan starts next Monday.</p>
      )}
    </div>
  );
}
