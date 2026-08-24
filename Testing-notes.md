# Testing notes

Use this document to capture bugs, observations, questions and ideas identified while testing the Web Style Guide Checker.

## Bugs

### Duplicate list punctuation findings

A semicolon at the end of a list item generates two related findings:
- Punctuation at the end of a list item
- Semicolon should be replaced with a period

**Potential improvement:** Investigate whether overlapping findings should be consolidated so users don't receive duplicate feedback about the same issue.

## CMS Lite

### Editor-mode false positives

When the extension runs in CMS Lite editing mode, it scans elements of the CMS Lite interface as well as authored content. This can produce findings that aren't actionable for the content author, such as "Label the form control."

### "Show on page" in editor mode

"Show on page" does not currently locate/highlight findings correctly when scanning from CMS Lite editing mode.

### CMS Lite editor support

CMS Lite uses separate CKEditor iframes for the Intro and Body fields. Authored content appears within `body.cke_editable` inside each `iframe.cke_wysiwyg_frame`.

**Idea:** Investigate whether the extension can detect CMS Lite editing mode and scan these editable areas specifically, while retaining the existing scanning behaviour for QA and published pages.

## Ideas / enhancements

### B.C. Design System integration

Explore opportunities to use or integrate the B.C. Design System within the extension.

## Questions / research

- Which checks should work in CMS Lite Editor, QA and PROD?
- Which checks depend on the final rendered page?
- What is the best approach for collecting beta tester feedback?