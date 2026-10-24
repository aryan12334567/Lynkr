"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard, Fingerprint, LogOut, UserRound } from "lucide-react";
import { authClient, openPortal, passkeysSupported, type Account } from "@/lib/auth-client";

/** The signed-in account in the app sidebar: who you are, billing, passkey, sign out. Hidden without an account. */
export function AccountMenu({ account, className = "" }: { account: Account | null; className?: string }) {
  const [busy, setBusy] = useState<"billing" | "out" | "passkey" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null until known; true once this account has at least one passkey (or one was just added).
  const [hasPasskey, setHasPasskey] = useState<boolean | null>(null);
  // The app renders only in the browser (see ClientApp), so this can be read once up front.
  const [canPasskey] = useState(passkeysSupported);
  const signedIn = account?.signedIn === true;

  useEffect(() => {
    if (!signedIn || !canPasskey) return;
    authClient.passkey
      .listUserPasskeys()
      .then((r) => setHasPasskey((r.data?.length ?? 0) > 0))
      .catch(() => setHasPasskey(false));
  }, [signedIn, canPasskey]);

  if (!signedIn) return null;

  async function billing() {
    setBusy("billing");
    setError(null);
    const msg = await openPortal().catch(() => "Couldn't open billing. Please try again.");
    if (msg) setError(msg);
    setBusy(null);
  }

  async function addPasskey() {
    setBusy("passkey");
    setError(null);
    const r = await authClient.passkey.addPasskey({ name: "Lynkr" }).catch(() => null);
    // A cancelled device prompt is not an error worth showing.
    if (r && !r.error) setHasPasskey(true);
    else if (r?.error && !("code" in r.error && r.error.code === "AUTH_CANCELLED")) setError("Couldn't add a passkey on this device.");
    setBusy(null);
  }

  async function signOut() {
    setBusy("out");
    await authClient.signOut().catch(() => {});
    window.location.assign("/");
  }

  const item = "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[0.85rem] text-soft hover:bg-muted hover:text-ink disabled:opacity-50";
  return (
    <div className={`rounded-xl border border-line bg-surface p-3 ${className}`}>
      <p className="flex items-center gap-2 text-[0.85rem]">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
          <UserRound size={14} aria-hidden />
        </span>
        <span className="min-w-0 truncate" title={account?.email ?? ""}>
          {account?.email}
        </span>
      </p>
      <p className={`mt-2 text-[0.78rem] ${account?.subscribed ? "text-good" : "text-faint"}`}>{account?.subscribed ? "Subscription active" : "No active subscription"}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {account?.subscribed && (
          <button onClick={billing} disabled={busy !== null} className={item}>
            <CreditCard size={14} aria-hidden /> {busy === "billing" ? "Opening..." : "Billing"}
          </button>
        )}
        {canPasskey && hasPasskey === false && (
          <button onClick={addPasskey} disabled={busy !== null} className={item} title="Sign in with your fingerprint, face or device PIN next time">
            <Fingerprint size={14} aria-hidden /> {busy === "passkey" ? "Waiting for your device..." : "Add a passkey"}
          </button>
        )}
        {hasPasskey === true && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-[0.85rem] text-good">
            <Check size={14} aria-hidden /> Passkey on
          </span>
        )}
        <button onClick={signOut} disabled={busy !== null} className={item}>
          <LogOut size={14} aria-hidden /> {busy === "out" ? "Signing out..." : "Sign out"}
        </button>
      </div>
      {error && <p className="mt-1 text-[0.8rem] text-bad">{error}</p>}
    </div>
  );
}
