"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "sidepanel.js"), "utf8");
const start = source.indexOf("function xmlEscape");
const end = source.indexOf("const BATCH_METADATA_HEADER");
assert.ok(start >= 0 && end > start, "Workbook helpers must be present");

const context = { TextEncoder, Blob, showToast() {}, document: {}, URL: {} };
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\n;globalThis.workbookTest = { worksheetXml, worksheetRelationshipsXml, zipStore, buildWorkbookBlob };`, context);

const worksheet = context.workbookTest.worksheetXml({
  name: "Findings detail",
  rows: [
    ["ID", "Issue", "Occurrences"],
    ["P001-F001", "Use one H1", 2]
  ],
  filterRow: 1
});
assert.doesNotMatch(worksheet, /<pane /, "Workbook sheets must not freeze panes");
assert.match(worksheet, /Use one H1/);
assert.match(worksheet, /<autoFilter ref="A1:C2"\/>/);
assert.match(worksheet, /s="1"/, "Data-sheet header row must use the header style");
assert.doesNotMatch(worksheet, /<mergeCells/, "Data sheets must not merge cells");

const summary = context.workbookTest.worksheetXml({
  name: "Summary",
  rows: [
    { values: ["B.C. Web Style Guide review"], kind: "title" },
    { values: ["Automated review profile"], kind: "section" },
    { values: ["Accessibility", "Nothing flagged", "—"], kind: "status-nothing-flagged" }
  ]
});
assert.doesNotMatch(summary, /<autoFilter/, "Summary sheets should not behave like data tables");
assert.match(summary, /s="8"/, "Nothing flagged must use the neutral status style");
const wrapped = context.workbookTest.worksheetXml({
  name: "Summary",
  widths: [28],
  rows: [{ values: ["Automated findings identify items to review; they are not confirmed compliance failures and should be interpreted with context."], kind: "note" }]
});
assert.match(wrapped, /ht="(?:36|54|72)"/, "Long wrapped rows must receive enough height to remain readable");

const hyperlinkSheet = {
  name: "Links",
  rows: [
    ["Page", "URL"],
    ["Example", "https://www2.gov.bc.ca/gov/content/example?x=1&y=2"]
  ],
  filterRow: 1
};
const hyperlinkXml = context.workbookTest.worksheetXml(hyperlinkSheet);
assert.match(hyperlinkXml, /<hyperlink ref="B2" r:id="rId1"\/>/, "URL cells must be real workbook hyperlinks");
assert.match(hyperlinkXml, /r:id="rId1"/, "Hyperlinks must use worksheet relationships");
assert.match(hyperlinkXml, /<c r="B2"[^>]*s="9"/, "URL cells must use the visible hyperlink style");
const hyperlinkRelationships = context.workbookTest.worksheetRelationshipsXml(hyperlinkSheet);
assert.match(hyperlinkRelationships, /TargetMode="External"/);
assert.match(hyperlinkRelationships, /x=1&amp;y=2/, "Hyperlink relationship targets must be XML escaped");

(async () => {
  const blob = context.workbookTest.buildWorkbookBlob([
    { name: "Summary", rows: [{ values: ["B.C. Web Style Guide review"], kind: "title" }] },
    { name: "Findings detail", rows: [["ID", "Issue", "Guidance"], ["P001-F001", "Use one H1", "https://www2.gov.bc.ca/guide"]], filterRow: 1 }
  ]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
  assert.deepEqual(Array.from(bytes.slice(-22, -18)), [0x50, 0x4b, 0x05, 0x06]);
  const zipText = new TextDecoder().decode(bytes);
  assert.match(zipText, /xl\/worksheets\/_rels\/sheet2\.xml\.rels/, "Workbook ZIP must include hyperlink relationship files when needed");
  assert.match(zipText, /relationships\/hyperlink/, "Workbook ZIP must retain external hyperlink relationships");
  console.log("Workbook tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
