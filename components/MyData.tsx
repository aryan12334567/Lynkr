"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown, Download, Trash2 } from "lucide-react";
import { clear } from "@/lib/store";

type Settings = { consentAt: string | null; saveAnswers: boolean };

/**
 * "My data" in the account menu: what's stored and why, the "save my answers" switch,
 * Download my data (JSON) and Delete my data (two steps, in place, no browser dialog).
 * Cloud actions stay hidden until the account storage is available.
 */
export function MyData() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cloud, setCloud] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"save" | "export" | "delete" | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useId();

  useEffect(() => {
    if (!open || cloud !== null) return;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ cloud: boolean; settings?: Settings }>) : { cloud: false, settings: undefined }))
      .then((me) => {
        setCloud(me.cloud);
        if (me.cloud && me.settings) setSettings(me.settings);
      })
      .catch(() => setCloud(false));
  }, [open, cloud]);

  // A 409 means the account storage isn't switched on: fall back to the browser and hide cloud actions.
  function failed(status: number, message: string) {
    if (status === 409) setCloud(false);
    else setError(message);
  }

  async function toggleSave() {
    if (!settings) return;
    setBusy("save");
    setError(null);
    const next = !settings.saveAnswers;
    try {
      const r = await fetch("/api/me/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saveAnswers: next }) });
      if (r.ok) setSettings(((await r.json()) as { settings: Settings }).settings);
      else failed(r.status, "Couldn't change this setting. Please try again.");
    } catch {
      setError("Couldn't reach Lynkr. Please try again.");
    }
    setBusy(null);
  }

  async function download() {
    setBusy("export");
    setError(null);
    try {
      const r = await fetch("/api/me/export", { cache: "no-store" });
      if (!r.ok) failed(r.status, "Couldn't prepare your download. Please try again.");
      else {
        const url = URL.createObjectURL(await r.blob());
        const a = document.createElement("a");
        a.href = url;
        a.download = "lynkr-data.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      setError("Couldn't reach Lynkr. Please try again.");
    }
    setBusy(null);
  }

  async function remove() {
    setBusy("delete");
    setError(null);
    try {
      const r = await fetch("/api/me/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "delete" }) });
      if (r.ok) {
        clear();
        window.location.reload();
        return;
      }
      failed(r.status, "Couldn't delete your data. Nothing was removed. Please try again.");
    } catch {
      setError("Couldn't reach Lynkr. Nothing was removed.");
    }
    setAsking(false);
    setBusy(null);
  }

  const item = "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[0.85rem] text-soft hover:bg-muted hover:text-ink disabled:opacity-50";
  return (
    <div className="mt-2 border-t border-line pt-2">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={panel} className={`${item} w-full justify-between`}>
        My data
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div id={panel} className="mt-1 space-y-2.5 px-2 pb-1 text-[0.8rem]">
          <p className="leading-relaxed text-soft">
            Your account keeps your context brief, Story Vault facts{settings?.saveAnswers === false ? "" : ", interview answers"} and saved drafts, so every
            feature and device uses the same facts. It&apos;s stored on Neon in AWS US East, kept until you delete it, and deleted automatically after 12
            months without use. Your LinkedIn PDF is never stored.{" "}
            <a href="/privacy" className="text-ink underline underline-offset-4">
              Privacy
            </a>
          </p>

          {cloud === null && <p className="text-faint">Checking your account...</p>}
          {cloud === false && <p className="text-faint">Saving to your account isn&apos;t available yet. Your work is kept in this browser.</p>}

          {cloud && settings && (
            <>
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={settings.saveAnswers} onChange={toggleSave} disabled={busy !== null} />
                <span className="text-ink">Save my interview answers so I can resume</span>
              </label>
              <div className="flex flex-wrap gap-1">
                <button onClick={download} disabled={busy !== null} className={item}>
                  <Download size={14} aria-hidden /> {busy === "export" ? "Preparing..." : "Download my data"}
                </button>
                {!asking && (
                  <button onClick={() => setAsking(true)} disabled={busy !== null} className={`${item} hover:text-bad`}>
                    <Trash2 size={14} aria-hidden /> Delete my data
                  </button>
                )}
              </div>
              {asking && (
                <div role="group" aria-label="Confirm delete" className="rounded-lg border border-bad/30 bg-bad/5 p-2.5">
                  <p className="font-medium text-bad">Delete your brief, Story Vault, answers, drafts and plan from your account and this browser?</p>
                  <p className="mt-0.5 text-soft">This can&apos;t be undone. You can still sign in.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={remove} disabled={busy !== null} className="inline-flex min-h-9 items-center rounded-md bg-bad px-3 font-medium text-white disabled:opacity-50">
                      {busy === "delete" ? "Deleting..." : "Yes, delete everything"}
                    </button>
                    <button onClick={() => setAsking(false)} disabled={busy !== null} className="inline-flex min-h-9 items-center rounded-md border border-line bg-surface px-3">
                      Keep my data
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="text-bad">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
