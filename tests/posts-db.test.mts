// Posts storage (posts plan U1): user scoping on every read and write, versions that only grow, and export / delete
// that cover the posts tables. Runs over PGlite with the real migrations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { deleteAll, exportAll, pgliteDb, type Db } from "../lib/db";
import { addAnswer, addVersion, createPost, deletePost, getPost, listAnswers, listPosts, listVersions, setCurrentVersion, updatePost } from "../lib/posts/db";

const sql = (name: string) => readFileSync(new URL(`../scripts/migrations/${name}`, import.meta.url), "utf8");

async function world(run: (db: Db, pg: PGlite) => Promise<void>) {
  const pg = new PGlite();
  try {
    await pg.exec(`create table "user" (id text primary key, "dodoCustomerId" text); insert into "user" values ('A','a'),('B','b');`);
    for (const f of ["001_vertical1.sql", "002_outreach.sql", "003_posts.sql", "008_posts_publish.sql"]) await pg.exec(sql(f));
    await run(pgliteDb(pg) as Db, pg);
  } finally { await pg.close(); }
}
const V = { body: "Body one.", why: "Because.", factRefs: ["F1"], answerRefs: ["A1"], source: "write" as const, batch: 1 };

test("the migration runs twice without error", async () => {
  await world(async (_db, pg) => { await pg.exec(sql("003_posts.sql")); await pg.exec(sql("008_posts_publish.sql")); await pg.exec(sql("003_posts.sql")); await pg.exec(sql("008_posts_publish.sql")); });
});

test("create, read, update and delete a post for its owner", async () => {
  await world(async (db) => {
    const p = await createPost(db, "A", { type: "proof", brief: "Fest survey cleanup", mode: "quick" });
    assert.equal(p.status, "draft");
    assert.equal((await getPost(db, "A", p.id))?.brief, "Fest survey cleanup");
    const u = await updatePost(db, "A", p.id, { brief: "New brief", type: "setback" });
    assert.equal(u?.brief, "New brief");
    assert.equal(u?.type, "setback");
    assert.equal((await listPosts(db, "A")).length, 1);
    assert.equal(await deletePost(db, "A", p.id), true);
    assert.equal(await getPost(db, "A", p.id), null);
  });
});

test("user B cannot read, change, answer, version or delete user A's post", async () => {
  await world(async (db) => {
    const p = await createPost(db, "A", { type: "proof", brief: "Mine", mode: "quick" });
    await addAnswer(db, "A", p.id, { key: "did", question: "q", answer: "secret answer" });
    const v = await addVersion(db, "A", p.id, V);
    assert.ok(v);
    assert.equal(await getPost(db, "B", p.id), null);
    assert.deepEqual(await listPosts(db, "B"), []);
    assert.equal(await updatePost(db, "B", p.id, { brief: "hacked" }), null);
    assert.equal(await addAnswer(db, "B", p.id, { key: "x", question: "q", answer: "a" }), null);
    assert.equal(await addVersion(db, "B", p.id, V), null);
    assert.deepEqual(await listAnswers(db, "B", p.id), []);
    assert.deepEqual(await listVersions(db, "B", p.id), []);
    assert.equal(await setCurrentVersion(db, "B", p.id, v!.id), null);
    assert.equal(await deletePost(db, "B", p.id), false);
    const mine = await getPost(db, "A", p.id);
    assert.equal(mine?.brief, "Mine");
    assert.equal((await listAnswers(db, "A", p.id)).length, 1);
    assert.equal((await listVersions(db, "A", p.id)).length, 1);
  });
});

test("a slot is created once: asking twice returns the same post", async () => {
  await world(async (db) => {
    const a = await createPost(db, "A", { type: "proof", brief: "one", mode: "quick", weekStart: "2026-11-16", slotIndex: 0 });
    const b = await createPost(db, "A", { type: "setback", brief: "two", mode: "quick", weekStart: "2026-11-16", slotIndex: 0 });
    assert.equal(a.id, b.id);
    assert.equal(b.brief, "one");
    assert.equal((await listPosts(db, "A", { weekStart: "2026-11-16" })).length, 1);
  });
});

test("answers number themselves per post and versions only grow; going back keeps every version", async () => {
  await world(async (db) => {
    const p = await createPost(db, "A", { type: "proof", brief: "b", mode: "quick" });
    const a1 = await addAnswer(db, "A", p.id, { key: "did", question: "q1", answer: "first" });
    const a2 = await addAnswer(db, "A", p.id, { key: "result", question: "q2", answer: "second" });
    assert.deepEqual([a1?.turn, a2?.turn], [1, 2]);
    const v1 = await addVersion(db, "A", p.id, V);
    const v2 = await addVersion(db, "A", p.id, { ...V, body: "Body two.", source: "refine", parentId: v1!.id, instruction: "shorter" });
    const v3 = await addVersion(db, "A", p.id, { ...V, body: "Body three.", source: "manual" });
    assert.deepEqual([v1!.n, v2!.n, v3!.n], [1, 2, 3]);
    assert.equal((await getPost(db, "A", p.id))?.currentVersionId, v3!.id);
    const back = await setCurrentVersion(db, "A", p.id, v1!.id);
    assert.equal(back?.currentVersionId, v1!.id);
    assert.equal((await listVersions(db, "A", p.id)).length, 3);
    assert.equal((await listVersions(db, "A", p.id))[1].instruction, "shorter");
  });
});

test("export and delete cover the posts tables, for this user only", async () => {
  await world(async (db) => {
    for (const u of ["A", "B"]) {
      const p = await createPost(db, u, { type: "proof", brief: `post of ${u}`, mode: "quick" });
      await addAnswer(db, u, p.id, { key: "did", question: "q", answer: "a" });
      await addVersion(db, u, p.id, V);
    }
    const out = (await exportAll(db, "A")) as Record<string, Array<Record<string, unknown>>>;
    assert.equal(out.posts.length, 1);
    assert.equal(out.posts[0].brief, "post of A");
    assert.equal(out.post_answers.length, 1);
    assert.equal(out.post_versions.length, 1);
    const counts = await deleteAll(db, "A");
    assert.equal(counts.posts, 1);
    assert.equal(counts.post_answers, 1);
    assert.equal(counts.post_versions, 1);
    assert.deepEqual(await listPosts(db, "A"), []);
    const bPosts = await listPosts(db, "B");
    assert.equal(bPosts.length, 1);
    assert.equal((await listVersions(db, "B", bPosts[0].id)).length, 1);
  });
});
