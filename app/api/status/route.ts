import { outreachVersion } from "@/lib/outreach/flags";
import { isMock, modelName, providerLabel } from "@/lib/llm";
import { checkoutConfigured, paywallEnabled } from "@/lib/billing";
import { interviewVersion } from "@/lib/interview/flags";

export async function GET() {
  // paywall: the app needs a subscription (license key). checkout: the subscribe button can open Dodo.
  return Response.json({ mock: isMock(), model: isMock() ? null : modelName(), provider: providerLabel(), paywall: paywallEnabled(), checkout: checkoutConfigured(), outreach: outreachVersion(), interview: interviewVersion() });
}
