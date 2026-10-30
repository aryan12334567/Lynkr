import { listZip, readZipEntry, parseCsv } from "../linkedinExport";

/** Kept on this device; LinkedIn's email column is deliberately discarded. */
export type Connection = { name: string; company: string; role: string; profileUrl: string; connectedOn: string };

export function parseConnections(text: string): Connection[] {
  const rows = parseCsv(text);
  const headerAt = rows.findIndex(row => row.some(x => x.trim().toLowerCase() === "first name") && row.some(x => x.trim().toLowerCase() === "last name"));
  if (headerAt < 0) throw new Error("Connections file not found in this archive.");
  const headers = rows[headerAt].map(x => x.trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name);
  const get = (row: string[], name: string) => (row[col(name)] ?? "").trim();
  return rows.slice(headerAt + 1).map(row => ({
    name: [get(row, "first name"), get(row, "last name")].filter(Boolean).join(" "),
    company: get(row, "company"), role: get(row, "position"),
    profileUrl: normalizeProfileUrl(get(row, "url")), connectedOn: get(row, "connected on"),
  })).filter(c => !!c.name);
}

export function normalizeProfileUrl(value: string): string {
  try {
    const u = new URL(value);
    const match = /^\/in\/([a-z0-9-]+)\/?$/i.exec(u.pathname);
    if (u.protocol !== "https:" || !["www.linkedin.com", "linkedin.com"].includes(u.hostname.toLowerCase()) || !match || u.username || u.password || u.port) return "";
    return `https://www.linkedin.com/in/${match[1]}/`;
  } catch { return ""; }
}

/** Only opens Connections.csv, even when the archive contains private messages. */
export async function readConnections(files: { name: string; buffer: ArrayBuffer }[]): Promise<Connection[]> {
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      const entry = listZip(file.buffer).find(e => /(^|[\\/])connections\.csv$/i.test(e.name));
      if (entry) return parseConnections(await readZipEntry(file.buffer, entry));
    } else if (/(^|[\\/])connections\.csv$/i.test(file.name)) {
      return parseConnections(new TextDecoder().decode(file.buffer));
    }
  }
  throw new Error("Connections file not found in this archive.");
}

const norm = (s: string) => s.toLowerCase().trim();
export function rankConnections(connections: Connection[], targets: { companies: string[]; roles: string[] }, now = new Date()): (Connection & { dormant: boolean; score: number })[] {
  const includes = (value: string, options: string[]) => options.some(x => norm(x).length > 1 && norm(value).includes(norm(x)));
  return connections.map(c => {
    const date = Date.parse(c.connectedOn);
    const cutoff = new Date(now); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
    return { ...c, dormant: Number.isFinite(date) && date < cutoff.getTime(), score: (includes(c.company, targets.companies) ? 10 : 0) + (includes(c.role, targets.roles) ? 2 : 0) };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** The only fields copied out of the device-local address book when the user adds someone. */
export function contactFields(c: Connection) { return { name: c.name, company: c.company, role: c.role, profileUrl: c.profileUrl }; }

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
