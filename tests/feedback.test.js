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
const csvStart = source.indexOf("const FEEDBACK_CSV_HEADER");
const csvEnd = source.indexOf("function exportFeedbackCsv");
const captureStart = source.indexOf("async function captureFeedbackContext");
const captureEnd = source.indexOf("function feedbackContextPreview");

assert.ok(typeStart >= 0 && typeEnd > typeStart, "Feedback constants must be present");
assert.ok(labelStart >= 0 && labelEnd > labelStart, "Feedback type labels must be testable");
assert.ok(browserStart >= 0 && browserEnd > browserStart, "Browser diagnostics must be testable");
assert.ok(batchStart >= 0 && batchEnd > batchStart, "Feedback email batching helpers must be present");
assert.ok(reportStart >= 0 && reportEnd > reportStart, "Feedback report helpers must be present");

const context = {
  navigator: { userAgent: "Mozilla/5.0 Chrome/151.0.0.0 Safari/537.36", platform: "Win32" },
  chrome: { runtime: { getManifest: () => ({ version: "1.3.0" }) } },
  BCWebStyleGuideChecker: { ruleVersion: "1.3.0", ruleBuild: "test-current-build" },
  canonicalUrl: value => String(value).split("#")[0],
  formatDate: value => new Date(value).toISOString(),
  normalizeSpace: value => String(value || "").replace(/\s+/g, " ").trim(),
  readyFeedbackNotes: () => []
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source.slice(typeStart, typeEnd)}\n${source.slice(labelStart, labelEnd)}\n${source.slice(browserStart, browserEnd)}\n${source.slice(reportStart, reportEnd)}\n${source.slice(batchStart, batchEnd)}\n${source.slice(csvStart, csvEnd)}\n${source.slice(captureStart, captureEnd)}\n;globalThis.feedbackTest = { feedbackSubject, feedbackReportText, feedbackMailtoHref, feedbackEmailBatchPlan, feedbackCsvRows, captureFeedbackContext, feedbackCapacityPromptKey, maybePromptFeedbackCapacity, csvHeader: FEEDBACK_CSV_HEADER };`, context);

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
assert.match(report, /Report build: test-current-build/);
assert.match(report, /Rules build when captured: Not recorded/, "Legacy notes must not be assigned the current build");
included.context.rulesBuild = "test-captured-build";
assert.match(context.feedbackTest.feedbackReportText([included]), /Rules build when captured: test-captured-build/);
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

const csv = context.feedbackTest.feedbackCsvRows([included, excluded]);
const buildColumn = context.feedbackTest.csvHeader.indexOf("Rules build");
assert.equal(csv[0][buildColumn], "test-captured-build");
assert.equal(csv[1][buildColumn], "", "Legacy CSV notes must not inherit the exporting build");
assert.equal(csv[0].length, context.feedbackTest.csvHeader.length);
context.captureLiveFeedbackContext = async () => ({});
context.hostnameFor = () => "example.gov.bc.ca";
context.reportScopeLabel = () => "Page content";
context.detectProfile = () => "standard";
context.state = { activeReport: { page: { title: "Old scan", url: "https://example.gov.bc.ca/" }, ruleVersion: "1.2.0", ruleBuild: "old-scan-build" } };
(async () => {
  const captured = await context.feedbackTest.captureFeedbackContext();
  assert.equal(captured.rulesVersion, "1.2.0", "Feedback about a saved scan must identify the rules that produced it");
  assert.equal(captured.rulesBuild, "old-scan-build");
  delete context.state.activeReport.ruleBuild;
  assert.equal((await context.feedbackTest.captureFeedbackContext()).rulesBuild, "", "Unrecorded scan builds must remain unknown");
  context.state.activeReport = null;
  assert.equal((await context.feedbackTest.captureFeedbackContext()).rulesBuild, "test-current-build");
  const capacity = context.feedbackTest.feedbackCapacityPromptKey;
  const boundaryPlan = { batch: [included], overflow: [], blocked: false, oversized: false, uriLength: 6150 };
  assert.equal(capacity(boundaryPlan), "", "Exactly 850 encoded characters remaining must not trigger the prompt");
  assert.equal(capacity({ ...boundaryPlan, uriLength: 6151 }), included.id, "849 characters remaining must trigger the prompt");
  assert.equal(capacity(plan), plan.batch[0].id, "A note crossing the email limit must still trigger the prompt");
  assert.equal(capacity(context.feedbackTest.feedbackEmailBatchPlan([])), "");
  const oversizedPlan = context.feedbackTest.feedbackEmailBatchPlan([note("huge", "漢字".repeat(2000))]);
  assert.equal(oversizedPlan.oversized, true);
  assert.equal(capacity(oversizedPlan), "huge", "Oversized individual notes must get an actionable prompt");

  let prompts = 0;
  context.state = { feedbackCapacityPromptKey: "" };
  context.document = { activeElement: null };
  context.requestAnimationFrame = callback => callback();
  context.elements = {
    "feedback-capacity-message": {},
    "feedback-capacity-send": {},
    "feedback-capacity-later": { focus() {} },
    "feedback-capacity-dialog": { showModal() { prompts += 1; } }
  };
  context.readyFeedbackNotes = () => verbose;
  context.feedbackTest.maybePromptFeedbackCapacity();
  context.feedbackTest.maybePromptFeedbackCapacity();
  assert.equal(prompts, 1, "Further saves in the same batch must not repeat the prompt");
  context.readyFeedbackNotes = () => plan.overflow;
  context.feedbackTest.maybePromptFeedbackCapacity();
  assert.equal(prompts, 2, "The next batch must be eligible for a prompt");
  context.readyFeedbackNotes = () => [note("huge", "漢字".repeat(2000))];
  context.feedbackTest.maybePromptFeedbackCapacity();
  assert.equal(context.elements["feedback-capacity-send"].textContent, "View saved feedback");

  // Exercise the save workflow: persistence must finish before closing or prompting.
  const saveStart = source.indexOf("async function saveFeedbackNote(event)");
  const saveEnd = source.indexOf("function feedbackCard", saveStart);
  vm.runInContext(source.slice(saveStart, saveEnd) + "\nglobalThis.saveFeedbackNoteForTest = saveFeedbackNote;", context);
  const events = [];
  let finishSave;
  context.state = { feedbackNotes: [], pendingFeedbackContext: included.context, reviewMode: "list" };
  Object.assign(context.elements, {
    "feedback-type": { value: "incorrect" }, "feedback-text": { value: "Preserve this note" },
    "feedback-important": { checked: false }, "feedback-context-section": { hidden: false },
    "feedback-include-context": { checked: true }
  });
  context.STORAGE_KEYS = { feedback: "feedback" };
  context.saveKey = () => new Promise(resolve => { finishSave = resolve; });
  context.closeFeedbackDialog = () => events.push("close");
  context.renderFeedback = () => {};
  context.showToast = () => {};
  context.maybePromptFeedbackCapacity = () => events.push("prompt");
  const saving = context.saveFeedbackNoteForTest({ preventDefault() {} });
  assert.equal(events.length, 0, "Do not close or prompt while storage is pending");
  finishSave();
  await saving;
  assert.deepEqual(events, ["close", "prompt"]);
  assert.equal(context.state.feedbackNotes[0].text, "Preserve this note");
  events.length = 0;
  context.saveKey = async () => { throw new Error("Storage unavailable"); };
  await context.saveFeedbackNoteForTest({ preventDefault() {} });
  assert.equal(context.state.feedbackNotes.length, 1, "Failed saves must not create phantom notes");
  assert.equal(events.length, 0, "A failed save must keep the form open without a capacity prompt");
  console.log("Feedback tests passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
