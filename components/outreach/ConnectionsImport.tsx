"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Button, Card, ErrorNote, Pill, SectionHead } from "@/components/ui";
import type { Contact } from "@/lib/outreach/contacts-db";
import {
  addConnectionAsContact, clearConnections, importConnectionsFiles, loadConnections, rankConnections, saveConnections,
  type AddDefaults, type Connection,
} from "@/lib/outreach/connections";

const PAGE = 20;

/**
 * The user's own LinkedIn connections, warmest first. The file is read and kept on this device only.
 * Nothing is sent anywhere until the user taps Add on one person.
 */
export function ConnectionsImport({ targets, defaults, onAdded }: {
  targets: { companies: string[]; roles: string[] };
  defaults: AddDefaults;
  onAdded?: (contact: Contact) => void;
}) {
  const inputId = useId();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadConnections().then(setConnections).catch(() => {}); }, []);

  const ranked = useMemo(() => rankConnections(connections, targets), [connections, targets]);
  const keyOf = (c: Connection, i: number) => c.profileUrl || `${c.name}-${i}`;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null); setNotice(null); setBusy("import");
    try {
      const result = await importConnectionsFiles([{ name: file.name, buffer: await file.arrayBuffer() }], { save: saveConnections });
      if (!result.ok) { setError(result.message); return; }
      setConnections(result.connections); setShown(PAGE); setAdded(new Set());
      setNotice(`${result.connections.length} connections saved on this device only.`);
    } catch {
      setError("Couldn't save connections on this device. Check that your browser allows site storage.");
    } finally { setBusy(null); }
  }

  async function remove() {
    setError(null); setNotice(null);
    try { await clearConnections(); setConnections([]); setAdded(new Set()); setNotice("Removed from this device."); }
    catch { setError("Couldn't remove connections from this device. Try again."); }
  }

  async function add(c: Connection, key: string) {
    setError(null); setNotice(null); setBusy(key);
    try {
      const contact = await addConnectionAsContact<Contact>(c, defaults);
      setAdded(s => new Set(s).add(key));
      setNotice(`${c.name} added.`);
      onAdded?.(contact);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <Card>
      <SectionHead title="Your connections">
        Choose Connections.csv, or the ZIP LinkedIn sent you. It is read here and kept on this device only. Lynkr gets a person only when you tap Add. Email addresses are dropped.
      </SectionHead>
      <label htmlFor={inputId} className="mb-1.5 block text-[0.95rem] font-medium text-ink">Connections file</label>
      <input id={inputId} type="file" accept=".zip,.csv" onChange={onFile} disabled={busy === "import"}
        className="block w-full max-w-full text-[0.95rem] file:mr-3 file:min-h-10 file:rounded-md file:border file:border-line file:bg-surface file:px-4 file:text-ink" />
      <div className="mt-3 space-y-2" aria-live="polite">
        {notice && <p role="status" className="text-[0.95rem] text-soft">{notice}</p>}
        <ErrorNote message={error} />
      </div>

      {connections.length === 0 ? (
        <p className="mt-3 text-[0.95rem] text-soft">No connections on this device yet.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.95rem] text-soft">People at your target companies come first, then people in your target roles.</p>
            <Button variant="danger" onClick={remove}>Remove from this device</Button>
          </div>
          <ul className="mt-3 divide-y divide-line" aria-label="Your connections, best match first">
            {ranked.slice(0, shown).map((c, i) => {
              const key = keyOf(c, i);
              const done = added.has(key);
              return (
                <li key={key} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="break-words font-medium">{c.name}</p>
                    <p className="break-words text-[0.9rem] text-soft">{[c.role, c.company].filter(Boolean).join(" at ") || "No role listed"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {c.dormant && <Pill>Connected over 2 years ago</Pill>}
                      {c.profileUrl && <a href={c.profileUrl} target="_blank" rel="noopener noreferrer" className="text-[0.9rem] text-accent underline">Open profile<span className="sr-only"> for {c.name}</span></a>}
                    </div>
                  </div>
                  <Button variant="ghost" disabled={done || busy !== null} aria-label={done ? `${c.name} added` : `Add ${c.name}`} onClick={() => add(c, key)}>
                    {done ? "Added" : busy === key ? "Adding" : "Add"}
                  </Button>
                </li>
              );
            })}
          </ul>
          {shown < ranked.length && <Button className="mt-3" variant="quiet" onClick={() => setShown(n => n + PAGE)}>Show more ({ranked.length - shown} left)</Button>}
        </>
      )}
    </Card>
  );
}
