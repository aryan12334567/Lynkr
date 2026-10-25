"use client";

import { useId, useState } from "react";
import { Check, Lock, Pencil, Undo2, X } from "lucide-react";
import type { Brief } from "@/lib/interview/engine";
import { FACT_KIND_LABEL, type StoryFact } from "@/lib/schemas";
import { track } from "@/lib/track";
import { Button, inputCls } from "../ui";
import { briefLines, factsBySection, fixFact, isPrivateKind, READBACK_SECTIONS, removeFact, restoreFact, SECTION_EMPTY, SECTION_TITLE } from "./readbackLogic";

const RATINGS = [1, 2, 3, 4, 5] as const;
const RATING_HINT: Record<number, string> = { 1: "Not at all", 3: "Partly", 5: "Exactly" };

function FactLine({ fact, onChange, facts }: { fact: StoryFact; facts: StoryFact[]; onChange: (facts: StoryFact[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(fact.text);
  const id = useId();
  const removed = fact.reviewStatus === "excluded";

  if (editing) {
    return (
      <li className="rounded-xl border border-accent/40 bg-surface p-3">
        <label htmlFor={id} className="mb-1 block text-[0.85rem] text-soft">
          Fix this line ({FACT_KIND_LABEL[fact.kind]})
        </label>
        <textarea
          id={id}
          className={`${inputCls} min-h-20 leading-relaxed`}
          value={text}
          maxLength={400}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setText(fact.text);
              setEditing(false);
            }
          }}
          autoFocus
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            disabled={!text.trim()}
            onClick={() => {
              onChange(fixFact(facts, fact.id, text));
              setEditing(false);
            }}
          >
            <Check size={16} aria-hidden /> Save
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              setText(fact.text);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-start sm:gap-3" data-fact={fact.id}>
      <div className="min-w-0 flex-1">
        <p className={`text-[0.98rem] leading-snug ${removed ? "text-faint line-through" : "text-ink"}`}>{fact.text}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8rem] text-faint">
          <span>{FACT_KIND_LABEL[fact.kind]}</span>
          {fact.confidence?.number === "estimate" && <span>· an estimate</span>}
          {isPrivateKind(fact.kind) && !removed && (
            <span className="inline-flex items-center gap-1 text-soft">
              · <Lock size={12} aria-hidden /> private, never in public drafts
            </span>
          )}
        </p>
      </div>
      <div className="-ml-3 flex shrink-0 gap-1 sm:ml-0">
        {removed ? (
          <Button variant="quiet" className="min-h-9 py-1" onClick={() => onChange(restoreFact(facts, fact.id))} aria-label={`Put back: ${fact.text}`}>
            <Undo2 size={15} aria-hidden /> Put back
          </Button>
        ) : (
          <>
            <Button
              variant="quiet"
              className="min-h-9 py-1"
              onClick={() => {
                setText(fact.text);
                setEditing(true);
              }}
              aria-label={`Fix: ${fact.text}`}
            >
              <Pencil size={15} aria-hidden /> Fix
            </Button>
            <Button variant="quiet" className="min-h-9 py-1" onClick={() => onChange(removeFact(facts, fact.id))} aria-label={`Remove: ${fact.text}`}>
              <X size={15} aria-hidden /> Remove
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * The read-back (build plan Part 5): everything Lynkr took from the interview, in six plain
 * sections. Every fact can be fixed or removed before any draft is written; removed lines stay
 * visible under "Out of scope" so they can be put back.
 */
export function ReadBack({
  brief,
  facts,
  onChangeFacts,
  onConfirm,
  busy,
}: {
  brief: Brief;
  facts: StoryFact[];
  onChangeFacts: (facts: StoryFact[]) => void;
  onConfirm: (rating: number | null) => void;
  busy: boolean;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const ratingId = useId();
  const grouped = factsBySection(facts);
  const lines = briefLines(brief, facts);
  const usable = facts.some((f) => f.reviewStatus !== "excluded");

  return (
    <section aria-labelledby="readback-title" className="mx-auto w-full max-w-2xl">
      <h2 id="readback-title" className="text-[1.9rem] leading-tight tracking-[-0.03em] sm:text-[2.2rem]">
        Here&apos;s what Lynkr heard
      </h2>
      <p className="mt-2 max-w-[56ch] text-soft">Fix anything that isn&apos;t quite right. Drafts use only what&apos;s here, and leave a blank wherever something is missing.</p>

      <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        {READBACK_SECTIONS.map((s) => {
          const own = lines.filter((l) => l.section === s);
          const list = grouped[s];
          return (
            <div key={s} className="py-4 first:pt-0 last:pb-0">
              <h3 className="text-[1.05rem]">{SECTION_TITLE[s]}</h3>
              {own.length > 0 && (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.95rem]">
                  {own.map((l) => (
                    <div key={l.label} className="contents">
                      <dt className="text-faint">{l.label}</dt>
                      <dd className="min-w-0 break-words text-ink">{l.text}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {list.length > 0 ? (
                <ul className="mt-1 divide-y divide-line/70">
                  {list.map((f) => (
                    <FactLine key={f.id} fact={f} facts={facts} onChange={onChangeFacts} />
                  ))}
                </ul>
              ) : (
                !own.length && <p className="mt-1.5 text-[0.92rem] text-faint">{SECTION_EMPTY[s]}</p>
              )}
            </div>
          );
        })}
      </div>

      <fieldset className="mt-6">
        <legend id={ratingId} className="text-[0.98rem] font-medium">
          How well does this describe you? <span className="font-normal text-faint">(optional)</span>
        </legend>
        <div role="radiogroup" aria-labelledby={ratingId} className="mt-2 flex flex-wrap gap-2">
          {RATINGS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} out of 5${RATING_HINT[n] ? `, ${RATING_HINT[n].toLowerCase()}` : ""}`}
              onClick={() => setRating(rating === n ? null : n)}
              className={`grid h-11 w-11 place-items-center rounded-full border text-[1rem] font-medium transition-colors ${
                rating === n ? "border-accent bg-accent text-white" : "border-line bg-surface text-soft hover:border-accent/50 hover:text-ink"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[0.82rem] text-faint">1 is not at all, 5 is exactly.</p>
      </fieldset>

      <div className="mt-7">
        <button
          type="button"
          disabled={busy || !usable}
          onClick={() => {
            if (rating !== null) track("summary_rated", { bucket: brief.bucket, value: rating });
            onConfirm(rating);
          }}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-[1rem] font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-50 sm:w-auto"
        >
          {busy ? "Saving..." : "Looks right, write my first drafts"}
        </button>
        {!usable && <p className="mt-2 text-[0.88rem] text-warn">Put back at least one line so there&apos;s something to write from.</p>}
      </div>
    </section>
  );
}
