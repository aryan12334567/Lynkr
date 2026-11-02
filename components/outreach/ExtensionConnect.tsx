"use client";

import { useEffect, useId, useState } from "react";
import { api } from "@/lib/outreach/ui-api";
import { Button, Card, ErrorNote, Label, SectionHead, inputCls } from "../ui";

type Token = { id: string; expiresAt: string; revokedAt: string | null; lastUsedAt: string | null };
const ID_KEY = "lynkr-ext-id";
const PUBLIC_ID = process.env.NEXT_PUBLIC_LYNKR_EXT_ID?.trim() ?? "";
type ChromeRuntime = { runtime?: { sendMessage?: (id: string, message: unknown, cb: (r?: { success?: boolean }) => void) => void; lastError?: unknown } };

function sendToExtension(id: string, token: string): Promise<boolean> {
  const chromeApi = (globalThis as unknown as { chrome?: ChromeRuntime }).chrome;
  if (!chromeApi?.runtime?.sendMessage) return Promise.resolve(false);
  return new Promise((resolve) => {
    try { chromeApi.runtime!.sendMessage!(id, { type: "PAIR_TOKEN", token }, (r) => resolve(Boolean(r?.success) && !chromeApi.runtime!.lastError)); }
    catch { resolve(false); }
  });
}

/** Pair the Lynkr Chrome extension with this account, and turn its access off again. The extension reads only text you select; it sends nothing. */
export function ExtensionConnect() {
  const id = useId();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [extId, setExtId] = useState(() => { try { return PUBLIC_ID || localStorage.getItem(ID_KEY) || ""; } catch { return PUBLIC_ID; } });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ tokens: Token[] }>("GET", "/api/ext/revoke").then((x) => setTokens(x.tokens.filter((t) => !t.revokedAt))).catch(() => {});
  }, []);

  async function connect() {
    setBusy(true); setError(null); setMessage("");
    try {
      const made = await api<{ token: string; id: string; expiresAt: string }>("POST", "/api/ext/pair", {});
      const list = await api<{ tokens: Token[] }>("GET", "/api/ext/revoke");
      setTokens(list.tokens.filter((t) => !t.revokedAt));
      if (await sendToExtension(extId.trim(), made.token)) {
        try { if (!PUBLIC_ID) localStorage.setItem(ID_KEY, extId.trim()); } catch {}
        setMessage("Connected. Open the Lynkr side panel in Chrome to see your people.");
      } else {
        await api("POST", "/api/ext/revoke", { id: made.id }).catch(() => {});
        setTokens((t) => t.filter((x) => x.id !== made.id));
        setError("Couldn't reach the extension. Check that it's installed in Chrome, that this ID matches the one on chrome://extensions, and that you're using Chrome.");
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function revoke(t: Token) {
    setError(null); setMessage("");
    try { await api("POST", "/api/ext/revoke", { id: t.id }); setTokens((x) => x.filter((y) => y.id !== t.id)); setMessage("Access turned off. The extension is signed out the next time it asks Lynkr for anything."); }
    catch (e) { setError((e as Error).message); }
  }

  return (
    <Card>
      <SectionHead title="Chrome extension">
        Put a ready message into the box you click on LinkedIn. The extension reads only text you select and the address of the tab when you ask. It never sends anything.
      </SectionHead>
      {!PUBLIC_ID && (
        <label htmlFor={`${id}-ext`} className="mb-3 block max-w-md">
          <Label hint="(on chrome://extensions)">Extension ID</Label>
          <input id={`${id}-ext`} className={inputCls} value={extId} onChange={(e) => setExtId(e.target.value)} autoComplete="off" spellCheck={false} />
        </label>
      )}
      <Button variant="ghost" disabled={busy || (!PUBLIC_ID && !extId.trim())} onClick={connect}>{busy ? "Connecting" : tokens.length ? "Connect again" : "Connect the extension"}</Button>
      <div className="mt-3 space-y-2" aria-live="polite">
        {message && <p role="status" className="text-[0.95rem] text-soft">{message}</p>}
        <ErrorNote message={error} />
      </div>
      {tokens.length > 0 && (
        <ul className="mt-3 divide-y divide-line" aria-label="Connected extensions">
          {tokens.map((t) => {
            const date = new Date(t.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
            return (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-[0.92rem] text-soft">Access until {date}</span>
                <Button variant="danger" onClick={() => revoke(t)}>Turn off<span className="sr-only"> access that ends {date}</span></Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
