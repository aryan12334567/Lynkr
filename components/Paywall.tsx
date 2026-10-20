"use client";

import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { LegalLinks, Wordmark } from "./chrome";
import { Button, Card, ErrorNote, inputCls, Label } from "./ui";
import { SITE } from "@/lib/site";
import { saveLicense, type License } from "@/lib/store";

const INCLUDED = [
  "The interview and your Story Vault, kept in your browser",
  "Profile fix: headline, About and the gaps a recruiter would notice",
  "First messages and follow-ups that fit how well you know the person",
  "Message checker that marks the exact words to change",
  "Connect Coach, comment helper, post drafts and a weekly plan with reminders",
];

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

const errorOf = (data: Record<string, unknown>, fallback: string) => (typeof data.error === "string" ? data.error : fallback);

/**
 * Shown instead of the app until there is an active subscription. Pay first, then use: the person
 * subscribes on Dodo's checkout, Dodo emails a license key, and the key is entered here.
 */
export function Paywall({
  checkout,
  stored,
  notice,
  onUnlocked,
  onRecheck,
  onForget,
  onBack,
}: {
  checkout: boolean;
  /** A key saved in this browser that the server could not confirm. */
  stored: License | null;
  notice: string | null;
  onUnlocked: (l: License) => void;
  onRecheck: () => Promise<boolean>;
  onForget: () => void;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState<"subscribe" | "unlock" | "recheck" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState("");
  // This screen only renders in the browser, so the address is available here.
  const [returned] = useState(() => new URLSearchParams(window.location.search).get("subscribed") === "1");

  async function subscribe() {
    setBusy("subscribe");
    setError(null);
    try {
      const { ok, data } = await post("/api/checkout", {});
      if (ok && typeof data.url === "string") {
        window.location.assign(data.url);
        return;
      }
      setError(errorOf(data, "Couldn't open checkout. Please try again."));
    } catch {
      setError("Couldn't open checkout. Check your connection and try again.");
    }
    setBusy(null);
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    const k = key.trim();
    if (!k) {
      setError("Enter your license key.");
      return;
    }
    setBusy("unlock");
    setError(null);
    try {
      const { ok, data } = await post("/api/license", { action: "activate", key: k });
      if (ok && typeof data.instanceId === "string") {
        const license = { key: k, instanceId: data.instanceId };
        saveLicense(license);
        onUnlocked(license);
        return;
      }
      setError(errorOf(data, "That key didn't work. Please try again."));
    } catch {
      setError("Couldn't reach the license service. Check your connection and try again.");
    }
    setBusy(null);
  }

  async function recheck() {
    setBusy("recheck");
    setError(null);
    const ok = await onRecheck().catch(() => false);
    if (!ok) setError("We still can't confirm an active subscription for this key.");
    setBusy(null);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-6 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} aria-label="Lynkr home page" className="rounded-md">
          <Wordmark />
        </button>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden /> Back to home
        </Button>
      </header>

      <main className="space-y-6">
        {returned && (
          <p role="status" className="rounded-md border border-good/40 bg-good/10 px-3 py-2 text-[0.95rem] text-good">
            If your payment went through, Dodo has emailed your license key. Paste it below to unlock Lynkr.
          </p>
        )}
        {notice && <p className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-[0.95rem] text-warn">{notice}</p>}

        <Card>
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.2em] text-marigold">Lynkr subscription</p>
          <h1 className="mt-2 text-[2rem] font-extrabold leading-tight sm:text-[2.4rem]">
            {SITE.price} <span className="text-[1.1rem] font-medium text-soft">per {SITE.period}, plus applicable taxes</span>
          </h1>
          <p className="mt-2 max-w-[58ch] text-soft">
            You subscribe first, then use Lynkr. Access starts when you enter the license key Dodo Payments emails you. Cancel any time, and the first payment can be refunded within {SITE.refundDays} days.
          </p>
          <ul className="mt-5 space-y-2">
            {INCLUDED.map((t) => (
              <li key={t} className="flex gap-2.5 text-[0.95rem]">
                <Check size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={subscribe} disabled={busy !== null || !checkout}>
              {busy === "subscribe" ? "Opening checkout..." : `Subscribe for ${SITE.price} a ${SITE.period}`}
            </Button>
            {!checkout && <span className="text-[0.9rem] text-warn">Checkout isn&apos;t available right now. Please try again later.</span>}
          </div>
          <p className="mt-3 text-[0.85rem] text-faint">
            Payments are processed by Dodo Payments, our Merchant of Record. Lynkr never sees your card details. Lynkr drafts text only: no LinkedIn login, nothing posted or sent for you, and no promise of replies or jobs.
          </p>
        </Card>

        <Card>
          <h2 className="text-lg font-bold">Already subscribed?</h2>
          {stored ? (
            <div className="mt-2 space-y-3">
              <p className="text-[0.95rem] text-soft">We couldn&apos;t confirm your subscription just now. If it&apos;s active, check again. If it ended, subscribe above, or use a different key.</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={recheck} disabled={busy !== null}>
                  {busy === "recheck" ? "Checking..." : "Check again"}
                </Button>
                <Button variant="ghost" onClick={onForget} disabled={busy !== null}>
                  Use a different key
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={unlock} className="mt-2 space-y-3">
              <label className="block">
                <Label>License key</Label>
                <input className={inputCls} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} placeholder="Paste the key from your Dodo email" />
              </label>
              <Button type="submit" variant="ghost" disabled={busy !== null}>
                {busy === "unlock" ? "Unlocking..." : "Unlock Lynkr"}
              </Button>
            </form>
          )}
          <div className="mt-3">
            <ErrorNote message={error} />
          </div>
          <p className="mt-3 text-[0.85rem] text-faint">A key works in a limited number of browsers. It stops working if the subscription is cancelled or a payment fails.</p>
        </Card>
      </main>

      <footer className="mt-12 border-t border-line pt-6">
        <LegalLinks />
      </footer>
    </div>
  );
}
