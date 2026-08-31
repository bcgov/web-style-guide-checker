"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "sidepanel.js"), "utf8");
const stateStart = source.indexOf("const STORAGE_KEYS");
const stateEnd = source.indexOf("async function currentTab()");
const helperStart = source.indexOf("function batchHasIncompletePageScan()");
const helperEnd = source.indexOf("function batchLinkPermissionModeFromUi()", helperStart);
assert.ok(stateStart >= 0 && stateEnd > stateStart && helperStart >= 0 && helperEnd > helperStart, "Batch state helpers must be testable");

let storedBatch = null;
let savedBatch = null;
const context = {
  URL,
  URLSearchParams,
  location: { search: "" },
  document: { getElementById: () => null },
  navigator: {},
  console,
  setTimeout,
  clearTimeout,
  chrome: {
    storage: {
      local: {
        get: async () => storedBatch ? { lastBatchV2: storedBatch } : {},
        set: async value => { if (value.lastBatchV2) savedBatch = value.lastBatchV2; }
      }
    }
  },
  globalThis: null
};
context.globalThis = context;
context.BCWebStyleGuideChecker = {
  helpers: {
    normalizeSpace: value => String(value || "").replace(/\s+/g, " ").trim(),
    canonicalUrl: value => String(value || "")
  }
};
vm.createContext(context);
vm.runInContext(`${source.slice(stateStart, stateEnd)}\n${source.slice(helperStart, helperEnd)}\n;globalThis.batchTest={state,loadState,batchStorageValue,persistBatchState,batchHasIncompletePageScan};`, context);

(async () => {
  storedBatch = {
    urls: ["https://example.com/1", "https://example.com/2", "https://example.com/3"],
    records: [{ submittedUrl: "https://example.com/1", status: "complete", report: {} }],
    currentIndex: 0,
    phase: "scanning",
    checkLinks: true,
    linkPermissionMode: "found",
    settings: { scope: "content", canControlColour: true },
    exportPreset: "full",
    customSheets: [],
    includeReviewed: false
  };
  await context.batchTest.loadState();
  assert.equal(context.batchTest.state.batch.phase, "paused", "A page scan interrupted between pages must restore as paused, not complete");
  assert.equal(context.batchTest.batchHasIncompletePageScan(), true, "An interrupted page scan must be resumable");
  assert.equal(context.batchTest.state.batch.records.length, 1);

  storedBatch = {
    ...storedBatch,
    records: storedBatch.urls.map(url => ({ submittedUrl: url, status: "complete", report: {} })),
    currentIndex: 2,
    phase: "links"
  };
  await context.batchTest.loadState();
  assert.equal(context.batchTest.state.batch.phase, "link-permission", "An interrupted link phase should preserve page results and return to a safe resume/permission step");
  assert.equal(context.batchTest.batchHasIncompletePageScan(), false);

  context.batchTest.state.batch.downloaded = true;
  context.batchTest.state.batch.downloadFilename = "bc-web-style-batch-2026-08-28.xlsx";
  await context.batchTest.persistBatchState();
  assert.equal(savedBatch.downloaded, true);
  assert.equal(savedBatch.downloadFilename, "bc-web-style-batch-2026-08-28.xlsx");
  assert.equal(savedBatch.urls.length, 3, "Persisted batch state must retain the original URL list");
  assert.equal(savedBatch.records.length, 3, "Persisted batch state must retain completed page records");

  console.log("Batch state tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
