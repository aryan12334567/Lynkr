/**
 * Reads a JSON request body with a size cap, so oversized requests are refused
 * (413) before they are parsed. Returns the parsed body or a ready error response.
 */
export async function readJson(req: Request, maxBytes: number): Promise<{ body: unknown } | { error: Response }> {
  const tooLarge = () => ({ error: Response.json({ error: "That request is too large." }, { status: 413 }) });
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge();
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { error: Response.json({ error: "Invalid request." }, { status: 400 }) };
  }
  if (new TextEncoder().encode(text).length > maxBytes) return tooLarge();
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { error: Response.json({ error: "Invalid request." }, { status: 400 }) };
  }
}

/** Per-route body caps: generous for real use, far below anything abusive. */
export const BODY_LIMIT = {
  interview: 32 * 1024,
  generate: 64 * 1024,
  plan: 4 * 1024,
  connect: 6 * 1024 * 1024, // screenshot up to 4 MB, base64-encoded
} as const;
