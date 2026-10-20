"use client";

import { useState } from "react";
import { CreditCard, LogOut, UserRound } from "lucide-react";
import { authClient, openPortal, type Account } from "@/lib/auth-client";

/** The signed-in account in the app sidebar: who you are, billing, sign out. Hidden without an account. */
export function AccountMenu({ account, className = "" }: { account: Account | null; className?: string }) {
  const [busy, setBusy] = useState<"billing" | "out" | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!account?.signedIn) return null;

  async function billing() {
    setBusy("billing");
    setError(null);
    const msg = await openPortal().catch(() => "Couldn't open billing. Please try again.");
    if (msg) setError(msg);
    setBusy(null);
  }

  async function signOut() {
    setBusy("out");
    await authClient.signOut().catch(() => {});
    window.location.assign("/");
  }

  return (
    <div className={`rounded-xl border border-line bg-surface p-3 ${className}`}>
      <p className="flex items-center gap-2 text-[0.85rem]">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
          <UserRound size={14} aria-hidden />
        </span>
        <span className="min-w-0 truncate" title={account.email ?? ""}>
          {account.email}
        </span>
      </p>
      <p className={`mt-2 text-[0.78rem] ${account.subscribed ? "text-good" : "text-faint"}`}>{account.subscribed ? "Subscription active" : "No active subscription"}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {account.subscribed && (
          <button onClick={billing} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[0.85rem] text-soft hover:bg-muted hover:text-ink disabled:opacity-50">
            <CreditCard size={14} aria-hidden /> {busy === "billing" ? "Opening..." : "Billing"}
          </button>
        )}
        <button onClick={signOut} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[0.85rem] text-soft hover:bg-muted hover:text-ink disabled:opacity-50">
          <LogOut size={14} aria-hidden /> {busy === "out" ? "Signing out..." : "Sign out"}
        </button>
      </div>
      {error && <p className="mt-1 text-[0.8rem] text-bad">{error}</p>}
    </div>
  );
}
