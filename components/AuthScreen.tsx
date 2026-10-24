"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Check, Eye, EyeOff, Fingerprint, Mail, MailCheck, ShieldCheck } from "lucide-react";
import { authClient, loadAccount, passkeysSupported, startOneTap, type Account } from "@/lib/auth-client";
import { SITE } from "@/lib/site";
import { Wordmark } from "./chrome";
import { ErrorNote } from "./ui";

export type AuthMode = "signup" | "login" | "forgot" | "reset";

const EASE = [0.22, 1, 0.36, 1] as const;
/** Where people land after signing in: the app decides between the interview, drafts and the paywall. */
const AFTER = "/#start";

/** The sign-in method used last in this browser, so it can be marked "Last used". Not sensitive: no email or token. */
const LAST = "lynkr.lastAuth";
type Method = "google" | "apple" | "linkedin" | "passkey" | "email" | "code";
const METHODS: Method[] = ["google", "apple", "linkedin", "passkey", "email", "code"];
function remember(m: Method) {
  try {
    localStorage.setItem(LAST, m);
  } catch {}
}

const OPTION =
  "inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface font-medium transition-colors hover:border-ink/25 hover:bg-muted disabled:opacity-50";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-[0.98rem] text-ink placeholder:text-faint transition-colors focus:border-accent focus:outline-none";

function LinkedInMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path fill="#fff" d="M6.9 9.6h2.6V18H6.9zM8.2 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM11.1 9.6h2.5v1.15h.04c.35-.66 1.2-1.36 2.47-1.36 2.64 0 3.13 1.74 3.13 4V18h-2.6v-4.06c0-.97-.02-2.22-1.35-2.22-1.36 0-1.57 1.06-1.57 2.15V18h-2.6z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.37 12.73c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.14-2.77.83-3.49.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.31 1.16-.05 1.59-.75 2.99-.75 1.4 0 1.79.75 3.01.72 1.24-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.42-.93-2.45-3.71zM14.08 5.98c.64-.78 1.07-1.85.95-2.93-.92.04-2.04.61-2.7 1.39-.59.69-1.11 1.79-.97 2.85 1.03.08 2.08-.52 2.72-1.31z" />
    </svg>
  );
}

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
          <div key={i} aria-hidden={i >= items.length} className="rounded-xl border border-line bg-surface p-4 text-[0.88rem] text-soft">
            <Check size={14} className="mb-2 text-accent" aria-hidden />
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function Showcase() {
  return (
    <aside className="relative hidden h-dvh overflow-hidden border-l border-line bg-muted lg:sticky lg:top-0 lg:block" aria-label="What Lynkr does">
      <div className="relative flex h-full flex-col px-10 pb-0 pt-14 xl:px-14">
        <p className="text-[0.9rem] font-semibold text-accent">Inside Lynkr</p>
        <h2 className="mt-3 max-w-[16ch] text-[2.4rem] leading-[1.05] tracking-[-0.03em]">
          Messages that sound like you.
        </h2>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-md">
          <div className="flex items-center gap-2 text-[0.8rem]">
            <span className="text-[1rem] font-medium">First message to a stranger</span>
            <span className="ml-auto rounded-full bg-good/10 px-2 py-0.5 text-good">Good reason to contact</span>
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
  return <span className={`ml-2 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${dark ? "bg-white/20 text-white" : "bg-accent/15 text-accent"}`}>Last used</span>;
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
  // After an email goes out: "verify" (new account) or "reset".
  const [sent, setSent] = useState<"verify" | "reset" | null>(null);
  // The email a sign-in code was sent to, while the code is being entered.
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [passkeys, setPasskeys] = useState(false);
  const [done, setDone] = useState(false);
  const signInScreen = mode === "signup" || mode === "login";
  useEffect(() => {
    loadAccount().then((a) => {
      let m: string | null = null;
      try {
        m = localStorage.getItem(LAST);
      } catch {}
      setLastUsed(METHODS.includes(m as Method) ? (m as Method) : null);
      setAccount(a);
      setPasskeys(passkeysSupported());
      // Already signed in: straight into the app.
      if (a.signedIn && signInScreen) return window.location.replace(AFTER);
      if (signInScreen && a.googleClientId) startOneTap(a.googleClientId, AFTER);
      // Sign in: offer saved passkeys in the email field's autofill, where the browser supports it.
      if (mode === "login" && a.accounts && passkeysSupported()) {
        PublicKeyCredential.isConditionalMediationAvailable?.().then((ok) => {
          if (!ok) return;
          authClient.signIn.passkey({ autoFill: true }).then((r) => {
            if (r && !r.error) {
              remember("passkey");
              window.location.assign(AFTER);
            }
          }).catch(() => {});
        });
      }
    });
  }, [mode, signInScreen]);

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

  async function sendCode() {
    const to = (codeFor ?? email).trim();
    if (!to) return setError("Enter your email above, then we'll send a code.");
    if (await run("code", () => authClient.emailOtp.sendVerificationOtp({ email: to, type: "sign-in" }))) {
      setCodeFor(to);
      setCode("");
      setBusy(null);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!codeFor || !/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from the email.");
    if (await run("verify", () => authClient.signIn.emailOtp({ email: codeFor, otp: code, name: name || undefined }))) {
      remember("code");
      window.location.assign(AFTER);
    }
  }

  async function social(provider: "google" | "apple" | "linkedin") {
    remember(provider);
    await run(provider, () => authClient.signIn.social({ provider, callbackURL: AFTER, errorCallbackURL: `/login?error=${provider}` }));
  }

  async function withPasskey() {
    if (await run("passkey", () => authClient.signIn.passkey())) {
      remember("passkey");
      window.location.assign(AFTER);
    }
  }

  const title = { signup: "Create your account", login: "Welcome back", forgot: "Reset your password", reset: "Choose a new password" }[mode];
  const sub = {
    signup: "Start writing LinkedIn messages and posts from things you actually did.",
    login: "Sign in to pick up where you left off.",
    forgot: "Enter your account email and we'll send a reset link.",
    reset: "Use at least 8 characters.",
  }[mode];
  const off = account !== null && !account.accounts;
  // One-click options above the email form: Google, Apple, and (when signing in) a passkey.
  const quick = signInScreen && !off && (account?.google || account?.apple || account?.linkedin || (mode === "login" && passkeys));

  return (
    <div className="grid min-h-dvh w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="relative flex flex-col px-4 py-6 sm:px-10 lg:px-16">
        <header className="relative flex items-center justify-between">
          <Link href="/" aria-label="Lynkr home page" className="rounded-md">
            <Wordmark />
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
                {sent === "reset" && <>If an account uses <b className="text-ink">{email.trim()}</b>, a reset link is on its way. It expires in one hour.</>}
              </p>
              <p className="mt-6 text-[0.9rem] text-faint">Nothing arrived? Check spam, or{" "}
                <button className="text-accent underline underline-offset-4" onClick={() => setSent(null)}>try again</button>.
              </p>
            </div>
          ) : codeFor ? (
            <form onSubmit={verifyCode} noValidate>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-wash text-accent">
                <MailCheck size={22} aria-hidden />
              </span>
              <h1 className="mt-6 text-[2.2rem] leading-[1.05]">Enter your code</h1>
              <p className="mt-3 text-soft">
                We sent a 6-digit code to <b className="text-ink">{codeFor}</b>. It expires in ten minutes.
              </p>
              <label className="mt-8 block">
                <span className="mb-1.5 block text-[0.9rem] font-medium">Sign-in code</span>
                <input
                  className={`${field} text-center font-mono text-[1.5rem] tracking-[0.5em]`}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  autoFocus
                />
              </label>
              <div className="mt-4">
                <ErrorNote message={error} />
              </div>
              <button type="submit" disabled={busy !== null} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-50">
                {busy === "verify" ? "Checking..." : "Continue"}
              </button>
              <p className="mt-6 text-center text-[0.9rem] text-soft">
                No email?{" "}
                <button type="button" className="text-accent underline underline-offset-4" onClick={sendCode} disabled={busy !== null}>
                  {busy === "code" ? "Sending..." : "Send a new code"}
                </button>{" "}
                or{" "}
                <button type="button" className="text-accent underline underline-offset-4" onClick={() => (setCodeFor(null), setError(null))}>
                  use a different email
                </button>
                .
              </p>
            </form>
          ) : done ? (
            <div role="status">
              <h1 className="text-[2.2rem] leading-[1.05]">Password changed</h1>
              <p className="mt-3 text-soft">You can sign in with your new password now.</p>
              <a href="/login" className="mt-6 inline-flex min-h-12 items-center rounded-full bg-accent px-6 font-semibold text-white">Sign in</a>
            </div>
          ) : (
            <>
              {mode === "signup" && (
                <p className="text-[0.9rem] font-semibold text-accent">
                  {SITE.tagline}
                </p>
              )}
              <h1 className="mt-4 text-[2.4rem] leading-[1.05] tracking-[-0.02em] sm:text-[2.7rem]">{title}</h1>
              <p className="mt-3 text-soft">{sub}</p>

              {off && (
                <p className="mt-6 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-[0.92rem] text-warn">
                  Accounts aren&apos;t switched on yet. Please try again later.
                </p>
              )}
              {linkError && mode === "login" && (
                <p className="mt-6 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-[0.92rem] text-bad">
                  {linkError === "google"
                    ? "Google sign-in didn't finish. Please try again."
                    : linkError === "apple"
                      ? "Apple sign-in didn't finish. Please try again."
                      : linkError === "linkedin"
                        ? "LinkedIn sign-in didn't finish. Please try again."
                        : "That link has expired or was already used. Ask for a new one."}
                </p>
              )}

              {quick && (
                <>
                  <div className="mt-8 space-y-3">
                    {account?.google && (
                      <button onClick={() => social("google")} disabled={busy !== null} className={OPTION}>
                        <GoogleMark /> {busy === "google" ? "Opening Google..." : "Continue with Google"}
                        {lastUsed === "google" && <LastUsed />}
                      </button>
                    )}
                    {account?.apple && (
                      <button onClick={() => social("apple")} disabled={busy !== null} className={OPTION}>
                        <AppleMark /> {busy === "apple" ? "Opening Apple..." : "Continue with Apple"}
                        {lastUsed === "apple" && <LastUsed />}
                      </button>
                    )}
                    {account?.linkedin && (
                      <button onClick={() => social("linkedin")} disabled={busy !== null} className={OPTION}>
                        <LinkedInMark /> {busy === "linkedin" ? "Opening LinkedIn..." : "Continue with LinkedIn"}
                        {lastUsed === "linkedin" && <LastUsed />}
                      </button>
                    )}
                    {mode === "login" && passkeys && (
                      <button onClick={withPasskey} disabled={busy !== null} className={OPTION}>
                        <Fingerprint size={18} aria-hidden /> {busy === "passkey" ? "Waiting for your device..." : "Sign in with a passkey"}
                        {lastUsed === "passkey" && <LastUsed />}
                      </button>
                    )}
                  </div>
                  <div className="my-6 flex items-center gap-3 text-[0.8rem] text-faint">
                    <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
                  </div>
                </>
              )}

              <form onSubmit={submit} className={`space-y-4 ${quick ? "" : "mt-8"}`} noValidate>
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
                    <input
                      className={field}
                      type="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      // "webauthn" lets the browser offer saved passkeys right in this field when signing in.
                      autoComplete={mode === "login" ? "username webauthn" : "email"}
                      placeholder="you@example.com"
                    />
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
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
                >
                  {busy === "email"
                    ? "One moment..."
                    : { signup: "Create account", login: "Sign in", forgot: "Send reset link", reset: "Save new password" }[mode]}
                  {mode === "login" && lastUsed === "email" && <LastUsed dark />}
                </button>
                {signInScreen && (
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={busy !== null || off}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-[0.95rem] text-soft transition-colors hover:border-accent/50 hover:text-ink disabled:opacity-50"
                  >
                    <Mail size={16} aria-hidden /> {busy === "code" ? "Sending..." : mode === "signup" ? "Skip the password: email me a code" : "Email me a sign-in code instead"}
                    {mode === "login" && lastUsed === "code" && <LastUsed />}
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
                <>
                  <p className="mt-4 text-center text-[0.8rem] leading-relaxed text-faint">
                    By continuing, you agree to the <a className="underline underline-offset-4 hover:text-ink" href="/terms">Terms</a> and{" "}
                    <a className="underline underline-offset-4 hover:text-ink" href="/privacy">Privacy Policy</a>.
                  </p>
                  <p className="mt-2 text-center text-[0.8rem] leading-relaxed text-faint">
                    Your account stores your Story Vault, interview answers and drafts so you can use them on any device. <a className="underline underline-offset-4 hover:text-ink" href="/privacy">What we keep</a>
                  </p>
                </>
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
