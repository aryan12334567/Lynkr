import { sessionUser } from "@/lib/auth";
import { cloudReady, getDb } from "@/lib/db";
import { calendarRow, mondayTodo } from "@/lib/outreach/calendar";

/**
 * The Monday to-do (R45): meetings with an unanswered card, then the "did they reply / accept?" questions, then the
 * other due steps. Today reads the same list on other days. A read, so a signed-in account is enough (R47); it never
 * writes, and every row is the signed-in user's own.
 */
export async function GET(req: Request) {
  const user = await sessionUser(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (!(await cloudReady())) return Response.json({ error: "Account storage is unavailable." }, { status: 409 });
  const db = getDb();
  const ready = await db.query<{ name: string | null }>("select to_regclass('public.outreach_events')::text as name");
  if (!ready.rows[0]?.name) return Response.json({ error: "Outreach storage is unavailable." }, { status: 409 });
  const rows = await db.query(
    `select e.id, e.contact_id, e.kind, e.status, e.due_at, e.done_at, e.meeting_at, e.rule, c.name, c.goal
       from outreach_events e join contacts c on c.id = e.contact_id and c.user_id = e.user_id
      where e.user_id = $1 and e.kind <> 'why' and c.goal_reached_at is null and c.closed_at is null`,
    [user.id],
  );
  return Response.json(mondayTodo(rows.rows.map(calendarRow), new Date()));
}
