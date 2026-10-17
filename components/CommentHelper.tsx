"use client";

import { useState } from "react";
import type { CommentReply, ProfileInput, StoryFact } from "@/lib/schemas";
import { COMMENT_MAX_WORDS, COMMENT_MIN_WORDS, wordCount } from "@/lib/comment";
import { postJson } from "@/lib/store";
import { copyText } from "./DraftCard";
import { Button, Card, ErrorNote, Label, Pill, inputCls } from "./ui";

/**
 * Comment on a post the user found (posts plan §3.3). Text only. The excerpt lives in
 * this component's memory and is never saved; only a comment the user chooses to keep is.
 */
export function CommentHelper({
  profile,
  facts,
  mock,
  kept,
  onKeep,
}: {
  profile: ProfileInput;
  facts: StoryFact[];
  mock: boolean | null;
  kept: string[];
  onKeep: (k: string[]) => void;
}) {
  const [excerpt, setExcerpt] = useState("");
  const [anchor, setAnchor] = useState("");
  const [perspective, setPerspective] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [reply, setReply] = useState<CommentReply | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const confirmed = facts.filter((f) => f.reviewStatus === "confirmed" && f.useInDrafts);
  const chosen = confirmed.filter((f) => picked.includes(f.id));

  async function write(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setReply(null);
    try {
      const r = await postJson<CommentReply>("/api/comment", {
        targetRole: profile.targetRole,
        domain: profile.domain ?? "not_sure",
        audiences: profile.audiences ?? [],
        industry: profile.industry ?? "",
        excerpt: excerpt.trim(),
        facts: chosen.map((f) => ({ id: f.id, kind: f.kind, text: f.text })),
        perspective: perspective.trim(),
        anchor: anchor.trim(),
      });
      setReply(r);
      setText(r.body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const n = wordCount(text);
  const used = reply ? confirmed.filter((f) => reply.factRefs.includes(f.id)) : [];

  return (
    <Card>
      <h3 className="text-lg font-bold">Comment on a post you found</h3>
      <p className="mt-1 max-w-[62ch] text-[0.95rem] text-soft">
        Find the post yourself, paste the part you want to respond to, and add your own point. Lynkr won&apos;t open links, and if there&apos;s
        nothing real to add it will say skip.
      </p>
      <form onSubmit={write} className="mt-5 space-y-4">
        <label className="block">
          <Label>Paste the part of the post you&apos;re responding to</Label>
          <textarea className={`${inputCls} min-h-28`} value={excerpt} maxLength={3000} onChange={(e) => setExcerpt(e.target.value)} placeholder="Only the relevant part. Nothing private or confidential." />
          <span className="mt-1 block text-[0.85rem] text-faint">{excerpt.length} / 3000. Not saved anywhere.</span>
        </label>
        {mock && (
          <label className="block">
            <Label>The exact line you&apos;re responding to</Label>
            <input className={inputCls} value={anchor} maxLength={300} onChange={(e) => setAnchor(e.target.value)} placeholder="Copy it from the text above" />
            <span className="mt-1 block text-[0.85rem] text-faint">Demo mode can&apos;t read the post, so you pick the line. With an AI key, Lynkr finds it.</span>
          </label>
        )}
        <label className="block">
          <Label hint="(your own words)">What have you seen or done that connects to this?</Label>
          <textarea className={`${inputCls} min-h-20`} value={perspective} maxLength={500} onChange={(e) => setPerspective(e.target.value)} placeholder="e.g. When I cleaned our fest survey data, the outliers were mostly typos, not real answers." />
        </label>
        {confirmed.length > 0 && (
          <fieldset>
            <legend className="contents">
              <Label hint="(up to three)">Or use facts from your Story Vault</Label>
            </legend>
            <div className="flex flex-wrap gap-2">
              {confirmed.map((f) => (
                <label key={f.id} className={`flex max-w-full cursor-pointer items-start gap-2 rounded-md border px-3 py-1.5 text-[0.88rem] ${picked.includes(f.id) ? "border-accent bg-accent/10" : "border-line"}`}>
                  <input
                    type="checkbox"
                    className="mt-1 accent-[var(--accent)]"
                    checked={picked.includes(f.id)}
                    onChange={() => setPicked((cur) => (cur.includes(f.id) ? cur.filter((x) => x !== f.id) : cur.length >= 3 ? [...cur.slice(1), f.id] : [...cur, f.id]))}
                  />
                  <span className="min-w-0">
                    <span className="font-serif font-bold text-accent">{f.id}</span> {f.text.length > 70 ? `${f.text.slice(0, 69)}…` : f.text}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <p className="text-[0.85rem] text-faint">
          {mock
            ? "Demo mode: nothing goes to an AI. The comment is assembled from the line you picked and your own words."
            : "Sends the excerpt, your thought, the facts you ticked, your role and readers to the AI provider. Not your whole Story Vault."}
        </p>
        <ErrorNote message={error} />
        <Button type="submit" disabled={busy || excerpt.trim().length < 20}>
          {busy ? "Writing…" : "Write a comment"}
        </Button>
      </form>

      {reply && (
        <div className="mt-6 space-y-3 border-t border-line pt-5" data-comment>
          {reply.status === "skip" ? (
            <>
              <Pill tone="warn">Skip this one</Pill>
              <p className="text-[0.95rem]">{reply.whyItFits}</p>
            </>
          ) : (
            <>
              <Pill tone="good">Draft for your review</Pill>
              <p className="text-[0.9rem] text-soft">
                Responds to: <q className="text-ink">{reply.postAnchor}</q>
              </p>
              <label className="sr-only" htmlFor="comment-text">
                Your comment
              </label>
              <textarea id="comment-text" className="sheet w-full min-h-32 resize-y" value={text} onChange={(e) => setText(e.target.value)} />
              <p className="text-[0.88rem] text-soft">{reply.whyItFits}</p>
              {used.length > 0 && <p className="text-[0.85rem] text-faint">Uses {used.map((f) => `${f.id}: ${f.text.slice(0, 50)}`).join("; ")}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={!text.trim() || /\[\[/.test(text)}
                  onClick={async () => {
                    if (await copyText(text)) {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                >
                  {copied ? "Copied" : "Copy comment"}
                </Button>
                <Button variant="ghost" disabled={!text.trim() || kept.includes(text.trim())} onClick={() => onKeep([text.trim(), ...kept].slice(0, 20))}>
                  Keep this comment
                </Button>
                <span className={`text-[0.85rem] ${n < COMMENT_MIN_WORDS || n > COMMENT_MAX_WORDS ? "text-warn" : "text-soft"}`}>
                  {n} words. {COMMENT_MIN_WORDS} to {COMMENT_MAX_WORDS} reads well under a post.
                </span>
              </div>
              <p className="text-[0.85rem] text-faint">Read it as the author would. You post it yourself, or not at all.</p>
            </>
          )}
        </div>
      )}

      {kept.length > 0 && (
        <details className="mt-6 border-t border-line pt-4 text-[0.92rem]">
          <summary className="cursor-pointer text-soft">Comments you kept ({kept.length})</summary>
          <ul className="mt-2 space-y-2">
            {kept.map((k, i) => (
              <li key={i} className="flex items-start gap-3 rounded-md bg-muted p-3">
                <span className="min-w-0 flex-1 font-serif">{k}</span>
                <button className="text-[0.85rem] text-faint hover:text-bad" onClick={() => onKeep(kept.filter((_, j) => j !== i))}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
