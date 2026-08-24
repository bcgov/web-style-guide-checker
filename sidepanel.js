"use strict";

const STORAGE_KEYS = {
  reports: "reportsV2",
  decisions: "decisionsV2",
  exceptions: "exceptionsV2",
  domains: "domainSettingsV2",
  batch: "lastBatchV2",
  notes: "auditNotesV1",
  feedback: "feedbackNotesV1",
  reviewContexts: "reviewContextsV1",
  navigation: "reviewNavigationV1"
};

const MAX_REPORTS = 20;
const MAX_BATCH_URLS = 100;
const BATCH_TIMEOUT_MS = 45000;
const FEEDBACK_RECIPIENTS = ["julia.ready@gov.bc.ca", "karmen.abrahams-munroe@gov.bc.ca"];
const FEEDBACK_TYPES = {
  incorrect: "Incorrect or confusing finding",
  missed: "Missed issue",
  problem: "Extension problem",
  suggestion: "Suggestion",
  other: "Other"
};
const MAILTO_REPORT_LIMIT = 6000;
const surfaceParams = new URLSearchParams(location.search);
const workspaceSurface = surfaceParams.get("workspace") === "1";

const state = {
  activeTab: null,
  activeReport: null,
  reports: {},
  decisions: {},
  exceptions: [],
  notes: {},
  feedbackNotes: [],
  reviewContexts: {},
  domainSettings: {},
  currentView: "current",
  reviewView: "review",
  reviewMode: "list",
  guidedIndex: 0,
  guidedFingerprint: "",
  selectedRuleId: "",
  detailQueue: [],
  decisionMessage: "",
  pageDetailSection: "overview",
  selectedSection: null,
  activePageKey: "",
  pendingDecision: null,
  locateOnNextRender: false,
  overlayMode: "",
  overlayTabId: null,
  manualReportKey: "",
  linkCheckRunning: false,
  linkCheckPaused: false,
  linkCheckCancelled: false,
  linkCheckWaiters: [],
  collapsedFindingGroups: new Set(),
  lastReviewTabId: null,
  lastReviewPageKey: "",
  batch: {
    running: false,
    paused: false,
    cancelled: false,
    urls: [],
    records: [],
    currentIndex: -1,
    tempTabId: null
  },
  pendingExceptionFinding: null,
  pendingNoteFinding: null,
  pendingFeedbackId: "",
  pendingFeedbackContext: null,
  preparedFeedbackIds: [],
  feedbackPreviousView: "current",
  feedbackPreviousScroll: 0,
  feedbackReturnFocus: null
};

const elements = {};

function $(id) { return document.getElementById(id); }

function cacheElements() {
  [
    "active-page-label", "return-review-button", "feedback-header-button", "feedback-header-count", "profile-badge", "colour-control-row", "colour-control", "scope-note", "scan-button", "scan-permission-button", "cache-note",
    "scan-settings", "cancel-settings-button", "scan-context-title", "scan-context-details", "change-scan-button", "stale-report-banner",
    "cms-lite-settings", "cms-whole-scan", "standard-scope-settings", "choose-section-button", "clear-section-button", "section-scope-label",
    "current-loading", "current-error", "current-error-message", "current-results", "copy-button", "csv-button",
    "counts", "rescan-button", "status-filter", "severity-filter", "category-filter", "sort-order", "important-filter", "showing-count",
    "filter-panel", "filter-count", "active-filters", "clear-filters", "open-filter-button", "filter-close",
    "list-controls", "list-review-panel", "guided-review-panel", "page-details-panel", "findings", "manual-checks",
    "findings-tab-count", "review-issues-button", "view-reviewed-button", "reviewed-count", "review-back-button",
    "guided-progress", "guided-finding", "guided-previous", "guided-next", "follow-page-control", "follow-page", "workspace-review-note", "page-details", "manual-review",
    "previous-issue-type", "next-issue-type", "current-issue-type",
    "current-export-findings", "current-export-metadata", "current-export-stats", "current-export-links", "current-export-reviewed",
    "download-current-workbook", "download-current-action-csv",
    "batch-csv-button", "batch-urls", "batch-validation", "batch-scope", "batch-colour-control", "batch-include-reviewed",
    "batch-export-findings", "batch-export-metadata", "batch-export-stats", "batch-export-links",
    "batch-start-button", "batch-pause-button", "batch-cancel-button", "batch-progress-panel", "batch-progress-label",
    "batch-progress-count", "batch-progress", "batch-error", "batch-error-message", "batch-results",
    "personal-term-count", "personal-terms", "built-in-terms-list", "exception-dialog", "exception-form",
    "exception-rule-name", "exception-phrase", "exception-validation", "exception-cancel", "section-dialog", "section-list", "section-cancel",
    "permission-dialog", "permission-close", "permission-linked", "permission-all", "permission-revoke", "permission-status", "settings-permission-button",
    "note-dialog", "note-form", "note-finding-name", "note-important", "note-text", "note-cancel", "toast",
    "feedback-view", "feedback-back-button", "feedback-ready-count", "add-feedback-button", "feedback-empty", "feedback-list", "feedback-send-panel", "feedback-send-status",
    "create-feedback-email", "copy-feedback-report", "export-feedback-csv", "archived-feedback", "archived-feedback-count", "archived-feedback-list",
    "feedback-dialog", "feedback-form", "feedback-dialog-heading", "feedback-dialog-close", "feedback-type", "feedback-text", "feedback-important",
    "feedback-context-section", "feedback-include-context", "feedback-context-preview", "feedback-cancel", "feedback-email-dialog", "feedback-email-close",
    "archive-prepared-feedback", "keep-prepared-feedback",
    "more-dialog", "more-menu-button", "more-close", "open-workspace-button", "open-feedback-button", "open-batch-button", "open-settings-button",
    "export-dialog", "export-close"
  ].forEach(id => { elements[id] = $(id); });
}

function normalizeSpace(value) {
  return globalThis.BCWebStyleGuideChecker.helpers.normalizeSpace(value);
}

function canonicalUrl(value) {
  return globalThis.BCWebStyleGuideChecker.helpers.canonicalUrl(value);
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? "" : value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
}

function csvCell(value) {
  return `"${String(value === undefined || value === null ? "" : value).replace(/"/g, '""')}"`;
}

function formatDate(value) {
  try { return new Date(value).toLocaleString(); } catch (_) { return String(value || ""); }
}

function sentenceLabel(value) {
  const textValue = String(value || "");
  return textValue ? textValue.charAt(0).toUpperCase() + textValue.slice(1).replace(/-/g, " ") : "";
}

function hostnameFor(value) {
  try { return new URL(value).hostname.toLowerCase(); } catch (_) { return ""; }
}

function originPattern(value) {
  const url = new URL(value);
  if (url.protocol === "file:") return "file:///*";
  return `${url.protocol}//${url.host}/*`;
}

async function requestPagePermission(url) {
  const origins = [originPattern(url)];
  if (await chrome.permissions.contains({ origins })) return true;
  return chrome.permissions.request({ origins });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => { elements.toast.hidden = true; }, 1800);
}

async function loadState() {
  const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  state.reports = stored[STORAGE_KEYS.reports] || {};
  state.decisions = stored[STORAGE_KEYS.decisions] || {};
  const savedExceptions = stored[STORAGE_KEYS.exceptions] || [];
  state.exceptions = savedExceptions.filter(item => !(item.ruleId === "bc-abbreviation" && normalizeSpace(item.phrase) === "BC"));
  if (state.exceptions.length !== savedExceptions.length) await saveKey(STORAGE_KEYS.exceptions, state.exceptions);
  state.notes = stored[STORAGE_KEYS.notes] || {};
  state.feedbackNotes = Array.isArray(stored[STORAGE_KEYS.feedback]) ? stored[STORAGE_KEYS.feedback] : [];
  state.reviewContexts = stored[STORAGE_KEYS.reviewContexts] || {};
  state.domainSettings = stored[STORAGE_KEYS.domains] || {};
  const navigation = stored[STORAGE_KEYS.navigation] || {};
  state.lastReviewTabId = navigation.tabId || null;
  state.lastReviewPageKey = navigation.pageKey || "";
  if (stored[STORAGE_KEYS.batch] && Array.isArray(stored[STORAGE_KEYS.batch].records)) {
    state.batch.records = stored[STORAGE_KEYS.batch].records;
    state.batch.urls = stored[STORAGE_KEYS.batch].urls || [];
  }
}

async function saveKey(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

async function currentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function currentReviewTab() {
  if (workspaceSurface && state.lastReviewTabId) {
    try { return await chrome.tabs.get(state.lastReviewTabId); } catch (_) {}
  }
  return currentTab();
}

function isScannableUrl(url) {
  return /^https?:\/\//i.test(url || "") || /^file:\/\//i.test(url || "");
}

function detectProfile(url) {
  return globalThis.BCWebStyleGuideChecker.helpers.detectProfile(url, "auto");
}

function defaultSettings(url) {
  const hostname = hostnameFor(url);
  const profile = detectProfile(url);
  const saved = state.domainSettings[hostname] || {};
  return {
    scope: profile === "cms-lite" ? "content" : (saved.scope || "content"),
    profile,
    canControlColour: typeof saved.canControlColour === "boolean" ? saved.canControlColour : profile !== "cms-lite"
  };
}

function selectedSettings() {
  const profile = detectProfile((state.activeTab && state.activeTab.url) || "");
  const scope = profile === "cms-lite"
    ? (elements["cms-whole-scan"].checked ? "whole" : "content")
    : ((document.querySelector("input[name='scope']:checked") || {}).value || "content");
  return {
    scope,
    profile,
    canControlColour: profile === "cms-lite" ? false : elements["colour-control"].checked,
    sectionSelector: scope === "content" && state.selectedSection ? state.selectedSection.selector : ""
  };
}

async function saveDomainSettings() {
  if (!state.activeTab) return;
  const hostname = hostnameFor(state.activeTab.url);
  if (!hostname) return;
  const settings = selectedSettings();
  state.domainSettings[hostname] = { scope: settings.scope, canControlColour: settings.canControlColour };
  await saveKey(STORAGE_KEYS.domains, state.domainSettings);
}

function applySettings(settings) {
  const scopeInput = document.querySelector(`input[name='scope'][value='${settings.scope}']`);
  if (scopeInput) scopeInput.checked = true;
  elements["cms-whole-scan"].checked = settings.scope === "whole";
  elements["colour-control"].checked = settings.canControlColour;
  updateSettingsExplanation();
}

function updateSettingsExplanation() {
  const settings = selectedSettings();
  const isCmsLite = settings.profile === "cms-lite";
  elements["profile-badge"].textContent = isCmsLite ? "CMS Lite detected" : "Standard website";
  elements["cms-lite-settings"].hidden = !isCmsLite;
  elements["standard-scope-settings"].hidden = isCmsLite;
  elements["colour-control-row"].hidden = settings.scope === "whole" || isCmsLite;
  if (settings.scope === "whole") {
    elements["scope-note"].textContent = "The scan includes navigation, footer, templates, controls and colour contrast.";
  } else if (isCmsLite) {
    elements["scope-note"].textContent = "The scan focuses on the CMS Lite title and editable page body. Template contrast and global components are excluded.";
  } else {
    elements["scope-note"].textContent = settings.canControlColour
      ? "The scan focuses on authored content and includes colour contrast."
      : "The scan focuses on authored content. Colour contrast is classified as template-owned and excluded.";
  }
  elements["section-scope-label"].textContent = state.selectedSection
    ? `${state.selectedSection.level} — ${state.selectedSection.text}`
    : "Entire editable content selected";
  elements["clear-section-button"].hidden = !state.selectedSection;
  elements["choose-section-button"].disabled = settings.scope === "whole";
}

function settingsMatchReport() {
  if (!state.activeReport) return true;
  const settings = selectedSettings();
  return state.activeReport.settings.scope === settings.scope &&
    state.activeReport.settings.profile === settings.profile &&
    state.activeReport.settings.canControlColour === settings.canControlColour &&
    (state.activeReport.settings.sectionSelector || "") === (settings.sectionSelector || "");
}

async function handleSettingsChange() {
  updateSettingsExplanation();
  await saveDomainSettings();
  if (!settingsMatchReport()) elements["cache-note"].textContent = "Review settings changed. Rescan to update the findings.";
}

function reportKey(url, sectionSelector) { return canonicalUrl(url) + (sectionSelector ? `::${sectionSelector}` : ""); }

function trimReports() {
  const entries = Object.entries(state.reports).sort((first, second) => String(second[1].scannedAt).localeCompare(String(first[1].scannedAt)));
  state.reports = Object.fromEntries(entries.slice(0, MAX_REPORTS));
}

async function storeReport(report) {
  state.reports[reportKey(report.page.url, report.settings && report.settings.sectionSelector)] = report;
  trimReports();
  await saveKey(STORAGE_KEYS.reports, state.reports);
}

function effectiveStatus(finding) {
  if (["accepted", "ignored"].includes(finding.automaticStatus) && finding.exceptionId && state.exceptions.some(item => item.id === finding.exceptionId)) return "ignored";
  const decision = state.decisions[finding.fingerprint];
  if (!decision || !decision.status) return "open";
  return decision.status === "accepted" ? "ignored" : decision.status;
}

function auditNote(finding) {
  return finding ? (state.notes[finding.fingerprint] || { important: false, text: "" }) : { important: false, text: "" };
}

function importantFinding(finding) {
  return Boolean(auditNote(finding).important);
}

function openIssues(report) {
  return (report.issues || []).filter(finding => effectiveStatus(finding) === "open");
}

function reportCounts(report) {
  const counts = { fix: 0, check: 0, review: 0, ignored: 0, resolved: 0 };
  (report.issues || []).forEach(finding => {
    const status = effectiveStatus(finding);
    const amount = finding.occurrenceCount || 1;
    if (status === "open") counts[finding.severity] += amount;
    else counts[status] += amount;
  });
  return counts;
}

async function saveNavigation() {
  await saveKey(STORAGE_KEYS.navigation, { tabId: state.lastReviewTabId, pageKey: state.lastReviewPageKey });
}

function updateReturnButton() {
  if (!elements["return-review-button"]) return;
  const available = Boolean(state.lastReviewTabId && (workspaceSurface || !state.activeTab || state.activeTab.id !== state.lastReviewTabId));
  elements["return-review-button"].hidden = !available;
  elements["return-review-button"].textContent = workspaceSurface ? "Original page" : "Return";
}

async function returnToReview() {
  if (!state.lastReviewTabId) return;
  try {
    await chrome.tabs.update(state.lastReviewTabId, { active: true });
  } catch (_) {
    state.lastReviewTabId = null;
    state.lastReviewPageKey = "";
    await saveNavigation().catch(() => {});
    showToast("The reviewed page is no longer open.");
  }
}

function showCurrentState(name, message) {
  elements["current-loading"].hidden = name !== "loading";
  elements["current-error"].hidden = name !== "error";
  elements["current-results"].hidden = name !== "results";
  if (message) elements["current-error-message"].textContent = message;
}

function showScanSettings() {
  elements["scan-settings"].hidden = false;
  elements["cancel-settings-button"].hidden = !state.activeReport;
  elements["scan-settings"].scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideScanSettings() {
  if (!state.activeReport) return;
  elements["scan-settings"].hidden = true;
}

async function syncActiveTab() {
  if (workspaceSurface) {
    let tab = null;
    if (state.lastReviewTabId) {
      try { tab = await chrome.tabs.get(state.lastReviewTabId); } catch (_) {}
    }
    const cached = state.lastReviewPageKey ? state.reports[state.lastReviewPageKey] : null;
    state.activeTab = tab;
    updateReturnButton();
    if (cached) {
      state.activeReport = cached;
      state.activePageKey = state.lastReviewPageKey;
      elements["active-page-label"].textContent = cached.page.title || cached.page.url;
      applySettings(cached.settings || defaultSettings(cached.page.url || ""));
      restoreReviewContext(state.activePageKey);
      renderCurrentReport();
      showCurrentState("results");
      elements["scan-settings"].hidden = true;
      elements["stale-report-banner"].hidden = cached.ruleVersion === globalThis.BCWebStyleGuideChecker.ruleVersion;
      restoreReviewScroll(state.activePageKey);
    } else if (surfaceParams.get("view") === "current") {
      state.activePageKey = tab ? reportKey(tab.url || "") : "";
      elements["active-page-label"].textContent = tab ? (tab.title || tab.url || "Current page") : "No reviewed page";
      elements["active-page-label"].title = tab ? (tab.url || "") : "";
      if (tab) applySettings(defaultSettings(tab.url || ""));
      elements["scan-button"].disabled = !tab || !isScannableUrl(tab.url || "");
      elements["scan-settings"].hidden = false;
      showCurrentState("idle");
    }
    return;
  }
  const tab = await currentTab();
  const nextPageKey = tab ? reportKey(tab.url || "") : "";
  if (nextPageKey !== state.activePageKey) {
    if (state.activePageKey && state.activeReport) await persistReviewContext(state.activePageKey).catch(() => {});
    state.selectedSection = null;
    state.guidedIndex = 0;
    state.guidedFingerprint = "";
    state.selectedRuleId = "";
    state.detailQueue = [];
    state.decisionMessage = "";
    state.pendingDecision = null;
    state.pageDetailSection = "overview";
    state.reviewView = "review";
    state.reviewMode = "list";
    state.collapsedFindingGroups.clear();
    if (elements["status-filter"]) elements["status-filter"].value = "open";
    if (elements["severity-filter"]) elements["severity-filter"].value = "all";
    if (elements["category-filter"]) elements["category-filter"].value = "all";
    if (elements["sort-order"]) elements["sort-order"].value = "recommended";
    if (elements["important-filter"]) elements["important-filter"].checked = false;
    if (elements["follow-page"]) elements["follow-page"].checked = true;
    state.activePageKey = nextPageKey;
  }
  state.activeTab = tab;
  updateReturnButton();
  if (!tab) {
    elements["scan-settings"].hidden = false;
    elements["active-page-label"].textContent = "No active browser tab";
    showCurrentState("error", "No active browser tab was found.");
    return;
  }
  elements["active-page-label"].textContent = tab.title || tab.url || "Current page";
  elements["active-page-label"].title = tab.url || "";
  applySettings(defaultSettings(tab.url || ""));
  const cached = state.reports[reportKey(tab.url || "")];
  if (cached) {
    state.activeReport = cached;
    applySettings(cached.settings || defaultSettings(tab.url || ""));
    restoreReviewContext(nextPageKey);
    renderCurrentReport();
    showCurrentState("results");
    elements["scan-settings"].hidden = true;
    elements["cache-note"].textContent = `Showing saved results from ${formatDate(cached.scannedAt)}.`;
    elements["stale-report-banner"].hidden = cached.ruleVersion === globalThis.BCWebStyleGuideChecker.ruleVersion;
    restoreReviewScroll(nextPageKey);
  } else {
    state.activeReport = null;
    showCurrentState("idle");
    elements["scan-settings"].hidden = false;
    elements["cancel-settings-button"].hidden = true;
    elements["cache-note"].textContent = "";
    elements["stale-report-banner"].hidden = true;
  }
  elements["scan-button"].disabled = !isScannableUrl(tab.url || "");
}

async function injectScanner(tabId, options) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["checker-core.js"] });
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: optionsValue => globalThis.BCWebStyleGuideChecker.scanPage(document, optionsValue),
    args: [options]
  });
  const report = results && results[0] && results[0].result;
  if (!report) throw new Error("The page returned no scan results.");
  if (report.error) throw new Error(report.error);
  return report;
}

function mimeAssetType(contentType, disposition, finalUrl) {
  const value = String(contentType || "").toLowerCase();
  const mappings = [
    ["application/pdf", "PDF"], ["application/msword", "DOC"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "DOCX"],
    ["application/vnd.ms-excel", "XLS"], ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "XLSX"],
    ["text/csv", "CSV"], ["application/vnd.ms-powerpoint", "PPT"],
    ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "PPTX"],
    ["application/rtf", "RTF"], ["text/plain", "TXT"], ["application/zip", "ZIP"]
  ];
  const matched = mappings.find(item => value.includes(item[0]));
  if (matched) return matched[1];
  const filename = String(disposition || "").match(/filename\*?=(?:UTF-8''|["']?)([^"';]+)/i);
  return globalThis.BCWebStyleGuideChecker.helpers.assetTypeFromUrl(filename ? decodeURIComponent(filename[1]) : finalUrl);
}

function declaredBytes(asset) {
  if (!Number.isFinite(asset.declaredSize)) return null;
  const multiplier = asset.declaredUnit === "GB" ? 1024 ** 3 : asset.declaredUnit === "MB" ? 1024 ** 2 : 1024;
  return asset.declaredSize * multiplier;
}

function displayBytes(value) {
  if (!Number.isFinite(value)) return "unknown size";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1).replace(/\.0$/, "")}GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1).replace(/\.0$/, "")}MB`;
  return `${Math.max(0.1, value / 1024).toFixed(1).replace(/\.0$/, "")}KB`;
}

function appendUniqueFinding(report, finding) {
  if (!finding) return;
  if (report.issues.some(item => item.ruleId === finding.ruleId && item.selector === finding.selector)) return;
  if (!Number.isFinite(finding.pageOrder) || finding.pageOrder === Number.MAX_SAFE_INTEGER) {
    const details = report.pageDetails || {};
    const pageItem = [...(details.headings || []), ...(details.images || []), ...(details.links || [])]
      .find(item => item.selector === finding.selector && Number.isFinite(item.pageOrder));
    if (pageItem) finding.pageOrder = pageItem.pageOrder;
  }
  report.issues.push(finding);
}

async function verifyOneAsset(report, asset) {
  if (!/^https?:/i.test(asset.href || "")) { asset.verificationStatus = "unsupported"; return; }
  let hasPermission = false;
  try { hasPermission = await chrome.permissions.contains({ origins: [originPattern(asset.href)] }); } catch (_) {}
  if (!hasPermission) { asset.verificationStatus = "permission-unavailable"; return; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(asset.href, { method: "HEAD", credentials: "omit", redirect: "follow", signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const lengthHeader = response.headers.get("content-length");
    const actualSize = lengthHeader && /^\d+$/.test(lengthHeader) ? Number(lengthHeader) : null;
    const actualType = mimeAssetType(response.headers.get("content-type"), response.headers.get("content-disposition"), response.url || asset.href);
    asset.actualSize = actualSize;
    asset.actualType = actualType;
    asset.finalUrl = response.url || asset.href;
    asset.verificationStatus = actualSize === null ? "type-verified" : "verified";
    if (actualType && !asset.validLabel && asset.labelStatus !== "size-spacing") {
      appendUniqueFinding(report, globalThis.BCWebStyleGuideChecker.createExternalFinding("file-link-label", report.page.url, {
        id: `file-link-label-${asset.selector}`,
        selector: asset.selector,
        evidence: `${asset.text || asset.href} → ${actualType}${actualSize === null ? "" : `, ${displayBytes(actualSize)}`}`
      }));
    }
    if (asset.declaredType && actualType && asset.declaredType !== actualType) {
      appendUniqueFinding(report, globalThis.BCWebStyleGuideChecker.createExternalFinding("file-link-type-mismatch", report.page.url, {
        id: `file-link-type-${asset.selector}`,
        selector: asset.selector,
        evidence: `Link says ${asset.declaredType}; server returned ${actualType}: ${asset.text || asset.href}`
      }));
    }
    const labelledSize = declaredBytes(asset);
    if (labelledSize !== null && actualSize !== null) {
      const tolerance = Math.max(2048, actualSize * 0.04);
      if (Math.abs(labelledSize - actualSize) > tolerance) {
        appendUniqueFinding(report, globalThis.BCWebStyleGuideChecker.createExternalFinding("file-link-size-mismatch", report.page.url, {
          id: `file-link-size-${asset.selector}`,
          selector: asset.selector,
          evidence: `Link says ${asset.declaredSize}${asset.declaredUnit}; server returned about ${displayBytes(actualSize)}: ${asset.text || asset.href}`
        }));
      }
    }
  } catch (error) {
    asset.verificationStatus = error && error.name === "AbortError" ? "timed-out" : "unavailable";
  } finally { clearTimeout(timeout); }
}

async function enrichAssetChecks(report) {
  const assets = (report.assets || []).slice(0, 40);
  let index = 0;
  const worker = async () => {
    while (index < assets.length) {
      const asset = assets[index];
      index += 1;
      await verifyOneAsset(report, asset);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, assets.length) }, worker));
  const order = { fix: 0, check: 1, review: 2 };
  report.issues.sort((first, second) => order[first.severity] - order[second.severity] || first.category.localeCompare(second.category) || first.title.localeCompare(second.title));
  return report;
}

async function scanTab(tabId, options) {
  const report = await injectScanner(tabId, options);
  await enrichAssetChecks(report);
  return report;
}

async function checkOneHttpLink(report, link) {
  let permitted = false;
  try { permitted = await chrome.permissions.contains({ origins: [originPattern(link.href)] }); } catch (_) {}
  if (!permitted) return { status: "permission", link };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    let response = await fetch(link.href, { method: "HEAD", credentials: "omit", redirect: "follow", signal: controller.signal, cache: "no-store" });
    if ([405, 501].includes(response.status)) {
      response = await fetch(link.href, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        credentials: "omit",
        redirect: "follow",
        signal: controller.signal,
        cache: "no-store"
      });
      if (response.body && response.body.cancel) response.body.cancel().catch(() => {});
    }
    if (response.status === 404 || response.status === 410) return { status: "broken", code: response.status, link, finalUrl: response.url || link.href };
    if (response.status >= 500) return { status: "server", code: response.status, link, finalUrl: response.url || link.href };
    if ([401, 403].includes(response.status)) return { status: "restricted", code: response.status, link, finalUrl: response.url || link.href };
    if (response.status === 429) return { status: "rate-limited", code: response.status, link, finalUrl: response.url || link.href };
    if (response.status >= 400) return { status: "client-error", code: response.status, link, finalUrl: response.url || link.href };
    if (response.status >= 200 && response.status < 400) return {
      status: "ok",
      code: response.status,
      link,
      finalUrl: response.url || link.href,
      redirected: Boolean(response.url && canonicalUrl(response.url) !== canonicalUrl(link.href))
    };
    return { status: "unavailable", code: response.status, link, finalUrl: response.url || link.href };
  } catch (error) {
    return { status: "unavailable", error: error && error.name === "AbortError" ? "Timed out" : "Request failed", link };
  } finally { clearTimeout(timeout); }
}

function summarizeLinkCheck(totalFound, results) {
  const count = status => results.filter(result => result.status === status).length;
  return {
    totalFound,
    completed: results.length,
    okay: count("ok"),
    broken: count("broken"),
    serverErrors: count("server"),
    permissionRequired: count("permission"),
    restricted: count("restricted"),
    rateLimited: count("rate-limited"),
    clientErrors: count("client-error"),
    unavailable: count("unavailable"),
    pending: Math.max(0, totalFound - results.length)
  };
}

function waitForLinkCheckResume() {
  if (!state.linkCheckPaused) return Promise.resolve();
  return new Promise(resolve => { state.linkCheckWaiters.push(resolve); });
}

function addHttpLinkFindings(report, results) {
  report.issues = report.issues.filter(finding => !["broken-http-link", "http-link-server-error"].includes(finding.ruleId));
  results.forEach(result => {
    if (result.status === "broken") appendUniqueFinding(report, globalThis.BCWebStyleGuideChecker.createExternalFinding("broken-http-link", report.page.url, {
      id: `broken-http-${result.link.selector}`,
      selector: result.link.selector,
      location: result.link.location || "Page",
      evidence: `${result.link.text} → ${result.link.href} (HTTP ${result.code})`,
      diagnostics: result.finalUrl && result.finalUrl !== result.link.href ? [`The request ended at ${result.finalUrl}.`] : []
    }));
    if (result.status === "server") appendUniqueFinding(report, globalThis.BCWebStyleGuideChecker.createExternalFinding("http-link-server-error", report.page.url, {
      id: `server-http-${result.link.selector}`,
      selector: result.link.selector,
      location: result.link.location || "Page",
      evidence: `${result.link.text} → ${result.link.href} (HTTP ${result.code})`
    }));
  });
  const severityOrder = { fix: 0, check: 1, review: 2 };
  report.issues.sort((first, second) => severityOrder[first.severity] - severityOrder[second.severity] || first.category.localeCompare(second.category) || first.title.localeCompare(second.title));
}

async function checkHttpLinks() {
  const report = state.activeReport;
  if (!report || !report.pageDetails || state.linkCheckRunning) return;
  const unique = new Map();
  report.pageDetails.links.forEach(link => {
    if (!/^https?:/i.test(link.href || "")) return;
    const key = canonicalUrl(link.href);
    if (unique.has(key)) unique.get(key).occurrences += 1;
    else unique.set(key, { ...link, occurrences: 1 });
  });
  const links = Array.from(unique.values());
  if (!links.length) { showToast("No HTTP or HTTPS links were found."); return; }
  const origins = Array.from(new Set(links.map(link => {
    try { return originPattern(link.href); } catch (_) { return ""; }
  }).filter(Boolean)));
  const permissionGranted = !origins.length || await chrome.permissions.request({ origins }).catch(() => false);
  if (!permissionGranted) {
    report.linkCheck = {
      state: "permission-denied",
      permissionDeclined: true,
      startedAt: new Date().toISOString(),
      checkedAt: "",
      results: [],
      ...summarizeLinkCheck(links.length, []),
      permissionRequired: links.length
    };
    await storeReport(report).catch(() => {});
    renderPageDetails("links");
    showToast(`Website access was declined. ${links.length} link${links.length === 1 ? " was" : "s were"} not checked.`);
    return;
  }
  state.linkCheckRunning = true;
  state.linkCheckPaused = false;
  state.linkCheckCancelled = false;
  report.linkCheck = {
    state: "running",
    startedAt: new Date().toISOString(),
    checkedAt: "",
    results: [],
    ...summarizeLinkCheck(links.length, [])
  };
  renderPageDetails("links");
  let index = 0;
  const results = [];
  const worker = async () => {
    while (index < links.length && !state.linkCheckCancelled) {
      await waitForLinkCheckResume();
      if (state.linkCheckCancelled) break;
      const link = links[index];
      index += 1;
      results.push(await checkOneHttpLink(report, link));
      report.linkCheck = {
        ...report.linkCheck,
        state: state.linkCheckPaused ? "paused" : "running",
        results: results.slice(),
        ...summarizeLinkCheck(links.length, results)
      };
      if (results.length % 5 === 0 || results.length === links.length) {
        if (state.activeReport === report && state.reviewView === "details") renderPageDetails("links");
      }
      if (results.length % 20 === 0) await storeReport(report).catch(() => {});
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, links.length) }, worker));
  addHttpLinkFindings(report, results);
  report.linkCheck = {
    ...report.linkCheck,
    state: state.linkCheckCancelled ? "stopped" : "complete",
    checkedAt: new Date().toISOString(),
    results,
    ...summarizeLinkCheck(links.length, results)
  };
  state.linkCheckRunning = false;
  state.linkCheckPaused = false;
  const wasStopped = state.linkCheckCancelled;
  state.linkCheckCancelled = false;
  state.linkCheckWaiters = [];
  await storeReport(report).catch(() => {});
  if (state.activeReport === report) renderCurrentReport();
  showToast(wasStopped
    ? `Link check stopped after ${report.linkCheck.completed} of ${report.linkCheck.totalFound}.`
    : `Link check complete: ${report.linkCheck.broken} broken, ${report.linkCheck.serverErrors} server errors.`);
}

function toggleLinkCheckPause() {
  if (!state.linkCheckRunning) return;
  state.linkCheckPaused = !state.linkCheckPaused;
  if (!state.linkCheckPaused && state.linkCheckWaiters.length) {
    const waiters = state.linkCheckWaiters.splice(0);
    waiters.forEach(resume => resume());
  }
  if (state.activeReport && state.activeReport.linkCheck) state.activeReport.linkCheck.state = state.linkCheckPaused ? "paused" : "running";
  renderPageDetails("links");
}

function stopLinkCheck() {
  if (!state.linkCheckRunning) return;
  state.linkCheckCancelled = true;
  state.linkCheckPaused = false;
  if (state.linkCheckWaiters.length) {
    const waiters = state.linkCheckWaiters.splice(0);
    waiters.forEach(resume => resume());
  }
  showToast("Stopping after the current link checks finish.");
}

function linkedOriginPatterns(report) {
  const pageOrigin = (() => { try { return new URL(report.page.url).origin; } catch (_) { return ""; } })();
  return Array.from(new Set((report.pageDetails.links || []).filter(link => /^https?:/i.test(link.href || "")).filter(link => {
    try { return new URL(link.href).origin !== pageOrigin; } catch (_) { return false; }
  }).map(link => originPattern(link.href))));
}

async function openPermissionDialog() {
  const allGranted = await chrome.permissions.contains({ origins: ["http://*/*", "https://*/*"] }).catch(() => false);
  elements["permission-status"].textContent = allGranted ? "All-sites access is currently allowed." : "All-sites access is not currently allowed.";
  elements["permission-linked"].textContent = state.activeReport ? "Allow linked sites on this page" : "Allow the current website";
  elements["permission-dialog"].showModal();
}

async function requestLinkedPermissions() {
  let origins = state.activeReport ? linkedOriginPatterns(state.activeReport) : [];
  if (!state.activeReport) {
    const tab = await currentReviewTab();
    if (tab && isScannableUrl(tab.url || "")) origins = [originPattern(tab.url)];
  }
  if (!origins.length) { elements["permission-status"].textContent = state.activeReport ? "This page has no external HTTP or HTTPS destinations." : "Open a regular website first."; return; }
  const granted = await chrome.permissions.request({ origins }).catch(() => false);
  elements["permission-status"].textContent = granted ? `Access allowed for ${origins.length} linked site${origins.length === 1 ? "" : "s"}.` : "Linked-site access was not granted.";
}

async function requestAllPermissions() {
  const granted = await chrome.permissions.request({ origins: ["http://*/*", "https://*/*"] }).catch(() => false);
  elements["permission-status"].textContent = granted ? "All-sites access is now allowed." : "All-sites access was not granted.";
}

async function revokeAllPermissions() {
  const removed = await chrome.permissions.remove({ origins: ["http://*/*", "https://*/*"] }).catch(() => false);
  elements["permission-status"].textContent = removed ? "All-sites access was removed. Individually granted sites may remain available." : "No broad all-sites access was removed.";
}

function readableScanError(error) {
  const message = error && error.message ? error.message : String(error);
  if (/Cannot access contents of url|Missing host permission|extensions gallery|cannot be scripted/i.test(message)) {
    return "This protected page cannot be checked. Open a regular HTTP or HTTPS webpage and try again.";
  }
  return message;
}

function captureReviewContext() {
  const visibleFinding = Array.from(document.querySelectorAll(".issue-row[data-rule-id], .finding[data-fingerprint]")).find(item => {
    const rect = item.getBoundingClientRect();
    return rect.bottom > 140 && rect.top < window.innerHeight;
  });
  return {
    reviewView: state.reviewView,
    reviewMode: state.reviewMode,
    guidedIndex: state.guidedIndex,
    guidedFingerprint: state.guidedFingerprint,
    selectedRuleId: state.selectedRuleId,
    detailQueue: state.detailQueue,
    pageDetailSection: state.pageDetailSection,
    status: elements["status-filter"].value,
    severity: elements["severity-filter"].value,
    category: elements["category-filter"].value,
    sortOrder: elements["sort-order"].value,
    important: elements["important-filter"].checked,
    followPage: elements["follow-page"].checked,
    collapsed: Array.from(state.collapsedFindingGroups),
    scrollTop: document.scrollingElement ? document.scrollingElement.scrollTop : 0,
    visibleFingerprint: visibleFinding ? (visibleFinding.dataset.fingerprint || "") : "",
    visibleRuleId: visibleFinding ? (visibleFinding.dataset.ruleId || "") : ""
  };
}

async function persistReviewContext(pageKey) {
  if (!pageKey || !state.activeReport) return;
  state.reviewContexts[pageKey] = { ...captureReviewContext(), updatedAt: new Date().toISOString() };
  const entries = Object.entries(state.reviewContexts).sort((first, second) => String(second[1].updatedAt).localeCompare(String(first[1].updatedAt))).slice(0, 40);
  state.reviewContexts = Object.fromEntries(entries);
  await saveKey(STORAGE_KEYS.reviewContexts, state.reviewContexts);
}

function restoreReviewContext(pageKey) {
  const saved = state.reviewContexts[pageKey];
  if (!saved) return;
  state.reviewView = ["review", "details"].includes(saved.reviewView) ? saved.reviewView : "review";
  state.reviewMode = ["guided", "detail"].includes(saved.reviewMode) ? "detail" : "list";
  state.guidedIndex = Number.isInteger(saved.guidedIndex) ? saved.guidedIndex : 0;
  state.guidedFingerprint = saved.guidedFingerprint || "";
  state.selectedRuleId = saved.selectedRuleId || "";
  state.detailQueue = Array.isArray(saved.detailQueue) ? saved.detailQueue : [];
  state.pageDetailSection = saved.pageDetailSection || "overview";
  elements["status-filter"].value = saved.status || "open";
  elements["severity-filter"].value = saved.severity || "all";
  elements["category-filter"].value = saved.category || "all";
  elements["sort-order"].value = saved.sortOrder === "page" ? "page" : "recommended";
  elements["important-filter"].checked = Boolean(saved.important);
  elements["follow-page"].checked = saved.followPage !== false;
  state.collapsedFindingGroups = new Set(saved.collapsed || []);
}

function restoreReviewScroll(pageKey) {
  const saved = state.reviewContexts[pageKey];
  if (!saved) return;
  requestAnimationFrame(() => {
    const target = saved.visibleFingerprint && document.querySelector(`[data-fingerprint="${CSS.escape(saved.visibleFingerprint)}"]`);
    const row = saved.visibleRuleId && document.querySelector(`[data-rule-id="${CSS.escape(saved.visibleRuleId)}"]`);
    if (target) target.scrollIntoView({ block: "start" });
    else if (row) row.scrollIntoView({ block: "start" });
    else if (document.scrollingElement) document.scrollingElement.scrollTop = saved.scrollTop || 0;
  });
}

async function scanCurrentPage(suppliedOptions) {
  const options = suppliedOptions && suppliedOptions.preserveReview ? suppliedOptions : {};
  const preserved = options.preserveReview ? captureReviewContext() : null;
  showCurrentState("loading");
  elements["scan-settings"].hidden = true;
  elements["cache-note"].textContent = "";
  try {
    state.activeTab = await currentReviewTab();
    if (!state.activeTab || !state.activeTab.id) throw new Error("No active browser tab was found.");
    if (!isScannableUrl(state.activeTab.url)) throw new Error("This type of browser page cannot be checked.");
    const granted = await requestPagePermission(state.activeTab.url);
    if (!granted) throw new Error("Access to this site was not granted. The checker needs permission to inspect the page.");
    const settings = selectedSettings();
    await clearPageOverlays();
    await saveDomainSettings();
    const report = await scanTab(state.activeTab.id, {
      ...settings,
      exceptions: state.exceptions
    });
    state.activeReport = report;
    state.lastReviewTabId = state.activeTab.id;
    state.lastReviewPageKey = reportKey(report.page.url, report.settings && report.settings.sectionSelector);
    state.activePageKey = state.lastReviewPageKey;
    await saveNavigation().catch(() => {});
    updateReturnButton();
    elements["status-filter"].value = preserved ? preserved.status : "open";
    elements["severity-filter"].value = preserved ? preserved.severity : "all";
    elements["category-filter"].value = preserved ? preserved.category : "all";
    elements["sort-order"].value = preserved && preserved.sortOrder === "page" ? "page" : "recommended";
    state.guidedIndex = preserved ? preserved.guidedIndex : 0;
    state.guidedFingerprint = preserved ? preserved.guidedFingerprint : "";
    state.selectedRuleId = preserved ? preserved.selectedRuleId : "";
    state.detailQueue = preserved ? preserved.detailQueue : [];
    state.pageDetailSection = preserved ? preserved.pageDetailSection : "overview";
    state.decisionMessage = "";
    state.pendingDecision = null;
    state.reviewView = preserved ? preserved.reviewView : "review";
    state.reviewMode = preserved ? preserved.reviewMode : "list";
    elements["important-filter"].checked = preserved ? preserved.important : false;
    elements["follow-page"].checked = preserved ? preserved.followPage !== false : true;
    state.collapsedFindingGroups = new Set(preserved ? preserved.collapsed : []);
    let saved = true;
    await storeReport(report).catch(() => { saved = false; });
    renderCurrentReport();
    showCurrentState("results");
    elements["scan-settings"].hidden = true;
    elements["cache-note"].textContent = saved
      ? `Checked ${formatDate(report.scannedAt)} using rules ${report.ruleVersion}.`
      : `Checked ${formatDate(report.scannedAt)}. Browser storage could not save this report.`;
    elements["stale-report-banner"].hidden = true;
    if (preserved) requestAnimationFrame(() => {
      if (document.scrollingElement) document.scrollingElement.scrollTop = preserved.scrollTop;
    });
  } catch (error) {
    elements["scan-settings"].hidden = false;
    showCurrentState("error", readableScanError(error));
  }
}

function renderCurrentReport() {
  const report = state.activeReport;
  if (!report) return;
  const counts = reportCounts(report);
  const openTotal = counts.fix + counts.check + counts.review;
  const selectedSeverity = elements["severity-filter"].value || "all";
  elements.counts.innerHTML = [
    ["all", openTotal, "All"], ["fix", counts.fix, "Fix"], ["check", counts.check, "Check"], ["review", counts.review, "Review"]
  ].map(([severity, count, label]) => `<button class="severity-filter${selectedSeverity === severity ? " is-selected" : ""}" type="button" data-severity="${severity}" aria-pressed="${selectedSeverity === severity}"><strong>${count}</strong><span>${label}</span></button>`).join("");
  elements["findings-tab-count"].textContent = `(${openTotal})`;
  elements["reviewed-count"].textContent = String(counts.ignored + counts.resolved);
  elements["scan-context-title"].textContent = report.page.title || "Current page";
  const scopeLabel = report.settings.sectionLabel
    ? `Section: ${report.settings.sectionLabel}`
    : report.settings.scope === "whole" ? "Whole website" : report.settings.profile === "cms-lite" ? "Editable content" : "Page content";
  elements["scan-context-details"].textContent = `${report.settings.profileLabel} · ${scopeLabel} · ${formatDate(report.scannedAt)}`;

  const existingCategory = elements["category-filter"].value || "all";
  const categories = Array.from(new Set(report.issues.map(finding => finding.category))).sort();
  elements["category-filter"].innerHTML = `<option value="all">All categories</option>${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
  if (categories.includes(existingCategory)) elements["category-filter"].value = existingCategory;

  const manualKey = `${canonicalUrl(report.page.url)}|${report.scannedAt}`;
  if (state.manualReportKey !== manualKey) {
    elements["manual-checks"].innerHTML = report.manualChecks.map(check => `
      <div class="manual-item">
        <input type="checkbox" id="${check.id}">
        <div><label for="${check.id}">${escapeHtml(check.title)}</label><p>${escapeHtml(check.question)} <a href="${escapeHtml(check.sourceUrl)}" target="_blank" rel="noreferrer">View guidance</a></p></div>
      </div>`).join("");
    state.manualReportKey = manualKey;
  }
  renderReviewView();
}

function filteredFindings() {
  const report = state.activeReport;
  if (!report) return [];
  const status = elements["status-filter"].value;
  const severity = elements["severity-filter"].value;
  const category = elements["category-filter"].value;
  const importantOnly = elements["important-filter"].checked;
  return report.issues.filter(finding => {
    const findingStatus = effectiveStatus(finding);
    return (status === "all" || status === findingStatus || (status === "reviewed" && findingStatus !== "open"))
      && (severity === "all" || severity === finding.severity)
      && (category === "all" || category === finding.category)
      && (!importantOnly || importantFinding(finding));
  });
}

function findingAmount(finding) {
  return Number.isFinite(finding && finding.occurrenceCount) ? finding.occurrenceCount : 1;
}

function groupedFindingTypes(items = filteredFindings()) {
  const groups = new Map();
  items.forEach(finding => {
    const key = finding.ruleId || finding.title;
    if (!groups.has(key)) groups.set(key, {
      ruleId: key,
      title: finding.title,
      severity: finding.severity,
      category: finding.category,
      findings: [],
      occurrences: 0,
      pageOrder: Number.MAX_SAFE_INTEGER,
      important: false,
      notes: false
    });
    const group = groups.get(key);
    group.findings.push(finding);
    group.occurrences += findingAmount(finding);
    if (Number.isFinite(finding.pageOrder)) group.pageOrder = Math.min(group.pageOrder, finding.pageOrder);
    group.important ||= importantFinding(finding);
    group.notes ||= Boolean(auditNote(finding).text);
  });
  const severityOrder = { fix: 0, check: 1, review: 2 };
  const pageSort = elements["sort-order"] && elements["sort-order"].value === "page";
  return Array.from(groups.values()).map(group => {
    if (pageSort) group.findings.sort((first, second) => (first.pageOrder ?? Number.MAX_SAFE_INTEGER) - (second.pageOrder ?? Number.MAX_SAFE_INTEGER));
    return group;
  }).sort((first, second) => pageSort
    ? first.pageOrder - second.pageOrder || first.title.localeCompare(second.title)
    : (severityOrder[first.severity] ?? 9) - (severityOrder[second.severity] ?? 9)
      || first.category.localeCompare(second.category)
      || first.title.localeCompare(second.title));
}

function updateFilterUi() {
  const filters = [];
  const status = elements["status-filter"].value;
  const severity = elements["severity-filter"].value;
  const category = elements["category-filter"].value;
  const importantOnly = elements["important-filter"].checked;
  if (status !== "open") filters.push({ key: "status", label: status === "all" ? "All statuses" : status.charAt(0).toUpperCase() + status.slice(1) });
  if (severity !== "all") filters.push({ key: "severity", label: severity.charAt(0).toUpperCase() + severity.slice(1) });
  if (category !== "all") filters.push({ key: "category", label: category });
  if (importantOnly) filters.push({ key: "important", label: "Important" });
  elements["filter-count"].textContent = filters.length ? String(filters.length) : "";
  elements["active-filters"].innerHTML = filters.map(filter => `<button class="filter-chip" type="button" data-clear-filter="${filter.key}" aria-label="Remove ${escapeHtml(filter.label)} filter">${escapeHtml(filter.label)} <span aria-hidden="true">×</span></button>`).join("");
  elements.counts.querySelectorAll("[data-severity]").forEach(button => {
    const selected = button.dataset.severity === severity;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function clearFilters() {
  elements["status-filter"].value = "open";
  elements["severity-filter"].value = "all";
  elements["category-filter"].value = "all";
  elements["important-filter"].checked = false;
  renderFindings();
}

function renderFindings() {
  updateFilterUi();
  const items = filteredFindings();
  const groups = groupedFindingTypes(items);
  const occurrences = items.reduce((total, finding) => total + findingAmount(finding), 0);
  elements["showing-count"].textContent = `${groups.length} issue type${groups.length === 1 ? "" : "s"} · ${occurrences} finding${occurrences === 1 ? "" : "s"}`;
  renderReviewLauncher(groups);
  if (!items.length) {
    const openCount = openIssues(state.activeReport).length;
    elements.findings.innerHTML = `<div class="empty-state"><strong>${openCount ? "No findings match these filters." : "No open findings were detected."}</strong><br>${openCount ? "Clear a filter to see the other findings." : "Manual review may still be useful."}</div>`;
    return;
  }
  elements.findings.innerHTML = groups.map(group => `
    <button class="issue-row ${escapeHtml(group.severity)}${group.ruleId === state.selectedRuleId ? " is-selected" : ""}" type="button" data-rule-id="${escapeHtml(group.ruleId)}">
      <span>
        <span class="issue-row-title">${escapeHtml(group.title)}</span>
        <span class="issue-row-meta"><span>${escapeHtml(sentenceLabel(group.severity))}</span><span aria-hidden="true">·</span><span>${escapeHtml(group.category)}</span>${group.important || group.notes ? `<span class="issue-row-icons"><span aria-label="${group.important ? "Important" : ""}">${group.important ? "★" : ""}</span><span aria-label="${group.notes ? "Has audit note" : ""}">${group.notes ? "●" : ""}</span></span>` : ""}</span>
      </span>
      <span class="issue-row-count" aria-label="${group.occurrences} findings">${group.occurrences}</span>
    </button>`).join("");
}

function renderReviewLauncher(groups) {
  const next = groups[0] || null;
  elements["review-issues-button"].disabled = !next;
  elements["review-issues-button"].dataset.ruleId = next ? next.ruleId : "";
  elements["review-issues-button"].textContent = next ? "Review issues" : "No issues to review";
}

function setAllFindingGroups(open) {
  return open;
}

function visibleRuleGroups() {
  return groupedFindingTypes();
}

function currentRuleGroupIndex(groups) {
  return groups.findIndex(group => group.ruleId === state.selectedRuleId);
}

function updateIssueTypeLabel() {
  const groups = visibleRuleGroups();
  if (!groups.length) {
    elements["current-issue-type"].textContent = "No issue types";
    elements["previous-issue-type"].disabled = true;
    elements["next-issue-type"].disabled = false;
    return;
  }
  const index = currentRuleGroupIndex(groups);
  if (index < 0) {
    elements["current-issue-type"].textContent = "Current issue type reviewed";
    elements["previous-issue-type"].disabled = true;
    elements["next-issue-type"].disabled = false;
    return;
  }
  elements["current-issue-type"].textContent = `${groups[index].title} · ${index + 1} of ${groups.length}`;
  elements["previous-issue-type"].disabled = index === 0;
  elements["next-issue-type"].disabled = false;
}

function jumpIssueType(amount) {
  const items = guidedFindings();
  const current = items[state.guidedIndex];
  if (!current) return;
  let targetIndex = -1;
  if (amount > 0) {
    targetIndex = items.findIndex((finding, index) => index > state.guidedIndex && finding.ruleId !== current.ruleId);
    if (targetIndex < 0) { closeFindingReview(); return; }
  } else {
    for (let index = state.guidedIndex - 1; index >= 0; index -= 1) {
      if (items[index].ruleId !== current.ruleId) { targetIndex = index; break; }
    }
    if (targetIndex < 0) return;
  }
  state.guidedIndex = targetIndex;
  state.guidedFingerprint = items[targetIndex].fingerprint;
  state.selectedRuleId = items[targetIndex].ruleId;
  state.decisionMessage = "";
  state.pendingDecision = null;
  state.locateOnNextRender = true;
  renderReviewView();
  persistReviewContext(state.activePageKey).catch(() => {});
}

function openRuleGroup(ruleId, fingerprint = "", options = {}) {
  if (!state.activeReport || !ruleId) return;
  const groups = groupedFindingTypes();
  const group = groups.find(item => item.ruleId === ruleId);
  if (!group || !group.findings.length) return;
  state.selectedRuleId = ruleId;
  state.detailQueue = groups.flatMap(item => item.findings.map(finding => finding.fingerprint));
  const firstInGroup = group.findings[0].fingerprint;
  const requestedIndex = state.detailQueue.indexOf(fingerprint || firstInGroup);
  state.guidedIndex = requestedIndex >= 0 ? requestedIndex : 0;
  state.guidedFingerprint = state.detailQueue[state.guidedIndex] || "";
  if (!options.preserveFeedback) {
    state.decisionMessage = "";
    state.pendingDecision = null;
  }
  state.locateOnNextRender = true;
  state.reviewView = "review";
  state.reviewMode = "detail";
  renderReviewView();
  persistReviewContext(state.activePageKey).catch(() => {});
  requestAnimationFrame(() => elements["review-back-button"].focus());
}

function closeFindingReview() {
  state.reviewMode = "list";
  state.decisionMessage = "";
  renderReviewView();
  persistReviewContext(state.activePageKey).catch(() => {});
  requestAnimationFrame(() => {
    const row = elements.findings.querySelector(`[data-rule-id="${CSS.escape(state.selectedRuleId)}"]`);
    if (row) row.focus();
  });
}

function highlightedEvidence(finding) {
  const evidence = String(finding.evidence || "");
  const match = String(finding.matchText || finding.flaggedToken || "");
  if (!match) return escapeHtml(evidence);
  const requestedIndex = Number.isInteger(finding.matchIndex) ? finding.matchIndex : -1;
  const index = requestedIndex >= 0 && evidence.slice(requestedIndex, requestedIndex + match.length).toLowerCase() === match.toLowerCase()
    ? requestedIndex
    : evidence.toLowerCase().indexOf(match.toLowerCase());
  if (index < 0) return escapeHtml(evidence);
  return `${escapeHtml(evidence.slice(0, index))}<mark>${escapeHtml(evidence.slice(index, index + match.length))}</mark>${escapeHtml(evidence.slice(index + match.length))}`;
}

function renderFinding(finding) {
  const status = effectiveStatus(finding);
  const canReview = status === "open";
  const note = auditNote(finding);
  const feedbackCount = feedbackNotesForFinding(finding).length;
  const showResponsibility = !state.activeReport || state.activeReport.settings.profile !== "cms-lite" || state.activeReport.settings.scope === "whole";
  return `
    <article class="finding ${escapeHtml(finding.severity)} ${escapeHtml(status)}${note.important ? " is-important" : ""}" data-fingerprint="${escapeHtml(finding.fingerprint)}" tabindex="-1">
      <div class="finding-top">
        <h3>${note.important ? `<span class="important-star" aria-label="Important">★</span>` : ""}${escapeHtml(finding.title)}</h3>
        <div class="badges">
          <span class="badge ${escapeHtml(finding.severity)}">${escapeHtml(sentenceLabel(finding.severity))}</span>
          ${showResponsibility ? `<span class="badge owner">${escapeHtml(finding.responsibility)}</span>` : ""}
          ${status !== "open" ? `<span class="badge status">${escapeHtml(sentenceLabel(status))}</span>` : ""}
        </div>
      </div>
      <p><strong>What to review</strong><br>${escapeHtml(finding.why)}</p>
      ${finding.location ? `<p class="finding-location"><strong>Where on the page:</strong> ${escapeHtml(finding.location)}</p>` : ""}
      ${finding.matchText || finding.flaggedToken ? `<p class="match-callout"><strong>Flagged wording:</strong> <mark>${escapeHtml(finding.matchText || finding.flaggedToken)}</mark>${finding.replacement ? ` → ${escapeHtml(finding.replacement)}` : ""}</p>` : ""}
      ${finding.exceptionEligible && finding.proposedPhrase && finding.proposedPhrase !== finding.flaggedToken ? `<p class="term-context"><strong>Exact-term option:</strong> “${escapeHtml(finding.proposedPhrase)}”</p>` : ""}
      ${finding.evidence ? `<div><strong>Evidence</strong><p class="evidence">${highlightedEvidence(finding)}</p></div>` : ""}
      ${finding.suggestedTarget ? `<p class="target-suggestion"><strong>Suggested target:</strong> <code>${escapeHtml(finding.suggestedTarget)}</code></p>` : ""}
      ${finding.diagnostics && finding.diagnostics.length ? `<div class="finding-diagnostics"><strong>What does not match</strong><ul>${finding.diagnostics.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
      ${finding.occurrenceCount > 1 ? `<p class="occurrences">${finding.occurrenceCount} identical occurrences</p>` : ""}
      <p class="suggestion"><strong>Suggested action:</strong> ${escapeHtml(finding.suggestion)}</p>
      ${note.text ? `<div class="audit-note"><strong>Audit note</strong><p>${escapeHtml(note.text)}</p></div>` : ""}
      <div class="finding-footer">
        <div class="finding-actions">
          ${finding.selector ? `<button class="small-button locate-button" type="button" data-selector="${escapeHtml(finding.selector)}">${workspaceSurface ? "View on original page" : "Show again on page"}</button>` : ""}
          ${canReview ? `<button class="small-button decision-button resolve-button" type="button" data-status="resolved">Mark resolved</button><button class="small-button decision-button" type="button" data-status="ignored">Ignore finding</button>` : `<button class="small-button reopen-button" type="button">Reopen finding</button>`}
          ${canReview && finding.exceptionEligible ? `<button class="small-button exception-button" type="button">Always allow exact term</button>` : ""}
          <button class="small-button note-button" type="button">${note.text || note.important ? "Edit note or importance" : "Add note or importance"}</button>
        </div>
        <details class="reference-guidance"><summary>Reference guidance</summary><a href="${escapeHtml(finding.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(finding.sourceLabel)} — B.C. Web Style Guide</a></details>
        <button class="text-button finding-feedback-action" type="button">${feedbackCount ? "Edit feedback about this result" : "Add feedback about this result"}</button>
      </div>
    </article>`;
}

function findingFromButton(button) {
  const article = button.closest("[data-fingerprint]");
  if (!article || !state.activeReport) return null;
  return state.activeReport.issues.find(item => item.fingerprint === article.dataset.fingerprint) || null;
}

async function setDecision(finding, status) {
  if (!finding) return;
  if (status === "open") {
    delete state.decisions[finding.fingerprint];
    await saveKey(STORAGE_KEYS.decisions, state.decisions);
    state.decisionMessage = "Finding reopened.";
    renderReviewView();
    return;
  }
  const itemsBefore = guidedFindings();
  const currentIndex = itemsBefore.findIndex(item => item.fingerprint === finding.fingerprint);
  const groupsBefore = visibleRuleGroups();
  const currentGroupIndex = groupsBefore.findIndex(group => group.ruleId === state.selectedRuleId);
  state.decisions[finding.fingerprint] = { status, updatedAt: new Date().toISOString() };
  await saveKey(STORAGE_KEYS.decisions, state.decisions);
  state.decisionMessage = status === "ignored" ? "Finding ignored." : "Finding marked resolved.";
  state.pendingDecision = { fingerprint: finding.fingerprint };
  const nextInGroup = currentIndex >= 0 ? itemsBefore[currentIndex + 1] : null;
  if (nextInGroup) {
    state.guidedIndex = currentIndex + 1;
    state.guidedFingerprint = nextInGroup.fingerprint;
    state.selectedRuleId = nextInGroup.ruleId;
    state.locateOnNextRender = true;
    renderReviewView();
  } else {
    const remainingIds = new Set(visibleRuleGroups().map(group => group.ruleId));
    const nextGroup = currentGroupIndex >= 0
      ? groupsBefore.slice(currentGroupIndex + 1).find(group => remainingIds.has(group.ruleId))
      : null;
    if (nextGroup) openRuleGroup(nextGroup.ruleId, "", { preserveFeedback: true });
    else renderReviewView();
  }
  persistReviewContext(state.activePageKey).catch(() => {});
  requestAnimationFrame(() => {
    const activeFinding = elements["guided-finding"].querySelector(".finding");
    if (activeFinding) activeFinding.focus({ preventScroll: true });
  });
}

async function undoDecision(fingerprint) {
  state.pendingDecision = null;
  delete state.decisions[fingerprint];
  await saveKey(STORAGE_KEYS.decisions, state.decisions);
  state.decisionMessage = "Review action undone.";
  renderReviewView();
}

function renderReviewView() {
  document.querySelectorAll(".review-tab").forEach(button => {
    const selected = button.dataset.reviewView === state.reviewView;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  elements["list-controls"].hidden = state.reviewView !== "review";
  const findingDetail = state.reviewView === "review" && state.reviewMode === "detail";
  elements["list-review-panel"].hidden = state.reviewView !== "review" || (findingDetail && !workspaceSurface);
  elements["guided-review-panel"].hidden = !findingDetail;
  elements["page-details-panel"].hidden = state.reviewView !== "details";
  const shell = document.querySelector(".review-shell");
  if (shell) shell.classList.toggle("is-finding-detail", findingDetail);
  if (state.reviewView === "details") renderPageDetails(state.pageDetailSection || "overview");
  else if (findingDetail) {
    if (workspaceSurface) renderFindings();
    renderGuidedReview(state.locateOnNextRender);
  } else if (state.reviewView === "review") renderFindings();
  state.locateOnNextRender = false;
}

function switchReviewView(name) {
  state.reviewView = name;
  renderReviewView();
  persistReviewContext(state.activePageKey).catch(() => {});
}

function switchReviewMode(name) {
  state.reviewMode = ["guided", "detail"].includes(name) ? "detail" : "list";
  renderReviewView();
  persistReviewContext(state.activePageKey).catch(() => {});
}

function guidedFindings() {
  if (!state.activeReport) return [];
  const byFingerprint = new Map(state.activeReport.issues.map(finding => [finding.fingerprint, finding]));
  return state.detailQueue.map(fingerprint => byFingerprint.get(fingerprint)).filter(Boolean);
}

function renderGuidedReview(locate) {
  const items = guidedFindings();
  if (!items.length) {
    state.reviewMode = "list";
    renderReviewView();
    return;
  }
  state.guidedIndex = Math.max(0, Math.min(state.guidedIndex, items.length - 1));
  if (state.guidedFingerprint) {
    const restoredIndex = items.findIndex(item => item.fingerprint === state.guidedFingerprint);
    if (restoredIndex >= 0) state.guidedIndex = restoredIndex;
  }
  const finding = items[state.guidedIndex];
  state.guidedFingerprint = finding.fingerprint;
  state.selectedRuleId = finding.ruleId;
  const reviewed = items.reduce((total, item) => total + (effectiveStatus(item) === "open" ? 0 : findingAmount(item)), 0);
  const remaining = items.reduce((total, item) => total + (effectiveStatus(item) === "open" ? findingAmount(item) : 0), 0);
  elements["guided-progress"].textContent = `${reviewed} reviewed · ${remaining} remaining`;
  const confirmation = state.decisionMessage
    ? `<div class="action-confirmation" role="status"><span>${escapeHtml(state.decisionMessage)}</span>${state.pendingDecision ? `<button class="undo-decision" type="button" data-fingerprint="${escapeHtml(state.pendingDecision.fingerprint)}">Undo</button>` : ""}</div>`
    : "";
  elements["guided-finding"].innerHTML = `${confirmation}${renderFinding(finding)}`;
  elements["guided-previous"].disabled = state.guidedIndex === 0;
  elements["guided-next"].disabled = false;
  const atLastFinding = state.guidedIndex === items.length - 1;
  const nextFinding = items[state.guidedIndex + 1] || null;
  const atLastInType = !nextFinding || nextFinding.ruleId !== finding.ruleId;
  const hasNextType = Boolean(nextFinding && nextFinding.ruleId !== finding.ruleId);
  elements["guided-next"].textContent = atLastFinding ? "Return to findings" : atLastInType ? "Next issue type" : "Next";
  elements["next-issue-type"].classList.toggle("is-placeholder", atLastInType);
  elements["next-issue-type"].disabled = atLastInType;
  elements["next-issue-type"].setAttribute("aria-hidden", String(atLastInType));
  elements["next-issue-type"].tabIndex = atLastInType ? -1 : 0;
  elements["next-issue-type"].textContent = hasNextType ? "Skip to next issue type" : "Return to findings";
  if (locate && !workspaceSurface && elements["follow-page"].checked && finding.selector) {
    highlightSelector(finding.selector, true, false);
  }
}

function moveGuided(amount) {
  const items = guidedFindings();
  if (!items.length) return;
  if (amount > 0 && state.guidedIndex === items.length - 1) {
    closeFindingReview();
    return;
  }
  state.guidedIndex = Math.max(0, Math.min(state.guidedIndex + amount, items.length - 1));
  state.guidedFingerprint = items[state.guidedIndex].fingerprint;
  state.selectedRuleId = items[state.guidedIndex].ruleId;
  state.decisionMessage = "";
  state.pendingDecision = null;
  state.locateOnNextRender = true;
  renderReviewView();
  persistReviewContext(state.activePageKey).catch(() => {});
}

function metadataDefinition(label, value) {
  const present = value !== undefined && value !== null && String(value).trim() !== "";
  return `<dt>${escapeHtml(label)}</dt><dd class="${present ? "" : "metadata-empty"}">${present ? escapeHtml(value) : "Not published"}</dd>`;
}

function renderPageDetails(section = "overview") {
  const report = state.activeReport;
  const details = report && report.pageDetails;
  elements["manual-review"].hidden = section !== "overview";
  if (!details) {
    elements["page-details"].innerHTML = `<div class="empty-state"><strong>Page details are unavailable in this saved report.</strong><br>Rescan the page to collect them.</div>`;
    return;
  }
  state.pageDetailSection = section;
  const metadata = details.metadata || {};
  const assetBySelector = new Map((report.assets || []).map(asset => [asset.selector, asset]));
  const authoredHeadings = report.settings.profile === "cms-lite" ? details.headings.filter(heading => !heading.component) : details.headings;
  const generatedHeadings = report.settings.profile === "cms-lite" ? details.headings.filter(heading => heading.component) : [];
  const headingIssues = authoredHeadings.filter(heading => heading.flags && heading.flags.length).length;
  const open = report.issues.filter(finding => effectiveStatus(finding) === "open");
  const headingRows = headings => headings.length ? headings.map(heading => `<li class="heading-outline-row heading-level-${heading.level}${heading.component ? " cms-generated-heading" : ""}"><button class="detail-jump" type="button" data-selector="${escapeHtml(heading.selector)}"><span class="detail-level level-h${heading.level}">H${heading.level}</span><span class="heading-outline-text">${escapeHtml(heading.text)}</span>${(heading.flags || []).map(flag => `<span class="detail-flag">${escapeHtml(flag)}</span>`).join("")}</button></li>`).join("") : `<li class="detail-empty-row">No visible headings found.</li>`;
  const linkCheck = report.linkCheck || null;
  const couldNotVerify = linkCheck ? (linkCheck.permissionRequired || 0) + (linkCheck.restricted || 0) + (linkCheck.rateLimited || 0) + (linkCheck.unavailable || 0) : 0;
  const responseErrors = linkCheck ? (linkCheck.serverErrors || 0) + (linkCheck.clientErrors || 0) : 0;
  const linkCheckText = linkCheck
    ? linkCheck.state === "permission-denied"
      ? `Website access declined · 0 of ${linkCheck.totalFound || 0} checked`
      : `${linkCheck.completed || 0} of ${linkCheck.totalFound || 0} processed · ${linkCheck.okay || 0} working · ${linkCheck.broken || 0} broken · ${responseErrors} errors · ${couldNotVerify} could not verify`
    : "Optional · checks every unique HTTP and HTTPS destination";
  const resultPriority = ["broken", "server", "client-error", "rate-limited", "restricted", "unavailable", "permission", "ok"];
  const resultLabels = { broken: "Broken", server: "Server error", "client-error": "HTTP error", "rate-limited": "Rate limited", restricted: "Restricted", unavailable: "Could not verify", permission: "Permission needed", ok: "Working" };
  const renderLinkResult = result => `
    <li class="link-result ${escapeHtml(result.status)}">
      <div class="link-result-heading"><span class="status-label ${escapeHtml(result.status)}">${escapeHtml(resultLabels[result.status] || result.status)}</span>${result.code ? `<strong>HTTP ${result.code}</strong>` : ""}${result.link.occurrences > 1 ? `<span>${result.link.occurrences} occurrences</span>` : ""}</div>
      <strong>${escapeHtml(result.link.text || "[No accessible name]")}</strong>
      ${result.link.location ? `<span class="link-redirect">Under: ${escapeHtml(result.link.location)}</span>` : ""}
      <span class="link-destination">${escapeHtml(result.link.href)}</span>
      ${result.redirected && result.finalUrl ? `<span class="link-redirect">Redirects to ${escapeHtml(result.finalUrl)}</span>` : ""}
      ${result.error ? `<span class="link-error">${escapeHtml(result.error)}</span>` : ""}
      <div class="link-result-actions">${result.link.selector ? `<button class="button tertiary compact detail-jump" type="button" data-selector="${escapeHtml(result.link.selector)}">${workspaceSurface ? "View on original page" : "Show on page"}</button>` : ""}<button class="button tertiary compact open-background-link" type="button" data-url="${escapeHtml(result.link.href)}">Open in background</button></div>
    </li>`;
  const linkResultGroups = linkCheck && Array.isArray(linkCheck.results) ? resultPriority.map(status => {
    const results = linkCheck.results.filter(result => result.status === status);
    if (!results.length) return "";
    const opensByDefault = ["broken", "server", "client-error", "permission"].includes(status);
    return `<details class="link-result-group ${escapeHtml(status)}"${opensByDefault ? " open" : ""}><summary><span>${escapeHtml(resultLabels[status])}</span><strong>${results.length}</strong></summary><ul class="link-results">${results.map(renderLinkResult).join("")}</ul></details>`;
  }).join("") : "";
  const back = section === "overview" ? "" : `<button class="text-button detail-section-back" type="button" data-detail-section="overview">← Page details</button>`;

  if (section === "overview") {
    const brokenSummary = linkCheck ? `${linkCheck.broken || 0} broken · ${couldNotVerify} could not verify` : "Status check has not been run";
    const grade = report.stats.readingGrade === null ? "Not enough prose" : `Estimated grade ${report.stats.readingGrade}`;
    elements["page-details"].innerHTML = `
      <p class="eyebrow">Inspect the page</p><h2>Page details</h2>
      <p class="hint">Choose an area to inspect. Findings remain available in the Findings tab.</p>
      <div class="details-landing">
        <button class="detail-card" type="button" data-detail-section="headings"><span><strong>Headings</strong><span>${headingIssues} outline flag${headingIssues === 1 ? "" : "s"}${generatedHeadings.length ? ` · ${generatedHeadings.length} CMS-generated` : ""}</span></span><span class="detail-card-count">${authoredHeadings.length}</span></button>
        <button class="detail-card" type="button" data-detail-section="images"><span><strong>Images and alt text</strong><span>${details.counts.imagesMissingAlt} missing alt · ${details.counts.imagesEmptyAlt} empty alt</span></span><span class="detail-card-count">${details.counts.images}</span></button>
        <button class="detail-card" type="button" data-detail-section="links"><span><strong>Links and assets</strong><span>${brokenSummary}</span></span><span class="detail-card-count">${details.counts.links}</span></button>
        <button class="detail-card" type="button" data-detail-section="metadata"><span><strong>Metadata and SEO</strong><span>${metadata.description ? "Description published" : "Meta description missing"}</span></span><span class="detail-card-count">›</span></button>
        <button class="detail-card" type="button" data-detail-section="statistics"><span><strong>Content statistics</strong><span>${report.stats.words.toLocaleString()} words · ${grade}</span></span><span class="detail-card-count">›</span></button>
        <button class="detail-card" type="button" data-detail-section="overlays"><span><strong>Page overlays</strong><span>Label headings, alt text or link destinations on the page</span></span><span class="detail-card-count">›</span></button>
      </div>`;
    return;
  }

  if (section === "headings") {
    elements["page-details"].innerHTML = `${back}<h2>Heading outline</h2><p class="detail-help">Indentation and level badges show the hierarchy. Select a row to find that heading on the page.</p><ul class="detail-list heading-outline">${headingRows(authoredHeadings)}</ul>${generatedHeadings.length ? `<details class="detail-section cms-heading-section"><summary>CMS-generated accordion headings (${generatedHeadings.length})</summary><p class="detail-help">CMS Lite renders these component headings. They stay separate from the authored outline and “On this page” comparison.</p><ul class="detail-list heading-outline">${headingRows(generatedHeadings)}</ul></details>` : ""}`;
    return;
  }

  if (section === "images") {
    elements["page-details"].innerHTML = `${back}<h2>Images and alt text</h2><button class="button secondary" type="button" data-overlay="alts">Show alt text on page</button><ul class="detail-list">${details.images.length ? details.images.map(image => `<li><button class="detail-jump" type="button" data-selector="${escapeHtml(image.selector)}"><strong>${image.altState === "missing" ? "Missing alt attribute" : image.altState === "empty" ? "Empty alt (decorative)" : `Alt: ${escapeHtml(image.alt)}`}</strong><br><span class="component-note">${escapeHtml(image.src)}</span></button></li>`).join("") : `<li class="detail-empty-row">No visible images found.</li>`}</ul>`;
    return;
  }

  if (section === "links") {
    const linkCheckButtonLabel = linkCheck && linkCheck.state === "permission-denied" ? "Allow access and check links" : linkCheck ? "Check again" : "Check all links";
    const permissionHelp = linkCheck && linkCheck.state === "permission-denied"
      ? `<p class="detail-help permission-warning"><strong>No links were checked.</strong> Select “Allow access and check links” and approve the browser prompt.</p>`
      : `<p class="detail-help">Requests omit cookies and browser sign-in details. Some destinations may block automated checks.</p>`;
    elements["page-details"].innerHTML = `${back}<h2>Links and assets</h2><section class="link-check-panel"><div><strong>HTTP link status</strong><span>${linkCheckText}</span></div>${linkCheck ? `<progress class="link-check-progress" max="${Math.max(1, linkCheck.totalFound || 1)}" value="${linkCheck.completed || 0}">${linkCheck.completed || 0} of ${linkCheck.totalFound || 0}</progress>` : ""}<div class="link-check-actions">${state.linkCheckRunning ? `<button class="button secondary compact link-check-pause" type="button">${state.linkCheckPaused ? "Resume" : "Pause"}</button><button class="button tertiary compact link-check-stop" type="button">Stop</button>` : `<button class="button primary compact link-check-button" type="button">${linkCheckButtonLabel}</button>`}<button class="button secondary compact manage-permissions-button" type="button">Website access</button></div>${permissionHelp}</section>${linkCheck ? (linkResultGroups || `<div class="empty-state">No individual link results are available.</div>`) : `<div class="empty-state">Run the link check to see each destination and its result.</div>`}<details class="detail-section"><summary>All page links (${details.links.length})</summary><ul class="detail-list">${details.links.length ? details.links.map(link => { const asset = assetBySelector.get(link.selector); const verification = asset ? ` · asset ${String(asset.verificationStatus || "not checked").replace(/-/g, " ")}${asset.actualSize ? ` · ${displayBytes(asset.actualSize)}` : ""}` : ""; return `<li><button class="detail-jump" type="button" data-selector="${escapeHtml(link.selector)}"><strong>${escapeHtml(link.text)}</strong><br><span class="component-note">${escapeHtml(link.location || "Page content")} · ${escapeHtml(link.href)}${escapeHtml(verification)}</span></button></li>`; }).join("") : `<li class="detail-empty-row">No visible links found.</li>`}</ul></details>`;
    return;
  }

  if (section === "metadata") {
    elements["page-details"].innerHTML = `${back}<h2>Metadata and SEO</h2><dl class="metadata-list">${metadataDefinition("HTML title", metadata.documentTitle)}${metadataDefinition("Meta description", metadata.description)}${metadataDefinition("Keywords", metadata.keywords)}${metadataDefinition("Canonical URL", metadata.canonical)}${metadataDefinition("Robots", metadata.robots)}${metadataDefinition("Page language", metadata.language)}${metadataDefinition("Structured data", `${metadata.jsonLdCount || 0} JSON-LD block${metadata.jsonLdCount === 1 ? "" : "s"}`)}${(metadata.custom || []).filter(item => !["keywords", "robots"].includes(item.name.toLowerCase())).map(item => metadataDefinition(item.name, item.value)).join("")}</dl>`;
    return;
  }

  if (section === "statistics") {
    const counts = reportCounts(report);
    elements["page-details"].innerHTML = `${back}<h2>Content statistics</h2><div class="details-overview"><div class="detail-stat"><strong>${report.stats.words.toLocaleString()}</strong><span>words</span></div><div class="detail-stat"><strong>${report.stats.sentences.toLocaleString()}</strong><span>sentence blocks</span></div><div class="detail-stat"><strong>${report.stats.readingGrade === null ? "—" : report.stats.readingGrade}</strong><span>estimated reading grade</span></div><div class="detail-stat"><strong>${authoredHeadings.length}</strong><span>authored headings</span></div><div class="detail-stat"><strong>${details.counts.links}</strong><span>links</span></div><div class="detail-stat"><strong>${details.counts.images}</strong><span>images</span></div></div><details class="detail-section"><summary>Open finding totals</summary><div class="finding-breakdown"><div class="breakdown-severity"><div class="fix"><strong>${counts.fix}</strong><span>Fix</span></div><div class="check"><strong>${counts.check}</strong><span>Check</span></div><div class="review"><strong>${counts.review}</strong><span>Review</span></div></div></div></details><details class="detail-section"><summary>Page components</summary><dl class="metadata-list">${metadataDefinition("Lists", details.counts.lists)}${metadataDefinition("Tables", details.counts.tables)}${metadataDefinition("Forms", details.counts.forms)}${metadataDefinition("Accordions", details.counts.accordions)}${metadataDefinition("Asset links", details.counts.assets)}</dl></details>`;
    return;
  }

  elements["page-details"].innerHTML = `${back}<h2>Page overlays</h2><p class="hint">Use these temporary labels to understand the live page. Clear them when you finish.</p><div class="audit-tools"><button type="button" data-overlay="headings">Heading levels</button><button type="button" data-overlay="alts">Image alt text</button><button type="button" data-overlay="links">Link destinations</button><button type="button" data-overlay="clear">Clear overlays</button></div>`;
}

async function highlightSelector(selector, requireReport, activateTab = false) {
  try {
    const tab = await currentReviewTab();
    if (!tab || !tab.id || (requireReport && (!state.activeReport || canonicalUrl(tab.url) !== canonicalUrl(state.activeReport.page.url)))) {
      showToast("Open the scanned page to show this finding.");
      return;
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [selector],
      func: selected => {
        const old = document.querySelector("[data-bc-style-checker-highlight]");
        if (old) {
          old.style.outline = old.dataset.bcStyleCheckerOutline || "";
          old.style.outlineOffset = old.dataset.bcStyleCheckerOffset || "";
          delete old.dataset.bcStyleCheckerHighlight;
          delete old.dataset.bcStyleCheckerOutline;
          delete old.dataset.bcStyleCheckerOffset;
        }
        const element = document.querySelector(selected);
        if (!element) return;
        element.dataset.bcStyleCheckerOutline = element.style.outline;
        element.dataset.bcStyleCheckerOffset = element.style.outlineOffset;
        element.dataset.bcStyleCheckerHighlight = "true";
        element.style.outline = "4px solid #fcba19";
        element.style.outlineOffset = "3px";
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          if (!element.dataset.bcStyleCheckerHighlight) return;
          element.style.outline = element.dataset.bcStyleCheckerOutline || "";
          element.style.outlineOffset = element.dataset.bcStyleCheckerOffset || "";
          delete element.dataset.bcStyleCheckerHighlight;
          delete element.dataset.bcStyleCheckerOutline;
          delete element.dataset.bcStyleCheckerOffset;
        }, 5000);
      }
    });
    if (activateTab) await chrome.tabs.update(tab.id, { active: true });
  } catch (_) {
    showToast("The page changed. Rescan it to refresh locations.");
  }
}

function locateFinding(selector) { return highlightSelector(selector, true, workspaceSurface); }

async function clearPageOverlays() {
  const tabId = state.overlayTabId;
  if (!tabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => { if (typeof globalThis.__bcWsgOverlayCleanup === "function") globalThis.__bcWsgOverlayCleanup(); }
    });
  } catch (_) {}
  state.overlayMode = "";
  state.overlayTabId = null;
}

async function runPageOverlay(mode) {
  if (mode === "clear") { await clearPageOverlays(); showToast("Page overlays cleared."); return; }
  const report = state.activeReport;
  if (!report || !report.pageDetails) return;
  const tab = await currentReviewTab();
  if (!tab || !tab.id || canonicalUrl(tab.url) !== canonicalUrl(report.page.url)) { showToast("Open the scanned page to use overlays."); return; }
  if (state.overlayTabId && state.overlayTabId !== tab.id) await clearPageOverlays();
  const items = mode === "headings" ? report.pageDetails.headings : mode === "alts" ? report.pageDetails.images : report.pageDetails.links;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [mode, items],
    func: (overlayMode, overlayItems) => {
      if (typeof globalThis.__bcWsgOverlayCleanup === "function") globalThis.__bcWsgOverlayCleanup();
      const touched = [];
      const badges = [];
      const cleanup = () => {
        badges.forEach(badge => badge.remove());
        const temporaryHighlight = document.querySelector("[data-bc-style-checker-highlight]");
        if (temporaryHighlight) {
          temporaryHighlight.style.outline = temporaryHighlight.dataset.bcStyleCheckerOutline || "";
          temporaryHighlight.style.outlineOffset = temporaryHighlight.dataset.bcStyleCheckerOffset || "";
          delete temporaryHighlight.dataset.bcStyleCheckerHighlight;
          delete temporaryHighlight.dataset.bcStyleCheckerOutline;
          delete temporaryHighlight.dataset.bcStyleCheckerOffset;
        }
        touched.forEach(element => {
          element.style.outline = element.dataset.bcWsgOverlayOutline || "";
          element.style.outlineOffset = element.dataset.bcWsgOverlayOffset || "";
          delete element.dataset.bcWsgOverlayOutline;
          delete element.dataset.bcWsgOverlayOffset;
        });
        delete globalThis.__bcWsgOverlayCleanup;
      };
      globalThis.__bcWsgOverlayCleanup = cleanup;
      const makeBadge = (text, title) => {
        const badge = document.createElement("span");
        badge.className = "bc-wsg-overlay-badge";
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = text;
        if (title) badge.title = title;
        Object.assign(badge.style, {
          display: "inline-block", position: "relative", zIndex: "2147483647", margin: "3px 6px 3px 0",
          padding: "3px 6px", color: "#fff", background: "#013366", border: "2px solid #fcba19",
          borderRadius: "3px", font: "700 12px/1.25 Arial,sans-serif", letterSpacing: "normal", textTransform: "none"
        });
        badges.push(badge);
        return badge;
      };
      overlayItems.forEach((item, index) => {
        let element;
        try { element = document.querySelector(item.selector); } catch (_) { element = null; }
        if (!element) return;
        element.dataset.bcWsgOverlayOutline = element.style.outline;
        element.dataset.bcWsgOverlayOffset = element.style.outlineOffset;
        element.style.outline = "3px solid #255a90";
        element.style.outlineOffset = "2px";
        touched.push(element);
        let label = "";
        if (overlayMode === "headings") label = `H${item.level}${item.flags && item.flags.length ? ` · ${item.flags.join(" · ")}` : ""}`;
        else if (overlayMode === "alts") label = item.altState === "missing" ? "Alt: MISSING" : item.altState === "empty" ? "Alt: empty (decorative)" : `Alt: ${item.alt}`;
        else {
          try {
            const destination = new URL(item.href, location.href);
            const display = destination.origin === location.origin
              ? `${destination.pathname}${destination.search}${destination.hash}`
              : `${destination.hostname}${destination.pathname}${destination.search}${destination.hash}`;
            label = `${index + 1}. ${display.length > 68 ? `${display.slice(0, 65)}…` : display}`;
          } catch (_) { label = `${index + 1}. ${item.kind}`; }
        }
        element.insertAdjacentElement(overlayMode === "headings" ? "beforebegin" : "afterend", makeBadge(label, overlayMode === "links" ? item.href : ""));
      });
    }
  });
  state.overlayMode = mode;
  state.overlayTabId = tab.id;
  showToast(`${mode === "headings" ? "Heading" : mode === "alts" ? "Alt text" : "Link"} overlay shown.`);
}

async function openSectionDialog() {
  try {
    const tab = await currentReviewTab();
    if (!tab || !tab.id || !isScannableUrl(tab.url)) throw new Error("Open a regular webpage first.");
    if (!await requestPagePermission(tab.url)) throw new Error("Access to this page was not granted.");
    const profile = detectProfile(tab.url);
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [profile],
      func: profileValue => {
        const root = profileValue === "cms-lite"
          ? (document.querySelector(".topicMain__container, .topicContent__main, #body") || document.body)
          : (document.querySelector("#post-content, .entry-content, main, [role='main'], article") || document.body);
        const path = element => {
          if (element.id) return `#${globalThis.CSS && CSS.escape ? CSS.escape(element.id) : element.id.replace(/[^a-zA-Z0-9_-]/g, "\\$&")}`;
          const parts = [];
          let current = element;
          while (current && current.nodeType === 1 && parts.length < 8) {
            let part = current.tagName.toLowerCase();
            const siblings = current.parentElement ? Array.from(current.parentElement.children).filter(item => item.tagName === current.tagName) : [];
            if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
            parts.unshift(part);
            current = current.parentElement;
          }
          return parts.join(" > ");
        };
        return Array.from(root.querySelectorAll("h2,h3,h4")).filter(heading => {
          const style = getComputedStyle(heading);
          if (style.display === "none" || style.visibility === "hidden" || !heading.getClientRects().length) return false;
          if (profileValue === "cms-lite" && heading.closest(".accordion,[class*='accordion' i],.panel,.panel-group,.collapse,[class*='collapse' i],details")) return false;
          return true;
        }).map(heading => ({ selector: path(heading), level: heading.tagName, text: heading.innerText.trim().replace(/\s+/g, " ") || "[No heading text]" }));
      }
    });
    state.availableSections = (results[0] && results[0].result) || [];
    elements["section-list"].innerHTML = state.availableSections.length
      ? state.availableSections.map((section, index) => `<button class="section-choice" type="button" data-index="${index}"><span>${escapeHtml(section.level)}</span>${escapeHtml(section.text)}</button>`).join("")
      : `<div class="empty-state">No visible H2 to H4 sections were found.</div>`;
    elements["section-dialog"].showModal();
  } catch (error) { showToast(readableScanError(error)); }
}

function chooseSection(index) {
  const section = state.availableSections && state.availableSections[index];
  if (!section) return;
  state.selectedSection = section;
  elements["section-dialog"].close();
  updateSettingsExplanation();
  highlightSelector(section.selector, false);
  elements["cache-note"].textContent = "Section selected. Run the scan to review only this section.";
}

function clearSelectedSection() {
  state.selectedSection = null;
  updateSettingsExplanation();
  elements["cache-note"].textContent = "The next scan will review the entire editable content area.";
}

function openExceptionDialog(finding) {
  state.pendingExceptionFinding = finding;
  elements["exception-rule-name"].textContent = finding.title;
  const proposed = finding.proposedPhrase || finding.flaggedToken || "";
  const unsafeBareBc = finding.ruleId === "bc-abbreviation" && normalizeSpace(proposed) === "BC";
  elements["exception-phrase"].value = unsafeBareBc ? "" : proposed;
  elements["exception-validation"].textContent = unsafeBareBc ? "Enter the complete formal name. ‘BC’ by itself cannot be allowed." : "";
  const siteRadio = document.querySelector("input[name='exception-scope'][value='site']");
  if (siteRadio) siteRadio.checked = true;
  elements["exception-dialog"].showModal();
  elements["exception-phrase"].focus();
  elements["exception-phrase"].select();
}

function openNoteDialog(finding) {
  if (!finding) return;
  state.pendingNoteFinding = finding;
  const note = auditNote(finding);
  elements["note-finding-name"].textContent = finding.title;
  elements["note-important"].checked = Boolean(note.important);
  elements["note-text"].value = note.text || "";
  elements["note-dialog"].showModal();
  elements["note-text"].focus();
}

async function saveAuditNote(event) {
  event.preventDefault();
  const finding = state.pendingNoteFinding;
  if (!finding) return;
  const textValue = normalizeSpace(elements["note-text"].value).slice(0, 500);
  const important = elements["note-important"].checked;
  if (textValue || important) state.notes[finding.fingerprint] = { text: textValue, important, updatedAt: new Date().toISOString() };
  else delete state.notes[finding.fingerprint];
  await saveKey(STORAGE_KEYS.notes, state.notes);
  state.pendingNoteFinding = null;
  elements["note-dialog"].close();
  renderReviewView();
  showToast(textValue || important ? "Audit note saved." : "Audit note removed.");
}

function readyFeedbackNotes() {
  return state.feedbackNotes.filter(note => !note.archivedAt);
}

function archivedFeedbackNotes() {
  return state.feedbackNotes.filter(note => Boolean(note.archivedAt));
}

function feedbackTypeLabel(value) {
  return FEEDBACK_TYPES[value] || FEEDBACK_TYPES.other;
}

function feedbackNotesForFinding(finding) {
  if (!finding) return [];
  return readyFeedbackNotes().filter(note => note.context && note.context.finding && note.context.finding.fingerprint === finding.fingerprint);
}

function browserLabel() {
  const userAgent = navigator.userAgent || "";
  const browser = userAgent.match(/Edg\/([\d.]+)/) || userAgent.match(/Chrome\/([\d.]+)/);
  const name = /Edg\//.test(userAgent) ? "Microsoft Edge" : "Google Chrome";
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  return `${browser ? `${name} ${browser[1]}` : "Chromium browser"}${platform ? ` · ${platform}` : ""}`;
}

function reportScopeLabel(report) {
  if (!report || !report.settings) return "";
  if (report.settings.sectionLabel) return `Section: ${report.settings.sectionLabel}`;
  if (report.settings.scope === "whole") return "Whole website";
  return report.settings.profile === "cms-lite" ? "Editable CMS Lite content" : "Page content";
}

async function captureLiveFeedbackContext() {
  const tab = await currentReviewTab().catch(() => null);
  if (!tab || !tab.id || !isScannableUrl(tab.url || "")) return { tab, selection: null };
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selection = window.getSelection();
        const selectedText = selection ? selection.toString().trim().replace(/\s+/g, " ").slice(0, 1000) : "";
        const anchor = selection && selection.anchorNode ? (selection.anchorNode.nodeType === 1 ? selection.anchorNode : selection.anchorNode.parentElement) : null;
        let nearestHeading = "";
        if (anchor) {
          const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"));
          headings.forEach(heading => {
            if (heading === anchor || heading.contains(anchor) || (heading.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING)) {
              const text = (heading.innerText || heading.textContent || "").trim().replace(/\s+/g, " ");
              if (text) nearestHeading = text;
            }
          });
        }
        return { selectedText, nearestHeading, documentTitle: document.title || "" };
      }
    });
    return { tab, selection: (results[0] && results[0].result) || null };
  } catch (_) {
    return { tab, selection: null };
  }
}

async function captureFeedbackContext(finding = null) {
  const live = await captureLiveFeedbackContext();
  const report = state.activeReport;
  const tab = live.tab || state.activeTab;
  const pageUrl = (report && report.page && report.page.url) || (tab && tab.url) || "";
  const detectedProfile = report && report.settings
    ? report.settings.profileLabel
    : pageUrl ? (detectProfile(pageUrl) === "cms-lite" ? "CMS Lite" : "Standard website") : "";
  const findingContext = finding ? {
    fingerprint: finding.fingerprint || "",
    title: finding.title || "",
    ruleId: finding.ruleId || "",
    category: finding.category || "",
    severity: sentenceLabel(finding.severity),
    responsibility: finding.responsibility || "",
    location: finding.location || "",
    evidence: String(finding.evidence || "").slice(0, 1500),
    flaggedWording: finding.matchText || finding.flaggedToken || "",
    selector: finding.selector || ""
  } : null;
  return {
    pageTitle: (report && report.page && report.page.title) || (live.selection && live.selection.documentTitle) || (tab && tab.title) || "",
    pageUrl,
    domain: hostnameFor(pageUrl),
    detectedProfile,
    scanScope: reportScopeLabel(report),
    pageSection: (findingContext && findingContext.location) || (live.selection && live.selection.nearestHeading) || (report && report.settings && report.settings.sectionLabel) || "",
    selectedText: (live.selection && live.selection.selectedText) || "",
    finding: findingContext,
    extensionVersion: chrome.runtime.getManifest().version,
    rulesVersion: globalThis.BCWebStyleGuideChecker.ruleVersion,
    browser: browserLabel(),
    capturedAt: new Date().toISOString()
  };
}

function feedbackContextPreview(context) {
  const finding = context && context.finding;
  return [
    metadataDefinition("Page", context && context.pageTitle),
    metadataDefinition("Address", context && context.pageUrl),
    metadataDefinition("Detected site profile", context && context.detectedProfile),
    metadataDefinition("Scan scope", context && context.scanScope),
    metadataDefinition("Page section", context && context.pageSection),
    context && context.selectedText ? metadataDefinition("Selected page text", context.selectedText) : "",
    finding ? metadataDefinition("Finding", finding.title) : "",
    finding ? metadataDefinition("Rule ID", finding.ruleId) : "",
    finding && finding.evidence ? metadataDefinition("Finding evidence", finding.evidence) : "",
    metadataDefinition("Extension version", context && context.extensionVersion),
    metadataDefinition("Rules version", context && context.rulesVersion),
    metadataDefinition("Browser", context && context.browser)
  ].join("");
}

async function openFeedbackDialog(finding = null, existingNote = null) {
  state.feedbackReturnFocus = document.activeElement;
  state.pendingFeedbackId = existingNote ? existingNote.id : "";
  state.pendingFeedbackContext = existingNote ? existingNote.context : await captureFeedbackContext(finding);
  elements["feedback-dialog-heading"].textContent = existingNote ? "Edit feedback" : "Add feedback";
  elements["feedback-type"].value = existingNote ? existingNote.type : (finding ? "incorrect" : "");
  elements["feedback-text"].value = existingNote ? existingNote.text : "";
  elements["feedback-important"].checked = Boolean(existingNote && existingNote.important);
  const hasPageContext = Boolean(state.pendingFeedbackContext && state.pendingFeedbackContext.pageUrl);
  elements["feedback-context-section"].hidden = !hasPageContext;
  elements["feedback-include-context"].checked = existingNote ? existingNote.includeContext !== false : hasPageContext;
  elements["feedback-context-preview"].innerHTML = feedbackContextPreview(state.pendingFeedbackContext || {});
  elements["feedback-dialog"].showModal();
  requestAnimationFrame(() => elements["feedback-type"].focus());
}

function closeFeedbackDialog() {
  elements["feedback-dialog"].close();
  const target = state.feedbackReturnFocus;
  state.feedbackReturnFocus = null;
  if (target && target.isConnected) requestAnimationFrame(() => target.focus());
}

async function saveFeedbackNote(event) {
  event.preventDefault();
  const type = elements["feedback-type"].value;
  const textValue = String(elements["feedback-text"].value || "").trim().slice(0, 2000);
  if (!type || !textValue) return;
  const existing = state.feedbackNotes.find(note => note.id === state.pendingFeedbackId);
  const now = new Date().toISOString();
  const note = {
    id: existing ? existing.id : `feedback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    text: textValue,
    important: elements["feedback-important"].checked,
    includeContext: !elements["feedback-context-section"].hidden && elements["feedback-include-context"].checked,
    context: state.pendingFeedbackContext || {},
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    archivedAt: existing ? existing.archivedAt || "" : ""
  };
  if (existing) state.feedbackNotes = state.feedbackNotes.map(item => item.id === note.id ? note : item);
  else state.feedbackNotes.push(note);
  await saveKey(STORAGE_KEYS.feedback, state.feedbackNotes);
  state.pendingFeedbackId = "";
  state.pendingFeedbackContext = null;
  closeFeedbackDialog();
  renderFeedback();
  if (state.reviewMode === "detail") renderReviewView();
  showToast(`Feedback note saved. ${readyFeedbackNotes().length} ready to email.`);
}

function feedbackCard(note, archived = false) {
  const context = note.context || {};
  return `<article class="feedback-note-card${note.important ? " is-important" : ""}" data-feedback-id="${escapeHtml(note.id)}">
    <div class="feedback-note-top"><span class="feedback-note-type">${escapeHtml(feedbackTypeLabel(note.type))}</span>${note.important ? `<span class="profile-badge feedback-important">Important</span>` : ""}</div>
    <p>${escapeHtml(note.text)}</p>
    <span class="feedback-context-status">${note.includeContext ? "Page context included" : context.pageUrl ? "Page context excluded from email and export" : "No page context captured"}</span>
    <div class="feedback-note-actions">
      ${archived ? `<button class="text-button restore-feedback" type="button">Restore</button>` : `<button class="text-button edit-feedback" type="button">Edit</button>`}
      <button class="text-button delete-feedback" type="button">Delete</button>
    </div>
  </article>`;
}

function feedbackGroups(notes, archived = false) {
  const groups = new Map();
  notes.forEach(note => {
    const context = note.context || {};
    const key = context.pageUrl || "__general__";
    if (!groups.has(key)) groups.set(key, { title: context.pageTitle || "General feedback", detail: context.domain || "No page address captured", notes: [] });
    groups.get(key).notes.push(note);
  });
  return Array.from(groups.values()).map(group => `<section class="feedback-page-group">
    <div class="feedback-page-heading"><strong>${escapeHtml(group.title)}</strong><span>${escapeHtml(group.detail)}</span></div>
    ${group.notes.map(note => feedbackCard(note, archived)).join("")}
  </section>`).join("");
}

function renderFeedback() {
  const ready = readyFeedbackNotes();
  const archived = archivedFeedbackNotes();
  const readyCount = ready.length;
  elements["feedback-header-count"].textContent = String(readyCount);
  elements["feedback-header-count"].hidden = readyCount === 0;
  elements["feedback-ready-count"].textContent = `${readyCount} saved`;
  elements["feedback-empty"].hidden = readyCount > 0;
  elements["feedback-list"].innerHTML = feedbackGroups(ready);
  elements["feedback-send-status"].innerHTML = `<strong>${readyCount} feedback note${readyCount === 1 ? " is" : "s are"} saved on this device.</strong> ${readyCount === 1 ? "It has" : "They have"} not been sent.`;
  elements["create-feedback-email"].disabled = readyCount === 0;
  elements["copy-feedback-report"].disabled = readyCount === 0;
  elements["export-feedback-csv"].disabled = readyCount === 0;
  elements["archived-feedback"].hidden = archived.length === 0;
  elements["archived-feedback-count"].textContent = archived.length ? `(${archived.length})` : "";
  elements["archived-feedback-list"].innerHTML = feedbackGroups(archived, true);
}

function feedbackReportDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function feedbackSubject(notes) {
  const version = chrome.runtime.getManifest().version;
  return `Web Style Guide Checker feedback — v${version} — ${feedbackReportDate()} — ${notes.length} note${notes.length === 1 ? "" : "s"}`;
}

function feedbackReportText(notes = readyFeedbackNotes()) {
  const includedPages = new Set(notes.filter(note => note.includeContext && note.context && note.context.pageUrl).map(note => canonicalUrl(note.context.pageUrl)));
  const version = chrome.runtime.getManifest().version;
  const lines = [
    "Web Style Guide Checker feedback",
    "",
    `Created: ${formatDate(new Date().toISOString())}`,
    `Extension version: ${version}`,
    `Rules version: ${globalThis.BCWebStyleGuideChecker.ruleVersion}`,
    `Browser: ${browserLabel()}`,
    `Notes included: ${notes.length}`,
    `Pages represented: ${includedPages.size}`,
    "",
    "This report was created from feedback notes saved in the extension."
  ];
  notes.forEach((note, index) => {
    const context = note.context || {};
    const finding = context.finding || null;
    lines.push("", `${index + 1}. ${feedbackTypeLabel(note.type)}${note.important ? " — Important" : ""}`, "", note.text, "", "Reported from:");
    if (!note.includeContext) {
      lines.push("Page context excluded by the tester.");
    } else if (!context.pageUrl) {
      lines.push("No page context was available.");
    } else {
      if (context.pageTitle) lines.push(`Page: ${context.pageTitle}`);
      lines.push(`Address: ${context.pageUrl}`);
      if (context.detectedProfile) lines.push(`Detected site profile: ${context.detectedProfile}`);
      if (context.scanScope) lines.push(`Scan scope: ${context.scanScope}`);
      if (context.pageSection) lines.push(`Page section: ${context.pageSection}`);
      if (context.selectedText) lines.push(`Selected page text: ${context.selectedText}`);
      if (finding) {
        if (finding.title) lines.push(`Finding: ${finding.title}`);
        if (finding.ruleId) lines.push(`Rule ID: ${finding.ruleId}`);
        if (finding.category) lines.push(`Category: ${finding.category}`);
        if (finding.severity) lines.push(`Review level: ${finding.severity}`);
        if (finding.flaggedWording) lines.push(`Flagged wording: ${finding.flaggedWording}`);
        if (finding.evidence) lines.push(`Finding evidence: ${finding.evidence}`);
      }
    }
    lines.push(`Captured: ${formatDate(context.capturedAt || note.createdAt)}`, `Captured with extension v${context.extensionVersion || version} · rules v${context.rulesVersion || globalThis.BCWebStyleGuideChecker.ruleVersion}`);
  });
  return lines.join("\n");
}

async function copyFeedbackReport() {
  const notes = readyFeedbackNotes();
  if (!notes.length) return;
  await navigator.clipboard.writeText(feedbackReportText(notes));
  showToast(`${notes.length} feedback note${notes.length === 1 ? "" : "s"} copied.`);
}

const FEEDBACK_CSV_HEADER = [
  "Note ID", "Created", "Feedback type", "Important", "Feedback note", "Include page context", "Page title", "Page URL", "Domain", "Detected site profile", "Scan scope", "Page section",
  "Selected page text", "Finding", "Rule ID", "Category", "Review level", "Flagged wording", "Finding evidence", "Extension version", "Rules version", "Browser"
];

function feedbackCsvRows(notes = readyFeedbackNotes()) {
  return notes.map(note => {
    const context = note.context || {};
    const finding = context.finding || {};
    const included = note.includeContext;
    return [
      note.id, note.createdAt, feedbackTypeLabel(note.type), note.important ? "Yes" : "No", note.text, included ? "Yes" : "No",
      included ? context.pageTitle || "" : "", included ? context.pageUrl || "" : "", included ? context.domain || "" : "", included ? context.detectedProfile || "" : "",
      included ? context.scanScope || "" : "", included ? context.pageSection || "" : "", included ? context.selectedText || "" : "", included ? finding.title || "" : "",
      included ? finding.ruleId || "" : "", included ? finding.category || "" : "", included ? finding.severity || "" : "", included ? finding.flaggedWording || "" : "",
      included ? finding.evidence || "" : "", context.extensionVersion || chrome.runtime.getManifest().version, context.rulesVersion || globalThis.BCWebStyleGuideChecker.ruleVersion, context.browser || ""
    ];
  });
}

function exportFeedbackCsv() {
  const notes = readyFeedbackNotes();
  if (!notes.length) return;
  downloadCsvRows(feedbackCsvRows(notes), `web-style-guide-checker-feedback-${feedbackReportDate()}.csv`, FEEDBACK_CSV_HEADER);
}

async function createFeedbackEmail() {
  const notes = readyFeedbackNotes();
  if (!notes.length) return;
  const report = feedbackReportText(notes);
  try {
    await navigator.clipboard.writeText(report);
  } catch (_) {
    if (report.length > MAILTO_REPORT_LIMIT) {
      showToast("The report could not be copied. Use Copy report before creating the email.");
      return;
    }
  }
  const subject = feedbackSubject(notes);
  const body = report.length <= MAILTO_REPORT_LIMIT
    ? report
    : `Web Style Guide Checker feedback\n\n${notes.length} notes are ready. The complete report has been copied to the clipboard. Paste it into this email before sending.\n\nExtension version: ${chrome.runtime.getManifest().version}\nCreated: ${feedbackReportDate()}`;
  const anchor = document.createElement("a");
  anchor.href = `mailto:${FEEDBACK_RECIPIENTS.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  state.preparedFeedbackIds = notes.map(note => note.id);
  elements["feedback-email-dialog"].showModal();
}

async function archivePreparedFeedback() {
  const prepared = new Set(state.preparedFeedbackIds);
  const now = new Date().toISOString();
  state.feedbackNotes = state.feedbackNotes.map(note => prepared.has(note.id) ? { ...note, archivedAt: now } : note);
  await saveKey(STORAGE_KEYS.feedback, state.feedbackNotes);
  state.preparedFeedbackIds = [];
  elements["feedback-email-dialog"].close();
  renderFeedback();
  showToast("Prepared feedback notes archived.");
}

async function restoreFeedbackNote(id) {
  state.feedbackNotes = state.feedbackNotes.map(note => note.id === id ? { ...note, archivedAt: "" } : note);
  await saveKey(STORAGE_KEYS.feedback, state.feedbackNotes);
  renderFeedback();
  showToast("Feedback note restored.");
}

async function deleteFeedbackNote(id) {
  const note = state.feedbackNotes.find(item => item.id === id);
  if (!note || !confirm("Delete this feedback note? This cannot be undone.")) return;
  state.feedbackNotes = state.feedbackNotes.filter(item => item.id !== id);
  await saveKey(STORAGE_KEYS.feedback, state.feedbackNotes);
  renderFeedback();
  if (state.reviewMode === "detail") renderReviewView();
  showToast("Feedback note deleted.");
}

function openFeedbackView() {
  if (state.currentView !== "feedback") {
    state.feedbackPreviousView = state.currentView;
    state.feedbackPreviousScroll = document.scrollingElement ? document.scrollingElement.scrollTop : 0;
  }
  switchView("feedback");
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
}

function closeFeedbackView() {
  const destination = ["current", "batch", "terms"].includes(state.feedbackPreviousView) ? state.feedbackPreviousView : "current";
  switchView(destination);
  requestAnimationFrame(() => {
    if (document.scrollingElement) document.scrollingElement.scrollTop = state.feedbackPreviousScroll || 0;
    elements["feedback-header-button"].focus();
  });
}

async function saveException(event) {
  event.preventDefault();
  const finding = state.pendingExceptionFinding;
  if (!finding || !state.activeReport) return;
  const validation = globalThis.BCWebStyleGuideChecker.helpers.validateExceptionPhrase(elements["exception-phrase"].value, finding.flaggedToken);
  if (!validation.valid) {
    elements["exception-validation"].textContent = validation.reason;
    return;
  }
  const continuation = {
    reviewMode: state.reviewMode,
    selectedRuleId: state.selectedRuleId,
    queue: state.detailQueue.slice(),
    index: state.detailQueue.indexOf(finding.fingerprint),
    groups: visibleRuleGroups().map(group => group.ruleId)
  };
  const scope = (document.querySelector("input[name='exception-scope']:checked") || {}).value || "site";
  const exception = {
    id: `x-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ruleId: finding.ruleId,
    ruleTitle: finding.title,
    phrase: validation.phrase,
    domain: scope === "all" ? "*" : state.activeReport.page.hostname,
    createdAt: new Date().toISOString()
  };
  const duplicate = state.exceptions.some(item => item.ruleId === exception.ruleId && item.phrase === exception.phrase && item.domain === exception.domain);
  if (!duplicate) state.exceptions.push(exception);
  await saveKey(STORAGE_KEYS.exceptions, state.exceptions);
  elements["exception-dialog"].close();
  renderTerms();
  await scanCurrentPage({ preserveReview: true });
  continueAfterAllowedTerm(continuation);
  showToast(duplicate ? "That exact-term exception already exists." : `Allowed “${exception.phrase}” for this rule.`);
}

function continueAfterAllowedTerm(continuation) {
  if (!state.activeReport || continuation.reviewMode !== "detail") return;
  const openByFingerprint = new Map(filteredFindings().map(finding => [finding.fingerprint, finding]));
  const laterFinding = continuation.queue
    .slice(Math.max(0, continuation.index + 1))
    .map(fingerprint => openByFingerprint.get(fingerprint))
    .find(Boolean);
  if (laterFinding) {
    openRuleGroup(laterFinding.ruleId, laterFinding.fingerprint);
    return;
  }
  const groups = visibleRuleGroups();
  const sameGroup = groups.find(group => group.ruleId === continuation.selectedRuleId);
  if (sameGroup) {
    openRuleGroup(sameGroup.ruleId);
    return;
  }
  const previousGroupIndex = continuation.groups.indexOf(continuation.selectedRuleId);
  const nextGroup = continuation.groups
    .slice(Math.max(0, previousGroupIndex + 1))
    .map(ruleId => groups.find(group => group.ruleId === ruleId))
    .find(Boolean) || groups[0];
  if (nextGroup) openRuleGroup(nextGroup.ruleId);
  else closeFindingReview();
}

async function removeException(id) {
  state.exceptions = state.exceptions.filter(item => item.id !== id);
  await saveKey(STORAGE_KEYS.exceptions, state.exceptions);
  renderTerms();
  if (state.activeReport) await scanCurrentPage({ preserveReview: true });
}

function renderTerms() {
  elements["personal-term-count"].textContent = `${state.exceptions.length} saved`;
  elements["personal-terms"].innerHTML = state.exceptions.length ? state.exceptions.map(item => `
    <div class="term-row">
      <div><strong>${escapeHtml(item.phrase)}</strong><small>${escapeHtml(item.ruleTitle || item.ruleId)} · ${item.domain === "*" ? "All sites" : item.domain}</small></div>
      <button class="small-button remove-term" type="button" data-id="${escapeHtml(item.id)}">Remove</button>
    </div>`).join("") : `<div class="empty-state">No personal allowed terms yet.</div>`;
  elements["built-in-terms-list"].innerHTML = globalThis.BCWebStyleGuideChecker.builtInTerms.map(term => `<span class="term-chip">${escapeHtml(term)}</span>`).join("");
}

function findingsForExport(report, includeReviewed) {
  return report.issues.filter(finding => includeReviewed || effectiveStatus(finding) === "open");
}

function groupedFindingsForExport(report, includeReviewed) {
  const groups = new Map();
  findingsForExport(report, includeReviewed).forEach(finding => {
    const status = effectiveStatus(finding);
    const key = `${status}|${finding.ruleId}`;
    if (!groups.has(key)) groups.set(key, { finding, status, items: [], occurrenceCount: 0, important: false, notes: [] });
    const group = groups.get(key);
    const note = auditNote(finding);
    group.items.push(finding);
    group.occurrenceCount += finding.occurrenceCount || 1;
    group.important = group.important || Boolean(note.important);
    if (note.text && !group.notes.includes(note.text)) group.notes.push(note.text);
  });
  return Array.from(groups.values());
}

function reportText(report, includeReviewed) {
  const counts = reportCounts(report);
  const lines = [
    "B.C. Web Style Guide review",
    report.page.title,
    report.page.url,
    `Checked: ${formatDate(report.scannedAt)}`,
    `Reviewed: ${report.settings.scope === "whole" ? "The whole website" : "The page content"} · ${report.settings.profileLabel}`,
    "",
    `Open findings: ${counts.fix} fix · ${counts.check} check · ${counts.review} review`,
    `${report.stats.words} words · Reading estimate: ${report.stats.readingGrade === null ? "not available" : "Grade " + report.stats.readingGrade}`,
    ""
  ];
  groupedFindingsForExport(report, includeReviewed).forEach((group, index) => {
    const finding = group.finding;
    lines.push(`${index + 1}. ${finding.title} — ${finding.severity} · ${group.status}${group.important ? " · important" : ""}`);
    lines.push(`   Where: ${Array.from(new Set(group.items.map(item => item.location || "Page"))).join("; ")}`);
    lines.push(`   Why it matters: ${finding.why}`);
    lines.push(`   What to do: ${finding.suggestion}`);
    if (group.items.length) lines.push(`   Examples: ${group.items.slice(0, 4).map(item => item.evidence).join(" | ")}${group.items.length > 4 ? ` | ${group.items.length - 4} more` : ""}`);
    if (group.notes.length) lines.push(`   Note: ${group.notes.join(" | ")}`);
    lines.push(`   Guidance: ${finding.sourceUrl}`);
    lines.push("");
  });
  return lines.join("\n");
}

const ACTION_HEADER = [
  "ID", "Page", "URL", "Where on the page", "Category", "Issue", "Why it matters", "Recommended action",
  "Review level", "Who can fix it", "Status", "Important", "Audit note", "Examples", "Occurrences", "Guidance"
];

function actionRows(report, includeReviewed, submittedUrl, pageNumber) {
  const prefix = `P${String(pageNumber || 1).padStart(3, "0")}`;
  return groupedFindingsForExport(report, includeReviewed).map((group, index) => {
    const finding = group.finding;
    return [
      `${prefix}-${String(index + 1).padStart(3, "0")}`, report.page.title, report.page.url || submittedUrl,
      Array.from(new Set(group.items.map(item => item.location || "Page"))).join("; "), finding.category, finding.title,
      finding.why, finding.suggestion, sentenceLabel(finding.severity), finding.responsibility, sentenceLabel(group.status),
      group.important ? "Yes" : "", group.notes.join(" | "),
      group.items.slice(0, 6).map(item => item.evidence).join(" | "), group.occurrenceCount, finding.sourceUrl
    ];
  });
}

function downloadCsvRows(rows, filename, header) {
  const csv = [header || ACTION_HEADER, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function xmlEscape(value) {
  return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

function columnName(index) {
  let value = index + 1;
  let output = "";
  while (value) { value -= 1; output = String.fromCharCode(65 + (value % 26)) + output; value = Math.floor(value / 26); }
  return output;
}

function worksheetXml(rows) {
  const widths = [];
  rows.forEach(row => row.forEach((cell, index) => { widths[index] = Math.min(55, Math.max(widths[index] || 9, String(cell ?? "").length + 2)); }));
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const data = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => {
    const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
    if (typeof cell === "number" && Number.isFinite(cell)) return `<c r="${reference}"${rowIndex === 0 ? ' s="1"' : ""}><v>${cell}</v></c>`;
    return `<c r="${reference}" t="inlineStr"${rowIndex === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const last = rows.length && rows[0].length ? `${columnName(rows[0].length - 1)}${rows.length}` : "A1";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${data}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  const u16 = value => [value & 255, (value >>> 8) & 255];
  const u32 = value => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
  files.forEach(file => {
    const name = encoder.encode(file.name);
    const data = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
    const crc = crc32(data);
    const local = new Uint8Array([0x50,0x4b,0x03,0x04,...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0)]);
    parts.push(local, name, data);
    const header = new Uint8Array([0x50,0x4b,0x01,0x02,...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]);
    central.push(header, name);
    offset += local.length + name.length + data.length;
  });
  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array([0x50,0x4b,0x05,0x06,...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralSize),...u32(offset),...u16(0)]);
  return new Blob([...parts, ...central, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function downloadWorkbook(sheets, filename) {
  const used = new Set();
  const normalized = sheets.filter(sheet => sheet && sheet.rows && sheet.rows.length).map(sheet => {
    const base = String(sheet.name || "Sheet").replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
    let name = base;
    let number = 2;
    while (used.has(name)) { name = `${base.slice(0, 27)} ${number}`; number += 1; }
    used.add(name);
    return { name, rows: sheet.rows };
  });
  if (!normalized.length) { showToast("Choose at least one workbook section."); return; }
  const files = [];
  const typeOverrides = normalized.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  files.push({ name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${typeOverrides}</Types>` });
  files.push({ name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` });
  files.push({ name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${normalized.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>` });
  files.push({ name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${normalized.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${normalized.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` });
  files.push({ name: "xl/styles.xml", data: `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="BC Sans"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="BC Sans"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF013366"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` });
  normalized.forEach((sheet, index) => files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, data: worksheetXml(sheet.rows) }));
  const url = URL.createObjectURL(zipStore(files));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function copyCurrentReport() {
  if (!state.activeReport) return;
  await navigator.clipboard.writeText(reportText(state.activeReport, elements["current-export-reviewed"].checked));
  showToast("Report copied.");
}

const BATCH_METADATA_HEADER = [
  "Page", "Submitted URL", "Final URL", "Domain", "Scanned at", "HTML title", "Meta description", "Keywords", "Canonical URL", "Robots", "Page language", "JSON-LD blocks",
  "Open Graph title", "Open Graph description", "Twitter title", "Twitter description", "Alternate languages", "Additional published metadata"
];

const BATCH_STATS_HEADER = [
  "Page", "Submitted URL", "Final URL", "Domain", "Scanned at", "Scope", "Site profile", "Word count", "Sentence count", "Reading grade", "Authored headings", "CMS-generated headings", "Links", "Images",
  "Images missing alt", "Asset links", "Lists", "Tables", "Forms", "Accordions", "Open fixes", "Open checks", "Open reviews"
];

const LINK_EXPORT_HEADER = ["Page", "Page URL", "Where on the page", "Link text", "Destination", "Status", "HTTP code", "Final destination", "Occurrences"];

function metadataCustomValue(metadata, name) {
  return (metadata.custom || []).filter(item => String(item.name).toLowerCase() === name.toLowerCase()).map(item => item.value).join("; ");
}

function batchMetadataValues(report) {
  const metadata = (report.pageDetails && report.pageDetails.metadata) || {};
  const individuallyExported = new Set(["keywords", "robots", "og:title", "og:description", "twitter:title", "twitter:description"]);
  return [
    metadata.documentTitle || "", metadata.description || "", metadata.keywords || "", metadata.canonical || "", metadata.robots || "",
    metadata.language || "", metadata.jsonLdCount || 0, metadataCustomValue(metadata, "og:title"), metadataCustomValue(metadata, "og:description"),
    metadataCustomValue(metadata, "twitter:title"), metadataCustomValue(metadata, "twitter:description"),
    (metadata.alternates || []).map(item => `${item.language}: ${item.href}`).join("; "),
    (metadata.custom || []).filter(item => !individuallyExported.has(String(item.name).toLowerCase())).map(item => `${item.name}: ${item.value}`).join("; ")
  ];
}

function batchStatsValues(report) {
  const details = report.pageDetails || { headings: [], counts: {} };
  const counts = details.counts || {};
  const resultCounts = reportCounts(report);
  const cms = report.settings.profile === "cms-lite";
  return [
    report.stats.words, report.stats.sentences, report.stats.readingGrade === null ? "" : report.stats.readingGrade,
    (details.headings || []).filter(heading => !cms || !heading.component).length,
    cms ? (details.headings || []).filter(heading => heading.component).length : 0,
    counts.links || 0, counts.images || 0, counts.imagesMissingAlt || 0, counts.assets || 0, counts.lists || 0,
    counts.tables || 0, counts.forms || 0, counts.accordions || 0, resultCounts.fix, resultCounts.check, resultCounts.review
  ];
}

function metadataRow(report, submittedUrl) {
  return [report.page.title, submittedUrl || report.page.url, report.page.url, report.page.hostname, report.scannedAt, ...batchMetadataValues(report)];
}

function pageInventoryRow(report, submittedUrl) {
  return [report.page.title, submittedUrl || report.page.url, report.page.url, report.page.hostname, report.scannedAt,
    report.settings.scope === "whole" ? "Whole website" : "Page content", report.settings.profileLabel, ...batchStatsValues(report)];
}

function linkRows(report) {
  if (report.linkCheck && Array.isArray(report.linkCheck.results)) return report.linkCheck.results.map(result => [
    report.page.title, report.page.url, result.link.location || "Page", result.link.text || "[No accessible name]", result.link.href, result.status,
    result.code || "", result.finalUrl || "", result.link.occurrences || 1
  ]);
  return (((report.pageDetails || {}).links) || []).map(link => [report.page.title, report.page.url, link.location || "Page", link.text, link.href, "Not checked", "", "", 1]);
}

function currentWorkbookSheets() {
  if (!state.activeReport) return [];
  const report = state.activeReport;
  const includeReviewed = elements["current-export-reviewed"].checked;
  return [
    elements["current-export-findings"].checked ? { name: "Action report", rows: [ACTION_HEADER, ...actionRows(report, includeReviewed)] } : null,
    elements["current-export-metadata"].checked ? { name: "Metadata", rows: [BATCH_METADATA_HEADER, metadataRow(report)] } : null,
    elements["current-export-stats"].checked ? { name: "Page inventory", rows: [BATCH_STATS_HEADER, pageInventoryRow(report)] } : null,
    elements["current-export-links"].checked ? { name: "Links", rows: [LINK_EXPORT_HEADER, ...linkRows(report)] } : null
  ].filter(Boolean);
}

function downloadCurrentWorkbook() {
  downloadWorkbook(currentWorkbookSheets(), `bc-web-style-audit-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function parseBatchUrls() {
  const rawLines = elements["batch-urls"].value.split(/[\n\r]+/).map(value => value.trim()).filter(Boolean);
  const valid = [];
  const invalid = [];
  const seen = new Set();
  rawLines.forEach(value => {
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol)) throw new Error("Unsupported scheme");
      const canonical = canonicalUrl(url.href);
      if (!seen.has(canonical)) { seen.add(canonical); valid.push(url.href); }
    } catch (_) { invalid.push(value); }
  });
  return { rawCount: rawLines.length, valid: valid.slice(0, MAX_BATCH_URLS), invalid, duplicateCount: rawLines.length - valid.length - invalid.length, overLimit: valid.length > MAX_BATCH_URLS };
}

function renderBatchValidation() {
  const parsed = parseBatchUrls();
  const domains = new Set(parsed.valid.map(hostnameFor));
  const messages = [`${parsed.valid.length} valid URL${parsed.valid.length === 1 ? "" : "s"}`, `${domains.size} domain${domains.size === 1 ? "" : "s"}`];
  if (parsed.duplicateCount) messages.push(`${parsed.duplicateCount} duplicate${parsed.duplicateCount === 1 ? "" : "s"} removed`);
  if (parsed.invalid.length) messages.push(`${parsed.invalid.length} invalid`);
  if (parsed.overLimit) messages.push(`first ${MAX_BATCH_URLS} will be scanned`);
  elements["batch-validation"].textContent = messages.join(" · ");
  return parsed;
}

async function requestBatchPermissions(urls) {
  const origins = Array.from(new Set(urls.map(originPattern)));
  const granted = await chrome.permissions.request({ origins });
  if (!granted) throw new Error("Access to the submitted sites was not granted. The batch scan cannot inspect them without that permission.");
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let timeout;
    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timeout);
    };
    const listener = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        cleanup();
        resolve(tab);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Page load timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);
    chrome.tabs.get(tabId).then(tab => {
      if (tab.status === "complete") { cleanup(); resolve(tab); }
    }).catch(error => { cleanup(); reject(error); });
  });
}

async function waitForRenderedPage(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const signature = () => `${document.body ? document.body.innerText.length : 0}:${document.body ? document.body.getElementsByTagName("*").length : 0}`;
      let previous = "";
      let stableChecks = 0;
      const started = Date.now();
      while (Date.now() - started < 5000 && stableChecks < 2) {
        await new Promise(resolve => setTimeout(resolve, 400));
        const current = signature();
        stableChecks = current === previous ? stableChecks + 1 : 0;
        previous = current;
      }
    }
  });
}

function waitForResume() {
  return new Promise(resolve => {
    const check = () => {
      if (!state.batch.paused || state.batch.cancelled) resolve();
      else setTimeout(check, 250);
    };
    check();
  });
}

async function scanBatchUrl(url, settings) {
  let tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });
    state.batch.tempTabId = tab.id;
    tab = await waitForTabComplete(tab.id, BATCH_TIMEOUT_MS);
    const finalUrl = tab.url || url;
    if (!isScannableUrl(finalUrl)) throw new Error("The page redirected to an unsupported browser page.");
    await waitForRenderedPage(tab.id);
    const profile = detectProfile(finalUrl);
    const report = await scanTab(tab.id, {
      scope: settings.scope,
      profile,
      canControlColour: profile === "cms-lite" ? false : settings.canControlColour,
      exceptions: state.exceptions
    });
    return { submittedUrl: url, status: "complete", report };
  } catch (error) {
    return { submittedUrl: url, status: "error", error: readableScanError(error), scannedAt: new Date().toISOString() };
  } finally {
    if (tab && tab.id) {
      try { await chrome.tabs.remove(tab.id); } catch (_) {}
    }
    state.batch.tempTabId = null;
  }
}

function updateBatchControls() {
  const running = state.batch.running;
  const hasExportSelection = elements["batch-export-findings"].checked || elements["batch-export-metadata"].checked || elements["batch-export-stats"].checked || elements["batch-export-links"].checked;
  elements["batch-start-button"].disabled = running;
  elements["batch-pause-button"].hidden = !running;
  elements["batch-cancel-button"].hidden = !running;
  elements["batch-pause-button"].textContent = state.batch.paused ? "Resume" : "Pause";
  elements["batch-csv-button"].disabled = !state.batch.records.length || !hasExportSelection;
  elements["batch-include-reviewed"].disabled = !elements["batch-export-findings"].checked;
}

function renderBatchProgress() {
  const batch = state.batch;
  const done = batch.records.length;
  elements["batch-progress-panel"].hidden = !batch.running && !done;
  elements["batch-progress"].max = Math.max(1, batch.urls.length);
  elements["batch-progress"].value = done;
  elements["batch-progress-count"].textContent = `${done} of ${batch.urls.length}`;
  if (batch.running) {
    const current = batch.urls[batch.currentIndex] || "";
    elements["batch-progress-label"].textContent = batch.paused ? "Batch scan paused" : `Checking ${hostnameFor(current) || current}`;
  } else if (batch.cancelled) elements["batch-progress-label"].textContent = "Batch scan cancelled";
  else if (done) elements["batch-progress-label"].textContent = "Batch scan complete";

  const resultByUrl = new Map(batch.records.map(record => [record.submittedUrl, record]));
  elements["batch-results"].innerHTML = batch.urls.map((url, index) => {
    const record = resultByUrl.get(url);
    if (!record) return `<div class="batch-row pending"><span class="batch-status-icon">${index + 1}</span><div><strong>${escapeHtml(url)}</strong><small>Waiting</small></div><span class="batch-total"></span></div>`;
    if (record.status === "error") return `<div class="batch-row error"><span class="batch-status-icon">!</span><div><strong>${escapeHtml(url)}</strong><small>${escapeHtml(record.error)}</small></div><span class="batch-total">Failed</span></div>`;
    const counts = reportCounts(record.report);
    return `<div class="batch-row"><span class="batch-status-icon">✓</span><div><strong>${escapeHtml(record.report.page.title)}</strong><small>${escapeHtml(record.report.page.url)}</small></div><span class="batch-total">${counts.fix + counts.check + counts.review} open</span></div>`;
  }).join("");
  updateBatchControls();
}

async function startBatchScan() {
  const parsed = renderBatchValidation();
  elements["batch-error"].hidden = true;
  if (!parsed.valid.length) {
    elements["batch-error-message"].textContent = "Add at least one valid HTTP or HTTPS URL.";
    elements["batch-error"].hidden = false;
    return;
  }
  try {
    await requestBatchPermissions(parsed.valid);
  } catch (error) {
    elements["batch-error-message"].textContent = readableScanError(error);
    elements["batch-error"].hidden = false;
    return;
  }

  state.batch = {
    running: true,
    paused: false,
    cancelled: false,
    urls: parsed.valid,
    records: [],
    currentIndex: -1,
    tempTabId: null
  };
  updateBatchControls();
  renderBatchProgress();
  const settings = { scope: elements["batch-scope"].value, canControlColour: elements["batch-colour-control"].checked };

  for (let index = 0; index < state.batch.urls.length; index += 1) {
    if (state.batch.cancelled) break;
    await waitForResume();
    if (state.batch.cancelled) break;
    state.batch.currentIndex = index;
    renderBatchProgress();
    const record = await scanBatchUrl(state.batch.urls[index], settings);
    state.batch.records.push(record);
    await saveKey(STORAGE_KEYS.batch, { urls: state.batch.urls, records: state.batch.records, savedAt: new Date().toISOString() }).catch(() => {});
    renderBatchProgress();
  }
  state.batch.running = false;
  renderBatchProgress();
}

function toggleBatchPause() {
  state.batch.paused = !state.batch.paused;
  updateBatchControls();
  renderBatchProgress();
}

async function cancelBatch() {
  state.batch.cancelled = true;
  state.batch.paused = false;
  if (state.batch.tempTabId) {
    try { await chrome.tabs.remove(state.batch.tempTabId); } catch (_) {}
  }
  updateBatchControls();
}

function downloadBatchCsv() {
  const includeReviewed = elements["batch-include-reviewed"].checked;
  const includeFindings = elements["batch-export-findings"].checked;
  const includeMetadata = elements["batch-export-metadata"].checked;
  const includeStats = elements["batch-export-stats"].checked;
  const includeLinks = elements["batch-export-links"].checked;
  if (!includeFindings && !includeMetadata && !includeStats && !includeLinks) {
    showToast("Choose at least one workbook sheet.");
    return;
  }
  const complete = state.batch.records.filter(record => record.status === "complete");
  const action = complete.flatMap((record, index) => actionRows(record.report, includeReviewed, record.submittedUrl, index + 1));
  const metadata = complete.map(record => metadataRow(record.report, record.submittedUrl));
  const inventory = complete.map(record => pageInventoryRow(record.report, record.submittedUrl));
  const links = complete.flatMap(record => linkRows(record.report));
  const siteGroups = new Map();
  complete.forEach(record => groupedFindingsForExport(record.report, includeReviewed).forEach(group => {
    const key = `${group.status}|${group.finding.ruleId}`;
    if (!siteGroups.has(key)) siteGroups.set(key, { group, pages: new Set(), occurrences: 0 });
    const item = siteGroups.get(key);
    item.pages.add(record.report.page.url);
    item.occurrences += group.occurrenceCount;
  }));
  const siteWideHeader = ["Issue", "Category", "Review level", "Status", "Affected pages", "Occurrences", "Page URLs", "Recommended action"];
  const siteWide = Array.from(siteGroups.values()).sort((first, second) => second.pages.size - first.pages.size || second.occurrences - first.occurrences).map(item => [
    item.group.finding.title, item.group.finding.category, item.group.finding.severity, item.group.status, item.pages.size,
    item.occurrences, Array.from(item.pages).join(" | "), item.group.finding.suggestion
  ]);
  const logHeader = ["Submitted URL", "Result", "Page title", "Final URL", "Scanned at", "Message"];
  const logRows = state.batch.records.map(record => record.status === "complete"
    ? [record.submittedUrl, "Complete", record.report.page.title, record.report.page.url, record.report.scannedAt, ""]
    : [record.submittedUrl, "Failed", "", "", record.scannedAt || "", record.error || "Unknown error"]);
  const sheets = [
    includeFindings ? { name: "Action report", rows: [ACTION_HEADER, ...action] } : null,
    includeFindings && complete.length > 1 ? { name: "Site-wide issues", rows: [siteWideHeader, ...siteWide] } : null,
    includeStats ? { name: "Page inventory", rows: [BATCH_STATS_HEADER, ...inventory] } : null,
    includeMetadata ? { name: "Metadata", rows: [BATCH_METADATA_HEADER, ...metadata] } : null,
    includeLinks ? { name: "Links", rows: [LINK_EXPORT_HEADER, ...links] } : null,
    { name: "Scan log", rows: [logHeader, ...logRows] }
  ].filter(Boolean);
  downloadWorkbook(sheets, `bc-web-style-batch-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function switchView(name) {
  state.currentView = name;
  const modeTabs = document.querySelector(".mode-tabs");
  if (modeTabs) modeTabs.hidden = name === "feedback";
  document.querySelectorAll(".mode-tab").forEach(button => {
    const selected = button.dataset.view === name;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll(".app-view").forEach(view => { view.hidden = view.id !== `${name}-view`; });
  if (name === "terms") renderTerms();
  if (name === "feedback") renderFeedback();
  elements["feedback-header-button"].hidden = name === "feedback";
}

function handleTablistKeys(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = Array.from(event.currentTarget.querySelectorAll('[role="tab"]'));
  const current = tabs.indexOf(document.activeElement);
  if (current < 0 || !tabs.length) return;
  event.preventDefault();
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? tabs.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[nextIndex].focus();
  tabs[nextIndex].click();
}

function handleFindingAction(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const finding = findingFromButton(button);
  if (button.classList.contains("undo-decision")) undoDecision(button.dataset.fingerprint || (button.closest("[data-fingerprint]") || {}).dataset?.fingerprint);
  else if (button.classList.contains("locate-button")) locateFinding(button.dataset.selector);
  else if (button.classList.contains("decision-button")) setDecision(finding, button.dataset.status);
  else if (button.classList.contains("reopen-button")) setDecision(finding, "open");
  else if (button.classList.contains("manage-term-button")) openWorkspace("terms");
  else if (button.classList.contains("exception-button")) openExceptionDialog(finding);
  else if (button.classList.contains("note-button")) openNoteDialog(finding);
  else if (button.classList.contains("finding-feedback-action")) openFeedbackDialog(finding, feedbackNotesForFinding(finding)[0] || null);
}

async function openWorkspace(view = "current") {
  if (!workspaceSurface) {
    const tab = await currentTab().catch(() => null);
    if (tab && tab.id && isScannableUrl(tab.url || "")) {
      state.lastReviewTabId = tab.id;
      state.lastReviewPageKey = state.activeReport ? state.activePageKey : reportKey(tab.url || "");
      await saveNavigation().catch(() => {});
    }
  }
  const destination = chrome.runtime.getURL(`sidepanel.html?workspace=1&view=${encodeURIComponent(view)}`);
  await chrome.tabs.create({ url: destination, active: true }).catch(() => showToast("The larger workspace could not be opened."));
}

function bindEvents() {
  document.querySelectorAll(".mode-tab").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
  document.querySelectorAll('[role="tablist"]').forEach(tablist => tablist.addEventListener("keydown", handleTablistKeys));
  document.querySelectorAll("input[name='scope']").forEach(input => input.addEventListener("change", handleSettingsChange));
  elements["cms-whole-scan"].addEventListener("change", handleSettingsChange);
  elements["colour-control"].addEventListener("change", handleSettingsChange);
  elements["choose-section-button"].addEventListener("click", openSectionDialog);
  elements["clear-section-button"].addEventListener("click", clearSelectedSection);
  elements["scan-button"].addEventListener("click", scanCurrentPage);
  elements["scan-permission-button"].addEventListener("click", openPermissionDialog);
  elements["rescan-button"].addEventListener("click", () => { elements["more-dialog"].close(); scanCurrentPage(); });
  elements["change-scan-button"].addEventListener("click", () => { elements["more-dialog"].close(); showScanSettings(); });
  elements["cancel-settings-button"].addEventListener("click", hideScanSettings);

  elements["more-menu-button"].addEventListener("click", () => {
    elements["rescan-button"].hidden = !state.activeReport;
    elements["change-scan-button"].hidden = !state.activeReport;
    elements["more-dialog"].showModal();
  });
  elements["more-close"].addEventListener("click", () => elements["more-dialog"].close());
  elements["feedback-header-button"].addEventListener("click", openFeedbackView);
  elements["feedback-back-button"].addEventListener("click", closeFeedbackView);
  elements["open-feedback-button"].addEventListener("click", () => { elements["more-dialog"].close(); openFeedbackView(); });
  elements["open-workspace-button"].addEventListener("click", () => { elements["more-dialog"].close(); openWorkspace("current"); });
  elements["open-batch-button"].addEventListener("click", () => { elements["more-dialog"].close(); workspaceSurface ? switchView("batch") : openWorkspace("batch"); });
  elements["open-settings-button"].addEventListener("click", () => { elements["more-dialog"].close(); workspaceSurface ? switchView("terms") : openWorkspace("terms"); });

  elements["csv-button"].addEventListener("click", () => elements["export-dialog"].showModal());
  elements["export-close"].addEventListener("click", () => elements["export-dialog"].close());
  elements["copy-button"].addEventListener("click", copyCurrentReport);

  elements["open-filter-button"].addEventListener("click", () => elements["filter-panel"].showModal());
  elements["filter-close"].addEventListener("click", () => elements["filter-panel"].close());
  elements["filter-panel"].querySelector("form").addEventListener("submit", () => renderFindings());
  elements["status-filter"].addEventListener("change", renderFindings);
  elements["category-filter"].addEventListener("change", renderFindings);
  elements["sort-order"].addEventListener("change", () => {
    renderReviewView();
    persistReviewContext(state.activePageKey).catch(() => {});
  });
  elements["important-filter"].addEventListener("change", renderFindings);
  elements["clear-filters"].addEventListener("click", clearFilters);
  elements["active-filters"].addEventListener("click", event => {
    const button = event.target.closest("[data-clear-filter]");
    if (!button) return;
    const key = button.dataset.clearFilter;
    if (key === "status") elements["status-filter"].value = "open";
    if (key === "severity") elements["severity-filter"].value = "all";
    if (key === "category") elements["category-filter"].value = "all";
    if (key === "important") elements["important-filter"].checked = false;
    renderFindings();
  });
  elements.counts.addEventListener("click", event => {
    const button = event.target.closest("[data-severity]");
    if (!button) return;
    const requested = button.dataset.severity;
    elements["severity-filter"].value = requested === "all" || elements["severity-filter"].value === requested ? "all" : requested;
    state.reviewView = "review";
    state.reviewMode = "list";
    renderReviewView();
  });

  document.querySelectorAll(".review-tab").forEach(button => button.addEventListener("click", () => switchReviewView(button.dataset.reviewView)));
  elements["review-issues-button"].addEventListener("click", () => {
    const ruleId = elements["review-issues-button"].dataset.ruleId;
    if (ruleId) openRuleGroup(ruleId);
  });
  elements["view-reviewed-button"].addEventListener("click", () => {
    elements["status-filter"].value = "reviewed";
    elements["severity-filter"].value = "all";
    state.reviewView = "review";
    state.reviewMode = "list";
    renderReviewView();
  });
  elements.findings.addEventListener("click", event => {
    const row = event.target.closest(".issue-row[data-rule-id]");
    if (row) openRuleGroup(row.dataset.ruleId);
  });
  elements["review-back-button"].addEventListener("click", closeFindingReview);
  elements["guided-finding"].addEventListener("click", handleFindingAction);
  elements["guided-previous"].addEventListener("click", () => moveGuided(-1));
  elements["guided-next"].addEventListener("click", () => moveGuided(1));
  elements["next-issue-type"].addEventListener("click", () => jumpIssueType(1));
  elements["previous-issue-type"].addEventListener("click", () => jumpIssueType(-1));
  elements["follow-page"].addEventListener("change", () => {
    if (elements["follow-page"].checked && state.reviewMode === "detail") {
      const finding = guidedFindings()[state.guidedIndex];
      if (finding && finding.selector) highlightSelector(finding.selector, true, false);
    }
    persistReviewContext(state.activePageKey).catch(() => {});
  });

  const handlePageAuditClick = event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.detailSection) { renderPageDetails(button.dataset.detailSection); persistReviewContext(state.activePageKey).catch(() => {}); }
    else if (button.dataset.overlay) runPageOverlay(button.dataset.overlay);
    else if (button.classList.contains("link-check-button")) checkHttpLinks(false);
    else if (button.classList.contains("link-check-pause")) toggleLinkCheckPause();
    else if (button.classList.contains("link-check-stop")) stopLinkCheck();
    else if (button.classList.contains("manage-permissions-button")) openPermissionDialog();
    else if (button.classList.contains("detail-jump")) locateFinding(button.dataset.selector);
    else if (button.classList.contains("open-background-link")) {
      persistReviewContext(state.activePageKey).catch(() => {});
      chrome.tabs.create({ url: button.dataset.url, active: false }).then(() => showToast("Destination opened in the background.")).catch(() => showToast("The destination could not be opened."));
    }
  };
  elements["page-details"].addEventListener("click", handlePageAuditClick);

  elements["exception-form"].addEventListener("submit", saveException);
  elements["exception-cancel"].addEventListener("click", () => elements["exception-dialog"].close());
  elements["section-cancel"].addEventListener("click", () => elements["section-dialog"].close());
  elements["permission-close"].addEventListener("click", () => elements["permission-dialog"].close());
  elements["permission-linked"].addEventListener("click", requestLinkedPermissions);
  elements["permission-all"].addEventListener("click", requestAllPermissions);
  elements["permission-revoke"].addEventListener("click", revokeAllPermissions);
  elements["settings-permission-button"].addEventListener("click", openPermissionDialog);
  elements["return-review-button"].addEventListener("click", returnToReview);
  elements["note-form"].addEventListener("submit", saveAuditNote);
  elements["note-cancel"].addEventListener("click", () => elements["note-dialog"].close());
  elements["add-feedback-button"].addEventListener("click", () => openFeedbackDialog());
  elements["feedback-form"].addEventListener("submit", saveFeedbackNote);
  elements["feedback-dialog-close"].addEventListener("click", closeFeedbackDialog);
  elements["feedback-cancel"].addEventListener("click", closeFeedbackDialog);
  elements["copy-feedback-report"].addEventListener("click", copyFeedbackReport);
  elements["export-feedback-csv"].addEventListener("click", exportFeedbackCsv);
  elements["create-feedback-email"].addEventListener("click", createFeedbackEmail);
  elements["feedback-email-close"].addEventListener("click", () => elements["feedback-email-dialog"].close());
  elements["keep-prepared-feedback"].addEventListener("click", () => elements["feedback-email-dialog"].close());
  elements["archive-prepared-feedback"].addEventListener("click", archivePreparedFeedback);
  const handleFeedbackListClick = event => {
    const card = event.target.closest("[data-feedback-id]");
    if (!card) return;
    const id = card.dataset.feedbackId;
    const note = state.feedbackNotes.find(item => item.id === id);
    if (event.target.closest(".edit-feedback") && note) openFeedbackDialog(null, note);
    else if (event.target.closest(".restore-feedback")) restoreFeedbackNote(id);
    else if (event.target.closest(".delete-feedback")) deleteFeedbackNote(id);
  };
  elements["feedback-list"].addEventListener("click", handleFeedbackListClick);
  elements["archived-feedback-list"].addEventListener("click", handleFeedbackListClick);
  elements["section-list"].addEventListener("click", event => {
    const button = event.target.closest(".section-choice");
    if (button) chooseSection(Number(button.dataset.index));
  });
  elements["personal-terms"].addEventListener("click", event => {
    const button = event.target.closest(".remove-term");
    if (button) removeException(button.dataset.id);
  });

  elements["batch-urls"].addEventListener("input", renderBatchValidation);
  elements["batch-start-button"].addEventListener("click", startBatchScan);
  elements["batch-pause-button"].addEventListener("click", toggleBatchPause);
  elements["batch-cancel-button"].addEventListener("click", cancelBatch);
  elements["batch-csv-button"].addEventListener("click", downloadBatchCsv);
  ["batch-export-findings", "batch-export-metadata", "batch-export-stats", "batch-export-links"].forEach(id => elements[id].addEventListener("change", updateBatchControls));
  elements["download-current-workbook"].addEventListener("click", downloadCurrentWorkbook);
  elements["download-current-action-csv"].addEventListener("click", () => {
    if (!state.activeReport) return;
    downloadCsvRows(actionRows(state.activeReport, elements["current-export-reviewed"].checked), `bc-web-style-action-report-${new Date().toISOString().slice(0, 10)}.csv`, ACTION_HEADER);
  });
  document.addEventListener("keydown", event => {
    if (state.reviewMode !== "detail" || event.defaultPrevented || /INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement && document.activeElement.tagName)) return;
    if (event.key.toLowerCase() === "n") { event.preventDefault(); event.shiftKey ? jumpIssueType(1) : moveGuided(1); }
    if (event.key.toLowerCase() === "p") { event.preventDefault(); moveGuided(-1); }
  });

  let scrollTimer;
  document.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => persistReviewContext(state.activePageKey).catch(() => {}), 250);
  }, { passive: true });

  if (!workspaceSurface) chrome.tabs.onActivated.addListener(() => { if (!state.batch.running) clearPageOverlays().finally(syncActiveTab); });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!workspaceSurface && state.activeTab && tabId === state.activeTab.id && changeInfo.status === "complete" && !state.batch.running) clearPageOverlays().finally(syncActiveTab);
  });
}

async function init() {
  cacheElements();
  document.body.dataset.surface = workspaceSurface ? "workspace" : "panel";
  if (workspaceSurface) {
    elements["open-workspace-button"].hidden = true;
    elements["follow-page-control"].hidden = true;
    elements["workspace-review-note"].hidden = false;
  }
  bindEvents();
  await loadState();
  renderFeedback();
  renderTerms();
  if (state.batch.records.length) renderBatchProgress();
  renderBatchValidation();
  await syncActiveTab();
  const requestedView = surfaceParams.get("view");
  if (workspaceSurface && ["current", "batch", "terms"].includes(requestedView)) switchView(requestedView);
}

init().catch(error => {
  if (elements["current-error-message"]) showCurrentState("error", readableScanError(error));
});
