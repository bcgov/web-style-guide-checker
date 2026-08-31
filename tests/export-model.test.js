"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "sidepanel.js"), "utf8");
const start = source.indexOf("const ATTENTION_RANK");
const end = source.indexOf("function parseBatchUrls");
assert.ok(start >= 0 && end > start, "Export model helpers must be present");

const context = {
  effectiveStatus: finding => finding.status || finding.automaticStatus || "open",
  auditNote: finding => finding.note || { important: false, text: "" },
  sentenceLabel: value => {
    const text = String(value || "");
    return text ? text.charAt(0).toUpperCase() + text.slice(1).replace(/-/g, " ") : "";
  },
  formatDate: value => String(value || "")
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\n;globalThis.exportModel = { pageReviewProfile, findingDetailRows, issueSummaryRows, siteWideRows, batchPageRecords, batchPagesRows, batchSummaryRows, batchWorkbookSheets, summarySheetRows, linkCheckCoverage, workbookSheetsNeedLinkCheck };`, context);

function finding(ruleId, category, severity, title, extra = {}) {
  return {
    id: `${ruleId}-${Math.random()}`,
    fingerprint: `${ruleId}-${Math.random()}`,
    ruleId,
    category,
    severity,
    title,
    why: `${title} matters`,
    suggestion: `Fix ${title}`,
    sourceUrl: "https://example.gov.bc.ca/guide",
    responsibility: "Content",
    evidence: extra.evidence || title,
    location: extra.location || "Example section",
    automaticStatus: "open",
    occurrenceCount: extra.occurrenceCount || 1,
    selector: extra.selector || `#${ruleId}`,
    ...extra
  };
}

function report(title = "Example page") {
  return {
    ruleVersion: "1.3.0",
    scannedAt: "2026-08-27T20:00:00Z",
    page: { title, url: `https://example.gov.bc.ca/${title.toLowerCase().replace(/\s+/g, "-")}`, hostname: "example.gov.bc.ca" },
    settings: { scope: "content", profile: "standard", profileLabel: "Standard website" },
    stats: { words: 320, readingWords: 180, sentences: 10, readingGrade: 12.5, images: 4 },
    pageDetails: { counts: { links: 8, images: 4, lists: 2 }, headings: [{ level: 1 }, { level: 2 }] },
    issues: [
      finding("page-title-missing", "Page information", "fix", "Add a page title"),
      finding("sentence-long", "Plain language", "check", "Shorten the sentence", { occurrenceCount: 5 }),
      finding("section-reading-level", "Plain language", "review", "Review section", { analysisGrade: 14.2, analysisWords: 100 }),
      finding("section-heading-density", "Plain language", "review", "Consider headings", { analysisWords: 410, evidence: "410 words without a heading break" }),
      finding("generic-link", "Links", "fix", "Write descriptive link text"),
      finding("all-caps", "Formatting", "fix", "Remove all caps", { occurrenceCount: 4 }),
      finding("double-space", "Formatting", "fix", "Remove extra space", { occurrenceCount: 2 }),
      finding("list-punctuation", "Lists", "fix", "Remove list punctuation"),
      finding("em-dash", "Punctuation", "fix", "Replace em dash")
    ]
  };
}

const first = report();
const profile = context.exportModel.pageReviewProfile(first);
const profileMap = Object.fromEntries(profile.map(area => [area.name, area.level]));
assert.equal(profileMap["Page information"], "review-first");
assert.equal(profileMap["Plain language"], "review-first");
assert.equal(profileMap["Structure and navigation"], "review-first");
assert.equal(profileMap["Links and documents"], "needs-attention");
assert.equal(profileMap["Style and proofreading"], "review-first");
assert.equal(profileMap.Accessibility, "nothing-flagged");

const detail = context.exportModel.findingDetailRows(first, false, "", 1);
assert.equal(detail.length, first.issues.length, "Findings detail must retain one row per stored finding");
assert.equal(detail[0][0], "P001-F001");
assert.ok(detail.some(row => row[6] === "Shorten the sentence" && row[17] === 5), "Collapsed duplicate occurrences must remain visible");

const grouped = context.exportModel.issueSummaryRows(first, false);
assert.ok(grouped.length < first.issues.length + 1, "Issue summary should group by issue type/status rather than replace finding detail");

const second = report("Second page");
second.stats.readingGrade = 8;
second.issues = [finding("generic-link", "Links", "fix", "Write descriptive link text")];
const records = context.exportModel.batchPageRecords([
  { submittedUrl: first.page.url, status: "complete", report: first },
  { submittedUrl: second.page.url, status: "complete", report: second },
  { submittedUrl: "https://bad.example", status: "error", error: "Load failed", scannedAt: "2026-08-27T20:05:00Z" }
]);
const siteWide = context.exportModel.siteWideRows(records, false);
const generic = siteWide.find(row => row[11] === "generic-link");
assert.equal(generic[5], 2, "Site-wide findings must count affected pages");
assert.equal(generic[6], "100%", "Affected-page percentage must use successfully scanned pages");


const pagesRows = context.exportModel.batchPagesRows(records);
assert.equal(pagesRows.length, 3, "Pages sheet must include failed scans as well as completed scans");
const failedPage = pagesRows.find(row => row[33] === "Failed");
assert.ok(failedPage, "Failed scans must be visible on the Pages sheet");
assert.equal(failedPage[2], "https://bad.example");
assert.match(failedPage[4], /Load failed/);

// A large single page must preserve every stored finding while keeping grouped issue types separate.
const largeSingle = report("Large single page");
largeSingle.issues = Array.from({ length: 212 }, (_, index) => finding(`synthetic-${index % 83}`, "Formatting", index % 4 === 0 ? "fix" : "review", `Synthetic issue ${index % 83}`, {
  selector: `#finding-${index}`,
  location: `Section ${index % 12}`,
  evidence: `Evidence ${index}`
}));
assert.equal(context.exportModel.findingDetailRows(largeSingle, false).length, 212, "A 212-finding page must export 212 stored finding rows");
assert.equal(context.exportModel.issueSummaryRows(largeSingle, false).length, 83, "The same page should retain a separate 83-type grouped summary");

// Batch workbooks must remain structurally predictable from small reviews through ~100 pages.
[5, 20, 45, 100].forEach(size => {
  const batch = Array.from({ length: size }, (_, index) => {
    if (index === size - 1 && size > 5) return { submittedUrl: `https://failed.example/${index}`, status: "error", error: "Synthetic failure", scannedAt: "2026-08-27T20:05:00Z" };
    const sample = report(`Page ${index + 1}`);
    sample.stats.readingGrade = index % 4 === 0 ? 13 : 8;
    sample.issues = [finding("generic-link", "Links", "fix", "Write descriptive link text")];
    return { submittedUrl: sample.page.url, status: "complete", report: sample };
  });
  const numbered = context.exportModel.batchPageRecords(batch);
  const workbook = context.exportModel.batchWorkbookSheets(numbered, false, "full");
  const pageSheet = workbook.find(sheet => sheet.name === "Pages");
  assert.equal(pageSheet.rows.length, size + 1, `Pages sheet must retain all ${size} requested rows plus its header`);
  const summaryRows = context.exportModel.batchSummaryRows(numbered, false);
  assert.ok(summaryRows.length < 80, `Summary must stay compact for a ${size}-page batch`);
  if (size > 10) assert.ok(summaryRows.some(row => row.kind === "note" && /Showing 10 of/.test(row.values[0])), "Large batches must state that the summary shows only the strongest 10 pages");
});

const fullSheets = Array.from(context.exportModel.batchWorkbookSheets(records, false, "full"), sheet => sheet.name);
assert.deepEqual(fullSheets, ["Summary", "Pages", "Site-wide findings", "Page issue summary", "Findings detail", "Links", "Metadata", "Scan log"]);
const customSheets = Array.from(context.exportModel.batchWorkbookSheets(records, false, "custom", new Set(["Summary", "Findings detail", "Scan log"])), sheet => sheet.name);
assert.deepEqual(customSheets, ["Summary", "Findings detail", "Scan log"], "Custom batch exports must include only the selected sheets in workbook order");

assert.equal(context.exportModel.linkCheckCoverage(first), "Not checked");
first.linkCheck = { state: "complete", totalFound: 8, completed: 8 };
assert.equal(context.exportModel.linkCheckCoverage(first), "Complete");

const summary = context.exportModel.summarySheetRows(first);
assert.ok(summary.some(row => row.values && row.values[0] === "Automated review profile"), "Single-page summary must include the review profile");
assert.ok(summary.some(row => row.kind === "note" && /not confirmed compliance failures/i.test(row.values[0])), "Summary must explain the limits of automated findings");
const batchSummary = context.exportModel.batchSummaryRows(records, false);
assert.ok(batchSummary.some(row => row.values && row.values[0] === "Fix"), "Batch summary must separate Fix findings from other review levels");
assert.ok(batchSummary.some(row => row.values && row.values[0] === "Link check results"), "Batch summary must expose link-check results without requiring the full Links sheet");


assert.equal(context.exportModel.workbookSheetsNeedLinkCheck(new Set(["Metadata"])), false, "Metadata-only custom exports must not prompt for link checking");
assert.equal(context.exportModel.workbookSheetsNeedLinkCheck(new Set(["Summary"])), true, "Summary exports use link-check coverage and results");
assert.equal(context.exportModel.workbookSheetsNeedLinkCheck(new Set(["Findings detail"])), true, "Findings detail can change when broken-link findings are added");
assert.equal(context.exportModel.workbookSheetsNeedLinkCheck(new Set(["Links"])), true, "The Links sheet uses link-check results");

console.log("Export model tests passed");
