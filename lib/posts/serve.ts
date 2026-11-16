import { confirmedFacts, type Db } from "../db";
import { factsFor } from "../facts";
import { textProblems, type Problem } from "./checks";
import { addVersion, getPost, getVersion, listAnswers, listVersions, type Post, type PostVersion } from "./db";
import { refineBody, type RefineDeps } from "./edit";
import { phraseFollowUp, THIN, type PhraseDeps, type Question } from "./interview";
import { writePosts, type WriteDeps } from "./write";
import type { AnswerIn, Evidence } from "./types";

/**
 * The server side of one post's drafting (posts plan U4, U5): load what the person said, run the writer or the refiner,
 * and store the result as versions. Every read and write is the person's own (db.ts filters on the user id). Model
 * failures are thrown to the route, which returns the day's try (see app/api/first-win/route.ts).
 */

/** What this post may rest on: confirmed facts that may go in a public post, this post's answers, and its brief. */
export async function evidenceFor(db: Db, userId: string, post: Post): Promise<Evidence> {
  const [facts, answers] = await Promise.all([confirmedFacts(db, userId), listAnswers(db, userId, post.id)]);
  const ins: AnswerIn[] = answers.map((a) => ({ id: `A${a.turn}`, key: a.key, question: a.question, text: a.answer }));
  return { facts: factsFor("post", facts), answers: ins, brief: post.brief };
}

export type GenerateOutcome =
  | { kind: "not_found" }
  | { kind: "versions"; versions: PostVersion[]; dropped: number; note: string | null }
  | { kind: "need_more"; message: string; /** The one targeted question, or null when it has been asked and answered. */ question: Question | null; stop: boolean };

/** Writes new versions of the post (each stored, the first one current is the last stored). Never returns an unchecked text. */
export async function generateForPost(db: Db, userId: string, postId: string, deps?: WriteDeps, phrase?: PhraseDeps): Promise<GenerateOutcome> {
  const post = await getPost(db, userId, postId);
  if (!post) return { kind: "not_found" };
  const ev = await evidenceFor(db, userId, post);
  const out = await writePosts({ type: post.type, brief: post.brief, answers: ev.answers, facts: ev.facts }, deps);
  if (out.kind === "need_more") {
    const askedMore = ev.answers.some((a) => a.key === THIN.key);
    const question: Question | null = askedMore
      ? null
      : { ...THIN, text: await phraseFollowUp({ type: post.type, brief: post.brief, last: ev.answers.at(-1)?.text ?? "" }, phrase, THIN.text) };
    return {
      kind: "need_more",
      message: "I couldn't write this from what you told me without inventing something. Answer one more question and I'll try again.",
      question,
      stop: question === null,
    };
  }
  const prior = await listVersions(db, userId, postId);
  const batch = Math.max(0, ...prior.map((v) => v.batch)) + 1;
  const stored: PostVersion[] = [];
  for (const v of out.versions) {
    const row = await addVersion(db, userId, postId, { body: v.body, why: v.why, factRefs: v.factRefs, answerRefs: v.answerRefs, source: "write", batch });
    if (row) stored.push(row);
  }
  return { kind: "versions", versions: stored, dropped: out.dropped, note: out.note };
}

export type RefineOutcome =
  | { kind: "not_found" }
  | { kind: "locked" }
  | { kind: "refined"; version: PostVersion }
  | { kind: "rejected"; message: string; problems: Problem[] }
  | { kind: "invalid"; message: string; problems: Problem[] };

/** Refines `versionId` (default: the current version) by `instruction`, and stores the result as a new version. */
export async function refineForPost(db: Db, userId: string, postId: string, opts: { versionId?: string; instruction: string }, deps?: RefineDeps): Promise<RefineOutcome> {
  const post = await getPost(db, userId, postId);
  if (!post) return { kind: "not_found" };
  if (!["draft", "approved"].includes(post.status)) return { kind: "locked" };
  const from = opts.versionId ?? post.currentVersionId;
  const base = from ? await getVersion(db, userId, postId, from) : null;
  if (!base) return { kind: "invalid", message: "Pick a version to change first.", problems: [] };
  const r = await refineBody({ body: base.body, instruction: opts.instruction, type: post.type, evidence: await evidenceFor(db, userId, post) }, deps);
  if (r.kind === "refined") {
    const row = await addVersion(db, userId, postId, { body: r.body, why: r.why, factRefs: base.factRefs, answerRefs: base.answerRefs, source: "refine", instruction: opts.instruction.trim(), parentId: base.id, batch: base.batch });
    return row ? { kind: "refined", version: row } : { kind: "not_found" };
  }
  return r.kind === "rejected" ? { kind: "rejected", message: r.message, problems: r.problems } : { kind: "invalid", message: r.message, problems: [] };
}

export type SaveOutcome = { kind: "not_found" } | { kind: "locked" } | { kind: "saved"; version: PostVersion; problems: Problem[] };

/** A hand edit becomes a new version. The rules check is advice for the person, so it never blocks the save. */
export async function saveText(db: Db, userId: string, postId: string, body: string): Promise<SaveOutcome> {
  const post = await getPost(db, userId, postId);
  if (!post) return { kind: "not_found" };
  // A scheduled post is posted as approved: its text changes only after the schedule is cancelled.
  if (!["draft", "approved"].includes(post.status)) return { kind: "locked" };
  const prior = post.currentVersionId ? await getVersion(db, userId, postId, post.currentVersionId) : null;
  const row = await addVersion(db, userId, postId, { body: body.trim(), why: "", factRefs: prior?.factRefs ?? [], answerRefs: prior?.answerRefs ?? [], source: "manual", parentId: prior?.id });
  if (!row) return { kind: "not_found" };
  return { kind: "saved", version: row, problems: textProblems(row.body, await evidenceFor(db, userId, post), { length: null }) };
}

/** The rules check for a text on a post, for the editor to show. Null when the post is not theirs. */
export async function problemsFor(db: Db, userId: string, postId: string, body: string): Promise<Problem[] | null> {
  const post = await getPost(db, userId, postId);
  return post ? textProblems(body, await evidenceFor(db, userId, post), { length: null }) : null;
}
