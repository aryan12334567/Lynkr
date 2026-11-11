import type { CommentAngle, CommentOption, CommentOptionsModel, FactRef } from "../schemas";

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, ""));
const sentence = (s: string) => s.trim().replace(/[.\s]+$/, "");

/** The post's first usable line, 5 to 15 words, copied exactly: what a demo can honestly answer. */
export function firstAnchor(post: string): string {
  for (const line of post.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const w = line.split(/\s+/);
    if (w.length >= 5) return w.slice(0, Math.min(w.length, 12)).join(" ").replace(/[,;:]$/, "");
  }
  return "";
}

/**
 * Demo options. Honest about what they are: each quotes a line of the post and uses the person's own words or one
 * fact. Nothing is interpreted, so nothing is invented. Deterministic, so tests can assert on it.
 */
export function mockCommentOptions(post: string, reaction: string, facts: FactRef[]): CommentOptionsModel {
  const anchor = firstAnchor(post);
  const own = sentence(reaction);
  const fact = facts[0];
  if (!anchor || (!own && !fact)) return { status: "skip", skipWhy: "There's no point of your own to add yet.", options: [] };
  if (!norm(post).includes(norm(anchor))) return { status: "skip", skipWhy: "Couldn't find a line to answer.", options: [] };
  const pad = "In demo mode this is a template that quotes the line and uses your own words, so read it and change it before you post.";
  const options: CommentOption[] = [];
  const add = (angle: CommentAngle, lead: string, refs: string[]) =>
    options.push({ angle, body: `${lead} ${pad}`.replace(/\s+/g, " ").trim(), postAnchor: anchor, factRefs: refs, why: `Answers "${clip(anchor, 60)}" with your own words.` });
  if (fact) add("experience", `On "${clip(anchor, 90)}": ${sentence(clip(fact.text, 140))}.`, [fact.id]);
  if (own) add("add", `On "${clip(anchor, 90)}": ${clip(own, 140)}.`, []);
  return { status: "options", skipWhy: "", options };
}
