# B.C. Web Style Guide Checker

The B.C. Web Style Guide Checker is a Chrome and Microsoft Edge extension that reviews webpages against selected requirements and recommendations in the B.C. Web Style Guide.

Version 1.0.0 is the first beta release of the extension.

The checker supports content review. It does not replace editorial, accessibility, legal, policy, service-design or user-research judgement.

## Features

- Reviews one page in a browser side panel
- Offers a focused, finding-by-finding review
- Sorts findings by recommended priority or page order
- Separates editable CMS Lite content from shared templates
- Checks headings, links, documents, images, formatting, plain language and selected accessibility concerns
- Shows page structure, published metadata, content statistics and link information
- Checks HTTP link status when the reviewer grants website access
- Scans up to 100 pasted page addresses into one workbook
- Saves exact, rule-specific allowed terms
- Keeps reports and review position across tabs and browser restarts
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
3. Choose recommended order or page order.
4. Select **Review issues** or choose an issue type.
5. Review each finding and record decisions as needed.

The extension follows the current finding on the webpage during side-panel review. Turn off **Follow findings on page** when you want the page to remain still.

Use **Open full-page review** for a wider workspace. The larger workspace also contains batch scans and settings.

## CMS Lite pages

The extension recognizes these sites as CMS Lite:

- `www2.gov.bc.ca`
- `www2.qa.gov.bc.ca`
- `intranet.gov.bc.ca`
- `intranet.qa.gov.bc.ca`

A CMS Lite content scan reviews the page title and editable body. Shared navigation, footer and generated components are excluded. The delivered template and code can be included from **More scan options**.

## Allowed terms

Allowed terms are exact and rule-specific. An allowed term can address an approved formal name or familiar acronym without disabling unrelated checks.

For example, `BC Public Service` can be allowed for the **Write B.C. with periods** rule. `BC` by itself cannot be allowed for that rule. Structural, accessibility and sentence-case checks remain active.

## Feedback notes

The Feedback area lets beta testers collect several notes before contacting the maintainers. A note can describe an incorrect result, a missed issue, an extension problem or a suggestion.

The extension automatically captures a small context snapshot when a note is created. This can include the page title and address, detected site profile, scan scope, page section, related finding, extension version and browser version. Testers can exclude page context from any note before exporting it.

Feedback notes stay on the tester's device. **Create feedback email** opens a pre-addressed draft containing the saved notes. The tester must review the draft and select **Send** in their email application. Copy and CSV export are also available.

## Reports and batch scans

The checker can produce:

- A plain-language copied report
- An action-report CSV
- An Excel workbook with selected sheets for findings, site-wide issues, page inventory, metadata, links and the scan log

Metadata is recorded once per page. Repeated findings are grouped by issue type.

## Privacy and permissions

Content checks run locally using fixed JavaScript rules. The extension does not use AI and does not send page text to an analysis service.

Reports, decisions, allowed terms, feedback notes, settings and review position are stored in local extension storage. Feedback remains local until the tester copies, exports or creates an email.

Link and asset checks contact destination websites directly without browser cookies or sign-in details. The browser asks for website access before those checks run. Batch scans open temporary background tabs in the browser's normal browsing context.

## Repository structure

- `manifest.json` — extension metadata and permissions
- `checker-core.js` — page extraction and review rules
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
