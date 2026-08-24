# B.C. Web Style Guide Checker 3.3

Version 3.3 is a redesigned Chrome and Edge extension for reviewing web pages against the B.C. Web Style Guide. It keeps the side panel focused on the current task and moves batch work, settings and wider reviews into a full-page workspace.

## Install it

1. Unzip the package.
2. Open `chrome://extensions` or `edge://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked**.
5. Select the unzipped `bc-web-style-checker-v3.3` folder.
6. Pin **B.C. Web Style Guide Checker 3.3**.

Select the extension to open it in the browser side panel.

## Review one page

1. Open the page you want to review.
2. Select the review scope and choose **Check page**.
3. Choose recommended order or page order, then select **Review issues** or choose an issue type from the list.
4. Review one occurrence at a time.
5. Use **Next** and **Previous** to move through the remaining occurrences.

Ignoring or resolving a finding advances to the next occurrence. A confirmation remains above the new finding and offers **Undo**, so the change is visible without interrupting the review.

Guided review is one continuous sequence. **Previous** moves back to the exact finding shown before it, including across issue types and after an item was ignored or resolved.

Guided review follows each finding on the live page by default. It scrolls to and highlights the referenced content while keyboard focus stays in the checker. Turn off **Follow findings on page** when you want the page to remain still.

The compact bar at the top of Findings provides one-tap filters for Fix, Check and Review. Review order stays beside the **Review issues** button, while the Filter dialog contains the less common filters. **Skip to next issue type** leaves a repeated pattern quickly. At the end, the navigation changes to **Return to findings** without shifting the buttons above it.

## Page details

The separate **Page details** tab provides focused views for:

- Heading hierarchy, with CMS-generated accordion headings shown separately
- Images and alt text
- Links, assets and individual link-check results
- Published metadata and SEO fields
- Content statistics
- Temporary page overlays for headings, alt text and link destinations

The manual review checklist appears once on the Page details overview.

## Larger workspace

Open the extension menu and choose **Open full-page review** to open a wider two-column review in a new browser tab. **View on original page** switches back to the scanned page and highlights the finding. The workspace also contains:

- **Batch scans** for up to 100 pasted web addresses
- **Settings** for website access and exact allowed terms

The side panel and workspace use the same saved report and review position.

## CMS Lite

These sites are recognized as CMS Lite:

- `www2.gov.bc.ca`
- `www2.qa.gov.bc.ca`
- `intranet.gov.bc.ca`
- `intranet.qa.gov.bc.ca`

A CMS Lite content scan checks the page title and editable body. Shared navigation, footer and generated components are excluded. The visible page H1 can be included when it sits immediately outside the editable body. CMS-generated accordion headings are separated from authored headings and excluded from the **On this page** comparison.

CMS Lite template tracking pixels and the generated `/icons/list.svg` image used near **More topics** are excluded from image alt-text findings and image counts.

The delivered template and code can be included from **More scan options**.

## Allowed terms

Allowed terms are exact and rule-specific. For example, `BC Public Service` can be allowed for the **Write B.C. with periods** rule without disabling sentence case, headings, accessibility or other checks.

The extension proposes a complete nearby formal name when possible. A personal term may contain 1 to 8 words and must include the exact flagged text. Single-word brands such as `StrongerBC` and acronyms such as `TV` are supported. `BC` by itself is rejected for the province-abbreviation rule. The match remains exact, case-sensitive, rule-specific and limited to one website or every website. Matching findings leave the current guided-review queue as soon as the term is saved. Built-in names include BC Public Service, BC Hydro, BC Ferries, Service BC, WorkBC and DataBC.

Structural, accessibility and sentence-case rules cannot be disabled with an allowed term.

## Reading level

The estimated Flesch–Kincaid grade remains visible in Page details. A review finding is raised at Grade 9.0 or higher.

## Link and asset checks

The link checker processes every unique HTTP and HTTPS destination on the page. Selecting **Check all links** requests access to the linked websites and begins checking after the browser prompt is approved. If access is declined, the results clearly say that no links were checked. It uses four requests at a time and can be paused or stopped. Individual results show the link text, page location, full destination and status.

Website access can be allowed for the linked sites on one page or for all websites. Requests omit cookies and browser sign-in details. Some destinations may block automated checks, require a signed-in session or rate-limit requests; those results are labelled separately from broken links.

Document links are checked for file type and size. A label such as `(PDF, 271 KB)` receives the specific instruction to remove the space before `KB`. When website access is available, the declared type and size can also be compared with the server response.

## Reports and exports

The copied report and action-report CSV group repeated findings by issue type. They use plain-language columns such as **Where on the page**, **Why it matters** and **Recommended action**.

Excel workbooks can include any of these sheets:

- Action report
- Site-wide issues for multi-page batches
- Page inventory
- Metadata
- Links
- Scan log

Metadata is recorded once per page. It is not repeated on every finding row.

## Privacy

Content rules run locally in the browser using fixed JavaScript checks. The extension does not use AI and does not send page text to an analysis service.

Reports, review decisions, notes, allowed terms, domain settings and review position are saved in local extension storage. Link and asset checks contact destination websites directly without browser credentials. Batch scans open temporary background tabs in the browser's normal browsing context.

## Testing

Run the local checks from the extension folder:

```bash
node tests/helpers.test.js
node tests/static-build.test.js
node tests/workbook.test.js
node tests/browser-regression.test.js
```

The browser regression test requires Playwright Chromium. Automated checks support an audit; they do not replace editorial, legal, policy, service-design or user-research judgement.
