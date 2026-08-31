# Changelog

All notable public changes to the B.C. Web Style Guide Checker will be recorded here.

## Unreleased

- Replaced unstable CMS Lite editor-region numbers with semantic locations such as **Topic → Body** and **Alerts → Alert 1 → Message**
- Made **Show on page** activate the correct CMS Lite tab, expand the matching component when needed and locate the CKEditor field by its source textarea rather than its position in the page
- Kept numeric editor regions only as a fallback for older saved reports

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
