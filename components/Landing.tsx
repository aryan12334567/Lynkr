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
  Sparkles,
  Users,
} from "lucide-react";
import { InkThreads } from "./InkThreads";
import { LegalLinks, Wordmark } from "./chrome";
import { SITE } from "@/lib/site";
import type { Account } from "@/lib/auth-client";
import { useLandingMotion, useLenis, useMagnetic, useSpotlight } from "./motion";

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
      <div className="pointer-events-none absolute -inset-x-10 -inset-y-8 -z-10 rounded-[3rem] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(122,132,255,0.35),transparent_70%)] blur-2xl" aria-hidden />
      <div className="edge overflow-hidden rounded-2xl border border-line bg-surface/90 shadow-lg backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-line bg-muted/60 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b5e]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-marigold/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-good/70" />
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
              <p className="font-serif text-[1.15rem] font-medium">First message to a stranger</p>
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
        className="edge absolute -left-4 bottom-10 hidden w-60 rounded-xl border border-line bg-surface/95 p-3 backdrop-blur-xl text-[0.78rem] shadow-md lg:block xl:-left-16"
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
        className="edge absolute -right-4 -top-12 hidden w-56 rounded-xl border border-line bg-surface/95 p-3 backdrop-blur-xl text-[0.78rem] shadow-md lg:block xl:-right-14"
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
      <div className="h-full edge rounded-xl border border-line bg-surface p-4 shadow-md">
        <p className="font-serif text-[1.02rem] font-medium leading-snug">What did you personally do on that project?</p>
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
      <div className="edge h-full space-y-2.5 rounded-xl border border-line bg-surface p-4 shadow-md">
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
    <div className="edge h-full rounded-xl border border-line bg-surface p-4 shadow-md">
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
    <div data-reveal-item className={`spot edge group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface/80 transition-colors duration-500 hover:border-accent/40 ${className}`}>
      <div className="flex-1 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(122,132,255,0.10),transparent_60%)] p-5 transition-transform duration-700 ease-out group-hover:-translate-y-0.5 sm:p-6">{children}</div>
      <div className="p-5 pt-0 sm:p-6 sm:pt-0">
        <h3 className="text-[1.3rem]">{title}</h3>
        <p className="mt-1.5 text-[0.95rem] text-soft">{body}</p>
      </div>
    </div>
  );
}

/* ---------- FAQ ---------- */

const FAQ = [
  ["How much does it cost?", `${SITE.price} per ${SITE.period}, plus applicable taxes. You subscribe first, then use Lynkr. Cancel any time, and your first payment can be refunded within ${SITE.refundDays} days.`],
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
      <button className="flex w-full items-center justify-between gap-4 py-5 text-left text-[1.05rem] font-medium transition-colors hover:text-accent-strong" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {q}
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line transition-all duration-300 ${open ? "rotate-180 border-accent/50 text-accent" : "text-soft"}`}>
          <ChevronDown size={16} aria-hidden />
        </span>
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

const EYEBROW = "text-[0.78rem] font-semibold uppercase tracking-[0.2em] text-marigold";
const H2 = "text-[2.3rem] leading-[1.05] sm:text-[3.4rem]";

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
  const magnet = useRef<HTMLDivElement>(null);
  useLenis();
  useLandingMotion(root);
  useSpotlight(root);
  useMagnetic(magnet, 0.2);

  const primary = resume === "drafts" ? "Open my drafts" : resume === "flow" ? "Continue where you left off" : access === "paid" ? "Get access" : "Start the interview";
  // New visitors with accounts switched on create an account first; everyone else carries on as before.
  const toSignup = access === "paid" && !resume && account?.accounts === true && !account.signedIn;
  const start = () => (toSignup ? window.location.assign("/signup") : onStart());
  const cta = (label = primary) => (
    <button
      onClick={start}
      className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-6 text-[1rem] font-semibold text-bg shadow-[0_10px_40px_-10px_rgba(170,179,255,0.55)] transition-[box-shadow,background-color] duration-300 hover:bg-white hover:shadow-[0_14px_50px_-8px_rgba(170,179,255,0.75)]"
    >
      {label} <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
    </button>
  );

  return (
    <div ref={root} className="theme-night grain w-full">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-bg/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6" aria-label="Main">
          <Wordmark className="text-[1.5rem] !font-semibold" />
          <div className="ml-auto hidden items-center gap-7 text-[0.92rem] text-soft md:flex">
            {[
              ["#how", "How it works"],
              ["#features", "What you get"],
              ["#pricing", "Pricing"],
              ["#never", "Privacy"],
              ["#faq", "Questions"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="relative transition-colors after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-300 hover:text-ink hover:after:scale-x-100"
              >
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
            className={`${account?.accounts && !account.signedIn ? "" : "ml-auto md:ml-0"} inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 text-[0.9rem] font-medium text-ink transition-colors hover:bg-white/[0.12]`}
          >
            {resume ? (resume === "drafts" ? "My drafts" : "Continue") : toSignup ? "Get started" : access === "paid" ? "Get access" : "Start"} <ArrowRight size={15} aria-hidden />
          </button>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-24">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div data-parallax="0.25" className="absolute left-1/2 top-[-18rem] h-[44rem] w-[70rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,110,255,0.42),transparent)] blur-3xl" />
            <div className="absolute right-[-10rem] top-[12rem] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,rgba(242,178,51,0.14),transparent)] blur-3xl" />
            <div className="paper-grid absolute inset-0" />
          </div>
          <InkThreads className="pointer-events-none absolute -top-24 left-1/2 h-[52rem] w-[110rem] -translate-x-1/2 opacity-50 [mask-image:linear-gradient(to_bottom,#000_40%,transparent_90%)]" />
          <div className="relative mx-auto max-w-4xl text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE }}
              className="edge inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[0.82rem] text-soft backdrop-blur"
            >
              <Sparkles size={14} className="text-marigold" aria-hidden /> Get found on LinkedIn
            </motion.p>
            <h1 data-split="load" className="mt-7 text-[3rem] font-normal leading-[1] tracking-[-0.035em] sm:text-[5.4rem]">
              Write to one person. <br className="hidden sm:block" />
              Sound like <span className="ink-accent">you.</span>
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.55 }}
              className="mx-auto mt-7 max-w-[54ch] text-[1.05rem] leading-relaxed text-soft sm:text-[1.15rem]"
            >
              Lynkr interviews you about one real piece of work, keeps the facts in your Story Vault, and drafts your LinkedIn profile, messages
              and posts from them. Anything it doesn&apos;t know stays a blank only you can fill.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.7 }}
              className="mt-9 flex flex-wrap items-center justify-center gap-3"
            >
              <div ref={magnet}>{cta()}</div>
              {access !== "paid" && (
                <button
                  onClick={onCheck}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 text-[1rem] font-medium backdrop-blur transition-colors hover:border-accent/50 hover:bg-white/[0.08]"
                >
                  <BadgeCheck size={17} className="text-accent" aria-hidden /> Check a message
                </button>
              )}
            </motion.div>
            <p className="mt-4 text-[0.85rem] text-faint">{SITE.price} a {SITE.period} plus taxes. Cancel any time. No LinkedIn login. {mock ? "Running in demo mode." : ""}</p>
          </div>
          <div data-tilt className="relative mt-14 sm:mt-20">
            <HeroWindow />
          </div>
        </section>

        {/* Promise ticker */}
        <div
          className="ticker-wrap relative overflow-hidden border-y border-white/[0.06] bg-white/[0.02] py-4 [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]"
          role="region"
          aria-label="What Lynkr promises"
        >
          <div className="ticker flex w-max gap-10 whitespace-nowrap text-[0.95rem] text-soft">
            {[...PROMISES, ...PROMISES].map((p, i) => (
              <span key={i} className="inline-flex items-center gap-10" aria-hidden={i >= PROMISES.length}>
                {p}
                <span className="h-1 w-1 rounded-full bg-marigold" />
              </span>
            ))}
          </div>
        </div>

        {/* How it works */}
        <section id="how" className="relative scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <p className={EYEBROW}>How it works</p>
            <h2 data-split className={`mt-4 max-w-[20ch] ${H2}`}>
              Three steps from one story to a message you&apos;d <span className="ink-accent">actually send.</span>
            </h2>
            <div className="relative mt-14">
              <ol data-reveal className="grid gap-12 md:grid-cols-3 md:gap-8">
                {STEPS.map(([t, d], i) => (
                  <li key={t} data-reveal-item>
                    <div className="md:h-48">
                      <StepVisual n={i} />
                    </div>
                    <div className="mt-8 flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-accent/40 bg-bg font-serif text-[1.05rem] text-accent shadow-[0_0_24px_-4px_rgba(170,179,255,0.6)]">
                        {i + 1}
                      </span>
                      <h3 className="text-[1.4rem]">{t}</h3>
                    </div>
                    <p className="mt-3 max-w-[40ch] text-soft">{d}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="relative scroll-mt-20 px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-end gap-6 md:grid-cols-[1.4fr_1fr]">
              <div>
                <p className={EYEBROW}>What you get</p>
                <h2 data-split className={`mt-4 ${H2}`}>
                  Everything a fresher needs to get noticed, <span className="ink-accent">nothing that fakes it.</span>
                </h2>
              </div>
              <p className="text-[1.05rem] text-soft md:pb-2">Seven tools, one Story Vault. Every draft points back to the facts it used.</p>
            </div>
            <div data-reveal className="mt-12 grid gap-4 md:grid-cols-6">
              <Tile className="md:col-span-4" title="Profile fix" body="Your headline, About and every section checked against the role you want. Top three fixes first, each with what it's based on.">
                <div className="rounded-xl border border-line bg-bg/60 p-4 text-[0.85rem]">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-[1.05rem] text-accent">1.</span>
                    <span className="font-semibold">Headline</span>
                    <span className="rounded-full border border-bad/40 bg-bad/10 px-2 py-0.5 text-[0.75rem] text-bad">Fix first</span>
                  </div>
                  <p className="mt-2 text-soft line-through decoration-bad/60">Commerce student | Hardworking</p>
                  <p className="mt-1 font-serif text-[1.02rem]">Data analyst | Power BI dashboard tracking 40 sponsors | SQL</p>
                </div>
              </Tile>
              <Tile className="md:col-span-2" title="Message checker" body="Marks the exact words to change and fixes them in one click.">
                <div className="sheet text-[0.85rem] leading-relaxed">
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
                    <div key={d} className="rounded-md border border-line bg-bg/60 p-1.5">
                      <p className="font-serif">{d}</p>
                      <span className={`mt-1 block h-1.5 rounded-full ${i === 1 ? "bg-marigold" : "bg-accent/60"}`} />
                      {i % 2 === 0 && <span className="mt-1 block h-1.5 rounded-full bg-accent/25" />}
                    </div>
                  ))}
                </div>
              </Tile>
              <Tile className="md:col-span-2" title="Comment helper" body="Paste a post you found, add your own point, get one comment. Or a clear &quot;skip this one&quot;.">
                <div className="rounded-lg border-l-2 border-accent/50 bg-bg/60 px-3 py-2 text-[0.82rem] text-soft">&quot;Most dashboards fail because nobody agrees on the metric definitions.&quot;</div>
                <div className="mt-2 flex items-center gap-1.5 text-[0.78rem] text-good">
                  <MessageSquareText size={13} aria-hidden /> 41 words, uses your fact F1
                </div>
              </Tile>
            </div>

            <dl data-reveal className="mt-14 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
              {STATS.map(([n, label]) => (
                <div key={label} data-reveal-item className="flex flex-col-reverse justify-end bg-bg px-3 py-5 sm:px-6 sm:py-7">
                  <dt className="mt-2 text-[0.78rem] leading-snug text-soft sm:text-[0.92rem]">{label}</dt>
                  <dd className="font-serif text-[2.2rem] leading-none tracking-tight text-ink sm:text-[3rem]">{n}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Never */}
        <section id="never" className="relative scroll-mt-20 overflow-hidden border-y border-white/[0.06] bg-night-2/60 px-4 py-20 sm:px-6 sm:py-28">
          <InkThreads className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-marigold/50 to-transparent" aria-hidden />
          <div className="relative mx-auto max-w-6xl">
            <p className={EYEBROW}>Privacy</p>
            <h2 data-split className={`mt-4 max-w-[18ch] ${H2}`}>
              Some things Lynkr will <span className="ink-accent">never do.</span>
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
                  <li key={t as string} data-reveal-item className="spot edge rounded-2xl border border-line bg-bg/60 p-6 backdrop-blur-sm sm:p-7">
                    <span className="grid h-11 w-11 place-items-center rounded-xl border border-marigold/30 bg-marigold/10">
                      <I size={20} className="text-marigold" aria-hidden />
                    </span>
                    <p className="mt-5 font-serif text-[1.3rem]">{t as string}</p>
                    <p className="mt-1.5 text-[0.95rem] text-soft">{d as string}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <p className={EYEBROW}>Pricing</p>
            <h2 data-split className={`mt-4 max-w-[18ch] ${H2}`}>
              One plan. <span className="ink-accent">Pay first, then use it.</span>
            </h2>
            <div data-reveal className="edge mt-12 max-w-xl rounded-2xl border border-line bg-surface p-6 sm:p-8">
              <p className="font-serif text-[3rem] leading-none">
                {SITE.price} <span className="text-[1.1rem] text-soft">per {SITE.period}, plus applicable taxes</span>
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
        <section id="faq" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_1.4fr]">
            <div>
              <p className={EYEBROW}>Questions</p>
              <h2 data-split className={`mt-4 ${H2}`}>
                Questions people <span className="ink-accent">ask first.</span>
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
          <div data-reveal className="edge relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-line bg-surface px-6 py-16 text-center sm:px-12 sm:py-24">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_100%,rgba(99,110,255,0.4),transparent_70%)]" aria-hidden />
            <div className="pointer-events-none absolute left-1/2 top-[60%] h-[20rem] w-[20rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(242,178,51,0.18),transparent)] blur-2xl" aria-hidden />
            <InkThreads className="pointer-events-none absolute inset-0 h-full w-full opacity-60" />
            <div className="relative">
              <h2 data-split className="mx-auto max-w-[18ch] text-[2.3rem] leading-[1.05] sm:text-[3.8rem]">
                Start with one thing you <span className="ink-accent">actually did.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-[48ch] text-soft">About ten minutes from basics to your first draft. Nothing to install. {SITE.price} a {SITE.period} plus taxes, cancel any time.</p>
              <div className="mt-9 flex justify-center">{cta(resume || access === "paid" ? primary : "Start the interview")}</div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6">
          <div>
            <Wordmark className="text-[1.35rem] !font-semibold" />
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
