import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { parseConnections, rankConnections, readConnections, contactFields, addConnectionAsContact, importConnectionsFiles } from "../lib/outreach/connections";
import { readExport } from "../lib/linkedinExport";

const fixture = readFileSync(new URL("./fixtures/connections.csv", import.meta.url), "utf8");
const buf = (text: string) => { const b = Buffer.from(text, "utf8"); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };

function zip(files: Record<string, string>): ArrayBuffer {
  const parts: Buffer[] = []; const central: Buffer[] = []; let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = deflateRawSync(Buffer.from(text, "utf8")); const n = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(Buffer.byteLength(text), 22); local.writeUInt16LE(n.length, 26);
    parts.push(local, n, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(8, 10); c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(Buffer.byteLength(text), 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, n); offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  const all = Buffer.concat([...parts, cd, end]);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) as ArrayBuffer;
}

const NOW = new Date("2026-10-29T00:00:00Z");

test("notes lines above the header are skipped and column order does not matter", () => {
  const rows = parseConnections(fixture);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], { name: "Asha Rao", company: "Acme Analytics", role: "Data Analyst", profileUrl: "https://www.linkedin.com/in/asha-rao/", connectedOn: "01 Jan 2020" });
  assert.equal(rows[3].role, "Head of Data, Growth");
  assert.equal(rows[1].profileUrl, "https://www.linkedin.com/in/bala-sen/");
});

test("email values never appear in the parsed result or anything saved from it", async () => {
  const rows = parseConnections(fixture);
  assert.doesNotMatch(JSON.stringify(rows), /fixture-mail|@/);
  let saved = "";
  const res = await importConnectionsFiles([{ name: "Connections.csv", buffer: buf(fixture) }], { save: async (c) => { saved = JSON.stringify(c); } });
  assert.equal(res.ok, true);
  assert.doesNotMatch(saved, /fixture-mail|@/);
});

test("a company match ranks above a non-match, then a role match ranks higher among them", () => {
  const ranked = rankConnections(parseConnections(fixture), { companies: ["Acme Analytics"], roles: ["Data Analyst"] }, NOW);
  assert.deepEqual(ranked.map(r => r.name), ["Asha Rao", "Chitra Iyer", "Bala Sen", "Dev Nair"]);
  const roleOnly = rankConnections(parseConnections(fixture), { companies: ["Acme Analytics"], roles: ["Designer"] }, NOW);
  assert.equal(roleOnly[2].name, "Bala Sen", "a role match alone stays below every company match");
  assert.equal(roleOnly[0].name, "Asha Rao");
});

test("dormant means connected more than two years before now", () => {
  const ranked = rankConnections(parseConnections(fixture), { companies: [], roles: [] }, NOW);
  const dormant = Object.fromEntries(ranked.map(r => [r.name, r.dormant]));
  assert.deepEqual(dormant, { "Asha Rao": true, "Bala Sen": false, "Chitra Iyer": false, "Dev Nair": true });
});

test("Add sends only name, company, role and link, with the source", async () => {
  const [asha] = parseConnections(fixture);
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify({ contact: { id: "c1" } }), { status: 201 }); }) as unknown as typeof fetch;
  const out = await addConnectionAsContact(asha, { goal: "job", intent: "learn_role", bridge: "none", tier: "tier_2" }, fakeFetch);
  assert.deepEqual(out, { id: "c1" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/outreach/contacts");
  assert.equal(calls[0].init.method, "POST");
  const body = JSON.parse(calls[0].init.body as string);
  assert.deepEqual(body, { name: "Asha Rao", company: "Acme Analytics", role: "Data Analyst", profileUrl: "https://www.linkedin.com/in/asha-rao/", goal: "job", intent: "learn_role", bridge: "none", tier: "tier_2", source: "connections" });
  assert.doesNotMatch(calls[0].init.body as string, /fixture-mail|connectedOn|2020/);
  assert.deepEqual(Object.keys(contactFields(asha)), ["name", "company", "role", "profileUrl"]);
});

test("Add reports the server's message when the request is refused", async () => {
  const [asha] = parseConnections(fixture);
  const fakeFetch = (async () => new Response(JSON.stringify({ error: "You've reached your monthly contact limit." }), { status: 429 })) as unknown as typeof fetch;
  await assert.rejects(addConnectionAsContact(asha, { goal: "job", intent: "learn_role", bridge: "none", tier: "tier_2" }, fakeFetch), /monthly contact limit/);
});

test("an archive without Connections.csv says so and saves nothing", async () => {
  const archive = zip({ "Profile.csv": "First Name,Last Name,Headline\nA,B,Analyst\n", "messages.csv": "FROM,TO\nx,y\n" });
  await assert.rejects(readConnections([{ name: "export.zip", buffer: archive }]), /Connections file not found in this archive/);
  let saves = 0;
  const res = await importConnectionsFiles([{ name: "export.zip", buffer: archive }], { save: async () => { saves++; } });
  assert.deepEqual(res, { ok: false, message: "Connections file not found in this archive" });
  assert.equal(saves, 0);
});

test("a zip with Connections.csv is read, and its email column is dropped", async () => {
  const archive = zip({ "Profile.csv": "Headline\nx\n", "Connections.csv": fixture });
  const rows = await readConnections([{ name: "export.zip", buffer: archive }]);
  assert.equal(rows.length, 4);
  assert.doesNotMatch(JSON.stringify(rows), /fixture-mail/);
});

test("readExport opens Connections.csv only when 'Use my connections' is ticked", async () => {
  const archive = zip({ "Skills.csv": "Name\nSQL\n", "Connections.csv": fixture });
  const off = await readExport([{ name: "export.zip", buffer: archive }]);
  assert.equal(off.connections, undefined);
  assert.ok(off.skipped.includes("Connections.csv"));
  assert.doesNotMatch(JSON.stringify(off), /Asha|fixture-mail/);
  const on = await readExport([{ name: "export.zip", buffer: archive }], { useConnections: true });
  assert.ok(Array.isArray(on.connections) && on.connections.length === 4);
  assert.ok(!on.skipped.includes("Connections.csv"));
  assert.deepEqual(on.profile.skills, ["SQL"]);
  assert.doesNotMatch(JSON.stringify(on), /fixture-mail/);
  const missing = await readExport([{ name: "export.zip", buffer: zip({ "Skills.csv": "Name\nSQL\n" }) }], { useConnections: true });
  assert.equal(missing.connections, false);
});
