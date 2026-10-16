import { isMock, modelName, providerLabel } from "@/lib/llm";

export async function GET() {
  return Response.json({ mock: isMock(), model: isMock() ? null : modelName(), provider: providerLabel() });
}
