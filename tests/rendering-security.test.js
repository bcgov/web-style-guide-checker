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
assert.ok(rendered.indexOf('class="finding-evidence"') < rendered.indexOf('class="suggestion"'), "Evidence must appear before the suggested action");
assert.ok(rendered.indexOf('class="finding-diagnostics"') < rendered.indexOf('class="suggestion"'), "Actionable diagnostic details must appear before the suggested action");
assert.match(rendered, /<section class="finding-details"/, "Supporting details and tools must be a visible section");
assert.doesNotMatch(rendered, /<details class="finding-details"/, "Supporting details must not require expanding a disclosure");

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

const longEvidence = `First TOKEN. ${"Earlier content. ".repeat(40)}Chosen context TOKEN ${hostile} ${"Later content. ".repeat(30)}`;
const longFinding = { evidence: longEvidence, matchText: "TOKEN", evidenceMatchIndex: -1, matchIndex: longEvidence.lastIndexOf("TOKEN") };
const longRendered = context.renderedEvidence(longFinding);
const preview = longRendered.slice(0, longRendered.indexOf('<details class="evidence-details">'));
assert.match(preview, /Chosen context <mark>TOKEN<\/mark>/, "Long evidence must preview the requested occurrence, including when an earlier occurrence exists");
assert.doesNotMatch(preview, /First TOKEN/, "The preview must stay near the requested occurrence");
assert.match(longRendered, /Read full evidence/, "Long evidence must remain available through an explicit control");
assert.doesNotMatch(longRendered, /<img\b/i, "Both the evidence preview and full evidence must escape hostile text");
assert.equal(longFinding.evidence, longEvidence, "Preview rendering must preserve the full stored evidence");

const structuredRendered = context.renderedEvidence({ evidenceLines: [hostile, `Link 1: ${hostile} → https://example.com/example`] });
assert.match(structuredRendered, /class="structured-evidence-links"/, "Structured evidence must show its full link details");
assert.doesNotMatch(structuredRendered, /<details/, "Actionable link evidence must remain visible without expansion");
assert.doesNotMatch(structuredRendered, /<img\b/i, "Structured evidence must escape hostile text");

const diagnosticRendered = context.renderedFindingDiagnostics({ ruleId: "on-this-page-links", diagnosticItems: [{ label: hostile, target: hostile, detail: hostile }], diagnostics: [] });
assert.doesNotMatch(diagnosticRendered, /<img\b/i, "Structured mismatch labels, targets and details must escape hostile text");
assert.match(diagnosticRendered, /&lt;img/, "Structured mismatch evidence must remain available as escaped text");

const missingAnchorRendered = context.renderedEvidence({ ruleId: "broken-anchor", evidence: `Access → #access ${hostile}`, diagnosticItems: [{ kind: "missing-target", detail: hostile }] });
assert.match(missingAnchorRendered, /anchor-evidence-status/, "Missing targets must have an explicit visible evidence message");
assert.doesNotMatch(missingAnchorRendered, /<img\b/i, "Missing-target evidence and detail must escape hostile text");

const metadata = context.metadataDefinition(hostile, hostile);
assert.doesNotMatch(metadata, /<img\b/i, "Hostile metadata must not create markup");
assert.match(metadata, /&lt;img/);

const unverifiedContrast = context.renderFinding({
  ruleId: "contrast-unverified", severity: "review", fingerprint: "contrast-example",
  title: "Check the text contrast manually", why: "The checker could not reliably measure this text against its background.",
  evidence: "SERVICES", suggestion: "Use a contrast checker to compare the text colour with the background.",
  contrast: { status: "unverified", reason: hostile }
});
assert.equal((unverifiedContrast.match(/manually/g) || []).length, 1);
assert.doesNotMatch(unverifiedContrast, /Manual verification needed|Manual check needed|<img\b/i);
assert.match(unverifiedContrast, /Background or effect:/);
assert.match(unverifiedContrast, /&lt;img/);

const innerHtmlSinks = source.match(/\.innerHTML\s*=/g) || [];
assert.equal(innerHtmlSinks.length, 30, "A new innerHTML sink requires an explicit rendering-security review and updated hostile-text coverage");

console.log("Rendering security tests passed");

// Heading summaries must distinguish an empty outline from clean findings.
const headingSummarySource = sourceBetween('function headingSummaryText(', 'function renderPageDetails(');
const headingContext = {};
vm.runInNewContext(headingSummarySource + '\nthis.summary = headingSummaryText;', headingContext);
assert.equal(headingContext.summary([], []), 'No headings found');
assert.equal(headingContext.summary([{ flags: [] }]), 'No heading issues detected');
assert.equal(headingContext.summary([{ flags: ['Skipped level'] }]), '1 heading flagged');
assert.equal(headingContext.summary([], [{}, {}]), 'No authored headings found · 2 accordion headings');
