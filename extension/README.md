# Lynkr extension

Build with `npm run ext:build`, then load `extension/dist` as an unpacked extension in Chrome. Pair it from Lynkr using the extension pairing control. The extension accepts pairing from `lynkr.cloud`, `www.lynkr.cloud`, and local development on port 3000; configure `LYNKR_EXT_ID` to match the installed extension ID for the API.

The side panel can find contacts, generate and edit outreach drafts, copy or insert drafts into the focused editable field, update a contact stage, and save the active LinkedIn profile URL after an explicit action. It does not scrape page content or send messages. Selected text is held only in memory and selected-text drafting is not yet connected.

Run `npm run ext:build` followed by `npm run test:ext` to check the manifest and insertion behavior against the local fixture in headless Chrome. These checks do not cover the complete extension pairing or side-panel workflow.
