"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");

const manifest = JSON.parse(read("manifest.json"));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, "1.1.1");
assert.ok(manifest.optional_host_permissions.includes("http://*/*"));
assert.ok(manifest.optional_host_permissions.includes("https://*/*"));

const html = read("sidepanel.html");
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, "Side panel IDs must be unique");
const idSet = new Set(ids);
[...html.matchAll(/\b(?:aria-controls|aria-labelledby)="([^"]+)"/g)].forEach(match => {
  match[1].split(/\s+/).forEach(id => assert.ok(idSet.has(id), `ARIA reference missing ID: ${id}`));
});
[...html.matchAll(/<button\b([^>]*)>/g)].forEach(match => assert.match(match[1], /\btype=/, "Every button must declare its type"));

[
  "severity-filter",
  "filter-panel",
  "open-filter-button",
  "stale-report-banner",
  "permission-dialog",
  "permission-linked",
  "permission-all",
  "permission-revoke",
  "important-filter",
  "review-issues-button",
  "review-back-button",
  "next-issue-type",
  "more-dialog",
  "export-dialog",
  "page-details",
  "note-dialog",
  "download-current-workbook",
  "batch-export-links",
  "sort-order",
  "follow-page",
  "manual-review",
  "feedback-header-button",
  "feedback-view",
  "feedback-dialog",
  "feedback-list",
  "create-feedback-email",
  "copy-feedback-report",
  "export-feedback-csv"
].forEach(id => assert.ok(ids.includes(id), `Missing required control: ${id}`));

const reviewTabs = [...html.matchAll(/data-review-view="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(reviewTabs, ["review", "details"]);

const script = read("sidepanel.js");
const cacheBlock = script.match(/function cacheElements\(\) \{([\s\S]*?)\.forEach\(id/);
assert.ok(cacheBlock, "Element cache must be readable by the static test");
const cachedReferences = [...cacheBlock[1].matchAll(/"([a-z][a-z0-9-]+)"/g)].map(match => match[1]);
cachedReferences.forEach(id => assert.ok(ids.includes(id), `Element cache references missing ID: ${id}`));
const staticReferences = [...script.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map(match => match[1]);
staticReferences.forEach(id => assert.ok(ids.includes(id), `JavaScript references missing ID: ${id}`));
const elementReferences = [...script.matchAll(/elements\[["']([^"']+)["']\]/g)].map(match => match[1]);
elementReferences.forEach(id => assert.ok(ids.includes(id), `JavaScript element reference missing ID: ${id}`));
assert.doesNotMatch(script, /slice\(0,\s*100\)/, "HTTP link checks must not stop at 100 destinations");
assert.match(script, /credentials:\s*"omit"/, "Network verification must omit browser credentials");
assert.match(script, /Promise\.all\(Array\.from\(\{ length: Math\.min\(4, links\.length\) \}/, "Link queue must retain limited concurrency");
assert.match(script, /function downloadWorkbook\(/, "Workbook export must be available");
assert.match(script, /function groupedFindingTypes\(/, "Findings must be grouped into a flat issue-type overview");
assert.match(script, /function openRuleGroup\(/, "Issue types must open in the focused review view");
assert.match(script, /function jumpIssueType\(/, "Issue-type navigation must be available");
assert.match(script, /items\.findIndex\(\(finding, index\) => index > state\.guidedIndex && finding\.ruleId !== current\.ruleId\)/, "Skipping must continue with the next issue type in the review sequence");
assert.match(script, /function handleTablistKeys\(/, "Tab lists must support keyboard navigation");
assert.match(script, /auditNotesV1/, "Audit notes must use local extension storage");
assert.match(script, /feedbackNotesV1/, "Feedback notes must use local extension storage");
assert.match(script, /function captureFeedbackContext\(/, "Feedback must capture diagnostic and page context");
assert.match(script, /function feedbackReportText\(/, "Feedback must provide a readable bulk report");
assert.match(script, /function createFeedbackEmail\(/, "Feedback must provide an explicit email-draft action");
assert.match(script, /function downloadTextFile\(/, "Long feedback reports must be downloadable for attachment");
assert.match(script, /julia\.ready@gov\.bc\.ca/, "Julia must receive prepared feedback emails");
assert.match(script, /karmen\.abrahams-munroe@gov\.bc\.ca/, "Karmen must receive prepared feedback emails");
assert.match(script, /Web Style Guide Checker feedback — v/, "Feedback email subjects must use the agreed syntax");
assert.match(script, /document\.body\.dataset\.surface = workspaceSurface/, "Panel and workspace layouts must be explicit");
const decisionFunction = script.match(/async function setDecision\([\s\S]*?\n\}/);
assert.ok(decisionFunction, "Review decision handler must exist");
assert.match(decisionFunction[0], /nextInGroup/, "Review decisions must advance to the next finding");
assert.match(script, /Follow findings on page|follow-page/, "Guided review must expose automatic page following");
assert.match(script, /highlightSelector\(finding\.selector, true, false\)/, "Automatic page following must highlight without activating another tab");
assert.match(script, /elements\["manual-review"\]\.hidden = section !== "overview"/, "The manual checklist must appear only on the Page details overview");
assert.match(script, /elements\["sort-order"\]\.value === "page"/, "Findings must support page-order sorting");
assert.match(script, /continueAfterAllowedTerm/, "Allowed terms must rebase the active review queue");
assert.match(script, /groups\.flatMap\(item => item\.findings\.map/, "Guided review must use one continuous cross-type sequence");
assert.match(script, /state\.guidedIndex === 0/, "Previous must remain available until the start of the continuous sequence");
assert.match(script, /chrome\.permissions\.request\(\{ origins \}\)/, "Link checking must request access to linked sites");
assert.match(script, /state:\s*"permission-denied"/, "Declined link access must be reported clearly");
assert.match(script, /savedExceptions\.filter/, "Unsafe saved exceptions must be removed during migration");
assert.match(script, /classList\.toggle\("is-placeholder", atLastInType\)/, "Finding navigation must retain its layout at the end of an issue type");
assert.doesNotMatch(script, /<summary>More actions<\/summary>/, "Exact-term actions must remain visible");
assert.match(script, /"Where on the page", "Category", "Issue", "Why it matters", "Recommended action"/, "Action reports must use plain-language columns");

const core = read("checker-core.js");
assert.match(core, /const RULE_VERSION = "1\.1\.1"/);
assert.match(core, /‘BC’ by itself cannot be allowed/, "Bare BC must be rejected as an allowed term");
assert.match(core, /function isCmsLiteTemplateImage\(/, "CMS Lite template images must be identifiable");
assert.match(core, /pageOrder:/, "Findings must retain document order");
assert.match(core, /shouldFlagReadingGrade\(grade\)/, "Reading-level findings must use the Grade 9 threshold helper");
assert.doesNotMatch(core, /querySelectorAll\("a\[href\]"\)\)\.filter\(isVisible\)\.slice\(/, "Page audit must retain every visible link");
assert.doesNotMatch(core + script, /cke_wysiwyg_frame|cke_editable/, "CMS Lite draft-editor support is intentionally outside this release");
[
  "file-link-size-spacing",
  "file-link-label-format",
  "link-trailing-space",
  "missing-space-after-ampersand",
  "bold-link",
  "all-caps",
  "at-symbol",
  "image-alt-empty"
].forEach(rule => assert.match(core, new RegExp(`"${rule}"`), `Missing rule: ${rule}`));
["government-capitalization", "heading-dash", "heading-parentheses", "heading-colon-case", "image-alt-length", "image-alt-prefix", "time-zone", "currency-cents", "canadian-spelling", "canadian-spelling-context", "list-introduction"].forEach(rule => {
  assert.match(core, new RegExp(`"${rule}"`), `Missing updated-guide rule: ${rule}`);
});
assert.match(core, /function comparisonText\(/, "Hidden formatting characters must be ignored during exact heading comparison");
["main-landmark", "skip-link-target", "disclosure-state", "broken-image", "staging-url"].forEach(rule => assert.match(core, new RegExp(`"${rule}"`), `Missing structural rule: ${rule}`));

const css = read("sidepanel.css");
assert.match(css, /@font-face\s*\{[\s\S]*BC Sans/);
assert.match(css, /--navy:\s*#013366/i);
assert.match(css, /--gold:\s*#fcba19/i);
assert.match(css, /--gold-focus:\s*#ffc000/i);
assert.match(css, /\.issue-row/);
assert.match(css, /body\[data-surface="workspace"\]/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);

["fonts/BCSans-Regular.woff2", "fonts/BCSans-Bold.woff2", "fonts/LICENSE_OFL.txt"].forEach(name => {
  assert.ok(fs.statSync(path.join(root, name)).size > 1000, `Missing or empty bundled asset: ${name}`);
});
["icons/icon-16.png", "icons/icon-32.png", "icons/icon-48.png", "icons/icon-128.png"].forEach(name => {
  assert.ok(fs.statSync(path.join(root, name)).size > 250, `Missing or empty icon: ${name}`);
});

console.log("Static build tests passed");
