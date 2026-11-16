/**
 * Reads a JSON request body with a size cap, so oversized requests are refused
 * (413) before they are parsed. Returns the parsed body or a ready error response.
 */
export async function readJson(req: Request, maxBytes: number): Promise<{ body: unknown } | { error: Response }> {
  const tooLarge = () => ({ error: Response.json({ error: "That request is too large." }, { status: 413 }) });
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge();
  // The declared length can be missing (a chunked body) or false, so the bytes are counted as they arrive and the
  // reading stops at the cap: an oversized body is never held in memory.
  const text = await readCapped(req, maxBytes);
  if (text === TOO_LARGE) return tooLarge();
  if (text === null) return { error: Response.json({ error: "Invalid request." }, { status: 400 }) };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { error: Response.json({ error: "Invalid request." }, { status: 400 }) };
  }
}

const TOO_LARGE = Symbol("too large");

/** The body as text, `TOO_LARGE` once it passes `maxBytes`, or null when it cannot be read. */
export async function readCapped(req: Request, maxBytes: number): Promise<string | typeof TOO_LARGE | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        return TOO_LARGE;
      }
      parts.push(value);
    }
  } catch {
    return null;
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.byteLength; }
  return new TextDecoder().decode(all);
}

/** Per-route body caps: generous for real use, far below anything abusive. */
export const BODY_LIMIT = {
  interview: 32 * 1024,
  interview2: 96 * 1024, // up to 80 saved answers of the browser's copy, plus one new answer
  firstWin: 32 * 1024,
  vault: 48 * 1024,
  generate: 96 * 1024, // transcript + confirmed facts + optional job description and imported fields
  comment: 16 * 1024,
  enrich: 2 * 1024, // one URL
  review: 16 * 1024,
  plan: 4 * 1024,
  license: 2 * 1024, // a license key and a browser instance id
  connect: 6 * 1024 * 1024, // screenshot up to 4 MB, base64-encoded
} as const;
