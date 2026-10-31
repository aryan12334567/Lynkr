# Outreach evaluation (offline)

Run: 2026-10-29. `npm run eval:outreach` runs deterministic demo mode only, regardless of keys; no paid model was called. The AI path and live retrieval remain untested.

## Automated results

- 10 goals ? 7 fictional personas ? 3 relationships ? 4 channels = 840 combinations, 1,680 drafts.
- Draft guard failures: 0. This is an automated heuristic, not proof that every claim is true or appropriately cited.
- Placeholder failures: 0. Channel-limit failures: 0.
- Checker verdicts: 800 ?Looks ready for your review?; 880 ?Edit before sending?; 0 ?Do not send yet?. An edit verdict is a quality finding, not counted as a guard failure by the script.
- The script tests three brief-cleaning examples (page injection, selected-text injection, sensitive-topic text). The targeted unit tests also compare mock drafts after cleaning and test four sensitive sentences. This is a narrow regression sample, not a guarantee against all injection or sensitive details.

## Manual review of 20 sample drafts

A single assistant reviewer scored the 20 connection-note samples for one fictional persona and a stranger, across all ten goals and both versions. Scores are subjective (1 weak to 5 strong); they are not tester ratings. Specificity measures relevance of evidence and ask to the goal, not merely the presence of a name. These repeat the same persona to expose variation across goals; they are not a representative sample of users.

| Goal / version | Naturalness | Specificity | Draft |
|---|---:|---:|---|
| job / direct | 3 | 2 | Hi Riya, For our commerce fest I built an Excel and Power BI tracker for 25 stall sponsors and wrote all the formulas myself. What would you suggest someone focus on when learning about this work? |
| job / context | 2 | 2 | Hi Riya, I saw that you work as analyst at Example Co. What would you suggest someone focus on when learning about this work? |
| referral / direct | 3 | 2 | Hi Riya, For our commerce fest I built an Excel and Power BI tracker for 25 stall sponsors and wrote all the formulas myself. What would you suggest someone focus on when learning about this work? |
| referral / context | 2 | 2 | Hi Riya, I saw that you work as analyst at Example Co. What would you suggest someone focus on when learning about this work? |
| network / direct | 3 | 2 | Hi Riya, For our commerce fest I built an Excel and Power BI tracker for 25 stall sponsors and wrote all the formulas myself. What has been most useful to you in this work? |
| network / context | 2 | 2 | Hi Riya, I saw that you work as analyst at Example Co. What has been most useful to you in this work? |
| mentor / direct | 3 | 2 | Hi Riya, For our commerce fest I built an Excel and Power BI tracker for 25 stall sponsors and wrote all the formulas myself. What would you suggest someone focus on when learning this work? |
| mentor / context | 2 | 2 | Hi Riya, I saw that you work as analyst at Example Co. What would you suggest someone focus on when learning this work? |
| clients / direct | 3 | 1 | Hi Riya, For our commerce fest I built an Excel and Power BI tracker for 25 stall sponsors and wrote all the formulas myself. Would you be open to a conversation about your team's priorities? |
| clients / context | 2 | 1 | Hi Riya, I saw that you work as analyst at Example Co. Would you be open to a conversation about your team's priorities? |
| hiring / direct | 3 | 1 | Hi Riya, For our commerce fest I built an Excel and Power BI tracker for 25 stall sponsors and wrote all the formulas myself. Would you be open to a conversation about your work? |
| hiring / context | 2 | 1 | Hi Riya, I saw that you work as analyst at Example Co. Would you be open to a conversation about your work? |
| funding / direct | 3 | 1 | Hi Riya, For our commerce fest I built an Excel and Power BI tracker for 25 stall sponsors and wrote all the formulas myself. Would you be open to a conversation about your investment interests? |
| funding / context | 2 | 1 | Hi Riya, I saw that you work as analyst at Example Co. Would you be open to a conversation about your investment interests? |
| buy_business / direct | 2 | 1 | Hi Riya, For our commerce fest I built an Excel and Power BI tracker for 25 stall sponsors and wrote all the formulas myself. Would you be open to a confidential conversation about your business? |
| buy_business / context | 2 | 1 | Hi Riya, I saw that you work as analyst at Example Co. Would you be open to a confidential conversation about your business? |
| partner / direct | 3 | 1 | Hi Riya, For our commerce fest I built an Excel and Power BI tracker for 25 stall sponsors and wrote all the formulas myself. Would you be open to exploring a possible collaboration? |
| partner / context | 2 | 1 | Hi Riya, I saw that you work as analyst at Example Co. Would you be open to exploring a possible collaboration? |
| reconnect / direct | 2 | 1 | Hi Riya, For our commerce fest I built an Excel and Power BI tracker for 25 stall sponsors and wrote all the formulas myself. Would you be open to catching up? |
| reconnect / context | 2 | 1 | Hi Riya, I saw that you work as analyst at Example Co. Would you be open to catching up? |

## Findings and limitations

The generic ?I saw that you work as analyst? wording is awkward; the same question and proof recur in unrelated goals. Several business asks are weakly connected to the student?s evidence, and ?catching up? can imply a prior relationship for a stranger. The checker frequently asks for edits. The release-quality and naturalness goals are therefore not established; U3 needs revision and another evaluation before tester release.

The matrix supplies a fictional recipient and one project fact, so it does not cover missing facts, all real-world source combinations, or live model behaviour. The trace guard checks supported references and uses a conservative grounding heuristic; it cannot establish semantic truth. Safety tests exercise only the local brief cleaner and deterministic composer, not real model instruction following or retrieval.
