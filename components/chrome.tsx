"use client";

import { useState } from "react";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`text-[1.5rem] font-semibold leading-none tracking-[-0.04em] text-ink ${className}`}>
      Lynkr<span className="text-accent">.</span>
    </span>
  );
}

/**
 * "Start over" deletes everything in this browser, so it asks first, in place:
 * no pop-up dialog, and nothing happens on a single accidental click.
 */
export function ConfirmReset({ onReset, className = "", label = "Start over" }: { onReset: () => void; className?: string; label?: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button onClick={() => setAsking(true)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-[0.9rem] text-soft hover:bg-muted hover:text-ink ${className}`}>
        {label}
      </button>
    );
  }
  return (
    <div className={`rounded-xl border border-bad/30 bg-bad/5 p-3 text-[0.9rem] ${className}`} role="group" aria-label="Confirm delete">
      <p className="font-medium text-bad">Delete your answers, facts, drafts and tracker from this browser?</p>
      <p className="mt-0.5 text-soft">This can&apos;t be undone.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={onReset} className="inline-flex min-h-9 items-center rounded-md bg-bad px-3 font-medium text-bg">
          Yes, delete everything
        </button>
        <button onClick={() => setAsking(false)} className="inline-flex min-h-9 items-center rounded-md border border-line bg-surface px-3">
          Keep my work
        </button>
      </div>
    </div>
  );
}

/** Docs-style reassurance: everything is kept in this browser as you go. */
export function SavedHint() {
  return (
    <span className="hidden items-center gap-1.5 text-[0.82rem] text-faint sm:inline-flex">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.34 9.1 4 4 0 0 0 7 19h10.5Z" />
        <path d="m9.5 14 2 2 3.5-3.5" />
      </svg>
      Saved in this browser
    </span>
  );
}

/** Links every public page must carry: Dodo and customers look for these in the footer. */
export function LegalLinks({ className = "" }: { className?: string }) {
  const link = "text-soft underline-offset-4 transition-colors hover:text-ink hover:underline";
  return (
    <nav aria-label="Legal" className={`flex flex-wrap gap-x-5 gap-y-1 text-[0.88rem] ${className}`}>
      <a className={link} href="/terms">Terms of Service</a>
      <a className={link} href="/privacy">Privacy Policy</a>
      <a className={link} href="/refunds">Refunds and cancellation</a>
      <a className={link} href="/contact">Contact</a>
    </nav>
  );
}

export function DemoPill() {
  return (
    <span className="inline-block rounded-full border border-warn/40 bg-warn/10 px-3 py-1 text-[0.82rem] text-warn">
      Demo mode: no AI key, drafts are templates
    </span>
  );
}

export function TrustNote({ mock }: { mock: boolean | null }) {
  return (
    <p className="text-[0.85rem] leading-relaxed text-faint">
      <strong className="font-medium text-soft">No LinkedIn login, no scraping, nothing posted or sent for you.</strong>{" "}
      {mock
        ? "Demo mode: your answers go only to Lynkr's server to fill templates. No AI sees them and nothing is stored."
        : "Your answers and anything you paste go through Lynkr's server to the AI provider only to write drafts. Lynkr doesn't store them."}{" "}
      Your Story Vault, drafts, plan and tracker stay in this browser. Imported profile files and pasted posts are never saved.
    </p>
  );
}
