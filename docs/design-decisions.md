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
- Keep individual findings as the authoritative export data. Derive grouped issue and page/site summaries from those findings, and record page metadata once per page.

## Audit export structure

- Use the same mental model for one page and many pages: automated review profile → page evidence → grouped issue summary → individual finding detail.
- Keep **Findings detail** at one row per stored finding. If the scanner deliberately collapses exact duplicates, retain the number in an **Occurrences** field rather than expanding invented rows.
- Keep grouped issue types separate from finding counts. Never present a grouped row count as the number of findings.
- For a single page, keep workbook choices to **Full audit** and **Customize workbook**. Full audit contains **Summary**, **Issue summary**, **Findings detail**, **Page details**, **Links** and **Metadata**; Customize workbook allows explicit sheet selection.
- Offer link checking for a single-page export only when at least one selected sheet uses link-check findings, coverage or results. A metadata-only custom workbook should download directly without asking to check links.
- For batch scans, make **Full audit** the normal workbook: **Summary**, **Pages**, **Site-wide findings**, **Page issue summary**, **Findings detail**, **Links**, **Metadata** and **Scan log**. Keep **Customize workbook** for explicit sheet selection.
- Keep batch export choices to **Full audit** and **Customize workbook**. Put sheet-by-sheet controls behind Customize so flexibility does not turn the normal workflow into a checkbox wall.
- Batch link checking is optional. Scan pages first, deduplicate remote destinations across the batch, check each unique destination once and map the result back to each page. Keep link-check coverage and uncertainty visible in the workbook.
- Use six page-review areas: Page information, Plain language, Structure and navigation, Accessibility, Links and documents, and Style and proofreading.
- Use **Review first**, **Needs attention**, **Worth checking** and **Nothing flagged** to prioritize human review. Do not calculate an overall health, compliance, risk or quality score.
- Treat **Nothing flagged** as a neutral automated result, never as a pass. Colour may reinforce an attention label but must not carry meaning by itself.
- Rank batch pages for the summary by Review first areas, then Needs attention areas, then high-confidence Fix findings, then Worth checking areas, with title as a stable tie-break. Present the derived result as a **Review priority** plus concrete reasons; do not expose counts of abstract “review-first areas,” display a numeric rank or call the first page the worst page.
- Keep batch summaries compact. Show at most 10 pages requiring attention on the Summary sheet and direct reviewers to the complete filterable Pages sheet.
- Keep failed scans visible in coverage counts, the Pages sheet and the Scan log.
- Use one header row on data sheets, filters, wrapped text, descriptive sheet names and no merged cells inside datasets. Avoid frozen panes because they can reduce usable space at high zoom and in small windows.
- Make HTTP and HTTPS values in workbook cells real external hyperlinks rather than styled text alone.
- Do not use pie, donut, gauge or 3-D charts. Add visuals only if later testing shows they improve decisions beyond the tabular summary.

## Feedback structure

- Keep feedback in a separate utility screen so it does not compete with page review.
- Let testers record notes from a finding or from the general Feedback area.
- Capture page and diagnostic context automatically.
- Let testers exclude page context from individual notes.
- Save notes locally until the tester copies, exports or creates an email.
- State clearly that creating an email opens a draft and that the tester must send it.
- Never truncate a feedback email. Build email batches from the largest complete prefix that fits below the conservative encoded `mailto:` safety ceiling. If newer notes overflow, keep them saved for the next batch and require the current safe batch to be sent before more notes are added.
- Opening an email draft is not proof it was sent. Archive exactly the prepared notes only after the reviewer confirms **I sent it**. Sent notes do not count toward future email batches and remain available for copy/export.
- Let **Copy report** copy unsent notes, all notes or an explicit selection. Copying never changes sent status.

## Usability safeguards

- Advance after Ignore or Resolve and provide Undo.
- Keep Previous available across issue types.
- Follow the active finding on the webpage during side-panel review.
- Keep the active page highlight until the reviewer moves, closes the review or clears it.
- Warn when a saved review belongs to an earlier page load.
- Preserve navigation layout at the end of an issue type.
- Keep exact-term exceptions rule-specific and case-sensitive. A narrowly scoped proofreading exception may be page-only and case-insensitive when the action explicitly means “ignore this wording on this page.”
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


## Readability and proofreading heuristics

- Keep the page-wide reading-grade review at Grade 9 or higher; the Web Style Guide target remains Grade 8.
- Define structural sections with H2 to H6 headings. Headings define boundaries but are not included in the reading-grade calculation.
- Include list items with 5 or more words as readability units so sentence-like bullets still affect the estimate; exclude shorter fragment lists from the grade calculation.
- Require at least 2 readability units before creating a section-level reading finding. Flag 40 to 74 included words only at Grade 12 or higher, and 75 or more included words at Grade 10 or higher.
- Report each qualifying difficult section as its own finding even when the page-wide grade is also high. Suppress only the redundant case where the page is effectively one analysed section and the section finding would add no useful location information.
- Use a conservative 200-word internal review trigger for meaningful authored content without an H2 to H6 break. Count substantive list content, but treat alerts and supported accordions as separate analysis segments so they do not inflate surrounding sections.
- Keep proofreading deliberately narrow and deterministic. Do not add general spellchecking, grammar correction or AI-generated writing advice to the core checker.

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
- Store review state and feedback in extension storage restricted to trusted extension contexts.
- Retain single-page reports for no more than 168 hours. A successful rescan of the same canonical page replaces its earlier single-page report regardless of review scope; a failed or cancelled scan does not. Retain decisions and notes only for findings still present in a saved report.
- Retain incomplete batch state for 7 days after its last saved activity and completed batch state for 30 days or until a new batch begins. Retain unsent feedback until it is sent or deleted and sent feedback for 30 days after it is marked sent.
- Provide separate, confirmed controls for deleting page reviews, batch state, unsent feedback, sent feedback, allowed terms and saved page preferences.
- Omit browser credentials from ordinary public link and asset requests. Permit credentials only for the existing narrowly supported CMS Lite, QA, SharePoint and intranet checks, using access the reviewer has already established without reading or storing sign-in information.
- Request website access only for the current page or destinations discovered by the selected page or batch scan. Remove the earlier all-sites option and revoke its legacy wildcard grant when this update is installed.
- Never send in-page fragment links through the network checker. Validate fragment targets from the scanned document instead.
- Keep ordinary remote checks anonymous (`credentials: "omit"`). Attempt redirect chains with `redirect: "follow"` when the resulting origins are covered by granted website access, then fall back to manual redirect handling when access is insufficient. Same-origin redirects should not require broader access; an unverified cross-origin redirect is uncertainty, not a broken-link finding.
- Do not request links with embedded credentials, explicit local/private/link-local/reserved destinations or action-like authenticated paths. Report them as not checked for safety so the reviewer can decide whether to open them. This is a syntactic control, not DNS rebinding protection; the pilot retains the residual risk that a public hostname or opaque redirect can resolve internally.
- Do not request `file:` access. The extension reviews HTTP and HTTPS pages only.
- Neutralize spreadsheet-formula prefixes in CSV cells while preserving the original visible text.
- Treat `www2.qa.gov.bc.ca` as a specific B.C. authoring environment: for link verification, derive the matching `www2.gov.bc.ca` address by changing only the hostname and report the result explicitly as a live-version check.
- A failed or blocked automated request is not proof of a broken link. Reserve broken-link findings for reliable 404 or 410 responses from the destination being checked.
- Keep unsent feedback on the device until the tester sends or deletes it. Keep sent feedback available locally for 30 days for copying, export or restoration.
- Persist large batch state after every scanned page so a closed/reloaded workspace or another page review cannot turn a partial batch into a false completion. Use extension unlimited storage for this audit-state persistence rather than silently failing at the default local-storage quota.
