"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CALENDAR_CHANGED } from "@/lib/calendar/events";
import { formatDay } from "@/lib/ist";
import { planWeekStart } from "@/lib/plan";
import { Button, ErrorNote, Pill, SectionHead, inputCls } from "../ui";
import { call, type LinkedIn, type Post, type PostType, type Slot } from "./api";
import { PostPanel } from "./PostPanel";
import { PostsPaywall } from "./PostsPaywall";
import { TYPE_WORDS, stateWords, toneOf } from "./words";

const TOUCH = "max-sm:min-h-11";
type Week = { weekStart: string; slots: Slot[]; others: Post[] };

/**
 * The Posts workspace (posts plan U10): this week's post slots, each opening one panel where the post is written.
 * Shown only when Posts v2 is on and the person is signed in. If the Posts routes answer 404 it renders nothing, so the
 * tab stays as it is today.
 */
export function PostsWorkspace({ enabled, signedIn }: { enabled: boolean; signedIn: boolean }) {
  if (!enabled || !signedIn) return null;
  return <Loaded />;
}

function actionWords(p: Post | null): string {
  if (!p) return "Start this post";
  if (p.status === "draft") return p.currentVersionId ? "Edit draft" : "Continue questions";
  return p.status === "published" ? "View" : "Open";
}

function Card({ title, when, post, initial, busy, onOpen, onStart, onSaveBrief }: {
  title: string;
  when: string | null;
  post: Post | null;
  initial: string;
  busy: boolean;
  onOpen: (p: Post) => void;
  onStart: (brief: string) => void;
  onSaveBrief: (p: Post, brief: string) => void;
}) {
  const id = useId();
  const [brief, setBrief] = useState(initial);
  const editable = !post || ["draft", "approved", "scheduled"].includes(post.status);
  const changed = brief.trim() !== (post?.brief ?? initial).trim();
  const label = `${actionWords(post)}: ${title}${when ? `, ${when}` : ""}`;
  return (
    <li className="min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5" data-slot-card data-post={post?.id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          {when && <p className="text-sm text-soft">{when}</p>}
        </div>
        <Pill tone={toneOf(post)} className="whitespace-normal" >{stateWords(post)}</Pill>
      </div>
      <label htmlFor={`${id}-brief`} className="mt-3 block text-sm font-medium">What this post is about</label>
      <textarea id={`${id}-brief`} aria-describedby={`${id}-n`} value={brief} maxLength={400} rows={3} readOnly={!editable} onChange={(e) => setBrief(e.target.value)} className={`${inputCls} mt-1 block`} />
      <p id={`${id}-n`} className="mt-1 text-sm text-soft">{brief.length} of 400 characters</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button className={TOUCH} aria-label={label} disabled={busy || (!post && !brief.trim())} onClick={() => (post ? onOpen(post) : onStart(brief))}>{actionWords(post)}</Button>
        {post && editable && changed && brief.trim() && <Button variant="ghost" className={TOUCH} disabled={busy} onClick={() => onSaveBrief(post, brief.trim())}>Save brief</Button>}
      </div>
    </li>
  );
}

function Loaded() {
  // The plan's own week: Monday to Wednesday plan this week, Thursday to Sunday plan the next.
  const [week] = useState(() => planWeekStart());
  const lock = useRef(false);
  const [phase, setPhase] = useState<"loading" | "ready" | "off" | "error">("loading");
  const [data, setData] = useState<Week | null>(null);
  const [free, setFree] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [linkedin, setLinkedin] = useState<LinkedIn>({ autopublish: false, connected: false, canPublish: false, expiresAt: null });
  const [form, setForm] = useState(false);
  const [type, setType] = useState<PostType>("proof");
  const [brief, setBrief] = useState("");
  const uid = useId();

  const load = useCallback(async () => {
    const [w, all] = await Promise.all([call<Week>(`/api/posts?week=${week}`), call<{ posts: Post[] }>("/api/posts")]);
    if (!w.ok) {
      if (w.status === 404) setPhase("off");
      else {
        setError(w.error);
        setPhase("error");
      }
      return;
    }
    setData(w.data);
    setFree(all.ok ? all.data.posts.filter((p) => p.slotIndex === null) : []);
    setError(null);
    setPhase("ready");
  }, [week]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first read on mount; setState runs after the request returns
    void load();
    void call<LinkedIn>("/api/posts/linkedin").then((r) => {
      if (r.ok) setLinkedin(r.data);
    });
  }, [load]);

  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setPaywall(false);
    try {
      await fn();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const fail = (r: { status: number; error: string }) => {
    if (r.status === 402) setPaywall(true);
    else setError(r.error);
  };
  const changed = useCallback(() => { void load(); }, [load]);

  const startSlot = (s: Slot, text: string) =>
    run(async () => {
      const r = await call<{ post: Post }>("/api/posts", "POST", { weekStart: data?.weekStart ?? week, slot: s.index, ...(text.trim() && text.trim() !== s.brief.trim() ? { brief: text.trim() } : {}) });
      if (!r.ok) return fail(r);
      await load();
      window.dispatchEvent(new Event(CALENDAR_CHANGED));
      setOpenId(r.data.post.id);
    });
  const startFree = () =>
    run(async () => {
      const r = await call<{ post: Post }>("/api/posts", "POST", { type, brief: brief.trim() });
      if (!r.ok) return fail(r);
      setForm(false);
      setBrief("");
      await load();
      window.dispatchEvent(new Event(CALENDAR_CHANGED));
      setOpenId(r.data.post.id);
    });
  const saveBrief = (p: Post, text: string) =>
    run(async () => {
      const r = await call<{ post: Post }>("/api/posts", "PATCH", { id: p.id, brief: text });
      if (!r.ok) return fail(r);
      await load();
    });

  if (phase === "off") return null;
  const others = [...(data?.others ?? []), ...free.filter((p) => !(data?.others ?? []).some((o) => o.id === p.id))];

  return (
    <section aria-labelledby={`${uid}-h`} className="space-y-4" data-posts-workspace>
      <SectionHead title="Your posts this week" id={`${uid}-h`}>
        Pick one, answer a few short questions, and Lynkr writes it from your own answers. You post it yourself.
      </SectionHead>
      {paywall && <PostsPaywall onDismiss={() => setPaywall(false)} />}
      <ErrorNote message={error} />
      {phase === "loading" && (
        <div className="space-y-3" aria-busy="true" role="status" aria-label="Loading your posts">
          {[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      )}
      {phase === "error" && <Button variant="ghost" className={TOUCH} onClick={() => { setPhase("loading"); void load(); }}>Try again</Button>}
      {phase === "ready" && data && (
        <>
          {data.slots.length === 0 && <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-soft" role="status">Your plan has no post this week. You can still write one below.</p>}
          <ul className="space-y-3">
            {data.slots.map((s) => (
              <Card key={s.index} title={TYPE_WORDS[s.type]} when={`${formatDay(s.day)}, ${s.time} IST`} post={s.post} initial={s.post?.brief ?? s.brief} busy={busy} onOpen={(p) => setOpenId(p.id)} onStart={(t) => void startSlot(s, t)} onSaveBrief={(p, t) => void saveBrief(p, t)} />
            ))}
          </ul>
          {others.length > 0 && (
            <>
              <h3 className="pt-2 text-base font-semibold">Other posts</h3>
              <ul className="space-y-3">
                {others.map((p) => (
                  <Card key={p.id} title={TYPE_WORDS[p.type]} when={null} post={p} initial={p.brief} busy={busy} onOpen={(x) => setOpenId(x.id)} onStart={() => {}} onSaveBrief={(x, t) => void saveBrief(x, t)} />
                ))}
              </ul>
            </>
          )}
          <div>
            <Button variant="ghost" className={TOUCH} aria-expanded={form} aria-controls={`${uid}-free`} onClick={() => setForm((v) => !v)}>Write a post that isn&apos;t in the plan</Button>
            {form && (
              <form id={`${uid}-free`} className="mt-3 space-y-3 rounded-2xl border border-line bg-surface p-4" onSubmit={(e) => { e.preventDefault(); if (brief.trim()) void startFree(); }}>
                <label className="block text-sm font-medium" htmlFor={`${uid}-type`}>What kind of post</label>
                <select id={`${uid}-type`} value={type} onChange={(e) => setType(e.target.value as PostType)} className={`${inputCls} max-sm:min-h-11`}>
                  {(Object.keys(TYPE_WORDS) as PostType[]).map((t) => <option key={t} value={t}>{TYPE_WORDS[t]}</option>)}
                </select>
                <label className="block text-sm font-medium" htmlFor={`${uid}-fb`}>What this post is about</label>
                <textarea id={`${uid}-fb`} aria-describedby={`${uid}-fn`} value={brief} maxLength={400} rows={3} onChange={(e) => setBrief(e.target.value)} className={`${inputCls} block`} />
                <p id={`${uid}-fn`} className="text-sm text-soft">{brief.length} of 400 characters</p>
                <Button type="submit" className={TOUCH} disabled={busy || !brief.trim()}>Start this post</Button>
              </form>
            )}
          </div>
        </>
      )}
      {openId && <PostPanel key={openId} postId={openId} linkedin={linkedin} onClose={() => { const id = openId; setOpenId(null); setTimeout(() => document.querySelector<HTMLElement>(`[data-post="${id}"] button`)?.focus(), 0); }} onChanged={changed} />}
    </section>
  );
}
