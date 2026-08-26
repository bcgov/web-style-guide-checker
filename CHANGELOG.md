# Changelog

All notable public changes to the B.C. Web Style Guide Checker will be recorded here.

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
