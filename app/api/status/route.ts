import { isMock, modelName, providerLabel } from "@/lib/llm";
import { apifyEnabled } from "@/lib/apify";
import { checkoutConfigured, paywallEnabled } from "@/lib/billing";

export async function GET() {
  // importFromLink: "demo" uses a fixture, "on" runs Apify, "off" means paste only. Never exposes keys.
  const importFromLink = isMock() ? "demo" : apifyEnabled() ? "on" : "off";
  // paywall: the app needs a subscription (license key). checkout: the subscribe button can open Dodo.
  return Response.json({ mock: isMock(), model: isMock() ? null : modelName(), provider: providerLabel(), importFromLink, paywall: paywallEnabled(), checkout: checkoutConfigured() });
}
