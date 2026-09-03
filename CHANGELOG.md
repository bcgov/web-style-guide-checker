# Changelog

All notable public changes to the B.C. Web Style Guide Checker will be recorded here.

## Unreleased

## 1.3.2 — 2026-09-03

- Added a 168-hour retention limit for single-page reports and made each successful rescan replace the earlier saved report for the same canonical page while preserving decisions and notes for findings that remain
- Kept public link checks anonymous and existing authenticated CMS Lite, QA, SharePoint and intranet checks available, while refusing embedded credentials, explicit local/private/reserved destinations and action-like authenticated URLs
- Removed optional access to local `file:` pages and restricted extension storage to trusted extension contexts
- Protected CSV exports from spreadsheet-formula interpretation and added the previously standalone batch-state and highlight suites to the full test command
- Expanded the website-access explanation to state that page content and reports are processed locally without external analysis or AI, while link destinations receive normal browser requests
- Replaced the all-sites permission option with destination-specific access for both page and batch link checks and removed legacy wildcard access during extension updates
- Added a specific security explanation when someone opens the checker on a local `file:` page
- Added separate controls for deleting page reviews, batch state, unsent feedback, sent feedback, allowed terms and saved page preferences
- Added 7-day retention for incomplete batches, 30-day retention for completed batches and 30-day retention for sent feedback; unsent feedback remains until sent or deleted
- Added optional, default-on review settings for non-breaking spaces and passive voice, disclosed excluded checks in saved reviews and exports, and kept reading-level checks always active
- Prevented whole all-caps headings from producing a second acronym finding for a word after a dash
- Added contextual Canadian postal-code formatting and kept postal-code-shaped values out of acronym findings
- Added conservative review of short bold blocks that introduce following content, combined all-caps visual-heading corrections into one finding, and excluded sentences, lead-ins, alerts, linked actions and blocks without related content
- Recognized CMS Lite `On this page` lists placed in an adjacent wrapper after the heading
- Removed redundant missing-file-type and missing-file-size diagnostics from finding cards
- Updated the extension, rules, package and validator to 1.3.2 and required this security and privacy baseline before scans can continue

## 1.3.1 — 2026-09-02

- Replaced unstable CMS Lite editor-region numbers with semantic locations such as **Topic → Body** and **Alerts → Alert 1 → Message**
- Made **Show on page** activate the correct CMS Lite tab, expand the matching component when needed and locate the CKEditor field by its source textarea rather than its position in the page
- Kept numeric editor regions only as a fallback for older saved reports
- Made the B.C. Web Style Guide reference guidance visible by default on each finding instead of hiding it in a collapsed control
- Replaced the former silent 25-findings-per-rule cap with a 500-finding safety limit, preserved detected and omitted totals, and disclosed incomplete coverage in summaries, exports and batch reports
- Added a reversible way to skip the remaining findings of an issue type during guided review while keeping every skipped finding open and available to include again
- Retained every affected text region for colour-contrast findings, kept repeated locations navigable and grouped equivalent measured conditions in summaries and exports
- Updated contrast measurement to use the current WCAG breakpoint and unrounded threshold comparison, and separated reliable measurements from gradients, images, opacity and other states that require manual review
- Simplified editor-facing contrast details to emphasize the measured ratio and required minimum while retaining technical measurement data in exports
- Expanded plain-text list detection to sequential lettered and numbered lists and typed sublists, requiring at least 3 sequential markers and grouping each affected block into one finding
- Avoided list false positives for one-item lists, dotted versions, address abbreviations and sentence-initial **Ministry**, while preserving ordinary punctuation and generic-government-term findings
- Preserved first-use acronym detection across separate CMS Lite editor fields and strengthened CMS Lite **On this page** recognition and source mapping
- Added conservative checks for unseparated ordinary numbers, comma-containing currency with unnecessary trailing zeros, year/month/day dates and incomplete years
- Distinguished **PT** used after a time from an undefined acronym, preserved the related time-format finding and recognized **BC** in Canadian postal addresses
- Added specific handling for malformed document labels such as `(PDF, 1.MB)` and email addresses inside anchor elements without destinations
- Added context-sensitive non-breaking-space review and limited trailing-link-space findings to spaces that visibly enlarge the linked area
- Added checks for justified text and superscript ordinal formatting, including authored CMS Lite content
- Made page following standard during guided review, reset each selected finding to a visible position and kept export-copy confirmation inside the export window
- Kept the **Findings** and **Page details** tabs available while allowing the findings summary, **All findings** row and review progress to scroll away with the content
- Kept skip confirmations visible, preserved keyboard focus on the finding and placed narrow-panel review labels beside finding titles
- Compacted the narrow side-panel header, scan settings, filters and review controls while retaining visually hidden headings for assistive technology
- Removed repeated **Flagged wording** callouts and duplicate diagnostics when the rule explanation and evidence already identify a semicolon, list marker, double space or non-breaking space
- Expanded link verification across CMS Lite, QA, live, intranet and SharePoint destinations while keeping ordinary public requests anonymous and treating authentication or permission limits conservatively
- Organized checked links into **Problems**, **Needs review** and **Working** groups, improved result evidence and exports, and distinguished confirmed failures from destinations that could not be fully verified
- Expanded remote-link permissions for common HTTP-to-HTTPS and `www`-to-apex redirects, including Clicklaw and CHOA destinations
- Excluded CMS Lite mobile navigation and template-provided related-link arrow spacing from authored-content findings
- Excluded hash-prefixed mobile shortcodes such as `#7277` from the thousands-separator rule
- Changed the suggested alternative for **administer** from **do** to **manage** and preserved the matched verb tense for administered, administers and administering
- Treated `NOTE` and `NOTE:` as all-caps emphasis rather than undefined acronyms and added coverage for multiword all-caps headings alongside other heading findings
- Added conservative missing-space detection for adjacent sentences while protecting email addresses, URLs, bare domains, filenames, social handles, initialisms, linked technical tokens and marked-up technical content
- Kept a real sentence boundary detectable immediately after a protected email address, domain or filename
- Centred semicolon evidence on the actual punctuation and avoided duplicate semicolon findings for list endings
- Reduced passive-voice false positives for common adjectival participles and avoided duplicate page-title and H1 sentence-case findings when they refer to the same authored element
- Gave specific government-name patterns precedence over generic capitalization checks and preserved formal-name exceptions
- Refined split-link and adjacent-link evidence, CMS Lite reveal behaviour and navigation to affected content inside supported collapsed components
- Added preview-release lifecycle controls that can announce updates, require a newer version, block a specific build, end the preview or expire an abandoned preview before scanning
- Restricted lifecycle policy to a small remote status file with no page content, credentials or executable code; cached the last valid policy and kept network failures from disabling an otherwise supported build
- Aligned the extension, package, lockfile, README and rules versions at 1.3.1 and added build checks to keep them synchronized

## 1.3.0 — 2026-08-27

- Hardened sentence parsing for `B.C.'s`, `e.g.`, `i.e.` and decimal file sizes so sentence, paragraph, list and reading-level checks share more reliable boundaries
- Reduced acronym false positives in email addresses, clock times, hyphenated formal names, editorial labels and all-caps phrases
- Corrected sentence-case checks for numbered headings such as `1. Executive summary`
- Improved malformed `On this page` recognition, CMS Lite template exclusions, list-introduction boundaries and repeated-list-opening thresholds; recognized `On this page` lists no longer trigger the list-introduction rule across CMS Lite wrappers
- Accepted valid global `tel:` links without requiring hyphens and recognized short service numbers such as 9-1-1 and 8-1-1
- Distinguished document labels missing only a file type or only a file size
- Found every actionable repeated-space occurrence, including non-breaking spaces, while leaving indentation used by fake lists to the list-structure finding
- Improved finding navigation inside nested and collapsed accordions
- Excluded button-style links from the trailing-link-space rule while retaining the check for ordinary text links
- Added conservative checks for visually faked lists, meaningless alternative text and high-confidence proofreading issues such as `pubic` and selected repeated function words
- Added a page-only ignore option for intentional uses of `pubic`
- Expanded paragraph review to flag 1 to 4 sentence paragraphs at 100 words, 5-sentence paragraphs at 115 words, and all paragraphs over 5 sentences
- Added structural section analysis: 200 words of prose without a heading break prompts a heading review, and difficult sections are reported as individual findings even when the page-wide reading grade is also high
- Section reading checks exclude heading text, include list items with 5 or more words, require at least 2 readability units, use higher thresholds for shorter sections and keep threshold mechanics out of the finding text
- Changed **Rescan page** to reopen the scan options with the previous choices selected before running another scan
- Improved stale-scan actions, feedback navigation after page changes and sticky Feedback header positioning
- Simplified long-paragraph, heading-density and section-readability findings so implementation thresholds are not repeated in each card; section readability now shows the estimated grade without the word count
- Treated alerts and supported accordions as separate analysis segments, counted substantive list content when looking for long sections without headings, and highlighted the full affected section on the page
- Added conservative checks for consecutive same-level headings without content, links accidentally split into adjacent fragments, spaced slash variants such as `and / or`, vague links such as `Find out how`, and ordinary-prose `WIFI`/`WiFi` forms
- Strengthened heading-dash and range findings, expanded `to` guidance to common day, date, time, year, percentage and temperature ranges, and added a contextual review for spaced hyphens or en dashes being used as separators while protecting fiscal years, addresses, equations and short label pairs
- Centred evidence excerpts on the actual matched wording so repeated tokens later in long paragraphs are highlighted correctly
- Reworked remote link and asset checks to skip in-page fragments, omit browser sign-in, handle redirects deliberately, retry unsupported HEAD requests with a small GET, and explain unverified results more clearly
- Added B.C.-specific QA verification: `www2.qa.gov.bc.ca` links are checked against the identical live `www2.gov.bc.ca` path, query and fragment and reported as live-version results rather than as ordinary QA responses
- Stabilized finding navigation by opening collapsed accordion ancestors before scrolling and highlighting, with a safe visibility fallback when a page's collapse script cannot respond to the extension
- Ignored empty editor-generated lists in list counts and list rules so invisible `<ul></ul>` markup does not create false list-introduction findings
- Rewrote dash-separator and section-readability guidance to describe the Web Style Guide problem directly instead of explaining checker mechanics
- Redesigned single-page Excel reports around **Summary**, **Issue summary** and authoritative **Findings detail** sheets, with optional page details, links and metadata
- Redesigned batch workbooks around **Summary**, **Pages**, **Site-wide findings**, **Issues by page**, **Findings detail** and **Scan log**, with optional links and metadata
- Added a six-area automated review profile using **Review first**, **Needs attention**, **Worth checking** and neutral **Nothing flagged** labels; the profile prioritizes review without creating an overall quality score
- Kept individual findings separate from grouped issue types in copy and workbook exports, including occurrence counts when the scanner deliberately collapses exact duplicates
- Added compact batch summaries, affected-page counts, widespread-finding views, failed-scan rows and scale tests from small batches through 100 pages
- Simplified single-page and batch workbook choices to **Full audit** and hidden-until-needed **Customize workbook** instead of exposing redundant presets or a large sheet-selection checklist
- Added optional batch link checking that deduplicates destinations across pages, preserves QA-to-live verification and records link-check coverage/results in audit summaries
- Kept complete link inventories after network checks and made exported HTTP/HTTPS addresses clickable in Excel
- Simplified single-page export actions by removing **Copy issue summary**, promoting **Download findings CSV** to a button and offering link checking only when the selected workbook sheets use link-check findings, coverage or results
- Improved workbook accessibility and readability with text labels for every attention state, neutral styling for **Nothing flagged**, filterable data sheets, wrapped rows and no frozen panes or merged data cells
- Narrowed the all-caps check to a controlled set of ordinary emphasis words so formal uppercase names such as **BC SPCA** are not treated as formatting errors; acronyms inside recognized built-in organization names are also protected from first-use expansion findings
- Protected corporate suffixes such as `Inc.`, `Ltd.` and `Corp.` from creating false sentence boundaries inside titles while preserving real sentence breaks such as `Acme Inc. Apply online...`
- Clarified heading-formatting findings so they explicitly distinguish extra `<strong>`, `<em>` or underline markup inside a heading from normal CSS heading styling
- Improved invisible-link handling: same-destination empty/visible anchors are treated as split links even inside headings, standalone empty anchors are described as invisible markup, secondary file-label and link-text findings are suppressed, and page highlighting falls back to the nearest visible container
- Generalized remote redirect verification so permitted same-origin redirects are followed automatically and permitted cross-origin redirects can also be verified; redirects outside current website access remain **Redirect could not be verified** rather than being implied to be broken
- Expanded selected plain-language dictionary entries with controlled inflected forms such as `utilized`, `disbursed`, `established`, `administered` and `given consideration to`, added `assistance` and noun-plural `individuals`, and preserved distinct guide terms even when one rule has many repeated findings
- Recognized punctuated `A.M.`/`P.M.` and `noon`/`midnight` time ranges as **Use ‘to’ for the range** findings, and narrowed the contextual dash-separator review so label-style en dashes do not become sentence-separator false positives

## 1.2.0 — 2026-08-25

- Improved sentence detection around email addresses, web addresses, decimal file sizes and abbreviations so paragraphs and list items are counted more accurately
- Recognized plural acronyms after a singular definition and definitions that contain abbreviations such as `B.C.`
- Corrected exact acronym highlighting when the same letters appear inside a longer acronym
- Removed unconditional plain-language flags for `accommodation`, `individual` and `request`, which depend on context
- Expanded CMS Lite published-page checks to supported authored accordions and supplemental components while continuing to exclude shared template content
- Added H1 sentence-case coverage and more precise checks for `B.C. Government`
- Reworked `On this page` results to identify missing targets, H3 or H4 targets, repeated links, order differences and text differences separately
- Combined bold, italic and underline findings inside a heading into one heading-formatting finding
- Added a true page-order review sequence that can move between different issue types
- Warned when the page has reloaded since a saved review was created
- Kept the active page highlight visible during review and added a compact link-status shortcut
- Kept feedback navigation and note actions available while scrolling

## 1.1.1 — 2026-08-25

- Stopped treating common file extensions, HR, selected Roman numerals and Canadian postal abbreviations as undefined acronyms in the contexts where they are expected
- Distinguished malformed document labels such as `(PDF 159 KB)` from labels that are missing a type or size
- Corrected the reference for tables inside accordions
- Rewrote new-tab and long-list guidance in plain language and added practical examples to several findings
- Added checks for trailing spaces inside links and missing spaces after ampersands joined to words
- Included complete short feedback reports in email drafts and downloaded long reports as text files to attach

## 1.1.0 — 2026-08-24

- Updated checks for government capitalization, headings, alternative text, dates, times, time zones, measurements, currency, education terms and Canadian spelling
- Added context-aware Review findings for academic titles, academic degrees, school grades and formal names
- Added list-introduction and multi-sentence list-item checks
- Added checks for province and territory abbreviations, ordinal numbers and apostrophe plurals
- Expanded passive-voice and negative-contraction detection
- Added missing everyday-word replacements from the guide
- Prevented false positives for technical slashes, fractions, `km/h`, Provincial Sales Tax and formal government names
- Added English-language gating for English-specific writing checks and reading-grade estimates
- Clarified checker-defined thresholds and reduced overlapping punctuation findings
- Added rule-focused regression tests

## 1.0.0 — 2026-08-24

First public release.

- Added focused current-page and full-page review workflows
- Added CMS Lite editable-content detection
- Added page-order and recommended-order review
- Added page details, overlays, metadata and content statistics
- Added link, anchor and document-label checks
- Added batch scans and selectable workbook exports
- Added exact, rule-specific allowed terms
- Added local feedback notes with optional page context, copied reports, CSV export and pre-addressed email drafts
- Added persistent reports, decisions and review position
