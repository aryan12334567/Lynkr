import { InterviewReply, InterviewRequest } from "@/lib/schemas";
import { callStructured, isMock, LlmError } from "@/lib/llm";
import { INTERVIEW_SYSTEM, interviewUser } from "@/lib/prompts";
import { mockInterview } from "@/lib/mock";
import { checkLimits } from "@/lib/limit";

export const maxDuration = 60;

const MAX_QUESTIONS = 8;
const MIN_QUESTIONS = 4;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = InterviewRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Please check your answers and try again." }, { status: 400 });
  }
  const { profile, turns } = parsed.data;

  if (turns.length >= MAX_QUESTIONS) {
    return Response.json({ done: true, question: "", why: "" });
  }
  if (isMock()) {
    return Response.json(mockInterview(turns));
  }

  const limited = checkLimits(req, "interview");
  if (limited) return Response.json({ error: limited }, { status: 429 });

  try {
    const reply = await callStructured({
      system: INTERVIEW_SYSTEM,
      user: interviewUser(profile, turns),
      schema: InterviewReply,
      effort: "low",
      maxTokens: 8000,
    });
    // The model may not stop before the minimum, and must ask something if not done.
    if ((reply.done && turns.length < MIN_QUESTIONS) || (!reply.done && !reply.question.trim())) {
      return Response.json(mockInterview(turns));
    }
    return Response.json(reply);
  } catch (err) {
    if (err instanceof LlmError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
