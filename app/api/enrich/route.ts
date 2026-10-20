import { requireLicense } from "@/lib/billing";
import { EnrichRequest, ExternalContextPacket } from "@/lib/schemas";
import { BODY_LIMIT, readJson } from "@/lib/http";
import { isMock } from "@/lib/llm";
import { checkSource } from "@/lib/sourcePolicy";
import { apifyEnabled, fetchPageViaApify, FAILURE_MESSAGE, FetchError } from "@/lib/apify";
import { ExtractError, extractPacket, hasContactData } from "@/lib/externalContext";
import { FIXTURE_HTML } from "@/lib/enrichFixture";
import { checkLimits } from "@/lib/limit";

export const maxDuration = 90;

/** Aggregate-only log line: no URL path, query, page text or token. */
function log(status: string, category: string, ms: number, domain = "", detail = "") {
  console.info(JSON.stringify({ event: "lynkr.enrich", status, category, ms, domain, ...(detail ? { detail } : {}) }));
}

/**
 * Import one public job posting (Apify enrichment plan). Policy first, then one fetch,
 * then extraction to a small packet the user reviews. The page is discarded here.
 */
export async function POST(req: Request) {
  // Paid access: a no-op unless LYNKR_PAYWALL=1.
  const locked = await requireLicense(req);
  if (locked) return locked;
  const t0 = Date.now();
  const read = await readJson(req, BODY_LIMIT.enrich);
  if ("error" in read) return read.error;
  const parsed = EnrichRequest.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Paste the link to one job posting.", fallback: true }, { status: 400 });

  // Policy is checked before anything else, so a refused link never costs a run.
  const policy = checkSource(parsed.data.url);
  if (!policy.ok) {
    log("rejected", "policy", Date.now() - t0);
    return Response.json({ error: policy.reason, fallback: true }, { status: 422 });
  }

  // Demo mode: a fictional fixture, no network call (plan R12, A8).
  if (isMock()) {
    const packet = extractPacket(FIXTURE_HTML, policy.url, policy.source);
    log("ok", "fixture", Date.now() - t0, policy.host);
    return Response.json({ packet, demo: true });
  }

  if (!apifyEnabled()) {
    log("refused", "config", Date.now() - t0, policy.host);
    return Response.json({ error: FAILURE_MESSAGE.config, fallback: true }, { status: 503 });
  }

  const limited = checkLimits(req, "enrich");
  if (limited) {
    log("refused", "limit", Date.now() - t0, policy.host);
    return Response.json({ error: limited, fallback: true }, { status: 429 });
  }

  try {
    const html = await fetchPageViaApify(policy.url);
    const packet = extractPacket(html, policy.url, policy.source);
    // Last check before anything leaves the server.
    if (hasContactData(packet) || !ExternalContextPacket.safeParse(packet).success) throw new ExtractError("malformed");
    log("ok", "apify", Date.now() - t0, policy.host);
    return Response.json({ packet, demo: false });
  } catch (err) {
    const category = err instanceof FetchError || err instanceof ExtractError ? err.category : "provider";
    log("failed", category, Date.now() - t0, policy.host, err instanceof FetchError ? err.detail : "");
    const status = category === "quota" ? 429 : category === "timeout" ? 504 : category === "no_requirements" || category === "redirected" || category === "empty" ? 422 : 502;
    return Response.json({ error: FAILURE_MESSAGE[category], fallback: true }, { status });
  }
}
