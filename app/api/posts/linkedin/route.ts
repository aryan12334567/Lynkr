import { postsGate } from "@/lib/posts/gate";
import { connectionStatus } from "@/lib/posts/linkedin";

/** GET -> { autopublish, connected, canPublish, expiresAt }. A session is enough. Never returns a token or member id. */
export async function GET(req: Request) {
  const gate = await postsGate(req, { paid: false });
  if ("error" in gate) return gate.error;
  return Response.json(await connectionStatus(gate.ctx.db, gate.ctx.userId));
}
