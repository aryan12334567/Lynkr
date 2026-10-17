/**
 * A rough grounding check for drafts: sentences whose meaningful words mostly don't
 * appear in the user's confirmed facts get marked for review. It's a pointer for the
 * user, not proof either way: a paraphrase can be flagged, and a true-sounding
 * invention that reuses fact words can pass.
 */

// Words that carry no claim: scaffolding a post or message needs.
const COMMON = new Set(
  (
    "about after again also because been before being both could does doing done during each every from have having here into just make made more most much need only other over same should some such than that their them then there these they this those through very want were what when where which while with would your yours youre mine work working role roles team teams people someone anyone thing things time first next last week year years used using made took take learned learn noticed something really still well like good great better lot lots part parts kind kinds show shows know think"
  ).split(" "),
);

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/\[\[[^\]]*\]\]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !COMMON.has(w));

/** Crude stem so "cleaned" matches "cleaning" and "dashboards" matches "dashboard". */
const stem = (w: string) => w.replace(/(ings|ing|ed|es|s)$/, "");

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Sentences where under `threshold` of the meaningful words appear in the facts.
 * Sentences that are mostly blanks, or too short to judge, are skipped.
 */
export function unsupportedSentences(text: string, sources: string[], threshold = 0.4): string[] {
  const known = new Set(sources.flatMap(tokens).map(stem));
  return splitSentences(text).filter((s) => {
    // A question to the reader is the ask, not a claim about the user.
    if (/\?\s*$/.test(s)) return false;
    const ws = tokens(s);
    if (ws.length < 4) return false;
    const hit = ws.filter((w) => known.has(stem(w))).length;
    return hit / ws.length < threshold;
  });
}
