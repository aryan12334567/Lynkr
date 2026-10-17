"use client";

import { useState } from "react";
import { applyFlag, checkMessage, CHANNEL_RULES, RELATIONSHIP_LABEL, type CheckResult, type Flag, type Relationship } from "@/lib/checker";
import { CHANNELS, INTENTS, type Channel, type Intent, type Packet, type ReviewReply, type StoryFact } from "@/lib/schemas";
import { CHANNEL_LABEL, INTENT_LABEL, contactDecision, hasSharedHistory, relationshipOf } from "@/lib/packet";
import { postJson } from "@/lib/store";
import { Button, Card, Choice, ErrorNote, Label, Pill, inputCls } from "./ui";

const VERDICT_TONE: Record<CheckResult["verdict"], "good" | "warn" | "bad"> = {
  "Looks ready for your review": "good",
  "Edit before sending": "warn",
  "Do not send yet": "bad",
};

const CONTACT_TONE = { good: "good", need_detail: "warn", other_route: "warn", hold: "bad" } as const;

export function Verdict({ result, compact = false, onApply }: { result: CheckResult; compact?: boolean; onApply?: (f: Flag) => void }) {
  const problems = result.checks.filter((c) => !c.ok && c.severity !== "advice");
  const advice = result.checks.filter((c) => !c.ok && c.severity === "advice");
  const flags = result.flags.filter((f) => f.severity !== "advice");
  const softFlags = result.flags.filter((f) => f.severity === "advice");
  return (
    <div className="space-y-3" data-verdict>
      <Pill tone={VERDICT_TONE[result.verdict]} className="text-[0.9rem]">
        {result.verdict}
      </Pill>
      {result.verdict === "Looks ready for your review" && !compact && (
        <p className="text-[0.9rem] text-soft">No problem found in what you gave. That isn&apos;t a promise of a reply; read it once more as them.</p>
      )}
      <ul className="space-y-2 text-[0.92rem]">
        {(compact ? [] : result.checks.filter((c) => c.ok)).map((c) => (
          <li key={c.label} className="flex gap-2">
            <span aria-hidden className="text-good">✓</span>
            <span>{c.label}</span>
          </li>
        ))}
        {problems.map((c) => (
          <li key={c.label} className="flex gap-2">
            <span aria-hidden className={c.severity === "block" ? "text-bad" : "text-warn"}>✗</span>
            <span>
              {c.label}
              <span className="block text-soft">{c.tip}</span>
            </span>
          </li>
        ))}
        {flags.map((f) => (
          <li key={f.phrase} className="flex gap-2">
            <span aria-hidden className={f.severity === "block" ? "text-bad" : "text-warn"}>!</span>
            <span className="min-w-0">
              {f.match ? (
                <>
                  <mark className="blank">{f.match}</mark> <span className="text-soft">({f.phrase})</span>
                </>
              ) : (
                <strong className="font-medium">{f.phrase}</strong>
              )}
              <span className="block text-soft">{f.tip}</span>
              {onApply && f.replacement !== undefined && f.match && (
                <button className="mt-1 text-[0.88rem] font-medium text-accent hover:underline" onClick={() => onApply(f)}>
                  {f.replacement ? `Change to "${f.replacement}"` : "Remove it"}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {!compact && (advice.length > 0 || softFlags.length > 0) && (
        <div className="rounded-md bg-muted px-3 py-2 text-[0.9rem]">
          <p className="font-medium text-soft">Optional suggestions</p>
          <ul className="mt-1 space-y-1.5">
            {advice.map((c) => (
              <li key={c.label}>
                {c.label}: <span className="text-soft">{c.tip}</span>
              </li>
            ))}
            {softFlags.map((f) => (
              <li key={f.phrase}>
                {f.match ? <q>{f.match}</q> : f.phrase}: <span className="text-soft">{f.tip}</span>
                {onApply && f.replacement !== undefined && f.match && (
                  <button className="ml-2 font-medium text-accent hover:underline" onClick={() => onApply(f)}>
                    {f.replacement ? "Use suggestion" : "Remove"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RelationshipPicker({ value, onChange }: { value: Relationship; onChange: (r: Relationship) => void }) {
  return (
    <Choice
      label="Who are you messaging?"
      value={value}
      onChange={onChange}
      options={(Object.keys(RELATIONSHIP_LABEL) as Relationship[]).map((r) => ({ value: r, label: RELATIONSHIP_LABEL[r] }))}
    />
  );
}

/** The message with each flagged phrase marked, so the user sees exactly what to change. */
function Marked({ text, flags }: { text: string; flags: Flag[] }) {
  const spans = flags
    .filter((f) => f.match && f.index !== undefined && f.index >= 0)
    .sort((a, b) => a.index! - b.index!)
    .filter((f, i, arr) => i === 0 || f.index! >= arr[i - 1].index! + arr[i - 1].match!.length);
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const f of spans) {
    out.push(text.slice(at, f.index));
    out.push(
      <mark key={f.index} className="blank" title={f.tip}>
        {f.match}
      </mark>,
    );
    at = f.index! + f.match!.length;
  }
  out.push(text.slice(at));
  return <div className="sheet text-[0.92rem]">{out}</div>;
}

export function Checker({ facts, packet, mock }: { facts: StoryFact[]; packet?: Packet | null; mock: boolean | null }) {
  const [text, setText] = useState("");
  const [rel, setRel] = useState<Relationship>("stranger");
  const [channel, setChannel] = useState<Channel>("linkedin_message");
  const [intent, setIntent] = useState<Intent>("work_question");
  const [picked, setPicked] = useState<string[]>([]);
  const [usePacket, setUsePacket] = useState(false);
  const [tone, setTone] = useState<"keep_voice" | "shorter" | "warmer" | "clearer">("keep_voice");
  const [review, setReview] = useState<ReviewReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = facts.filter((f) => f.reviewStatus === "confirmed");
  const chosen = confirmed.filter((f) => picked.includes(f.id));
  const p = usePacket && packet ? packet : null;
  const relationship = p ? relationshipOf(p.bridge) : rel;
  const ctx = {
    channel: p ? p.channel : channel,
    intent: p ? p.intent : intent,
    facts: chosen.length ? chosen.map((f) => f.text) : undefined,
    sharedHistory: p ? hasSharedHistory(p.bridge) : undefined,
  };
  const result = text.trim() ? checkMessage(text, relationship, ctx) : null;
  const decision = p ? contactDecision(p) : null;

  async function askAI() {
    setBusy(true);
    setError(null);
    setReview(null);
    try {
      const r = await postJson<ReviewReply>("/api/review", {
        text,
        channel: ctx.channel,
        intent: ctx.intent,
        relationship,
        anchor: p?.anchor ?? "",
        facts: chosen.slice(0, 2).map((f) => ({ id: f.id, kind: f.kind, text: f.text })),
        tone,
      });
      setReview(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="text-lg font-bold">Check a message before you send it</h3>
      <p className="mt-1 max-w-[62ch] text-[0.95rem] text-soft">
        Fixed rules, run in your browser. Nothing is sent anywhere. It checks the person and the reason first, then the wording, and it
        can&apos;t promise a reply.
      </p>

      <div className="mt-5 space-y-4">
        {packet && (
          <label className="flex items-center gap-2 text-[0.95rem]">
            <input type="checkbox" checked={usePacket} onChange={(e) => setUsePacket(e.target.checked)} className="accent-[var(--accent)]" />
            Use the person you described in Connect
          </label>
        )}
        {!p && (
          <>
            <div>
              <Label>Who is it going to?</Label>
              <RelationshipPicker value={rel} onChange={setRel} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <Label>Where you&apos;ll send it</Label>
                <select className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {CHANNEL_LABEL[c]} ({CHANNEL_RULES[c].max} {CHANNEL_RULES[c].unit === "chars" ? "characters" : "words"})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <Label>What you want</Label>
                <select className={inputCls} value={intent} onChange={(e) => setIntent(e.target.value as Intent)}>
                  {INTENTS.map((i) => (
                    <option key={i} value={i}>
                      {INTENT_LABEL[i]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}

        {decision && (
          <div className="rounded-md border border-line p-3 text-[0.92rem]" data-contact>
            <Pill tone={CONTACT_TONE[decision.status]}>{decision.label}</Pill>
            <p className="mt-2">{decision.reason}</p>
            <p className="text-soft">{decision.next}</p>
          </div>
        )}

        {confirmed.length > 0 && (
          <fieldset>
            <legend className="contents">
              <Label hint="(optional, up to two)">Facts this message relies on</Label>
            </legend>
            <div className="flex flex-wrap gap-2">
              {confirmed.map((f) => (
                <label key={f.id} className={`flex max-w-full cursor-pointer items-start gap-2 rounded-md border px-3 py-1.5 text-[0.88rem] ${picked.includes(f.id) ? "border-accent bg-accent/10" : "border-line"}`}>
                  <input
                    type="checkbox"
                    className="mt-1 accent-[var(--accent)]"
                    checked={picked.includes(f.id)}
                    onChange={() => setPicked((cur) => (cur.includes(f.id) ? cur.filter((x) => x !== f.id) : cur.length >= 2 ? [cur[1], f.id] : [...cur, f.id]))}
                  />
                  <span className="min-w-0">
                    <span className="font-serif font-bold text-accent">{f.id}</span> {f.text.length > 70 ? `${f.text.slice(0, 69)}…` : f.text}
                  </span>
                </label>
              ))}
            </div>
            <span className="mt-1 block text-[0.85rem] text-faint">Numbers in your message that aren&apos;t in these facts get flagged for you to check.</span>
          </fieldset>
        )}

        <label className="block">
          <Label>Your message</Label>
          <textarea className={`${inputCls} min-h-36`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Hi Priya, I read your post on ..." />
        </label>
      </div>

      <div className="mt-5">
        {result ? (
          <div className="space-y-4">
            {result.flags.some((f) => f.match) && <Marked text={text} flags={result.flags} />}
            <Verdict result={result} onApply={(f) => setText((t) => applyFlag(t, f))} />

            <div className="border-t border-line pt-4">
              <p className="text-[0.95rem] font-medium">Want two or three small edits from AI?</p>
              <p className="mt-1 text-[0.88rem] text-soft">
                {mock
                  ? "Needs an AI key, so it isn't available in demo mode. The checks above don't use AI."
                  : "Sends only this message, the channel, your goal, the thing you noticed and the facts you picked to the AI provider. Not your whole Story Vault."}
              </p>
              {!mock && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Choice
                    label="Tone"
                    value={tone}
                    onChange={setTone}
                    options={[
                      { value: "keep_voice", label: "Keep my voice" },
                      { value: "shorter", label: "Shorter" },
                      { value: "warmer", label: "Warmer" },
                      { value: "clearer", label: "Clearer" },
                    ]}
                  />
                  <Button variant="ghost" onClick={askAI} disabled={busy}>
                    {busy ? "Asking…" : "Suggest edits"}
                  </Button>
                </div>
              )}
              <div className="mt-2">
                <ErrorNote message={error} />
              </div>
              {review && (
                <div className="mt-3 space-y-2 text-[0.92rem]">
                  <p>{review.summary}</p>
                  {review.edits.length === 0 && <p className="text-soft">No edits suggested.</p>}
                  {review.edits.map((e, i) => (
                    <div key={i} className="rounded-md border border-line p-3">
                      <p>
                        <del className="text-bad">{e.find}</del> <ins className="text-good no-underline">{e.replace}</ins>
                      </p>
                      <p className="text-soft">{e.why}</p>
                      <button className="mt-1 font-medium text-accent hover:underline" onClick={() => setText((t) => t.replace(e.find, e.replace))} disabled={!text.includes(e.find)}>
                        Accept this edit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[0.92rem] text-faint">Your result appears here as you type.</p>
        )}
      </div>
    </Card>
  );
}
