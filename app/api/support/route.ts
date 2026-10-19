import { checkLimits } from "@/lib/limit";
import { createSupportCheckout, supportConfigured } from "@/lib/support";

export const maxDuration = 30;

/** Tells the page whether to show the "Support Lynkr" button. Never exposes keys. */
export async function GET() {
  return Response.json({ enabled: supportConfigured(), mode: "test" });
}

/** Opens a Dodo test-mode checkout for the Support Lynkr product. Nothing is unlocked by paying. */
export async function POST(req: Request) {
  if (!supportConfigured()) return Response.json({ error: "Support checkout isn't set up." }, { status: 404 });
  const limited = checkLimits(req, "support");
  if (limited) return Response.json({ error: limited }, { status: 429 });
  try {
    const url = await createSupportCheckout(new URL(req.url).origin);
    if (!url) return Response.json({ error: "Couldn't open checkout. Please try again." }, { status: 502 });
    return Response.json({ url });
  } catch (err) {
    // Log the error type and HTTP status only, never the message or request, so keys can't leak.
    const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : "none";
    console.error("support checkout failed:", err instanceof Error ? err.name : "unknown", status);
    return Response.json({ error: "Couldn't open checkout. Please try again." }, { status: 502 });
  }
}
