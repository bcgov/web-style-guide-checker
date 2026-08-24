"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "sidepanel.js"), "utf8");
const start = source.indexOf("function xmlEscape");
const end = source.indexOf("async function copyCurrentReport");
assert.ok(start >= 0 && end > start, "Workbook helpers must be present");

const context = { TextEncoder, Blob, showToast() {}, document: {}, URL: {} };
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\n;globalThis.workbookTest = { worksheetXml, zipStore };`, context);

const worksheet = context.workbookTest.worksheetXml([
  ["ID", "Issue", "Occurrences"],
  ["P001-001", "Use one H1", 2]
]);
assert.match(worksheet, /<pane ySplit="1"/);
assert.match(worksheet, /Use one H1/);
assert.match(worksheet, /<autoFilter/);

(async () => {
  const blob = context.workbookTest.zipStore([
    { name: "test.txt", data: "Workbook export" }
  ]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
  assert.deepEqual(Array.from(bytes.slice(-22, -18)), [0x50, 0x4b, 0x05, 0x06]);
  console.log("Workbook tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
