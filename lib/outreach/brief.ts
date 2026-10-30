/** Extract only explicitly confirmed source text. No raw page text is persisted here. */
export type BriefFact = { text: string; quote: string; source: string; date: string };
const SENSITIVE = /\b(religion|religious|hindu|muslim|christian|sikh|islam|christianity|judaism|caste|politics|political|health|medical|illness|disease|diagnos\w*|cancer|disabilit\w*|family|married|marriage|spouse|children|pregnan\w*|sexuality|sexual orientation|personal financ\w*|salary|income|debt)\b/i;
const INSTRUCTION = /\b(ignore (?:all |any |the )?(?:previous|prior|above|earlier) (?:instructions|prompts?)|system prompt|assistant:|new instructions|disregard (?:all |the )?(?:previous|prior|above))\b/i;
export function cleanBriefText(text: string): string {
  return text.split(/\n|(?<=[.!?])\s+/).filter((line) => !SENSITIVE.test(line) && !INSTRUCTION.test(line)).map((line) => line.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '').replace(/https?:\/\/\S+/gi, '').replace(/\+?\d[\d\s().-]{7,}\d/g, '').trim()).filter(Boolean).join('\n').slice(0, 12000);
}
export function groundedBriefFacts(facts: BriefFact[], confirmed: { source: string; text: string }[]): BriefFact[] {
  const sources = new Map(confirmed.map((s) => [s.source, cleanBriefText(s.text)]));
  return facts.filter((f) => f.text.trim() && f.quote.trim() && !SENSITIVE.test(f.text) && !INSTRUCTION.test(f.text) && (sources.get(f.source)?.includes(f.quote) && sources.get(f.source)?.includes(f.text))).slice(0, 3);
}
