# Lynkr extension

Build with `npm run ext:build`, then load `extension/dist` as an unpacked extension in Chrome. Pair it from Lynkr using the extension pairing control. The extension accepts pairing from `lynkr.cloud`, `www.lynkr.cloud`, and local development on any port of `localhost` or `127.0.0.1`; set `LYNKR_EXT_ID` to the installed extension's ID so the API accepts its requests.

## What it reads (KD1)

- The text you select, when you choose "Write with Lynkr" from the right-click menu. Chrome gives the extension access to that one tab only for that click (`activeTab`), and the extension reads only the selection. The selection stays in memory, is sent once with your draft request, and is never saved.
- The current tab's address, only when you press "Save this profile link", and only `linkedin.com/in/` addresses are accepted.

There are no `content_scripts` and no `host_permissions` for linkedin.com. The extension never opens, scrolls or clicks anything on LinkedIn and never sends a message, comment or connection request. Insert types the draft into the box you clicked; if that fails, the draft is copied and the panel says to paste it.

## Side panel

- **Not paired:** a card that opens Lynkr to connect.
- **Unpaid:** an upgrade card. No draft, save or record route is called.
- **Paired:** contact picker (recent first, with search), goal and intent, draft versions with Insert and Copy, notes left, "Save this profile link", selected-text drafting, and outcome taps.

### Selected text

"Write with Lynkr" opens the panel with the selected text. Choose a contact, then either "Write to this contact about it" or "Reply to this", and press Write draft. The panel sends `selection` and `selectionUse` (`contact` or `reply`) with the draft request; the draft route does not accept these fields yet, so until it does a draft written from a selection is refused (HTTP 400) and the panel says so; writing without the selection works. There is no "Comment on this" choice here: the Commenter owns that chooser.

### Outcome taps (R40)

The panel offers taps for the chosen contact's current stage only:

| Stage | Taps |
|---|---|
| to contact | Invite sent, Message sent, Close |
| invited | Accepted, Message sent, Close |
| accepted | Message sent, Meeting booked, Close |
| messaged | Reply received, Meeting booked, Close |
| replied | Meeting booked, Goal reached, Close |
| meeting | Meeting done, Goal reached, Close |
| finished | none |

Meeting booked takes a date and time in IST. Meeting done asks first whether it happened (Yes, No-show, Moved); a rating and a next step are optional, and Moved asks for the new time. Every tap goes to `POST /api/ext/outcome`, which records it through the same write path as the web app. Success and errors appear in the panel's status line. To undo a wrong record, use the timeline in Lynkr; the panel says "Undo it in Lynkr".

## Tests

`npm run ext:build` then `npm run test:ext` runs the manifest checks, the panel states, Insert, the profile link, the outcome taps and the context-menu flow in Chrome against `tests/fixtures/linkedin-like.html` only; the API is answered by the test. The pairing handoff from a real Lynkr page is not covered. Set `LYNKR_BROWSER` to use a different Playwright channel.

## Tester install (no Chrome Web Store)

1. `npm run ext:build` then `npm run ext:zip` gives `extension/lynkr-extension-tester.zip`.
   For a preview, build with the preview address so the extension may talk to it and be paired from it:
   `LYNKR_EXT_EXTRA_ORIGINS="https://<your-preview>.onrender.com" npm run ext:build` (https origins only).
2. The tester unzips it, opens `chrome://extensions`, switches on Developer mode and chooses Load unpacked.
3. In Lynkr, use "Connect the Chrome extension" on the Outreach page and paste the extension ID Chrome shows.

A store build never carries a preview address: the committed manifest lists only lynkr.cloud and localhost.
Chrome may show a "developer mode extensions" notice and does not update an unpacked extension by itself.
