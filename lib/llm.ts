import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * Backends, picked by env (first match wins):
 * - OpenAI: set OPENAI_API_KEY (model from LLM_MODEL, default gpt-5-mini).
 * - Any OpenAI-compatible chat endpoint: set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL.
 * - Anthropic: set ANTHROPIC_API_KEY (default model claude-opus-5-5, override LYNKR_MODEL).
 * With no key set, or LYNKR_MOCK=1, mock mode runs the whole flow with no AI.
 */
type Provider = "anthropic" | "openai";

const OPENAI_BASE = "https://api.openai.com/v1";
const OPENAI_DEFAULT_MODEL = "gpt-5-mini";

function provider(): Provider {
  if (process.env.OPENAI_API_KEY || process.env.LLM_BASE_URL) return "openai";
  return "anthropic";
}

function openaiBase(): string {
  return (process.env.LLM_BASE_URL || OPENAI_BASE).replace(/\/+$/, "");
}

function openaiKey(): string {
  return process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";
}

export function modelName(): string {
  if (provider() === "openai") return process.env.LLM_MODEL || (process.env.LLM_BASE_URL ? "" : OPENAI_DEFAULT_MODEL);
  return process.env.LYNKR_MODEL || "claude-opus-5-5";
}

export function isMock(): boolean {
  if (process.env.LYNKR_MOCK === "1") return true;
  if (provider() === "openai") return !(openaiKey() && modelName());
  return !process.env.ANTHROPIC_API_KEY;
}

export function providerLabel(): string | null {
  if (isMock()) return null;
  if (provider() === "openai") return `${openaiBase() === OPENAI_BASE ? "OpenAI" : "OpenAI-compatible"} (${modelName()})`;
  return `Anthropic (${modelName()})`;
}

/**
 * OpenAI strict JSON schemas accept a subset of JSON Schema. Drop what zod adds that
 * strict mode doesn't need: the $schema header and integer range bounds. The zod
 * schema still validates the reply afterwards.
 */
export function strictSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(strictSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === "$schema" || k === "minimum" || k === "maximum" || k === "exclusiveMinimum" || k === "exclusiveMaximum") continue;
    out[k] = strictSchema(v);
  }
  return out;
}

/** OpenAI's reasoning models (o-series, GPT-5) take max_completion_tokens and a reasoning effort. */
function isReasoningModel(model: string): boolean {
  return /^(o\d|gpt-5)/i.test(model);
}

export class LlmError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

let cached: Anthropic | null = null;
function client(): Anthropic {
  cached ??= new Anthropic();
  return cached;
}

type Effort = "low" | "medium" | "high";

/** Optional screenshot sent with the request (Connect Coach). Never stored. */
export type ImageInput = { mediaType: "image/png" | "image/jpeg" | "image/webp"; data: string };

export async function callStructured<S extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: S;
  effort: Effort;
  maxTokens: number;
  image?: ImageInput;
}): Promise<z.infer<S>> {
  return provider() === "openai" ? callOpenAI(opts) : callAnthropic(opts);
}

async function callAnthropic<S extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: S;
  effort: Effort;
  maxTokens: number;
  image?: ImageInput;
}): Promise<z.infer<S>> {
  try {
    const res = await client().messages.parse({
      model: modelName(),
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: [
        {
          role: "user",
          content: opts.image
            ? [
                { type: "image", source: { type: "base64", media_type: opts.image.mediaType, data: opts.image.data } },
                { type: "text", text: opts.user },
              ]
            : opts.user,
        },
      ],
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
  effort: Effort;
  maxTokens: number;
  image?: ImageInput;
}): Promise<z.infer<S>> {
  const base = openaiBase();
  const model = modelName();
  const reasoning = base === OPENAI_BASE && isReasoningModel(model);
  // Reasoning tokens count against the limit, so give reasoning models more room.
  const limit = reasoning
    ? { max_completion_tokens: opts.maxTokens * 2, reasoning_effort: opts.effort }
    : base === OPENAI_BASE
      ? { max_completion_tokens: opts.maxTokens }
      : { max_tokens: opts.maxTokens };
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey()}`,
      },
      body: JSON.stringify({
        model,
        ...limit,
        messages: [
          { role: "system", content: opts.system },
          {
            role: "user",
            content: opts.image
              ? [
                  { type: "text", text: opts.user },
                  { type: "image_url", image_url: { url: `data:${opts.image.mediaType};base64,${opts.image.data}` } },
                ]
              : opts.user,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "lynkr_reply", schema: strictSchema(z.toJSONSchema(opts.schema)), strict: true },
        },
      }),
    });
  } catch {
    throw new LlmError("Could not reach the AI. Check your connection and retry.", 502);
  }

  if (!res.ok) {
    // Only the status and the provider's error code go to the log: the body can echo the prompt, which holds answers.
    const detail = await res.text().catch(() => "");
    const code = /"(?:code|type)"\s*:\s*"([\w.-]{1,60})"/.exec(detail)?.[1] ?? "unknown";
    console.error(`[lynkr] AI request failed (${res.status}, ${code}) for model ${model}`);
    if (res.status === 401 || res.status === 403) throw new LlmError("The server's AI key is invalid.", 500);
    if (res.status === 404) throw new LlmError("The AI model set on the server isn't available. Check LLM_MODEL.", 500);
    if (res.status === 429) {
      throw new LlmError(/quota|billing/i.test(detail) ? "The AI account is out of credit. The owner needs to add credit or raise the limit." : "The AI is busy right now. Please try again in a minute.", 429);
    }
    throw new LlmError(`The AI service returned an error (${res.status}).`, 502);
  }

  const data = (await res.json().catch(() => null)) as
    | { choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[] }
    | null;
  const choice = data?.choices?.[0];
  if (choice?.message?.refusal) throw new LlmError("The AI declined this request. Try rewording your answers.", 422);
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
