"use client";

import { useCallback, useEffect, useState } from "react";
import { copyText } from "./DraftCard";
import { Button, Card, ErrorNote, Label, Pill, inputCls } from "./ui";
import { flagSegments } from "@/lib/comment/segments";

type Goal = "job_seeker" | "freelancer" | "visibility";
type Option = { angle: "experience" | "add" | "question"; body: string; why: string; flags: string[]; receipt?: string };
type Result =
  | { status: "options"; goal: Goal; author: { name: string; headline: string } | null; options: Option[]; dropped: number }
  | { status: "skip"; reason: string; why: string; goal: Goal; author: { name: string; headline: string } | null };
type Entry = { id: string; authorName: string | null; authorHeadline: string | null; body: string; goal: string; angle: string; createdAt: string };

const ANGLE: Record<Option["angle"], string> = { experience: "From your experience", add: "Add a point", question: "Ask a question" };
const GOALS: [Goal, string][] = [["job_seeker", "Job seeker"], ["freelancer", "Freelancer"], ["visibility", "Visibility builder"]];

/**
 * The web version of the Commenter (plan R15): paste the part of a post you want to answer, get up to three options with a
 * "why this works" line, copy one, and say whether you posted it. Signed-in people only. Nothing is posted for you.
 */
export function CommentOptions({ mock }: { mock: boolean | null }) {
  const [post, setPost] = useState("");
  const [reaction, setReaction] = useState("");
  const [goal, setGoal] = useState<Goal | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copiedAt, setCopiedAt] = useState<number | null>(null);
  const [logged, setLogged] = useState<Record<number, string>>({});

  async function write(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setResult(null); setLogged({}); setCopiedAt(null);
    try {
      const res = await fetch("/api/comment/options", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ selection: post, ...(goal ? { goal } : {}), ...(reaction.trim() ? { reaction: reaction.trim() } : {}), ...(name.trim() ? { author: { name: name.trim(), headline: "" } } : {}) }),
      });
      const j = (await res.json().catch(() => ({}))) as Result & { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Couldn't write comments. Please try again.");
      setResult(j);
      setGoal(j.goal);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function copy(i: number, o: Option) {
    if (!(await copyText(o.body))) return;
    setCopiedAt(i);
    if (!o.receipt || logged[i]) return;
    const res = await fetch("/api/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ receipt: o.receipt, body: o.body }) }).catch(() => null);
    const j = res?.ok ? ((await res.json()) as { entry: { id: string } }) : null;
    if (j) setLogged((cur) => ({ ...cur, [i]: j.entry.id }));
  }
  async function posted(i: number, value: boolean) {
    const id = logged[i];
    if (!id) return;
    await fetch("/api/comments", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, posted: value }) });
    setLogged((cur) => ({ ...cur, [i]: `${id}:${value ? "yes" : "no"}` }));
    window.dispatchEvent(new Event("lynkr-comments-changed"));
  }

  return (
    <>
      <Card>
        <h3 className="text-lg font-bold">Comment on a post you found</h3>
        <p className="mt-1 max-w-[62ch] text-[0.95rem] text-soft">
          Paste the part of the post you want to answer, including the author&apos;s name line if you can. Lynkr writes up to three options from
          your own facts. If it has nothing real to add, it says so.
        </p>
        <form onSubmit={write} className="mt-5 space-y-4">
          <label className="block">
            <Label>Paste the part of the post you&apos;re answering</Label>
            <textarea className={`${inputCls} min-h-28`} value={post} maxLength={3600} onChange={(e) => setPost(e.target.value)} placeholder="Only the relevant part. Nothing private or confidential." />
            <span className="mt-1 block text-[0.85rem] text-faint">{post.length} / 3600. Not saved anywhere.</span>
          </label>
          <label className="block">
            <Label hint="(optional)">Author&apos;s name, if it wasn&apos;t in what you pasted</Label>
            <input className={inputCls} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </label>
          <fieldset>
            <legend className="contents"><Label>Your goal</Label></legend>
            <div className="flex flex-wrap gap-3">
              {GOALS.map(([g, label]) => (
                <label key={g} className="flex items-center gap-2 text-[0.92rem]">
                  <input type="radio" name="goal" className="accent-[var(--accent)]" checked={goal === g} onChange={() => setGoal(g)} /> {label}
                </label>
              ))}
            </div>
            {!goal && <span className="mt-1 block text-[0.85rem] text-faint">Left empty, Lynkr uses the goal from your interview.</span>}
          </fieldset>
          <label className="block">
            <Label hint="(optional)">Your reaction in a few words makes these sound like you</Label>
            <textarea className={`${inputCls} min-h-16`} value={reaction} maxLength={500} onChange={(e) => setReaction(e.target.value)} />
          </label>
          <p className="text-[0.85rem] text-faint">
            {mock ? "Demo mode: nothing goes to an AI. The options are templates built from your words." : "Sends the pasted text, your reaction and up to 12 of your saved facts that are safe in public to the AI provider. The post itself is not saved."}
          </p>
          <ErrorNote message={error} />
          <Button type="submit" disabled={busy || post.trim().length < 20}>{busy ? "Writing…" : result ? "Regenerate" : "Write options"}</Button>
        </form>

        {result && (
          <div className="mt-6 space-y-4 border-t border-line pt-5" data-comment-options>
            <p className="text-[0.92rem] text-soft">
              {result.author ? <>Author: <span className="text-ink">{result.author.name}{result.author.headline ? ` · ${result.author.headline}` : ""}</span></> : "Author not detected. Add the name above and regenerate if you want it kept."}
            </p>
            {result.status === "skip" ? (
              <>
                <Pill tone="warn">No comment written</Pill>
                <p className="text-[0.95rem]">{result.why}{result.reason === "off_topic" || result.reason === "no_input" ? " Add your reaction and try again." : ""}</p>
              </>
            ) : (
              <>
                {result.options.length === 1 && <p className="text-[0.88rem] text-soft">The other options didn&apos;t pass Lynkr&apos;s checks.</p>}
                <ol className="space-y-4">
                  {result.options.map((o, i) => (
                    <li key={i} className="rounded-xl border border-line p-4">
                      <Pill tone="good">{ANGLE[o.angle]}</Pill>
                      <p className="mt-2 whitespace-pre-wrap font-serif">
                        {flagSegments(o.body, o.flags).map((s, k) => s.flagged ? <mark key={k} className="rounded bg-warn/15 px-0.5">{s.text} <span className="text-[0.78rem] font-semibold text-warn">(Check this line)</span></mark> : <span key={k}>{s.text}</span>)}
                      </p>
                      <p className="mt-2 text-[0.88rem] text-soft">Why this works: {o.why}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Button onClick={() => copy(i, o)} aria-label={`Copy ${ANGLE[o.angle]} option`}>{copiedAt === i ? "Copied" : "Copy"}</Button>
                        {logged[i] && !logged[i].includes(":") && (
                          <span className="flex items-center gap-2 text-[0.88rem] text-soft">
                            Did you post it?
                            <button className="underline" onClick={() => posted(i, true)}>Posted</button>
                            <button className="underline" onClick={() => posted(i, false)}>Not posted</button>
                          </span>
                        )}
                        {logged[i]?.endsWith(":yes") && <span className="text-[0.88rem] text-soft">Marked as posted. It counts toward your week.</span>}
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="text-[0.85rem] text-faint">Read it as the author would. You post it yourself, or not at all.</p>
              </>
            )}
          </div>
        )}
      </Card>
      <CommentLog />
    </>
  );
}

/** "Comments you've written" (R14): the last 50 you marked posted. Delete waits a few seconds so it can be undone. */
export function CommentLog() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [pending, setPending] = useState<Record<string, ReturnType<typeof setTimeout>>>({});
  const load = useCallback(async () => {
    const r = await fetch("/api/comments", { cache: "no-store" }).catch(() => null);
    setEntries(r?.ok ? ((await r.json()) as { entries: Entry[] }).entries : []);
  }, []);
  useEffect(() => {
    void load();
    const h = () => void load();
    window.addEventListener("lynkr-comments-changed", h);
    return () => window.removeEventListener("lynkr-comments-changed", h);
  }, [load]);

  function remove(id: string) {
    const t = setTimeout(async () => {
      await fetch("/api/comments", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
      setPending((p) => { const { [id]: _gone, ...rest } = p; void _gone; return rest; });
      setEntries((cur) => (cur ?? []).filter((e) => e.id !== id));
    }, 5000);
    setPending((p) => ({ ...p, [id]: t }));
  }
  function undo(id: string) {
    clearTimeout(pending[id]);
    setPending((p) => { const { [id]: _gone, ...rest } = p; void _gone; return rest; });
  }

  if (entries === null) return null;
  return (
    <Card>
      <h3 className="text-lg font-bold">Comments you&apos;ve written</h3>
      {entries.length === 0 ? (
        <p className="mt-2 text-[0.95rem] text-soft">No comments yet. Right-click a post on LinkedIn, or paste one above.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="rounded-md bg-muted p-3 text-[0.92rem]">
              {pending[e.id] ? (
                <p>Deleted. <button className="underline" onClick={() => undo(e.id)}>Undo</button></p>
              ) : (
                <>
                  <p className="text-[0.85rem] text-soft">{e.authorName ?? "Author unknown"}{e.authorHeadline ? ` · ${e.authorHeadline}` : ""} · {new Date(e.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                  <p className="mt-1 font-serif">{e.body}</p>
                  <button className="mt-1 text-[0.85rem] text-faint hover:text-bad" onClick={() => remove(e.id)}>Delete</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
