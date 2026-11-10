// Interview, Story Vault review, profile audit, LinkedIn export reader, comment checks and save migration
// (prod/ plans: posts & comments, profile fix, message checker).
import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { mockComment, mockInterview, mockVault, SKIPPED } from "../lib/mock";
import { ProfileInput, type Turn } from "../lib/schemas";
import { matchRole, suggestDomain, suggestTopics } from "../lib/roles";
import { listZip, parseCsv, readExport } from "../lib/linkedinExport";
import { validComment } from "../lib/comment";
import { migrate } from "../lib/store";

const profile = ProfileInput.parse({ goal: "job", targetRole: "Data analyst", background: "Final-year B.Com, Pune", stage: "final_year", audiences: ["hiring"] });

function run(answers: string[]): Turn[] {
  const turns: Turn[] = [];
  for (const a of answers) {
    const r = mockInterview(profile, turns);
    if (r.done) break;
    turns.push({ q: r.question, a });
  }
  return turns;
}

test("interview: evidence first, at most two follow-ups, optional questions say so", () => {
  const turns = run(["We built a sponsor dashboard for the fest.", "I wrote the SQL.", "Choosing which sponsors to chase first.", "Not sure, it felt better.", "The fest team used the report.", "Clean data first.", SKIPPED, SKIPPED, "Analytics firms in Pune."]);
  assert.match(turns[0].q, /what did you personally do/);
  assert.equal(turns[1].q, "Which part did you handle yourself?", "asks for own part when only 'we' was said");
  assert.match(turns[3].q, /What changed because of your work/);
  assert.equal(turns[4].q, "What changed, or what artifact could someone inspect?");
  assert.ok(turns.some((t) => /^Optional:/.test(t.q)));
  assert.equal(mockInterview(profile, turns).done, true);
  const followUps = turns.filter((t) => t.q === "Which part did you handle yourself?" || t.q.startsWith("What changed, or")).length;
  assert.ok(followUps <= 2);
  // "Not measured" is accepted without a follow-up.
  const t2 = run(["I built a dashboard myself.", "Picking metrics.", "Not measured.", "x"]);
  assert.ok(!t2.some((t) => t.q.startsWith("What changed, or")));
});

test("vault: candidate facts keep the person's words and point to their answers", () => {
  const turns = run(["I built a Power BI dashboard for 40 sponsors.", "Picking metrics.", "It saved 6 hours a week.", "Row counts first.", SKIPPED, SKIPPED, "Fintech teams in Pune."]);
  const v = mockVault(profile, turns);
  const project = v.facts.find((f) => f.kind === "project")!;
  assert.equal(project.text, "I built a Power BI dashboard for 40 sponsors.");
  assert.deepEqual(project.sourceTurnIds, [1]);
  assert.ok(v.facts.every((f) => f.sourceTurnIds.every((n) => turns[n - 1] && turns[n - 1].a !== SKIPPED)), "no fact from a skipped answer");
  assert.ok(v.facts.some((f) => f.kind === "target"));
  assert.ok(v.facts.some((f) => f.kind === "constraint" && f.sourceTurnIds.length === 0), "background line is labelled as from setup");
});

test("roles: domain is suggested from the role text only; topics come from the user's facts", () => {
  assert.equal(suggestDomain("Data analyst"), "data_ai");
  assert.equal(suggestDomain("Credit research analyst"), "finance");
  assert.equal(suggestDomain("Platform engineer, AI infrastructure"), "software");
  assert.equal(suggestDomain("Something unusual"), "not_sure");
  assert.equal(matchRole("career coach"), null, "no accidental substring match");
  assert.deepEqual(suggestTopics("Data analyst", ["I used SQL and Power BI for the fest."]), ["SQL", "Power BI"]);
});

/** A minimal ZIP writer for the test: deflate entries plus a central directory. */
function zip(files: Record<string, string>): ArrayBuffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = deflateRawSync(Buffer.from(text, "utf8"));
    const n = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(Buffer.byteLength(text), 22);
    local.writeUInt16LE(n.length, 26);
    parts.push(local, n, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(Buffer.byteLength(text), 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  const all = Buffer.concat([...parts, cd, end]);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) as ArrayBuffer;
}

test("export: only allowlisted profile files are opened; personal columns are dropped", async () => {
  const buf = zip({
    "Profile.csv": 'First Name,Last Name,Birth Date,Address,Headline,Summary,Industry,Geo Location\nAsha,K,1 Jan 2003,"12 MG Road, Pune","Data analyst | SQL","I built a ""sponsor"" dashboard.\nIt tracked 40 sponsors.",Analytics,Pune\n',
    "Skills.csv": "Name\nSQL\nPower BI\n",
    "Positions.csv": "Company Name,Title,Description,Location,Started On,Finished On\nAcme,Intern,Built weekly reports,Pune,Jun 2025,Aug 2025\n",
    "messages.csv": "FROM,TO,CONTENT\nx,y,private\n",
    "Connections.csv": "Notes:\nFirst Name,Last Name,Email Address\nRavi,S,ravi@example.com\n",
  });
  assert.equal(listZip(buf).length, 5);
  const r = await readExport([{ name: "Basic_LinkedInDataExport.zip", buffer: buf }]);
  assert.equal(r.profile.headline, "Data analyst | SQL");
  assert.equal(r.profile.summary, 'I built a "sponsor" dashboard.\nIt tracked 40 sponsors.');
  assert.equal(r.profile.location, "Pune");
  assert.deepEqual(r.profile.skills, ["SQL", "Power BI"]);
  assert.equal(r.profile.positions[0].company, "Acme");
  assert.deepEqual(r.skipped.sort(), ["Connections.csv", "messages.csv"]);
  const flat = JSON.stringify(r.profile);
  assert.doesNotMatch(flat, /MG Road|2003|ravi@example|private/);
  assert.deepEqual(parseCsv('a,"b,c"\n1,2'), [["a", "b,c"], ["1", "2"]]);
});

test("comments: anchor must be in the excerpt, refs submitted, 30–70 words, no blanks; demo is honest", () => {
  const excerpt = "Most dashboards fail because nobody agrees on the metric definitions before building.";
  const ok = { status: "draft" as const, body: "word ".repeat(40).trim(), postAnchor: "nobody agrees on the metric definitions", factRefs: ["F1"], whyItFits: "" };
  const ids = new Set(["F1"]);
  assert.equal(validComment(ok, excerpt, ids), null);
  assert.equal(validComment({ ...ok, postAnchor: "something they never said" }, excerpt, ids), "anchor");
  assert.equal(validComment({ ...ok, factRefs: ["F9"] }, excerpt, ids), "refs");
  assert.equal(validComment({ ...ok, body: "too short" }, excerpt, ids), "length");
  assert.equal(validComment({ ...ok, body: `${"word ".repeat(40)}[[blank]]` }, excerpt, ids), "blanks");
  assert.equal(mockComment(excerpt, "nobody agrees", "", []).status, "skip", "nothing of your own to add: skip");
  assert.equal(mockComment(excerpt, "a line not in the post", "My view", []).status, "skip");
  const d = mockComment(excerpt, "nobody agrees on the metric definitions", "On our fest dashboard we fixed the sponsor count definition first.", []);
  assert.equal(d.status, "draft");
  assert.match(d.whyItFits, /Demo template/);
});

test("store: an older save keeps answers, drafts and people", () => {
  const old = {
    stage: "results",
    profile: { goal: "job", targetRole: "Data analyst", background: "B.Com", currentProfile: "" },
    turns: [{ q: "q", a: "a" }],
    result: { vault: [{ kind: "proof", text: "I built a dashboard." }], profile: { headlines: [], about: "", gaps: [] }, outreach: {}, posts: [], comments: [] },
    fills: { "post:0": ["x"] },
    plan: null,
    connect: { monthlyNotes: 3, weeklyCap: 5, people: [{ id: "p", label: "x", relationship: "stranger", withNote: true, status: "to_find", addedAt: "2026-10-01T00:00:00Z" }] },
  };
  const s = migrate(old as never);
  assert.equal(s.facts.length, 1);
  assert.equal(s.facts[0].kind, "project");
  assert.equal(s.facts[0].reviewStatus, "confirmed");
  assert.equal(s.profile!.domain, "not_sure");
  assert.deepEqual(s.fills["post:0"], ["x"]);
  assert.equal(s.connect.people[0].status, "considered");
  assert.deepEqual(s.edits, {});
});
