import { isMock, modelName, providerLabel } from "@/lib/llm";
import { apifyEnabled } from "@/lib/apify";

export async function GET() {
  // importFromLink: "demo" uses a fixture, "on" runs Apify, "off" means paste only. Never exposes keys.
  const importFromLink = isMock() ? "demo" : apifyEnabled() ? "on" : "off";
  return Response.json({ mock: isMock(), model: isMock() ? null : modelName(), provider: providerLabel(), importFromLink });
}
