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

const context = {
  state: { activeReport: { settings: { profile: "standard", scope: "content" } } },
  workspaceSurface: false,
  effectiveStatus: () => "open",
  auditNote: () => ({ important: false, text: context.hostileText }),
  feedbackNotesForFinding: () => [],
  normalizeSpace: value => String(value || "").replace(/\s+/g, " ").trim(),
  hostileText: ""
};

const renderSource = [
  sourceBetween("function escapeHtml(value)", "function spreadsheetSafeText(value)"),
  sourceBetween("function sentenceLabel(value)", "function hostnameFor(value)"),
  sourceBetween("function highlightedEvidence(finding)", "function evidenceTextForExport(finding)"),
  sourceBetween("function renderedEvidence(finding)", "function renderFinding(finding)"),
  sourceBetween("function renderFinding(finding)", "function findingFromButton(button)")
].join("\n");

vm.runInNewContext(`${renderSource}\nthis.renderFinding = renderFinding; this.metadataDefinition = ${sourceBetween("function metadataDefinition(label, value)", "function renderPageDetails(section = \"overview\")")};`, context);

const hostile = `<img src="https://attacker.invalid/tracker" onerror="alert('x')"> & "quoted"`;
context.hostileText = hostile;
const rendered = context.renderFinding({
  ruleId: "hostile-test",
  severity: "review",
  fingerprint: hostile,
  title: hostile,
  responsibility: hostile,
  why: hostile,
  location: hostile,
  matchText: hostile,
  replacement: hostile,
  exceptionEligible: true,
  proposedPhrase: `${hostile} phrase`,
  evidence: `Before ${hostile} after`,
  suggestedTarget: hostile,
  diagnostics: [hostile],
  suggestion: hostile,
  selector: hostile,
  editorSource: { textareaId: hostile },
  sourceUrl: "https://www2.gov.bc.ca/gov/content/home/services-a-z",
  sourceLabel: hostile,
  occurrenceCount: 2
});

assert.doesNotMatch(rendered, /<img\b/i, "Hostile page text must not create an image element in a finding card");
assert.doesNotMatch(rendered, /onerror\s*=\s*["']/i, "Hostile page text must not create an event-handler attribute");
assert.match(rendered, /&lt;img/, "Hostile markup must remain visible as escaped text");

context.hostileText = "";
const acronymFinding = context.renderFinding({
  ruleId: "acronym-definition-format",
  severity: "check",
  fingerprint: "acronym-format",
  title: "Put the acronym in parentheses",
  responsibility: "Content",
  why: "The Web Style Guide places an acronym in parentheses immediately after the full term.",
  location: "Medical Services Plan",
  matchText: ", or MSP",
  evidence: "B.C. resident newborns must be enrolled in the Medical Services Plan, or MSP.",
  diagnostics: [],
  suggestion: "Change “, or MSP” to “(MSP)”.",
  selector: "p",
  occurrenceCount: 1
});
assert.doesNotMatch(acronymFinding, /Flagged wording/, "The acronym format card must rely on highlighted evidence instead of repeating a flagged-wording callout");
assert.doesNotMatch(acronymFinding, /What does not match/, "The acronym format card must not repeat its explanation in a diagnostic block");
assert.match(acronymFinding, /Change “, or MSP” to “\(MSP\)”\./, "The acronym format card must provide the exact correction once");

const metadata = context.metadataDefinition(hostile, hostile);
assert.doesNotMatch(metadata, /<img\b/i, "Hostile metadata must not create markup");
assert.match(metadata, /&lt;img/);

const innerHtmlSinks = source.match(/\.innerHTML\s*=/g) || [];
assert.equal(innerHtmlSinks.length, 30, "A new innerHTML sink requires an explicit rendering-security review and updated hostile-text coverage");

console.log("Rendering security tests passed");
