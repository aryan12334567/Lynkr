import { isMock, MODEL } from "@/lib/llm";

export async function GET() {
  return Response.json({ mock: isMock(), model: isMock() ? null : MODEL });
}
