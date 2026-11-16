"use client";

import Link from "next/link";

/** The same card the Calendar shows when something needs the subscription (same words, same data-paywall-card hook). */
export function PostsPaywall({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role="region" aria-label="Subscription needed" className="rounded-2xl border border-line bg-surface p-4 text-sm" data-paywall-card>
      <p className="font-medium">Drafting posts is part of the subscription.</p>
      <p className="mt-1 text-soft">The Calendar, your week, progress and reminders are free. Drafting posts, comments and outreach messages is ₹499 a month.</p>
      <div className="mt-3 flex items-center gap-3">
        <Link className="inline-flex min-h-11 items-center font-medium text-accent underline" href="/#pricing">See what&apos;s included</Link>
        <button className="min-h-11 px-2 text-soft hover:underline" onClick={onDismiss}>Not now</button>
      </div>
    </div>
  );
}
