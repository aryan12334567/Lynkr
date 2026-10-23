"use client";

import { useState } from "react";
import { FACT_KIND_LABEL, FACT_KINDS, type FactKind, type ProfileInput, type StoryFact, type Turn } from "@/lib/schemas";
import { suggestTopics } from "@/lib/roles";
import { Button, Card, Pill, inputCls } from "./ui";
import { ConfirmReset } from "./chrome";

const STATUS_TONE = { candidate: "warn", confirmed: "good", excluded: "neutral" } as const;
const STATUS_TEXT = { candidate: "To check", confirmed: "Confirmed", excluded: "Not used in drafts" } as const;

/**
 * Review before drafting (posts plan §3.1): each fact shows the answer it came from;
 * the user edits, confirms, excludes or removes it. Only confirmed facts reach a draft.
 */
export function VaultReview({
  mode,
  profile,
  turns,
  facts,
  onFacts,
  onProfile,
  busy,
  onWrite,
  onBack,
  onClear,
}: {
  mode: "first" | "manage";
  profile: ProfileInput;
  turns: Turn[];
  facts: StoryFact[];
  onFacts: (f: StoryFact[]) => void;
  onProfile: (p: ProfileInput) => void;
  busy: boolean;
  onWrite: () => void;
  onBack?: () => void;
  onClear?: () => void;
}) {
  const [topicDraft, setTopicDraft] = useState("");
  const usable = facts.filter((f) => f.reviewStatus === "confirmed" && f.useInDrafts);
  const pending = facts.filter((f) => f.reviewStatus === "candidate").length;
  const topics = profile.topics ?? [];
  const suggestions = suggestTopics(profile.targetRole, usable.map((f) => f.text)).filter((t) => !topics.includes(t));

  const set = (id: string, patch: Partial<StoryFact>) => onFacts(facts.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const addTopic = (t: string) => {
    const v = t.trim().slice(0, 40);
    if (v && topics.length < 3 && !topics.includes(v)) onProfile({ ...profile, topics: [...topics, v] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[60ch]">
            <h2 className="text-xl font-bold">{mode === "first" ? "Check your facts" : "Your Story Vault"}</h2>
            <p className="mt-1 text-[0.95rem] text-soft">
              Every draft is written only from facts you confirm here. Fix the wording, switch off anything you don&apos;t want used, and
              remove what&apos;s wrong. Stored in this browser only.
            </p>
          </div>
          {onClear && <ConfirmReset onReset={onClear} label="Clear everything" />}
        </div>
        {pending > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-accent-wash px-4 py-3 text-[0.92rem]">
            <span>
              {pending} fact{pending === 1 ? "" : "s"} still to check.
            </span>
            <Button
              variant="ghost"
              className="min-h-8 py-1"
              onClick={() => onFacts(facts.map((f) => (f.reviewStatus === "candidate" ? { ...f, reviewStatus: "confirmed", useInDrafts: true } : f)))}
            >
              Confirm all {pending} as written
            </Button>
          </div>
        )}
      </Card>

      {facts.length === 0 ? (
        <Card>
          <p className="text-[0.95rem] text-soft">No facts yet. Answer a few interview questions first.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {facts.map((f) => {
            const src = f.sourceTurnIds.map((n) => ({ n, t: turns[n - 1] })).filter((x) => x.t);
            return (
              <li key={f.id} data-fact={f.id} className={`rounded-2xl border bg-surface shadow-sm p-4 ${f.reviewStatus === "excluded" ? "border-line opacity-75" : f.reviewStatus === "candidate" ? "border-accent/70" : "border-line"}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-serif text-[0.9rem] font-bold text-accent">{f.id}</span>
                  <label className="sr-only" htmlFor={`kind-${f.id}`}>
                    Kind of fact
                  </label>
                  <select id={`kind-${f.id}`} className="rounded-md border border-line bg-surface px-2 py-1 text-[0.85rem]" value={f.kind} onChange={(e) => set(f.id, { kind: e.target.value as FactKind })}>
                    {FACT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {FACT_KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <Pill tone={STATUS_TONE[f.reviewStatus]} className="ml-auto">
                    {STATUS_TEXT[f.reviewStatus]}
                  </Pill>
                </div>
                <label className="sr-only" htmlFor={`text-${f.id}`}>
                  Fact {f.id}
                </label>
                <textarea
                  id={`text-${f.id}`}
                  className={`${inputCls} min-h-16 font-serif text-[0.95rem] leading-relaxed`}
                  value={f.text}
                  maxLength={400}
                  onChange={(e) => set(f.id, { text: e.target.value })}
                />
                <p className="mt-2 text-[0.85rem] text-faint">
                  {src.length ? (
                    <>From your answer to: &quot;{src[0].t!.q.length > 90 ? `${src[0].t!.q.slice(0, 89)}…` : src[0].t!.q}&quot;</>
                  ) : (
                    "From your background line in Basics."
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {f.reviewStatus !== "confirmed" && (
                    <Button variant="ghost" className="min-h-8 py-1" onClick={() => set(f.id, { reviewStatus: "confirmed", useInDrafts: true })}>
                      Confirm
                    </Button>
                  )}
                  {f.reviewStatus !== "excluded" && (
                    <Button variant="quiet" className="min-h-8 py-1" onClick={() => set(f.id, { reviewStatus: "excluded", useInDrafts: false })}>
                      Don&apos;t use in drafts
                    </Button>
                  )}
                  <Button variant="quiet" className="min-h-8 py-1 text-bad hover:text-bad" onClick={() => onFacts(facts.filter((x) => x.id !== f.id))}>
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Card>
        <h3 className="text-lg font-bold">Topics for your posts</h3>
        <p className="mt-1 text-[0.92rem] text-soft">Up to three skills, problems or tools from your stories. Only pick ones you&apos;ve actually worked with.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {topics.map((t) => (
            <button key={t} className="rounded-full border border-accent bg-accent/10 px-3 py-1 text-[0.9rem]" onClick={() => onProfile({ ...profile, topics: topics.filter((x) => x !== t) })} aria-label={`Remove topic ${t}`}>
              {t} <span aria-hidden>×</span>
            </button>
          ))}
          {topics.length < 3 &&
            suggestions.map((t) => (
              <button key={t} className="rounded-full border border-dashed border-line px-3 py-1 text-[0.9rem] text-soft hover:border-accent/50" onClick={() => addTopic(t)}>
                Add {t}
              </button>
            ))}
        </div>
        {topics.length < 3 && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addTopic(topicDraft);
              setTopicDraft("");
            }}
          >
            <label className="sr-only" htmlFor="topic">
              Add a topic
            </label>
            <input id="topic" className={`${inputCls} max-w-xs`} value={topicDraft} onChange={(e) => setTopicDraft(e.target.value)} maxLength={40} placeholder="Add your own" />
            <Button variant="ghost" type="submit" disabled={!topicDraft.trim()}>
              Add
            </Button>
          </form>
        )}
      </Card>

      <div className="z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-md backdrop-blur sm:sticky sm:bottom-3">
        <Button onClick={onWrite} disabled={busy || usable.length === 0}>
          {busy ? "Writing your drafts…" : mode === "first" ? "Write my drafts" : "Rewrite drafts from these facts"}
        </Button>
        <span className="text-[0.9rem] text-soft">
          {usable.length === 0 ? "Confirm at least one fact to continue." : `${usable.length} confirmed fact${usable.length === 1 ? "" : "s"} will be used.`}
        </span>
        {onBack && (
          <Button variant="quiet" className="sm:ml-auto" onClick={onBack}>
            Answer more questions
          </Button>
        )}
      </div>
    </div>
  );
}
