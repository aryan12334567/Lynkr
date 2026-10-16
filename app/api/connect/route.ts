import { ConnectReply, ConnectRequest } from "@/lib/schemas";
import { callStructured, isMock, LlmError } from "@/lib/llm";
import { CONNECT_SYSTEM, connectUser } from "@/lib/prompts";
import { mockNote, validateImage } from "@/lib/connect";
import { checkLimits } from "@/lib/limit";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = ConnectRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Paste up to 4,000 characters, or a PNG, JPG or WebP screenshot under 4 MB." }, { status: 400 });
  }
  const { profile, facts, relationship, text, image } = parsed.data;
  if (!text && !image) {
    return Response.json({ error: "Paste their headline, About or a post, or upload a screenshot." }, { status: 400 });
  }
  if (image) {
    const bad = validateImage(image.media_type, image.data);
    if (bad) return Response.json({ error: bad }, { status: 413 });
  }

  if (isMock()) {
    if (!text) {
      return Response.json(
        { error: "Reading screenshots needs an AI key, so it isn't available in demo mode. Paste the text from their profile instead." },
        { status: 422 },
      );
    }
    return Response.json(mockNote(profile, text) satisfies ConnectReply);
  }

  const limited = checkLimits(req, "interview");
  if (limited) return Response.json({ error: limited }, { status: 429 });

  try {
    const reply = await callStructured({
      system: CONNECT_SYSTEM,
      user: connectUser(profile, facts, relationship, text),
      schema: ConnectReply,
      effort: "low",
      maxTokens: 2000,
      image: image ? { mediaType: image.media_type, data: image.data } : undefined,
    });
    return Response.json(reply);
  } catch (err) {
    if (err instanceof LlmError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
