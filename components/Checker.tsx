"use client";

import { useState } from "react";
import { checkMessage, RELATIONSHIP_LABEL, type CheckResult, type Relationship } from "@/lib/checker";
import { Card, Label, inputCls } from "./ui";

const TONE: Record<CheckResult["verdict"], string> = {
  "Ready to send": "border-good/40 bg-good/10 text-good",
  "Fix first": "border-warn/40 bg-warn/10 text-warn",
  "Don't send yet": "border-bad/40 bg-bad/10 text-bad",
};

export function Verdict({ result, compact = false }: { result: CheckResult; compact?: boolean }) {
  const failed = result.checks.filter((c) => !c.ok);
  return (
    <div className="space-y-3">
      <div className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold ${TONE[result.verdict]}`}>
        {result.verdict}
      </div>
      <ul className="space-y-1.5 text-sm">
        {(compact ? failed : result.checks).map((c) => (
          <li key={c.label} className="flex gap-2">
            <span aria-hidden className={c.ok ? "text-good" : "text-bad"}>
              {c.ok ? "✓" : "✗"}
            </span>
            <span>
              {c.label}
              {!c.ok && <span className="block text-soft">{c.tip}</span>}
            </span>
          </li>
        ))}
        {result.flags.map((f) => (
          <li key={f.phrase} className="flex gap-2">
            <span aria-hidden className="text-bad">!</span>
            <span>
              Avoid <strong>{f.phrase}</strong>
              <span className="block text-soft">{f.tip}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RelationshipPicker({
  value,
  onChange,
}: {
  value: Relationship;
  onChange: (r: Relationship) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Who are you messaging?">
      {(Object.keys(RELATIONSHIP_LABEL) as Relationship[]).map((r) => (
        <button
          key={r}
          role="radio"
          aria-checked={value === r}
          onClick={() => onChange(r)}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
            value === r ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-muted"
          }`}
        >
          {RELATIONSHIP_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

export function Checker() {
  const [text, setText] = useState("");
  const [rel, setRel] = useState<Relationship>("stranger");
  const result = text.trim() ? checkMessage(text, rel) : null;

  return (
    <Card>
      <h3 className="mb-1 font-semibold">Check any message before you send it</h3>
      <p className="mb-4 text-sm text-soft">
        Paste an outreach or referral message. These are fixed rules based on what referrers say they need. No AI, nothing
        is sent anywhere.
      </p>
      <div className="mb-4">
        <Label>Who is it going to?</Label>
        <RelationshipPicker value={rel} onChange={setRel} />
      </div>
      <label className="mb-4 block">
        <Label>Your message</Label>
        <textarea
          className={`${inputCls} min-h-36`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Hi Priya, I'm applying for the SDE intern role at ..."
        />
      </label>
      {result ? <Verdict result={result} /> : <p className="text-sm text-faint">Your verdict appears here.</p>}
    </Card>
  );
}
