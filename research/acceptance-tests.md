# Acceptance tests: weekly plan + calendar

Each test has an ID used in `validation-report.md`. "Unit" tests run with `node --test`; "Browser" tests are clicked through in Chrome in demo mode.

| ID | Type | Test | Pass when |
|---|---|---|---|
| P1 | Unit | Default plan | Exactly 3 messages, 2 comments, 1 post; every item on a Mon–Fri date inside the plan week |
| P2 | Unit | Which week | Mon/Tue/Wed → this week's Monday; Thu/Fri/Sat/Sun → next Monday (IST) |
| P3 | Unit | Tags and links | Post tags follow proof/setback/observation; messages tagged outreach and linked to out:referral / out:hm alternately |
| P4 | Unit | Counts change keeps status | Changing counts keeps the status of items whose id survives |
| P5 | Unit | Chat parser | "2 posts" → posts 2; "no comments" → comments 0; "more outreach" → messages +1; "fewer posts" → posts −1; "posts at 8am" → post time 08:00; "comments at 1:30 pm" → 13:30; unrelated text → not understood, no change |
| P6 | Unit | Bounds | "20 posts" → 5; "-3 messages"/"no messages" → 0 |
| P7 | Unit | Follow-up due | Message sent 5 days ago, no reply → due; 4 days → not due; replied → not due |
| P8 | Unit | .ics | Valid VCALENDAR with one VEVENT per item; 09:00 IST on 2026-10-19 → DTSTART 20261019T033000Z; commas/semicolons/newlines escaped; lines ≤ 75 octets |
| P9 | Unit | Google link | `dates=20261019T033000Z/20261019T034500Z`, title present |
| P10 | Browser | Tab and default view | "This week" tab shows 6 items on the right days with tag, time and Draft status |
| P11 | Browser | Status flow | Schedule → Scheduled; Mark posted/sent → done; Back to draft works |
| P12 | Browser | Move | Moving an item to another day and time shows it there and survives reload |
| P13 | Browser | Chat | Typing "2 posts, no comments" updates the plan to 3 messages, 0 comments, 2 posts with a reply line |
| P14 | Browser | Month view | Month grid shows the plan items on their dates |
| P15 | Browser | Downloads | Per-item and whole-week .ics download; Google link opens with the right title |
| P16 | Browser | Reply tracking | Sent message shows "Got a reply" toggle |
| P17 | Browser | Phone width | At 390px days stack, no horizontal page scroll |
| P18 | Browser | Clear | "Clear everything" removes the plan |
| P19 | Build | Checks | `tsc`, `eslint`, `next build` clean; existing flow still passes |

# Acceptance tests: ask ladder

| ID | Type | Test | Pass when |
|---|---|---|---|
| L1 | Unit | Schema | `GenerateReply` requires `outreach.stranger` and `outreach.alumni`; demo output validates |
| L2 | Unit | Stranger rung | Demo stranger draft, blanks filled, gets "Ready to send" from the checker as a stranger message, never contains "refer", ≤ 70 words |
| L3 | Unit | Alumni rung | Demo alumni draft, blanks filled, mentions "15-minute", contains no referral ask, "Ready to send" as alumni, ≤ 80 words |
| L4 | Unit | Referral rung | Demo referral draft, blanks filled, has job ID, resume, one ask and an easy out; "Ready to send" as knows-me |
| L5 | Browser | Picker switches the draft | Stranger shows the question draft, alumni the 15-minute chat draft, knows-me the referral draft; follow-up always shown |
| L6 | Browser | Old results | A saved result without the new drafts shows the rewrite prompt, no crash |
| L7 | Build | Checks | tsc, eslint, unit tests, e2e (plan + ladder) and next build clean |

# Acceptance tests: Connect Coach

| ID | Type | Test | Pass when |
|---|---|---|---|
| C1 | Unit | Who to look for | Demo gives 5–8 cards; every search link is a LinkedIn people search with the card's keywords; a full name typed in the "who to reach" answer ("Rahul Sharma") appears in no card |
| C2 | Unit | Note budget | Default 3; two noted sends this IST month → 1 left; a noted send last month or a send without a note doesn't count; never below 0 |
| C3 | Unit | Weekly cap | 5 people added this IST week → can't add; people added last week don't count |
| C4 | Unit | Tracker states | to_find → sent → accepted → messaged → replied and back; follow-up due at 5 days after messaged, not at 4, not after replied |
| C5 | Unit | Demo note | ≤ 200 characters, starts "Hi [[", no "refer", no job ask |
| C6 | Unit | Screenshot validation | png/jpeg/webp up to 4 MB accepted; gif or a larger file rejected with a clear message |
| C7 | Browser | Cards | Connect tab shows 5–8 cards, each with a LinkedIn people-search link |
| C8 | Browser | Note from pasted text | Note shown with a character count ≤ 200; copy locked until blanks are filled |
| C9 | Browser | Screenshot in demo mode | Uploading an image shows "needs an AI key" message, no crash |
| C10 | Browser | Tracker + budget | Adding a person shows To find; marking Sent with a note lowers "notes left"; Accepted shows the ladder hint; survives reload |
| C11 | Browser | Cap | With cap 1 and one person added this week, Add is disabled with a message |
| C12 | Browser | Clear + phone | "Clear everything" removes people; no horizontal scroll at 390 px |
| C13 | Build | Checks | tsc, eslint, unit tests, browser tests, next build clean |

# Acceptance tests: interview v2 and Story Vault (vertical 1)

Unit tests live in `tests/interview.test.mts`, `tests/vault-db.test.mts`, `tests/pdf.test.mts` and `tests/personas.test.mts`. Browser tests are in `tests/e2e-interview.mjs` (demo mode, `LYNKR_INTERVIEW=v2`).

| ID | Type | Test | Pass when |
|---|---|---|---|
| I1 | Unit | Bank | Every question has text, an example, a rephrase, 2+ extra examples, what it feeds, and where it's saved; ids unique; fresher, experienced and networker each have 10+ core questions; salary never asked |
| I2 | Unit | Order | The first question is A1, worded for the bucket; networkers get no job-search questions (B5, B6, B7) |
| I3 | Unit | Skip and park | Skip refused on core and enrichment, allowed on sensitive; "Later" only on enrichment; "Not sure yet" allowed anywhere |
| I4 | Unit | Park ladder | A parked core question comes back once at the end; parked again it's listed as unresolved and the interview still finishes |
| I5 | Unit | Stop rule | Done when every core question is answered or unresolved; unanswered enrichment is in the Later list |
| I6 | Unit | Follow-up limit | At most two follow-ups per core question; none on enrichment or chip questions |
| I7 | Unit | Estimate | A win with no number gets one estimate follow-up; "not measured" accepted; an estimate is labelled "(estimate)" |
| I8 | Unit | Should probe | B4 asked only when a goal answer sounds like a "should" |
| I9 | Unit | Examples | An unedited example is refused and never becomes a fact; chip picks are not examples |
| I10 | Unit | Idempotent | Saving the same answer twice keeps one row; editing a main answer drops its stale follow-ups |
| I11 | Unit | Progress | 0% with no import; above 0% after the import |
| I12 | Unit | Brief | Chips map to field, goals and weekly time; a skipped "does your employer know?" stays private |
| I13 | Unit | Facts | New kinds (goal, target_company, warm_path, offer, must_have) and confidence (example, number, "I did") |
| I14 | Unit | Reflection | One line quoting the answer; stock praise rejected |
| I15 | Unit | Old saves | A save from before v2 loads, with private search on and no confidence |
| I16 | Unit | Account isolation | User A cannot read, change or delete user B's brief, facts, answers, drafts or plan items |
| I17 | Unit | Delete my data | Removes every row for the user in every Lynkr table and nothing for anyone else |
| I18 | Unit | Durable caps | Per-user daily caps hold across two app instances sharing one database |
| I19 | Unit | Cleanup | Dry run lists users inactive 12+ months without deleting; real run deletes only them; refused without the secret |
| I20 | Unit | PDF parser | 4 made-up LinkedIn PDFs give name, headline, About, experience, education and skills; a planted instruction is extracted as plain text only |
| I21 | Unit | Personas | 5 personas (2 fresher, 2 experienced, 1 networker) finish in demo mode with their expected facts and an estimated time under 15 minutes |
| I22 | Browser | Full flow | Bucket, import (paste), every question, reflection, live vault, summary, rating and first win, at 1280px and 375px |
| I23 | Browser | Keyboard and screen reader | Every control reachable by keyboard, labelled, focus visible; status updates announced |
| I24 | Browser | Switch | With `LYNKR_INTERVIEW=v1` the old interview runs unchanged (existing e2e) |
| I25 | Build | Checks | tsc, eslint, unit tests, both e2e runs and next build clean |
