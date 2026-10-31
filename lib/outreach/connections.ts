import { listZip, readZipEntry, parseConnectionsCsv, normalizeProfileUrl, isConnectionsFile, CONNECTIONS_NOT_FOUND, type Connection } from "../linkedinExport";

export type { Connection };
export { normalizeProfileUrl };

/** Parsed entirely in the browser. LinkedIn's email column is dropped during parsing. */
export const parseConnections = parseConnectionsCsv;

/** Only opens Connections.csv, even when the archive contains private messages. */
export async function readConnections(files: { name: string; buffer: ArrayBuffer }[]): Promise<Connection[]> {
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      const entry = listZip(file.buffer).find(e => isConnectionsFile(e.name));
      if (entry) return parseConnections(await readZipEntry(file.buffer, entry));
    } else if (isConnectionsFile(file.name)) {
      return parseConnections(new TextDecoder().decode(file.buffer));
    }
  }
  throw new Error(CONNECTIONS_NOT_FOUND);
}

/** Reads, then saves. If the file is missing or unreadable nothing is saved and the stored list is untouched. */
export async function importConnectionsFiles(
  files: { name: string; buffer: ArrayBuffer }[],
  io: { save: (c: Connection[]) => Promise<void> } = { save: saveConnections },
): Promise<{ ok: true; connections: Connection[] } | { ok: false; message: string }> {
  let connections: Connection[];
  try { connections = await readConnections(files); }
  catch (e) { return { ok: false, message: e instanceof Error ? e.message.replace(/\.$/, "") : "Couldn't read that file" }; }
  await io.save(connections);
  return { ok: true, connections };
}

const norm = (s: string) => s.toLowerCase().trim();
/** Company match counts 10, role match 2, so any company match outranks a role-only match. */
export function rankConnections(connections: Connection[], targets: { companies: string[]; roles: string[] }, now = new Date()): (Connection & { dormant: boolean; score: number })[] {
  const includes = (value: string, options: string[]) => options.some(x => norm(x).length > 1 && norm(value).includes(norm(x)));
  const cutoff = new Date(now); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
  return connections.map(c => {
    const date = Date.parse(c.connectedOn);
    return { ...c, dormant: Number.isFinite(date) && date < cutoff.getTime(), score: (includes(c.company, targets.companies) ? 10 : 0) + (includes(c.role, targets.roles) ? 2 : 0) };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** The only fields copied out of the device-local address book when the user adds someone. */
export function contactFields(c: Connection) { return { name: c.name, company: c.company, role: c.role, profileUrl: c.profileUrl }; }

export type AddDefaults = { goal: string; intent: string; bridge: string; tier: "tier_1" | "tier_2" };

/** Creates a contact from one connection. The request carries name, company, role and link, plus the contact's own settings. */
export async function addConnectionAsContact<T = { id: string }>(c: Connection, defaults: AddDefaults, fetchImpl: typeof fetch = fetch): Promise<T> {
  const res = await fetchImpl("/api/outreach/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...contactFields(c), profileUrl: c.profileUrl || null, ...defaults, source: "connections" }),
  });
  const data = await res.json().catch(() => ({})) as { contact?: T; error?: string };
  if (!res.ok || !data.contact) throw new Error(data.error || "Couldn't add this person. Try again.");
  return data.contact;
}

const DB = "lynkr-connections";
const STORE = "connections";
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = action(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
export async function saveConnections(connections: Connection[]): Promise<void> { await transaction("readwrite", s => s.put(connections, "list")); }
export async function loadConnections(): Promise<Connection[]> { return (await transaction<Connection[] | undefined>("readonly", s => s.get("list"))) ?? []; }
export async function clearConnections(): Promise<void> { await transaction("readwrite", s => s.delete("list")); }
