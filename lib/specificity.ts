/**
 * A rough, rule-based check for "does this read like generic AI/LinkedIn text?".
 * It is a hint, not a detector. It counts concrete signals (numbers, names)
 * and subtracts for stock phrases.
 */
const STOCK = [
  "thrilled to",
  "excited to announce",
  "excited to share",
  "humbled",
  "game-changer",
  "game changer",
  "fast-paced world",
  "let that sink in",
  "here's the thing",
  "here's what i learned",
  "unlock your",
  "leverage",
  "synergy",
  "passionate about",
  "hard work pays off",
  "my journey",
  "grateful for the opportunity",
  "delve",
  "tapestry",
  "navigating the",
  "at the end of the day",
  "agree?",
  "thoughts?",
  "hot take",
  "dive deep",
  "in today's",
];

export type Specificity = {
  score: number;
  label: "Reads generic" | "Getting specific" | "Specific";
  flagged: string[];
  numbers: number;
  names: number;
  words: number;
};

export function scoreSpecificity(text: string): Specificity {
  const t = text.trim();
  const lower = t.toLowerCase();
  const words = t ? t.split(/\s+/).length : 0;

  const numbers = new Set(t.match(/\d[\d,.]*/g) ?? []).size;
  const names = new Set(
    (t.match(/(?<![.!?]\s)(?<!^)\b[A-Z][a-zA-Z]{2,}\b/g) ?? []).filter(
      (w) => !["The", "This", "That", "When", "What", "And", "But", "India"].includes(w),
    ),
  ).size;
  const flagged = STOCK.filter((p) => lower.includes(p));

  let score = 30;
  score += Math.min(numbers, 4) * 10;
  score += Math.min(names, 5) * 5;
  score -= flagged.length * 10;
  if (words > 0 && words < 40) score -= 10;
  if (words > 260) score -= 10;
  if (words === 0) score = 0;
  score = Math.max(0, Math.min(100, score));

  const label = score < 45 ? "Reads generic" : score < 70 ? "Getting specific" : "Specific";
  return { score, label, flagged, numbers, names, words };
}
