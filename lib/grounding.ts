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

// ---- invented claims (audit dimension 1) ----
// The ratio check above passes a sentence that reuses the person's words and adds one thing they never said
// ("I interned at a startup where I cleaned survey data"). These checks look for the added thing itself.

const wordsOf = (texts: readonly string[]) => new Set(texts.join(" ").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
type Known = { words: Set<string>; stems: Set<string> };
const knownFrom = (texts: readonly string[]): Known => { const words = wordsOf(texts); return { words, stems: new Set([...words].map(stem)) }; };
const inKnown = (w: string, k: Known) => k.words.has(w.toLowerCase()) || (w.length > 4 && k.stems.has(stem(w.toLowerCase())));

/** Words that state a credential or an outcome. Each is fine when the person's own material holds it, and an invention when it does not. */
const CLAIM_WORD = /\b(?:intern(?:ed|ing|ships?)?|experienced|expertise|expert|skilled|proficient|seasoned|certified|certifications?|award(?:s|ed)?|prizes?|winner|won|rank(?:ed)?|topp(?:er|ed)|promoted|adopted|approved|praised|appreciated|recogni[sz]ed|shortlisted|published|featured|funded|led|managed|founded|launched|shipped|mentored|increased|reduced|improved|saved|grew|doubled|tripled|boosted|permanently|successfully|significantly)\b/giu;
/** Quantities written as words, which a digits-only check never sees. */
const QUANTITY_WORD = /\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozens?|hundreds?|thousands?|lakhs?|crores?|millions?|several|multiple|numerous|countless)\b/giu;
const FLATTERY = /\b(?:admir\w*|inspir\w*|impress\w*|amazing|incredible|awesome|fantastic|remarkable|brilliant|(?:big|huge|great) fan|look(?:ing)? up to|role model|love (?:your|what you|the work))\b/giu;
/** "As a data analyst, I ...", "I'm an engineer": a title the person gives themselves. */
const IDENTITY = /\b(?:as an?|i am an?|i'm an?|i work as an?|being an?)\s+(?:[\p{L}-]+\s+){0,3}?(analyst|engineer|developer|designer|manager|consultant|specialist|professional|scientist|marketer|founder|leader|architect|strategist|researcher|expert)\b/giu;
const SPEAKS_OF_SELF = /\b(?:i|i'm|i've|i'd|my|we|our|me)\b/i;

/**
 * The first invented thing in `text`, or null. `own` is what the writer may say about themselves (their facts, their
 * reaction, wording the product itself approved), `all` adds what is known about the other side (the post, the recipient),
 * and `person` is only the writer's own facts, for titles they give themselves.
 *   "claim"     a credential or outcome word nobody supplied
 *   "quantity"  a number written as a word that no source holds
 *   "identity"  a job title the person's facts never give them
 *   "flattery"  praise that no source supports
 */
export function claimProblem(text: string, own: readonly string[], all: readonly string[], person: readonly string[] = own): "claim" | "quantity" | "identity" | "flattery" | null {
  const mine = knownFrom(own), every = knownFrom(all), self = knownFrom(person);
  for (const s of splitSentences(text.replace(/\[\[[^\]]*\]\]/g, " "))) {
    const about = SPEAKS_OF_SELF.test(s) ? mine : every;
    for (const m of s.matchAll(CLAIM_WORD)) if (!inKnown(m[0], about)) return "claim";
    for (const m of s.matchAll(QUANTITY_WORD)) if (!every.words.has(m[0].toLowerCase())) return "quantity";
    for (const m of s.matchAll(IDENTITY)) {
      // "As an analyst at Example Co, you do ..." is about the reader, not the writer.
      if (/^[^,.;:]*,?\s+you\b/i.test(s.slice(m.index + m[0].length))) continue;
      // "you work as an analyst": the title is the reader's.
      if (/\b(?:you|you're|your)\b[^,.;:]{0,25}$/i.test(s.slice(0, m.index))) continue;
      if (!inKnown(m[1], self)) return "identity";
    }
    for (const m of s.matchAll(FLATTERY)) if (!inKnown(m[0].split(/\s+/)[0], every)) return "flattery";
  }
  return null;
}

// Hindi written in Latin letters. `STRONG` words are not English words; `WEAK` ones are, so they only add weight.
const HINGLISH_STRONG = new Set("maine mera meri mere mujhe humne hai hain tha thi kiya kiye karna karne karta karti raha rahi rahe hoon nahi nahin aur lekin kyunki kyonki mein liye wala wali toh hua hui banaya banaye sikha chahiye lagta pehle baad warna galat sahi bahut kuch yeh woh apna apni kaam".split(" "));
const HINGLISH_WEAK = new Set("ke ki ka ko se me par bhi hum jab tab".split(" "));

/** True when a line is Hindi in Latin letters (or mostly so). An English line with a stray "ka" or "me" is not. */
export function looksHinglish(text: string): boolean {
  const ws = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const strong = ws.filter((w) => HINGLISH_STRONG.has(w)).length;
  const weak = ws.filter((w) => HINGLISH_WEAK.has(w)).length;
  return strong >= 2 || (strong >= 1 && strong + weak >= 3);
}
