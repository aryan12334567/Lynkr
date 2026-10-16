import { GenerateReply, GenerateRequest } from "@/lib/schemas";
import { callStructured, isMock, LlmError } from "@/lib/llm";
import { GENERATE_SYSTEM, generateUser } from "@/lib/prompts";
import { mockGenerate } from "@/lib/mock";
import { checkLimits } from "@/lib/limit";

export const maxDuration = 120;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = GenerateRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Please check your answers and try again." }, { status: 400 });
  }
  const { profile, turns } = parsed.data;

  if (isMock()) {
    return Response.json(mockGenerate(profile, turns));
  }

  const limited = checkLimits(req, "generate");
  if (limited) return Response.json({ error: limited }, { status: 429 });

  try {
    const reply = await callStructured({
      system: GENERATE_SYSTEM,
      user: generateUser(profile, turns),
      schema: GenerateReply,
      effort: "medium",
      maxTokens: 16000,
    });
    return Response.json(reply);
  } catch (err) {
    if (err instanceof LlmError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
