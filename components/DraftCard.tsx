"use client";

import { useState } from "react";
import type { Draft } from "@/lib/schemas";
import { openSlots, parseSlots, renderFilled } from "@/lib/slots";
import { scoreSpecificity } from "@/lib/specificity";
import { checkMessage, type Relationship } from "@/lib/checker";
import { Button, Card, inputCls } from "./ui";
import { Verdict } from "./Checker";

const LINKEDIN_POST = "https://www.linkedin.com/feed/?shareActive=true";

export function DraftCard({
  draft,
  fills,
  onFill,
  kind,
  relationship,
}: {
  draft: Draft;
  fills: string[];
  onFill: (fills: string[]) => void;
  /** post = can open LinkedIn's composer; message = outreach, gets the checker. */
  kind: "post" | "comment" | "message";
  relationship?: Relationship;
}) {
  const [copied, setCopied] = useState(false);
  const segments = parseSlots(draft.body);
  const slots = segments.filter((s) => s.type === "slot");
  const left = openSlots(draft.body, fills);
  const text = renderFilled(draft.body, fills);
  const spec = scoreSpecificity(text);

  function setSlot(i: number, v: string) {
    const next = [...fills];
    next[i] = v;
    onFill(next);
  }

  async function copy(open: boolean) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the text is still visible to select by hand.
    }
    if (open) window.open(LINKEDIN_POST, "_blank", "noopener,noreferrer");
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{draft.title}</h3>
        <span className="text-xs text-faint">{draft.why}</span>
      </div>

      <div className="mb-4 whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm leading-relaxed">
        {segments.map((s, i) =>
          s.type === "text" ? (
            <span key={i}>{s.text}</span>
          ) : (fills[s.index] ?? "").trim() ? (
            <mark key={i} className="rounded bg-good/15 px-0.5 text-ink">
              {fills[s.index]}
            </mark>
          ) : (
            <mark key={i} className="rounded bg-warn/20 px-1 text-warn">
              [{s.label}]
            </mark>
          ),
        )}
      </div>

      {slots.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {slots.map((s) =>
            s.type === "slot" ? (
              <label key={s.index} className="block">
                <span className="mb-1 block text-xs text-soft">{s.label}</span>
                <input
                  className={inputCls}
                  value={fills[s.index] ?? ""}
                  onChange={(e) => setSlot(s.index, e.target.value)}
                  placeholder="Your real answer"
                />
              </label>
            ) : null,
          )}
        </div>
      )}

      {kind === "message" && left === 0 && relationship && (
        <div className="mb-4">
          <Verdict result={checkMessage(text, relationship)} compact />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={left > 0} onClick={() => copy(false)}>
          {copied ? "Copied" : "Copy"}
        </Button>
        {kind === "post" && (
          <Button variant="ghost" disabled={left > 0} onClick={() => copy(true)}>
            Copy and open LinkedIn
          </Button>
        )}
        <span className="text-xs text-soft">
          {left > 0
            ? `Fill ${left} blank${left === 1 ? "" : "s"} to unlock copy. Only you know these facts.`
            : kind !== "message" && (
                <>
                  Specificity hint:{" "}
                  <strong className={spec.score >= 70 ? "text-good" : spec.score >= 45 ? "text-warn" : "text-bad"}>
                    {spec.label}
                  </strong>{" "}
                  ({spec.numbers} numbers, {spec.names} names
                  {spec.flagged.length > 0 && `, stock phrases: ${spec.flagged.join(", ")}`})
                </>
              )}
        </span>
      </div>
    </Card>
  );
}
