"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "sidepanel.js"), "utf8");
const typeStart = source.indexOf("const FEEDBACK_TYPES");
const typeEnd = source.indexOf("const MAILTO_REPORT_LIMIT");
const labelStart = source.indexOf("function feedbackTypeLabel");
const labelEnd = source.indexOf("function feedbackNotesForFinding");
const browserStart = source.indexOf("function browserLabel");
const browserEnd = source.indexOf("function reportScopeLabel");
const reportStart = source.indexOf("function feedbackReportDate");
const reportEnd = source.indexOf("async function copyFeedbackReport");

assert.ok(typeStart >= 0 && typeEnd > typeStart, "Feedback type definitions must be present");
assert.ok(labelStart >= 0 && labelEnd > labelStart, "Feedback type labels must be testable");
assert.ok(browserStart >= 0 && browserEnd > browserStart, "Browser diagnostics must be testable");
assert.ok(reportStart >= 0 && reportEnd > reportStart, "Feedback report helpers must be present");

const context = {
  navigator: {
    userAgent: "Mozilla/5.0 Chrome/151.0.0.0 Safari/537.36",
    platform: "Win32"
  },
  chrome: { runtime: { getManifest: () => ({ version: "1.0.0" }) } },
  BCWebStyleGuideChecker: { ruleVersion: "1.0.0" },
  canonicalUrl: value => String(value).split("#")[0],
  formatDate: value => new Date(value).toISOString(),
  readyFeedbackNotes: () => []
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source.slice(typeStart, typeEnd)}\n${source.slice(labelStart, labelEnd)}\n${source.slice(browserStart, browserEnd)}\n${source.slice(reportStart, reportEnd)}\n;globalThis.feedbackTest = { feedbackSubject, feedbackReportText };`, context);

const included = {
  id: "feedback-1",
  type: "missed",
  text: "The checker did not flag the ampersand.",
  important: true,
  includeContext: true,
  createdAt: "2026-08-24T18:00:00.000Z",
  context: {
    pageTitle: "Example service",
    pageUrl: "https://example.gov.bc.ca/service#details",
    detectedProfile: "Standard website",
    scanScope: "Page content",
    pageSection: "Details",
    selectedText: "Programs & services",
    finding: null,
    extensionVersion: "1.0.0",
    rulesVersion: "1.0.0",
    capturedAt: "2026-08-24T18:00:00.000Z"
  }
};
const excluded = {
  ...included,
  id: "feedback-2",
  type: "suggestion",
  text: "Add a shorter review shortcut.",
  important: false,
  includeContext: false
};

const report = context.feedbackTest.feedbackReportText([included, excluded]);
assert.match(report, /Notes included: 2/);
assert.match(report, /Pages represented: 1/);
assert.match(report, /Missed issue — Important/);
assert.match(report, /Address: https:\/\/example\.gov\.bc\.ca\/service#details/);
assert.match(report, /Page context excluded by the tester/);
assert.equal((report.match(/Address:/g) || []).length, 1, "Excluded page context must not be repeated in the report");

const subject = context.feedbackTest.feedbackSubject([included, excluded]);
assert.match(subject, /^Web Style Guide Checker feedback — v1\.0\.0 — \d{4}-\d{2}-\d{2} — 2 notes$/);

console.log("Feedback tests passed");
