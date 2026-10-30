"use client";

import { useEffect, useState } from "react";
import { loadLicense } from "@/lib/store";
import { nextAction } from "@/lib/outreach/followup";
import type { Contact } from "@/lib/outreach/contacts-db";
import { ArrowRight, CalendarDays, Library, PenLine, Send, Users } from "lucide-react";
import type { Saved } from "@/lib/store";
import { openSlots } from "@/lib/slots";
import { personFollowUpDue } from "@/lib/connect";
import { todayIST } from "@/lib/ist";
import { TAG_LABEL } from "@/lib/plan";

type Tab = "vault" | "outreach" | "posts" | "plan" | "connect" | "check";

/**
 * A personal home screen: what to do next, from what's already in this browser.
 * Nothing new is generated here.
 */
export function Today({ s, go, outreachV2 = false }: { s: Saved; go: (t: Tab) => void; outreachV2?: boolean }) {
  const [outreachDue, setOutreachDue] = useState(0);
  useEffect(() => {
    if (!outreachV2) return;
    const license = loadLicense();
    fetch("/api/outreach/contacts", {headers: license ? {"x-lynkr-license":license.key,"x-lynkr-instance":license.instanceId} : {}}).then(r => r.ok ? r.json() : null).then(data => {
      if (data?.contacts) setOutreachDue((data.contacts as Contact[]).filter(c => nextAction({...c, secondPersonSuggested:c.brief?.secondPersonSuggested === true, followUpSent:c.brief?.followUpSent === true})).length);
    }).catch(() => {});
  }, [outreachV2]);
  const r = s.result!;
  const drafts: [string, string, Tab][] = [
    ...r.posts.map((p, i) => [`post:${i}`, p.body, "posts"] as [string, string, Tab]),
    ["out:stranger", r.outreach.stranger?.body ?? "", "outreach"],
    ["out:follow", r.outreach.follow_up.body, "outreach"],
  ];
  const blanks = drafts.reduce((n, [id, body]) => n + (s.edits[id] ? 0 : openSlots(body, s.fills[id] ?? [])), 0);
  const ready = drafts.filter(([id, body]) => body && (s.edits[id] ? !/\[\[/.test(s.edits[id].text) : openSlots(body, s.fills[id] ?? []) === 0)).length;
  const confirmed = s.facts.filter((f) => f.reviewStatus === "confirmed" && f.useInDrafts).length;
  const toCheck = s.facts.filter((f) => f.reviewStatus === "candidate").length;
  const today = todayIST();
  const todays = (s.plan?.items ?? []).filter((it) => it.day === today && it.status !== "done");
  const planDone = (s.plan?.items ?? []).filter((it) => it.status === "done").length;
  const planTotal = s.plan?.items.length ?? 0;
  const followUps = s.connect.people.filter((p) => personFollowUpDue(p)).length;

  const cards: { icon: typeof Library; title: string; body: string; action: string; tab: Tab; tone?: "attention" }[] = [];
  if (toCheck) cards.push({ icon: Library, title: `${toCheck} fact${toCheck === 1 ? "" : "s"} to check`, body: "Confirm or switch them off before they're used.", action: "Open Story Vault", tab: "vault", tone: "attention" });
  if (blanks) cards.push({ icon: PenLine, title: `${blanks} blank${blanks === 1 ? "" : "s"} to fill`, body: "Only you know these facts. Copy turns on once they're filled.", action: "Fill your posts", tab: "posts", tone: "attention" });
  if (outreachV2 && outreachDue) cards.push({ icon: Users, title: `${outreachDue} outreach action${outreachDue === 1 ? "" : "s"} due`, body: "Review your suggested next steps.", action: "Open Outreach", tab: "outreach" });
  if (!outreachV2 && followUps) cards.push({ icon: Users, title: `${followUps} follow-up${followUps === 1 ? "" : "s"} due`, body: "One short message with something new, then stop.", action: "Open Connect", tab: "connect" });
  cards.push({ icon: Send, title: "Write to one person", body: "Check there's a real reason first, then get a short note.", action: outreachV2 ? "Open Outreach" : "Open Connect", tab: outreachV2 ? "outreach" : "connect" });
  cards.push({ icon: CalendarDays, title: "Plan this week", body: "Three messages, two comments and one post, with reminders.", action: "Open This week", tab: "plan" });

  const ring = planTotal ? planDone / planTotal : 0;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <div className="min-w-0 flex-1">
            <p className="text-[0.95rem] text-soft">Your progress</p>
            <h2 className="mt-1 text-[1.9rem] font-extrabold leading-tight">{s.profile!.targetRole}</h2>
            <p className="mt-2 max-w-[52ch] text-soft">
              {confirmed} confirmed fact{confirmed === 1 ? "" : "s"}, {ready} draft{ready === 1 ? "" : "s"} ready to copy
              {s.connect.people.length ? `, ${s.connect.people.length} ${s.connect.people.length === 1 ? "person" : "people"} in your tracker` : ""}.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden>
              <circle cx="44" cy="44" r="36" fill="none" stroke="var(--line)" strokeWidth="8" />
              <circle
                cx="44"
                cy="44"
                r="36"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 36}
                strokeDashoffset={2 * Math.PI * 36 * (1 - ring)}
                transform="rotate(-90 44 44)"
                style={{ transition: "stroke-dashoffset 600ms ease" }}
              />
            </svg>
            <div>
              <p className="font-serif text-[1.6rem] font-extrabold leading-none">
                {planDone}/{planTotal || 6}
              </p>
              <p className="mt-1 text-[0.85rem] text-soft">done this week</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold">Next up</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {cards.slice(0, 4).map((c) => {
            const I = c.icon;
            return (
              <button
                key={c.title}
                onClick={() => go(c.tab)}
                className="group flex flex-col rounded-2xl border border-line bg-surface p-5 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <span className={`grid h-9 w-9 place-items-center rounded-lg ${c.tone === "attention" ? "bg-warn/10 text-warn" : "bg-accent/10 text-accent"}`}>
                  <I size={18} aria-hidden />
                </span>
                <span className="mt-4 font-bold">{c.title}</span>
                <span className="mt-1 text-[0.92rem] text-soft">{c.body}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-[0.9rem] font-medium text-accent">
                  {c.action} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">On your calendar today</h3>
          <button className="inline-flex items-center gap-1 text-[0.9rem] font-medium text-accent" onClick={() => go("plan")}>
            <CalendarDays size={15} aria-hidden /> Open this week
          </button>
        </div>
        {todays.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line p-5 text-[0.95rem] text-soft">
            {s.plan ? "Nothing planned for today. Take the day, or get ahead on tomorrow." : "Open This week to get a Monday to Friday plan."}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {todays.map((it) => (
              <li key={it.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-sm">
                <span className="font-serif text-[0.95rem] font-bold text-accent">{it.time}</span>
                <span className="text-[0.95rem]">{TAG_LABEL[it.tag]}</span>
                <span className="ml-auto text-[0.85rem] text-faint">{it.status === "scheduled" ? "Scheduled" : "Draft"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
