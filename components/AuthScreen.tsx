"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Check, Eye, EyeOff, Mail, MailCheck, ShieldCheck, Sparkles } from "lucide-react";
import { authClient, loadAccount, type Account } from "@/lib/auth-client";
import { InkThreads } from "./InkThreads";
import { Wordmark } from "./chrome";
import { ErrorNote } from "./ui";

export type AuthMode = "signup" | "login" | "forgot" | "reset";

const EASE = [0.22, 1, 0.36, 1] as const;
/** Where people land after signing in: the app decides between the interview, drafts and the paywall. */
const AFTER = "/#start";

/** The sign-in method used last in this browser, so it can be marked "Last used". Not sensitive: no email or token. */
const LAST = "lynkr.lastAuth";
type Method = "google" | "email" | "magic";
function remember(m: Method) {
  try {
    localStorage.setItem(LAST, m);
  } catch {}
}

const field =
  "w-full rounded-xl border border-line bg-bg/60 px-4 py-3 text-[0.98rem] text-ink placeholder:text-faint transition-colors focus:border-accent/60 focus:bg-bg focus:outline-none";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/* ---------- The right-hand panel: what Lynkr does, in motion ---------- */

const COLUMNS = [
  ["Facts you confirmed, nothing invented", "Blanks for anything Lynkr doesn't know", "Under 200 characters for a connection note", "One clear ask per message"],
  ["No LinkedIn login, ever", "Nothing posted or sent for you", "Your Story Vault stays in your browser", "Top three profile fixes first"],
  ["A Monday to Friday plan", "Comments that use your own point", "Marks the exact words to change", "Cancel any time"],
];

function Column({ items, reverse }: { items: string[]; reverse?: boolean }) {
  const list = [...items, ...items];
  return (
    <div className="h-full overflow-hidden">
      <div className={`auth-col flex flex-col gap-3 ${reverse ? "auth-col-reverse" : ""}`}>
        {list.map((t, i) => (
          <div key={i} aria-hidden={i >= items.length} className="edge rounded-xl border border-line bg-surface/70 p-4 text-[0.88rem] text-soft backdrop-blur">
            <Check size={14} className="mb-2 text-marigold" aria-hidden />
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function Showcase() {
  return (
    <aside className="grain relative hidden h-dvh overflow-hidden border-l border-white/[0.06] bg-night-2/50 lg:sticky lg:top-0 lg:block" aria-label="What Lynkr does">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,rgba(99,110,255,0.35),transparent_70%)]" aria-hidden />
      <InkThreads className="pointer-events-none absolute inset-0 h-full w-full opacity-50" />
      <div className="relative flex h-full flex-col px-10 pb-0 pt-14 xl:px-14">
        <p className="text-[0.78rem] font-semibold uppercase tracking-[0.2em] text-marigold">Inside Lynkr</p>
        <h2 className="mt-3 max-w-[16ch] text-[2.4rem] leading-[1.05]">
          Messages that sound like <span className="ink-accent">you.</span>
        </h2>
        <div className="edge mt-8 rounded-2xl border border-line bg-surface/80 p-5 shadow-lg backdrop-blur-xl">
          <div className="flex items-center gap-2 text-[0.8rem]">
            <span className="font-serif text-[1rem]">First message to a stranger</span>
            <span className="ml-auto rounded-full border border-good/40 bg-good/10 px-2 py-0.5 text-good">Good reason to contact</span>
          </div>
          <div className="sheet mt-3 text-[0.9rem]">
            Hi <mark className="filled">Ananya</mark>, I read your <mark className="filled">post on cleaning survey data</mark>. I built a Power BI dashboard for our college fest that
            tracked 40 sponsors. One question: <mark className="blank">your one question</mark>?
          </div>
        </div>
        <div className="relative mt-8 grid min-h-0 flex-1 grid-cols-3 gap-3 [mask-image:linear-gradient(to_bottom,transparent,#000_12%,#000_80%,transparent)]">
          <Column items={COLUMNS[0]} />
          <Column items={COLUMNS[1]} reverse />
          <Column items={COLUMNS[2]} />
        </div>
      </div>
    </aside>
  );
}

/* ---------- The form ---------- */

function LastUsed({ dark = false }: { dark?: boolean }) {
  return <span className={`ml-2 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${dark ? "bg-bg/15 text-bg" : "bg-accent/15 text-accent"}`}>Last used</span>;
}

/** `token` (password reset) and `linkError` (a failed Google or email link) come from the address, read by the page. */
export function AuthScreen({ mode, token = "", linkError = "" }: { mode: AuthMode; token?: string; linkError?: string }) {
  const reduce = useReducedMotion();
  const [account, setAccount] = useState<Account | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const name = `${first.trim()} ${last.trim()}`.trim();
  const [lastUsed, setLastUsed] = useState<Method | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // After an email goes out: "verify" (new account), "magic" (sign-in link) or "reset".
  const [sent, setSent] = useState<"verify" | "magic" | "reset" | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    loadAccount().then((a) => {
      let m: string | null = null;
      try {
        m = localStorage.getItem(LAST);
      } catch {}
      setLastUsed(m === "google" || m === "email" || m === "magic" ? m : null);
      setAccount(a);
      // Already signed in: straight into the app.
      if (a.signedIn && (mode === "signup" || mode === "login")) window.location.replace(AFTER);
    });
  }, [mode]);

  async function run(label: string, fn: () => Promise<{ error: { message?: string; status?: number } | null } | void>) {
    setBusy(label);
    setError(null);
    try {
      const r = await fn();
      if (r && r.error) {
        setError(
          r.error.status === 403
            ? "Confirm your email first. We've sent you a new link."
            : r.error.message || "Something went wrong. Please try again.",
        );
        setBusy(null);
        return false;
      }
      return true;
    } catch {
      setError("Couldn't reach Lynkr. Check your connection and try again.");
      setBusy(null);
      return false;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup") {
      if (!first.trim() || !email.trim() || password.length < 8) return setError("Enter your first name, your email and a password of at least 8 characters.");
      if (await run("email", () => authClient.signUp.email({ name, email: email.trim(), password, callbackURL: AFTER }))) {
        remember("email");
        setSent("verify");
        setBusy(null);
      }
    } else if (mode === "login") {
      if (!email.trim() || !password) return setError("Enter your email and password.");
      if (await run("email", () => authClient.signIn.email({ email: email.trim(), password, callbackURL: AFTER }))) {
        remember("email");
        window.location.assign(AFTER);
      }
    } else if (mode === "forgot") {
      if (!email.trim()) return setError("Enter your email.");
      if (await run("email", () => authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" }))) {
        setSent("reset");
        setBusy(null);
      }
    } else {
      if (password.length < 8) return setError("Use at least 8 characters.");
      if (await run("email", () => authClient.resetPassword({ newPassword: password, token }))) {
        setDone(true);
        setBusy(null);
      }
    }
  }

  async function magic() {
    if (!email.trim()) return setError("Enter your email above, then we'll send the link.");
    if (await run("magic", () => authClient.signIn.magicLink({ email: email.trim(), name: name || undefined, callbackURL: AFTER, errorCallbackURL: "/login?error=link" }))) {
      remember("magic");
      setSent("magic");
      setBusy(null);
    }
  }

  async function google() {
    remember("google");
    await run("google", () => authClient.signIn.social({ provider: "google", callbackURL: AFTER, errorCallbackURL: "/login?error=google" }));
  }

  const title = { signup: "Create your account", login: "Welcome back", forgot: "Reset your password", reset: "Choose a new password" }[mode];
  const sub = {
    signup: "Start writing LinkedIn messages and posts from things you actually did.",
    login: "Sign in to pick up where you left off.",
    forgot: "Enter your account email and we'll send a reset link.",
    reset: "Use at least 8 characters.",
  }[mode];
  const off = account !== null && !account.accounts;

  return (
    <div className="grid min-h-dvh w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="relative flex flex-col px-4 py-6 sm:px-10 lg:px-16">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_30%_0%,rgba(99,110,255,0.18),transparent_70%)] lg:hidden" aria-hidden />
        <header className="relative flex items-center justify-between">
          <Link href="/" aria-label="Lynkr home page" className="rounded-md">
            <Wordmark className="!font-semibold" />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-[0.9rem] text-soft transition-colors hover:text-ink">
            <ArrowLeft size={15} aria-hidden /> Home
          </Link>
        </header>

        <motion.main
          id="main"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative mx-auto my-auto w-full max-w-[25rem] py-8"
        >
          {sent ? (
            <div role="status">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-accent/40 bg-accent/10 text-accent">
                <MailCheck size={22} aria-hidden />
              </span>
              <h1 className="mt-6 text-[2.2rem] leading-[1.05]">Check your email</h1>
              <p className="mt-3 text-soft">
                {sent === "verify" && <>We sent a link to <b className="text-ink">{email.trim()}</b>. Open it to confirm your email and you&apos;ll be signed in.</>}
                {sent === "magic" && <>We sent a sign-in link to <b className="text-ink">{email.trim()}</b>. It works once and expires in five minutes.</>}
                {sent === "reset" && <>If an account uses <b className="text-ink">{email.trim()}</b>, a reset link is on its way. It expires in one hour.</>}
              </p>
              <p className="mt-6 text-[0.9rem] text-faint">Nothing arrived? Check spam, or{" "}
                <button className="text-accent underline underline-offset-4" onClick={() => setSent(null)}>try again</button>.
              </p>
            </div>
          ) : done ? (
            <div role="status">
              <h1 className="text-[2.2rem] leading-[1.05]">Password changed</h1>
              <p className="mt-3 text-soft">You can sign in with your new password now.</p>
              <a href="/login" className="mt-6 inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-semibold text-bg">Sign in</a>
            </div>
          ) : (
            <>
              {mode === "signup" && (
                <p className="edge inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.8rem] text-soft">
                  <Sparkles size={13} className="text-marigold" aria-hidden /> Get found on LinkedIn
                </p>
              )}
              <h1 className="mt-4 text-[2.4rem] leading-[1.05] tracking-[-0.02em] sm:text-[2.7rem]">{title}</h1>
              <p className="mt-3 text-soft">{sub}</p>

              {off && (
                <p className="mt-6 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-[0.92rem] text-warn">
                  Accounts aren&apos;t switched on yet. You can still{" "}
                  <Link className="underline underline-offset-4" href="/#start">use a license key</Link>.
                </p>
              )}
              {linkError && mode === "login" && (
                <p className="mt-6 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-[0.92rem] text-bad">
                  {linkError === "google" ? "Google sign-in didn't finish. Please try again." : "That link has expired or was already used. Ask for a new one."}
                </p>
              )}

              {(mode === "signup" || mode === "login") && account?.google && (
                <>
                  <button
                    onClick={google}
                    disabled={busy !== null}
                    className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface font-medium transition-colors hover:border-accent/50 hover:bg-muted disabled:opacity-50"
                  >
                    <GoogleMark /> {busy === "google" ? "Opening Google..." : "Continue with Google"}
                    {lastUsed === "google" && <LastUsed />}
                  </button>
                  <div className="my-6 flex items-center gap-3 text-[0.8rem] text-faint">
                    <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
                  </div>
                </>
              )}

              <form onSubmit={submit} className={`space-y-4 ${(mode === "signup" || mode === "login") && account?.google ? "" : "mt-8"}`} noValidate>
                {mode === "signup" && (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-[0.9rem] font-medium">First name</span>
                      <input className={field} value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" placeholder="Ananya" required />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[0.9rem] font-medium">Last name</span>
                      <input className={field} value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" placeholder="Rao" />
                    </label>
                  </div>
                )}
                {mode !== "reset" && (
                  <label className="block">
                    <span className="mb-1.5 block text-[0.9rem] font-medium">Email</span>
                    <input className={field} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
                  </label>
                )}
                {mode !== "forgot" && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[0.9rem] font-medium">
                      <label htmlFor="lynkr-password">{mode === "reset" ? "New password" : "Password"}</label>
                      {mode === "login" && (
                        <a href="/forgot-password" className="text-[0.85rem] font-normal text-soft hover:text-ink">
                          Forgot password?
                        </a>
                      )}
                    </div>
                    <span className="relative block">
                      <input
                        id="lynkr-password"
                        className={`${field} pr-12`}
                        type={show ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
                      />
                      <button
                        type="button"
                        onClick={() => setShow((s) => !s)}
                        aria-label={show ? "Hide password" : "Show password"}
                        className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-soft hover:text-ink"
                      >
                        {show ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
                      </button>
                    </span>
                  </div>
                )}
                <ErrorNote message={error} />
                <button
                  type="submit"
                  disabled={busy !== null || off}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-ink font-semibold text-bg shadow-[0_10px_40px_-12px_rgba(170,179,255,0.6)] transition-colors hover:bg-white disabled:opacity-50"
                >
                  {busy === "email"
                    ? "One moment..."
                    : { signup: "Create account", login: "Sign in", forgot: "Send reset link", reset: "Save new password" }[mode]}
                  {mode === "login" && lastUsed === "email" && <LastUsed dark />}
                </button>
                {(mode === "signup" || mode === "login") && (
                  <button
                    type="button"
                    onClick={magic}
                    disabled={busy !== null || off}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-[0.95rem] text-soft transition-colors hover:border-accent/50 hover:text-ink disabled:opacity-50"
                  >
                    <Mail size={16} aria-hidden /> {busy === "magic" ? "Sending..." : "Email me a sign-in link instead"}
                    {mode === "login" && lastUsed === "magic" && <LastUsed />}
                  </button>
                )}
              </form>

              <p className="mt-8 text-center text-[0.92rem] text-soft">
                {mode === "signup" ? (
                  <>Already have an account? <a href="/login" className="font-medium text-ink underline-offset-4 hover:underline">Sign in</a></>
                ) : mode === "login" ? (
                  <>New to Lynkr? <a href="/signup" className="font-medium text-ink underline-offset-4 hover:underline">Create an account</a></>
                ) : (
                  <a href="/login" className="font-medium text-ink underline-offset-4 hover:underline">Back to sign in</a>
                )}
              </p>
              {mode === "signup" && (
                <p className="mt-4 text-center text-[0.8rem] leading-relaxed text-faint">
                  By continuing, you agree to the <a className="underline underline-offset-4 hover:text-ink" href="/terms">Terms</a> and{" "}
                  <a className="underline underline-offset-4 hover:text-ink" href="/privacy">Privacy Policy</a>.
                </p>
              )}
            </>
          )}
        </motion.main>

        <p className="relative flex items-center justify-center gap-1.5 text-[0.78rem] text-faint">
          <ShieldCheck size={13} aria-hidden /> No LinkedIn login. Your stories stay in your browser.
        </p>
      </div>
      <Showcase />
    </div>
  );
}
