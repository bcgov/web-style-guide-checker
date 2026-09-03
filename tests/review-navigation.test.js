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
  URL,
  state: {
    guidedIndex: 0,
    guidedFingerprint: "",
    selectedRuleId: "",
    skippedRuleIds: new Set(),
    skippedFingerprints: new Set(),
    decisions: {},
    decisionMessage: "",
    pendingDecision: null,
    locateOnNextRender: false,
    activePageKey: "page-1",
    activeReport: { issues: [] }
  },
  queue: [],
  renderCount: 0,
  closeCount: 0,
  persisted: 0,
  toast: "",
  findingScrollBlock: "",
  confirmationScrollBlock: "",
  hasConfirmation: false,
  findingFocusedWithoutScroll: false,
  elements: {
    "guided-finding": {
      querySelector: selector => {
        if (selector === ".action-confirmation" && context.hasConfirmation) return {
          scrollIntoView: options => { context.confirmationScrollBlock = options.block; }
        };
        if (selector === ".finding") return {
          scrollIntoView: options => { context.findingScrollBlock = options.block; },
          focus: options => { context.findingFocusedWithoutScroll = options.preventScroll; }
        };
        return null;
      }
    }
  },
  chrome: {
    runtime: {
      getURL: path => `chrome-extension://checker-id/${path}`
    }
  },
  guidedFindings: () => context.queue.filter(finding => !context.state.skippedFingerprints.has(finding.fingerprint)),
  effectiveStatus() { return "open"; },
  findingAmount(finding) { return finding.occurrenceCount || 1; },
  renderReviewView: () => { context.renderCount += 1; },
  closeFindingReview: () => { context.closeCount += 1; },
  persistReviewContext: () => { context.persisted += 1; return Promise.resolve(); },
  showToast: message => { context.toast = message; }
};
context.globalThis = context;

const functions = [
  sourceBetween("function skipRemainingIssueType()", "function restoreSkippedIssueTypes()"),
  sourceBetween("function restoreSkippedIssueTypes()", "function openRuleGroup("),
  sourceBetween("function resetGuidedFindingPosition()", "function renderGuidedReview(")
].join("\n");
vm.runInNewContext(`${functions}\nthis.skipRemainingIssueType = skipRemainingIssueType; this.restoreSkippedIssueTypes = restoreSkippedIssueTypes; this.resetGuidedFindingPosition = resetGuidedFindingPosition;`, context);

const workspaceContext = { URL, chrome: context.chrome };
vm.runInNewContext(`${sourceBetween("function isExtensionWorkspaceTab(tab)", "async function currentReviewTab()") }\nthis.isExtensionWorkspaceTab = isExtensionWorkspaceTab;`, workspaceContext);
assert.equal(workspaceContext.isExtensionWorkspaceTab({ url: "chrome-extension://checker-id/sidepanel.html?workspace=1&view=current" }), true, "The side panel must recognize its own full-tab workspace");
assert.equal(workspaceContext.isExtensionWorkspaceTab({ url: "chrome-extension://checker-id/sidepanel.html" }), false, "The ordinary side-panel document is not a full-tab workspace");
assert.equal(workspaceContext.isExtensionWorkspaceTab({ url: "chrome-extension://another-extension/sidepanel.html?workspace=1" }), false, "Another extension's page must not inherit the reviewed page context");
assert.equal(workspaceContext.isExtensionWorkspaceTab({ url: "https://example.com/sidepanel.html?workspace=1" }), false);

function reviewTabContext(activeTab, sourceTab) {
  const tabContext = {
    URL,
    workspaceSurface: false,
    state: { lastReviewTabId: 42 },
    chrome: {
      runtime: context.chrome.runtime,
      tabs: {
        query: async () => [activeTab],
        get: async tabId => {
          assert.equal(tabId, 42);
          if (!sourceTab) throw new Error("Tab not found");
          return sourceTab;
        }
      }
    }
  };
  vm.runInNewContext(`${sourceBetween("async function currentTab()", "function isScannableUrl(url)")}\nthis.currentReviewTab = currentReviewTab;`, tabContext);
  return tabContext;
}

const finding = (fingerprint, ruleId) => ({ fingerprint, ruleId, occurrenceCount: 1 });
context.queue = [finding("a-1", "a"), finding("b-1", "b"), finding("a-2", "a"), finding("c-1", "c")];
context.state.activeReport.issues = context.queue;

context.skipRemainingIssueType();
assert.deepEqual(Array.from(context.state.skippedRuleIds), ["a"], "The current issue type must be skipped for this review only");
assert.deepEqual(Array.from(context.state.skippedFingerprints), ["a-1", "a-2"], "Only the current and later findings of that type must leave the guided queue");
assert.deepEqual(context.state.decisions, {}, "Skipping must not ignore or resolve any finding");
assert.equal(context.state.guidedFingerprint, "b-1", "Page-order review must continue at the next finding of another type");
assert.equal(context.state.selectedRuleId, "b");
assert.equal(context.state.guidedIndex, 0, "The guided index must be rebased after skipped findings leave the queue");
assert.match(context.state.decisionMessage, /2 findings of this type skipped/);
assert.equal(context.renderCount, 1);

context.restoreSkippedIssueTypes();
assert.equal(context.state.skippedRuleIds.size, 0, "Skipped issue types must be easy to include again");
assert.equal(context.state.skippedFingerprints.size, 0);
assert.match(context.toast, /included in this review again/);

context.queue = [finding("a-1", "a"), finding("b-1", "b"), finding("a-2", "a"), finding("c-1", "c")];
context.state.activeReport.issues = context.queue;
context.state.guidedIndex = 2;
context.state.skippedRuleIds.clear();
context.state.skippedFingerprints.clear();
context.skipRemainingIssueType();
assert.deepEqual(Array.from(context.state.skippedFingerprints), ["a-2"], "Earlier findings of the same type must remain in the review history");
assert.equal(context.state.guidedFingerprint, "c-1");

context.queue = [finding("a-1", "a"), finding("a-2", "a")];
context.state.activeReport.issues = context.queue;
context.state.guidedIndex = 0;
context.state.skippedRuleIds.clear();
context.state.skippedFingerprints.clear();
context.skipRemainingIssueType();
assert.equal(context.closeCount, 1, "Skipping the final issue type must return to the findings list");
assert.match(context.toast, /They remain open/);
assert.deepEqual(context.state.decisions, {}, "The final skipped issue type must also remain open");

context.resetGuidedFindingPosition();
assert.equal(context.findingScrollBlock, "start", "Each newly displayed finding must place its card beneath the sticky tabs");
assert.equal(context.findingFocusedWithoutScroll, true, "Keyboard focus must move to the newly displayed finding without undoing the card alignment");

context.hasConfirmation = true;
context.resetGuidedFindingPosition();
assert.equal(context.confirmationScrollBlock, "start", "A review confirmation must remain visible beneath the sticky tabs");
assert.equal(context.findingFocusedWithoutScroll, true, "Showing a confirmation must retain keyboard focus on the finding");

(async () => {
  const sourceTab = { id: 42, url: "https://www2.gov.bc.ca/gov/content/example" };
  const ownWorkspace = { id: 99, url: "chrome-extension://checker-id/sidepanel.html?workspace=1&view=current" };
  assert.equal((await reviewTabContext(ownWorkspace, sourceTab).currentReviewTab()).id, 42, "Page actions must continue targeting the source webpage while the workspace is active");

  const regularPage = { id: 7, url: "https://example.com/page" };
  assert.equal((await reviewTabContext(regularPage, sourceTab).currentReviewTab()).id, 7, "Ordinary tab changes must continue following the active webpage");

  const missingSource = await reviewTabContext(ownWorkspace, null).currentReviewTab();
  assert.equal(missingSource, null, "The extension workspace must never become a scan target when its source tab has closed");

  console.log("Review navigation tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
