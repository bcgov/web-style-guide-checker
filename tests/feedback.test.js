"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "sidepanel.js"), "utf8");
const typeStart = source.indexOf("const FEEDBACK_RECIPIENTS");
const typeEnd = source.indexOf("const surfaceParams");
const labelStart = source.indexOf("function feedbackTypeLabel");
const labelEnd = source.indexOf("function feedbackNotesForFinding");
const browserStart = source.indexOf("function browserLabel");
const browserEnd = source.indexOf("function reportScopeLabel");
const batchStart = source.indexOf("function feedbackMailtoHref");
const batchEnd = source.indexOf("function renderFeedback()");
const reportStart = source.indexOf("function feedbackReportDate");
const reportEnd = source.indexOf("async function copyFeedbackNotes");

assert.ok(typeStart >= 0 && typeEnd > typeStart, "Feedback constants must be present");
assert.ok(labelStart >= 0 && labelEnd > labelStart, "Feedback type labels must be testable");
assert.ok(browserStart >= 0 && browserEnd > browserStart, "Browser diagnostics must be testable");
assert.ok(batchStart >= 0 && batchEnd > batchStart, "Feedback email batching helpers must be present");
assert.ok(reportStart >= 0 && reportEnd > reportStart, "Feedback report helpers must be present");

const context = {
  navigator: { userAgent: "Mozilla/5.0 Chrome/151.0.0.0 Safari/537.36", platform: "Win32" },
  chrome: { runtime: { getManifest: () => ({ version: "1.3.0" }) } },
  BCWebStyleGuideChecker: { ruleVersion: "1.3.0" },
  canonicalUrl: value => String(value).split("#")[0],
  formatDate: value => new Date(value).toISOString(),
  normalizeSpace: value => String(value || "").replace(/\s+/g, " ").trim(),
  readyFeedbackNotes: () => []
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source.slice(typeStart, typeEnd)}\n${source.slice(labelStart, labelEnd)}\n${source.slice(browserStart, browserEnd)}\n${source.slice(reportStart, reportEnd)}\n${source.slice(batchStart, batchEnd)}\n;globalThis.feedbackTest = { feedbackSubject, feedbackReportText, feedbackMailtoHref, feedbackEmailBatchPlan };`, context);

function note(id, text, includeContext = true) {
  return {
    id,
    type: id === "feedback-1" ? "missed" : "suggestion",
    text,
    important: id === "feedback-1",
    includeContext,
    createdAt: "2026-08-24T18:00:00.000Z",
    context: {
      pageTitle: "Example service",
      pageUrl: "https://example.gov.bc.ca/service#details",
      detectedProfile: "Standard website",
      scanScope: "Page content",
      pageSection: "Details",
      selectedText: "Programs & services",
      finding: null,
      extensionVersion: "1.3.0",
      rulesVersion: "1.3.0",
      capturedAt: "2026-08-24T18:00:00.000Z"
    }
  };
}

const included = note("feedback-1", "The checker did not flag the ampersand.");
const excluded = note("feedback-2", "Add a shorter review shortcut.", false);
const report = context.feedbackTest.feedbackReportText([included, excluded]);
assert.match(report, /Notes included: 2/);
assert.match(report, /Pages represented: 1/);
assert.match(report, /Missed issue — Important/);
assert.match(report, /Address: https:\/\/example\.gov\.bc\.ca\/service#details/);
assert.match(report, /Page context excluded by the tester/);
assert.equal((report.match(/Address:/g) || []).length, 1, "Excluded page context must not be repeated in the report");
assert.match(context.feedbackTest.feedbackSubject([included, excluded]), /^Web Style Guide Checker feedback — v1\.3\.0 — \d{4}-\d{2}-\d{2} — 2 notes$/);

const href = context.feedbackTest.feedbackMailtoHref([included, excluded]);
assert.ok(href.length < 7000, "A short complete report should fit below the safe mailto ceiling");
assert.match(decodeURIComponent(href), /The checker did not flag the ampersand/);

const verbose = Array.from({ length: 12 }, (_, index) => note(`feedback-${index + 10}`, `Detailed testing note ${index + 1}: ${"Long contextual explanation ".repeat(18)}`));
const plan = context.feedbackTest.feedbackEmailBatchPlan(verbose);
assert.ok(plan.batch.length > 0 && plan.batch.length < verbose.length, "Verbose feedback should be split at the encoded email safety limit");
assert.equal(plan.batch.length + plan.overflow.length, verbose.length, "Overflow feedback must stay saved for the next email batch");
assert.ok(context.feedbackTest.feedbackMailtoHref(plan.batch).length <= 7000, "Prepared email batch must never exceed the safe encoded mailto size");
assert.ok(context.feedbackTest.feedbackMailtoHref([...plan.batch, plan.overflow[0]]).length > 7000, "The next note should be excluded only because it would exceed the safe size");

console.log("Feedback tests passed");
