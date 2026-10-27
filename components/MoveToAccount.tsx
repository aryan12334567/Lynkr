"use client";

import { useEffect, useState } from "react";
import { CloudUpload, X } from "lucide-react";
import type { ProfileInput, StoryFact } from "@/lib/schemas";
import { load, save } from "@/lib/store";

// --- pure helpers (start): no imports, tested in tests/mydata.test.mts ---

type FactLike = { id: string; text: string };

/** Something in this browser is worth moving: at least one fact, or a filled-in profile. */
export function hasBrowserData(s: { profile: unknown; facts: unknown[] }): boolean {
  return s.facts.length > 0 || s.profile !== null;
}

/**
 * What the move changed, from the account's facts before the move, the facts sent, and the reply.
 * "kept" are facts where the account's copy was newer (newest edit wins), so the account's version stays.
 */
export function moveSummary(before: FactLike[], sent: FactLike[], conflicts: { id: string }[]): { added: number; updated: number; kept: number } {
  const had = new Map(before.map((f) => [f.id, f.text]));
  const lost = new Set(conflicts.map((c) => c.id));
  let added = 0;
  let updated = 0;
  for (const f of sent) {
    if (lost.has(f.id)) continue;
    if (!had.has(f.id)) added++;
    else if (had.get(f.id) !== f.text) updated++;
  }
  return { added, updated, kept: lost.size };
}

export function summaryLine(m: { added: number; updated: number; kept: number }): string {
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? "" : "s"}`;
  return `${n(m.added, "fact")} added, ${m.updated} updated, ${m.kept} kept from your account.`;
}

/** The dismissal is remembered per account, so another person on this browser still gets the offer. */
export const dismissKey = (email: string) => `lynkr.moveOffer:${email.toLowerCase()}`;

// --- pure helpers (end) ---

type Me = { cloud: boolean; facts?: StoryFact[] };
type Reply = { saved: number; conflicts: { id: string; account: string; browser: string }[]; facts: StoryFact[] };

/**
 * First sign-in: offer to move this browser's Story Vault and profile into the account.
 * After a successful move the browser's facts are replaced by the account's copy, which is now
 * the one every feature reads. Shown once per account; "Not now" is remembered in this browser.
 */
export function MoveToAccount({ email }: { email: string }) {
  const [state, setState] = useState<"hidden" | "offer" | "busy" | "done">("hidden");
  const [before, setBefore] = useState<StoryFact[]>([]);
  const [result, setResult] = useState<{ line: string; conflicts: Reply["conflicts"] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(dismissKey(email)) !== null;
    } catch {}
    if (dismissed || !hasBrowserData(load())) return;
    let live = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
      .then((me) => {
        if (!live || !me?.cloud) return;
        setBefore(me.facts ?? []);
        setState("offer");
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [email]);

  function remember() {
    try {
      localStorage.setItem(dismissKey(email), new Date().toISOString());
    } catch {}
  }

  async function move() {
    setState("busy");
    setError(null);
    const s = load();
    const body: { profile: ProfileInput | null; facts: StoryFact[] } = { profile: s.profile, facts: s.facts.slice(0, 60) };
    try {
      const r = await fetch("/api/me/import-browser", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await r.json().catch(() => ({}))) as Partial<Reply> & { error?: string };
      if (!r.ok || !data.facts) {
        setError(data.error ?? "Couldn't move your data. Your browser copy is unchanged.");
        setState("offer");
        return;
      }
      // Only after the account has it: the browser now mirrors the account's vault.
      save({ ...load(), facts: data.facts });
      remember();
      setResult({ line: summaryLine(moveSummary(before, body.facts, data.conflicts ?? [])), conflicts: data.conflicts ?? [] });
      setState("done");
    } catch {
      setError("Couldn't reach Lynkr. Your browser copy is unchanged.");
      setState("offer");
    }
  }

  if (state === "hidden") return null;

  if (state === "done" && result) {
    return (
      <div role="status" className="mt-3 rounded-lg border border-good/30 bg-good/10 p-3 text-[0.82rem]">
        <p className="font-medium text-good">Moved to your account.</p>
        <p className="mt-1 text-soft">{result.line}</p>
        {result.conflicts.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-ink underline underline-offset-4">Review what was kept</summary>
            <ul className="mt-2 space-y-2">
              {result.conflicts.map((c) => (
                <li key={c.id} className="text-soft">
                  <span className="block text-ink">Kept: {c.account}</span>
                  <span className="block">This browser had: {c.browser}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-faint">Edit any fact in your Story Vault to change it.</p>
          </details>
        )}
        <button onClick={() => setState("hidden")} className="mt-2 text-[0.82rem] text-soft underline underline-offset-4 hover:text-ink">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-accent/30 bg-accent-wash p-3 text-[0.82rem]" role="region" aria-label="Move this browser's data">
      <div className="flex items-start gap-2">
        <CloudUpload size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <p className="min-w-0 flex-1 text-ink">Move this browser&apos;s Story Vault into your account, so it&apos;s there on every device.</p>
        <button
          onClick={() => {
            remember();
            setState("hidden");
          }}
          aria-label="Not now"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-soft hover:bg-surface hover:text-ink"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-bad">
          {error}
        </p>
      )}
      <button
        onClick={move}
        disabled={state === "busy"}
        className="mt-2 inline-flex min-h-9 items-center rounded-full bg-accent px-3.5 text-[0.82rem] font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
      >
        {state === "busy" ? "Moving..." : "Move to my account"}
      </button>
    </div>
  );
}
