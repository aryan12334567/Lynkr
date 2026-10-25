"use client";

import { useId, useState } from "react";
import type { Draft, StoryFact } from "@/lib/schemas";
import { openSlots, renderFilled } from "@/lib/slots";
import { scoreSpecificity } from "@/lib/specificity";
import { checkMessage, type Relationship } from "@/lib/checker";
import type { DraftEdit } from "@/lib/store";
import { BlankInputs, Button, SheetText, inputCls } from "./ui";
import { Verdict } from "./Checker";
import { unsupportedSentences } from "@/lib/grounding";

const LINKEDIN_POST = "https://www.linkedin.com/feed/?shareActive=true";
const HAS_BLANK = /\[\[[^\]]+\]\]/;

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard blocked (e.g. plain http on a phone): the text is still on screen to select.
    return false;
  }
}

export function DraftCard({
  draft,
  fills,
  onFill,
  edit,
  onEdit,
  kind,
  relationship,
  facts = [],
  groundIn,
}: {
  draft: Draft;
  fills: string[];
  onFill: (fills: string[]) => void;
  edit?: DraftEdit;
  onEdit?: (e: DraftEdit | null) => void;
  /** post = can open LinkedIn's composer; message = outreach, gets the checker. */
  kind: "post" | "comment" | "message" | "profile";
  relationship?: Relationship;
  facts?: StoryFact[];
  /** Text the draft may draw on (confirmed facts, background, role). Sentences far from it get flagged. */
  groundIn?: string[];
}) {
  const [copied, setCopied] = useState<"ok" | "blocked" | null>(null);
  const [editing, setEditing] = useState(false);
  const editId = useId();
  const left = openSlots(draft.body, fills);
  const filled = renderFilled(draft.body, fills);
  const text = edit ? edit.text : filled;
  const editBlanks = edit ? HAS_BLANK.test(edit.text) : false;
  const locked = edit ? editBlanks : left > 0;
  const stale = edit && edit.base !== draft.body;
  const used = (draft.factRefs ?? []).map((id) => facts.find((f) => f.id === id)).filter((f): f is StoryFact => !!f);
  const spec = scoreSpecificity(text);
  const ctxFacts = used.map((f) => f.text);
  // Check the draft as written (blanks excluded), not the user's own edit or fills.
  const unsupported = groundIn && !edit ? unsupportedSentences(draft.body, groundIn) : [];

  async function copy(open: boolean) {
    const ok = await copyText(text);
    setCopied(ok ? "ok" : "blocked");
    setTimeout(() => setCopied(null), 2500);
    if (open) window.open(LINKEDIN_POST, "_blank", "noopener,noreferrer");
  }

  return (
    <article className="rounded-2xl border border-line bg-surface shadow-sm p-5 sm:p-6">
      <header className="mb-4">
        <h3 className="text-[1.1rem] font-bold">{draft.title}</h3>
        <p className="mt-0.5 text-[0.9rem] text-soft">{draft.why}</p>
      </header>

      {edit && !editing ? (
        <div className="sheet">{edit.text}</div>
      ) : editing ? (
        <>
          <label className="sr-only" htmlFor={editId}>
            Edit the full text
          </label>
          <textarea
            id={editId}
            className={`${inputCls} min-h-44 font-serif leading-relaxed`}
            defaultValue={text}
            onChange={(e) => onEdit?.({ text: e.target.value, base: draft.body })}
            autoFocus
          />
        </>
      ) : (
        <SheetText body={draft.body} fills={fills} />
      )}

      {unsupported.length > 0 && (
        <div className="mt-3 rounded-lg border border-warn/30 bg-warn/5 p-3 text-[0.88rem]" data-unsupported>
          <p className="font-medium text-warn">
            Check {unsupported.length === 1 ? "this sentence" : `these ${unsupported.length} sentences`}: {unsupported.length === 1 ? "it isn't" : "they aren't"} clearly in your facts
          </p>
          <ul className="mt-1.5 space-y-1 text-soft">
            {unsupported.map((s) => (
              <li key={s}>&quot;{s}&quot;</li>
            ))}
          </ul>
          <p className="mt-1.5 text-faint">Keep it only if it&apos;s true. Edit the text to change or remove it.</p>
        </div>
      )}

      {stale && <p className="mt-2 text-[0.88rem] text-warn">Your edit is from an earlier version of this draft. Reset to see the new one.</p>}

      {!edit && left > 0 && (
        <div className="mt-4">
          <BlankInputs body={draft.body} fills={fills} onFill={onFill} />
        </div>
      )}

      {used.length > 0 && (
        <details className="mt-4 text-[0.88rem]">
          <summary className="cursor-pointer text-soft">
            Built from {used.length} of your fact{used.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-soft">
            {used.map((f) => (
              <li key={f.id}>{f.text}</li>
            ))}
          </ul>
          <p className="mt-1 text-faint">A pointer for your review, not proof that every sentence is right.</p>
        </details>
      )}

      {kind === "message" && !locked && relationship && (
        <div className="mt-4">
          <Verdict result={checkMessage(text, relationship, { facts: ctxFacts.length ? ctxFacts : undefined })} compact />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button disabled={locked} onClick={() => copy(false)}>
          {copied === "ok" ? "Copied" : "Copy"}
        </Button>
        {kind === "post" && (
          <Button variant="ghost" disabled={locked} onClick={() => copy(true)}>
            Copy and open LinkedIn
          </Button>
        )}
        {onEdit && (left === 0 || edit) && !editing && (
          <Button variant="quiet" onClick={() => setEditing(true)}>
            Edit text
          </Button>
        )}
        {editing && (
          <Button
            variant="quiet"
            onClick={() => {
              setEditing(false);
              // Saving text identical to the generated draft isn't an edit.
              if (edit && edit.text === filled && edit.base === draft.body) onEdit?.(null);
            }}
          >
            Done editing
          </Button>
        )}
        {edit && onEdit && (
          <Button
            variant="quiet"
            onClick={() => {
              onEdit(null);
              setEditing(false);
            }}
          >
            Reset to the draft
          </Button>
        )}
      </div>
      <p className="mt-2 text-[0.85rem] text-soft">
        {copied === "blocked"
          ? "This browser blocked copying here. Select the text above and copy it by hand."
          : locked
            ? edit
              ? "Your edit still has a [[blank]]. Replace it, then you can copy."
              : `Fill ${left} blank${left === 1 ? "" : "s"}, then you can copy. Only you know these facts.`
            : kind === "post" || kind === "comment"
              ? `Specificity hint: ${spec.label} (${spec.numbers} numbers, ${spec.names} names${spec.flagged.length ? `, stock phrases: ${spec.flagged.join(", ")}` : ""}). A rough hint, not a prediction of how it will do.`
              : kind === "profile"
                ? "Check every claim is true before you put it on your profile."
                : "Check every claim is true before you send it."}
      </p>
    </article>
  );
}
