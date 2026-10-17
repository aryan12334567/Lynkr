import { VaultReply, VaultRequest } from "@/lib/schemas";
import { BODY_LIMIT, readJson } from "@/lib/http";
import { callStructured, isMock, LlmError } from "@/lib/llm";
import { VAULT_SYSTEM, vaultUser } from "@/lib/prompts";
import { mockVault } from "@/lib/mock";
import { checkLimits } from "@/lib/limit";
import { overlap, plainDashes } from "@/lib/clean";

export const maxDuration = 60;

/** Step 1 of drafting: candidate facts with the answers they came from. The user reviews them before anything is written. */
export async function POST(req: Request) {
  const read = await readJson(req, BODY_LIMIT.vault);
  if ("error" in read) return read.error;
  const parsed = VaultRequest.safeParse(read.body);
  if (!parsed.success) {
    return Response.json({ error: "Please check your answers and try again." }, { status: 400 });
  }
  const { profile, turns } = parsed.data;

  if (isMock()) return Response.json(mockVault(profile, turns));

  const limited = checkLimits(req, "interview");
  if (limited) return Response.json({ error: limited }, { status: 429 });

  try {
    const reply = await callStructured({ system: VAULT_SYSTEM, user: vaultUser(profile, turns), schema: VaultReply, effort: "low", maxTokens: 6000 });
    // Drop references to answers that don't exist or were skipped, and empty facts.
    const valid = (n: number) => n >= 1 && n <= turns.length && turns[n - 1].a !== "(skipped)";
    const facts = reply.facts
      .filter((f) => f.text.trim())
      .map((f) => ({ ...f, text: plainDashes(f.text.trim()).slice(0, 400), sourceTurnIds: [...new Set(f.sourceTurnIds.filter(valid))] }))
      // A fact with no answer behind it must come from the background line; anything else is not something the person said.
      .filter((f) => f.sourceTurnIds.length > 0 || overlap(f.text, profile.background) >= 0.5)
      // Every fact pointing at an answer must share words with that answer.
      .filter((f) => f.sourceTurnIds.length === 0 || f.sourceTurnIds.some((n) => overlap(f.text, turns[n - 1].a) >= 0.3))
      .slice(0, 16);
    return Response.json({ facts } satisfies VaultReply);
  } catch (err) {
    if (err instanceof LlmError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
