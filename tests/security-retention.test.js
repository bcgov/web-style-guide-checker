"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "sidepanel.js"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start);
  assert.ok(start >= 0 && end > start, `Could not extract ${startText}`);
  return source.slice(start, end);
}

const context = { URL, Date, Set, Map };
context.canonicalUrl = value => {
  const url = new URL(value);
  url.hash = "";
  return url.href;
};
context.SINGLE_PAGE_REPORT_RETENTION_MS = 168 * 60 * 60 * 1000;
context.INCOMPLETE_BATCH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
context.COMPLETE_BATCH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
context.ARCHIVED_FEEDBACK_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
context.MAX_REPORTS = 20;

vm.runInNewContext(
  `${sourceBetween("function escapeHtml(value)", "function formatDate(value)")}
   this.exportHelpers = { escapeHtml, spreadsheetSafeText, csvCell };`,
  context
);

const hostile = `<img src=x onerror="alert('x')">`;
assert.equal(context.exportHelpers.escapeHtml(hostile), "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;");
assert.equal(context.exportHelpers.csvCell("=HYPERLINK(\"https://example.com\")"), '"\'=HYPERLINK(""https://example.com"")"');
assert.equal(context.exportHelpers.csvCell("\t+SUM(1,1)"), '"\'\t+SUM(1,1)"');
assert.equal(context.exportHelpers.csvCell("-2+3"), '"\'-2+3"');
assert.equal(context.exportHelpers.csvCell("ordinary text"), '"ordinary text"');

vm.runInNewContext(
  `${sourceBetween("function reportKey(url)", "async function storeReport(report)")}
   this.retentionHelpers = { reportKey, normalizedStoredReports, storedFindingFingerprints, retainedFindingMap, retainedReviewContexts };`,
  context
);

const now = Date.parse("2026-09-02T12:00:00.000Z");
const report = (url, scannedAt, fingerprint) => ({
  page: { url },
  scannedAt,
  issues: fingerprint ? [{ fingerprint }] : []
});
const stored = {
  "legacy-whole": report("https://example.com/page#old", "2026-09-02T09:00:00.000Z", "old-finding"),
  "legacy-section": report("https://example.com/page", "2026-09-02T10:00:00.000Z", "current-finding"),
  "boundary": report("https://example.com/boundary", "2026-08-26T12:00:00.000Z", "boundary-finding"),
  "expired": report("https://example.com/expired", "2026-08-26T11:59:59.999Z", "expired-finding")
};
const retainedReports = context.retentionHelpers.normalizedStoredReports(stored, now);
assert.deepEqual(Object.keys(retainedReports).sort(), ["https://example.com/boundary", "https://example.com/page"].sort());
assert.equal(retainedReports["https://example.com/page"].issues[0].fingerprint, "current-finding", "The newest successful scan must replace an earlier scan of the same canonical page");

const fingerprints = context.retentionHelpers.storedFindingFingerprints(retainedReports);
assert.deepEqual(Array.from(fingerprints).sort(), ["boundary-finding", "current-finding"]);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.retentionHelpers.retainedFindingMap({ "old-finding": { status: "resolved" }, "current-finding": { status: "ignored" } }, fingerprints))),
  { "current-finding": { status: "ignored" } },
  "Only decisions and notes for findings in retained reports should remain"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.retentionHelpers.retainedReviewContexts({
    "https://example.com/page": { scrollTop: 10 },
    "https://example.com/page::#section": { scrollTop: 20 }
  }, retainedReports))),
  { "https://example.com/page": { scrollTop: 10 } }
);

vm.runInNewContext(
  `${sourceBetween("function retainedFeedbackNotes(notes", "async function loadState()")}
   this.dataRetentionHelpers = { retainedFeedbackNotes, storedBatchIsComplete, retainedStoredBatch };`,
  context
);

const feedback = [
  { id: "unsent-old", createdAt: "2025-01-01T00:00:00.000Z", archivedAt: "" },
  { id: "sent-boundary", archivedAt: "2026-08-03T12:00:00.000Z" },
  { id: "sent-expired", archivedAt: "2026-08-03T11:59:59.999Z" }
];
assert.deepEqual(
  Array.from(context.dataRetentionHelpers.retainedFeedbackNotes(feedback, now), note => note.id),
  ["unsent-old", "sent-boundary"],
  "Unsent feedback remains until action, while sent feedback expires after 30 days"
);

const incompleteBoundary = { phase: "paused", urls: ["https://example.com"], records: [], savedAt: "2026-08-26T12:00:00.000Z" };
const incompleteExpired = { ...incompleteBoundary, savedAt: "2026-08-26T11:59:59.999Z" };
const completeBoundary = { phase: "done", urls: ["https://example.com"], records: [{}], savedAt: "2026-08-03T12:00:00.000Z" };
const completeExpired = { ...completeBoundary, savedAt: "2026-08-03T11:59:59.999Z" };
assert.ok(context.dataRetentionHelpers.retainedStoredBatch(incompleteBoundary, now));
assert.equal(context.dataRetentionHelpers.retainedStoredBatch(incompleteExpired, now), null);
assert.ok(context.dataRetentionHelpers.retainedStoredBatch(completeBoundary, now));
assert.equal(context.dataRetentionHelpers.retainedStoredBatch(completeExpired, now), null);

vm.runInNewContext(
  `${sourceBetween("function isScannableUrl(url)", "function detectProfile(url)")}
   this.scanUrlHelpers = { isScannableUrl, unsupportedScanUrlMessage };`,
  context
);
assert.equal(context.scanUrlHelpers.isScannableUrl("file:///C:/Users/test/checker-test-page.html#1"), false);
assert.match(context.scanUrlHelpers.unsupportedScanUrlMessage("file:///C:/Users/test/checker-test-page.html#1"), /Local files cannot be checked.*security.*HTTP or HTTPS/i);

console.log("Security and retention tests passed");
