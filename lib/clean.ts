/**
 * Server-side guards on AI output. These are deterministic checks that don't rely on the
 * model following its instructions. They can't prove a sentence is true; the user still reviews.
 */

/** Replace em and en dashes used as punctuation, which read as machine-written. */
export function plainDashes(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/, ,/g, ",")
    .replace(/,\s*([.?!])/g, "$1");
}

/** Apply plainDashes to every string in a JSON value. */
export function cleanStrings<T>(v: T): T {
  if (typeof v === "string") return plainDashes(v) as T;
  if (Array.isArray(v)) return v.map(cleanStrings) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cleanStrings(x)])) as T;
  return v;
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );

/** Share of a's meaningful words that also appear in b (0..1). */
export function overlap(a: string, b: string): number {
  const A = words(a);
  if (!A.size) return 0;
  const B = words(b);
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / A.size;
}

/** True when a new interview question mostly repeats one already asked. */
export function repeatsQuestion(q: string, asked: string[]): boolean {
  return asked.some((p) => overlap(q, p) >= 0.6 && overlap(p, q) >= 0.6);
}
