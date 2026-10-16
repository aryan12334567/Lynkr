# Feature spec: weekly plan + calendar

Scope chosen by Aryan on 2026-10-16: one feature, "weekly plan + calendar", plus two ideas from the UpLinked evidence: content-type tags and adjusting the plan by chat. Source of truth for Lynkr behaviour is `CONTEXT.md` (spec items 8 and 10); UpLinked evidence is in `feature-evidence.md`. Nothing is copied from UpLinked; this is an independent design.

## What it does
After the drafts exist, a **This week** tab places Lynkr's weekly actions on a Mon–Fri calendar in IST. Each item links to one of the user's drafts. The user moves items through Draft → Scheduled → Posted (or Sent for messages), sets reminders through `.ics` files, a Google Calendar link or an in-tab browser notification, and tracks replies. Nothing is posted or sent by Lynkr.

## Data
```
PlanItem {
  id: string                 // stable: "<kind>-<index>"
  kind: "post" | "comment" | "message" | "follow_up"
  tag: "proof" | "setback" | "observation" | "comment" | "outreach" | "follow_up"   // content-type tag
  draftId: string            // key into the existing drafts: post:0..2, comment:0..1, out:referral|out:hm|out:follow
  day: "YYYY-MM-DD"          // IST date
  time: "HH:MM"              // IST, 24h
  status: "draft" | "scheduled" | "done"   // "done" = Posted (post/comment) or Sent (message/follow-up)
  doneAt?: ISO string        // when marked done
  replied?: boolean          // messages only
}
Plan { weekStart: "YYYY-MM-DD" (a Monday, IST), counts: {posts, comments, messages}, times: {post, comment, message}, items: PlanItem[], notified: string[] }
```
Stored in localStorage with the rest of Lynkr's state; "Clear everything" removes it.

## Rules
1. **Default counts:** 3 messages, 2 comments, 1 post (spec item 8). Bounds: posts 0–5, comments 0–10, messages 0–10.
2. **Which week:** if today (IST) is Mon–Wed, plan the current week; Thu–Sun, plan next week, so the user never starts with a mostly past week.
3. **Placement:** each kind is spread evenly over Mon–Fri with a different starting day so items don't pile up: messages start Mon, posts Tue, comments Wed.
4. **Default times (IST), user-editable:** posts 09:00, messages 10:30, comments 12:30. Labelled as defaults, not as "best times".
5. **Draft links:** posts cycle proof → setback → observation (post:0..2); comments cycle comment:0..1; messages alternate referral / hiring manager. Follow-ups link to out:follow.
6. **Tags:** post tags follow the linked post; comment → comment; message → outreach; follow-up → follow_up.
7. **Status:** Draft → Scheduled (a reminder is set, nothing publishes) → Posted/Sent. Any status can go back to Draft.
8. **Follow-up due:** a message marked Sent ≥ 5 days ago with no reply shows "Follow-up due" and can add a follow_up item 5–7 days after the send (spec: follow-up after 5–7 days).
9. **Move:** an item can be moved to any day Mon–Fri of the plan week and given a new time.
10. **Reminders:** per-item `.ics`, whole-week `.ics`, "Add to Google Calendar" link with the draft text in the description (filled blanks if done, otherwise the draft with blanks shown), and optional browser notifications while the tab is open. 15-minute events. IST converted to UTC (IST = UTC+5:30, no DST).
11. **Adjust by chat:** a text box changes counts and default times ("2 posts", "no comments", "more outreach", "posts at 8am"). Without an AI key a rule-based parser handles these patterns and says so when it can't; with a key the same request goes to the AI with a strict schema. Results are always clamped to the bounds in rule 1. Existing items keep their status when counts change.
12. **Views:** week view (Mon–Fri columns on desktop, stacked days on phones) and month view (calendar grid with item chips). Previous/next week navigation shows only the plan week's items; other weeks are empty.

## Out of scope
Drag-and-drop (moving uses a day picker instead), automatic posting or sending, email/push reminders (need a backend), campaigns, engagement counts, multiple weeks of history.

## Open questions
- Should a new week carry over unfinished items? Current answer: no; "Plan next week" starts fresh with the same counts and times.
