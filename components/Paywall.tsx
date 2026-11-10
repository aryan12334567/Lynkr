"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Lock } from "lucide-react";
import { LegalLinks, Wordmark } from "./chrome";
import { MyData } from "./MyData";
import { ErrorNote } from "./ui";
import { SITE } from "@/lib/site";
import { authClient, startCheckout, type Account } from "@/lib/auth-client";

const INCLUDED = ["Messages and posts drafted from your own facts", "A message checker and a weekly plan", "Your Story Vault, saved to your account"];

const PRIMARY =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 text-[1rem] font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-50";

/**
 * Shown instead of the app until there is an active subscription. Pay first, then use.
 * Account first: create an account (or sign in), subscribe through a checkout tied to that account,
 * and on return wait here while Dodo confirms the payment. License keys from earlier purchases are
 * still honoured in the background (see LynkrApp), but there's no key form here.
 */
export function Paywall({
  checkout,
  account,
  notice,
  onRecheck,
  onBack,
}: {
  checkout: boolean;
  /** The signed-in account, if accounts are on. */
  account: Account | null;
  notice: string | null;
  onRecheck: () => Promise<boolean>;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // This screen only renders in the browser, so the address is available here.
  const [returned] = useState(() => new URLSearchParams(window.location.search).get("subscribed") === "1");
  const signedIn = account?.accounts === true && account.signedIn === true;
  const canSubscribe = checkout && account?.accounts === true;
  // Back from checkout: ask every few seconds (for up to a minute) until Dodo confirms it.
  const [confirming, setConfirming] = useState(returned && signedIn);

  useEffect(() => {
    if (!confirming) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const ok = await onRecheck().catch(() => false);
      if (ok || tries >= 20) {
        clearInterval(t);
        setConfirming(false);
      }
    }, 3000);
    return () => clearInterval(t);
    // onRecheck changes identity each render; the interval should only start once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirming]);

  async function subscribe() {
    setBusy(true);
    setError(null);
    const msg = await startCheckout().catch(() => "Couldn't open checkout. Please try again.");
    if (msg) setError(msg);
    setBusy(false);
  }

  return (
    <div className="flex min-h-dvh w-full flex-col px-4 py-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <button onClick={onBack} aria-label="Lynkr home page" className="rounded-md">
          <Wordmark />
        </button>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[0.92rem] text-soft transition-colors hover:text-ink">
          <ArrowLeft size={15} aria-hidden /> Home
        </button>
      </header>

      <main className="mx-auto my-auto w-full max-w-[26rem] py-12">
        {confirming && (
          <p role="status" className="mb-6 flex items-center gap-2 rounded-xl bg-accent-wash px-4 py-3 text-[0.92rem] text-accent-strong">
            <Loader2 size={16} className="shrink-0 animate-spin" aria-hidden /> Confirming your payment. This usually takes a few seconds.
          </p>
        )}
        {returned && !confirming && signedIn && (
          <p role="status" className="mb-6 rounded-xl bg-warn/10 px-4 py-3 text-[0.92rem] text-warn">
            We couldn&apos;t confirm a payment yet. If you paid, wait a minute and reload this page.
          </p>
        )}
        {notice && !confirming && <p className="mb-6 rounded-xl bg-warn/10 px-4 py-3 text-[0.92rem] text-warn">{notice}</p>}

        <div className="rounded-3xl border border-line bg-surface p-7 shadow-lg sm:p-9">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-wash text-accent">
            <Lock size={19} aria-hidden />
          </span>
          <h1 className="mt-5 text-[1.75rem] leading-tight tracking-[-0.03em]">Unlock Lynkr</h1>
          <p className="mt-4 flex items-baseline gap-1.5">
            <span className="text-[2.75rem] font-semibold leading-none tracking-[-0.04em]">{SITE.price}</span>
            <span className="text-soft">/ {SITE.period}</span>
          </p>
          <p className="mt-1.5 text-[0.9rem] text-faint">Taxes included. Cancel any time.</p>

          <ul className="mt-6 space-y-2.5 border-t border-line pt-6">
            {INCLUDED.map((t) => (
              <li key={t} className="flex gap-2.5 text-[0.95rem] text-soft">
                <Check size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7">
            {signedIn ? (
              <button onClick={subscribe} disabled={busy || !canSubscribe || confirming} className={PRIMARY}>
                {busy ? (
                  <>
                    <Loader2 size={17} className="animate-spin" aria-hidden /> Opening checkout
                  </>
                ) : (
                  "Subscribe"
                )}
              </button>
            ) : (
              <a href="/signup" className={PRIMARY}>
                Create your account
              </a>
            )}
            <div className="mt-3">
              <ErrorNote message={error} />
            </div>
            {signedIn && !canSubscribe && <p className="mt-3 text-center text-[0.88rem] text-warn">Checkout isn&apos;t available right now. Please try again later.</p>}
            <p className="mt-4 text-center text-[0.88rem] text-soft">
              {signedIn ? (
                <>
                  {account?.email} ·{" "}
                  <button
                    className="underline underline-offset-4 hover:text-ink"
                    onClick={async () => {
                      await authClient.signOut().catch(() => {});
                      window.location.assign("/");
                    }}
                  >
                    Switch account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <a href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
                    Sign in
                  </a>
                </>
              )}
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[0.82rem] text-faint">
          Secure checkout by Dodo Payments. First payment refundable within {SITE.refundDays} days.
        </p>
        {/* Free users can reach their data too: download and delete must not sit behind the paywall. */}
        {signedIn && (
          <div className="mt-8">
            <MyData />
          </div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-5xl border-t border-line pt-6">
        <LegalLinks />
      </footer>
    </div>
  );
}
