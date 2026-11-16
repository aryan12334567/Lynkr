"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CALENDAR_CHANGED } from "@/lib/calendar/events";
import { dateProblem } from "@/lib/calendar/grid";
import { addDays, istToUTC, todayIST } from "@/lib/ist";
import { Button, ErrorNote, Pill, inputCls } from "../ui";
import { copyText } from "../DraftCard";
import { call, type Answer, type LinkedIn, type Post, type Problem, type Question, type Step, type Version } from "./api";
import { PostsPaywall } from "./PostsPaywall";
import { TYPE_WORDS, istClock, stateWords, toneOf, wordsIn } from "./words";

const LINKEDIN_POST = "https://www.linkedin.com/feed/?shareActive=true";
const TOUCH = "max-sm:min-h-11";
const SOURCE_WORDS: Record<Version["source"], string> = { write: "Written by Lynkr", refine: "Changed by Lynkr", manual: "Your edit" };
const RELEASED = ["approved", "scheduled", "publishing", "published", "failed", "cancelled", "unknown"];
const REFINES = [
  { label: "Shorter", instruction: "Make it shorter." },
  { label: "More direct", instruction: "Make it more direct." },
  { label: "Plainer words", instruction: "Use plainer words." },
];

type Detail = { post: Post; answers: Answer[]; versions: Version[]; interview: Step };
type Choose = { versions: Version[]; dropped: number; note: string | null };
type Fail = { status: number; error: string };

const btn = (extra = "") => `${TOUCH} ${extra}`.trim();

/**
 * One post, start to finish, in a dialog (full screen on phones): the interview, the versions to choose from, the editor,
 * and what to do once it is approved. Lynkr never posts for the person unless the account can publish.
 */
export function PostPanel({ postId, linkedin, onClose, onChanged }: { postId: string; linkedin: LinkedIn; onClose: () => void; onChanged: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [d, setD] = useState<Detail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [mode, setMode] = useState<"quick" | "thorough" | null>(null);
  const [answer, setAnswer] = useState("");
  const [extra, setExtra] = useState<Question | null>(null);
  const [needMsg, setNeedMsg] = useState<string | null>(null);
  const [choose, setChoose] = useState<Choose | null>(null);
  const [edit, setEdit] = useState<{ versionId: string; text: string } | null>(null);
  const [problems, setProblems] = useState<{ versionId: string; list: Problem[] } | null>(null);
  const [instruction, setInstruction] = useState("");
  const [rejected, setRejected] = useState<{ message: string; list: Problem[] } | null>(null);
  const [copied, setCopied] = useState<"ok" | "blocked" | null>(null);
  const [day, setDay] = useState(() => addDays(todayIST(), 1));
  const [time, setTime] = useState("09:00");
  const [whenProblem, setWhenProblem] = useState<string | null>(null);
  const [scheduleOff, setScheduleOff] = useState(false);
  const uid = useId();

  const changed = useCallback(() => {
    window.dispatchEvent(new Event(CALENDAR_CHANGED));
    onChanged();
  }, [onChanged]);

  const load = useCallback(async () => {
    const r = await call<Detail>(`/api/posts?id=${encodeURIComponent(postId)}`);
    if (r.ok) setD(r.data);
    else setError(r.error);
  }, [postId]);

  useEffect(() => {
    const dlg = ref.current;
    if (dlg && !dlg.open) dlg.showModal();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first read on mount; setState runs after the request returns
    void load();
  }, [load]);

  const fail = (r: Fail) => {
    if (r.status === 402) setPaywall(true);
    else setError(r.error);
  };

  /** Runs one request at a time: a second press while one is running does nothing. */
  async function run(label: string, fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError(null);
    setPaywall(false);
    try {
      await fn();
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  const post = d?.post ?? null;
  const current = d && post?.currentVersionId ? d.versions.find((v) => v.id === post.currentVersionId) ?? null : null;
  const phase: "loading" | "release" | "choose" | "editor" | "interview" = !d || !post ? "loading" : RELEASED.includes(post.status) ? "release" : choose ? "choose" : current ? "editor" : "interview";

  // ---- interview ----
  async function writeVersions() {
    const r = await call<
      | { result: "versions"; versions: Version[]; dropped: number; note: string | null; post: Post }
      | { result: "need_more"; message: string; question: Question | null; stop: boolean }
    >("/api/posts/versions", "POST", { id: postId, mode: "generate" });
    if (!r.ok) return fail(r);
    if (r.data.result === "need_more") {
      setNeedMsg(r.data.message);
      setExtra(r.data.question);
      setAnswer("");
      await load();
      return;
    }
    setNeedMsg(null);
    setExtra(null);
    setChoose({ versions: r.data.versions, dropped: r.data.dropped, note: r.data.note });
    await load();
    changed();
  }

  function next() {
    if (!d || d.interview.kind !== "question") return;
    const q = extra ?? d.interview.question;
    void run("next", async () => {
      const r = await call<{ step: Step; stale?: boolean }>("/api/posts/interview", "POST", { id: postId, key: q.key, answer, ...(d.answers.length === 0 && mode ? { mode } : {}) });
      if (!r.ok) return fail(r);
      setAnswer("");
      const answeredExtra = extra !== null;
      setExtra(null);
      setNeedMsg(null);
      await load();
      if (answeredExtra || (r.data.step.kind === "done" && r.data.step.reason !== "thin")) await writeVersions();
    });
  }

  function writeNow() {
    void run("write", async () => {
      const r = await call<{ step: Step }>("/api/posts/interview", "POST", { id: postId, writeNow: true, ...(answer.trim() && d?.interview.kind === "question" ? { key: (extra ?? d.interview.question).key, answer } : {}), ...(d && d.answers.length === 0 && mode ? { mode } : {}) });
      if (!r.ok) return fail(r);
      setAnswer("");
      setExtra(null);
      await load();
      if (r.data.step.kind === "done" && r.data.step.reason !== "thin") await writeVersions();
    });
  }

  // ---- versions and the editor ----
  function pickVersion(v: Version) {
    void run("use", async () => {
      const r = await call<{ post: Post }>("/api/posts", "PATCH", { id: postId, versionId: v.id });
      if (!r.ok) return fail(r);
      setChoose(null);
      setEdit(null);
      await load();
      changed();
    });
  }

  const shown = current ? (edit && edit.versionId === current.id ? edit.text : current.body) : "";
  const dirty = !!current && shown !== current.body;
  const probs = current && problems && problems.versionId === current.id ? problems.list : null;

  function save() {
    if (!current) return;
    void run("save", async () => {
      const r = await call<{ post: Post; version: Version; problems: Problem[] }>("/api/posts", "PATCH", { id: postId, text: shown });
      if (!r.ok) return fail(r);
      setProblems({ versionId: r.data.version.id, list: r.data.problems });
      setEdit(null);
      setRejected(null);
      await load();
      changed();
    });
  }

  function refine(text: string) {
    if (!current || !text.trim()) return;
    void run("refine", async () => {
      const r = await call<{ result: "refined"; version: Version; post: Post } | { result: "rejected"; message: string; problems: Problem[] }>("/api/posts/versions", "POST", { id: postId, mode: "refine", versionId: current.id, instruction: text.trim() });
      if (!r.ok) return fail(r);
      if (r.data.result === "rejected") {
        setRejected({ message: r.data.message, list: r.data.problems });
        return;
      }
      setRejected(null);
      setInstruction("");
      setEdit(null);
      setProblems(null);
      await load();
      changed();
    });
  }

  function restore(v: Version) {
    void run("restore", async () => {
      const r = await call<{ post: Post }>("/api/posts", "PATCH", { id: postId, versionId: v.id });
      if (!r.ok) return fail(r);
      setEdit(null);
      setProblems(null);
      setRejected(null);
      await load();
      changed();
    });
  }

  function setStatus(status: "draft" | "approved", label: string) {
    void run(label, async () => {
      const r = await call<{ post: Post }>("/api/posts", "PATCH", { id: postId, status });
      if (!r.ok) return fail(r);
      await load();
      changed();
    });
  }

  // ---- after approval ----
  async function copy() {
    const text = current?.body ?? "";
    setCopied((await copyText(text)) ? "ok" : "blocked");
  }

  function schedule(at: string | null, label: string) {
    void run(label, async () => {
      const r = await call<{ post: Post }>("/api/posts/schedule", "POST", { id: postId, at });
      if (!r.ok) {
        if (r.status === 404) setScheduleOff(true);
        else fail(r);
        return;
      }
      await load();
      changed();
    });
  }

  function setReminder(e: React.FormEvent) {
    e.preventDefault();
    const nowTime = istClock();
    const p = dateProblem(day, time, todayIST(), nowTime);
    setWhenProblem(p);
    if (!p) schedule(istToUTC(day, time).toISOString(), "schedule");
  }

  function markPosted() {
    void run("posted", async () => {
      const r = await call<{ post: Post }>("/api/posts/schedule", "POST", { id: postId, markPosted: true });
      if (!r.ok) return fail(r);
      await load();
      changed();
    });
  }

  const header = post ? TYPE_WORDS[post.type] : "Post";
  const disabled = busy !== null;
  const q = d?.interview.kind === "question" ? d.interview.question : null;
  const asking = extra ?? q;

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${uid}-title`}
      onClose={onClose}
      className="m-auto w-[min(94vw,44rem)] max-h-[92dvh] overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-black/40 max-sm:m-0 max-sm:h-full max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0"
      data-post-panel
    >
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={`${uid}-title`} className="text-xl font-bold">{header}</h2>
            {post && (
              <p className="mt-1">
                <Pill tone={toneOf(post)} className="whitespace-normal" >{stateWords(post)}</Pill>
              </p>
            )}
          </div>
          <Button variant="ghost" className={btn("shrink-0")} onClick={() => ref.current?.close()}>Close</Button>
        </div>
        {post && <p className="break-words text-sm text-soft">{post.brief}</p>}

        {paywall && <PostsPaywall onDismiss={() => setPaywall(false)} />}
        <ErrorNote message={error} />
        <p role="status" className="sr-only">{busy ? "Working" : ""}</p>
        {phase === "loading" && !error && <p className="text-sm text-soft" role="status">Loading this post.</p>}

        {phase === "interview" && d && (
          <section aria-label="Questions" className="space-y-3">
            {d.answers.length === 0 && !extra && (
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">How many questions?</legend>
                {([["quick", "Quick: about 3 questions"], ["thorough", "Thorough: up to 7 questions, for a fuller post"]] as const).map(([v, label]) => (
                  <label key={v} className="flex min-h-11 items-center gap-2 text-[0.95rem]">
                    <input type="radio" name={`${uid}-mode`} value={v} checked={(mode ?? post?.mode) === v} onChange={() => setMode(v)} className="size-5" />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}
            {needMsg && <p role="status" className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm">{needMsg}</p>}
            {asking ? (
              <>
                {!extra && q && <p className="text-sm text-soft">Question {q.index + 1} of {q.cap}</p>}
                <label htmlFor={`${uid}-answer`} className="block text-[1.05rem] font-semibold">{asking.text}</label>
                <p id={`${uid}-example`} className="text-sm text-soft">{asking.example}</p>
                <textarea
                  id={`${uid}-answer`}
                  aria-describedby={`${uid}-example ${uid}-count`}
                  value={answer}
                  maxLength={1500}
                  rows={5}
                  onChange={(e) => setAnswer(e.target.value)}
                  className={`${inputCls} block`}
                />
                <p id={`${uid}-count`} className="text-sm text-soft">{answer.length} of 1,500 characters</p>
                <div className="flex flex-wrap gap-2">
                  <Button className={btn()} disabled={disabled || !answer.trim()} onClick={next}>{busy === "next" ? "Saving…" : "Next"}</Button>
                  <Button variant="ghost" className={btn()} disabled={disabled} onClick={writeNow}>{busy === "write" ? "Writing…" : "Write it now"}</Button>
                </div>
              </>
            ) : d.interview.kind === "done" ? (
              <>
                <p className="text-[0.95rem]">{d.interview.note}</p>
                <Button className={btn()} disabled={disabled} onClick={() => void run("write", writeVersions)}>{busy === "write" ? "Writing…" : "Write my versions"}</Button>
              </>
            ) : null}
            {busy === "write" && <p className="text-sm text-soft">This can take up to a minute.</p>}
          </section>
        )}

        {phase === "choose" && choose && (
          <section aria-label="Versions" className="space-y-3">
            <h3 className="text-lg font-bold">Pick the version closest to how you talk</h3>
            {(choose.dropped > 0 || choose.note) && (
              <p role="status" className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
                {choose.dropped > 0 ? `${choose.dropped} ${choose.dropped === 1 ? "version was" : "versions were"} left out because ${choose.dropped === 1 ? "it" : "they"} did not pass the checks. ` : ""}
                {choose.note ?? ""}
              </p>
            )}
            <ul className="space-y-3">
              {choose.versions.map((v, i) => (
                <li key={v.id} className="rounded-xl border border-line p-4">
                  <h4 className="font-semibold">Version {i + 1}</h4>
                  <p className="mt-2 whitespace-pre-wrap break-words text-[0.95rem]">{v.body}</p>
                  <p className="mt-2 text-sm text-soft">{wordsIn(v.body)} words. Why this one: {v.why}</p>
                  <Button className={btn("mt-3")} disabled={disabled} aria-label={`Use version ${i + 1}`} onClick={() => pickVersion(v)}>Use this one</Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {phase === "editor" && current && post && d && (
          <section aria-label="Editor" className="space-y-3">
            <label htmlFor={`${uid}-text`} className="block text-[1.05rem] font-semibold">Your post</label>
            <textarea
              id={`${uid}-text`}
              aria-describedby={`${uid}-words`}
              value={shown}
              rows={12}
              maxLength={6000}
              onChange={(e) => setEdit({ versionId: current.id, text: e.target.value })}
              className={`${inputCls} block`}
            />
            <p id={`${uid}-words`} className="text-sm text-soft">
              {wordsIn(shown)} {wordsIn(shown) === 1 ? "word" : "words"}. For a first draft, 90 to 180 words works well.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" className={btn()} disabled={disabled || !dirty || !shown.trim()} onClick={save}>{busy === "save" ? "Saving…" : "Save changes"}</Button>
              <Button className={btn()} disabled={disabled || dirty || (probs?.length ?? 0) > 0} onClick={() => setStatus("approved", "approve")}>{busy === "approve" ? "Approving…" : "Approve"}</Button>
            </div>
            {dirty && <p className="text-sm text-soft">Save your changes before you approve or ask for a change.</p>}
            {probs && probs.length > 0 && (
              <div role="alert" className="rounded-md border border-bad/30 bg-bad/10 px-3 py-2 text-sm">
                <p className="font-medium text-bad">Fix these, then save again</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">{probs.map((p) => <li key={p.code}>{p.message}</li>)}</ul>
              </div>
            )}
            {probs && probs.length === 0 && <p role="status" className="text-sm text-good">Saved. No problems found.</p>}

            <div className="space-y-2 border-t border-line pt-3">
              <h3 className="font-semibold">Change it</h3>
              <div className="flex flex-wrap gap-2">
                {REFINES.map((r) => (
                  <Button key={r.label} variant="ghost" className={btn()} disabled={disabled || dirty} onClick={() => refine(r.instruction)}>{busy === "refine" ? "Working…" : r.label}</Button>
                ))}
              </div>
              <label htmlFor={`${uid}-instr`} className="block text-sm font-medium">Or say what to change</label>
              <textarea id={`${uid}-instr`} aria-describedby={`${uid}-icount`} value={instruction} maxLength={300} rows={2} onChange={(e) => setInstruction(e.target.value)} className={`${inputCls} block`} />
              <p id={`${uid}-icount`} className="text-sm text-soft">{instruction.length} of 300 characters</p>
              <Button variant="ghost" className={btn()} disabled={disabled || dirty || !instruction.trim()} onClick={() => refine(instruction)}>Change it</Button>
              {rejected && (
                <div role="alert" className="rounded-md border border-bad/30 bg-bad/10 px-3 py-2 text-sm">
                  <p className="font-medium text-bad">{rejected.message}</p>
                  {rejected.list.length > 0 && <ul className="mt-1 list-disc space-y-1 pl-5">{rejected.list.map((p) => <li key={p.code}>{p.message}</li>)}</ul>}
                </div>
              )}
            </div>
          </section>
        )}

        {phase === "release" && post && (
          <section aria-label="After approval" className="space-y-3">
            {current && <p className="whitespace-pre-wrap break-words rounded-xl border border-line bg-muted/50 p-4 text-[0.95rem]" data-final-text>{current.body}</p>}

            {post.status === "unknown" && (
              <p role="status" className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm">We could not confirm this post. Check LinkedIn before trying again.</p>
            )}
            {post.status === "failed" && <p role="status" className="rounded-md border border-bad/30 bg-bad/10 px-3 py-2 text-sm">This post did not go out.{post.failReason ? ` ${post.failReason}` : ""}</p>}
            {post.status === "published" && <p role="status" className="text-sm text-good">Posted. Nothing more to do here.</p>}
            {post.status === "publishing" && (
              <>
                <p role="status" className="text-sm">Lynkr is publishing this now. It can take a minute.</p>
                <Button variant="ghost" className={btn()} disabled={disabled} onClick={() => void run("refresh", load)}>Check again</Button>
              </>
            )}

            {post.status !== "publishing" && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Button className={btn()} onClick={() => void copy()}>{copied === "ok" ? "Copied" : "Copy text"}</Button>
                  <a href={LINKEDIN_POST} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-surface px-4 py-2 text-[0.95rem] font-medium hover:border-accent/50 sm:min-h-10">
                    Open LinkedIn<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </div>
                {copied === "blocked" && <p role="status" className="text-sm text-warn">This browser blocked copying here. Select the text above and copy it by hand.</p>}
                {copied === "ok" && <p role="status" className="sr-only">Copied to your clipboard.</p>}
                {!linkedin.canPublish && post.status !== "published" && <p className="text-sm text-soft">Lynkr does not post for you. Copy it, post it on LinkedIn, then tick Posted.</p>}
              </>
            )}

            {(post.status === "approved" || post.status === "cancelled") && !scheduleOff && (
              <form onSubmit={setReminder} noValidate className="space-y-2 rounded-xl border border-line p-4">
                <h3 className="font-semibold">{linkedin.canPublish ? "Choose a time" : "Set a reminder"}</h3>
                {linkedin.canPublish && <p className="text-sm text-soft">Lynkr will publish this once, at the time you choose, to your own profile. You can cancel until it starts.</p>}
                <div className="flex flex-wrap gap-3">
                  <label className="text-sm text-soft">
                    Date
                    <input type="date" value={day} min={todayIST()} onChange={(e) => { setDay(e.target.value); setWhenProblem(null); }} className={`${inputCls} mt-1 py-1 max-sm:min-h-11`} />
                  </label>
                  <label className="text-sm text-soft">
                    Time (IST)
                    <input type="time" value={time} onChange={(e) => { setTime(e.target.value); setWhenProblem(null); }} className={`${inputCls} mt-1 py-1 max-sm:min-h-11`} />
                  </label>
                </div>
                {whenProblem && <p role="alert" className="text-sm text-bad">{whenProblem}</p>}
                <Button type="submit" variant="ghost" className={btn()} disabled={disabled}>{busy === "schedule" ? "Saving…" : linkedin.canPublish ? "Schedule it" : "Set reminder"}</Button>
              </form>
            )}

            {post.status === "scheduled" && (
              <Button variant="ghost" className={btn()} disabled={disabled} onClick={() => schedule(null, "cancel")}>{busy === "cancel" ? "Cancelling…" : "Cancel schedule"}</Button>
            )}

            {post.status !== "published" && post.status !== "publishing" && (
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <Button className={btn()} disabled={disabled} onClick={markPosted}>{busy === "posted" ? "Saving…" : "I posted it"}</Button>
                {post.status === "unknown" && <Button variant="ghost" className={btn()} disabled={disabled} onClick={() => setStatus("approved", "notposted")}>It did not post</Button>}
                {post.status === "approved" && <Button variant="ghost" className={btn()} disabled={disabled} onClick={() => setStatus("draft", "edit")}>Edit again</Button>}
              </div>
            )}
          </section>
        )}

        {d && d.versions.length > 0 && phase !== "interview" && (
          <details className="rounded-xl border border-line p-3">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">History ({d.versions.length})</summary>
            <ul className="mt-2 space-y-3">
              {[...d.versions].reverse().map((v) => (
                <li key={v.id} className="rounded-lg border border-line p-3 text-sm">
                  <p className="font-medium">Version {v.n}: {SOURCE_WORDS[v.source]}{v.id === post?.currentVersionId ? " (current)" : ""}</p>
                  {v.instruction && <p className="text-soft">You asked: {v.instruction}</p>}
                  <p className="mt-1 line-clamp-3 break-words text-soft">{v.body}</p>
                  {v.id !== post?.currentVersionId && post && !RELEASED.includes(post.status) && (
                    <Button variant="ghost" className={btn("mt-2")} disabled={disabled} aria-label={`Restore version ${v.n}`} onClick={() => restore(v)}>Restore</Button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </dialog>
  );
}
