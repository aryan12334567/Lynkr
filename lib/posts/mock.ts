import type { PostType } from "./db";
import { POST_MAX_WORDS, POST_MIN_WORDS } from "./checks";
import type { Evidence, PostRefineModel, PostVersionsModel } from "./types";

/**
 * Demo output (posts plan U4, KD2). Honest about what it is: each version is the person's own answers and one of their
 * facts in a different order, joined by plain lines that say nothing about the person. Nothing is interpreted, so
 * nothing is invented, and the result must pass the same guard as a real one. With thin answers it is too short to pass,
 * and the writer then asks for more instead of padding.
 */

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** Lines with no claim in them: no names, numbers, credentials or outcomes. */
const LINES = [
  "I wanted to write this down while it is fresh.",
  "Here is how it went, in order.",
  "I will keep it simple.",
  "That is the part I want to be clear about.",
  "It is a small thing, but it matters to me.",
  "That is all I have to say about it for now.",
];

/** One of the person's own sentences made safe for the checks: no dashes, hashtags, brackets or emoji, and a full stop at the end. */
function clean(s: string): string {
  const t = s
    .replace(/[—–]/g, ", ")
    .replace(/#/g, "")
    .replace(/[[\]{}]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return /[.!?]$/.test(t) ? t : t ? `${t}.` : "";
}

type Piece = { text: string; fact?: string; answer?: string };

function assemble(pieces: Piece[], spare: string[]): PostVersionsModel["versions"][number] | null {
  const used = pieces.filter((p) => p.text);
  const total = () => used.reduce((n, p) => n + words(p.text), 0);
  for (const l of spare) if (total() < POST_MIN_WORDS) used.splice(used.length - 1, 0, { text: l });
  while (total() > POST_MAX_WORDS && used.length > 2) used.splice(used.length - 2, 1);
  const body = used.map((p) => p.text).join(" ");
  const factRefs = [...new Set(used.flatMap((p) => (p.fact ? [p.fact] : [])))];
  const answerRefs = [...new Set(used.flatMap((p) => (p.answer ? [p.answer] : [])))];
  return answerRefs.length + factRefs.length ? { angle: "", body, why: "", factRefs, answerRefs } : null;
}

export function mockVersions(ev: Evidence, _type: PostType): PostVersionsModel {
  void _type;
  const answers = ev.answers.map((a) => ({ text: clean(a.text), answer: a.id })).filter((a) => a.text);
  const facts = ev.facts.map((f) => ({ text: `Something I did: ${clean(f.text).replace(/^(\p{Lu})/u, (c) => c.toLowerCase())}`, fact: f.id }));
  const rotate = <T,>(xs: T[], k: number) => xs.slice(k).concat(xs.slice(0, k));
  const ins = (l: number): Piece => ({ text: LINES[l] });
  const plans: { angle: string; why: string; pieces: Piece[]; spare: string[] }[] = [
    { angle: "In order", why: "Your answers in the order you gave them.", pieces: [ins(0), ...answers, ins(5)], spare: [LINES[1], LINES[2], LINES[3], LINES[4]] },
    { angle: "Starts from the work", why: "Starts from one of your confirmed facts, then your answers.", pieces: [ins(1), ...facts.slice(0, 1), ...answers, ins(4)], spare: [LINES[0], LINES[2], LINES[3], LINES[5]] },
    { angle: "Starts from the end", why: "Starts from your last answer, then the rest.", pieces: [ins(3), ...rotate(answers, Math.max(0, answers.length - 1)), ...facts.slice(1, 2), ins(2)], spare: [LINES[0], LINES[1], LINES[4], LINES[5]] },
  ];
  const versions = plans.flatMap((p) => {
    const v = assemble(p.pieces, p.spare);
    return v ? [{ ...v, angle: p.angle, why: p.why }] : [];
  });
  return { versions };
}

/** Demo refine: only the two changes that need no wording of its own. Anything else is left for a real model. */
export function mockRefine(body: string, instruction: string): PostRefineModel | null {
  const sentences = body.split(/(?<=[.!?])\s+/).filter(Boolean);
  const i = instruction.trim().toLowerCase();
  if (sentences.length < 3) return null;
  if (/\bshort(er)?\b|\btrim\b|\bcut\b/.test(i)) return { body: sentences.slice(0, -1).join(" "), why: "Dropped the last sentence." };
  if (/\bdirect\b/.test(i)) return { body: sentences.slice(1).join(" "), why: "Dropped the opening sentence so it starts on the point." };
  return null;
}
