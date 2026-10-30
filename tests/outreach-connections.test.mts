import { test } from "node:test";
import assert from "node:assert/strict";
import { parseConnections, rankConnections, readConnections, contactFields } from "../lib/outreach/connections";
const csv = `Notes:\nThis is your export\n\nEmail Address,Position,First Name,Company,Last Name,URL,Connected On\nprivate@example.com,Engineer,Asha,Acme,Rao,https://www.linkedin.com/in/asha/?trk=foo,01 Jan 2020\nother@example.com,Designer,Bala,Other,Sen,https://www.linkedin.com/in/bala/,01 Jan 2026`;
test("parse reorders headers, skips preamble, discards email, and cleans links", () => {
  const rows = parseConnections(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].profileUrl, "https://www.linkedin.com/in/asha/");
  assert.doesNotMatch(JSON.stringify(rows), /@example\.com/);
  assert.deepEqual(contactFields(rows[0]), { name: "Asha Rao", company: "Acme", role: "Engineer", profileUrl: "https://www.linkedin.com/in/asha/" });
});
test("ranking prioritizes company, then role, and marks older ties", () => {
  const rows = rankConnections(parseConnections(csv), { companies: ["Acme"], roles: ["Engineer"] }, new Date("2026-10-29T00:00:00Z"));
  assert.equal(rows[0].name, "Asha Rao"); assert.equal(rows[0].dormant, true); assert.equal(rows[1].dormant, false);
});
test("archive without Connections.csv is rejected", async () => {
  await assert.rejects(readConnections([{ name: "Profile.csv", buffer: new ArrayBuffer(0) }]), /Connections file not found/);
});
