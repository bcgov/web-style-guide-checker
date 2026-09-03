# B.C. Web Style Guide Checker

The B.C. Web Style Guide Checker is a Chrome and Microsoft Edge extension that reviews webpages against selected requirements and recommendations in the B.C. Web Style Guide.

Version 1.3.2 combines security and data-retention controls with conservative structural, readability and proofreading checks. It is designed to improve useful coverage without turning contextual editorial judgement into automatic fixes.

The checker supports content review. It does not replace editorial, accessibility, legal, policy, service-design or user-research judgement.

## Features

- Reviews one page in a browser side panel
- Offers a focused, finding-by-finding review
- Reviews findings by issue type or in the order they appear on the page
- Separates authored CMS Lite content, including supported accordions and supplemental components, from shared templates
- Checks headings, links, documents, images, formatting, plain language and selected accessibility concerns
- Reviews long paragraphs, substantial content without heading breaks and difficult sections as separate findings so page-wide averages do not hide them; alerts and supported accordions are analysed as separate content segments
- Includes a small high-confidence Proofreading category for obvious patterns without using AI or a general spelling service
- Reviews updated guidance for government names, headings, alt text, dates, times, measurements, currency, education terms and Canadian spelling
- Shows page structure, published metadata, content statistics and link information
- Checks whether web links work when the reviewer grants website access; ordinary public checks are anonymous, while narrowly supported CMS Lite, QA, SharePoint and intranet checks can use the reviewer’s existing browser access
- Scans up to 100 pasted page addresses into one workbook
- Exports single-page and batch audit workbooks with a review summary, page-level attention profile, grouped issue views and one row per stored finding
- Saves exact, rule-specific allowed terms
- Keeps reports and review position across tabs and browser restarts
- Warns when a saved review belongs to an earlier page load
- Collects private beta feedback notes locally and creates one pre-addressed feedback email

## Install the extension

1. Download and unzip the release package.
2. Open `chrome://extensions` or `edge://extensions`.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Select the unzipped `web-style-guide-checker` folder.
6. Pin **B.C. Web Style Guide Checker**.

Select the extension icon to open the checker in the browser side panel.

## Review a page

1. Open the webpage you want to review.
2. Choose the review scope and select **Check page**.
3. Choose **By issue type** or **In page order**.
4. Select **Review issues** or choose an issue type.
5. Review each finding and record decisions as needed.

The extension follows the current finding on the webpage during side-panel review and keeps that highlight visible until you move to another finding or leave the review.

Use **Open full-page review** for a wider workspace. The larger workspace also contains batch scans and settings.

**Rescan page** returns to the scan-options screen with the previous choices selected so you can confirm or change the scope before checking the page again.

## CMS Lite pages

The extension recognizes these sites as CMS Lite:

- `cmslite.gov.bc.ca`
- `www2.gov.bc.ca`
- `www2.qa.gov.bc.ca`
- `intranet.gov.bc.ca`
- `intranet.qa.gov.bc.ca`

On published and QA pages, a CMS Lite content scan reviews the page title and authored page content. It also includes supported authored accordions, alerts, right-column and supplemental components that are present in the published page markup, including collapsed accordion content. Shared navigation, footer, breadcrumbs and generated template components are excluded. The delivered template and code can be included from **More scan options**.

On `cmslite.gov.bc.ca` editing screens, the checker scans non-empty CKEditor fields instead of the surrounding CMS interface. Findings identify the CMS Lite tab, repeated component when applicable and field, such as **Topic → Body** or **Alerts → Alert 1 → Message**. **Show on page** opens the matching CMS Lite tab and collapsed component before scrolling to and highlighting the editor. A published or QA scan is still useful for checks that depend on the final rendered page.

## Allowed terms

Allowed terms are exact and rule-specific. An allowed term can address an approved formal name or familiar acronym without disabling unrelated checks. The Proofreading check for `pubic` also offers a page-only ignore option for legitimate anatomical content.

For example, `BC Public Service` can be allowed for the **Write B.C. with periods** rule. `BC` by itself cannot be allowed for that rule. Structural, accessibility and sentence-case checks remain active.

## Feedback notes

The Feedback area lets beta testers collect several notes before contacting the maintainers. A note can describe an incorrect result, a missed issue, an extension problem or a suggestion.

The extension automatically captures a small context snapshot when a note is created. This can include the page title and address, detected site profile, scan scope, page section, related finding, extension version and browser version. Testers can exclude page context from any note before exporting it.

Feedback notes stay on the tester's device. Unsent notes remain until the tester sends or deletes them. Opening a draft does not mark anything sent: the tester confirms **I sent it** before those notes are archived. Archived notes expire after 30 days and do not count toward the next email batch. The extension keeps each email batch below a conservative encoded `mailto:` size so it never intentionally creates a truncated feedback email. **Copy report** can copy unsent notes, all notes or a selected subset; CSV export remains available.

## Reports and batch scans

For one page, **Full audit** is the default Excel workbook and contains:

- **Summary** — page identity, link-check coverage and results, key page measures and a six-area automated review profile
- **Issue summary** — one row per grouped issue type and status
- **Findings detail** — one row per stored finding, including location, evidence, action, guidance and occurrence count
- **Page details** — page-level counts and scan measures
- **Links** — the page link inventory and link-check results when available
- **Metadata** — published page metadata

The only other workbook choice is **Customize workbook**, which keeps sheet-by-sheet choices available without showing a large checklist by default. **Download findings CSV** is available as a separate button, and detailed findings can still be copied. Link checking is offered only when the selected workbook sheets actually use link-check findings, coverage or results; a metadata-only custom workbook does not require a link check.

For batch scans, **Full audit** contains **Summary**, **Pages**, **Site-wide findings**, **Page issue summary**, **Findings detail**, **Links**, **Metadata** and **Scan log**. **Customize workbook** allows an explicit sheet selection when needed. Batch scans can optionally check each unique web destination once after all pages have been scanned, then map that result back to every page that uses the destination. Website access is requested only for destinations found in the batch. Failed scans remain visible in the Pages sheet and Scan log. Incomplete batches expire 7 days after their last saved activity. Completed batches expire after 30 days or when a new batch begins.

The **Pages** sheet uses six review areas: Page information, Plain language, Structure and navigation, Accessibility, Links and documents, and Style and proofreading. Each area is labelled **Review first**, **Needs attention**, **Worth checking** or **Nothing flagged**. These are review-priority signals from automated findings, not quality ratings or compliance scores. **Nothing flagged** means the checker did not flag a rule in that area; it does not mean the page passed an accessibility or quality review.

Detailed findings are the authoritative evidence layer. Grouped and site-wide sheets are derived from those findings. Exact duplicate occurrences that the scanner intentionally collapses remain visible through the **Occurrences** field. Workbook URLs are clickable. Link status is reported only when a network check has been completed; unchecked links are never treated as working. Full link inventories continue to include in-page, email and telephone links after a web-link check runs.

## Privacy and permissions

Content checks run locally using fixed JavaScript rules. Page content, findings and reports are not sent to an external analysis service, AI system or the maintainers. Information leaves the checker only when the tester chooses to copy, export or include it in feedback. The extension retrieves a small release-status file without including page content.

Reports, decisions, allowed terms, feedback notes, settings and review position are stored in local extension storage that is restricted to trusted extension pages. A saved single-page report expires after 168 hours, and the newest successful scan of the same page replaces the earlier report. Decisions and notes are retained only while their findings remain in a saved report. Unsent feedback remains until sent or deleted; sent feedback expires after 30 days. Incomplete batch state expires after 7 days and completed batch state after 30 days. Settings provides separate controls for deleting each category of saved data.

Link and asset checks contact destination websites directly, which receive a normal browser request. Ordinary public requests omit browser credentials. For supported CMS Lite, QA, SharePoint and intranet destinations, the checker can use access already established in the current browser session without reading or storing sign-in information. Authenticated URLs that look like state-changing actions are not requested. In-page fragments are checked locally, and links containing embedded credentials or explicit local, private, link-local or reserved destinations are not requested. Redirects are followed when the extension has website access to the resulting destination; a redirect whose final destination cannot be safely verified is reported as uncertain rather than broken. The browser asks only for access to websites discovered by the selected page or batch scan. Batch scans open temporary background tabs in the browser's normal browsing context. Local `file:` pages are not supported and receive a specific explanation in the scan view.

CSV exports prefix cells that could otherwise be interpreted as spreadsheet formulas. Workbook and CSV output should still be handled according to the sensitivity of the scanned content.

## Repository structure

- `manifest.json` — extension metadata and permissions
- `checker-core.js` — page extraction and review rules
- `cms-lite-editor.js` — CMS Lite editor field mapping and reveal behaviour
- `sidepanel.html`, `sidepanel.css`, `sidepanel.js` — side panel and full-page workspace
- `background.js` — extension startup and side-panel behaviour
- `fonts/` — bundled BC Sans files and font licence
- `icons/` — extension icons
- `docs/` — product and design decisions
- `tests/` — automated build and rule checks

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

## Licence

The bundled BC Sans font files are distributed under the licence in [`fonts/LICENSE_OFL.txt`](fonts/LICENSE_OFL.txt).

A licence for the extension source has not yet been added. Repository owners should choose and add an appropriate source-code licence before inviting reuse outside the project.
