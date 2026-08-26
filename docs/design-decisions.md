# Product and design decisions

## Product goal

Help a reviewer understand a webpage, decide what needs attention and finish an audit without losing their place. The interface should remain calm when a scan contains many findings.

## Review structure

- Keep the side panel centred on the current page.
- Present Findings and Page details as the two primary choices after a scan.
- Group repeated findings by issue type.
- Review one occurrence at a time in one continuous sequence.
- Offer a type-by-type sequence and a true page-order sequence. Page order may split repeated issue types.
- Preserve review position across pages, tabs and the larger workspace.
- Keep common filters visible and place detailed filters in a dialog.
- Use the larger workspace for batch scans, settings and wider reviews.
- Group repeated findings in exports and record metadata once per page.

## Feedback structure

- Keep feedback in a separate utility screen so it does not compete with page review.
- Let testers record notes from a finding or from the general Feedback area.
- Capture page and diagnostic context automatically.
- Let testers exclude page context from individual notes.
- Save notes locally until the tester copies, exports or creates an email.
- State clearly that creating an email opens a draft and that the tester must send it.
- Encourage one feedback email after each site review or testing day.

## Usability safeguards

- Advance after Ignore or Resolve and provide Undo.
- Keep Previous available across issue types.
- Follow the active finding on the webpage during side-panel review.
- Keep the active page highlight until the reviewer moves, closes the review or clears it.
- Warn when a saved review belongs to an earlier page load.
- Preserve navigation layout at the end of an issue type.
- Keep exact-term exceptions rule-specific and case-sensitive.
- Keep the manual checklist on the Page details overview.
- Identify the full-page review as a separate browser tab.
- Reflect what CMS Lite editors can change.

## Rule confidence and context

- Use **Fix** only when the checker can identify a clear problem and a safe correction.
- Use **Check** when a pattern probably conflicts with the guide but may have a valid exception.
- Use **Review** when meaning, audience knowledge or professional context requires human judgement.
- Show the complete surrounding evidence and highlight the exact wording under review.
- Keep allowed terms exact, rule-specific and unable to disable unrelated checks.
- Gate English writing and readability rules to English-language pages.
- Preserve proper names, quotations, addresses, technical notation and space-limited formats where the available context identifies them.
- Treat a finding as overlapping when one edit resolves every contributing rule. Keep separate findings when the remedies or decisions can differ.
- Keep the more specific finding and add the secondary reason as a diagnostic when findings share one remedy.

The checker leaves meaning-heavy decisions—such as whether an image is decorative, whether an acronym is familiar or whether `Dr.` identifies a medical doctor—to the reviewer.

## Visual system

- BC Sans for interface text
- B.C. navy for headings and primary actions
- B.C. gold for focus and small accents
- Cool blue tints for information and active surfaces
- Warm neutral borders and backgrounds
- Red, amber and blue rails for Fix, Check and Review
- Restrained corners, short transitions and visible keyboard focus

## Privacy and permissions

- Run content checks locally.
- Store review state and feedback in extension storage.
- Omit browser credentials from link and asset requests.
- Request broader website access only when required by the chosen check.
- Keep feedback on the device until the tester chooses an export or email action.
