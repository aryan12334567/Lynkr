import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const MODEL = process.env.LYNKR_MODEL || "claude-opus-5-5";

/** Mock mode runs the whole flow with no API key (demo / development). */
export function isMock(): boolean {
  return process.env.LYNKR_MOCK === "1" || !process.env.ANTHROPIC_API_KEY;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

let cached: Anthropic | null = null;
function client(): Anthropic {
  cached ??= new Anthropic();
  return cached;
}

type Effort = "low" | "medium" | "high";

export async function callStructured<S extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: S;
  effort: Effort;
  maxTokens: number;
}): Promise<z.infer<S>> {
  try {
    const res = await client().messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      output_config: { format: zodOutputFormat(opts.schema), effort: opts.effort },
    });
    if (res.stop_reason === "refusal") {
      throw new LlmError("The AI declined this request. Try rewording your answers.", 422);
    }
    if (res.stop_reason === "max_tokens") {
      throw new LlmError("The AI ran out of room while writing. Please try again.", 502);
    }
    if (!res.parsed_output) {
      throw new LlmError("The AI returned something we could not read. Please try again.", 502);
    }
    return res.parsed_output as z.infer<S>;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err instanceof Anthropic.AuthenticationError) {
      throw new LlmError("The server's AI key is invalid.", 500);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new LlmError("The AI is busy right now. Please try again in a minute.", 429);
    }
    if (err instanceof Anthropic.BadRequestError) {
      throw new LlmError("The AI could not process this request.", 400);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new LlmError("Could not reach the AI. Check your connection and retry.", 502);
    }
    if (err instanceof Anthropic.APIError) {
      throw new LlmError(`The AI service returned an error (${err.status}).`, 502);
    }
    throw err;
  }
}
