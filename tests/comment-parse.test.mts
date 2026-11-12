import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSelection } from "../lib/comment/parse";

const BODY = "We cut our report time from three days to one by cleaning the survey data first.\nMost teams skip that step and regret it.";
const header = (name: string, headline: string, time = "2d • Edited") => [name, headline, time].join("\n");

test("a normal post: name, headline, time marker, then the body", () => {
  const r = parseSelection(`${header("Priya Shah", "Data Lead at Swiggy")}\n${BODY}`);
  assert.deepEqual(r.author, { name: "Priya Shah", headline: "Data Lead at Swiggy" });
  assert.equal(r.post, BODY);
  assert.equal(r.kind, "post");
  assert.equal(r.problem, null);
});

test("the degree badge, Verified and Follow are chrome, never part of the name or the headline", () => {
  const r = parseSelection(`Priya Shah • 1st\nVerified\nData Lead at Swiggy\n3w •\nFollow\n${BODY}`);
  assert.deepEqual(r.author, { name: "Priya Shah", headline: "Data Lead at Swiggy" });
  assert.equal(r.post, BODY);
});

test("a repost: 'X reposted this' never becomes the author; the original author does", () => {
  const r = parseSelection(`Rahul Mehta reposted this\n${header("Priya Shah", "Data Lead at Swiggy", "5h •")}\n${BODY}`);
  assert.equal(r.kind, "repost");
  assert.equal(r.author?.name, "Priya Shah");
  assert.equal(r.post, BODY);
});

test("a company page: the headline is the follower count and the kind says company", () => {
  const r = parseSelection(`${header("Swiggy", "1,204,331 followers", "1w •")}\n${BODY}`);
  assert.equal(r.kind, "company");
  assert.equal(r.author?.name, "Swiggy");
});

test("a promoted post: Promoted is chrome, the author still comes through", () => {
  const r = parseSelection(`Promoted\n${header("Zoho", "Software company", "Promoted •")}\n${BODY}`);
  assert.equal(r.kind, "promoted");
  assert.equal(r.author?.name, "Zoho");
});

test("a selection without a header gives no author and keeps the whole text as the post", () => {
  const r = parseSelection(BODY);
  assert.equal(r.author, null);
  assert.equal(r.post, BODY);
  assert.equal(r.problem, null);
});

test("a time marker or '• 1st' never becomes the headline", () => {
  const r = parseSelection(`Priya Shah\n2d • Edited\n${BODY}\nMore lines here to keep it long enough.`);
  assert.equal(r.author, null);
});

test("a body line that looks like a name does not become an author when no time marker follows", () => {
  const r = parseSelection(`Short Title\nA second line of the post that is long enough to matter here.\n${BODY}`);
  assert.equal(r.author, null);
});

test("R4: under 20 characters is refused as short", () => {
  assert.equal(parseSelection("x".repeat(19)).problem, "short");
  assert.equal(parseSelection("x".repeat(20)).problem, null);
});

test("R4: over the post limit is refused as long", () => {
  assert.equal(parseSelection("word ".repeat(800)).problem, "long");
  assert.equal(parseSelection(`${header("Priya Shah", "Data Lead")}\n${"a ".repeat(1600)}`).problem, "long");
});

test("R4: a trailing see more asks to expand the post", () => {
  assert.equal(parseSelection(`${BODY}\n…see more`).problem, "see_more");
  assert.equal(parseSelection(`${BODY} ...more`).problem, "see_more");
});

test("CRLF line breaks parse like LF", () => {
  const r = parseSelection(`${header("Priya Shah", "Data Lead at Swiggy")}\n${BODY}`.replace(/\n/g, "\r\n"));
  assert.equal(r.author?.name, "Priya Shah");
});

test("the author is capped at the stored lengths", () => {
  const r = parseSelection(`${header("Priya Shah", "H".repeat(400))}\n${BODY}`);
  assert.equal(r.author?.headline.length, 220);
});
