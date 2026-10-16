import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * Two backends, picked by env:
 * - Anthropic: set ANTHROPIC_API_KEY (default model claude-opus-5-5, override LYNKR_MODEL).
 * - Any OpenAI-compatible chat endpoint: set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL.
 * With neither key set, mock mode runs the whole flow with no AI.
 */
type Provider = "anthropic" | "openai";

function provider(): Provider {
  if (process.env.LLM_BASE_URL) return "openai";
  return "anthropic";
}

export function modelName(): string {
  return provider() === "openai" ? process.env.LLM_MODEL || "" : process.env.LYNKR_MODEL || "claude-opus-5-5";
}

export function isMock(): boolean {
  if (process.env.LYNKR_MOCK === "1") return true;
  if (provider() === "openai") {
    return !(process.env.LLM_API_KEY && process.env.LLM_MODEL);
  }
  return !process.env.ANTHROPIC_API_KEY;
}

export function providerLabel(): string | null {
  if (isMock()) return null;
  return provider() === "openai" ? `OpenAI-compatible (${modelName()})` : `Anthropic (${modelName()})`;
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
  return provider() === "openai" ? callOpenAI(opts) : callAnthropic(opts);
}

async function callAnthropic<S extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: S;
  effort: Effort;
  maxTokens: number;
}): Promise<z.infer<S>> {
  try {
    const res = await client().messages.parse({
      model: modelName(),
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

/** Calls any OpenAI-compatible /chat/completions endpoint with a JSON-schema response format. */
async function callOpenAI<S extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: S;
  maxTokens: number;
}): Promise<z.infer<S>> {
  const base = (process.env.LLM_BASE_URL || "").replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelName(),
        max_tokens: opts.maxTokens,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "lynkr_reply", schema: z.toJSONSchema(opts.schema), strict: true },
        },
      }),
    });
  } catch {
    throw new LlmError("Could not reach the AI. Check your connection and retry.", 502);
  }

  if (res.status === 401 || res.status === 403) throw new LlmError("The server's AI key is invalid.", 500);
  if (res.status === 429) throw new LlmError("The AI is busy right now. Please try again in a minute.", 429);
  if (!res.ok) throw new LlmError(`The AI service returned an error (${res.status}).`, 502);

  const data = (await res.json().catch(() => null)) as
    | { choices?: { message?: { content?: string | null }; finish_reason?: string }[] }
    | null;
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === "length") {
    throw new LlmError("The AI ran out of room while writing. Please try again.", 502);
  }
  const text = choice?.message?.content;
  if (!text) throw new LlmError("The AI returned something we could not read. Please try again.", 502);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new LlmError("The AI returned something we could not read. Please try again.", 502);
  }
  const checked = opts.schema.safeParse(parsed);
  if (!checked.success) {
    throw new LlmError("The AI returned something we could not read. Please try again.", 502);
  }
  return checked.data as z.infer<S>;
}
