import { checkoutConfigured, createCheckout } from "@/lib/billing";
import { checkLimits } from "@/lib/limit";

export const maxDuration = 30;

/** Opens a Dodo checkout for the Lynkr monthly subscription. Dodo is the Merchant of Record. */
export async function POST(req: Request) {
  if (!checkoutConfigured()) return Response.json({ error: "Checkout isn't available right now. Please try again later." }, { status: 503 });
  const limited = checkLimits(req, "checkout");
  if (limited) return Response.json({ error: limited }, { status: 429 });
  try {
    const url = await createCheckout(new URL(req.url).origin);
    if (!url) return Response.json({ error: "Couldn't open checkout. Please try again." }, { status: 502 });
    return Response.json({ url });
  } catch (err) {
    // Log the error type and HTTP status only, never the message or request, so keys can't leak.
    const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : "none";
    console.error("checkout failed:", err instanceof Error ? err.name : "unknown", status);
    return Response.json({ error: "Couldn't open checkout. Please try again." }, { status: 502 });
  }
}
