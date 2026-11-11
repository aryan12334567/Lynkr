"use client";

import { useEffect, useId, useState } from "react";
import { Check, KeyRound } from "lucide-react";

/**
 * Link a Dodo license key to the signed-in account (B6b). For someone who paid before accounts existed, or paid with a
 * key only: the account then counts as paid while Dodo confirms the key. The key is sent once, kept encrypted on the
 * server, and never shown again.
 */
export function LinkLicense() {
  const inputId = useId();
  const [linked, setLinked] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account/license", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { linked?: boolean } | null) => setLinked(d?.linked === true))
      .catch(() => setLinked(false));
  }, []);

  async function send(method: "POST" | "DELETE") {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/account/license", { method, headers: { "content-type": "application/json" }, ...(method === "POST" ? { body: JSON.stringify({ key: key.trim() }) } : {}) });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) { setError(d.error || "Couldn't do that. Please try again."); return; }
      setKey("");
      setOpen(false);
      // The account's paid status comes from the server, so reload to pick it up everywhere.
      window.location.reload();
    } catch {
      setError("Couldn't reach Lynkr. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (linked === null) return null;
  const item = "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[0.85rem] text-soft hover:bg-muted hover:text-ink disabled:opacity-50";
  if (linked) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span role="status" className="inline-flex items-center gap-1.5 px-2 py-1.5 text-[0.85rem] text-good"><Check size={14} aria-hidden /> License key linked</span>
        <button type="button" onClick={() => send("DELETE")} disabled={busy} className={item}>{busy ? "Unlinking..." : "Unlink"}</button>
        {error && <p className="w-full text-[0.8rem] text-bad">{error}</p>}
      </div>
    );
  }
  return (
    <div className="mt-1">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={item}><KeyRound size={14} aria-hidden /> Link my license key</button>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (key.trim()) void send("POST"); }} className="space-y-1.5">
          <label htmlFor={inputId} className="block text-[0.8rem] text-soft">License key from your purchase email</label>
          <input id={inputId} type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} maxLength={200}
            className="block w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[0.9rem]" />
          <div className="flex flex-wrap gap-1">
            <button type="submit" disabled={busy || !key.trim()} className={item}>{busy ? "Checking..." : "Link key"}</button>
            <button type="button" onClick={() => { setOpen(false); setKey(""); setError(null); }} disabled={busy} className={item}>Cancel</button>
          </div>
          {error && <p role="alert" className="text-[0.8rem] text-bad">{error}</p>}
        </form>
      )}
    </div>
  );
}
