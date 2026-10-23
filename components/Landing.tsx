"use client";

import { useEffect, useRef, useState } from "react";
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
  Users,
} from "lucide-react";
import { LegalLinks, Wordmark } from "./chrome";
import { SITE } from "@/lib/site";
import type { Account } from "@/lib/auth-client";
import { useLandingMotion, useLenis } from "./motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------- The hero product window: one orchestrated moment ---------- */

const BLANKS = ["Ananya", "post on cleaning survey data", "how do you decide which outliers to drop"];

function HeroWindow() {
  const reduce = useReducedMotion();
  // 0: nothing filled ... 3: all blanks filled, 4: verdict and copy ready
  const [step, setStep] = useState(reduce ? 4 : 0);
  useEffect(() => {
    if (reduce) return;
    const ts = [1300, 2100, 2900, 3700].map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => ts.forEach(clearTimeout);
  }, [reduce]);
  const filled = (i: number) => step > i;
  const blank = (i: number) => (
    <motion.mark layout className={filled(i) ? "filled" : "blank"} initial={false} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: EASE }}>
      {filled(i) ? BLANKS[i] : ["their first name", "one thing they posted", "your one question"][i]}
    </motion.mark>
  );

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: EASE, delay: 0.5 }}
      className="relative mx-auto w-full max-w-5xl"
      aria-label="A sample Lynkr screen: a message with blanks the user fills in"
      role="img"
    >
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
        <div className="flex items-center gap-2 border-b border-line bg-muted px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="mx-auto rounded-md bg-surface px-3 py-0.5 text-[0.75rem] text-faint">lynkr / outreach</span>
        </div>
        <div className="grid sm:grid-cols-[11rem_1fr]">
          <div className="hidden border-r border-line bg-bg p-3 sm:block">
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
          <div className="p-5 text-left sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[1.05rem] font-medium">First message to a stranger</p>
              <span className="rounded-full bg-good/10 px-2 py-0.5 text-[0.72rem] text-good">Good reason to contact</span>
            </div>
            <div className="sheet mt-4 text-[0.92rem] sm:text-[0.98rem]">
              Hi {blank(0)}, I read your {blank(1)}. I&apos;m a final-year B.Com student working towards data analyst roles. I built a Power BI dashboard for
              our college fest that tracked 40 sponsors. One question: {blank(2)}?
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.85rem] font-medium text-white transition-colors duration-500 ${step >= 4 ? "bg-accent" : "bg-accent/35"}`}>
                <Copy size={14} aria-hidden /> Copy
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={step >= 4 ? "ready" : "fill"}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className={`rounded-full px-2.5 py-0.5 text-[0.78rem] ${step >= 4 ? "bg-good/10 text-good" : "bg-warn/10 text-warn"}`}
                >
                  {step >= 4 ? "Looks ready for your review" : `Fill ${3 - Math.min(step, 3)} blank${3 - Math.min(step, 3) === 1 ? "" : "s"} first`}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Floating notes: where the draft's facts came from, and what was checked. */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 1.2 }}
        className="absolute -left-6 bottom-10 hidden w-60 rounded-xl border border-line bg-surface p-3 text-left text-[0.78rem] shadow-md lg:block xl:-left-16"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-accent">F1</span>
          <span className="text-faint">Project</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-good/10 px-2 py-0.5 text-good">
            <Check size={12} aria-hidden /> Confirmed
          </span>
        </div>
        <p className="mt-1.5 leading-snug">I built a Power BI dashboard that tracked 40 sponsors.</p>
      </motion.div>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 1.4 }}
        className="absolute -right-6 -top-10 hidden w-56 rounded-xl border border-line bg-surface p-3 text-left text-[0.78rem] shadow-md lg:block xl:-right-14"
      >
        <p className="flex items-center gap-1.5 font-medium">
          <ShieldCheck size={14} className="text-accent" aria-hidden /> Checked before you send
        </p>
        <ul className="mt-2 space-y-1 text-soft">
          {["44 of 90 words", "One clear ask", "No referral ask to a stranger"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check size={12} className="text-good" aria-hidden /> {t}
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}

/* ---------- How it works: a real sequence, with a small product visual each ---------- */

function StepVisual({ n }: { n: number }) {
  const card = "h-full rounded-xl border border-line bg-surface p-4 shadow-sm";
  if (n === 0)
    return (
      <div className={card}>
        <p className="text-[0.98rem] font-medium leading-snug">What did you personally do on that project?</p>
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
      <div className={`${card} space-y-2.5`}>
        {[
          ["F1", "Built a sponsor dashboard", "Confirmed", "good"],
          ["F2", "Wrote the SQL myself", "Confirmed", "good"],
          ["F3", "Saved 6 hours a week", "To check", "warn"],
        ].map(([id, t, s, tone]) => (
          <div key={id} className="flex items-center gap-2 text-[0.8rem]">
            <span className="font-semibold text-accent">{id}</span>
            <span className="min-w-0 flex-1 truncate">{t}</span>
            <span className={`rounded-full px-2 py-0.5 text-[0.7rem] ${tone === "good" ? "bg-good/10 text-good" : "bg-warn/10 text-warn"}`}>{s}</span>
          </div>
        ))}
      </div>
    );
  return (
    <div className={card}>
      <div className="sheet text-[0.8rem] leading-relaxed">
        Your point about <mark className="filled">metric definitions</mark> matches what I saw building our fest dashboard.
      </div>
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[0.78rem] font-medium text-white">
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
    <div data-reveal-item className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow duration-500 hover:shadow-md ${className}`}>
      <div className="flex-1 p-5 sm:p-6">{children}</div>
      <div className="p-5 pt-0 sm:p-6 sm:pt-0">
        <h3 className="text-[1.15rem]">{title}</h3>
        <p className="mt-1.5 text-[0.95rem] text-soft">{body}</p>
      </div>
    </div>
  );
}

/* ---------- FAQ ---------- */

const FAQ = [
  ["How much does it cost?", `${SITE.price} a ${SITE.period}, taxes included. You subscribe first, then use Lynkr. Cancel any time, and your first payment can be refunded within ${SITE.refundDays} days.`],
  ["Is there a free trial?", "No. Access starts when you subscribe. Dodo Payments emails you a license key, and you enter it in Lynkr. There's no separate account to create."],
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
      <button className="flex w-full items-center justify-between gap-4 py-5 text-left text-[1.05rem] font-medium transition-colors hover:text-accent" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {q}
        <ChevronDown size={18} className={`shrink-0 text-faint transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
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

const PROMISES = ["No LinkedIn login", "No profile scraping", "Nothing posted for you", "Only facts you confirmed", "Blanks, never guesses", `${SITE.price} a ${SITE.period}, cancel any time`, "Works on your phone"];

const STATS = [
  ["7", "tools, one Story Vault"],
  ["200", "characters, the most a connection note gets"],
  ["0", "passwords asked, ever"],
];

const EYEBROW = "text-[0.9rem] font-semibold text-accent";
const H2 = "text-[2.1rem] leading-[1.08] tracking-[-0.03em] sm:text-[3rem]";
const SECTION = "scroll-mt-20 px-4 py-20 sm:px-6 sm:py-32";

export function Landing({
  onStart,
  onCheck,
  mock,
  access = "open",
  account = null,
  resume = null,
}: {
  onStart: () => void;
  onCheck: () => void;
  mock: boolean | null;
  /** "paid": the app needs a subscription. "subscribed": this browser has an active key. "open": no paywall (local development). */
  access?: "open" | "paid" | "subscribed";
  /** Lynkr accounts: when they're on and nobody is signed in, the main buttons lead to sign-up. */
  account?: Account | null;
  /** Saved progress in this browser: "drafts" if drafts exist, "flow" if partway through. */
  resume?: "drafts" | "flow" | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  useLenis();
  useLandingMotion(root);

  const primary = resume === "drafts" ? "Open my drafts" : resume === "flow" ? "Continue where you left off" : access === "paid" ? "Get access" : "Start the interview";
  // New visitors with accounts switched on create an account first; everyone else carries on as before.
  const toSignup = access === "paid" && !resume && account?.accounts === true && !account.signedIn;
  const start = () => (toSignup ? window.location.assign("/signup") : onStart());
  const cta = (label = primary) => (
    <button
      onClick={start}
      className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-6 text-[1rem] font-semibold text-white transition-colors duration-300 hover:bg-accent-strong"
    >
      {label} <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
    </button>
  );

  return (
    <div ref={root} className="w-full bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6" aria-label="Main">
          <Wordmark className="text-[1.4rem]" />
          <div className="ml-auto hidden items-center gap-7 text-[0.92rem] text-soft md:flex">
            {[
              ["#how", "How it works"],
              ["#features", "What you get"],
              ["#pricing", "Pricing"],
              ["#never", "Privacy"],
              ["#faq", "Questions"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="transition-colors hover:text-ink">
                {label}
              </a>
            ))}
          </div>
          {account?.accounts && !account.signedIn && (
            <a href="/login" className="ml-auto text-[0.92rem] text-soft transition-colors hover:text-ink md:ml-0">
              Sign in
            </a>
          )}
          <button
            onClick={start}
            className={`${account?.accounts && !account.signedIn ? "" : "ml-auto md:ml-0"} inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[0.9rem] font-medium text-white transition-colors hover:bg-ink/85`}
          >
            {resume ? (resume === "drafts" ? "My drafts" : "Continue") : toSignup ? "Get started" : access === "paid" ? "Get access" : "Start"} <ArrowRight size={15} aria-hidden />
          </button>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-28">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(55%_60%_at_50%_0%,rgba(58,66,200,0.07),transparent_75%)]" aria-hidden />
          <div className="relative mx-auto max-w-4xl text-center">
            <h1 data-split="load" className="text-[3rem] leading-[1] tracking-[-0.045em] sm:text-[5.5rem]">
              {SITE.tagline}
            </h1>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.35 }}
            >
              <p className="mt-6 text-[1.3rem] leading-snug text-ink sm:text-[1.6rem]">Write to one person. Sound like you.</p>
              <p className="mx-auto mt-4 max-w-[54ch] text-[1rem] leading-relaxed text-soft sm:text-[1.08rem]">
                Lynkr interviews you about one real piece of work, keeps the facts in your Story Vault, and drafts your LinkedIn profile, messages
                and posts from them. Anything it doesn&apos;t know stays a blank only you can fill.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                {cta()}
                {access !== "paid" && (
                  <button
                    onClick={onCheck}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-5 text-[1rem] font-medium transition-colors hover:border-ink/25"
                  >
                    <BadgeCheck size={17} className="text-accent" aria-hidden /> Check a message
                  </button>
                )}
              </div>
              <p className="mt-4 text-[0.85rem] text-faint">{SITE.price} a {SITE.period}, taxes included. Cancel any time. No LinkedIn login. {mock ? "Running in demo mode." : ""}</p>
            </motion.div>
          </div>
          <div className="relative mt-16 sm:mt-24">
            <HeroWindow />
          </div>
        </section>

        {/* Promises */}
        <section aria-label="What Lynkr promises" className="border-y border-line px-4 py-6 sm:px-6">
          <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[0.9rem] text-soft">
            {PROMISES.map((p) => (
              <li key={p} className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-accent" aria-hidden /> {p}
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="how" className={SECTION}>
          <div className="mx-auto max-w-6xl">
            <p className={EYEBROW}>How it works</p>
            <h2 data-split className={`mt-3 max-w-[22ch] ${H2}`}>
              Three steps from one story to a message you&apos;d actually send.
            </h2>
            <ol data-reveal className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
              {STEPS.map(([t, d], i) => (
                <li key={t} data-reveal-item>
                  <div className="md:h-44">
                    <StepVisual n={i} />
                  </div>
                  <p className="mt-7 text-[0.85rem] font-semibold text-faint">Step {i + 1}</p>
                  <h3 className="mt-1 text-[1.3rem]">{t}</h3>
                  <p className="mt-2 max-w-[40ch] text-soft">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className={`${SECTION} !pt-0`}>
          <div className="mx-auto max-w-6xl">
            <div className="grid items-end gap-6 md:grid-cols-[1.4fr_1fr]">
              <div>
                <p className={EYEBROW}>What you get</p>
                <h2 data-split className={`mt-3 ${H2}`}>
                  Everything a fresher needs to get noticed, nothing that fakes it.
                </h2>
              </div>
              <p className="text-[1.05rem] text-soft md:pb-2">Seven tools, one Story Vault. Every draft points back to the facts it used.</p>
            </div>
            <div data-reveal className="mt-12 grid gap-4 md:grid-cols-6">
              <Tile className="md:col-span-4" title="Profile fix" body="Your headline, About and every section checked against the role you want. Top three fixes first, each with what it's based on.">
                <div className="rounded-xl bg-muted p-4 text-[0.85rem]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-accent">1.</span>
                    <span className="font-semibold">Headline</span>
                    <span className="rounded-full bg-bad/10 px-2 py-0.5 text-[0.75rem] text-bad">Fix first</span>
                  </div>
                  <p className="mt-2 text-soft line-through decoration-bad/60">Commerce student | Hardworking</p>
                  <p className="mt-1 text-[1rem]">Data analyst | Power BI dashboard tracking 40 sponsors | SQL</p>
                </div>
              </Tile>
              <Tile className="md:col-span-2" title="Message checker" body="Marks the exact words to change and fixes them in one click.">
                <div className="sheet text-[0.85rem] leading-relaxed">
                  Hello <mark className="blank">sir</mark>, <mark className="blank">kindly revert</mark> on the analyst role.
                </div>
              </Tile>
              <Tile className="md:col-span-2" title="Connect" body="Who to look for, and whether you have a real reason to write, before any wording.">
                <div className="space-y-2 text-[0.8rem]">
                  <span className="inline-block rounded-full bg-good/10 px-2.5 py-0.5 text-good">Good reason to contact</span>
                  <span className="block w-fit rounded-full bg-bad/10 px-2.5 py-0.5 text-bad">Hold off: referral ask to a stranger</span>
                </div>
              </Tile>
              <Tile className="md:col-span-2" title="This week" body="Three messages, two comments, one post on a Monday to Friday plan, with calendar reminders.">
                <div className="grid grid-cols-5 gap-1.5 text-[0.7rem]">
                  {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => (
                    <div key={d} className="rounded-md bg-muted p-1.5">
                      <p>{d}</p>
                      <span className={`mt-1 block h-1.5 rounded-full ${i === 1 ? "bg-accent" : "bg-accent/40"}`} />
                      {i % 2 === 0 && <span className="mt-1 block h-1.5 rounded-full bg-accent/15" />}
                    </div>
                  ))}
                </div>
              </Tile>
              <Tile className="md:col-span-2" title="Comment helper" body="Paste a post you found, add your own point, get one comment. Or a clear &quot;skip this one&quot;.">
                <div className="rounded-lg border-l-2 border-accent/50 bg-muted px-3 py-2 text-[0.82rem] text-soft">&quot;Most dashboards fail because nobody agrees on the metric definitions.&quot;</div>
                <div className="mt-2 flex items-center gap-1.5 text-[0.78rem] text-good">
                  <MessageSquareText size={13} aria-hidden /> 41 words, uses your fact F1
                </div>
              </Tile>
            </div>

            <dl data-reveal className="mt-16 grid grid-cols-3 divide-x divide-line border-y border-line">
              {STATS.map(([n, label]) => (
                <div key={label} data-reveal-item className="flex flex-col-reverse justify-end px-3 py-7 sm:px-8">
                  <dt className="mt-2 text-[0.78rem] leading-snug text-soft sm:text-[0.92rem]">{label}</dt>
                  <dd className="text-[2.2rem] font-semibold leading-none tracking-[-0.04em] sm:text-[3.2rem]">{n}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Never */}
        <section id="never" className={`${SECTION} bg-muted`}>
          <div className="mx-auto max-w-6xl">
            <p className={EYEBROW}>Privacy</p>
            <h2 data-split className={`mt-3 max-w-[18ch] ${H2}`}>
              Some things Lynkr will never do.
            </h2>
            <p className="mt-5 max-w-[52ch] text-[1.05rem] text-soft">It drafts. You decide what&apos;s true and what gets sent.</p>
            <ul data-reveal className="mt-12 grid gap-4 sm:grid-cols-2">
              {[
                [Lock, "Ask for your LinkedIn login", "No password, no cookies, no connected account. Ever."],
                [EyeOff, "Scrape profiles or name strangers", "It suggests kinds of people to look for. You find and choose them."],
                [Send, "Post, comment or message for you", "Every draft is copied and sent by you, in LinkedIn."],
                [ShieldCheck, "Invent a fact about you", "Drafts use only facts you confirmed. Anything else stays a blank."],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof Lock;
                return (
                  <li key={t as string} data-reveal-item className="rounded-2xl border border-line bg-surface p-6 sm:p-7">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-wash">
                      <I size={18} className="text-accent" aria-hidden />
                    </span>
                    <p className="mt-5 text-[1.15rem] font-medium">{t as string}</p>
                    <p className="mt-1.5 text-[0.95rem] text-soft">{d as string}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className={SECTION}>
          <div className="mx-auto max-w-6xl">
            <p className={EYEBROW}>Pricing</p>
            <h2 data-split className={`mt-3 max-w-[18ch] ${H2}`}>
              One plan. Pay first, then use it.
            </h2>
            <div data-reveal className="mt-12 max-w-xl rounded-2xl border border-line bg-surface p-6 shadow-md sm:p-8">
              <p className="text-[3rem] font-semibold leading-none tracking-[-0.04em]">
                {SITE.price} <span className="text-[1.05rem] font-normal tracking-normal text-soft">a {SITE.period}, taxes included</span>
              </p>
              <ul className="mt-6 space-y-2.5 text-[0.98rem] text-soft">
                <li className="flex gap-2.5"><Check size={17} className="mt-1 shrink-0 text-accent" aria-hidden /> Every tool: interview, Story Vault, profile fix, outreach, posts, Connect and the weekly plan</li>
                <li className="flex gap-2.5"><Check size={17} className="mt-1 shrink-0 text-accent" aria-hidden /> Cancel any time; access runs to the end of the month you paid for</li>
                <li className="flex gap-2.5"><Check size={17} className="mt-1 shrink-0 text-accent" aria-hidden /> Your first payment can be refunded within {SITE.refundDays} days</li>
                <li className="flex gap-2.5"><Check size={17} className="mt-1 shrink-0 text-accent" aria-hidden /> No free tier and no free trial. Payments are handled by Dodo Payments, our Merchant of Record</li>
              </ul>
              <div className="mt-7">{cta(access === "subscribed" ? "Open Lynkr" : access === "paid" ? "Get access" : primary)}</div>
              <p className="mt-4 text-[0.85rem] text-faint">
                See the <a className="underline underline-offset-4 hover:text-ink" href="/terms">Terms</a>, <a className="underline underline-offset-4 hover:text-ink" href="/refunds">refund policy</a> and <a className="underline underline-offset-4 hover:text-ink" href="/privacy">privacy policy</a>.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className={`${SECTION} !pt-0`}>
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_1.4fr]">
            <div>
              <p className={EYEBROW}>Questions</p>
              <h2 data-split className={`mt-3 ${H2}`}>
                Questions people ask first.
              </h2>
            </div>
            <div className="border-t border-line">
              {FAQ.map(([q, a]) => (
                <FaqItem key={q} q={q} a={a} />
              ))}
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section className="px-4 pb-20 sm:px-6 sm:pb-28">
          <div data-reveal className="mx-auto max-w-6xl rounded-[2rem] bg-muted px-6 py-16 text-center sm:px-12 sm:py-24">
            <h2 data-split className="mx-auto max-w-[18ch] text-[2.1rem] leading-[1.08] tracking-[-0.03em] sm:text-[3.4rem]">
              Start with one thing you actually did.
            </h2>
            <p className="mx-auto mt-5 max-w-[48ch] text-soft">About ten minutes from basics to your first draft. Nothing to install. {SITE.price} a {SITE.period}, taxes included. Cancel any time.</p>
            <div className="mt-9 flex justify-center">{cta(resume || access === "paid" ? primary : "Start the interview")}</div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6">
          <div>
            <Wordmark className="text-[1.25rem]" />
            <p className="mt-2 max-w-[48ch] text-[0.88rem] text-faint">
              A LinkedIn drafting tool for Indian freshers. Not affiliated with LinkedIn. Your data stays in your browser.
            </p>
            <LegalLinks className="mt-4" />
          </div>
          <button onClick={onCheck} className="text-[0.9rem] text-soft transition-colors hover:text-ink">
            {access === "paid" ? "Get access" : "Check a message"}
          </button>
        </div>
      </footer>
    </div>
  );
}
