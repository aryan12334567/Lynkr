"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  EyeOff,
  House,
  IdCard,
  Library,
  Lock,
  MessageSquareText,
  Mic,
  PenLine,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { InkThreads } from "./InkThreads";
import { Wordmark } from "./chrome";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------- The hero product window: one orchestrated moment ---------- */

const BLANKS = ["Ananya", "post on cleaning survey data", "how do you decide which outliers to drop"];

function HeroWindow() {
  const reduce = useReducedMotion();
  // 0: nothing filled ... 3: all blanks filled, 4: verdict and copy ready
  const [step, setStep] = useState(reduce ? 4 : 0);
  useEffect(() => {
    if (reduce) return;
    const ts = [1100, 1900, 2700, 3500].map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => ts.forEach(clearTimeout);
  }, [reduce]);
  const filled = (i: number) => step > i;
  const blank = (i: number) => (
    <motion.mark
      layout
      className={filled(i) ? "filled" : "blank"}
      initial={false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      {filled(i) ? BLANKS[i] : ["their first name", "one thing they posted", "your one question"][i]}
    </motion.mark>
  );

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
      className="relative mx-auto w-full max-w-5xl"
      aria-label="A sample Lynkr screen: a message with blanks the user fills in"
      role="img"
    >
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
        <div className="flex items-center gap-2 border-b border-line bg-muted/60 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="mx-auto rounded-md bg-surface px-3 py-0.5 text-[0.75rem] text-faint">lynkr / outreach</span>
        </div>
        <div className="grid sm:grid-cols-[11rem_1fr]">
          <div className="hidden border-r border-line bg-bg/60 p-3 sm:block">
            {[
              [House, "Today"],
              [Library, "Story Vault"],
              [IdCard, "Profile fix"],
              [Send, "Outreach"],
              [PenLine, "Posts"],
              [CalendarDays, "This week"],
              [Users, "Connect"],
            ].map(([Icon, label], i) => {
              const I = Icon as typeof House;
              return (
                <div key={label as string} className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.8rem] ${i === 3 ? "bg-surface font-medium text-ink shadow-sm" : "text-soft"}`}>
                  <I size={14} strokeWidth={1.8} aria-hidden />
                  {label as string}
                </div>
              );
            })}
          </div>
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-serif text-[1.05rem] font-bold">First message to a stranger</p>
              <span className="rounded-full border border-good/40 bg-good/10 px-2 py-0.5 text-[0.72rem] text-good">Good reason to contact</span>
            </div>
            <div className="sheet mt-4 text-[0.92rem] sm:text-[0.98rem]">
              Hi {blank(0)}, I read your {blank(1)}. I&apos;m a final-year B.Com student working towards data analyst roles. I built a Power BI dashboard for
              our college fest that tracked 40 sponsors. One question: {blank(2)}?
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[0.85rem] font-medium transition-colors duration-500 ${step >= 4 ? "bg-accent text-bg" : "bg-accent/30 text-bg"}`}>
                <Copy size={14} aria-hidden /> Copy
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={step >= 4 ? "ready" : "fill"}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className={`rounded-full border px-2.5 py-0.5 text-[0.78rem] ${step >= 4 ? "border-good/40 bg-good/10 text-good" : "border-warn/40 bg-warn/10 text-warn"}`}
                >
                  {step >= 4 ? "Looks ready for your review" : `Fill ${3 - Math.min(step, 3)} blank${3 - Math.min(step, 3) === 1 ? "" : "s"} first`}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Floating fact chip: where the draft's facts came from. */}
      <motion.div
        initial={reduce ? false : { opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.9 }}
        className="absolute -left-4 bottom-10 hidden w-60 rounded-xl border border-line bg-surface p-3 text-[0.78rem] shadow-md lg:block xl:-left-16"
      >
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-accent">F1</span>
          <span className="text-faint">Project</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-good/10 px-2 py-0.5 text-good">
            <Check size={12} aria-hidden /> Confirmed
          </span>
        </div>
        <p className="mt-1.5 font-serif leading-snug">I built a Power BI dashboard that tracked 40 sponsors.</p>
      </motion.div>
      <motion.div
        initial={reduce ? false : { opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 1.2 }}
        className="absolute -right-4 -top-12 hidden w-56 rounded-xl border border-line bg-surface p-3 text-[0.78rem] shadow-md lg:block xl:-right-14"
      >
        <p className="flex items-center gap-1.5 font-medium">
          <ShieldCheck size={14} className="text-accent" aria-hidden /> Checked before you send
        </p>
        <ul className="mt-2 space-y-1 text-soft">
          <li className="flex items-center gap-1.5">
            <Check size={12} className="text-good" aria-hidden /> 44 of 90 words
          </li>
          <li className="flex items-center gap-1.5">
            <Check size={12} className="text-good" aria-hidden /> One clear ask
          </li>
          <li className="flex items-center gap-1.5">
            <Check size={12} className="text-good" aria-hidden /> No referral ask to a stranger
          </li>
        </ul>
      </motion.div>
    </motion.div>
  );
}

/* ---------- How it works: a real sequence, with a small product visual each ---------- */

function StepVisual({ n }: { n: number }) {
  if (n === 0)
    return (
      <div className="h-full rounded-xl border border-line bg-surface p-4 shadow-sm">
        <p className="font-serif text-[0.95rem] font-bold leading-snug">What did you personally do on that project?</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-9 flex-1 rounded-md border border-line bg-bg px-3 py-2 text-[0.8rem] text-faint">I wrote the SQL myself…</div>
          <span className="grid h-9 w-9 place-items-center rounded-md border border-line text-soft">
            <Mic size={15} aria-hidden />
          </span>
        </div>
      </div>
    );
  if (n === 1)
    return (
      <div className="h-full space-y-2 rounded-xl border border-line bg-surface p-4 shadow-sm">
        {[
          ["F1", "Built a sponsor dashboard", "Confirmed", "good"],
          ["F2", "Wrote the SQL myself", "Confirmed", "good"],
          ["F3", "Saved 6 hours a week", "To check", "warn"],
        ].map(([id, t, s, tone]) => (
          <div key={id} className="flex items-center gap-2 text-[0.8rem]">
            <span className="font-serif font-bold text-accent">{id}</span>
            <span className="min-w-0 flex-1 truncate">{t}</span>
            <span className={`rounded-full px-2 py-0.5 text-[0.7rem] ${tone === "good" ? "bg-good/10 text-good" : "bg-warn/10 text-warn"}`}>{s}</span>
          </div>
        ))}
      </div>
    );
  return (
    <div className="h-full rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="sheet text-[0.8rem] leading-relaxed">
        Your point about <mark className="filled">metric definitions</mark> matches what I saw building our fest dashboard.
      </div>
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[0.78rem] font-medium text-bg">
        <Copy size={12} aria-hidden /> Copy
      </span>
    </div>
  );
}

const STEPS = [
  ["Tell one real story", "A short interview, typed or spoken, about one thing you actually did. Two follow-ups at most."],
  ["Check every fact", "Lynkr shows what it pulled from your answers. Confirm, fix or switch off each one. Drafts use only these."],
  ["Fill, copy, send yourself", "Anything Lynkr doesn't know stays a blank. You fill it, copy it and post or send it in LinkedIn."],
];

/* ---------- Features: one grid, tiles of different sizes and contents ---------- */

function Tile({ title, children, body, className = "" }: { title: string; body: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm ${className}`}>
      <div className="flex-1 bg-gradient-to-b from-muted/70 to-surface p-5">{children}</div>
      <div className="border-t border-line p-5">
        <h3 className="text-[1.05rem] font-bold">{title}</h3>
        <p className="mt-1 text-[0.92rem] text-soft">{body}</p>
      </div>
    </div>
  );
}

/* ---------- FAQ ---------- */

const FAQ = [
  ["Is it free?", "Yes. Lynkr is free for freshers and early-career job seekers. There's no account to create."],
  ["Will it sound like AI wrote it?", "It writes only from facts you confirm, in plain words, and leaves blanks for anything it doesn't know. You can edit every line before you copy it."],
  ["Does it log in to my LinkedIn?", "No. Lynkr never asks for your LinkedIn password and never opens LinkedIn pages. You copy each draft and send it yourself."],
  ["What happens to my answers?", "Your Story Vault, drafts and tracker stay in your browser. Posts you paste and profile files you import are used once and never saved."],
  ["Will this get me replies?", "No tool can promise that. Lynkr checks there's a real reason to write, keeps the ask small and the message short, then leaves the call to you."],
  ["Can I use it on my phone?", "Yes. It works in the browser on any phone, and you can answer the interview by speaking."],
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  return (
    <div className="border-b border-line">
      <button className="flex w-full items-center justify-between gap-4 py-5 text-left text-[1.05rem] font-medium" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {q}
        <ChevronDown size={18} className={`shrink-0 text-soft transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="max-w-[62ch] pb-5 text-soft">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Page ---------- */

export function Landing({
  onStart,
  onCheck,
  mock,
  resume = null,
}: {
  onStart: () => void;
  onCheck: () => void;
  mock: boolean | null;
  /** Saved progress in this browser: "drafts" if drafts exist, "flow" if partway through. */
  resume?: "drafts" | "flow" | null;
}) {
  const primary = resume === "drafts" ? "Open my drafts" : resume === "flow" ? "Continue where you left off" : "Start free";
  const cta = (label = primary) => (
    <button onClick={onStart} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-6 text-[1rem] font-medium text-bg shadow-md transition-colors hover:bg-accent-strong">
      {label} <ArrowRight size={17} aria-hidden />
    </button>
  );

  return (
    <div className="w-full">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6" aria-label="Main">
          <Wordmark className="text-[1.45rem]" />
          <div className="ml-auto hidden items-center gap-6 text-[0.95rem] text-soft md:flex">
            <a href="#how" className="hover:text-ink">
              How it works
            </a>
            <a href="#features" className="hover:text-ink">
              What you get
            </a>
            <a href="#never" className="hover:text-ink">
              Privacy
            </a>
            <a href="#faq" className="hover:text-ink">
              Questions
            </a>
          </div>
          <button onClick={onStart} className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[0.9rem] font-medium text-bg md:ml-0">
            {resume ? (resume === "drafts" ? "My drafts" : "Continue") : "Start free"} <ArrowRight size={15} aria-hidden />
          </button>
        </nav>
      </header>

      <main id="main">
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="paper-grid pointer-events-none absolute inset-0" aria-hidden />
          <InkThreads
            dark={false}
            className="pointer-events-none absolute -top-24 left-1/2 h-[52rem] w-[110rem] -translate-x-1/2 opacity-50 [mask-image:linear-gradient(to_bottom,#000_45%,transparent_92%)] dark:hidden"
          />
          <InkThreads className="pointer-events-none absolute -top-24 left-1/2 hidden h-[52rem] w-[110rem] -translate-x-1/2 opacity-60 [mask-image:linear-gradient(to_bottom,#000_40%,transparent_90%)] dark:block" />
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[0.85rem] text-soft shadow-sm">
              <Sparkles size={14} className="text-marigold" aria-hidden /> Free for freshers and early-career job seekers in India
            </p>
            <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.06] tracking-tight sm:text-[4rem]">Write to one person. Sound like you.</h1>
            <p className="mx-auto mt-6 max-w-[56ch] text-[1.1rem] text-soft">
              Lynkr interviews you about one real piece of work, keeps the facts in your Story Vault, and drafts your LinkedIn profile, messages
              and posts from them. Anything it doesn&apos;t know stays a blank only you can fill.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {cta()}
              <button onClick={onCheck} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-5 text-[1rem] font-medium shadow-sm hover:border-accent/50">
                <BadgeCheck size={17} className="text-accent" aria-hidden /> Check a message
              </button>
            </div>
            <p className="mt-4 text-[0.85rem] text-faint">No sign-up. No LinkedIn login. {mock ? "Running in demo mode." : ""}</p>
          </div>
          <div className="relative mt-16">
            <HeroWindow />
          </div>
        </section>

        <section id="how" className="scroll-mt-20 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="max-w-[22ch] text-[2rem] font-extrabold leading-tight sm:text-[2.6rem]">Three steps from one story to a message you&apos;d actually send.</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {STEPS.map(([t, d], i) => (
                <li key={t}>
                  <div className="h-48">
                    <StepVisual n={i} />
                  </div>
                  <div className="mt-6 flex items-baseline gap-3">
                    <span className="font-serif text-[1.6rem] font-extrabold leading-none text-accent">{i + 1}</span>
                    <h3 className="text-[1.15rem] font-bold">{t}</h3>
                  </div>
                  <p className="mt-2 max-w-[42ch] text-soft">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 bg-surface px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <h2 className="text-[2rem] font-extrabold leading-tight sm:text-[2.6rem]">Everything a fresher needs to get noticed, nothing that fakes it.</h2>
              <p className="mt-4 text-[1.05rem] text-soft">Seven tools, one Story Vault. Every draft points back to the facts it used.</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-6">
              <Tile className="md:col-span-4" title="Profile fix" body="Your headline, About and every section checked against the role you want. Top three fixes first, each with what it's based on.">
                <div className="rounded-xl border border-line bg-surface p-4 text-[0.82rem] shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-[1rem] font-extrabold text-accent">1.</span>
                    <span className="font-bold">Headline</span>
                    <span className="rounded-full border border-bad/40 bg-bad/10 px-2 py-0.5 text-bad">Fix first</span>
                  </div>
                  <p className="mt-2 text-soft line-through decoration-bad/50">Commerce student | Hardworking</p>
                  <p className="mt-1 font-serif">Data analyst | Power BI dashboard tracking 40 sponsors | SQL</p>
                </div>
              </Tile>
              <Tile className="md:col-span-2" title="Message checker" body="Marks the exact words to change and fixes them in one click.">
                <div className="sheet text-[0.8rem] leading-relaxed">
                  Hello <mark className="blank">sir</mark>, <mark className="blank">kindly revert</mark> on the analyst role.
                </div>
              </Tile>
              <Tile className="md:col-span-2" title="Connect" body="Who to look for, and whether you have a real reason to write, before any wording.">
                <div className="space-y-2 text-[0.8rem]">
                  <span className="inline-block rounded-full border border-good/40 bg-good/10 px-2.5 py-0.5 text-good">Good reason to contact</span>
                  <span className="block w-fit rounded-full border border-bad/40 bg-bad/10 px-2.5 py-0.5 text-bad">Hold off: referral ask to a stranger</span>
                </div>
              </Tile>
              <Tile className="md:col-span-2" title="This week" body="Three messages, two comments, one post on a Monday to Friday plan, with calendar reminders.">
                <div className="grid grid-cols-5 gap-1.5 text-[0.7rem]">
                  {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => (
                    <div key={d} className="rounded-md border border-line bg-surface p-1.5">
                      <p className="font-serif font-bold">{d}</p>
                      <span className={`mt-1 block h-1.5 rounded-full ${i === 1 ? "bg-marigold" : "bg-accent/60"}`} />
                      {i % 2 === 0 && <span className="mt-1 block h-1.5 rounded-full bg-accent/25" />}
                    </div>
                  ))}
                </div>
              </Tile>
              <Tile className="md:col-span-2" title="Comment helper" body="Paste a post you found, add your own point, get one comment. Or a clear &quot;skip this one&quot;.">
                <div className="rounded-lg border-l-2 border-accent/50 bg-surface px-3 py-2 text-[0.8rem] text-soft">&quot;Most dashboards fail because nobody agrees on the metric definitions.&quot;</div>
                <div className="mt-2 flex items-center gap-1.5 text-[0.78rem] text-good">
                  <MessageSquareText size={13} aria-hidden /> 41 words, uses your fact F1
                </div>
              </Tile>
            </div>
          </div>
        </section>

        <section id="never" className="relative scroll-mt-20 overflow-hidden bg-night px-4 py-28 text-[#eceef9] sm:px-6">
          <InkThreads className="pointer-events-none absolute inset-0 h-full w-full opacity-90" />
          <div className="relative mx-auto max-w-6xl">
            <h2 className="max-w-[18ch] text-[2rem] font-extrabold leading-tight sm:text-[2.8rem]">Some things Lynkr will never do.</h2>
            <p className="mt-4 max-w-[52ch] text-[1.05rem] text-[#b8bcd6]">It drafts. You decide what&apos;s true and what gets sent.</p>
            <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
              {[
                [Lock, "Ask for your LinkedIn login", "No password, no cookies, no connected account. Ever."],
                [EyeOff, "Scrape profiles or name strangers", "It suggests kinds of people to look for. You find and choose them."],
                [Send, "Post, comment or message for you", "Every draft is copied and sent by you, in LinkedIn."],
                [ShieldCheck, "Invent a fact about you", "Drafts use only facts you confirmed. Anything else stays a blank."],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof Lock;
                return (
                  <li key={t as string} className="bg-night-2/80 p-7 backdrop-blur-sm">
                    <I size={22} className="text-marigold" aria-hidden />
                    <p className="mt-4 text-[1.1rem] font-medium">{t as string}</p>
                    <p className="mt-1 text-[0.95rem] text-[#b8bcd6]">{d as string}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 px-4 py-24 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_1.4fr]">
            <h2 className="text-[2rem] font-extrabold leading-tight sm:text-[2.6rem]">Questions people ask first.</h2>
            <div className="border-t border-line">
              {FAQ.map(([q, a]) => (
                <FaqItem key={q} q={q} a={a} />
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-line bg-surface px-6 py-16 text-center shadow-md sm:px-12">
            <InkThreads dark={false} className="pointer-events-none absolute inset-0 h-full w-full opacity-60 dark:hidden" />
            <InkThreads className="pointer-events-none absolute inset-0 hidden h-full w-full opacity-50 dark:block" />
            <div className="relative">
              <h2 className="mx-auto max-w-[20ch] text-[2rem] font-extrabold leading-tight sm:text-[2.6rem]">Start with one thing you actually did.</h2>
              <p className="mx-auto mt-4 max-w-[48ch] text-soft">About ten minutes from basics to your first draft. Nothing to install, nothing to sign up for.</p>
              <div className="mt-8 flex justify-center">{cta(resume ? primary : "Start the interview")}</div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6">
          <div>
            <Wordmark className="text-[1.3rem]" />
            <p className="mt-2 max-w-[48ch] text-[0.88rem] text-faint">
              A free LinkedIn coach for Indian freshers. Not affiliated with LinkedIn. Your data stays in your browser.
            </p>
          </div>
          <button onClick={onCheck} className="text-[0.9rem] text-soft hover:text-ink">
            Check a message without signing up
          </button>
        </div>
      </footer>
    </div>
  );
}
