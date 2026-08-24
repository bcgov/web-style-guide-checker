# B.C. Web Style Guide Checker 3.3 design record

## Product goal

Help a reviewer understand a page, decide what needs attention and finish an audit without losing their place. The interface should stay calm when a scan contains dozens of findings.

## Chosen structure

1. Keep the side panel centred on the current page.
2. Show Findings and Page details as the two main choices after a scan.
3. Present a recommended next issue and a flat list of issue types.
4. Open one issue type in a dedicated occurrence-by-occurrence review.
5. Advance after Ignore or Resolve, show explicit confirmation on the next finding and provide Undo.
6. Put detailed filters in a dialog while keeping Fix, Check and Review filters visible.
7. Move batch scans, permissions and allowed terms into a full-page workspace.
8. Use the wider workspace for a two-column findings-and-detail view.
9. Group repeated findings in reports and keep metadata on one row per page.
10. Let reviewers sort issue types by recommended priority or first appearance on the page.
11. Follow findings on the live page during side-panel guided review.

## Usability safeguards

- The scan setup collapses after a successful scan.
- Page context, Export and More remain available at the top.
- Review position, selected issue type, filters and page-details section are saved per page.
- Link destinations open in background tabs so the current review stays in place.
- Issue-type navigation lets a reviewer leave a long repeated pattern quickly.
- End-of-review navigation returns to the issue overview instead of becoming disabled.
- Exact-term exceptions support acronyms and single-word formal names while remaining case-sensitive and rule-specific.
- The manual checklist appears only on the Page details overview.
- The full-page review clearly identifies itself as a separate browser tab and labels actions that return to the original page.
- CMS Lite wording and ownership reflect what an editor can change.
- Allowed terms cannot disable structural, sentence-case or accessibility rules.

## Visual system

- BC Sans for all interface text
- B.C. navy for headings and primary actions
- B.C. gold for focus and small accents
- Cool blue tints for information and active surfaces
- Warm neutral borders and backgrounds
- Red, amber and blue rails for Fix, Check and Review
- Restrained corners, short transitions and visible keyboard focus

## Privacy and permissions

- Content checks run locally.
- Page text is not sent to an AI or analysis service.
- Link and asset requests omit browser credentials.
- Broad website access is optional and removable.
- Local review state is stored in extension storage.

## Verification

- Validate the manifest and JavaScript syntax.
- Confirm every JavaScript element reference exists in the interface.
- Run helper, static-build and workbook tests.
- Run page-rule regression tests with Playwright Chromium when the browser binary is available.
- Inspect the packaged ZIP and verify that only release files are included.
- Keep earlier versions in their existing folders and package version 3.3 independently.
