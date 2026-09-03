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
  navigation: "reviewNavigationV1",
  optionalChecks: "optionalReviewChecksV1"
};

const MAX_REPORTS = 20;
const SINGLE_PAGE_REPORT_RETENTION_MS = 168 * 60 * 60 * 1000;
const INCOMPLETE_BATCH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const COMPLETE_BATCH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const ARCHIVED_FEEDBACK_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
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
// Keep a healthy buffer below Outlook/Windows URL hand-off limits. The full
// encoded mailto URI (not the unencoded report text) is measured against this.
const MAILTO_SAFE_URI_LIMIT = 7000;
const surfaceParams = new URLSearchParams(location.search);
const workspaceSurface = surfaceParams.get("workspace") === "1";

function initialBatchState() {
  return {
    running: false,
    paused: false,
    cancelled: false,
    phase: "idle",
    urls: [],
    records: [],
    currentIndex: -1,
    tempTabId: null,
    checkLinks: false,
    linkPermissionMode: "found",
    linkCheckTotal: 0,
    linkCheckCompleted: 0,
    settings: { scope: "content", canControlColour: true, optionalChecks: { nonBreakingSpace: true, passiveVoice: true } },
    exportPreset: "full",
    customSheets: [],
    includeReviewed: false,
    downloaded: false,
    downloadFilename: "",
    downloadedAt: ""
  };
}

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
  optionalChecks: { nonBreakingSpace: true, passiveVoice: true },
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
  skippedRuleIds: new Set(),
  skippedFingerprints: new Set(),
  lastReviewTabId: null,
  lastReviewPageKey: "",
  batch: initialBatchState(),
  pendingExceptionFinding: null,
  pendingNoteFinding: null,
  pendingFeedbackId: "",
  pendingFeedbackContext: null,
  preparedFeedbackIds: [],
  feedbackCopyMode: "",
  feedbackPreviousView: "current",
  feedbackPreviousScroll: 0,
  feedbackReturnFocus: null,
  pendingFeedbackPageChange: false
};

const elements = {};

let previewLifecycleState = null;
let previewNoticeDismissed = false;

function previewLifecycleApi() {
  return globalThis.BCWebStyleGuidePreviewLifecycle || null;
}

function previewLifecycleBlocksUse() {
  return Boolean(previewLifecycleState && previewLifecycleState.blocksUse);
}

function lifecycleDisplayContent(result) {
  const installed = result && result.installedVersion
    ? result.installedVersion
    : chrome.runtime.getManifest().version;
  const latest = result && result.latestVersion ? result.latestVersion : installed;
  const customMessage = result && result.message ? result.message : "";

  const content = {
    current: {
      title: "Preview is current",
      message: "",
      warning: false
    },
    "update-available": {
      title: `New preview available: v${latest}`,
      message: customMessage || `You’re using v${installed}. You can continue testing this version.`,
      warning: false
    },
    "update-recommended": {
      title: "Please update the preview",
      message: customMessage || `You’re using v${installed}. Several changes have been made since this version was released.`,
      warning: true
    },
    "update-required": {
      title: "This preview is no longer supported",
      message: customMessage || `Significant changes have been made since v${installed}. Get the latest preview to continue testing.`,
      warning: false
    },
    "version-blocked": {
      title: "This preview version has been retired",
      message: customMessage || `Version ${installed} should no longer be used for testing. Get the latest preview to continue.`,
      warning: false
    },
    "pilot-ended": {
      title: "This preview has ended",
      message: customMessage || "This testing preview is no longer active.",
      warning: false
    },
    "build-expired": {
      title: "This preview has expired",
      message: customMessage || `This preview build expired on ${result && result.builtInExpiry ? result.builtInExpiry : "its configured expiry date"}. Get a current preview before continuing.`,
      warning: false
    }
  };

  return content[result && result.kind] || content.current;
}

function setLifecycleBlockedButton(button, blocked) {
  if (!button) return;
  if (blocked) {
    button.dataset.previewLifecycleBlocked = "true";
    button.disabled = true;
  } else if (button.dataset.previewLifecycleBlocked === "true") {
    delete button.dataset.previewLifecycleBlocked;
    button.disabled = false;
  }
}

function renderPreviewLifecycle(result) {
  previewLifecycleState = result;
  const banner = elements["preview-lifecycle-banner"];
  if (!banner) return;

  const content = lifecycleDisplayContent(result);
  const blocked = Boolean(result && result.blocksUse);
  const current = !result || result.kind === "current";

  [
    "scan-button",
    "batch-start-button",
    "check-links-and-download-current",
    "batch-link-access-button"
  ].forEach(id => setLifecycleBlockedButton(elements[id], blocked));

  if (current || (previewNoticeDismissed && !blocked)) {
    banner.hidden = true;
    return;
  }

  banner.hidden = false;
  banner.classList.toggle("warning", Boolean(content.warning));
  banner.classList.toggle("blocked", blocked);
  banner.setAttribute("role", blocked ? "alert" : "status");
  banner.setAttribute("aria-live", blocked ? "assertive" : "polite");

  elements["preview-lifecycle-title"].textContent = content.title;
  elements["preview-lifecycle-message"].textContent = content.message;

  const installed = result.installedVersion || chrome.runtime.getManifest().version;
  const latest = result.latestVersion || installed;
  elements["preview-lifecycle-version"].textContent =
    latest && latest !== installed
      ? `Preview v${installed} · Latest v${latest}`
      : `Preview v${installed}`;

  const downloadLink = elements["preview-download-link"];
  downloadLink.hidden = !result.downloadUrl;
  if (result.downloadUrl) downloadLink.href = result.downloadUrl;

  elements["preview-continue-button"].hidden = result.kind !== "update-recommended";
  elements["preview-check-again-button"].hidden = !blocked;
}

async function refreshPreviewLifecycle({ forceRemote = false, focusIfBlocked = false } = {}) {
  const api = previewLifecycleApi();
  if (!api) return { kind: "current", blocksUse: false };

  const previousKind = previewLifecycleState && previewLifecycleState.kind;
  const result = await api.check({ forceRemote });
  if (result.kind !== previousKind) previewNoticeDismissed = false;
  renderPreviewLifecycle(result);

  if (focusIfBlocked && result.blocksUse && elements["preview-lifecycle-banner"]) {
    elements["preview-lifecycle-banner"].hidden = false;
    elements["preview-lifecycle-banner"].scrollIntoView({ behavior: "smooth", block: "start" });
    elements["preview-lifecycle-banner"].focus({ preventScroll: true });
  }

  return result;
}

async function ensurePreviewCanRun() {
  const result = await refreshPreviewLifecycle({
    forceRemote: false,
    focusIfBlocked: true
  });
  if (!result.blocksUse) return true;
  showToast("Get the latest preview to continue.");
  return false;
}

function $(id) { return document.getElementById(id); }

function cacheElements() {
  [
    "active-page-label", "return-review-button", "feedback-header-button", "feedback-header-count", "profile-badge", "colour-control-row", "colour-control", "scope-note", "scan-button", "scan-permission-button", "cache-note",
    "preview-lifecycle-banner", "preview-lifecycle-title", "preview-lifecycle-message", "preview-lifecycle-version", "preview-download-link", "preview-continue-button", "preview-check-again-button",
    "scan-settings", "cancel-settings-button", "scan-context-title", "scan-context-details", "stale-report-banner", "stale-report-title", "stale-report-message", "stale-rescan-button",
    "cms-lite-settings", "cms-whole-scan", "standard-scope-settings", "choose-section-button", "clear-section-button", "section-scope-label",
    "current-loading", "current-error", "current-error-message", "current-results", "csv-button",
    "counts", "rescan-button", "status-filter", "severity-filter", "category-filter", "sort-order", "important-filter", "showing-count",
    "filter-panel", "filter-count", "active-filters", "clear-filters", "open-filter-button", "filter-close",
    "list-controls", "list-review-panel", "guided-review-panel", "page-details-panel", "findings", "manual-checks",
    "findings-tab-count", "review-issues-button", "review-skip-summary", "review-skip-message", "restore-skipped-rules", "finding-coverage", "view-reviewed-button", "reviewed-count", "link-check-shortcut", "link-check-shortcut-status", "review-back-button",
    "guided-progress", "guided-finding", "guided-previous", "guided-next", "workspace-review-note", "page-details", "manual-review",
    "previous-issue-type", "next-issue-type", "current-issue-type",
    "current-export-preset", "current-export-preset-description", "current-export-custom", "current-export-reviewed", "current-export-status", "current-export-confirmation",
    "current-custom-summary", "current-custom-issues", "current-custom-findings", "current-custom-page-details", "current-custom-links", "current-custom-metadata",
    "check-links-and-download-current", "download-current-workbook", "download-current-action-csv", "copy-detailed-findings",
    "batch-csv-button", "batch-urls", "batch-validation", "batch-scope", "batch-colour-control", "batch-check-links", "batch-link-access-note", "batch-include-reviewed", "batch-export-preset", "batch-export-description", "batch-export-custom",
    "batch-custom-summary", "batch-custom-pages", "batch-custom-site-wide", "batch-custom-issues-page", "batch-custom-findings", "batch-custom-links", "batch-custom-metadata", "batch-custom-scan-log",
    "batch-start-button", "batch-pause-button", "batch-cancel-button", "batch-progress-panel", "batch-progress-label",
    "batch-progress-count", "batch-progress", "batch-link-finish-actions", "batch-link-access-button", "batch-finish-without-links", "batch-download-status", "batch-error", "batch-error-message", "batch-results",
    "personal-term-count", "personal-terms", "built-in-terms-list", "optional-non-breaking-space", "optional-passive-voice", "optional-checks-status", "exception-dialog", "exception-form",
    "exception-dialog-heading", "exception-dialog-intro", "exception-rule-name", "exception-phrase", "exception-validation", "exception-cancel", "exception-page-scope", "exception-site-scope", "exception-all-scope", "exception-guardrail", "exception-submit", "section-dialog", "section-list", "section-cancel",
    "permission-dialog", "permission-close", "permission-linked", "permission-revoke", "permission-status", "settings-permission-button",
    "page-review-data-count", "batch-data-count", "unsent-feedback-data-count", "sent-feedback-data-count", "allowed-terms-data-count", "page-preferences-data-count", "data-management-status",
    "clear-page-reviews", "clear-batch-data", "clear-unsent-feedback", "clear-sent-feedback", "clear-allowed-terms", "clear-page-preferences",
    "note-dialog", "note-form", "note-finding-name", "note-important", "note-text", "note-cancel", "toast",
    "feedback-view", "feedback-back-button", "feedback-ready-count", "add-feedback-button", "feedback-empty", "feedback-list", "feedback-send-panel", "feedback-send-status",
    "create-feedback-email", "copy-feedback-report", "export-feedback-csv", "archived-feedback", "archived-feedback-count", "archived-feedback-list",
    "feedback-dialog", "feedback-form", "feedback-dialog-heading", "feedback-dialog-close", "feedback-type", "feedback-text", "feedback-important",
    "feedback-context-section", "feedback-include-context", "feedback-context-preview", "feedback-cancel", "feedback-email-dialog", "feedback-email-message", "feedback-email-close",
    "archive-prepared-feedback", "keep-prepared-feedback", "feedback-copy-dialog", "feedback-copy-close", "feedback-copy-options", "feedback-copy-selection",
    "feedback-copy-list", "feedback-copy-count", "feedback-copy-selected", "feedback-select-all", "feedback-select-unsent", "feedback-select-sent", "feedback-select-none",
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

function spreadsheetSafeText(value) {
  const text = String(value === undefined || value === null ? "" : value);
  return /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  return `"${spreadsheetSafeText(value).replace(/"/g, '""')}"`;
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
  return `${url.protocol}//${url.host}/*`;
}

const TRUSTED_SESSION_HOSTS = new Set([
  "intranet.gov.bc.ca",
  "intranet.qa.gov.bc.ca",
  "bcgov.sharepoint.com"
]);

const TRUSTED_SESSION_SUFFIXES = [
  ".gww.gov.bc.ca"
];

const AUTH_REDIRECT_HOSTS = new Set([
  "logon7.gov.bc.ca",
  "login.microsoftonline.com"
]);

const AUTH_REDIRECT_PATH = /(?:^|\/)(?:login|logon|sign-in|signin)(?:\/|$)/i;

const AUTHENTICATED_ACTION_SEGMENTS = new Set([
  "approve", "delete", "logout", "publish", "reject", "remove", "signout", "submit", "unsubscribe"
]);

function parsedIpv4(hostname) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return null;
  const parts = hostname.split(".").map(Number);
  return parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

function blockedIpv4(parts) {
  if (!parts) return false;
  const [first, second, third] = parts;
  return first === 0 || first === 10 || first === 127 || first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 0 && [0, 2].includes(third)) ||
    (first === 198 && [18, 19].includes(second)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113);
}

function ipv6Words(hostname) {
  let value = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (!value.includes(":")) return null;
  const dotted = value.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const ipv4 = parsedIpv4(dotted[1]);
    if (!ipv4) return null;
    value = value.slice(0, -dotted[1].length) + `${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }
  if ((value.match(/::/g) || []).length > 1) return null;
  const halves = value.split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length > 1 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const missing = 8 - left.length - right.length;
  if (missing < (halves.length > 1 ? 1 : 0)) return null;
  const words = [...left, ...Array(missing).fill("0"), ...right];
  if (words.length !== 8 || words.some(word => !/^[0-9a-f]{1,4}$/.test(word))) return null;
  return words.map(word => parseInt(word, 16));
}

function blockedIpv6(words) {
  if (!words) return false;
  const allZero = words.every(word => word === 0);
  const loopback = words.slice(0, 7).every(word => word === 0) && words[7] === 1;
  const uniqueLocal = (words[0] & 0xfe00) === 0xfc00;
  const linkLocal = (words[0] & 0xffc0) === 0xfe80;
  const multicast = (words[0] & 0xff00) === 0xff00;
  const documentation = words[0] === 0x2001 && words[1] === 0x0db8;
  const mappedIpv4 = words.slice(0, 5).every(word => word === 0) && words[5] === 0xffff
    ? [words[6] >> 8, words[6] & 0xff, words[7] >> 8, words[7] & 0xff]
    : null;
  return allZero || loopback || uniqueLocal || linkLocal || multicast || documentation || blockedIpv4(mappedIpv4);
}

function remoteDestinationSafety(value) {
  let url;
  try { url = new URL(value); } catch (_) { return { allowed: false, reason: "The destination address is invalid." }; }
  if (!/^https?:$/.test(url.protocol)) return { allowed: false, reason: "Only HTTP and HTTPS destinations can be checked." };
  if (url.username || url.password) return { allowed: false, reason: "The link contains embedded sign-in information and was not requested." };
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  const localName = hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".home.arpa") || !hostname.includes(".");
  if (localName || blockedIpv4(parsedIpv4(hostname)) || blockedIpv6(ipv6Words(hostname))) {
    return { allowed: false, reason: "The destination is local, private or reserved and was not requested." };
  }
  return { allowed: true, reason: "" };
}

function authenticatedActionUrl(value) {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").map(segment => decodeURIComponent(segment).toLowerCase()).filter(Boolean);
    if (segments.some(segment => AUTHENTICATED_ACTION_SEGMENTS.has(segment))) return true;
    return Array.from(url.searchParams.entries()).some(([key, entryValue]) =>
      ["action", "command", "do", "operation"].includes(key.toLowerCase()) && AUTHENTICATED_ACTION_SEGMENTS.has(entryValue.toLowerCase())
    );
  } catch (_) { return false; }
}

const LINK_RESULT_LABELS = {
  broken: "Broken",
  server: "Server error",
  "client-error": "HTTP error",
  "live-not-found": "Live version not found",
  "qa-only": "Available in QA · not found live",
  "live-only": "Available live · not found in QA",
  "cms-only": "Available in CMS Lite only",
  "cms-publishing-unverified": "Available in CMS Lite · publication not verified",
  "qa-live-unverified": "Available in QA · live not verified",
  "session-unverified": "Could not verify automatically",
  "rate-limited": "Rate limited",
  restricted: "Restricted",
  redirect: "Redirect could not be verified",
  "sign-in": "Redirected to sign-in",
  unavailable: "Could not verify",
  "safety-blocked": "Not checked for safety",
  permission: "Website access needed",
  "qa-live-ok": "Available in QA and live",
  "session-ok": "Working",
  "live-ok": "Live version working",
  ok: "Working"
};

const LINK_RESULT_GROUPS = [
  {
    key: "problems",
    label: "Problems",
    description: "Links that are broken or returned an error.",
    buckets: [
      { label: "Broken", statuses: ["broken"] },
      { label: "Server error", statuses: ["server"] },
      { label: "HTTP error", statuses: ["client-error"] }
    ]
  },
  {
    key: "review",
    label: "Needs review",
    description: "Links that could not be fully checked.",
    buckets: [
      { label: "Live version not found", statuses: ["live-not-found"] },
      { label: "Available in QA · not found live", statuses: ["qa-only"] },
      { label: "Available live · not found in QA", statuses: ["live-only"] },
      { label: "Available in CMS Lite only", statuses: ["cms-only"] },
      { label: "Available in CMS Lite · publication not verified", statuses: ["cms-publishing-unverified"] },
      { label: "Available in QA · live not verified", statuses: ["qa-live-unverified"] },
      { label: "Could not verify automatically", statuses: ["session-unverified", "unavailable"] },
      { label: "Not checked for safety", statuses: ["safety-blocked"] },
      { label: "Rate limited", statuses: ["rate-limited"] },
      { label: "Restricted", statuses: ["restricted"] },
      { label: "Redirect could not be verified", statuses: ["redirect"] },
      { label: "Redirected to sign-in", statuses: ["sign-in"] },
      { label: "Website access needed", statuses: ["permission"] }
    ]
  },
  {
    key: "working",
    label: "Working",
    description: "Links the checker successfully verified.",
    buckets: [
      { label: "Available in QA and live", statuses: ["qa-live-ok"] },
      { label: "Live version working", statuses: ["live-ok"] },
      { label: "Working", statuses: ["session-ok", "ok"] }
    ]
  }
];

function linkResultCategoryCounts(results) {
  const items = Array.isArray(results) ? results : [];
  return Object.fromEntries(LINK_RESULT_GROUPS.map(group => {
    const statuses = group.buckets.flatMap(bucket => bucket.statuses);
    return [group.key, items.filter(result => statuses.includes(result.status)).length];
  }));
}

function trustedSessionHost(value) {
  const host = hostnameFor(value);
  return TRUSTED_SESSION_HOSTS.has(host) || TRUSTED_SESSION_SUFFIXES.some(suffix => host.endsWith(suffix));
}

function authenticationRedirectHost(value) {
  return AUTH_REDIRECT_HOSTS.has(hostnameFor(value));
}

function looksLikeAuthenticationRedirect(startingUrl, destinationUrl) {
  if (authenticationRedirectHost(destinationUrl)) return true;
  try {
    const starting = new URL(startingUrl);
    const destination = new URL(destinationUrl);
    if (starting.hostname === destination.hostname && starting.pathname === destination.pathname) return false;
    return AUTH_REDIRECT_PATH.test(destination.pathname);
  } catch (_) {
    return false;
  }
}

function urlOrigin(value) {
  try { return new URL(value).origin; } catch (_) { return ""; }
}

function qaProductionEquivalent(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const liveHosts = {
      "www2.qa.gov.bc.ca": "www2.gov.bc.ca",
      "intranet.qa.gov.bc.ca": "intranet.gov.bc.ca"
    };
    if (!liveHosts[host]) return "";
    url.hostname = liveHosts[host];
    return url.href;
  } catch (_) { return ""; }
}

function qaPublishingFamily(value) {
  const host = hostnameFor(value);
  if (host === "www2.qa.gov.bc.ca") return "public";
  if (host === "intranet.qa.gov.bc.ca") return "intranet";
  return "";
}

function publicQaReviewContext(value) {
  const host = hostnameFor(value);
  return host === "cmslite.gov.bc.ca" || host === "www2.qa.gov.bc.ca";
}

function publicQaCmsDestination(value) {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase() === "www2.qa.gov.bc.ca"
      && /^\/(?:gov|assets)(?:\/|$)/i.test(url.pathname);
  } catch (_) {
    return false;
  }
}

function publicCmsEnvironmentPair(value, sourcePageUrl) {
  if (!publicQaReviewContext(sourcePageUrl)) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!["gov.bc.ca", "www2.gov.bc.ca", "www2.qa.gov.bc.ca"].includes(host)) return null;
    if (!/^\/(?:gov|assets)(?:\/|$)/i.test(url.pathname)) return null;
    const qa = new URL(url.href);
    qa.protocol = "https:";
    qa.hostname = "www2.qa.gov.bc.ca";
    qa.port = "";
    const live = new URL(url.href);
    live.protocol = "https:";
    live.hostname = "www2.gov.bc.ca";
    live.port = "";
    return { qa: qa.href, live: live.href };
  } catch (_) {
    return null;
  }
}

function intranetContentIdResolver(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!["intranet.gov.bc.ca", "intranet.qa.gov.bc.ca"].includes(host)) return null;
    if (url.pathname !== "/intranet/content") return null;
    const keys = Array.from(url.searchParams.keys());
    if (keys.length !== 1 || keys[0] !== "id") return null;
    const id = url.searchParams.get("id") || "";
    if (!/^[a-f0-9]{32}$/i.test(id)) return null;
    return { id: id.toUpperCase(), host };
  } catch (_) {
    return null;
  }
}

function canUseIntranetResolverSession(report) {
  const sourceUrl = report && report.page && report.page.url ? report.page.url : "";
  const sourceHost = hostnameFor(sourceUrl);
  const cmsEditor = Boolean(
    report && report.settings && report.settings.editorMode && cmsLiteEditorSource(sourceUrl)
  );
  const trustedPublishingSource = [
    "www2.gov.bc.ca",
    "www2.qa.gov.bc.ca",
    "gov.bc.ca",
    "intranet.gov.bc.ca",
    "intranet.qa.gov.bc.ca"
  ].includes(sourceHost);
  return cmsEditor || trustedPublishingSource;
}

function cmsLiteManagedAssetGuid(value) {
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== "cmslite.gov.bc.ca") return "";
    const match = /^\/assets\/download\/([a-f0-9]{32})(?:\/)?$/i.exec(url.pathname);
    return match ? match[1].toUpperCase() : "";
  } catch (_) { return ""; }
}

function cmsLiteAssetPublishingFamily(value) {
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== "cmslite.gov.bc.ca") return "";
    if (/^\/assets\/gov(?:\/|$)/i.test(url.pathname)) return "public";
    if (/^\/assets\/intranet(?:\/|$)/i.test(url.pathname)) return "intranet";
    return "";
  } catch (_) { return ""; }
}

function cmsLiteAssetEnvironmentUrls(guid, family) {
  const cleanGuid = String(guid || "").toUpperCase();
  if (!/^[A-F0-9]{32}$/.test(cleanGuid)) return null;
  if (family === "public") {
    return {
      qa: `https://www2.qa.gov.bc.ca/assets/download/${cleanGuid}`,
      live: `https://www2.gov.bc.ca/assets/download/${cleanGuid}`,
      finalLiveOrigin: "https://gov.bc.ca/"
    };
  }
  if (family === "intranet") {
    return {
      qa: `https://intranet.qa.gov.bc.ca/assets/download/${cleanGuid}`,
      live: `https://intranet.gov.bc.ca/assets/download/${cleanGuid}`,
      finalLiveOrigin: ""
    };
  }
  return null;
}

function cmsLiteEditorSource(value) {
  return hostnameFor(value) === "cmslite.gov.bc.ca";
}

function cmsLiteEditorHomeLink(report, value) {
  if (!(report && report.settings && report.settings.editorMode)) return false;
  if (!cmsLiteEditorSource(report.page && report.page.url ? report.page.url : "")) return false;
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase() === "cmslite.gov.bc.ca" && url.pathname === "/" && !url.search && !url.hash;
  } catch (_) { return false; }
}

function signInMayBeRequired(value) {
  const host = hostnameFor(value);
  return host === "cmslite.gov.bc.ca" || authenticationRedirectHost(value);
}

function prepareRemoteLink(link, pageUrl) {
  if (!link) return null;
  const rawHref = String(link.rawHref || "").trim();
  if (rawHref.startsWith("#")) return null;
  let href;
  try { href = new URL(link.href || rawHref, pageUrl).href; } catch (_) { return null; }
  if (!/^https?:/i.test(href)) return null;
  try {
    const destination = new URL(href);
    if (destination.hash && canonicalUrl(destination.href) === canonicalUrl(pageUrl || "")) return null;
  } catch (_) {}
  const publicEnvironmentPair = publicCmsEnvironmentPair(href, pageUrl);
  const liveEquivalent = publicEnvironmentPair ? publicEnvironmentPair.live : qaProductionEquivalent(href);
  const checkUrl = liveEquivalent || href;
  const qaFamily = publicEnvironmentPair ? "public" : qaPublishingFamily(href);
  const qaUrl = publicEnvironmentPair ? publicEnvironmentPair.qa : (qaFamily ? href : "");
  const liveUrl = publicEnvironmentPair ? publicEnvironmentPair.live : liveEquivalent;
  const cmsLiteSameOrigin = cmsLiteEditorSource(pageUrl) && hostnameFor(href) === "cmslite.gov.bc.ca";
  const cmsLiteAssetGuid = cmsLiteSameOrigin ? cmsLiteManagedAssetGuid(href) : "";
  const destinationSafety = remoteDestinationSafety(href);
  return {
    ...link,
    href,
    checkUrl,
    qaLive: Boolean(liveEquivalent),
    qaFamily,
    qaUrl,
    liveUrl,
    publicQaPair: Boolean(publicEnvironmentPair),
    cmsLiteEditorLink: cmsLiteSameOrigin,
    cmsLiteAssetGuid,
    safetyBlocked: !destinationSafety.allowed,
    safetyMessage: destinationSafety.reason,
    sessionAware: trustedSessionHost(href) || trustedSessionHost(checkUrl) || cmsLiteSameOrigin,
    signInRequired: !liveEquivalent && !cmsLiteSameOrigin && signInMayBeRequired(checkUrl)
  };
}

function remoteLinkKey(link) {
  if (!link) return "";
  return canonicalUrl(link.qaFamily ? link.href : (link.checkUrl || link.href));
}

function remoteLinksForReport(report) {
  const unique = new Map();
  (((report || {}).pageDetails || {}).links || []).forEach(originalLink => {
    const link = prepareRemoteLink(originalLink, report && report.page ? report.page.url : "");
    if (!link) return;
    if (link.cmsLiteAssetGuid) {
      const matchingAsset = (report.assets || []).find(asset =>
        asset.selector === link.selector && editorSourceKey(asset) === editorSourceKey(link)
      );
      link.cmsLiteAssetFamily = cmsLiteAssetPublishingFamily(matchingAsset && matchingAsset.finalUrl ? matchingAsset.finalUrl : "");
    }
    const key = remoteLinkKey(link);
    if (unique.has(key)) unique.get(key).occurrences += 1;
    else unique.set(key, { ...link, occurrences: 1 });
  });
  return Array.from(unique.values());
}

function linkResultFromRemote(link, result) {
  const output = {
    status: result.status,
    code: result.code,
    link,
    linkKey: remoteLinkKey(link),
    checkedUrl: result.checkedUrl || link.checkUrl || link.href,
    finalUrl: result.finalUrl || result.checkedUrl || link.checkUrl || link.href,
    redirected: Boolean(result.redirected),
    error: result.error || "",
    qaLive: Boolean(link.qaLive),
    cmsStatus: result.cmsStatus || "",
    cmsCode: result.cmsCode || "",
    cmsCheckedUrl: result.cmsCheckedUrl || "",
    qaStatus: result.qaStatus || "",
    qaCode: result.qaCode || "",
    qaCheckedUrl: result.qaCheckedUrl || "",
    liveStatus: result.liveStatus || "",
    liveCode: result.liveCode || "",
    liveCheckedUrl: result.liveCheckedUrl || "",
    accessMode: result.accessMode || ""
  };
  if (result.combinedStatus) output.status = result.combinedStatus;
  else if (link.qaLive && result.status === "ok") output.status = "live-ok";
  else if (link.qaLive && result.status === "broken") output.status = "live-not-found";
  else if (link.sessionAware && result.status === "ok" && result.accessMode === "current-session") output.status = "session-ok";
  return output;
}

function permissionOriginsForPreparedLink(link) {
  const values = [link && (link.checkUrl || link.href)];
  if (link && link.qaLive) {
    if (link.qaUrl) values.push(link.qaUrl);
    else if (link.href) values.push(link.href);
    if (link.liveUrl) values.push(link.liveUrl);
  }
  if (link && link.cmsLiteAssetGuid) {
    const families = link.cmsLiteAssetFamily ? [link.cmsLiteAssetFamily] : ["public", "intranet"];
    families.forEach(family => {
      const environments = cmsLiteAssetEnvironmentUrls(link.cmsLiteAssetGuid, family);
      if (!environments) return;
      values.push(environments.qa, environments.live);
      if (environments.finalLiveOrigin) values.push(environments.finalLiveOrigin);
    });
  }
  return Array.from(new Set(values.filter(Boolean).flatMap(permissionOriginsForRemoteUrl)));
}

function permissionOriginsForRemoteUrl(value) {
  try {
    if (!remoteDestinationSafety(value).allowed) return [];
    const url = new URL(value);
    const origins = new Set([originPattern(url.href)]);
    if (url.protocol === "http:") {
      url.protocol = "https:";
      origins.add(originPattern(url.href));
    }
    if (url.hostname.toLowerCase().startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      url.protocol = "https:";
      origins.add(originPattern(url.href));
    }
    return Array.from(origins);
  } catch (_) { return []; }
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

function retainedFeedbackNotes(notes, now = Date.now()) {
  return (Array.isArray(notes) ? notes : []).filter(note => {
    if (!note || !note.archivedAt) return Boolean(note);
    const archivedAt = Date.parse(note.archivedAt);
    return Number.isFinite(archivedAt) && archivedAt <= now && now - archivedAt <= ARCHIVED_FEEDBACK_RETENTION_MS;
  });
}

function storedBatchIsComplete(batch) {
  return Boolean(batch && batch.phase === "done" && Array.isArray(batch.urls) && batch.urls.length && Array.isArray(batch.records) && batch.records.length >= batch.urls.length);
}

function retainedStoredBatch(batch, now = Date.now()) {
  if (!batch || !Array.isArray(batch.records)) return null;
  const savedAt = Date.parse(batch.savedAt || "");
  if (!Number.isFinite(savedAt) || savedAt > now) return null;
  const retention = storedBatchIsComplete(batch) ? COMPLETE_BATCH_RETENTION_MS : INCOMPLETE_BATCH_RETENTION_MS;
  return now - savedAt <= retention ? batch : null;
}

async function loadState() {
  const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  const savedReports = stored[STORAGE_KEYS.reports] || {};
  state.reports = normalizedStoredReports(savedReports);
  const storedFingerprints = storedFindingFingerprints(state.reports);
  state.decisions = retainedFindingMap(stored[STORAGE_KEYS.decisions] || {}, storedFingerprints);
  const savedExceptions = stored[STORAGE_KEYS.exceptions] || [];
  state.exceptions = savedExceptions.filter(item => !(item.ruleId === "bc-abbreviation" && normalizeSpace(item.phrase) === "BC"));
  if (state.exceptions.length !== savedExceptions.length) await saveKey(STORAGE_KEYS.exceptions, state.exceptions);
  state.notes = retainedFindingMap(stored[STORAGE_KEYS.notes] || {}, storedFingerprints);
  state.feedbackNotes = retainedFeedbackNotes(stored[STORAGE_KEYS.feedback]);
  state.reviewContexts = retainedReviewContexts(stored[STORAGE_KEYS.reviewContexts] || {}, state.reports);
  state.domainSettings = stored[STORAGE_KEYS.domains] || {};
  const savedOptionalChecks = stored[STORAGE_KEYS.optionalChecks] || {};
  state.optionalChecks = {
    nonBreakingSpace: savedOptionalChecks.nonBreakingSpace !== false,
    passiveVoice: savedOptionalChecks.passiveVoice !== false
  };
  const navigation = stored[STORAGE_KEYS.navigation] || {};
  state.lastReviewTabId = navigation.tabId || null;
  const navigationReport = navigation.pageKey ? savedReports[navigation.pageKey] : null;
  const normalizedNavigationKey = navigationReport && navigationReport.page ? reportKey(navigationReport.page.url) : navigation.pageKey || "";
  state.lastReviewPageKey = state.reports[normalizedNavigationKey] ? normalizedNavigationKey : "";
  const retainedState = {
    [STORAGE_KEYS.reports]: state.reports,
    [STORAGE_KEYS.decisions]: state.decisions,
    [STORAGE_KEYS.notes]: state.notes,
    [STORAGE_KEYS.feedback]: state.feedbackNotes,
    [STORAGE_KEYS.reviewContexts]: state.reviewContexts,
    [STORAGE_KEYS.navigation]: { tabId: state.lastReviewTabId, pageKey: state.lastReviewPageKey }
  };
  if (Object.entries(retainedState).some(([key, value]) => JSON.stringify(stored[key] || (Array.isArray(value) ? [] : {})) !== JSON.stringify(value))) {
    await chrome.storage.local.set(retainedState);
  }
  const storedBatch = stored[STORAGE_KEYS.batch];
  const legacyBatchWithoutTimestamp = storedBatch && Array.isArray(storedBatch.records) && !Object.prototype.hasOwnProperty.call(storedBatch, "savedAt");
  const batchForRetention = legacyBatchWithoutTimestamp ? { ...storedBatch, savedAt: new Date().toISOString() } : storedBatch;
  const savedBatch = retainedStoredBatch(batchForRetention);
  if (savedBatch) {
    const savedUrls = savedBatch.urls || [];
    const pageScanFinished = savedUrls.length > 0 && savedBatch.records.length >= savedUrls.length;
    let restoredPhase = savedBatch.phase || (savedBatch.records.length && !pageScanFinished ? "paused" : savedBatch.records.length ? "done" : "idle");
    if (restoredPhase === "links") restoredPhase = "link-permission";
    if (["scanning", "paused"].includes(restoredPhase) && pageScanFinished) restoredPhase = savedBatch.checkLinks ? "link-permission" : "done";
    if (restoredPhase === "scanning" && !pageScanFinished) restoredPhase = "paused";
    state.batch = {
      ...state.batch,
      running: false,
      paused: false,
      cancelled: Boolean(savedBatch.cancelled),
      phase: restoredPhase,
      records: savedBatch.records,
      urls: savedBatch.urls || [],
      currentIndex: Number.isFinite(savedBatch.currentIndex) ? savedBatch.currentIndex : savedBatch.records.length - 1,
      checkLinks: Boolean(savedBatch.checkLinks),
      linkPermissionMode: "found",
      linkCheckTotal: Number(savedBatch.linkCheckTotal) || 0,
      linkCheckCompleted: Number(savedBatch.linkCheckCompleted) || 0,
      settings: savedBatch.settings || state.batch.settings,
      exportPreset: savedBatch.exportPreset === "custom" ? "custom" : "full",
      customSheets: Array.isArray(savedBatch.customSheets) ? savedBatch.customSheets : [],
      includeReviewed: Boolean(savedBatch.includeReviewed),
      downloaded: Boolean(savedBatch.downloaded),
      downloadFilename: savedBatch.downloadFilename || "",
      downloadedAt: savedBatch.downloadedAt || ""
    };
    if (legacyBatchWithoutTimestamp) await persistBatchState();
  } else if (storedBatch) {
    await chrome.storage.local.remove(STORAGE_KEYS.batch);
  }
}

async function saveKey(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

function batchStorageValue() {
  const batch = state.batch;
  return {
    urls: batch.urls,
    records: batch.records,
    currentIndex: batch.currentIndex,
    phase: batch.phase,
    cancelled: batch.cancelled,
    checkLinks: batch.checkLinks,
    linkPermissionMode: batch.linkPermissionMode,
    linkCheckTotal: batch.linkCheckTotal,
    linkCheckCompleted: batch.linkCheckCompleted,
    settings: batch.settings,
    exportPreset: batch.exportPreset,
    customSheets: batch.customSheets,
    includeReviewed: batch.includeReviewed,
    downloaded: batch.downloaded,
    downloadFilename: batch.downloadFilename,
    downloadedAt: batch.downloadedAt,
    savedAt: new Date().toISOString()
  };
}

async function persistBatchState() {
  await saveKey(STORAGE_KEYS.batch, batchStorageValue());
}

async function currentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function currentReviewTab() {
  if (workspaceSurface && state.lastReviewTabId) {
    try { return await chrome.tabs.get(state.lastReviewTabId); } catch (_) { }
  }
  return currentTab();
}

function isScannableUrl(url) {
  return /^https?:\/\//i.test(url || "");
}

function unsupportedScanUrlMessage(url) {
  if (/^file:/i.test(url || "")) {
    return "Local files cannot be checked. For security, the checker supports only pages opened through HTTP or HTTPS.";
  }
  return "This browser page cannot be checked. Open a regular HTTP or HTTPS webpage and try again.";
}

function detectProfile(url) {
  return globalThis.BCWebStyleGuideChecker.helpers.detectProfile(url, "auto");
}

function isCmsLiteEditorUrl(url) {
  return hostnameFor(url) === "cmslite.gov.bc.ca";
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
  const activeUrl = (state.activeTab && state.activeTab.url) || "";
  const profile = detectProfile(activeUrl);
  const cmsEditor = profile === "cms-lite" && isCmsLiteEditorUrl(activeUrl);
  const scope = profile === "cms-lite"
    ? (cmsEditor ? "content" : (elements["cms-whole-scan"].checked ? "whole" : "content"))
    : ((document.querySelector("input[name='scope']:checked") || {}).value || "content");
  return {
    scope,
    profile,
    canControlColour: profile === "cms-lite" ? false : elements["colour-control"].checked,
    sectionSelector: scope === "content" && state.selectedSection ? state.selectedSection.selector : "",
    optionalChecks: { ...state.optionalChecks }
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
  const cmsEditor = isCmsLiteEditorUrl((state.activeTab && state.activeTab.url) || "");
  elements["cms-whole-scan"].checked = !cmsEditor && settings.scope === "whole";
  elements["colour-control"].checked = settings.canControlColour;
  updateSettingsExplanation();
}

function updateSettingsExplanation() {
  const settings = selectedSettings();
  const isCmsLite = settings.profile === "cms-lite";
  const cmsEditor = isCmsLite && isCmsLiteEditorUrl((state.activeTab && state.activeTab.url) || "");
  elements["profile-badge"].textContent = cmsEditor ? "CMS Lite editor" : isCmsLite ? "CMS Lite page" : "Standard website";
  elements["cms-lite-settings"].hidden = !isCmsLite;
  elements["standard-scope-settings"].hidden = isCmsLite;
  elements["cms-whole-scan"].disabled = cmsEditor;
  elements["colour-control-row"].hidden = settings.scope === "whole" || isCmsLite;
  if (cmsEditor) {
    elements["scope-note"].textContent = "Checks the editable CMS Lite fields. Check the QA or live page for the full page structure, metadata and colour contrast.";
  } else if (settings.scope === "whole") {
    elements["scope-note"].textContent = "Checks the full page, including navigation, footer, controls and colour contrast.";
  } else if (isCmsLite) {
    elements["scope-note"].textContent = "Checks the page title and editable content. Site-wide template elements and colour contrast are not included.";
  } else {
    elements["scope-note"].textContent = settings.canControlColour
      ? "Checks the page title and main content, including colour contrast."
      : "Checks the page title and main content. Colour contrast is not included.";
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
    (state.activeReport.settings.sectionSelector || "") === (settings.sectionSelector || "") &&
    (state.activeReport.settings.optionalChecks?.nonBreakingSpace !== false) === settings.optionalChecks.nonBreakingSpace &&
    (state.activeReport.settings.optionalChecks?.passiveVoice !== false) === settings.optionalChecks.passiveVoice;
}

async function saveOptionalChecks() {
  state.optionalChecks = {
    nonBreakingSpace: elements["optional-non-breaking-space"].checked,
    passiveVoice: elements["optional-passive-voice"].checked
  };
  await saveKey(STORAGE_KEYS.optionalChecks, state.optionalChecks);
  elements["optional-checks-status"].textContent = "Saved. Existing reports keep their original findings until you rescan.";
}

async function handleSettingsChange() {
  updateSettingsExplanation();
  await saveDomainSettings();
  if (!settingsMatchReport()) elements["cache-note"].textContent = "Review settings changed. Rescan to update the findings.";
}

function reportKey(url) { return canonicalUrl(url); }

function reportTimestamp(report) {
  const timestamp = Date.parse(report && report.scannedAt ? report.scannedAt : "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizedStoredReports(reports, now = Date.now()) {
  const newestByPage = new Map();
  Object.values(reports || {}).forEach(report => {
    const url = report && report.page && report.page.url ? report.page.url : "";
    const key = reportKey(url);
    const timestamp = reportTimestamp(report);
    if (!key || !timestamp || timestamp > now || now - timestamp > SINGLE_PAGE_REPORT_RETENTION_MS) return;
    const existing = newestByPage.get(key);
    if (!existing || reportTimestamp(existing) < timestamp) newestByPage.set(key, report);
  });
  return Object.fromEntries(
    Array.from(newestByPage.entries())
      .sort((first, second) => reportTimestamp(second[1]) - reportTimestamp(first[1]))
      .slice(0, MAX_REPORTS)
  );
}

function storedFindingFingerprints(reports) {
  return new Set(Object.values(reports || {}).flatMap(report =>
    Array.isArray(report && report.issues) ? report.issues.map(finding => finding && finding.fingerprint).filter(Boolean) : []
  ));
}

function retainedFindingMap(values, fingerprints) {
  return Object.fromEntries(Object.entries(values || {}).filter(([fingerprint]) => fingerprints.has(fingerprint)));
}

function retainedReviewContexts(contexts, reports) {
  const reportKeys = new Set(Object.keys(reports || {}));
  return Object.fromEntries(Object.entries(contexts || {}).filter(([key]) => reportKeys.has(key)));
}

async function storeReport(report) {
  const key = reportKey(report.page.url);
  const previous = state.reports[key];
  const replacesSuccessfulScan = !previous || previous.scannedAt !== report.scannedAt;
  state.reports = normalizedStoredReports({ ...state.reports, [key]: report });
  const fingerprints = storedFindingFingerprints(state.reports);
  state.decisions = retainedFindingMap(state.decisions, fingerprints);
  state.notes = retainedFindingMap(state.notes, fingerprints);
  state.reviewContexts = retainedReviewContexts(state.reviewContexts, state.reports);
  if (replacesSuccessfulScan) delete state.reviewContexts[key];
  await chrome.storage.local.set({
    [STORAGE_KEYS.reports]: state.reports,
    [STORAGE_KEYS.decisions]: state.decisions,
    [STORAGE_KEYS.notes]: state.notes,
    [STORAGE_KEYS.reviewContexts]: state.reviewContexts
  });
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

function truncatedFindingRules(report) {
  return Array.isArray(report && report.findingLimits && report.findingLimits.truncatedRules)
    ? report.findingLimits.truncatedRules
    : [];
}

function omittedFindingCount(report) {
  return truncatedFindingRules(report).reduce((total, item) => total + (Number(item.omitted) || 0), 0);
}

function omittedOpenCount(item) {
  return Number.isFinite(Number(item && item.omittedOpen)) ? Number(item.omittedOpen) : (Number(item && item.omitted) || 0);
}

function omittedFindingCountForExport(report, includeReviewed) {
  return truncatedFindingRules(report).reduce((total, item) => total + (includeReviewed ? (Number(item.omitted) || 0) : omittedOpenCount(item)), 0);
}

function findingCoverageText(report) {
  const truncated = truncatedFindingRules(report);
  if (!truncated.length) return "All detected findings are available for review.";
  const limit = Number(report.findingLimits && report.findingLimits.perRule) || 500;
  const details = truncated.map(item => `${item.title || item.ruleId}: ${Number(item.detected) || 0} detected, ${Number(item.retained) || 0} available`).join("; ");
  return `Safety limit reached (${limit} per issue type). ${details}.`;
}

function truncatedRulesMatchingCurrentFilters(report) {
  const status = elements["status-filter"].value;
  const severity = elements["severity-filter"].value;
  const category = elements["category-filter"].value;
  if (!["open", "all"].includes(status) || elements["important-filter"].checked) return [];
  return truncatedFindingRules(report)
    .filter(item => omittedOpenCount(item) && (severity === "all" || item.severity === severity) && (category === "all" || item.category === category));
}

function omittedFindingsMatchingCurrentFilters(report) {
  return truncatedRulesMatchingCurrentFilters(report).reduce((total, item) => total + omittedOpenCount(item), 0);
}

function reportCounts(report) {
  const counts = { fix: 0, check: 0, review: 0, ignored: 0, resolved: 0 };
  (report.issues || []).forEach(finding => {
    const status = effectiveStatus(finding);
    const amount = finding.occurrenceCount || 1;
    if (status === "open") counts[finding.severity] += amount;
    else counts[status] += amount;
  });
  truncatedFindingRules(report).forEach(item => {
    const severity = ["fix", "check", "review"].includes(item.severity) ? item.severity : "review";
    counts[severity] += omittedOpenCount(item);
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
    await saveNavigation().catch(() => { });
    showToast("The reviewed page is no longer open.");
  }
}

function showCurrentState(name, message) {
  elements["current-loading"].hidden = name !== "loading";
  elements["current-error"].hidden = name !== "error";
  elements["current-results"].hidden = name !== "results";
  if (message) elements["current-error-message"].textContent = message;
}

async function cachedPageChanged(tab, report) {
  if (!tab || !tab.id || !report || !report.page || !report.page.instanceId) return false;
  if (canonicalUrl(tab.url || "") !== canonicalUrl(report.page.url || "")) return true;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => String(performance.timeOrigin || "")
    });
    return Boolean(results[0] && results[0].result && results[0].result !== report.page.instanceId);
  } catch (_) {
    return false;
  }
}

function showStaleState(report, pageChanged) {
  const rulesChanged = Boolean(report && report.ruleVersion !== globalThis.BCWebStyleGuideChecker.ruleVersion);
  elements["stale-report-banner"].hidden = !rulesChanged && !pageChanged;
  if (pageChanged) {
    elements["stale-report-title"].textContent = "The page has changed since this review.";
    elements["stale-report-message"].textContent = "Your saved decisions are still here. Check the page again to update the findings.";
  } else if (rulesChanged) {
    elements["stale-report-title"].textContent = "The checker has been updated.";
    elements["stale-report-message"].textContent = "Check the page again to update the findings.";
  }
}

function showScanSettings() {
  elements["scan-settings"].hidden = false;
  elements["cancel-settings-button"].hidden = !state.activeReport;
  elements["scan-settings"].scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideScanSettings() {
  if (!state.activeReport) return;
  elements["scan-settings"].hidden = true;
  showCurrentState("results");
}

async function showRescanSettings() {
  if (state.activeReport && state.activeReport.settings) {
    applySettings(state.activeReport.settings);
    if (state.activeReport.settings.sectionSelector) {
      state.selectedSection = {
        selector: state.activeReport.settings.sectionSelector,
        text: state.activeReport.settings.sectionLabel || "Previously selected section",
        level: "Section"
      };
      try {
        const tab = await currentReviewTab();
        const results = tab && tab.id ? await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [state.selectedSection.selector],
          func: selector => Boolean(document.querySelector(selector))
        }) : [];
        if (!results[0] || !results[0].result) {
          state.selectedSection = null;
          elements["cache-note"].textContent = "The previously selected section could not be found. The full page content is selected.";
        }
      } catch (_) {
        state.selectedSection = null;
        elements["cache-note"].textContent = "The previously selected section could not be confirmed. The full page content is selected.";
      }
    }
  }
  updateSettingsExplanation();
  showCurrentState("idle");
  showScanSettings();
}

async function syncActiveTab() {
  if (workspaceSurface) {
    let tab = null;
    if (state.lastReviewTabId) {
      try { tab = await chrome.tabs.get(state.lastReviewTabId); } catch (_) { }
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
      showStaleState(cached, await cachedPageChanged(tab, cached));
      restoreReviewScroll(state.activePageKey);
    } else {
      state.activePageKey = tab ? reportKey(tab.url || "") : "";
      elements["active-page-label"].textContent = tab ? (tab.title || tab.url || "Current page") : "No reviewed page";
      elements["active-page-label"].title = tab ? (tab.url || "") : "";
      if (tab) applySettings(defaultSettings(tab.url || ""));
      const scannable = Boolean(tab && isScannableUrl(tab.url || ""));
      elements["scan-button"].disabled = previewLifecycleBlocksUse() || !scannable;
      elements["scan-settings"].hidden = !scannable;
      showCurrentState(scannable ? "idle" : "error", tab ? unsupportedScanUrlMessage(tab.url || "") : "No active browser tab was found.");
    }
    return;
  }
  const tab = await currentTab();
  const nextPageKey = tab ? reportKey(tab.url || "") : "";
  const pageChanged = nextPageKey !== state.activePageKey;
  if (pageChanged && elements["feedback-dialog"] && elements["feedback-dialog"].open) {
    state.pendingFeedbackPageChange = true;
    showToast("The page changed. Save or cancel this feedback note to continue to the new page.");
  } else if (pageChanged && state.currentView === "feedback") {
    state.feedbackPreviousView = "current";
    switchView("current");
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  }
  if (pageChanged) {
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
    state.skippedRuleIds.clear();
    state.skippedFingerprints.clear();
    if (elements["status-filter"]) elements["status-filter"].value = "open";
    if (elements["severity-filter"]) elements["severity-filter"].value = "all";
    if (elements["category-filter"]) elements["category-filter"].value = "all";
    if (elements["sort-order"]) elements["sort-order"].value = "type";
    if (elements["important-filter"]) elements["important-filter"].checked = false;
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
  if (!isScannableUrl(tab.url || "")) {
    state.activeReport = null;
    elements["scan-settings"].hidden = true;
    elements["scan-button"].disabled = true;
    elements["stale-report-banner"].hidden = true;
    showCurrentState("error", unsupportedScanUrlMessage(tab.url || ""));
    return;
  }
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
    showStaleState(cached, await cachedPageChanged(tab, cached));
    restoreReviewScroll(nextPageKey);
  } else {
    state.activeReport = null;
    showCurrentState("idle");
    elements["scan-settings"].hidden = false;
    elements["cancel-settings-button"].hidden = true;
    elements["cache-note"].textContent = "";
    elements["stale-report-banner"].hidden = true;
  }
  elements["scan-button"].disabled = previewLifecycleBlocksUse() || !isScannableUrl(tab.url || "");
}

async function injectScanner(tabId, options) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["checker-core.js", "cms-lite-editor.js"]
  });

  const results = await chrome.scripting.executeScript({
    target: { tabId },

    func: optionsValue => {
      const hostname = location.hostname.toLowerCase();

      const editorFrames = Array.from(
        document.querySelectorAll("iframe.cke_wysiwyg_frame")
      );

      const isCmsLiteEditor =
        hostname === "cmslite.gov.bc.ca" &&
        editorFrames.length > 0;

      // Normal websites and CMS Lite QA continue using the existing scan.
      if (!isCmsLiteEditor) {
        return globalThis.BCWebStyleGuideChecker.scanPage(
          document,
          optionsValue
        );
      }

      // CMS Lite Topic/editor mode:
      // scan each non-empty CKEditor document instead of the CMS interface.
      const cmsLitePublishedUrl = value => {
        try {
          const url = new URL(value, location.href);

          if (
            url.hostname.toLowerCase() !== "cmslite.gov.bc.ca" ||
            !/^\/gov(?:\/|$)/.test(url.pathname)
          ) {
            return value;
          }

          url.protocol = "https:";
          url.hostname = "gov.bc.ca";
          url.port = "";
          return url.href;
        } catch (_) {
          return value;
        }
      };

      const cmsEditor = globalThis.BCWebStyleGuideCmsLite;

      if (!cmsEditor) {
        return {
          error: "CMS Lite editor support could not be loaded."
        };
      }

      const editorTextByReport = new WeakMap();
      const frameReports = editorFrames
        .map((frame, index) => {
          const frameDocument = frame.contentDocument;
          const editorSource = cmsEditor.describeEditorFrame(frame, index);

          const frameBody =
            frameDocument?.querySelector("body.cke_editable");

          if (!frameDocument || !frameBody) {
            return null;
          }

          const text =
            frameBody.innerText?.trim() || "";

          // Ignore completely empty editor regions.
          if (
            !text &&
            !frameBody.querySelector(
              "img,a,table,ul,ol"
            )
          ) {
            return null;
          }

          const report =
            globalThis.BCWebStyleGuideChecker.scanPage(
              frameDocument,
              {
                ...optionsValue,
                profile: "cms-lite",
                scope: "content",
                editorRegion: index + 1,
                pageUrlOverride: location.href
              }
            );

          report.editorRegion = index + 1;
          report.editorSource = editorSource;
          editorTextByReport.set(report, text);

          return report;
        })
        .filter(Boolean);

      if (!frameReports.length) {
        return {
          error:
            "No editable CMS Lite content was found."
        };
      }

      /*
       * These checks describe an entire rendered page rather than an
       * individual editor region. Running them once per CKEditor frame
       * would create misleading findings.
       */
      const editorExcludedRules = new Set([
        "page-title-missing",
        "page-title-long",
        "page-title-punctuation",
        "meta-description",
        "document-language",
        "main-landmark",
        "skip-link-target",
        "h1-count",
        "on-this-page-missing",
        "on-this-page-links",
        "broken-anchor"
      ]);

      const pageOrderOffsets = new Map();
      let nextPageOrder = 0;

      frameReports.forEach(report => {
        const details = report.pageDetails || {};
        const localOrders = [
          ...(report.issues || []),
          ...(details.headings || []),
          ...(details.images || []),
          ...(details.links || [])
        ]
          .map(item => item.pageOrder)
          .filter(value =>
            Number.isFinite(value) &&
            value !== Number.MAX_SAFE_INTEGER
          );

        pageOrderOffsets.set(
          report.editorRegion,
          nextPageOrder
        );

        const localMax = localOrders.length
          ? Math.max(...localOrders)
          : 0;

        nextPageOrder += localMax + 1;
      });

      const combinedPageOrder = (
        value,
        editorRegion
      ) => {
        if (
          !Number.isFinite(value) ||
          value === Number.MAX_SAFE_INTEGER
        ) {
          return value;
        }

        return (
          pageOrderOffsets.get(editorRegion) ||
          0
        ) + value;
      };

      const checkerHelpers = globalThis.BCWebStyleGuideChecker.helpers;
      const earlierEditorTexts = [];
      const seenEditorAcronyms = new Set();
      const candidateIssues = frameReports.flatMap(report => {
        const included = report.issues
          .filter(finding => {
            if (
              editorExcludedRules.has(
                finding.ruleId
              )
            ) {
              return false;
            }

            if (
              String(
                finding.evidence || ""
              ).startsWith(
                "Rich Text Editor,"
              )
            ) {
              return false;
            }

            if (!checkerHelpers.editorAcronymFindingIncluded(
              finding,
              earlierEditorTexts,
              seenEditorAcronyms
            )) {
              return false;
            }

            return true;
          })
          .map(finding => ({
            ...finding,

            editorRegion:
              report.editorRegion,

            editorSource:
              report.editorSource,

            pageOrder:
              combinedPageOrder(
                finding.pageOrder,
                report.editorRegion
              ),

            location:
              cmsEditor.locationFor(
                report.editorSource,
                finding.location
              )
          }));
        earlierEditorTexts.push(editorTextByReport.get(report) || "");
        return included;
      });

      const perRuleFindingLimit = Number(
        frameReports[0].findingLimits?.perRule
      ) || 500;
      const detectedByRule = new Map();
      const detectedOpenByRule = new Map();
      const ruleDetails = new Map();

      candidateIssues.forEach(issue => {
        const amount = Math.max(
          1,
          Number(issue.occurrenceCount) || 1
        );
        detectedByRule.set(
          issue.ruleId,
          (detectedByRule.get(issue.ruleId) || 0) + amount
        );
        if (issue.automaticStatus === "open") {
          detectedOpenByRule.set(
            issue.ruleId,
            (detectedOpenByRule.get(issue.ruleId) || 0) + amount
          );
        }
        if (!ruleDetails.has(issue.ruleId)) {
          ruleDetails.set(issue.ruleId, {
            title: issue.title,
            severity: issue.severity,
            category: issue.category
          });
        }
      });

      frameReports.forEach(report => {
        (report.findingLimits?.truncatedRules || [])
          .filter(item => !editorExcludedRules.has(item.ruleId))
          .forEach(item => {
            detectedByRule.set(
              item.ruleId,
              (detectedByRule.get(item.ruleId) || 0) +
                (Number(item.omitted) || 0)
            );
            detectedOpenByRule.set(
              item.ruleId,
              (detectedOpenByRule.get(item.ruleId) || 0) +
                (Number.isFinite(Number(item.omittedOpen)) ? Number(item.omittedOpen) : (Number(item.omitted) || 0))
            );
            if (!ruleDetails.has(item.ruleId)) {
              ruleDetails.set(item.ruleId, {
                title: item.title || item.ruleId,
                severity: item.severity || "review",
                category: item.category || "Other"
              });
            }
          });
      });

      const retainedByRule = new Map();
      const retainedOpenByRule = new Map();
      const issues = [];
      candidateIssues.forEach(issue => {
        const retained = retainedByRule.get(issue.ruleId) || 0;
        const available = perRuleFindingLimit - retained;
        if (available <= 0) return;
        const amount = Math.max(
          1,
          Number(issue.occurrenceCount) || 1
        );
        const retainedAmount = Math.min(amount, available);
        issues.push(
          retainedAmount === amount
            ? issue
            : { ...issue, occurrenceCount: retainedAmount }
        );
        retainedByRule.set(
          issue.ruleId,
          retained + retainedAmount
        );
        if (issue.automaticStatus === "open") {
          retainedOpenByRule.set(
            issue.ruleId,
            (retainedOpenByRule.get(issue.ruleId) || 0) + retainedAmount
          );
        }
      });

      const truncatedRules = Array.from(detectedByRule.entries())
        .filter(([ruleId, detected]) =>
          detected > (retainedByRule.get(ruleId) || 0)
        )
        .map(([ruleId, detected]) => {
          const retained = retainedByRule.get(ruleId) || 0;
          const detail = ruleDetails.get(ruleId) || {};
          return {
            ruleId,
            title: detail.title || ruleId,
            severity: detail.severity || "review",
            category: detail.category || "Other",
            detected,
            retained,
            omitted: detected - retained,
            detectedOpen: detectedOpenByRule.get(ruleId) || 0,
            retainedOpen: retainedOpenByRule.get(ruleId) || 0,
            omittedOpen: (detectedOpenByRule.get(ruleId) || 0) - (retainedOpenByRule.get(ruleId) || 0)
          };
        });

      const severityCounts = {
        fix: 0,
        check: 0,
        review: 0
      };

      issues
        .filter(
          issue =>
            issue.automaticStatus === "open"
        )
        .forEach(issue => {
          severityCounts[issue.severity] +=
            issue.occurrenceCount || 1;
        });

      const combinedDetails = {
        headings: [],
        images: [],
        links: [],
        metadata: {
          unavailable: true,
          reason: "cms-lite-editor"
        },

        counts: {
          headings: 0,
          images: 0,
          imagesMissingAlt: 0,
          imagesEmptyAlt: 0,
          links: 0,
          assets: 0,
          lists: 0,
          tables: 0,
          forms: 0,
          accordions: 0
        }
      };

      /*
       * Preserve the semantic editor source on Page details items.
       *
       * Selectors generated inside separate CKEditor documents can be
       * identical. The source textarea is the stable locator; editorRegion
       * remains as a fallback for saved reports created before this mapping.
       */
      frameReports.forEach(report => {
        const details =
          report.pageDetails || {};

        combinedDetails.headings.push(
          ...(details.headings || []).map(
            item => ({
              ...item,
              editorRegion:
                report.editorRegion,
              editorSource:
                report.editorSource,
              location:
                cmsEditor.locationFor(
                  report.editorSource,
                  item.location
                ),
              pageOrder:
                combinedPageOrder(
                  item.pageOrder,
                  report.editorRegion
                )
            })
          )
        );

        combinedDetails.images.push(
          ...(details.images || []).map(
            item => ({
              ...item,
              editorRegion:
                report.editorRegion,
              editorSource:
                report.editorSource,
              location:
                cmsEditor.locationFor(
                  report.editorSource,
                  item.location
                ),
              pageOrder:
                combinedPageOrder(
                  item.pageOrder,
                  report.editorRegion
                )
            })
          )
        );

        combinedDetails.links.push(
          ...(details.links || []).map(
            item => ({
              ...item,
              href:
                cmsLitePublishedUrl(item.href),
              rawHref:
                /^https?:/i.test(item.rawHref || "")
                  ? cmsLitePublishedUrl(item.rawHref)
                  : item.rawHref,
              editorRegion:
                report.editorRegion,
              editorSource:
                report.editorSource,
              location:
                cmsEditor.locationFor(
                  report.editorSource,
                  item.location
                ),
              pageOrder:
                combinedPageOrder(
                  item.pageOrder,
                  report.editorRegion
                )
            })
          )
        );

        Object.keys(
          combinedDetails.counts
        ).forEach(key => {
          combinedDetails.counts[key] +=
            details.counts?.[key] || 0;
        });
      });

      const totalStats =
        frameReports.reduce(
          (totals, report) => {
            totals.words +=
              report.stats.words || 0;

            totals.sentences +=
              report.stats.sentences || 0;

            totals.readingWords +=
              report.stats.readingWords || 0;

            totals.headings +=
              report.stats.headings || 0;

            totals.links +=
              report.stats.links || 0;

            totals.images +=
              report.stats.images || 0;

            return totals;
          },

          {
            words: 0,
            sentences: 0,
            readingWords: 0,
            headings: 0,
            links: 0,
            images: 0
          }
        );

      return {
        ...frameReports[0],

        page: {
          ...frameReports[0].page,
          title:
            document.title ||
            "CMS Lite editable content",
          url: location.href,
          hostname,
          instanceId:
            String(performance.timeOrigin || ""),
          contentSignature:
            frameReports
              .map(report =>
                report.page?.contentSignature || ""
              )
              .join("|")
        },

        settings: {
          ...frameReports[0].settings,
          profile: "cms-lite",
          profileLabel: "CMS Lite",
          scope: "content",
          editorMode: true,
          rootSelector:
            "CMS Lite editable fields"
        },

        stats: {
          ...frameReports[0].stats,
          ...totalStats,

          // A single page-level grade would be misleading
          // when several independent editor regions are
          // scanned and then combined.
          readingGrade: null,

          root: "CKEditor fields"
        },

        severityCounts,

        issues,

        totals: Object.fromEntries(detectedByRule),

        /*
         * Preserve semantic editor source here too. Asset verification
         * happens after the initial scan, so findings created later still
         * need a stable route back to the originating CMS Lite field.
         */
        assets: frameReports.flatMap(
          report =>
            (report.assets || []).map(
              asset => ({
                ...asset,
                editorRegion:
                  report.editorRegion,
                editorSource:
                  report.editorSource,
                location:
                  cmsEditor.locationFor(
                    report.editorSource,
                    asset.location
                  )
              })
            )
        ),

        pageDetails: combinedDetails,

        findingLimits: {
          perRule: perRuleFindingLimit,
          complete: truncatedRules.length === 0,
          truncatedRules
        },

        notes:
          `Scanned ${frameReports.length} CMS Lite editable field` +
          `${
            frameReports.length === 1
              ? ""
              : "s"
          }.` +
          (truncatedRules.length
            ? ` Some issue types reached the ${perRuleFindingLimit}-finding safety limit. Detected totals are preserved in the report.`
            : "")
      };
    },

    args: [options]
  });

  const report =
    results &&
    results[0] &&
    results[0].result;

  if (!report) {
    throw new Error(
      "The page returned no scan results."
    );
  }

  if (report.error) {
    throw new Error(report.error);
  }

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

function editorSourceKey(item) {
  const source = item && item.editorSource;
  return normalizeSpace(source && (source.editorKey || source.textareaId)) ||
    (Number(item && item.editorRegion) ? `region:${Number(item.editorRegion)}` : "");
}

function appendUniqueFinding(report, finding) {
  if (!finding) return;

  const findingEditorKey = editorSourceKey(finding);

  const duplicate = report.issues.some(item =>
    item.ruleId === finding.ruleId &&
    item.selector === finding.selector &&
    editorSourceKey(item) === findingEditorKey
  );

  if (duplicate) return;

  if (
    !Number.isFinite(finding.pageOrder) ||
    finding.pageOrder === Number.MAX_SAFE_INTEGER
  ) {
    const details = report.pageDetails || {};

    const pageItem = [
      ...(details.headings || []),
      ...(details.images || []),
      ...(details.links || [])
    ].find(item =>
      item.selector === finding.selector &&
      editorSourceKey(item) === findingEditorKey &&
      Number.isFinite(item.pageOrder)
    );

    if (pageItem) {
      finding.pageOrder = pageItem.pageOrder;
    }
  }

  report.issues.push(finding);
}

function isManualRedirect(response) {
  return Boolean(response && (response.type === "opaqueredirect" || response.status >= 300 && response.status < 400));
}

async function fetchRemoteFollowingRedirects(url, signal, { sessionAware = false, allowGetFallback = true } = {}) {
  const credentials = sessionAware ? "include" : "omit";
  const rangedGet = async () => {
    const response = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      credentials,
      redirect: "follow",
      signal,
      cache: "no-store"
    });
    if (response.body && response.body.cancel) response.body.cancel().catch(() => {});
    return response;
  };

  try {
    const response = await fetch(url, { method: "HEAD", credentials, redirect: "follow", signal, cache: "no-store" });
    if (allowGetFallback && [405, 501].includes(response.status)) return rangedGet();
    if (allowGetFallback && !sessionAware && isManualRedirect(response)) {
      // Some public servers treat HEAD differently from a normal page request.
      // Before reporting the destination as an unverified redirect, retry with
      // the same bounded anonymous GET used for other public HEAD failures.
      // This lets the checker verify the page the browser would actually open.
      try { return await rangedGet(); } catch (_) { return response; }
    }
    return response;
  } catch (error) {
    // Public sites sometimes reject or mishandle HEAD requests even though a
    // normal GET (and its redirect chain) works. Retrying anonymously with a
    // one-byte range lets us verify those destinations without broadening the
    // signed-in path: authenticated checks remain HEAD-only unless a separate,
    // explicitly scoped resolver handles the URL.
    if (!allowGetFallback || sessionAware) throw error;
    return rangedGet();
  }
}

async function fetchRemoteOnce(url, signal, { sessionAware = false, allowGetFallback = true } = {}) {
  const credentials = sessionAware ? "include" : "omit";
  let response = await fetch(url, { method: "HEAD", credentials, redirect: "manual", signal, cache: "no-store" });
  if (allowGetFallback && [405, 501].includes(response.status)) {
    response = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      credentials,
      redirect: "manual",
      signal,
      cache: "no-store"
    });
    if (response.body && response.body.cancel) response.body.cancel().catch(() => {});
  }
  return response;
}

function sessionVerificationMessage(status) {
  if (status === "sign-in") return "This link redirected to sign-in. Open it to continue.";
  if (status === "restricted") return "This link returned an access error. Open it to check whether you have access.";
  return "The checker could not fully check this link. Open it to confirm.";
}

function safetyBlockedResult(value, reason) {
  return {
    status: "safety-blocked",
    checkedUrl: value,
    finalUrl: value,
    error: reason || "This destination was not requested because of a link-check safety control. Open it yourself if you need to confirm it."
  };
}

async function checkRemoteUrl(value, timeoutMs = 10000, options = {}) {
  let startingUrl;
  try { startingUrl = new URL(value).href; } catch (_) { return { status: "unavailable", checkedUrl: value, finalUrl: value, error: "The destination address is invalid." }; }
  const destinationSafety = remoteDestinationSafety(startingUrl);
  if (!destinationSafety.allowed) return safetyBlockedResult(startingUrl, destinationSafety.reason);
  const sessionAware = Boolean(options.sessionAware && trustedSessionHost(startingUrl));
  if (sessionAware && authenticatedActionUrl(startingUrl)) return safetyBlockedResult(startingUrl, "The authenticated destination looks like an action and was not requested.");
  if (signInMayBeRequired(startingUrl)) return { status: "sign-in", checkedUrl: startingUrl, finalUrl: startingUrl, error: sessionVerificationMessage("sign-in") };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const classifyResponse = (response, url, redirected, accessMode = "") => {
    const result = { response, code: response.status, checkedUrl: startingUrl, finalUrl: response.url || url, redirected, accessMode };
    if (response.status === 404 || response.status === 410) return { ...result, status: "broken" };
    if (response.status >= 500) return { ...result, status: "server" };
    if ([401, 403].includes(response.status)) return { ...result, status: sessionAware ? "session-unverified" : "restricted", error: sessionAware ? sessionVerificationMessage("restricted") : "" };
    if (response.status === 429) return { ...result, status: "rate-limited" };
    if (response.status >= 400) return { ...result, status: "client-error" };
    if (response.status >= 200 && response.status < 300) return { ...result, status: "ok" };
    return { ...result, status: sessionAware ? "session-unverified" : "unavailable", error: sessionAware ? sessionVerificationMessage("unavailable") : "The website returned an unexpected response." };
  };
  const permittedFor = async url => {
    try { return await chrome.permissions.contains({ origins: [originPattern(url)] }); } catch (_) { return false; }
  };
  const visitSessionAware = async (url, depth, redirected) => {
    if (!await permittedFor(url)) return { status: "permission", checkedUrl: startingUrl, finalUrl: url, redirected };
    if (!trustedSessionHost(url)) return { status: "session-unverified", checkedUrl: startingUrl, finalUrl: startingUrl, redirected, error: sessionVerificationMessage("unavailable") };
    try {
      const response = await fetchRemoteOnce(url, controller.signal, { sessionAware: true, allowGetFallback: false });
      if ([405, 501].includes(response.status)) {
        return {
          status: "session-unverified",
          code: response.status,
          checkedUrl: startingUrl,
          finalUrl: url,
          redirected,
          error: "This site could not be checked automatically. Open the link to confirm it."
        };
      }
      if (isManualRedirect(response)) {
        let location = "";
        try { location = response.headers.get("location") || ""; } catch (_) {}
        let nextUrl = "";
        try { nextUrl = location ? new URL(location, url).href : ""; } catch (_) {}
        const nextSafety = nextUrl ? remoteDestinationSafety(nextUrl) : { allowed: true };
        if (!nextSafety.allowed) return safetyBlockedResult(startingUrl, nextSafety.reason);
        if (nextUrl && authenticatedActionUrl(nextUrl)) return safetyBlockedResult(startingUrl, "The authenticated redirect looks like an action and was not requested.");
        if (nextUrl && authenticationRedirectHost(nextUrl)) {
          return { status: "sign-in", checkedUrl: startingUrl, finalUrl: startingUrl, redirected: true, error: sessionVerificationMessage("sign-in") };
        }
        if (nextUrl && depth < 3 && trustedSessionHost(nextUrl) && await permittedFor(nextUrl)) return visitSessionAware(nextUrl, depth + 1, true);
        return { status: "session-unverified", checkedUrl: startingUrl, finalUrl: startingUrl, redirected: true, error: sessionVerificationMessage("unavailable") };
      }
      return classifyResponse(response, url, redirected, "current-session");
    } catch (error) {
      return {
        status: "session-unverified",
        checkedUrl: startingUrl,
        finalUrl: startingUrl,
        redirected,
        error: error && error.name === "AbortError" ? "Timed out while checking with your current browser access." : sessionVerificationMessage("unavailable")
      };
    }
  };
  const visitAnonymous = async (url, depth, redirected) => {
    if (!await permittedFor(url)) return { status: "permission", checkedUrl: startingUrl, finalUrl: url, redirected };
    if (signInMayBeRequired(url)) return { status: "sign-in", checkedUrl: startingUrl, finalUrl: startingUrl, redirected, error: sessionVerificationMessage("sign-in") };

    try {
      const followed = await fetchRemoteFollowingRedirects(url, controller.signal, { sessionAware: false, allowGetFallback: true });
      const finalUrl = followed.url || url;
      const didRedirect = Boolean(redirected || followed.redirected || canonicalUrl(finalUrl) !== canonicalUrl(url));
      const finalSafety = remoteDestinationSafety(finalUrl);
      if (!finalSafety.allowed) return safetyBlockedResult(startingUrl, finalSafety.reason);
      if (didRedirect && looksLikeAuthenticationRedirect(startingUrl, finalUrl)) {
        return { status: "sign-in", checkedUrl: startingUrl, finalUrl: startingUrl, redirected: true, error: sessionVerificationMessage("sign-in") };
      }
      if (didRedirect && finalUrl !== url && !await permittedFor(finalUrl)) {
        return {
          status: "redirect",
          checkedUrl: startingUrl,
          finalUrl,
          redirected: true,
          error: "This link redirects to another website that could not be checked. Open it to confirm the final page."
        };
      }
      if (!isManualRedirect(followed)) return classifyResponse(followed, finalUrl, didRedirect);
    } catch (_) {
      // Use the cautious manual path below to distinguish an inaccessible
      // redirect from a general network failure when possible.
    }

    const response = await fetchRemoteOnce(url, controller.signal, { sessionAware: false, allowGetFallback: true });
    if (isManualRedirect(response)) {
      let location = "";
      try { location = response.headers.get("location") || ""; } catch (_) {}
      if (location && depth < 3) {
        let nextUrl = "";
        try { nextUrl = new URL(location, url).href; } catch (_) {}
        if (nextUrl) {
          const nextSafety = remoteDestinationSafety(nextUrl);
          if (!nextSafety.allowed) return safetyBlockedResult(startingUrl, nextSafety.reason);
          if (looksLikeAuthenticationRedirect(startingUrl, nextUrl) || signInMayBeRequired(nextUrl)) return { status: "sign-in", checkedUrl: startingUrl, finalUrl: startingUrl, redirected: true, error: sessionVerificationMessage("sign-in") };
          if (await permittedFor(nextUrl)) return visitAnonymous(nextUrl, depth + 1, true);
          return {
            status: "redirect",
            checkedUrl: startingUrl,
            finalUrl: nextUrl,
            redirected: true,
            error: "This link redirects to another website that could not be checked. Open it to confirm the final page."
          };
        }
      }
      try {
        const current = new URL(url);
        if (current.protocol === "http:" && depth < 3) {
          current.protocol = "https:";
          const httpsUrl = current.href;
          if (await permittedFor(httpsUrl)) return visitAnonymous(httpsUrl, depth + 1, true);
        }
      } catch (_) {}
      return {
        status: "redirect",
        checkedUrl: startingUrl,
        finalUrl: url,
        redirected: true,
        error: "This link redirects, but the final page could not be checked. Open it to confirm."
      };
    }
    return classifyResponse(response, url, redirected);
  };
  try {
    return sessionAware ? await visitSessionAware(startingUrl, 0, false) : await visitAnonymous(startingUrl, 0, false);
  } catch (error) {
    return {
      status: sessionAware ? "session-unverified" : "unavailable",
      checkedUrl: startingUrl,
      finalUrl: startingUrl,
      error: error && error.name === "AbortError" ? "Timed out" : sessionAware ? sessionVerificationMessage("unavailable") : "The website did not complete the link check."
    };
  } finally { clearTimeout(timeout); }
}

async function checkPublicQaWithCurrentAccess(report, value, timeoutMs = 10000, useCurrentAccess = false) {
  const destinationSafety = remoteDestinationSafety(value);
  if (!destinationSafety.allowed) return safetyBlockedResult(value, destinationSafety.reason);
  if (useCurrentAccess && authenticatedActionUrl(value)) return safetyBlockedResult(value, "The authenticated destination looks like an action and was not requested.");
  if (!publicQaCmsDestination(value) || !useCurrentAccess) {
    return checkRemoteUrl(value, timeoutMs, { sessionAware: false });
  }

  // When the QA page itself is open, prefer a same-origin request from that
  // page. This uses the browser session that is already allowing the reviewer
  // to view QA, without exposing or reading any sign-in data.
  const pageResult = report ? await checkWithCurrentPageSession(report, value, Math.min(timeoutMs, 8000)) : null;
  if (pageResult && ["ok", "broken", "server", "rate-limited", "client-error"].includes(pageResult.status)) return pageResult;

  let startingUrl;
  try { startingUrl = new URL(value).href; } catch (_) {
    return { status: "unavailable", checkedUrl: value, finalUrl: value, error: "The QA address is invalid." };
  }

  const origins = [originPattern(startingUrl)];
  const permitted = await chrome.permissions.contains({ origins }).catch(() => false);
  if (!permitted) return { status: "permission", checkedUrl: startingUrl, finalUrl: startingUrl, error: "Website access is needed to check the QA version." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const rangedGet = () => fetch(startingUrl, {
    method: "GET",
    headers: { Range: "bytes=0-0" },
    credentials: "include",
    redirect: "follow",
    signal: controller.signal,
    cache: "no-store"
  });

  try {
    let response;
    try {
      response = await fetch(startingUrl, {
        method: "HEAD",
        credentials: "include",
        redirect: "follow",
        signal: controller.signal,
        cache: "no-store"
      });
      if ([405, 501].includes(response.status)) response = await rangedGet();
    } catch (_) {
      // QA is a known CMS publishing environment. A bounded GET is allowed
      // here because HEAD can behave differently from normal QA navigation.
      response = await rangedGet();
    }

    const finalUrl = response.url || startingUrl;
    const redirected = Boolean(response.redirected || canonicalUrl(finalUrl) !== canonicalUrl(startingUrl));
    if (response.body && response.body.cancel) response.body.cancel().catch(() => {});

    if (hostnameFor(finalUrl) !== "www2.qa.gov.bc.ca") {
      if (looksLikeAuthenticationRedirect(startingUrl, finalUrl) || authenticationRedirectHost(finalUrl)) {
        return { status: "sign-in", checkedUrl: startingUrl, finalUrl: startingUrl, redirected: true, error: "The QA version redirected to sign-in." };
      }
      return {
        status: "session-unverified",
        checkedUrl: startingUrl,
        finalUrl: startingUrl,
        redirected,
        error: "The QA version left the QA site, so the final page could not be confirmed."
      };
    }

    const base = {
      code: response.status,
      checkedUrl: startingUrl,
      finalUrl,
      redirected,
      accessMode: "current-session"
    };
    if (response.status === 404 || response.status === 410) return { ...base, status: "broken" };
    if (response.status >= 500) return { ...base, status: "server" };
    if ([401, 403].includes(response.status)) return { ...base, status: "session-unverified", error: "The QA version returned an access error." };
    if (response.status === 429) return { ...base, status: "rate-limited" };
    if (response.status >= 400) return { ...base, status: "client-error" };
    if (response.status >= 200 && response.status < 300) return { ...base, status: "ok" };
    return { ...base, status: "session-unverified", error: "The QA version returned a response the checker could not confirm." };
  } catch (error) {
    return {
      status: "session-unverified",
      checkedUrl: startingUrl,
      finalUrl: startingUrl,
      error: error && error.name === "AbortError"
        ? "Timed out while checking the QA version."
        : "The QA version could not be checked with your current browser access."
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkIntranetContentIdResolver(report, value, timeoutMs = 10000) {
  const resolver = intranetContentIdResolver(value);
  if (!resolver || !canUseIntranetResolverSession(report)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let startingUrl;
  try {
    startingUrl = new URL(value).href;

    // Fetch hides the Location header for a manual redirect in this context.
    // This exact legacy CMS resolver therefore uses a narrowly scoped ranged
    // GET and follows the redirect, then accepts the result only if it ends on
    // the same intranet environment. No other authenticated URL gets this
    // automatic GET-follow behaviour.
    const response = await fetch(startingUrl, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      credentials: "include",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal
    });

    const finalUrl = response.url || startingUrl;
    const redirected = Boolean(response.redirected || canonicalUrl(finalUrl) !== canonicalUrl(startingUrl));
    if (response.body && response.body.cancel) response.body.cancel().catch(() => {});

    if (redirected && (looksLikeAuthenticationRedirect(startingUrl, finalUrl) || authenticationRedirectHost(finalUrl))) {
      return {
        status: "sign-in",
        checkedUrl: startingUrl,
        finalUrl: startingUrl,
        redirected: true,
        error: sessionVerificationMessage("sign-in")
      };
    }

    if (hostnameFor(finalUrl) !== resolver.host) {
      return {
        status: "session-unverified",
        checkedUrl: startingUrl,
        finalUrl: startingUrl,
        redirected,
        error: "The intranet link redirected somewhere unexpected, so the final page could not be confirmed."
      };
    }

    const base = {
      code: response.status,
      checkedUrl: startingUrl,
      finalUrl,
      redirected,
      accessMode: "current-session"
    };
    if (response.status === 404 || response.status === 410) return { ...base, status: "broken" };
    if (response.status >= 500) return { ...base, status: "server" };
    if ([401, 403].includes(response.status)) return { ...base, status: "session-unverified", error: sessionVerificationMessage("restricted") };
    if (response.status === 429) return { ...base, status: "rate-limited" };
    if (response.status >= 400) return { ...base, status: "client-error" };
    if (response.status >= 200 && response.status < 300) return { ...base, status: "ok" };
    return { ...base, status: "session-unverified", error: "The intranet link returned a response the checker could not confirm." };
  } catch (error) {
    return {
      status: "session-unverified",
      checkedUrl: startingUrl || value,
      finalUrl: startingUrl || value,
      error: error && error.name === "AbortError"
        ? "Timed out while checking the intranet link."
        : "The intranet link could not be checked with your current browser access."
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkWithCurrentPageSession(report, value, timeoutMs = 8000) {
  if (!report) return null;
  const destinationSafety = remoteDestinationSafety(value);
  if (!destinationSafety.allowed) return safetyBlockedResult(value, destinationSafety.reason);
  if (authenticatedActionUrl(value)) return safetyBlockedResult(value, "The authenticated destination looks like an action and was not requested.");
  const sourceUrl = report.page && report.page.url ? report.page.url : "";
  const cmsLiteEditorSession = Boolean(
    report.settings &&
    report.settings.editorMode &&
    cmsLiteEditorSource(sourceUrl) &&
    hostnameFor(value) === "cmslite.gov.bc.ca"
  );
  const publicQaPageSession = Boolean(
    hostnameFor(sourceUrl) === "www2.qa.gov.bc.ca" &&
    publicQaCmsDestination(value)
  );
  if (!trustedSessionHost(value) && !cmsLiteEditorSession && !publicQaPageSession) return null;
  if (!sourceUrl || urlOrigin(sourceUrl) !== urlOrigin(value)) return null;
  const tab = await currentReviewTab().catch(() => null);
  if (!tab || !tab.id || urlOrigin(tab.url || "") !== urlOrigin(value)) return null;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [value, timeoutMs],
      func: async (targetUrl, timeoutValue) => {
        const startingOrigin = location.origin;
        let parsed;
        try { parsed = new URL(targetUrl, location.href); } catch (_) { return null; }
        if (parsed.origin !== startingOrigin) return null;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutValue);
        try {
          const response = await fetch(parsed.href, {
            method: "HEAD",
            credentials: "include",
            redirect: "follow",
            cache: "no-store",
            signal: controller.signal
          });
          const finalUrl = response.url || parsed.href;
          let finalOrigin = "";
          try { finalOrigin = new URL(finalUrl).origin; } catch (_) {}
          if (finalOrigin && finalOrigin !== startingOrigin) {
            return { status: "session-unverified", checkedUrl: parsed.href, finalUrl: parsed.href, redirected: true, error: "This link left the signed-in website, so the final page could not be confirmed." };
          }
          const contentRange = response.headers.get("content-range") || "";
          const totalFromRange = (contentRange.match(/\/(\d+)$/) || [])[1] || "";
          const base = {
            code: response.status,
            checkedUrl: parsed.href,
            finalUrl,
            redirected: Boolean(response.redirected),
            accessMode: "current-session",
            headers: {
              contentLength: totalFromRange || response.headers.get("content-length") || "",
              contentType: response.headers.get("content-type") || "",
              contentDisposition: response.headers.get("content-disposition") || ""
            }
          };
          if (response.status === 404 || response.status === 410) return { ...base, status: "broken" };
          if (response.status >= 500) return { ...base, status: "server" };
          if ([401, 403].includes(response.status)) return { ...base, status: "session-unverified", error: "This link returned an access error. Open it to check whether you have access." };
          if (response.status === 429) return { ...base, status: "rate-limited" };
          if ([405, 501].includes(response.status)) return { ...base, status: "session-unverified", error: "This site could not be checked automatically. Open the link to confirm it." };
          if (response.status >= 400) return { ...base, status: "client-error" };
          if (response.status >= 200 && response.status < 300) return { ...base, status: "ok" };
          return { ...base, status: "session-unverified", error: "The site returned a response the checker could not confirm." };
        } catch (error) {
          return {
            status: "session-unverified",
            checkedUrl: parsed.href,
            finalUrl: parsed.href,
            error: error && error.name === "AbortError" ? "Timed out while checking this link." : "This link could not be fully checked from the current page."
          };
        } finally { clearTimeout(timeout); }
      }
    });
    return results && results[0] ? results[0].result : null;
  } catch (_) {
    return null;
  }
}

function managedAssetNotFoundText(value) {
  const text = normalizeSpace(value);
  return /\bAsset Not Found\b/i.test(text) || /\bThe asset cannot be found\b/i.test(text);
}

async function checkCmsLiteManagedAssetSource(report, value, timeoutMs = 10000) {
  if (!cmsLiteManagedAssetGuid(value)) return null;
  if (!(report && report.settings && report.settings.editorMode)) return null;
  const sourceUrl = report.page && report.page.url ? report.page.url : "";
  if (!cmsLiteEditorSource(sourceUrl) || urlOrigin(sourceUrl) !== urlOrigin(value)) return null;
  const tab = await currentReviewTab().catch(() => null);
  if (!tab || !tab.id || urlOrigin(tab.url || "") !== urlOrigin(value)) return null;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [value, timeoutMs],
      func: async (targetUrl, timeoutValue) => {
        let parsed;
        try { parsed = new URL(targetUrl, location.href); } catch (_) { return null; }
        if (parsed.origin !== location.origin || parsed.hostname.toLowerCase() !== "cmslite.gov.bc.ca") return null;
        if (!/^\/assets\/download\/[a-f0-9]{32}(?:\/)?$/i.test(parsed.pathname)) return null;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutValue);
        try {
          // CMS Lite does not support HEAD on this route. A narrowly scoped,
          // same-origin ranged GET is safe for this known download endpoint and
          // lets the checker see the resolved /assets/gov or /assets/intranet path.
          const response = await fetch(parsed.href, {
            method: "GET",
            headers: { Range: "bytes=0-0" },
            credentials: "include",
            redirect: "follow",
            cache: "no-store",
            signal: controller.signal
          });
          const finalUrl = response.url || parsed.href;
          let finalOrigin = "";
          try { finalOrigin = new URL(finalUrl).origin; } catch (_) {}
          const base = {
            code: response.status,
            checkedUrl: parsed.href,
            finalUrl,
            redirected: Boolean(response.redirected),
            accessMode: "current-session",
            headers: {
              contentLength: response.headers.get("content-length") || "",
              contentType: response.headers.get("content-type") || "",
              contentDisposition: response.headers.get("content-disposition") || ""
            }
          };
          if (response.body && response.body.cancel) response.body.cancel().catch(() => {});
          if (finalOrigin && finalOrigin !== location.origin) {
            return { ...base, status: "session-unverified", finalUrl: parsed.href, error: "The CMS Lite asset redirected outside CMS Lite, so it could not be confirmed." };
          }
          if (response.status === 404 || response.status === 410) return { ...base, status: "broken" };
          if (response.status >= 500) return { ...base, status: "server" };
          if ([401, 403].includes(response.status)) return { ...base, status: "session-unverified", error: "The CMS Lite asset could not be accessed from the open editor." };
          if (response.status === 429) return { ...base, status: "rate-limited" };
          if (response.status >= 400) return { ...base, status: "client-error" };
          if (response.status >= 200 && response.status < 300) return { ...base, status: "ok" };
          return { ...base, status: "session-unverified", error: "CMS Lite returned a response the checker could not confirm for this asset." };
        } catch (error) {
          return {
            status: "session-unverified",
            checkedUrl: parsed.href,
            finalUrl: parsed.href,
            error: error && error.name === "AbortError" ? "Timed out while checking the CMS Lite asset." : "The CMS Lite asset could not be checked from the open editor."
          };
        } finally { clearTimeout(timeout); }
      }
    });
    return results && results[0] ? results[0].result : null;
  } catch (_) {
    return null;
  }
}

function knownManagedAssetEnvironmentUrl(value) {
  try {
    const url = new URL(value);
    const allowedHosts = new Set([
      "www2.qa.gov.bc.ca",
      "www2.gov.bc.ca",
      "intranet.qa.gov.bc.ca",
      "intranet.gov.bc.ca"
    ]);
    return allowedHosts.has(url.hostname.toLowerCase()) && /^\/assets\/download\/[a-f0-9]{32}(?:\/)?$/i.test(url.pathname);
  } catch (_) { return false; }
}

async function checkManagedAssetEnvironmentUrl(value, family, timeoutMs = 10000) {
  const sessionAware = family === "intranet";
  const result = await checkRemoteUrl(value, timeoutMs, { sessionAware });
  if (!result || result.status !== "ok") return result;

  const response = result.response;
  const contentType = String(
    response && response.headers ? response.headers.get("content-type") || "" : ""
  ).toLowerCase();
  if (!contentType.includes("text/html") || !knownManagedAssetEnvironmentUrl(value)) return result;

  // Managed asset download routes are expected to return files. B.C. government
  // publishing can return an HTML "Asset Not Found" page with a successful HTTP
  // status, so inspect only this known asset route when the HEAD response is HTML.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(value, {
      method: "GET",
      headers: { Range: "bytes=0-8191" },
      credentials: sessionAware ? "include" : "omit",
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store"
    });
    const finalUrl = response.url || value;
    if (response.redirected && looksLikeAuthenticationRedirect(value, finalUrl)) {
      return { status: "sign-in", checkedUrl: value, finalUrl: value, redirected: true, error: sessionVerificationMessage("sign-in") };
    }
    const body = await response.text();
    if (managedAssetNotFoundText(body)) {
      return {
        status: "broken",
        code: response.status,
        checkedUrl: value,
        finalUrl,
        redirected: Boolean(response.redirected),
        error: "The asset returned the B.C. government ‘Asset Not Found’ page."
      };
    }
    return result;
  } catch (_) {
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyOneAsset(report, asset) {
  if (!/^https?:/i.test(asset.href || "")) {
    asset.verificationStatus = "unsupported";
    return;
  }

  const liveEquivalent =
    qaProductionEquivalent(asset.href);

  const checkUrl =
    liveEquivalent || asset.href;

  asset.checkedUrl = checkUrl;
  asset.liveEquivalent = liveEquivalent || "";

  const pageSessionResult = cmsLiteManagedAssetGuid(checkUrl)
    ? await checkCmsLiteManagedAssetSource(report, checkUrl, 8000)
    : await checkWithCurrentPageSession(report, checkUrl, 8000);

  const result =
    pageSessionResult || await checkRemoteUrl(checkUrl, 8000, { sessionAware: trustedSessionHost(checkUrl) });

  asset.finalUrl =
    result.finalUrl || checkUrl;

  asset.verificationError =
    result.error || "";

  if (result.status !== "ok") {
    if (
      liveEquivalent &&
      result.status === "broken"
    ) {
      asset.verificationStatus =
        "live-not-found";
    } else if (
      result.status === "sign-in"
    ) {
      asset.verificationStatus =
        "sign-in-required";
    } else if (
      result.status === "permission"
    ) {
      asset.verificationStatus =
        "permission-unavailable";
    } else if (
      result.status === "redirect"
    ) {
      asset.verificationStatus =
        "redirected";
    } else if (
      result.status === "server"
    ) {
      asset.verificationStatus =
        "server-error";
    } else if (
      result.status === "restricted" ||
      result.status === "session-unverified"
    ) {
      asset.verificationStatus =
        result.status === "session-unverified" ? "current-access-unverified" : "restricted";
    } else if (
      result.status === "rate-limited"
    ) {
      asset.verificationStatus =
        "rate-limited";
    } else if (
      result.status === "client-error"
    ) {
      asset.verificationStatus =
        "client-error";
    } else {
      asset.verificationStatus =
        result.error === "Timed out"
          ? "timed-out"
          : "unavailable";
    }

    return;
  }

  const response = result.response;

  const lengthHeader =
    result.headers && result.headers.contentLength
      ? result.headers.contentLength
      : response && response.headers
        ? response.headers.get("content-length")
        : "";

  const actualSize =
    lengthHeader &&
    /^\d+$/.test(lengthHeader)
      ? Number(lengthHeader)
      : null;

  const actualType = mimeAssetType(
    result.headers && result.headers.contentType
      ? result.headers.contentType
      : response && response.headers
        ? response.headers.get("content-type")
        : "",
    result.headers && result.headers.contentDisposition
      ? result.headers.contentDisposition
      : response && response.headers
        ? response.headers.get(
            "content-disposition"
          )
        : "",
    result.finalUrl || checkUrl
  );

  asset.actualSize = actualSize;
  asset.actualType = actualType;

  asset.verificationStatus =
    liveEquivalent
      ? actualSize === null
        ? "live-type-verified"
        : "live-verified"
      : actualSize === null
        ? "type-verified"
        : "verified";

  if (
    actualType &&
    !asset.validLabel &&
    asset.labelStatus === "missing-label"
  ) {
    appendUniqueFinding(
      report,
      globalThis.BCWebStyleGuideChecker
        .createExternalFinding(
          "file-link-label",
          report.page.url,
          {
            id:
              `file-link-label-${asset.selector}`,

            selector:
              asset.selector,

            editorRegion:
              Number(asset.editorRegion) ||
              null,

            editorSource:
              asset.editorSource || null,

            location:
              asset.location || "Page",

            evidence:
              `${asset.text || asset.href} → ` +
              `${actualType}` +
              `${
                actualSize === null
                  ? ""
                  : `, ${displayBytes(actualSize)}`
              }` +
              `${
                liveEquivalent
                  ? " · checked live version"
                  : ""
              }`
          }
        )
    );
  }

  if (
    asset.declaredType &&
    actualType &&
    asset.declaredType !== actualType
  ) {
    appendUniqueFinding(
      report,
      globalThis.BCWebStyleGuideChecker
        .createExternalFinding(
          "file-link-type-mismatch",
          report.page.url,
          {
            id:
              `file-link-type-${asset.selector}`,

            selector:
              asset.selector,

            editorRegion:
              Number(asset.editorRegion) ||
              null,

            editorSource:
              asset.editorSource || null,

            location:
              asset.location || "Page",

            evidence:
              `Link says ${asset.declaredType}; ` +
              `server returned ${actualType}: ` +
              `${asset.text || asset.href}` +
              `${
                liveEquivalent
                  ? " · checked live version"
                  : ""
              }`
          }
        )
    );
  }

  const labelledSize =
    declaredBytes(asset);

  if (
    labelledSize !== null &&
    actualSize !== null
  ) {
    const tolerance =
      Math.max(
        2048,
        actualSize * 0.04
      );

    if (
      Math.abs(
        labelledSize - actualSize
      ) > tolerance
    ) {
      appendUniqueFinding(
        report,
        globalThis.BCWebStyleGuideChecker
          .createExternalFinding(
            "file-link-size-mismatch",
            report.page.url,
            {
              id:
                `file-link-size-${asset.selector}`,

              selector:
                asset.selector,

              editorRegion:
                Number(asset.editorRegion) ||
                null,

              editorSource:
                asset.editorSource || null,

              location:
                asset.location || "Page",

              evidence:
                `Link says ` +
                `${asset.declaredSize}` +
                `${asset.declaredUnit}; ` +
                `server returned about ` +
                `${displayBytes(actualSize)}: ` +
                `${asset.text || asset.href}` +
                `${
                  liveEquivalent
                    ? " · checked live version"
                    : ""
                }`
            }
          )
      );
    }
  }
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

function publicQaLiveRemoteResult(link, qaResult, liveResult) {
  const qaUrl = link.qaUrl || link.href;
  const liveUrl = link.liveUrl || link.checkUrl || link.href;
  const base = {
    code: "",
    qaStatus: qaResult.status,
    qaCode: qaResult.code || "",
    qaCheckedUrl: qaUrl,
    liveStatus: liveResult.status,
    liveCode: liveResult.code || "",
    liveCheckedUrl: liveUrl,
    checkedUrl: qaUrl,
    finalUrl: qaResult.finalUrl || qaUrl
  };
  if (qaResult.status === "ok" && liveResult.status === "ok") {
    return {
      ...base,
      status: "ok",
      combinedStatus: "qa-live-ok",
      error: "Available in QA and live."
    };
  }
  if (qaResult.status === "ok" && liveResult.status === "broken") {
    return {
      ...base,
      status: "broken",
      combinedStatus: "qa-only",
      error: "Works in QA. The live version was not found."
    };
  }
  if (qaResult.status === "broken" && liveResult.status === "ok") {
    return {
      ...base,
      status: "broken",
      combinedStatus: "live-only",
      error: "Works live. The QA version was not found."
    };
  }
  if (qaResult.status === "broken" && liveResult.status === "broken") {
    return {
      ...base,
      status: "broken",
      error: "The link was not found in QA or live."
    };
  }
  if (qaResult.status === "ok") {
    return {
      ...base,
      status: liveResult.status,
      combinedStatus: "qa-live-unverified",
      error: `Works in QA. The live version could not be checked.${liveResult.error ? ` ${liveResult.error}` : ""}`
    };
  }
  if (liveResult.status === "ok") {
    return {
      ...base,
      status: qaResult.status === "session-unverified" ? "session-unverified" : "unavailable",
      error: `Works live. The QA version could not be checked.${qaResult.error ? ` ${qaResult.error}` : ""}`
    };
  }
  const priority = ["server", "client-error", "rate-limited", "restricted", "redirect", "sign-in", "permission", "session-unverified", "unavailable"];
  const status = priority.find(candidate => [qaResult.status, liveResult.status].includes(candidate)) || "unavailable";
  return {
    ...base,
    status,
    error: `QA and live could not both be checked.${qaResult.error ? ` QA: ${qaResult.error}` : ""}${liveResult.error ? ` Live: ${liveResult.error}` : ""}`
  };
}

function combinedPublicQaResult(link, qaResult, liveResult) {
  return linkResultFromRemote(link, publicQaLiveRemoteResult(link, qaResult, liveResult));
}

function combinedIntranetQaResult(link, qaResult, liveResult) {
  if (!qaResult || qaResult.status !== "ok") {
    return linkResultFromRemote({ ...link, qaLive: false }, {
      ...qaResult,
      checkedUrl: link.href,
      error: qaResult && qaResult.error ? qaResult.error : "The QA version could not be checked."
    });
  }
  const base = {
    qaStatus: "ok",
    qaCode: qaResult.code || "",
    qaCheckedUrl: link.href,
    liveStatus: liveResult.status,
    liveCode: liveResult.code || "",
    liveCheckedUrl: link.checkUrl,
    checkedUrl: link.href,
    finalUrl: qaResult.finalUrl || link.href,
    accessMode: qaResult.accessMode || "current-session"
  };
  if (liveResult.status === "ok") {
    return linkResultFromRemote(link, {
      ...base,
      status: "ok",
      combinedStatus: "qa-live-ok",
      error: "Available in QA and live. Live was verified using your current browser access."
    });
  }
  if (liveResult.status === "broken") {
    return linkResultFromRemote(link, {
      ...base,
      status: "broken",
      combinedStatus: "qa-only",
      code: "",
      error: "Works in QA. The live intranet version was not found."
    });
  }
  return linkResultFromRemote(link, {
    ...base,
    status: liveResult.status,
    combinedStatus: "qa-live-unverified",
    code: "",
    error: `Works in QA. The live intranet version could not be checked.${liveResult.error ? ` ${liveResult.error}` : ""}`
  });
}

async function checkCmsLiteManagedAssetLink(report, link) {
  const cmsResult = await checkCmsLiteManagedAssetSource(report, link.href, 10000);
  if (!cmsResult || cmsResult.status !== "ok") {
    const fallback = cmsResult || {
      status: "session-unverified",
      checkedUrl: link.href,
      finalUrl: link.href,
      error: "The asset could not be checked from the open CMS Lite editor."
    };
    return linkResultFromRemote(link, fallback);
  }

  const family = link.cmsLiteAssetFamily || cmsLiteAssetPublishingFamily(cmsResult.finalUrl || link.href);
  const environments = cmsLiteAssetEnvironmentUrls(link.cmsLiteAssetGuid, family);
  const cmsBase = {
    cmsStatus: "ok",
    cmsCode: cmsResult.code || "",
    cmsCheckedUrl: link.href,
    checkedUrl: link.href,
    finalUrl: cmsResult.finalUrl || link.href,
    accessMode: cmsResult.accessMode || "current-session"
  };

  if (!family || !environments) {
    return linkResultFromRemote(link, {
      ...cmsBase,
      status: "session-unverified",
      combinedStatus: "cms-publishing-unverified",
      code: "",
      error: "The asset works in CMS Lite, but the checker could not tell whether it belongs to the public site or intranet."
    });
  }

  const qaResult = await checkManagedAssetEnvironmentUrl(environments.qa, family, 10000);
  const liveResult = await checkManagedAssetEnvironmentUrl(environments.live, family, 10000);
  const base = {
    ...cmsBase,
    qaStatus: qaResult && qaResult.status ? qaResult.status : "unavailable",
    qaCode: qaResult && qaResult.code ? qaResult.code : "",
    qaCheckedUrl: environments.qa,
    liveStatus: liveResult && liveResult.status ? liveResult.status : "unavailable",
    liveCode: liveResult && liveResult.code ? liveResult.code : "",
    liveCheckedUrl: environments.live
  };

  if (qaResult.status === "ok" && liveResult.status === "ok") {
    return linkResultFromRemote(link, {
      ...base,
      status: "ok",
      combinedStatus: "qa-live-ok",
      code: "",
      error: "Available in QA and live."
    });
  }

  if (qaResult.status === "ok" && liveResult.status === "broken") {
    return linkResultFromRemote(link, {
      ...base,
      status: "broken",
      combinedStatus: "qa-only",
      code: "",
      error: "Works in CMS Lite and QA. The live asset was not found."
    });
  }

  if (qaResult.status === "broken" && liveResult.status === "ok") {
    return linkResultFromRemote(link, {
      ...base,
      status: "ok",
      combinedStatus: "live-only",
      code: "",
      error: "Works in CMS Lite and live. The QA asset was not found."
    });
  }

  if (qaResult.status === "broken" && liveResult.status === "broken") {
    return linkResultFromRemote(link, {
      ...base,
      status: "broken",
      combinedStatus: "cms-only",
      code: "",
      error: "Works in CMS Lite, but the asset was not found in QA or live."
    });
  }

  if (liveResult.status === "ok") {
    return linkResultFromRemote(link, {
      ...base,
      status: "ok",
      combinedStatus: "live-ok",
      code: "",
      error: `Works in CMS Lite and live. The QA asset could not be checked.${qaResult.error ? ` ${qaResult.error}` : ""}`
    });
  }

  if (qaResult.status === "ok") {
    return linkResultFromRemote(link, {
      ...base,
      status: liveResult.status,
      combinedStatus: "qa-live-unverified",
      code: "",
      error: `Works in CMS Lite and QA. The live asset could not be checked.${liveResult.error ? ` ${liveResult.error}` : ""}`
    });
  }

  return linkResultFromRemote(link, {
    ...base,
    status: "session-unverified",
    combinedStatus: "cms-publishing-unverified",
    code: "",
    error: `Works in CMS Lite, but QA and live could not both be checked.${qaResult.error ? ` QA: ${qaResult.error}` : ""}${liveResult.error ? ` Live: ${liveResult.error}` : ""}`
  });
}

async function checkOneHttpLink(report, link) {
  if (link.safetyBlocked) return linkResultFromRemote(link, safetyBlockedResult(link.href, link.safetyMessage));
  if (link.cmsLiteAssetGuid) return checkCmsLiteManagedAssetLink(report, link);
  if (cmsLiteEditorHomeLink(report, link.href)) {
    return linkResultFromRemote(link, {
      status: "ok",
      combinedStatus: "session-ok",
      checkedUrl: link.href,
      finalUrl: link.href,
      accessMode: "current-session"
    });
  }
  if (link.signInRequired) return linkResultFromRemote(link, { status: "sign-in", checkedUrl: link.checkUrl || link.href, finalUrl: link.checkUrl || link.href, error: sessionVerificationMessage("sign-in") });

  if (link.qaFamily === "public" && link.qaLive) {
    const qaResult = await checkPublicQaWithCurrentAccess(
      report,
      link.qaUrl || link.href,
      10000,
      Boolean(link.publicQaPair)
    );
    const liveResult = await checkRemoteUrl(link.liveUrl || link.checkUrl, 10000, { sessionAware: false });
    return combinedPublicQaResult(link, qaResult, liveResult);
  }

  if (link.qaFamily === "intranet" && link.qaLive) {
    const qaResult = await checkIntranetContentIdResolver(report, link.href, 10000)
      || await checkWithCurrentPageSession(report, link.href, 10000)
      || await checkRemoteUrl(link.href, 10000, { sessionAware: true });
    if (!qaResult || qaResult.status !== "ok") return combinedIntranetQaResult(link, qaResult || { status: "session-unverified", checkedUrl: link.href, finalUrl: link.href, error: sessionVerificationMessage("unavailable") }, { status: "unavailable" });
    const liveResult = await checkIntranetContentIdResolver(report, link.checkUrl, 10000)
      || await checkRemoteUrl(link.checkUrl, 10000, { sessionAware: true });
    return combinedIntranetQaResult(link, qaResult, liveResult);
  }

  const legacyIntranetResult = await checkIntranetContentIdResolver(report, link.checkUrl || link.href, 10000);
  const pageSessionResult = legacyIntranetResult || await checkWithCurrentPageSession(report, link.checkUrl || link.href, 10000);
  const result = pageSessionResult || await checkRemoteUrl(link.checkUrl || link.href, 10000, { sessionAware: Boolean(link.sessionAware) });
  return linkResultFromRemote(link, result);
}

function summarizeLinkCheck(totalFound, results) {
  const count = status => results.filter(result => result.status === status).length;
  return {
    totalFound,
    completed: results.length,
    okay: count("ok") + count("live-ok") + count("session-ok") + count("qa-live-ok"),
    liveWorking: count("live-ok") + count("qa-live-ok"),
    sessionVerified: count("session-ok"),
    qaOnly: count("qa-only"),
    liveOnly: count("live-only"),
    cmsOnly: count("cms-only"),
    cmsPublishingUnverified: count("cms-publishing-unverified"),
    qaLiveUnverified: count("qa-live-unverified"),
    sessionUnverified: count("session-unverified"),
    broken: count("broken"),
    liveNotFound: count("live-not-found"),
    redirects: count("redirect"),
    signInRequired: count("sign-in"),
    serverErrors: count("server"),
    permissionRequired: count("permission"),
    restricted: count("restricted"),
    rateLimited: count("rate-limited"),
    clientErrors: count("client-error"),
    unavailable: count("unavailable"),
    safetyBlocked: count("safety-blocked"),
    pending: Math.max(0, totalFound - results.length)
  };
}

function waitForLinkCheckResume() {
  if (!state.linkCheckPaused) return Promise.resolve();
  return new Promise(resolve => { state.linkCheckWaiters.push(resolve); });
}

function addHttpLinkFindings(report, results) {
  report.issues = report.issues.filter(
    finding =>
      ![
        "broken-http-link",
        "http-link-server-error"
      ].includes(finding.ruleId)
  );

  results.forEach(result => {
    const editorRegion =
      Number(result.link.editorRegion) ||
      null;
    const editorSource =
      result.link.editorSource || null;
    const location =
      result.link.location ||
      (editorSource && editorSource.location) ||
      (editorRegion ? `Editor region ${editorRegion}` : "Page");

    if (result.status === "broken") {
      appendUniqueFinding(
        report,
        globalThis.BCWebStyleGuideChecker
          .createExternalFinding(
            "broken-http-link",
            report.page.url,
            {
              id:
                `broken-http-${result.link.selector}`,

              selector:
                result.link.selector,

              editorRegion,

              editorSource,

              location,

              evidence:
                `${result.link.text} → ` +
                `${result.link.href} ` +
                `(HTTP ${result.code})`,

              diagnostics:
                result.finalUrl &&
                result.finalUrl !==
                  result.link.href
                  ? [
                      `The request ended at ${result.finalUrl}.`
                    ]
                  : []
            }
          )
      );
    }

    if (result.status === "server") {
      appendUniqueFinding(
        report,
        globalThis.BCWebStyleGuideChecker
          .createExternalFinding(
            "http-link-server-error",
            report.page.url,
            {
              id:
                `server-http-${result.link.selector}`,

              selector:
                result.link.selector,

              editorRegion,

              editorSource,

              location,

              evidence:
                `${result.link.text} → ` +
                `${result.link.href} ` +
                `(HTTP ${result.code})` +
                `${
                  result.qaLive
                    ? " · checked live version"
                    : ""
                }`
            }
          )
      );
    }
  });

  const severityOrder = {
    fix: 0,
    check: 1,
    review: 2
  };

  report.issues.sort(
    (first, second) =>
      severityOrder[first.severity] -
        severityOrder[second.severity] ||
      first.category.localeCompare(
        second.category
      ) ||
      first.title.localeCompare(
        second.title
      )
  );
}

async function checkHttpLinks(options = {}) {
  if (!await ensurePreviewCanRun()) return null;
  const report = state.activeReport;
  if (!report || !report.pageDetails || state.linkCheckRunning) return null;
  const links = remoteLinksForReport(report);
  if (!links.length) {
    report.linkCheck = { state: "complete", startedAt: new Date().toISOString(), checkedAt: new Date().toISOString(), results: [], ...summarizeLinkCheck(0, []) };
    await storeReport(report).catch(() => {});
    if (!options.quiet) showToast("No web links need a network check on this page.");
    return report.linkCheck;
  }
  const origins = Array.from(new Set(links
    .filter(link => !link.signInRequired)
    .flatMap(link => permissionOriginsForPreparedLink(link))
    .filter(Boolean)));
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
    if (!options.quiet) renderPageDetails("links");
    if (!options.quiet) showToast(`Website access was declined. ${links.length} link${links.length === 1 ? " was" : "s were"} not checked.`);
    return report.linkCheck;
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
  if (!options.quiet) renderPageDetails("links");
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
        if (!options.quiet && state.activeReport === report && state.reviewView === "details") renderPageDetails("links");
        if (options.quiet && elements["export-dialog"] && elements["export-dialog"].open) updateCurrentExportDialog();
      }
      if (results.length % 20 === 0) await storeReport(report).catch(() => { });
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
  await storeReport(report).catch(() => { });
  if (state.activeReport === report) renderCurrentReport();
  if (!options.quiet) {
    const categories = linkResultCategoryCounts(results);
    showToast(wasStopped
      ? `Link check stopped after ${report.linkCheck.completed} of ${report.linkCheck.totalFound}.`
      : `Link check complete: ${categories.problems || 0} problems, ${categories.review || 0} need review, ${categories.working || 0} working.`);
  }
  return report.linkCheck;
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
  return Array.from(new Set(remoteLinksForReport(report)
    .flatMap(permissionOriginsForPreparedLink)
    .filter(pattern => {
      try { return new URL(pattern.replace(/\*$/, "")).origin !== pageOrigin; } catch (_) { return true; }
    })));
}

async function openPermissionDialog() {
  const origins = await grantedOptionalWebsiteOrigins();
  const broad = origins.some(origin => ["http://*/*", "https://*/*"].includes(origin));
  elements["permission-status"].textContent = broad
    ? "Access from an earlier version is still allowed for all websites. You can remove it below."
    : origins.length
      ? `Website access is currently allowed for ${origins.length} site${origins.length === 1 ? "" : "s"}.`
      : "No optional website access is currently saved.";
  elements["permission-linked"].textContent = state.activeReport ? "Allow linked sites on this page" : "Allow the current website";
  elements["permission-dialog"].showModal();
}

async function grantedOptionalWebsiteOrigins() {
  const granted = await chrome.permissions.getAll().catch(() => ({ origins: [] }));
  const required = new Set(chrome.runtime.getManifest().host_permissions || []);
  return Array.from(new Set((granted.origins || []).filter(origin => /^https?:\/\//i.test(origin) && !required.has(origin))));
}

async function requestLinkedPermissions() {
  let origins = state.activeReport ? linkedOriginPatterns(state.activeReport) : [];
  if (!state.activeReport) {
    const tab = await currentReviewTab();
    if (tab && isScannableUrl(tab.url || "")) origins = [originPattern(tab.url)];
  }
  if (!origins.length) { elements["permission-status"].textContent = state.activeReport ? "This page has no external web links." : "Open a regular website first."; return; }
  const granted = await chrome.permissions.request({ origins }).catch(() => false);
  elements["permission-status"].textContent = granted ? `Website access allowed for ${origins.length} linked site${origins.length === 1 ? "" : "s"}.` : "Website access was not allowed.";
}

async function revokeAllPermissions() {
  const origins = await grantedOptionalWebsiteOrigins();
  if (!origins.length) {
    elements["permission-status"].textContent = "No optional website access is currently saved.";
    return;
  }
  const removed = await chrome.permissions.remove({ origins }).catch(() => false);
  elements["permission-status"].textContent = removed ? "Saved website access was removed." : "Website access could not be removed.";
}

function readableScanError(error) {
  const message = error && error.message ? error.message : String(error);
  if (/Cannot access contents of url|Missing host permission|extensions gallery|cannot be scripted/i.test(message)) {
    return "This protected page cannot be checked. Open a regular web page and try again.";
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
    collapsed: Array.from(state.collapsedFindingGroups),
    skippedRuleIds: Array.from(state.skippedRuleIds),
    skippedFingerprints: Array.from(state.skippedFingerprints),
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
  elements["sort-order"].value = saved.sortOrder === "page" ? "page" : "type";
  elements["important-filter"].checked = Boolean(saved.important);
  state.collapsedFindingGroups = new Set(saved.collapsed || []);
  state.skippedRuleIds = new Set(saved.skippedRuleIds || []);
  state.skippedFingerprints = new Set(saved.skippedFingerprints || []);
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
  if (!await ensurePreviewCanRun()) return;
  const options = suppliedOptions && suppliedOptions.preserveReview ? suppliedOptions : {};
  const preserved = options.preserveReview ? captureReviewContext() : null;
  showCurrentState("loading");
  elements["scan-settings"].hidden = true;
  elements["cache-note"].textContent = "";
  try {
    state.activeTab = await currentReviewTab();
    if (!state.activeTab || !state.activeTab.id) throw new Error("No active browser tab was found.");
    if (!isScannableUrl(state.activeTab.url)) throw new Error(unsupportedScanUrlMessage(state.activeTab.url));
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
    await saveNavigation().catch(() => { });
    updateReturnButton();
    elements["status-filter"].value = preserved ? preserved.status : "open";
    elements["severity-filter"].value = preserved ? preserved.severity : "all";
    elements["category-filter"].value = preserved ? preserved.category : "all";
    elements["sort-order"].value = preserved && preserved.sortOrder === "page" ? "page" : "type";
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
    state.collapsedFindingGroups = new Set(preserved ? preserved.collapsed : []);
    state.skippedRuleIds = new Set();
    state.skippedFingerprints = new Set();
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
    : report.settings.scope === "whole" ? "Whole page" : report.settings.profile === "cms-lite" ? "Editable content" : "Page content";
  const excludedChecks = excludedOptionalCheckLabels(report);
  elements["scan-context-details"].textContent = `${report.settings.profileLabel} · ${scopeLabel} · ${formatDate(report.scannedAt)}${excludedChecks.length ? ` · Excluded: ${excludedChecks.join(", ")}` : ""}`;

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
    else if (group.findings.some(finding => finding.contrast && finding.contrast.signature)) group.findings.sort((first, second) =>
      String(first.contrast && first.contrast.signature || "").localeCompare(String(second.contrast && second.contrast.signature || ""))
      || (first.pageOrder ?? Number.MAX_SAFE_INTEGER) - (second.pageOrder ?? Number.MAX_SAFE_INTEGER));
    return group;
  }).sort((first, second) => pageSort
    ? first.pageOrder - second.pageOrder || first.title.localeCompare(second.title)
    : (severityOrder[first.severity] ?? 9) - (severityOrder[second.severity] ?? 9)
    || first.category.localeCompare(second.category)
    || first.title.localeCompare(second.title));
}

function orderedReviewFindings(items = filteredFindings()) {
  const pageSort = elements["sort-order"] && elements["sort-order"].value === "page";
  if (pageSort) return items.slice().sort((first, second) =>
    (first.pageOrder ?? Number.MAX_SAFE_INTEGER) - (second.pageOrder ?? Number.MAX_SAFE_INTEGER)
    || (first.matchIndex ?? Number.MAX_SAFE_INTEGER) - (second.matchIndex ?? Number.MAX_SAFE_INTEGER)
    || first.title.localeCompare(second.title));
  return groupedFindingTypes(items).flatMap(group => group.findings);
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
  const omitted = omittedFindingsMatchingCurrentFilters(state.activeReport);
  const issueTypeCount = new Set([...groups.map(group => group.ruleId), ...truncatedRulesMatchingCurrentFilters(state.activeReport).map(item => item.ruleId)]).size;
  elements["showing-count"].textContent = omitted
    ? `${issueTypeCount} issue type${issueTypeCount === 1 ? "" : "s"} · ${occurrences} available · ${occurrences + omitted} detected`
    : `${issueTypeCount} issue type${issueTypeCount === 1 ? "" : "s"} · ${occurrences} finding${occurrences === 1 ? "" : "s"}`;
  const truncated = truncatedFindingRules(state.activeReport);
  elements["finding-coverage"].hidden = truncated.length === 0;
  elements["finding-coverage"].innerHTML = truncated.length
    ? `<strong>Some findings are not displayed.</strong><span>${escapeHtml(findingCoverageText(state.activeReport))} Counts and exports identify the incomplete issue types.</span>`
    : "";
  renderReviewLauncher(groups);
  const linkCheck = state.activeReport && state.activeReport.linkCheck;
  const linkCategories = linkCheck ? linkResultCategoryCounts(linkCheck.results) : null;
  elements["link-check-shortcut-status"].textContent = linkCheck
    ? `${linkCheck.completed || 0} checked · ${linkCategories.problems || 0} problems · ${linkCategories.review || 0} need review · ${linkCategories.working || 0} working`
    : "Not checked · optional website access";
  if (!items.length) {
    const counts = reportCounts(state.activeReport);
    const openCount = counts.fix + counts.check + counts.review;
    const limitedOnly = omitted > 0;
    elements.findings.innerHTML = limitedOnly
      ? `<div class="empty-state"><strong>${omitted} matching finding${omitted === 1 ? " is" : "s are"} beyond the display limit.</strong><br>The detected total remains open and is included in summary counts. Exact locations are unavailable for findings beyond the safety limit.</div>`
      : `<div class="empty-state"><strong>${openCount ? "No findings match these filters." : "No open findings were detected."}</strong><br>${openCount ? "Clear a filter to see the other findings." : "Manual review may still be useful."}</div>`;
    return;
  }
  elements.findings.innerHTML = groups.map(group => `
    <button class="issue-row ${escapeHtml(group.severity)}${group.ruleId === state.selectedRuleId ? " is-selected" : ""}${state.skippedRuleIds.has(group.ruleId) ? " is-skipped" : ""}" type="button" data-rule-id="${escapeHtml(group.ruleId)}">
      <span>
        <span class="issue-row-title">${escapeHtml(group.title)}</span>
        <span class="issue-row-meta"><span>${escapeHtml(sentenceLabel(group.severity))}</span><span aria-hidden="true">·</span><span>${escapeHtml(group.category)}</span>${state.skippedRuleIds.has(group.ruleId) ? `<span aria-label="Some findings skipped for this review">· Some skipped for this review</span>` : ""}${group.important || group.notes ? `<span class="issue-row-icons"><span aria-label="${group.important ? "Important" : ""}">${group.important ? "★" : ""}</span><span aria-label="${group.notes ? "Has audit note" : ""}">${group.notes ? "●" : ""}</span></span>` : ""}</span>
      </span>
      <span class="issue-row-count" aria-label="${group.occurrences} findings">${group.occurrences}</span>
    </button>`).join("");
}

function renderReviewLauncher(groups) {
  const ordered = orderedReviewFindings();
  const next = ordered.find(finding => !state.skippedFingerprints.has(finding.fingerprint)) || null;
  const skipped = ordered.filter(finding => state.skippedFingerprints.has(finding.fingerprint));
  const skippedFindings = skipped.reduce((total, finding) => total + findingAmount(finding), 0);
  const skippedTypes = new Set(skipped.map(finding => finding.ruleId)).size;
  elements["review-issues-button"].disabled = !next;
  elements["review-issues-button"].dataset.ruleId = next ? next.ruleId : "";
  elements["review-issues-button"].dataset.fingerprint = next ? next.fingerprint : "";
  elements["review-issues-button"].textContent = next
    ? "Review issues"
    : skippedFindings
      ? "All matching issues skipped"
      : omittedFindingsMatchingCurrentFilters(state.activeReport)
        ? "No displayed issues to review"
        : "No issues to review";
  elements["review-skip-summary"].hidden = skippedFindings === 0;
  elements["review-skip-message"].textContent = skippedFindings
    ? `${skippedFindings} open finding${skippedFindings === 1 ? "" : "s"} in ${skippedTypes} issue type${skippedTypes === 1 ? " is" : "s are"} skipped for this review.`
    : "";
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
  if (amount > 0) {
    skipRemainingIssueType();
    return;
  }
  const items = guidedFindings();
  const current = items[state.guidedIndex];
  if (!current) return;
  let targetIndex = -1;
  for (let index = state.guidedIndex - 1; index >= 0; index -= 1) {
    if (items[index].ruleId !== current.ruleId) { targetIndex = index; break; }
  }
  if (targetIndex < 0) return;
  state.guidedIndex = targetIndex;
  state.guidedFingerprint = items[targetIndex].fingerprint;
  state.selectedRuleId = items[targetIndex].ruleId;
  state.decisionMessage = "";
  state.pendingDecision = null;
  state.locateOnNextRender = true;
  renderReviewView();
  persistReviewContext(state.activePageKey).catch(() => { });
}

function skipRemainingIssueType() {
  const items = guidedFindings();
  const current = items[state.guidedIndex];
  if (!current) return;
  const skippedItems = items
    .slice(state.guidedIndex)
    .filter(finding => finding.ruleId === current.ruleId && effectiveStatus(finding) === "open");
  const skippedAmount = skippedItems.reduce((total, finding) => total + findingAmount(finding), 0);
  const message = `${skippedAmount || "Remaining"} finding${skippedAmount === 1 ? "" : "s"} of this type skipped for this review. They remain open.`;
  const next = items.slice(state.guidedIndex + 1).find(finding => finding.ruleId !== current.ruleId) || null;
  skippedItems.forEach(finding => state.skippedFingerprints.add(finding.fingerprint));
  state.skippedRuleIds.add(current.ruleId);
  state.decisionMessage = message;
  state.pendingDecision = null;
  if (!next) {
    closeFindingReview();
    showToast(message);
    persistReviewContext(state.activePageKey).catch(() => { });
    return;
  }
  const remaining = guidedFindings();
  const targetIndex = remaining.findIndex(finding => finding.fingerprint === next.fingerprint);
  state.guidedIndex = targetIndex >= 0 ? targetIndex : 0;
  state.guidedFingerprint = next.fingerprint;
  state.selectedRuleId = next.ruleId;
  state.locateOnNextRender = true;
  renderReviewView();
  persistReviewContext(state.activePageKey).catch(() => { });
}

function restoreSkippedIssueTypes() {
  if (!state.skippedRuleIds.size && !state.skippedFingerprints.size) return;
  state.skippedRuleIds.clear();
  state.skippedFingerprints.clear();
  state.decisionMessage = "";
  state.pendingDecision = null;
  renderReviewView();
  persistReviewContext(state.activePageKey).catch(() => { });
  showToast("Skipped findings are included in this review again.");
}

function openRuleGroup(ruleId, fingerprint = "", options = {}) {
  if (!state.activeReport || !ruleId) return;
  state.skippedRuleIds.delete(ruleId);
  (state.activeReport.issues || [])
    .filter(finding => finding.ruleId === ruleId)
    .forEach(finding => state.skippedFingerprints.delete(finding.fingerprint));
  const groups = groupedFindingTypes();
  const group = groups.find(item => item.ruleId === ruleId);
  if (!group || !group.findings.length) return;
  state.selectedRuleId = ruleId;
  state.detailQueue = orderedReviewFindings().map(finding => finding.fingerprint);
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
  persistReviewContext(state.activePageKey).catch(() => { });
  requestAnimationFrame(() => elements["review-back-button"].focus());
}

function closeFindingReview() {
  state.reviewMode = "list";
  state.decisionMessage = "";
  clearFindingHighlight();
  renderReviewView();
  persistReviewContext(state.activePageKey).catch(() => { });
  requestAnimationFrame(() => {
    const row = elements.findings.querySelector(`[data-rule-id="${CSS.escape(state.selectedRuleId)}"]`);
    if (row) row.focus();
  });
}

function highlightedEvidence(finding) {
  const evidence = String(finding.evidence || "");
  const match = String(finding.matchText || finding.flaggedToken || "");
  if (!match) return escapeHtml(evidence);
  const requestedIndex = Number.isInteger(finding.evidenceMatchIndex) && finding.evidenceMatchIndex >= 0
    ? finding.evidenceMatchIndex
    : Number.isInteger(finding.matchIndex) ? finding.matchIndex : -1;
  const index = requestedIndex >= 0 && evidence.slice(requestedIndex, requestedIndex + match.length).toLowerCase() === match.toLowerCase()
    ? requestedIndex
    : evidence.toLowerCase().indexOf(match.toLowerCase());
  if (index < 0) return escapeHtml(evidence);
  return `${escapeHtml(evidence.slice(0, index))}<mark>${escapeHtml(evidence.slice(index, index + match.length))}</mark>${escapeHtml(evidence.slice(index + match.length))}`;
}

function structuredEvidenceParts(finding) {
  if (!Array.isArray(finding.evidenceLines) || !finding.evidenceLines.length) return null;
  const [summary, ...lines] = finding.evidenceLines.map(line => String(line || ""));
  const links = lines.map(line => {
    const match = /^(Link \d+):\s*(.*)$/.exec(line);
    if (!match) return { label: "", text: line, url: "" };
    const body = match[2];
    const arrowIndex = body.lastIndexOf(" → ");
    const possibleUrl = arrowIndex >= 0 ? body.slice(arrowIndex + 3).trim() : "";
    const hasUrl = /^https?:\/\//i.test(possibleUrl);
    return {
      label: match[1],
      text: hasUrl ? body.slice(0, arrowIndex).trim() : body,
      url: hasUrl ? possibleUrl : ""
    };
  });
  return { summary, links };
}

function evidenceTextForExport(finding) {
  const contrast = finding && finding.contrast;
  const contrastLines = contrast ? [
    contrast.status === "confirmed"
      ? `Measured contrast: ${Number(contrast.ratio).toFixed(2)}:1 (minimum ${Number(contrast.required).toFixed(1)}:1)`
      : `Contrast verification: manual (${contrast.reason || "rendering cannot be measured reliably"})`,
    `Colours: ${contrast.foreground || "unknown"} on ${contrast.background || "unknown"}`,
    `Rendered state: ${contrast.displayState || "current rendered state"}`
  ] : [];
  const structured = structuredEvidenceParts(finding);
  if (!structured) return [...contrastLines, String(finding.evidence || "")].filter(Boolean).join("\n");
  const lines = [structured.summary];
  if (structured.links.length) lines.push("");
  structured.links.forEach(link => {
    lines.push(link.label ? `${link.label}: ${link.text}` : link.text);
    if (link.url) lines.push(link.url);
  });
  return [...contrastLines, ...lines].join("\n");
}

function renderedEvidence(finding) {
  const structured = structuredEvidenceParts(finding);
  if (structured) {
    const links = structured.links.map((link, index) => `
      <div style="${index ? "margin-top:0.8rem;" : ""} min-width:0;">
        ${link.label ? `<div style="font-weight:600;">${escapeHtml(link.label)}</div>` : ""}
        <div style="white-space:normal; overflow-wrap:anywhere; word-break:break-word; min-width:0; max-width:100%;">${escapeHtml(link.text)}</div>
        ${link.url ? `<div style="margin-top:0.15rem; color:#4a5568; white-space:normal; overflow-wrap:anywhere; word-break:break-word; min-width:0; max-width:100%;">${escapeHtml(link.url)}</div>` : ""}
      </div>`).join("");
    return `<div class="evidence" style="overflow-wrap:anywhere; min-width:0;">
      <div style="white-space:normal; overflow-wrap:anywhere; word-break:break-word;">${escapeHtml(structured.summary)}</div>
      ${links ? `<div style="border-top:1px solid #d6dbe1; margin-top:0.7rem; padding-top:0.7rem;">${links}</div>` : ""}
    </div>`;
  }
  return `<p class="evidence" style="overflow-wrap:anywhere; min-width:0;">${highlightedEvidence(finding)}</p>`;
}

function renderedContrastDetails(finding) {
  const contrast = finding && finding.contrast;
  if (!contrast) return "";
  const measurement = contrast.status === "confirmed"
    ? `<strong>${escapeHtml(Number(contrast.ratio).toFixed(2))}:1</strong> measured · ${escapeHtml(Number(contrast.required).toFixed(1))}:1 minimum`
    : `<strong>Manual verification needed</strong>${contrast.reason ? ` · ${escapeHtml(contrast.reason)}` : ""}`;
  return `<div class="contrast-details">
    <div>${measurement}</div>
  </div>`;
}

function editorDataAttributes(item) {
  const textareaId = normalizeSpace(item && item.editorSource && item.editorSource.textareaId);
  return `data-editor-region="${Number(item && item.editorRegion) || ""}" data-editor-id="${escapeHtml(textareaId)}"`;
}

function renderFinding(finding) {
  const status = effectiveStatus(finding);
  const canReview = status === "open";
  const note = auditNote(finding);
  const feedbackCount = feedbackNotesForFinding(finding).length;
  const showResponsibility = !state.activeReport || state.activeReport.settings.profile !== "cms-lite" || state.activeReport.settings.scope === "whole";
  const markerOnlyMatch = new Set(["double-space", "non-breaking-space", "link-trailing-space", "semicolon"]).has(finding.ruleId);
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
      ${renderedContrastDetails(finding)}
      ${(finding.matchText || finding.flaggedToken) && !markerOnlyMatch ? `<p class="match-callout"><strong>Flagged wording:</strong> <mark>${escapeHtml(finding.matchText || finding.flaggedToken)}</mark>${finding.replacement ? ` → ${escapeHtml(finding.replacement)}` : ""}</p>` : ""}
      ${finding.exceptionEligible && finding.proposedPhrase && finding.proposedPhrase !== finding.flaggedToken ? `<p class="term-context"><strong>Exact-term option:</strong> “${escapeHtml(finding.proposedPhrase)}”</p>` : ""}
      ${finding.evidence ? `<div><strong>Evidence</strong>${renderedEvidence(finding)}</div>` : ""}
      ${finding.suggestedTarget ? `<p class="target-suggestion"><strong>Suggested target:</strong> <code>${escapeHtml(finding.suggestedTarget)}</code></p>` : ""}
      ${finding.diagnostics && finding.diagnostics.length ? `<div class="finding-diagnostics"><strong>What does not match</strong><ul>${finding.diagnostics.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
      ${finding.occurrenceCount > 1 ? `<p class="occurrences">${finding.occurrenceCount} identical occurrences</p>` : ""}
      <p class="suggestion"><strong>Suggested action:</strong> ${escapeHtml(finding.suggestion)}</p>
      ${note.text ? `<div class="audit-note"><strong>Audit note</strong><p>${escapeHtml(note.text)}</p></div>` : ""}
      <div class="finding-footer">
        <div class="finding-actions">
          ${finding.selector ? `<button
            class="small-button locate-button"
             type="button"
             data-selector="${escapeHtml(finding.selector)}"
             ${editorDataAttributes(finding)}>
             ${workspaceSurface ? "Show in source tab" : "Show again on page"}
</button>` : ""}
          ${canReview ? `<button class="small-button decision-button resolve-button" type="button" data-status="resolved">Mark resolved</button><button class="small-button decision-button" type="button" data-status="ignored">Ignore finding</button>` : `<button class="small-button reopen-button" type="button">Reopen finding</button>`}
          ${canReview && finding.exceptionEligible ? `<button class="small-button exception-button" type="button">${finding.ruleId === "proofreading-pubic" ? "Ignore on this page" : "Always allow exact term"}</button>` : ""}
          <button class="small-button note-button" type="button">${note.text || note.important ? "Edit note or importance" : "Add note or importance"}</button>
        </div>
      <div class="reference-guidance"><strong>Reference guidance:</strong> <a href="${escapeHtml(finding.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(finding.sourceLabel)} — B.C. Web Style Guide</a></div>        <button class="text-button finding-feedback-action" type="button">${feedbackCount ? "Edit feedback about this result" : "Add feedback about this result"}</button>
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
  persistReviewContext(state.activePageKey).catch(() => { });
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
  persistReviewContext(state.activePageKey).catch(() => { });
}

function switchReviewMode(name) {
  state.reviewMode = ["guided", "detail"].includes(name) ? "detail" : "list";
  renderReviewView();
  persistReviewContext(state.activePageKey).catch(() => { });
}

function guidedFindings() {
  if (!state.activeReport) return [];
  const severity = elements["severity-filter"].value;
  const category = elements["category-filter"].value;
  const importantOnly = elements["important-filter"].checked;
  const byFingerprint = new Map(state.activeReport.issues.filter(finding => {
    const automaticallyIgnored = finding.automaticStatus === "ignored" && !state.decisions[finding.fingerprint];
    return !automaticallyIgnored
      && !state.skippedFingerprints.has(finding.fingerprint)
      && (severity === "all" || severity === finding.severity)
      && (category === "all" || category === finding.category)
      && (!importantOnly || importantFinding(finding));
  }).map(finding => [finding.fingerprint, finding]));
  return state.detailQueue.map(fingerprint => byFingerprint.get(fingerprint)).filter(Boolean);
}

function resetGuidedFindingPosition() {
  const confirmation = elements["guided-finding"].querySelector(".action-confirmation");
  const finding = elements["guided-finding"].querySelector(".finding");
  if (!finding) return;
  (confirmation || finding).scrollIntoView({ block: "start" });
  finding.focus({ preventScroll: true });
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
  const skippedOpen = (state.activeReport.issues || [])
    .filter(item => state.skippedFingerprints.has(item.fingerprint) && effectiveStatus(item) === "open")
    .reduce((total, item) => total + findingAmount(item), 0);
  elements["guided-progress"].textContent = `${reviewed} reviewed · ${remaining} in review${skippedOpen ? ` · ${skippedOpen} skipped` : ""}`;
  const confirmation = state.decisionMessage
    ? `<div class="action-confirmation" role="status"><span>${escapeHtml(state.decisionMessage)}</span>${state.pendingDecision ? `<button class="undo-decision" type="button" data-fingerprint="${escapeHtml(state.pendingDecision.fingerprint)}">Undo</button>` : ""}</div>`
    : "";
  elements["guided-finding"].innerHTML = `${confirmation}${renderFinding(finding)}`;
  elements["guided-previous"].disabled = state.guidedIndex === 0;
  elements["guided-next"].disabled = false;
  const atLastFinding = state.guidedIndex === items.length - 1;
  const nextFinding = items[state.guidedIndex + 1] || null;
  const atLastInType = !nextFinding || nextFinding.ruleId !== finding.ruleId;
  const pageOrder = elements["sort-order"].value === "page";
  elements["guided-next"].textContent = atLastFinding ? "Return to findings" : (!pageOrder && atLastInType) ? "Next issue type" : "Next";
  elements["next-issue-type"].classList.remove("is-placeholder");
  elements["next-issue-type"].disabled = false;
  elements["next-issue-type"].setAttribute("aria-hidden", "false");
  elements["next-issue-type"].tabIndex = 0;
  elements["next-issue-type"].textContent = "Skip remaining findings of this type";
  if (locate) requestAnimationFrame(resetGuidedFindingPosition);
  if (locate && !workspaceSurface && finding.selector) {
    highlightSelector(
      findingSelectors(finding),
      true,
      false,
      finding.editorSource || null,
      Number(finding.editorRegion) || null
    );
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
  persistReviewContext(state.activePageKey).catch(() => { });
}

function syncLinkResultCategoryToggle(category) {
  if (!category) return;
  const button = category.querySelector(".link-result-category-toggle");
  if (!button) return;
  const groups = Array.from(category.querySelectorAll(".link-result-group"));
  const allOpen = Boolean(groups.length) && groups.every(group => group.open);
  const action = allOpen ? "Collapse" : "Expand";
  const label = button.dataset.linkCategoryLabel || "link";
  button.textContent = `${action} all`;
  button.setAttribute("aria-expanded", String(allOpen));
  button.setAttribute("aria-label", `${action} all ${label} results`);
}

function toggleLinkResultCategory(button) {
  const category = button && button.closest(".link-result-category");
  if (!category) return;
  const groups = Array.from(category.querySelectorAll(".link-result-group"));
  if (!groups.length) return;
  const shouldOpen = groups.some(group => !group.open);
  groups.forEach(group => { group.open = shouldOpen; });
  syncLinkResultCategoryToggle(category);
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
    elements["page-details"].innerHTML = `<div class="empty-state"><strong>Page details are not available in this saved review.</strong><br>Check the page again to add them.</div>`;
    return;
  }
  state.pageDetailSection = section;
  const metadata = details.metadata || {};
  const cmsEditorMode = Boolean(report.settings && report.settings.editorMode);
  const metadataUnavailable = cmsEditorMode || metadata.unavailable === true;
  const assetKey = item => `${editorSourceKey(item)}|${item && item.selector ? item.selector : ""}`;
  const assetBySelector = new Map((report.assets || []).map(asset => [assetKey(asset), asset]));
  const authoredHeadings = report.settings.profile === "cms-lite" ? details.headings.filter(heading => !heading.component) : details.headings;
  const generatedHeadings = report.settings.profile === "cms-lite" ? details.headings.filter(heading => heading.component) : [];
  const headingIssues = authoredHeadings.filter(heading => heading.flags && heading.flags.length).length;
  const open = report.issues.filter(finding => effectiveStatus(finding) === "open");
  const headingRows = headings => headings.length ? headings.map(heading => `<li class="heading-outline-row heading-level-${heading.level}${heading.component ? " cms-generated-heading" : ""}"><button class="detail-jump" type="button" data-selector="${escapeHtml(heading.selector)}" ${editorDataAttributes(heading)}><span class="detail-level level-h${heading.level}">H${heading.level}</span><span class="heading-outline-text">${escapeHtml(heading.text)}</span>${(heading.flags || []).map(flag => `<span class="detail-flag">${escapeHtml(flag)}</span>`).join("")}</button></li>`).join("") : `<li class="detail-empty-row">No visible headings found.</li>`;
  const linkCheck = report.linkCheck || null;
  const resultCategoryCounts = linkResultCategoryCounts(linkCheck && linkCheck.results);
  const linkCheckText = linkCheck
    ? linkCheck.state === "permission-denied"
      ? `Website access declined · 0 of ${linkCheck.totalFound || 0} checked`
      : `${linkCheck.completed || 0} of ${linkCheck.totalFound || 0} checked · ${resultCategoryCounts.problems || 0} problems · ${resultCategoryCounts.review || 0} need review · ${resultCategoryCounts.working || 0} working`
    : "Not checked yet";
  const renderLinkResult = result => `
    <li class="link-result ${escapeHtml(result.status)}">
      <div class="link-result-heading"><span class="status-label ${escapeHtml(result.status)}">${escapeHtml(linkResultLabel(result.status))}</span>${result.code ? `<strong>HTTP ${result.code}</strong>` : ""}${result.link.occurrences > 1 ? `<span>${result.link.occurrences} occurrences</span>` : ""}</div>
      <strong>${escapeHtml(result.link.text || "[No accessible name]")}</strong>
      ${result.link.location ? `<span class="link-redirect">Under: ${escapeHtml(result.link.location)}</span>` : ""}
      <span class="link-destination">${escapeHtml(result.link.href)}</span>
      ${result.cmsCheckedUrl ? `<span class="link-redirect">CMS Lite: ${escapeHtml(result.cmsStatus === "ok" ? "Working" : sentenceLabel(result.cmsStatus))}${result.cmsCode ? ` · HTTP ${escapeHtml(result.cmsCode)}` : ""}</span>` : ""}
      ${result.qaCheckedUrl ? `<span class="link-redirect">QA: ${escapeHtml(result.qaStatus === "ok" ? "Working" : result.qaStatus === "broken" ? "Not found" : sentenceLabel(result.qaStatus))}${result.qaCode ? ` · HTTP ${escapeHtml(result.qaCode)}` : ""}</span>` : ""}
      ${result.liveCheckedUrl ? `<span class="link-redirect">Live: ${escapeHtml(result.liveStatus === "ok" ? "Working" : result.liveStatus === "broken" ? "Not found" : sentenceLabel(result.liveStatus))}${result.liveCode ? ` · HTTP ${escapeHtml(result.liveCode)}` : ""}</span>` : result.qaLive && result.checkedUrl ? `<span class="link-redirect">Checked live version: ${escapeHtml(result.checkedUrl)}</span>` : result.redirected && result.finalUrl && result.finalUrl !== result.link.href ? `<span class="link-redirect">Redirects to ${escapeHtml(result.finalUrl)}</span>` : ""}
      ${result.status === "session-ok" && result.accessMode === "current-session" && !result.qaCheckedUrl ? `<span class="link-redirect">${result.link.cmsLiteEditorLink ? "Verified using the open CMS Lite editor session." : "Verified using your current browser access. Other users may have different access."}</span>` : ""}
      ${result.error ? `<span class="link-error">${escapeHtml(result.error)}</span>` : ""}
      <div class="link-result-actions">${result.link.selector ? `<button class="button tertiary compact detail-jump" type="button" data-selector="${escapeHtml(result.link.selector)}" ${editorDataAttributes(result.link)}>${workspaceSurface ? "Show in source tab" : "Show on page"}</button>` : ""}<button class="button tertiary compact open-background-link" type="button" data-url="${escapeHtml(result.link.href)}">Open in background</button></div>
    </li>`;
  const linkResultGroups = linkCheck && Array.isArray(linkCheck.results) ? LINK_RESULT_GROUPS.map(group => {
    const statusGroups = group.buckets.map(bucket => {
      const results = linkCheck.results.filter(result => bucket.statuses.includes(result.status));
      if (!results.length) return "";
      const statusClass = bucket.statuses[0] || "unavailable";
      return `<details class="link-result-group ${escapeHtml(statusClass)}"><summary><span>${escapeHtml(bucket.label)}</span><strong>${results.length}</strong></summary><ul class="link-results">${results.map(renderLinkResult).join("")}</ul></details>`;
    }).filter(Boolean);
    if (!statusGroups.length) return "";
    const count = resultCategoryCounts[group.key] || 0;
    return `<section class="link-result-category ${escapeHtml(group.key)}" aria-label="${escapeHtml(group.label)}">
      <div class="link-result-category-heading">
        <div><strong>${escapeHtml(group.label)}</strong><span>${escapeHtml(group.description)}</span></div>
        <div class="link-result-category-heading-actions">
          <button class="text-button link-result-category-toggle" type="button" data-link-category-toggle="${escapeHtml(group.key)}" data-link-category-label="${escapeHtml(group.label)}" aria-expanded="false" aria-label="Expand all ${escapeHtml(group.label)} results">Expand all</button>
          <span class="link-result-category-count">${count}</span>
        </div>
      </div>
      <div class="link-result-category-groups">${statusGroups.join("")}</div>
    </section>`;
  }).join("") : "";
  const back = section === "overview" ? "" : `<button class="text-button detail-section-back" type="button" data-detail-section="overview">← Page details</button>`;

  if (section === "overview") {
    const brokenSummary = linkCheck ? `${resultCategoryCounts.problems || 0} problems · ${resultCategoryCounts.review || 0} need review · ${resultCategoryCounts.working || 0} working` : "Link check has not been run";
    const grade = cmsEditorMode
      ? "Reading grade unavailable across multiple CMS Lite fields"
      : report.stats.readingGrade === null
        ? "Not enough prose"
        : `Estimated grade ${report.stats.readingGrade}`;
    elements["page-details"].innerHTML = `
      <p class="eyebrow">Review the page</p><h2>Page details</h2>
      <p class="hint">Choose an area to review. Findings remain available in the Findings tab.</p>
      ${excludedOptionalCheckLabels(report).length ? `<p class="detail-help"><strong>Excluded from this scan:</strong> ${escapeHtml(excludedOptionalCheckLabels(report).join(", "))}. Reading-level checks were still included.</p>` : ""}
      <div class="details-landing">
        <button class="detail-card" type="button" data-detail-section="headings"><span><strong>Headings</strong><span>${headingIssues} heading issue${headingIssues === 1 ? "" : "s"}${generatedHeadings.length ? ` · ${generatedHeadings.length} accordion heading${generatedHeadings.length === 1 ? "" : "s"}` : ""}</span></span><span class="detail-card-count">${authoredHeadings.length}</span></button>
        <button class="detail-card" type="button" data-detail-section="images"><span><strong>Images and alt text</strong><span>${details.counts.imagesMissingAlt} missing alt · ${details.counts.imagesEmptyAlt} empty alt</span></span><span class="detail-card-count">${details.counts.images}</span></button>
        <button class="detail-card" type="button" data-detail-section="links"><span><strong>Links and assets</strong><span>${brokenSummary}</span></span><span class="detail-card-count">${details.counts.links}</span></button>
        <button class="detail-card" type="button" data-detail-section="metadata"><span><strong>Metadata and SEO</strong><span>${metadataUnavailable ? "Not checked in editor mode" : metadata.description ? "Description published" : "Meta description missing"}</span></span><span class="detail-card-count">›</span></button>
        <button class="detail-card" type="button" data-detail-section="statistics"><span><strong>Content statistics</strong><span>${report.stats.words.toLocaleString()} words · ${grade}</span></span><span class="detail-card-count">›</span></button>
        <button class="detail-card" type="button" data-detail-section="overlays"><span><strong>Page overlays</strong><span>Label headings, alt text or link destinations on the page</span></span><span class="detail-card-count">›</span></button>
      </div>`;
    return;
  }

  if (section === "headings") {
    elements["page-details"].innerHTML = `${back}<h2>Heading outline</h2><p class="detail-help">Indentation and level badges show the hierarchy. Select a row to find that heading on the page.</p><ul class="detail-list heading-outline">${headingRows(authoredHeadings)}</ul>${generatedHeadings.length ? `<details class="detail-section cms-heading-section"><summary>CMS Lite accordion headings (${generatedHeadings.length})</summary><p class="detail-help">These accordion headings are added by CMS Lite and are not part of the editable heading outline.</p><ul class="detail-list heading-outline">${headingRows(generatedHeadings)}</ul></details>` : ""}`;
    return;
  }

  if (section === "images") {
    elements["page-details"].innerHTML = `${back}<h2>Images and alt text</h2><button class="button secondary" type="button" data-overlay="alts">Show alt text on page</button><ul class="detail-list">${details.images.length ? details.images.map(image => `<li><button class="detail-jump" type="button" data-selector="${escapeHtml(image.selector)}" ${editorDataAttributes(image)}><strong>${image.altState === "missing" ? "Missing alt attribute" : image.altState === "empty" ? "Empty alt (decorative)" : `Alt: ${escapeHtml(image.alt)}`}</strong><br><span class="component-note">${escapeHtml(image.src)}</span></button></li>`).join("") : `<li class="detail-empty-row">No visible images found.</li>`}</ul>`;
    return;
  }

  if (section === "links") {
    const linkCheckButtonLabel = linkCheck && linkCheck.state === "permission-denied" ? "Allow access and check links" : linkCheck ? "Check again" : "Check links";
    const permissionHelp = linkCheck && linkCheck.state === "permission-denied"
      ? `<p class="detail-help permission-warning"><strong>No links were checked.</strong> Select “Allow access and check links” and approve the browser prompt.</p>`
      : `<p class="detail-help">CMS Lite links are checked in QA and live when applicable.<br><br>Most other links are checked without signing in. For supported internal sites, the checker can use your current browser access. It does not read or store your sign-in information.</p>`;
    elements["page-details"].innerHTML = `${back}<h2>Links and assets</h2><section class="link-check-panel"><div><strong>Check whether links work</strong><span>${linkCheckText}</span></div>${linkCheck ? `<progress class="link-check-progress" max="${Math.max(1, linkCheck.totalFound || 1)}" value="${linkCheck.completed || 0}">${linkCheck.completed || 0} of ${linkCheck.totalFound || 0}</progress>` : ""}<div class="link-check-actions">${state.linkCheckRunning ? `<button class="button secondary compact link-check-pause" type="button">${state.linkCheckPaused ? "Resume" : "Pause"}</button><button class="button tertiary compact link-check-stop" type="button">Stop</button>` : `<button class="button primary compact link-check-button" type="button">${linkCheckButtonLabel}</button>`}<button class="button secondary compact manage-permissions-button" type="button">Website access</button></div>${permissionHelp}</section>${linkCheck ? (linkResultGroups || `<div class="empty-state">No individual link results are available.</div>`) : `<div class="empty-state">Check the links to see each destination and its result.</div>`}<details class="detail-section"><summary>All page links (${details.links.length})</summary><ul class="detail-list">${details.links.length ? details.links.map(link => { const asset = assetBySelector.get(assetKey(link)); const verification = asset ? ` · asset ${String(asset.verificationStatus || "not checked").replace(/-/g, " ")}${asset.actualSize ? ` · ${displayBytes(asset.actualSize)}` : ""}` : ""; return `<li><button class="detail-jump" type="button" data-selector="${escapeHtml(link.selector)}" ${editorDataAttributes(link)}><strong>${escapeHtml(link.text || "[No accessible name]")}</strong><br><span class="component-note">${escapeHtml(link.location || "Page content")} · ${escapeHtml(link.href)}${escapeHtml(verification)}</span></button></li>`; }).join("") : `<li class="detail-empty-row">No visible links found.</li>`}</ul></details>`;
    return;
  }

  if (section === "metadata") {
    if (metadataUnavailable) {
      elements["page-details"].innerHTML = `${back}<h2>Metadata and SEO</h2><div class="empty-state"><strong>Metadata is not available in the CMS Lite editor.</strong><br>Check the QA or live page to review the title, description, language and other metadata.</div>`;
      return;
    }
    elements["page-details"].innerHTML = `${back}<h2>Metadata and SEO</h2><dl class="metadata-list">${metadataDefinition("HTML title", metadata.documentTitle)}${metadataDefinition("Meta description", metadata.description)}${metadataDefinition("Keywords", metadata.keywords)}${metadataDefinition("Canonical URL", metadata.canonical)}${metadataDefinition("Robots", metadata.robots)}${metadataDefinition("Page language", metadata.language)}${metadataDefinition("Structured data", `${metadata.jsonLdCount || 0} JSON-LD block${metadata.jsonLdCount === 1 ? "" : "s"}`)}${(metadata.custom || []).filter(item => !["keywords", "robots"].includes(item.name.toLowerCase())).map(item => metadataDefinition(item.name, item.value)).join("")}</dl>`;
    return;
  }

  if (section === "statistics") {
    const counts = reportCounts(report);
    elements["page-details"].innerHTML = `${back}<h2>Content statistics</h2><div class="details-overview"><div class="detail-stat"><strong>${report.stats.words.toLocaleString()}</strong><span>words</span></div><div class="detail-stat"><strong>${report.stats.sentences.toLocaleString()}</strong><span>sentence blocks</span></div><div class="detail-stat"><strong>${cmsEditorMode ? "Not combined" : report.stats.readingGrade === null ? "—" : report.stats.readingGrade}</strong><span>estimated reading grade</span></div><div class="detail-stat"><strong>${authoredHeadings.length}</strong><span>authored headings</span></div><div class="detail-stat"><strong>${details.counts.links}</strong><span>links</span></div><div class="detail-stat"><strong>${details.counts.images}</strong><span>images</span></div></div><details class="detail-section"><summary>Open finding totals</summary><div class="finding-breakdown"><div class="breakdown-severity"><div class="fix"><strong>${counts.fix}</strong><span>Fix</span></div><div class="check"><strong>${counts.check}</strong><span>Check</span></div><div class="review"><strong>${counts.review}</strong><span>Review</span></div></div></div></details><details class="detail-section"><summary>Page components</summary><dl class="metadata-list">${metadataDefinition("Lists", details.counts.lists)}${metadataDefinition("Tables", details.counts.tables)}${metadataDefinition("Forms", details.counts.forms)}${metadataDefinition("Accordions", details.counts.accordions)}${metadataDefinition("Asset links", details.counts.assets)}</dl></details>`;
    return;
  }

  elements["page-details"].innerHTML = `${back}<h2>Page overlays</h2><p class="hint">Use these temporary labels to understand the live page. Clear them when you finish.</p><div class="audit-tools"><button type="button" data-overlay="headings">Heading levels</button><button type="button" data-overlay="alts">Image alt text</button><button type="button" data-overlay="links">Link destinations</button><button type="button" data-overlay="clear">Clear overlays</button></div>`;
}

async function revealFindingElements(
  selectedSelectors,
  editorSource = null,
  editorRegion = null
) {
  const editorFrames = Array.from(
    document.querySelectorAll("iframe.cke_wysiwyg_frame")
  );

  let editorFrame = null;
  let targetDocument = document;

  if (
    (editorSource && editorSource.textareaId) ||
    Number(editorRegion) > 0
  ) {
    const cmsEditor = globalThis.BCWebStyleGuideCmsLite;

    if (cmsEditor) {
      const resolved = await cmsEditor.activateEditor(
        document,
        editorSource,
        editorRegion
      );

      editorFrame = resolved && resolved.frame;

      if (editorFrame) {
        try {
          targetDocument =
            editorFrame.contentDocument || document;
        } catch (_) {
          targetDocument = document;
          editorFrame = null;
        }
      }
    } else if (
      Number(editorRegion) > 0 &&
      editorFrames[Number(editorRegion) - 1]
    ) {
      editorFrame =
        editorFrames[Number(editorRegion) - 1];

      try {
        targetDocument =
          editorFrame.contentDocument || document;
      } catch (_) {
        targetDocument = document;
        editorFrame = null;
      }
    }
  }

  const clearInDocument = doc => {
    if (!doc) return;

    doc
      .querySelectorAll("[data-bc-style-checker-highlight]")
      .forEach(old => {
        old.style.outline =
          old.dataset.bcStyleCheckerOutline || "";

        old.style.outlineOffset =
          old.dataset.bcStyleCheckerOffset || "";

        delete old.dataset.bcStyleCheckerHighlight;
        delete old.dataset.bcStyleCheckerOutline;
        delete old.dataset.bcStyleCheckerOffset;
      });
  };

  // Clear highlights from the outer page.
  clearInDocument(document);

  // Clear highlights from all CMS Lite editor frames.
  editorFrames.forEach(frame => {
    try {
      clearInDocument(frame.contentDocument);
    } catch (_) {}
  });

  const wait = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  const querySelectedElements = () =>
    selectedSelectors
      .map(selected => {
        try {
          return targetDocument.querySelector(selected);
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);

  let elements = querySelectedElements();

  if (!elements.length) return false;

  const ancestors = [];

  elements.forEach(element => {
    let current = element.parentElement;

    while (current) {
      if (
        (
          current.tagName === "DETAILS" ||
          current.matches(
            ".collapse,.panel-collapse,[class*='collapse' i],[class*='accordion' i] [aria-hidden='true']"
          )
        ) &&
        !ancestors.includes(current)
      ) {
        ancestors.push(current);
      }

      current = current.parentElement;
    }
  });

  ancestors.sort((first, second) => {
    if (first.contains(second)) return -1;
    if (second.contains(first)) return 1;
    return 0;
  });

  const triggerFor = ancestor => {
    const id = ancestor.id || "";

    const escape = value =>
      globalThis.CSS && CSS.escape
        ? CSS.escape(value)
        : String(value).replace(/["\\]/g, "\\$&");

    const escapedId = escape(id);
    const candidates = [];

    if (id) {
      [
        `[aria-controls="${escapedId}"]`,
        `a[href="#${escapedId}"]`,
        `[data-target="#${escapedId}"]`,
        `[data-bs-target="#${escapedId}"]`
      ].forEach(query => {
        try {
          candidates.push(
            ...targetDocument.querySelectorAll(query)
          );
        } catch (_) {}
      });
    }

    const labelledBy =
      ancestor.getAttribute("aria-labelledby") || "";

    if (labelledBy) {
      labelledBy
        .split(/\s+/)
        .filter(Boolean)
        .forEach(labelId => {
          const label =
            targetDocument.getElementById(labelId);

          if (label) {
            candidates.push(
              label.matches(
                "button,a,[role='button']"
              )
                ? label
                : label.querySelector(
                    "button,a,[role='button']"
                  )
            );
          }
        });
    }

    const container = ancestor.closest(
      ".panel,.accordion-item,.card,[class*='accordion' i]"
    );

    if (container) {
      candidates.push(
        container.querySelector(
          "[aria-expanded],[data-toggle='collapse'],[data-bs-toggle='collapse'],.accordion-toggle,.panel-title a,.accordion-button,button,a[role='button']"
        )
      );
    }

    return (
      candidates.find(
        candidate =>
          candidate && candidate !== ancestor
      ) || null
    );
  };

  const styleFor = element => {
    const view =
      element &&
      element.ownerDocument &&
      element.ownerDocument.defaultView;

    return (view || window).getComputedStyle(element);
  };

  const isCollapsed = (ancestor, trigger) => {
    if (ancestor.tagName === "DETAILS") {
      return !ancestor.open;
    }

    const style = styleFor(ancestor);
    const rect = ancestor.getBoundingClientRect();

    const collapsedBySize =
      (
        ancestor.classList.contains("collapse") ||
        ancestor.classList.contains("collapsing")
      ) &&
      rect.height <= 1;

    return (
      ancestor.hidden ||
      ancestor.getAttribute("aria-hidden") === "true" ||
      (
        ancestor.classList.contains("collapse") &&
        !ancestor.classList.contains("show") &&
        !ancestor.classList.contains("in")
      ) ||
      ancestor.classList.contains("collapsing") ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      collapsedBySize ||
      (
        trigger &&
        trigger.getAttribute("aria-expanded") ===
          "false"
      )
    );
  };

  const waitUntilOpen = async (
    ancestor,
    trigger
  ) => {
    const started = Date.now();

    while (Date.now() - started < 900) {
      if (!isCollapsed(ancestor, trigger)) {
        return true;
      }

      await wait(60);
    }

    return !isCollapsed(ancestor, trigger);
  };

  for (const ancestor of ancestors) {
    if (ancestor.tagName === "DETAILS") {
      if (!ancestor.open) {
        ancestor.open = true;
        await wait(40);
      }

      continue;
    }

    const trigger = triggerFor(ancestor);

    if (!isCollapsed(ancestor, trigger)) {
      continue;
    }

    if (trigger) {
      try {
        trigger.click();
      } catch (_) {}

      if (
        await waitUntilOpen(ancestor, trigger)
      ) {
        continue;
      }
    }

    // Fallback for CMS/Bootstrap panels whose normal
    // collapse script is unavailable from the extension
    // execution world. This only exposes the controlled
    // panel so the reviewer can see the finding.
    ancestor.hidden = false;
    ancestor.removeAttribute("aria-hidden");
    ancestor.classList.remove("collapsing");
    ancestor.classList.add("show", "in");

    ancestor.style.setProperty(
      "display",
      "block",
      "important"
    );

    ancestor.style.setProperty(
      "height",
      "auto",
      "important"
    );

    ancestor.style.setProperty(
      "max-height",
      "none",
      "important"
    );

    ancestor.style.setProperty(
      "overflow",
      "visible",
      "important"
    );

    ancestor.style.setProperty(
      "visibility",
      "visible",
      "important"
    );

    if (trigger) {
      trigger.setAttribute(
        "aria-expanded",
        "true"
      );

      trigger.classList.remove("collapsed");
    }

    await wait(60);
  }

  // Re-query after opening any collapsed containers.
  elements = querySelectedElements();

  if (!elements.length) return false;

  const hasVisibleBox = element => {
    if (
      !element ||
      !element.getBoundingClientRect
    ) {
      return false;
    }

    const style = styleFor(element);

    if (
      style.display === "none" ||
      style.visibility === "hidden"
    ) {
      return false;
    }

    const rect =
      element.getBoundingClientRect();

    return rect.width > 1 && rect.height > 1;
  };

  let usedContainerFallback = false;
  const highlightElements = [];

  elements.forEach(element => {
    let target = element;

    if (!hasVisibleBox(target)) {
      const semanticContainer =
        element.closest(
          "li,h1,h2,h3,h4,h5,h6,p,dd,dt,figcaption,blockquote,td,th"
        );

      if (
        semanticContainer &&
        hasVisibleBox(semanticContainer)
      ) {
        target = semanticContainer;
      } else {
        let current = element.parentElement;

        while (
          current &&
          !hasVisibleBox(current)
        ) {
          current = current.parentElement;
        }

        if (current) {
          target = current;
        }
      }

      usedContainerFallback =
        target !== element;
    }

    if (
      target &&
      !highlightElements.includes(target)
    ) {
      highlightElements.push(target);
    }
  });

  if (!highlightElements.length) {
    return false;
  }

  highlightElements.forEach(element => {
    element.dataset.bcStyleCheckerOutline =
      element.style.outline;

    element.dataset.bcStyleCheckerOffset =
      element.style.outlineOffset;

    element.dataset.bcStyleCheckerHighlight =
      "true";

    element.style.outline =
      "4px solid #fcba19";

    element.style.outlineOffset = "3px";
  });

  // If the finding is inside CMS Lite, bring the
  // editor frame itself into view first.
  if (editorFrame) {
    editorFrame.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  highlightElements[0].scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  return usedContainerFallback
    ? "container"
    : true;
}

async function highlightSelector(
  selector,
  requireReport,
  activateTab = false,
  editorSource = null,
  editorRegion = null
) {
  try {
    const tab = await currentReviewTab();

    if (
      !tab ||
      !tab.id ||
      (
        requireReport &&
        (
          !state.activeReport ||
          canonicalUrl(tab.url) !== canonicalUrl(state.activeReport.page.url)
        )
      )
    ) {
      showToast("Open the scanned page to show this finding.");
      return;
    }
    const selectors = (Array.isArray(selector) ? selector : [selector]).filter(Boolean);

    if (!selectors.length) return;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["cms-lite-editor.js"]
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [
        selectors,
        editorSource || null,
        Number(editorRegion) || null
      ],
      func: revealFindingElements
    });

    const revealResult = results[0] && results[0].result;

    if (revealResult === "container") {
      showToast(
        "The exact element is invisible. Its nearest visible container is highlighted."
      );
    } else if (revealResult !== true) {
      showToast(
        "The page changed. Rescan it to refresh this location."
      );
    }

    if (activateTab) {
      await chrome.tabs.update(tab.id, { active: true });
    }
  } catch (_) {
    showToast("The page changed. Rescan it to refresh locations.");
  }
}

function findingSelectors(finding) {
  if (!finding) return "";

  return Array.isArray(finding.selectors) && finding.selectors.length
    ? finding.selectors
    : finding.selector;
}

function locateFinding(value, editorRegion = null, editorId = "") {
  if (value && typeof value === "object") {
    return highlightSelector(
      findingSelectors(value),
      true,
      workspaceSurface,
      value.editorSource || (editorId ? { textareaId: editorId } : null),
      Number(value.editorRegion) || Number(editorRegion) || null
    );
  }

  return highlightSelector(
    value,
    true,
    workspaceSurface,
    editorId ? { textareaId: editorId } : null,
    Number(editorRegion) || null
  );
}

async function clearFindingHighlight() {
  try {
    const tab = await currentReviewTab();

    if (!tab || !tab.id) return;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },

      func: () => {
        const clearInDocument = doc => {
          if (!doc) return;

          doc
            .querySelectorAll(
              "[data-bc-style-checker-highlight]"
            )
            .forEach(element => {
              element.style.outline =
                element.dataset.bcStyleCheckerOutline || "";

              element.style.outlineOffset =
                element.dataset.bcStyleCheckerOffset || "";

              delete element.dataset.bcStyleCheckerHighlight;
              delete element.dataset.bcStyleCheckerOutline;
              delete element.dataset.bcStyleCheckerOffset;
            });
        };

        clearInDocument(document);

        document
          .querySelectorAll("iframe.cke_wysiwyg_frame")
          .forEach(frame => {
            try {
              clearInDocument(frame.contentDocument);
            } catch (_) {}
          });
      }
    });
  } catch (_) { }
}

async function clearPageOverlays() {
  await clearFindingHighlight();
  const tabId = state.overlayTabId;
  if (!tabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => { if (typeof globalThis.__bcWsgOverlayCleanup === "function") globalThis.__bcWsgOverlayCleanup(); }
    });
  } catch (_) { }
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
    files: ["cms-lite-editor.js"]
  });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [mode, items],
    func: (overlayMode, overlayItems) => {
      if (typeof globalThis.__bcWsgOverlayCleanup === "function") globalThis.__bcWsgOverlayCleanup();

      const editorFrames = Array.from(
        document.querySelectorAll("iframe.cke_wysiwyg_frame")
      );

      const documentFor = item => {
        const cmsEditor = globalThis.BCWebStyleGuideCmsLite;
        const editorRegion = Number(item && item.editorRegion) || 0;
        const editorSource = item && item.editorSource;

        if (cmsEditor && (editorSource || editorRegion)) {
          const resolved = cmsEditor.findEditorFrame(
            document,
            editorSource || null,
            editorRegion || null
          );

          if (resolved && resolved.frame) {
            try {
              return resolved.frame.contentDocument || document;
            } catch (_) {
              return document;
            }
          }
        }

        if (!editorRegion || !editorFrames[editorRegion - 1]) return document;
        try {
          return editorFrames[editorRegion - 1].contentDocument || document;
        } catch (_) {
          return document;
        }
      };

      const allDocuments = [
        document,
        ...editorFrames.map(frame => {
          try { return frame.contentDocument; } catch (_) { return null; }
        }).filter(Boolean)
      ];

      const touched = [];
      const badges = [];

      const cleanup = () => {
        badges.forEach(badge => badge.remove());

        allDocuments.forEach(doc => {
          doc.querySelectorAll("[data-bc-style-checker-highlight]").forEach(temporaryHighlight => {
            temporaryHighlight.style.outline = temporaryHighlight.dataset.bcStyleCheckerOutline || "";
            temporaryHighlight.style.outlineOffset = temporaryHighlight.dataset.bcStyleCheckerOffset || "";
            delete temporaryHighlight.dataset.bcStyleCheckerHighlight;
            delete temporaryHighlight.dataset.bcStyleCheckerOutline;
            delete temporaryHighlight.dataset.bcStyleCheckerOffset;
          });
        });

        touched.forEach(element => {
          element.style.outline = element.dataset.bcWsgOverlayOutline || "";
          element.style.outlineOffset = element.dataset.bcWsgOverlayOffset || "";
          delete element.dataset.bcWsgOverlayOutline;
          delete element.dataset.bcWsgOverlayOffset;
        });

        delete globalThis.__bcWsgOverlayCleanup;
      };

      globalThis.__bcWsgOverlayCleanup = cleanup;

      const makeBadge = (doc, text, title) => {
        const badge = doc.createElement("span");
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
        const targetDocument = documentFor(item);
        let element;
        try { element = targetDocument.querySelector(item.selector); } catch (_) { element = null; }
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

        element.insertAdjacentElement(
          overlayMode === "headings" ? "beforebegin" : "afterend",
          makeBadge(targetDocument, label, overlayMode === "links" ? item.href : "")
        );
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
  const pageOnly = finding.ruleId === "proofreading-pubic";
  elements["exception-dialog-heading"].textContent = pageOnly ? "Ignore this wording on this page" : "Always allow an exact term";
  elements["exception-dialog-intro"].innerHTML = pageOnly
    ? `This exact wording will be ignored for <strong id="exception-rule-name">${escapeHtml(finding.title)}</strong> on this page only.`
    : `This term will be ignored only for <strong id="exception-rule-name">${escapeHtml(finding.title)}</strong>.`;
  elements["exception-rule-name"] = $("exception-rule-name");
  const proposed = finding.proposedPhrase || finding.flaggedToken || "";
  const unsafeBareBc = finding.ruleId === "bc-abbreviation" && normalizeSpace(proposed) === "BC";
  elements["exception-phrase"].value = unsafeBareBc ? "" : proposed;
  elements["exception-phrase"].readOnly = pageOnly;
  elements["exception-validation"].textContent = unsafeBareBc ? "Enter the complete formal name. ‘BC’ by itself cannot be allowed." : "";
  elements["exception-page-scope"].hidden = !pageOnly;
  elements["exception-site-scope"].hidden = pageOnly;
  elements["exception-all-scope"].hidden = pageOnly;
  elements["exception-guardrail"].textContent = pageOnly
    ? "This ignores ‘pubic’ in any capitalization on this page only. Other proofreading and style checks remain active."
    : "Capitalization and wording must match exactly. Single-word terms are allowed, except ‘BC’ on its own. Structure, accessibility and sentence case are still checked.";
  elements["exception-submit"].textContent = pageOnly ? "Ignore on this page" : "Allow exact term";
  const selectedRadio = document.querySelector(`input[name='exception-scope'][value='${pageOnly ? "page" : "site"}']`);
  if (selectedRadio) selectedRadio.checked = true;
  elements["exception-dialog"].showModal();
  elements["exception-phrase"].focus();
  if (!pageOnly) elements["exception-phrase"].select();
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
  if (report.settings.scope === "whole") return "Whole page";
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
    metadataDefinition("Site type", context && context.detectedProfile),
    metadataDefinition("Review area", context && context.scanScope),
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
  if (!existingNote && feedbackEmailBatchPlan().blocked) {
    renderFeedback();
    switchView("feedback");
    showToast("Send the current feedback batch before adding another note.");
    return;
  }
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
  if (state.pendingFeedbackPageChange) {
    state.pendingFeedbackPageChange = false;
    state.feedbackPreviousView = "current";
    switchView("current");
    requestAnimationFrame(() => { if (document.scrollingElement) document.scrollingElement.scrollTop = 0; });
    return;
  }
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
  const plan = feedbackEmailBatchPlan();
  showToast(plan.blocked
    ? "Feedback note saved. Send the current feedback batch to continue adding notes."
    : `Feedback note saved. ${readyFeedbackNotes().length} unsent.`);
}

function feedbackCard(note, archived = false) {
  const context = note.context || {};
  return `<article class="feedback-note-card${note.important ? " is-important" : ""}" data-feedback-id="${escapeHtml(note.id)}">
    <div class="feedback-note-top"><span class="feedback-note-type">${escapeHtml(feedbackTypeLabel(note.type))}</span>${note.important ? `<span class="profile-badge feedback-important">Important</span>` : ""}</div>
    <p>${escapeHtml(note.text)}</p>
    <span class="feedback-context-status">${note.includeContext ? "Page context included" : context.pageUrl ? "Page context excluded from reports" : "No page context captured"}</span>
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

function feedbackMailtoHref(notes) {
  const subject = feedbackSubject(notes);
  const body = feedbackReportText(notes);
  return `mailto:${FEEDBACK_RECIPIENTS.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function feedbackEmailBatchPlan(notes = readyFeedbackNotes()) {
  const ordered = notes.slice();
  if (!ordered.length) return { batch: [], overflow: [], blocked: false, oversized: false, uriLength: 0 };
  let batch = [];
  let uriLength = 0;
  for (const note of ordered) {
    const candidate = [...batch, note];
    const length = feedbackMailtoHref(candidate).length;
    if (length > MAILTO_SAFE_URI_LIMIT) break;
    batch = candidate;
    uriLength = length;
  }
  const oversized = batch.length === 0 && ordered.length > 0;
  const overflow = ordered.slice(batch.length);
  return {
    batch,
    overflow,
    blocked: overflow.length > 0 || oversized,
    oversized,
    uriLength
  };
}

function renderFeedback() {
  const ready = readyFeedbackNotes();
  const archived = archivedFeedbackNotes();
  const readyCount = ready.length;
  const plan = feedbackEmailBatchPlan(ready);
  elements["feedback-header-count"].textContent = String(readyCount);
  elements["feedback-header-count"].hidden = readyCount === 0;
  elements["feedback-ready-count"].textContent = `${readyCount} unsent${archived.length ? ` · ${archived.length} sent` : ""}`;
  elements["feedback-empty"].hidden = state.feedbackNotes.length > 0;
  elements["feedback-list"].innerHTML = feedbackGroups(ready);
  if (plan.oversized) {
    elements["feedback-send-status"].innerHTML = `<strong>Send feedback before continuing.</strong> The first unsent note is too large to fit safely in one complete email. Edit that note to shorten it.`;
  } else if (plan.blocked) {
    elements["feedback-send-status"].innerHTML = `<strong>Send feedback to continue recording notes.</strong> ${plan.batch.length} of ${readyCount} unsent note${readyCount === 1 ? "" : "s"} fit safely in the next complete email. ${plan.overflow.length} newer note${plan.overflow.length === 1 ? " stays" : "s stay"} saved for the next batch.`;
  } else if (readyCount) {
    elements["feedback-send-status"].innerHTML = `<strong>${readyCount} unsent feedback note${readyCount === 1 ? " is" : "s are"} saved on this device.</strong> The next email will include all of them.`;
  } else {
    elements["feedback-send-status"].innerHTML = `<strong>No unsent feedback.</strong>${archived.length ? ` ${archived.length} sent note${archived.length === 1 ? " remains" : "s remain"} available in the archive.` : ""}`;
  }
  elements["add-feedback-button"].disabled = plan.blocked;
  elements["create-feedback-email"].disabled = readyCount === 0 || plan.oversized;
  elements["create-feedback-email"].textContent = plan.blocked && plan.batch.length
    ? `Create email with ${plan.batch.length} note${plan.batch.length === 1 ? "" : "s"}`
    : "Create feedback email";
  elements["copy-feedback-report"].disabled = state.feedbackNotes.length === 0;
  elements["export-feedback-csv"].disabled = state.feedbackNotes.length === 0;
  elements["archived-feedback"].hidden = archived.length === 0;
  elements["archived-feedback-count"].textContent = archived.length ? `(${archived.length})` : "";
  elements["archived-feedback-list"].innerHTML = feedbackGroups(archived, true);
  renderDataManagement();
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
      if (context.detectedProfile) lines.push(`Site type: ${context.detectedProfile}`);
      if (context.scanScope) lines.push(`Review area: ${context.scanScope}`);
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

async function copyFeedbackNotes(notes) {
  if (!notes.length) return;
  await navigator.clipboard.writeText(feedbackReportText(notes));
  showToast(`${notes.length} feedback note${notes.length === 1 ? "" : "s"} copied.`);
}

function feedbackCopyChoiceLabel(note) {
  const context = note.context || {};
  const page = context.pageTitle || context.domain || "General feedback";
  const noteText = normalizeSpace(note.text);
  return `${feedbackTypeLabel(note.type)} — ${page} — ${noteText.slice(0, 120)}${noteText.length > 120 ? "…" : ""}`;
}

function renderFeedbackCopySelection() {
  const notes = state.feedbackNotes;
  elements["feedback-copy-list"].innerHTML = notes.map(note => `<label class="feedback-copy-note"><input type="checkbox" data-feedback-copy-id="${escapeHtml(note.id)}"> <span><strong>${note.archivedAt ? "Sent" : "Unsent"}</strong> · ${escapeHtml(feedbackCopyChoiceLabel(note))}</span></label>`).join("");
  updateFeedbackCopyCount();
}

function selectedFeedbackCopyNotes() {
  const selected = new Set(Array.from(elements["feedback-copy-list"].querySelectorAll("[data-feedback-copy-id]:checked")).map(input => input.dataset.feedbackCopyId));
  return state.feedbackNotes.filter(note => selected.has(note.id));
}

function updateFeedbackCopyCount() {
  const count = selectedFeedbackCopyNotes().length;
  elements["feedback-copy-count"].textContent = `${count} selected`;
  elements["feedback-copy-selected"].disabled = count === 0;
}

function setFeedbackCopySelection(mode) {
  elements["feedback-copy-list"].querySelectorAll("[data-feedback-copy-id]").forEach(input => {
    const note = state.feedbackNotes.find(item => item.id === input.dataset.feedbackCopyId);
    input.checked = mode === "all" || (mode === "unsent" && note && !note.archivedAt) || (mode === "sent" && note && Boolean(note.archivedAt));
  });
  updateFeedbackCopyCount();
}

function openFeedbackCopyDialog() {
  if (!state.feedbackNotes.length) return;
  elements["feedback-copy-selection"].hidden = true;
  elements["feedback-copy-options"].hidden = false;
  elements["feedback-copy-dialog"].showModal();
}

async function handleFeedbackCopyMode(mode) {
  if (mode === "unsent") {
    await copyFeedbackNotes(readyFeedbackNotes());
    elements["feedback-copy-dialog"].close();
    return;
  }
  if (mode === "all") {
    await copyFeedbackNotes(state.feedbackNotes);
    elements["feedback-copy-dialog"].close();
    return;
  }
  if (mode === "choose") {
    elements["feedback-copy-options"].hidden = true;
    elements["feedback-copy-selection"].hidden = false;
    renderFeedbackCopySelection();
    setFeedbackCopySelection("unsent");
  }
}

const FEEDBACK_CSV_HEADER = [
  "Note ID", "Created", "Sent", "Sent at", "Feedback type", "Important", "Feedback note", "Include page context", "Page title", "Page URL", "Domain", "Site type", "Review area", "Page section",
  "Selected page text", "Finding", "Rule ID", "Category", "Review level", "Flagged wording", "Finding evidence", "Extension version", "Rules version", "Browser"
];

function feedbackCsvRows(notes = state.feedbackNotes) {
  return notes.map(note => {
    const context = note.context || {};
    const finding = context.finding || {};
    const included = note.includeContext;
    return [
      note.id, note.createdAt, note.archivedAt ? "Yes" : "No", note.archivedAt || "", feedbackTypeLabel(note.type), note.important ? "Yes" : "No", note.text, included ? "Yes" : "No",
      included ? context.pageTitle || "" : "", included ? context.pageUrl || "" : "", included ? context.domain || "" : "", included ? context.detectedProfile || "" : "",
      included ? context.scanScope || "" : "", included ? context.pageSection || "" : "", included ? context.selectedText || "" : "", included ? finding.title || "" : "",
      included ? finding.ruleId || "" : "", included ? finding.category || "" : "", included ? finding.severity || "" : "", included ? finding.flaggedWording || "" : "",
      included ? finding.evidence || "" : "", context.extensionVersion || chrome.runtime.getManifest().version, context.rulesVersion || globalThis.BCWebStyleGuideChecker.ruleVersion, context.browser || ""
    ];
  });
}

function exportFeedbackCsv() {
  const notes = state.feedbackNotes;
  if (!notes.length) return;
  downloadCsvRows(feedbackCsvRows(notes), `web-style-guide-checker-feedback-${feedbackReportDate()}.csv`, FEEDBACK_CSV_HEADER);
}

async function createFeedbackEmail() {
  const plan = feedbackEmailBatchPlan();
  const notes = plan.batch;
  if (!notes.length) {
    showToast(plan.oversized ? "Shorten the first unsent feedback note before creating the email." : "No unsent feedback is ready to email.");
    return;
  }
  const report = feedbackReportText(notes);
  const href = feedbackMailtoHref(notes);
  if (href.length > MAILTO_SAFE_URI_LIMIT) {
    showToast("This feedback batch is too large to email safely. Edit a note to shorten it.");
    return;
  }
  try { await navigator.clipboard.writeText(report); } catch (_) {}
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  state.preparedFeedbackIds = notes.map(note => note.id);
  elements["feedback-email-message"].textContent = `The complete feedback batch (${notes.length} note${notes.length === 1 ? "" : "s"}) is in the email draft. Review it and send it from your email app.`;
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
  showToast(`${prepared.size} feedback note${prepared.size === 1 ? "" : "s"} marked sent.`);
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
    page: scope === "page" ? canonicalUrl(state.activeReport.page.url) : "",
    createdAt: new Date().toISOString()
  };
  const duplicate = state.exceptions.some(item => item.ruleId === exception.ruleId && (exception.ruleId === "proofreading-pubic" ? String(item.phrase).toLowerCase() === String(exception.phrase).toLowerCase() : item.phrase === exception.phrase) && item.domain === exception.domain && (item.page || "") === (exception.page || ""));
  if (!duplicate) state.exceptions.push(exception);
  await saveKey(STORAGE_KEYS.exceptions, state.exceptions);
  elements["exception-dialog"].close();
  renderTerms();
  await scanCurrentPage({ preserveReview: true });
  continueAfterAllowedTerm(continuation);
  showToast(duplicate
    ? (finding.ruleId === "proofreading-pubic" ? "‘Pubic’ is already ignored on this page." : "That exact-term exception already exists.")
    : (finding.ruleId === "proofreading-pubic" ? "Ignored ‘pubic’ on this page." : `Allowed “${exception.phrase}” for this rule.`));
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

function renderDataManagement() {
  const reportCount = Object.keys(state.reports).length;
  const batchPages = state.batch.records.length;
  const hasBatch = Boolean(state.batch.urls.length || batchPages);
  const unsentCount = readyFeedbackNotes().length;
  const sentCount = archivedFeedbackNotes().length;
  const preferenceCount = Object.keys(state.domainSettings).length + Number(!state.optionalChecks.nonBreakingSpace || !state.optionalChecks.passiveVoice);
  elements["page-review-data-count"].textContent = reportCount ? `${reportCount} saved` : "None saved";
  elements["batch-data-count"].textContent = hasBatch ? `${batchPages} of ${state.batch.urls.length} page${state.batch.urls.length === 1 ? "" : "s"} saved` : "None saved";
  elements["unsent-feedback-data-count"].textContent = unsentCount ? `${unsentCount} saved` : "None saved";
  elements["sent-feedback-data-count"].textContent = sentCount ? `${sentCount} saved` : "None saved";
  elements["allowed-terms-data-count"].textContent = state.exceptions.length ? `${state.exceptions.length} saved` : "None saved";
  elements["page-preferences-data-count"].textContent = preferenceCount ? `${preferenceCount} saved choice${preferenceCount === 1 ? "" : "s"}` : "Defaults in use";
  elements["clear-page-reviews"].disabled = reportCount === 0;
  elements["clear-batch-data"].disabled = !hasBatch || state.batch.running;
  elements["clear-unsent-feedback"].disabled = unsentCount === 0;
  elements["clear-sent-feedback"].disabled = sentCount === 0;
  elements["clear-allowed-terms"].disabled = state.exceptions.length === 0;
  elements["clear-page-preferences"].disabled = preferenceCount === 0;
}

async function clearSavedPageReviews() {
  const count = Object.keys(state.reports).length;
  if (!count || !confirm(`Delete ${count} saved page review${count === 1 ? "" : "s"}, including their decisions and audit notes? This cannot be undone.`)) return;
  state.reports = {};
  state.decisions = {};
  state.notes = {};
  state.reviewContexts = {};
  state.activeReport = null;
  state.activePageKey = "";
  state.lastReviewPageKey = "";
  state.lastReviewTabId = null;
  state.manualReportKey = "";
  await chrome.storage.local.remove([
    STORAGE_KEYS.reports,
    STORAGE_KEYS.decisions,
    STORAGE_KEYS.notes,
    STORAGE_KEYS.reviewContexts,
    STORAGE_KEYS.navigation
  ]);
  renderDataManagement();
  elements["data-management-status"].textContent = `${count} saved page review${count === 1 ? "" : "s"} deleted.`;
  const scannable = Boolean(state.activeTab && isScannableUrl(state.activeTab.url || ""));
  elements["scan-settings"].hidden = !scannable;
  elements["scan-button"].disabled = previewLifecycleBlocksUse() || !scannable;
  elements["cancel-settings-button"].hidden = true;
  elements["cache-note"].textContent = "";
  elements["stale-report-banner"].hidden = true;
  showCurrentState(scannable ? "idle" : "error", state.activeTab ? unsupportedScanUrlMessage(state.activeTab.url || "") : "No active browser tab was found.");
}

async function clearSavedBatch() {
  if (state.batch.running) return;
  const pages = state.batch.records.length;
  if (!(state.batch.urls.length || pages) || !confirm(`Delete the saved batch containing ${pages} completed page${pages === 1 ? "" : "s"}? This cannot be undone.`)) return;
  state.batch = initialBatchState();
  await chrome.storage.local.remove(STORAGE_KEYS.batch);
  elements["batch-urls"].value = "";
  elements["batch-error"].hidden = true;
  applyBatchStateToControls();
  renderBatchValidation();
  renderBatchProgress();
  renderDataManagement();
  elements["data-management-status"].textContent = "Saved batch data deleted.";
}

async function clearFeedbackData(archived) {
  const notes = state.feedbackNotes.filter(note => Boolean(note.archivedAt) === archived);
  const label = archived ? "sent" : "unsent";
  if (!notes.length || !confirm(`Delete ${notes.length} ${label} feedback note${notes.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
  const removing = new Set(notes.map(note => note.id));
  state.feedbackNotes = state.feedbackNotes.filter(note => !removing.has(note.id));
  state.preparedFeedbackIds = state.preparedFeedbackIds.filter(id => !removing.has(id));
  await saveKey(STORAGE_KEYS.feedback, state.feedbackNotes);
  renderFeedback();
  renderDataManagement();
  elements["data-management-status"].textContent = `${notes.length} ${label} feedback note${notes.length === 1 ? "" : "s"} deleted.`;
}

async function clearAllowedTerms() {
  const count = state.exceptions.length;
  if (!count || !confirm(`Delete ${count} allowed term${count === 1 ? "" : "s"}? Findings using these exceptions will be updated the next time each page is scanned.`)) return;
  state.exceptions = [];
  await chrome.storage.local.remove(STORAGE_KEYS.exceptions);
  renderTerms();
  elements["data-management-status"].textContent = `${count} allowed term${count === 1 ? "" : "s"} deleted. Rescan saved pages to update their findings.`;
}

async function clearPagePreferences() {
  const count = Object.keys(state.domainSettings).length + Number(!state.optionalChecks.nonBreakingSpace || !state.optionalChecks.passiveVoice);
  if (!count || !confirm("Reset saved page and optional-review preferences to their defaults?")) return;
  state.domainSettings = {};
  state.optionalChecks = { nonBreakingSpace: true, passiveVoice: true };
  await chrome.storage.local.remove([STORAGE_KEYS.domains, STORAGE_KEYS.optionalChecks]);
  elements["optional-non-breaking-space"].checked = true;
  elements["optional-passive-voice"].checked = true;
  if (state.activeTab) applySettings(defaultSettings(state.activeTab.url || ""));
  renderDataManagement();
  elements["data-management-status"].textContent = "Page and optional-review preferences reset to their defaults.";
}

function renderTerms() {
  elements["personal-term-count"].textContent = `${state.exceptions.length} saved`;
  elements["personal-terms"].innerHTML = state.exceptions.length ? state.exceptions.map(item => `
    <div class="term-row">
      <div><strong>${escapeHtml(item.phrase)}</strong><small>${escapeHtml(item.ruleTitle || item.ruleId)} · ${item.page ? "This page" : item.domain === "*" ? "All sites" : item.domain}</small></div>
      <button class="small-button remove-term" type="button" data-id="${escapeHtml(item.id)}">Remove</button>
    </div>`).join("") : `<div class="empty-state">No personal allowed terms yet.</div>`;
  elements["built-in-terms-list"].innerHTML = globalThis.BCWebStyleGuideChecker.builtInTerms.map(term => `<span class="term-chip">${escapeHtml(term)}</span>`).join("");
  elements["optional-non-breaking-space"].checked = state.optionalChecks.nonBreakingSpace;
  elements["optional-passive-voice"].checked = state.optionalChecks.passiveVoice;
  renderDataManagement();
}

const ATTENTION_RANK = {
  "nothing-flagged": 0,
  "worth-checking": 1,
  "needs-attention": 2,
  "review-first": 3
};

const ATTENTION_LABEL = {
  "review-first": "Review first",
  "needs-attention": "Needs attention",
  "worth-checking": "Worth checking",
  "nothing-flagged": "Nothing flagged"
};

function excludedOptionalCheckLabels(report) {
  const checks = report && report.settings && report.settings.optionalChecks;
  if (!checks) return [];
  const excluded = [];
  if (checks.nonBreakingSpace === false) excluded.push("Non-breaking spaces");
  if (checks.passiveVoice === false) excluded.push("Passive voice");
  return excluded;
}

function optionalCheckCoverage(report) {
  const excluded = excludedOptionalCheckLabels(report);
  return excluded.length ? `Excluded: ${excluded.join(", ")}` : "All optional checks included";
}

const STRUCTURE_RULES = new Set([
  "h1-count", "heading-skip", "heading-deep", "heading-empty", "heading-empty-sequence",
  "on-this-page-missing", "on-this-page-format", "on-this-page-links", "section-heading-density",
  "formatted-heading", "formatted-all-caps-heading", "fake-list", "list-depth", "faq-content"
]);

const PLAIN_LANGUAGE_RULES = new Set([
  "paragraph-long", "sentence-long", "reading-level", "section-reading-level", "complex-phrase", "filler-phrase",
  "passive-voice", "negative-contraction", "undefined-acronym", "latin-abbreviation", "canadian-spelling",
  "canadian-spelling-context", "formal-sentence-starter", "acronym-in-heading"
]);

const ACCESSIBILITY_REVIEW_FIRST = new Set([
  "document-language", "main-landmark", "skip-link-target", "disclosure-state", "image-alt-missing",
  "linked-image-alt", "form-label", "table-headers", "table-accordion"
]);
const ACCESSIBILITY_NEEDS = new Set(["contrast", "contrast-unverified", "broken-image", "image-alt-meaningless"]);
const ACCESSIBILITY_CONTEXTUAL_ALT = new Set(["image-alt-empty", "image-alt-length", "image-alt-prefix"]);

const LINKS_REVIEW_FIRST = new Set(["broken-http-link", "broken-anchor", "staging-url", "empty-link"]);
const LINKS_NEEDS = new Set([
  "generic-link", "split-link", "email-link-text", "phone-unlinked", "phone-link-format", "file-link-label",
  "file-link-type", "file-link-size", "file-link-label-format", "file-link-size-spacing", "file-link-type-mismatch",
  "punctuation-only-link"
]);

const HIGH_IMPACT_STYLE_RULES = new Set(["all-caps", "underline", "strikethrough", "bold-block"]);

function findingOccurrences(finding) {
  return Math.max(1, Number(finding && finding.occurrenceCount) || 1);
}

function findingsForExport(report, includeReviewed) {
  return (report.issues || []).filter(finding => includeReviewed || effectiveStatus(finding) === "open");
}

function openFindings(report) {
  return (report.issues || []).filter(finding => effectiveStatus(finding) === "open");
}

function findingArea(finding) {
  if (!finding) return "Style and proofreading";
  if (finding.category === "Page information") return "Page information";
  if (STRUCTURE_RULES.has(finding.ruleId)) return "Structure and navigation";
  if (PLAIN_LANGUAGE_RULES.has(finding.ruleId) || finding.category === "Plain language") return "Plain language";
  if (finding.category === "Accessibility" || finding.category === "Tables") return "Accessibility";
  if (finding.category === "Links") return "Links and documents";
  return "Style and proofreading";
}

function groupedFindingsForExport(report, includeReviewed) {
  const groups = new Map();
  findingsForExport(report, includeReviewed).forEach(finding => {
    const status = effectiveStatus(finding);
    const contrastSignature = finding.contrast && finding.contrast.signature ? `|${finding.contrast.signature}` : "";
    const key = `${status}|${finding.ruleId}${contrastSignature}`;
    if (!groups.has(key)) groups.set(key, { finding, status, items: [], occurrenceCount: 0, important: false, notes: [] });
    const group = groups.get(key);
    const note = auditNote(finding);
    group.items.push(finding);
    group.occurrenceCount += findingOccurrences(finding);
    group.important = group.important || Boolean(note.important);
    if (note.text && !group.notes.includes(note.text)) group.notes.push(note.text);
  });
  truncatedFindingRules(report).forEach(item => {
    const example = (report.issues || []).find(finding => finding.ruleId === item.ruleId);
    if (!example) return;
    const omittedByStatus = [
      ["open", omittedOpenCount(item)],
      ["ignored", includeReviewed ? Math.max(0, (Number(item.omitted) || 0) - omittedOpenCount(item)) : 0]
    ];
    omittedByStatus.forEach(([status, omitted]) => {
      if (!omitted) return;
      const key = `${status}|${item.ruleId}`;
      if (groups.has(key)) groups.get(key).occurrenceCount += omitted;
      else groups.set(key, {
        finding: example,
        status,
        items: [example],
        occurrenceCount: omitted,
        important: false,
        notes: []
      });
    });
  });
  return Array.from(groups.values());
}

function countRule(findings, ruleId) {
  return findings.filter(finding => finding.ruleId === ruleId).reduce((total, finding) => total + findingOccurrences(finding), 0);
}

function distinctSelectors(findings) {
  return new Set(
    findings
      .map(finding => {
        const identity =
          finding.selector ||
          finding.fingerprint ||
          finding.id;

        return identity
          ? `${editorSourceKey(finding)}|${identity}`
          : "";
      })
      .filter(Boolean)
  ).size;
}

function numericEvidenceValue(finding, pattern) {
  if (!finding) return null;
  const match = String(finding.evidence || "").match(pattern);
  return match ? Number(match[1]) : null;
}

function profileArea(name) {
  return { name, level: "nothing-flagged", reason: "" };
}

function raiseAttention(area, level, reason) {
  if (ATTENTION_RANK[level] > ATTENTION_RANK[area.level]) {
    area.level = level;
    area.reason = reason || "";
  } else if (ATTENTION_RANK[level] === ATTENTION_RANK[area.level] && !area.reason && reason) area.reason = reason;
}

function pageReviewProfile(report) {
  const findings = openFindings(report);
  const byArea = {
    "Page information": profileArea("Page information"),
    "Plain language": profileArea("Plain language"),
    "Structure and navigation": profileArea("Structure and navigation"),
    "Accessibility": profileArea("Accessibility"),
    "Links and documents": profileArea("Links and documents"),
    "Style and proofreading": profileArea("Style and proofreading")
  };

  const pageInfo = findings.filter(finding => findingArea(finding) === "Page information");
  if (pageInfo.some(finding => finding.ruleId === "page-title-missing")) raiseAttention(byArea["Page information"], "review-first", "No page title");
  else if (pageInfo.length) raiseAttention(byArea["Page information"], "worth-checking", pageInfo[0].title);

  const plain = findings.filter(finding => findingArea(finding) === "Plain language");
  const readingWords = Number(report.stats && (report.stats.readingWords ?? report.stats.words)) || 0;
  const grade = Number(report.stats && report.stats.readingGrade);
  if (Number.isFinite(grade)) {
    if (readingWords >= 75) {
      if (grade >= 12) raiseAttention(byArea["Plain language"], "review-first", `Estimated reading grade ${grade}`);
      else if (grade >= 10) raiseAttention(byArea["Plain language"], "needs-attention", `Estimated reading grade ${grade}`);
      else if (grade >= 9) raiseAttention(byArea["Plain language"], "worth-checking", `Estimated reading grade ${grade}`);
    } else if (readingWords >= 40) {
      if (grade >= 14) raiseAttention(byArea["Plain language"], "review-first", `Estimated reading grade ${grade}`);
      else if (grade >= 12) raiseAttention(byArea["Plain language"], "needs-attention", `Estimated reading grade ${grade}`);
    }
  }
  const longSentences = countRule(plain, "sentence-long");
  const sentences = Number(report.stats && report.stats.sentences) || 0;
  const longSentencePct = sentences ? longSentences / sentences : 0;
  if (longSentences >= 4 && longSentencePct >= 0.5) raiseAttention(byArea["Plain language"], "review-first", `${longSentences} of ${sentences} sentences are over 20 words`);
  else if (longSentences >= 3 && longSentencePct >= 0.3) raiseAttention(byArea["Plain language"], "needs-attention", `${longSentences} of ${sentences} sentences are over 20 words`);
  else if (longSentences) raiseAttention(byArea["Plain language"], "worth-checking", `${longSentences} long sentence${longSentences === 1 ? "" : "s"}`);

  const sectionReadability = plain.filter(finding => finding.ruleId === "section-reading-level").map(finding => ({
    finding,
    grade: Number.isFinite(finding.analysisGrade) ? finding.analysisGrade : numericEvidenceValue(finding, /reading grade:\s*([0-9.]+)/i),
    words: Number.isFinite(finding.analysisWords) ? finding.analysisWords : null
  }));
  const substantive = sectionReadability.filter(item => item.words !== null && item.words >= 75);
  if (substantive.some(item => item.grade >= 14) || substantive.filter(item => item.grade >= 12).length >= 2) {
    raiseAttention(byArea["Plain language"], "review-first", `${sectionReadability.length} difficult section${sectionReadability.length === 1 ? "" : "s"}`);
  } else if (sectionReadability.length) raiseAttention(byArea["Plain language"], "needs-attention", `${sectionReadability.length} difficult section${sectionReadability.length === 1 ? "" : "s"}`);

  const longParagraphs = countRule(plain, "paragraph-long");
  if (longParagraphs >= 3) raiseAttention(byArea["Plain language"], "needs-attention", `${longParagraphs} long paragraphs`);
  else if (longParagraphs) raiseAttention(byArea["Plain language"], "worth-checking", `${longParagraphs} long paragraph${longParagraphs === 1 ? "" : "s"}`);
  const contextualPlain = plain.filter(finding => !["reading-level", "section-reading-level", "sentence-long", "paragraph-long", "section-heading-density"].includes(finding.ruleId));
  if (contextualPlain.length) raiseAttention(byArea["Plain language"], "worth-checking", contextualPlain[0].title);

  const structure = findings.filter(finding => findingArea(finding) === "Structure and navigation");
  if (countRule(structure, "h1-count")) raiseAttention(byArea["Structure and navigation"], "review-first", "Missing or multiple H1 headings");
  if (countRule(structure, "on-this-page-links")) raiseAttention(byArea["Structure and navigation"], "review-first", "‘On this page’ navigation does not match its H2 destinations");
  const headingSkips = countRule(structure, "heading-skip");
  if (headingSkips >= 3) raiseAttention(byArea["Structure and navigation"], "review-first", `${headingSkips} heading-level skips`);
  else if (headingSkips) raiseAttention(byArea["Structure and navigation"], "needs-attention", `${headingSkips} heading-level skip${headingSkips === 1 ? "" : "s"}`);
  const densityFindings = structure.filter(finding => finding.ruleId === "section-heading-density");
  const longestDensity = densityFindings.reduce((max, finding) => Math.max(max, Number.isFinite(finding.analysisWords) ? finding.analysisWords : numericEvidenceValue(finding, /^(\d+) words/i) || 0), 0);
  if (longestDensity >= 400) raiseAttention(byArea["Structure and navigation"], "review-first", `${longestDensity} words without a heading break`);
  else if (longestDensity >= 300) raiseAttention(byArea["Structure and navigation"], "needs-attention", `${longestDensity} words without a heading break`);
  else if (longestDensity >= 200) raiseAttention(byArea["Structure and navigation"], "worth-checking", `${longestDensity} words without a heading break`);
  const structureNeeds = new Set(["heading-empty", "on-this-page-format", "fake-list", "heading-empty-sequence", "list-depth"]);
  const needsStructure = structure.filter(finding => structureNeeds.has(finding.ruleId));
  if (needsStructure.length) raiseAttention(byArea["Structure and navigation"], "needs-attention", needsStructure[0].title);
  const structureWorth = structure.filter(finding => ["heading-deep", "on-this-page-missing", "faq-content"].includes(finding.ruleId));
  if (structureWorth.length) raiseAttention(byArea["Structure and navigation"], "worth-checking", structureWorth[0].title);

  const accessibility = findings.filter(finding => findingArea(finding) === "Accessibility");
  const accessibilityBarrier = accessibility.find(finding => ACCESSIBILITY_REVIEW_FIRST.has(finding.ruleId));
  if (accessibilityBarrier) raiseAttention(byArea.Accessibility, "review-first", accessibilityBarrier.title);
  const accessibilityNeed = accessibility.find(finding => ACCESSIBILITY_NEEDS.has(finding.ruleId));
  if (accessibilityNeed) raiseAttention(byArea.Accessibility, "needs-attention", accessibilityNeed.title);
  const contextualAlt = accessibility.filter(finding => ACCESSIBILITY_CONTEXTUAL_ALT.has(finding.ruleId));
  const imageCount = Number(report.pageDetails && report.pageDetails.counts && report.pageDetails.counts.images) || Number(report.stats && report.stats.images) || 0;
  const affectedAltImages = distinctSelectors(contextualAlt);
  if (affectedAltImages >= 2 && imageCount && affectedAltImages / imageCount >= 0.5) raiseAttention(byArea.Accessibility, "needs-attention", `${affectedAltImages} of ${imageCount} images have alt-text review findings`);
  else if (accessibility.length) raiseAttention(byArea.Accessibility, "worth-checking", accessibility[0].title);

  const links = findings.filter(finding => findingArea(finding) === "Links and documents");
  const linkBarrier = links.find(finding => LINKS_REVIEW_FIRST.has(finding.ruleId));
  if (linkBarrier) raiseAttention(byArea["Links and documents"], "review-first", linkBarrier.title);
  const linkNeed = links.find(finding => LINKS_NEEDS.has(finding.ruleId));
  if (linkNeed) raiseAttention(byArea["Links and documents"], "needs-attention", linkNeed.title);
  if (links.length) raiseAttention(byArea["Links and documents"], "worth-checking", links[0].title);

  const style = findings.filter(finding => findingArea(finding) === "Style and proofreading");
  const fixStyle = style.filter(finding => finding.severity === "fix");
  const fixCount = fixStyle.reduce((total, finding) => total + findingOccurrences(finding), 0);
  const distinctFixRules = new Set(fixStyle.map(finding => finding.ruleId)).size;
  const highImpactCounts = Array.from(HIGH_IMPACT_STYLE_RULES).map(ruleId => ({ ruleId, count: countRule(style, ruleId) })).sort((a, b) => b.count - a.count);
  const mostPervasive = highImpactCounts[0] || { ruleId: "", count: 0 };
  if ((fixCount >= 8 && distinctFixRules >= 4) || mostPervasive.count >= 4) {
    const reason = mostPervasive.count >= 4
      ? `${mostPervasive.count} ${style.find(finding => finding.ruleId === mostPervasive.ruleId)?.title.toLowerCase() || "high-impact formatting"} findings`
      : `${fixCount} high-confidence fixes across ${distinctFixRules} style rules`;
    raiseAttention(byArea["Style and proofreading"], "review-first", reason);
  } else if ((fixCount >= 5 && distinctFixRules >= 2) || mostPervasive.count >= 2) {
    const reason = mostPervasive.count >= 2
      ? `${mostPervasive.count} ${style.find(finding => finding.ruleId === mostPervasive.ruleId)?.title.toLowerCase() || "high-impact formatting"} findings`
      : `${fixCount} high-confidence fixes across ${distinctFixRules} style rules`;
    raiseAttention(byArea["Style and proofreading"], "needs-attention", reason);
  } else if (style.length) raiseAttention(byArea["Style and proofreading"], "worth-checking", style[0].title);

  return Object.values(byArea);
}

function attentionCounts(profile) {
  const output = { "review-first": 0, "needs-attention": 0, "worth-checking": 0, "nothing-flagged": 0 };
  profile.forEach(area => { output[area.level] += 1; });
  return output;
}

function pageReviewPriority(profile) {
  const levels = (profile || []).map(area => area.level);
  if (levels.includes("review-first")) return "Review first";
  if (levels.includes("needs-attention")) return "Needs attention";
  if (levels.includes("worth-checking")) return "Worth checking";
  return "Nothing flagged";
}

function mainConcerns(profile, limit = 3) {
  return profile
    .filter(area => area.level !== "nothing-flagged")
    .sort((a, b) => ATTENTION_RANK[b.level] - ATTENTION_RANK[a.level])
    .slice(0, limit)
    .map(area => area.reason ? `${area.name}: ${area.reason}` : `${area.name}: ${ATTENTION_LABEL[area.level]}`);
}

function pagePriorityCompare(first, second) {
  const firstCounts = attentionCounts(first.profile || pageReviewProfile(first.report));
  const secondCounts = attentionCounts(second.profile || pageReviewProfile(second.report));
  if (secondCounts["review-first"] !== firstCounts["review-first"]) return secondCounts["review-first"] - firstCounts["review-first"];
  if (secondCounts["needs-attention"] !== firstCounts["needs-attention"]) return secondCounts["needs-attention"] - firstCounts["needs-attention"];
  const firstFixes = openFindings(first.report).filter(finding => finding.severity === "fix").reduce((total, finding) => total + findingOccurrences(finding), 0);
  const secondFixes = openFindings(second.report).filter(finding => finding.severity === "fix").reduce((total, finding) => total + findingOccurrences(finding), 0);
  if (secondFixes !== firstFixes) return secondFixes - firstFixes;
  if (secondCounts["worth-checking"] !== firstCounts["worth-checking"]) return secondCounts["worth-checking"] - firstCounts["worth-checking"];
  return String(first.report.page.title || "").localeCompare(String(second.report.page.title || ""));
}

function linkCheckCoverage(report) {
  const check = report && report.linkCheck;
  if (!check) return "Not checked";
  if (check.state === "permission-denied") return "Website access declined";
  if (check.state === "complete" && (check.completed || 0) >= (check.totalFound || 0)) return "Complete";
  if ((check.completed || 0) > 0) return "Partially checked";
  return "Not checked";
}

function reportText(report, includeReviewed) {
  return issueSummaryText(report, includeReviewed);
}

function issueSummaryText(report, includeReviewed) {
  const findings = findingsForExport(report, includeReviewed);
  const groups = groupedFindingsForExport(report, includeReviewed);
  const lines = [
    "B.C. Web Style Guide issue summary",
    report.page.title,
    report.page.url,
    `Checked: ${formatDate(report.scannedAt)}`,
    `Automated findings detected: ${findings.reduce((total, finding) => total + findingOccurrences(finding), 0) + omittedFindingCountForExport(report, includeReviewed)} · Issue types: ${new Set([...findings.map(finding => finding.ruleId), ...truncatedFindingRules(report).filter(item => includeReviewed || omittedOpenCount(item)).map(item => item.ruleId)]).size}`,
    `Finding coverage: ${findingCoverageText(report)}`,
    "",
    "Automated findings identify items to review. They are not confirmed compliance failures.",
    ""
  ];
  groups.forEach((group, index) => {
    const finding = group.finding;
    lines.push(`${index + 1}. ${finding.title} — ${sentenceLabel(finding.severity)} · ${sentenceLabel(group.status)}${group.important ? " · Important" : ""}`);
    lines.push(`   Area: ${findingArea(finding)}`);
    lines.push(`   Findings: ${group.occurrenceCount}`);
    lines.push(`   Where: ${Array.from(new Set(group.items.map(item => item.location || "Page"))).join("; ")}`);
    lines.push(`   What to do: ${finding.suggestion}`);
    if (group.items.length) lines.push(`   Example: ${group.items[0].evidence}`);
    if (group.notes.length) lines.push(`   Audit note: ${group.notes.join(" | ")}`);
    lines.push(`   Guidance: ${finding.sourceUrl}`);
    lines.push("");
  });
  return lines.join("\n");
}

function detailedFindingsText(report, includeReviewed) {
  const findings = findingsForExport(report, includeReviewed);
  const lines = [
    "B.C. Web Style Guide findings detail",
    report.page.title,
    report.page.url,
    `Checked: ${formatDate(report.scannedAt)}`,
    `Finding rows: ${findings.length} · Occurrences: ${findings.reduce((total, finding) => total + findingOccurrences(finding), 0)}`,
    `Finding coverage: ${findingCoverageText(report)}`,
    ""
  ];
  findings.forEach((finding, index) => {
    const note = auditNote(finding);
    lines.push(`${index + 1}. ${finding.title} — ${sentenceLabel(finding.severity)} · ${sentenceLabel(effectiveStatus(finding))}`);
    lines.push(`   Where: ${finding.location || "Page"}`);
    lines.push(`   Evidence: ${evidenceTextForExport(finding).replace(/\n/g, "\n             ")}`);
    if (findingOccurrences(finding) > 1) lines.push(`   Occurrences: ${findingOccurrences(finding)}`);
    if (finding.flaggedToken || finding.matchText) lines.push(`   Flagged wording: ${finding.flaggedToken || finding.matchText}`);
    lines.push(`   What to do: ${finding.suggestion}`);
    lines.push(`   Why it matters: ${finding.why}`);
    if (note.important) lines.push("   Important: Yes");
    if (note.text) lines.push(`   Audit note: ${note.text}`);
    lines.push(`   Guidance: ${finding.sourceUrl}`);
    lines.push("");
  });
  return lines.join("\n");
}

const FINDING_DETAIL_HEADER = [
  "Finding ID", "Page", "Page URL", "Where on the page", "Area", "Category", "Issue", "Review level",
  "Status", "Evidence", "Flagged wording", "Recommended action", "Why it matters", "Important",
  "Audit note", "Guidance", "Rule ID", "Occurrences"
];

const ISSUE_SUMMARY_HEADER = [
  "Issue", "Area", "Category", "Review level", "Status", "Findings", "Sections affected", "Example evidence",
  "Recommended action", "Guidance", "Rule ID"
];

function findingDetailRows(report, includeReviewed, submittedUrl, pageNumber) {
  const prefix = `P${String(pageNumber || 1).padStart(3, "0")}`;
  return findingsForExport(report, includeReviewed).map((finding, index) => {
    const note = auditNote(finding);
    return [
      `${prefix}-F${String(index + 1).padStart(3, "0")}`, report.page.title, report.page.url || submittedUrl,
      finding.location || "Page", findingArea(finding), finding.category, finding.title, sentenceLabel(finding.severity),
      sentenceLabel(effectiveStatus(finding)), evidenceTextForExport(finding), finding.flaggedToken || finding.matchText || "",
      finding.suggestion, finding.why, note.important ? "Yes" : "", note.text || "", finding.sourceUrl, finding.ruleId, findingOccurrences(finding)
    ];
  });
}

function issueSummaryRows(report, includeReviewed) {
  return groupedFindingsForExport(report, includeReviewed)
    .slice()
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.finding.title.localeCompare(b.finding.title))
    .map(group => [
    group.finding.title, findingArea(group.finding), group.finding.category, sentenceLabel(group.finding.severity), sentenceLabel(group.status),
    group.occurrenceCount, Array.from(new Set(group.items.map(item => item.location || "Page"))).join("; "),
    group.items[0] ? evidenceTextForExport(group.items[0]) : "", group.finding.suggestion, group.finding.sourceUrl, group.finding.ruleId
  ]);
}

// Backwards-compatible names used by the CSV action and older tests.
const ACTION_HEADER = FINDING_DETAIL_HEADER;
function actionRows(report, includeReviewed, submittedUrl, pageNumber) {
  return findingDetailRows(report, includeReviewed, submittedUrl, pageNumber);
}

function sheetRow(values, kind = "body") {
  return { values, kind };
}

function summarySheetRows(report) {
  const profile = pageReviewProfile(report);
  const open = openFindings(report);
  const counts = reportCounts(report);
  const fix = counts.fix;
  const check = counts.check;
  const review = counts.review;
  const longSentences = countRule(open, "sentence-long");
  const longParagraphs = countRule(open, "paragraph-long");
  const difficultSections = countRule(open, "section-reading-level");
  const longestWithoutHeading = open.filter(finding => finding.ruleId === "section-heading-density")
    .reduce((max, finding) => Math.max(max, Number.isFinite(finding.analysisWords) ? finding.analysisWords : numericEvidenceValue(finding, /^(\d+) words/i) || 0), 0);
  const rows = [
    sheetRow(["B.C. Web Style Guide review"], "title"),
    sheetRow(["Page", report.page.title]),
    sheetRow(["URL", report.page.url]),
    sheetRow(["Checked", formatDate(report.scannedAt)]),
    sheetRow(["Scope", `${report.settings.scope === "whole" ? "Whole page" : "Page content"} · ${report.settings.profileLabel}`]),
    sheetRow(["Optional review checks", optionalCheckCoverage(report)]),
    sheetRow(["Finding coverage", findingCoverageText(report)]),
    sheetRow(["Link check", linkCheckCoverage(report)]),
    sheetRow(["Link check results", linkCheckResultSummary(report)]),
    sheetRow(["Automated review profile"], "section"),
    sheetRow(["Area", "Attention", "Main reason"], "header"),
    ...profile.map(area => sheetRow([area.name, ATTENTION_LABEL[area.level], area.reason || "—"], `status-${area.level}`)),
    sheetRow(["Page measures"], "section"),
    sheetRow(["Measure", "Value", "Context"], "header"),
    sheetRow(["Estimated reading grade", report.stats.readingGrade === null ? "Not available" : report.stats.readingGrade, `${report.stats.readingWords || report.stats.words || 0} words included in estimate`]),
    sheetRow(["Words", report.stats.words || 0, "Scanned content"]),
    sheetRow(["Sentences checked", report.stats.sentences || 0, longSentences ? `${longSentences} sentences with over 20 words` : "No long-sentence findings"]),
    sheetRow(["Long paragraphs", longParagraphs, "Automated paragraph-length findings"]),
    sheetRow(["Difficult sections", difficultSections, "Separate section-readability findings"]),
    sheetRow(["Longest content without heading", longestWithoutHeading || 0, longestWithoutHeading ? "words" : "No heading-density finding"]),
    sheetRow(["Open automated findings"], "section"),
    sheetRow(["Review level", "Findings"], "header"),
    sheetRow(["Fix", fix]),
    sheetRow(["Check", check]),
    sheetRow(["Review", review]),
    sheetRow(["Total", fix + check + review]),
    sheetRow(["Issue types", new Set(open.map(finding => finding.ruleId)).size]),
    sheetRow(["How to interpret this report"], "section"),
    sheetRow([fix + check + review
      ? "Automated findings identify items to review; they are not confirmed compliance failures. “Nothing flagged” means the checker did not flag anything in that area, not that the page passed an accessibility or quality assessment."
      : "No automated findings were recorded. This does not mean the page passed an accessibility, quality or compliance assessment; the checker covers only the rules it can evaluate."], "note")
  ];
  return rows;
}

function pageDetailsRows(report) {
  const details = report.pageDetails || { counts: {}, headings: [] };
  const counts = details.counts || {};
  return [
    ["Measure", "Value"],
    ["Words", report.stats.words || 0],
    ["Sentences checked", report.stats.sentences || 0],
    ["Estimated reading grade", report.stats.readingGrade === null ? "" : report.stats.readingGrade],
    ["Authored headings", (details.headings || []).filter(heading => report.settings.profile !== "cms-lite" || !heading.component).length],
    ["CMS-generated headings", report.settings.profile === "cms-lite" ? (details.headings || []).filter(heading => heading.component).length : 0],
    ["Links", counts.links || 0],
    ["Images", counts.images || 0],
    ["Images missing alt", counts.imagesMissingAlt || 0],
    ["Document/asset links", counts.assets || 0],
    ["Lists", counts.lists || 0],
    ["Tables", counts.tables || 0],
    ["Forms", counts.forms || 0],
    ["Accordions", counts.accordions || 0],
    ["Link check coverage", linkCheckCoverage(report)],
    ["Rules version", report.ruleVersion || ""]
  ];
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

function downloadTextFile(textValue, filename) {
  const blob = new Blob([String(textValue || "")], { type: "text/plain;charset=utf-8" });
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

function isWorkbookUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function workbookCellStyle(kind, rowIndex, value) {
  if (isWorkbookUrl(value) && kind !== "header" && kind !== "title") return 9;
  if (value === "Review first" || value === "Scan failed") return 5;
  if (value === "Needs attention" || value === "Website access declined") return 6;
  if (value === "Worth checking") return 7;
  if (value === "Nothing flagged") return 8;
  if (kind === "title") return 2;
  if (kind === "section") return 3;
  if (kind === "note") return 4;
  if (kind === "status-review-first") return 5;
  if (kind === "status-needs-attention") return 6;
  if (kind === "status-worth-checking") return 7;
  if (kind === "status-nothing-flagged") return 8;
  if (kind === "header" || rowIndex === 0) return 1;
  return 0;
}

function normalizeSheetRows(sheet) {
  return (sheet.rows || []).map(row => Array.isArray(row) ? { values: row, kind: "body" } : row);
}

function estimatedWorkbookRowHeight(row, widths) {
  const kind = row.kind || "body";
  const base = kind === "title" ? 30 : kind === "section" ? 22 : kind === "header" ? 26 : 18;
  const hasExplicitLineBreaks = (row.values || []).some(cell => /\r?\n/.test(String(cell ?? "")));
  const maxLines = (row.values || []).reduce((max, cell, index) => {
    const width = Math.max(8, Number(widths[index]) || 12);
    const lines = String(cell ?? "").split(/\r?\n/).reduce((total, line) => total + Math.max(1, Math.ceil(line.length / Math.max(8, width - 1))), 0);
    return Math.max(max, lines);
  }, 1);
  const cap = kind === "note" ? 4 : kind === "title" ? 2 : kind === "header" || kind === "section" ? 2 : hasExplicitLineBreaks ? 7 : 3;
  const maximum = kind === "note" ? 72 : hasExplicitLineBreaks ? 126 : 54;
  return Math.max(base, Math.min(maximum, 18 * Math.min(maxLines, cap)));
}

function worksheetHyperlinks(sheet) {
  const rows = normalizeSheetRows(sheet);
  const links = [];
  rows.forEach((row, rowIndex) => (row.values || []).forEach((cell, columnIndex) => {
    if (!isWorkbookUrl(cell)) return;
    links.push({ ref: `${columnName(columnIndex)}${rowIndex + 1}`, target: String(cell).trim() });
  }));
  return links;
}

function worksheetXml(sheet) {
  const rows = normalizeSheetRows(sheet);
  const widths = [];
  rows.forEach(row => (row.values || []).forEach((cell, index) => {
    const text = String(cell ?? "");
    const longestLine = text.split(/\r?\n/).reduce((max, line) => Math.max(max, line.length), 0);
    widths[index] = Math.min((sheet.maxColumnWidth || 42), Math.max(widths[index] || 9, Math.min(longestLine + 2, sheet.maxColumnWidth || 42)));
  }));
  (sheet.widths || []).forEach((width, index) => { if (Number.isFinite(width)) widths[index] = width; });
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const data = rows.map((row, rowIndex) => {
    const kind = row.kind || "body";
    const height = estimatedWorkbookRowHeight(row, widths);
    return `<row r="${rowIndex + 1}" ht="${height}" customHeight="1">${(row.values || []).map((cell, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      const cellStyle = workbookCellStyle(kind, rowIndex, cell);
      if (typeof cell === "number" && Number.isFinite(cell)) return `<c r="${reference}" s="${cellStyle}"><v>${cell}</v></c>`;
      if (typeof cell === "boolean") return `<c r="${reference}" s="${cellStyle}" t="b"><v>${cell ? 1 : 0}</v></c>`;
      return `<c r="${reference}" t="inlineStr" s="${cellStyle}"><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`;
    }).join("")}</row>`;
  }).join("");
  const maxColumns = rows.reduce((max, row) => Math.max(max, (row.values || []).length), 0);
  const last = rows.length && maxColumns ? `${columnName(maxColumns - 1)}${rows.length}` : "A1";
  const filterRow = Number(sheet.filterRow) || 0;
  const filterLast = filterRow && maxColumns ? `${columnName(maxColumns - 1)}${rows.length}` : "";
  const autoFilter = filterRow && rows.length >= filterRow ? `<autoFilter ref="A${filterRow}:${filterLast}"/>` : "";
  const hyperlinks = worksheetHyperlinks(sheet);
  const hyperlinkXml = hyperlinks.length ? `<hyperlinks>${hyperlinks.map((link, index) => `<hyperlink ref="${link.ref}" r:id="rId${index + 1}"/>`).join("")}</hyperlinks>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${cols}</cols><sheetData>${data}</sheetData>${autoFilter}${hyperlinkXml}<pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

function worksheetRelationshipsXml(sheet) {
  const hyperlinks = worksheetHyperlinks(sheet);
  if (!hyperlinks.length) return "";
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hyperlinks.map((link, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(link.target)}" TargetMode="External"/>`).join("")}</Relationships>`;
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
    const local = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    parts.push(local, name, data);
    const header = new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]);
    central.push(header, name);
    offset += local.length + name.length + data.length;
  });
  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  return new Blob([...parts, ...central, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function buildWorkbookBlob(sheets) {
  const used = new Set();
  const normalized = sheets.filter(sheet => sheet && sheet.rows && sheet.rows.length).map(sheet => {
    const base = String(sheet.name || "Sheet").replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
    let name = base;
    let number = 2;
    while (used.has(name)) { name = `${base.slice(0, 27)} ${number}`; number += 1; }
    used.add(name);
    return { ...sheet, name };
  });
  if (!normalized.length) return null;
  const files = [];
  const typeOverrides = normalized.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  files.push({ name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${typeOverrides}</Types>` });
  files.push({ name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` });
  files.push({ name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${normalized.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>` });
  files.push({ name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${normalized.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${normalized.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` });
  files.push({ name: "xl/styles.xml", data: `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="11"/><name val="BC Sans"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="BC Sans"/></font><font><b/><color rgb="FF013366"/><sz val="16"/><name val="BC Sans"/></font><font><i/><color rgb="FF4A5568"/><sz val="10"/><name val="BC Sans"/></font><font><u/><color rgb="FF0563C1"/><sz val="11"/><name val="BC Sans"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF013366"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F1F8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDECEC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF3CD"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF2F8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="6" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="7" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` });
  normalized.forEach((sheet, index) => {
    files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, data: worksheetXml(sheet) });
    const relationships = worksheetRelationshipsXml(sheet);
    if (relationships) files.push({ name: `xl/worksheets/_rels/sheet${index + 1}.xml.rels`, data: relationships });
  });
  return zipStore(files);
}

function downloadWorkbook(sheets, filename) {
  const blob = buildWorkbookBlob(sheets);
  if (!blob) { showToast("Choose at least one workbook section."); return false; }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return true;
}

async function copyCurrentDetailedFindings() {
  if (!state.activeReport) return;
  const confirmation = elements["current-export-confirmation"];
  try {
    await navigator.clipboard.writeText(detailedFindingsText(state.activeReport, elements["current-export-reviewed"].checked));
    confirmation.textContent = "Detailed findings copied.";
    confirmation.hidden = false;
    elements["copy-detailed-findings"].textContent = "Copied";
  } catch (_) {
    confirmation.textContent = "The findings could not be copied. Try again.";
    confirmation.hidden = false;
  }
  clearTimeout(copyCurrentDetailedFindings.timeout);
  copyCurrentDetailedFindings.timeout = setTimeout(() => {
    confirmation.hidden = true;
    updateCurrentExportDialog();
  }, 2400);
}

const BATCH_METADATA_HEADER = [
  "Page", "Submitted URL", "Final URL", "Domain", "Scanned at", "Optional review checks", "HTML title", "Meta description", "Keywords", "Robots", "Page language",
  "Open Graph title", "Open Graph description", "Twitter title", "Twitter description", "Alternate languages", "Additional published metadata"
];

const LINK_EXPORT_HEADER = ["Page", "Page URL", "Where on the page", "Link text", "Destination", "Check result", "HTTP code", "Checked destination", "Final destination", "Detail", "Occurrences"];

function metadataCustomValue(metadata, name) {
  return (metadata.custom || []).filter(item => String(item.name).toLowerCase() === name.toLowerCase()).map(item => item.value).join("; ");
}

function batchMetadataValues(report) {
  const metadata = (report.pageDetails && report.pageDetails.metadata) || {};
  const individuallyExported = new Set(["keywords", "robots", "og:title", "og:description", "twitter:title", "twitter:description"]);
  const additional = [
    metadata.jsonLdCount ? `JSON-LD blocks: ${metadata.jsonLdCount}` : "",
    ...(metadata.custom || []).filter(item => !individuallyExported.has(String(item.name).toLowerCase())).map(item => `${item.name}: ${item.value}`)
  ].filter(Boolean).join("; ");
  return [
    metadata.documentTitle || "", metadata.description || "", metadata.keywords || "", metadata.robots || "",
    metadata.language || "", metadataCustomValue(metadata, "og:title"), metadataCustomValue(metadata, "og:description"),
    metadataCustomValue(metadata, "twitter:title"), metadataCustomValue(metadata, "twitter:description"),
    (metadata.alternates || []).map(item => `${item.language}: ${item.href}`).join("; "),
    additional
  ];
}

function metadataRow(report, submittedUrl) {
  return [report.page.title, submittedUrl || report.page.url, report.page.url, report.page.hostname, report.scannedAt, optionalCheckCoverage(report), ...batchMetadataValues(report)];
}

function linkResultLabel(status) {
  return LINK_RESULT_LABELS[status] || sentenceLabel(status || "Not checked");
}

function linkCheckResultSummary(report) {
  const check = report && report.linkCheck;
  if (!check) return "Not checked";
  if (!(check.totalFound || 0)) return "No web destinations to check";
  const parts = [];
  if (check.okay) parts.push(`${check.okay} working`);
  if (check.broken) parts.push(`${check.broken} broken`);
  if (check.liveNotFound) parts.push(`${check.liveNotFound} live version${check.liveNotFound === 1 ? "" : "s"} not found`);
  if (check.qaOnly) parts.push(`${check.qaOnly} available in QA but not found live`);
  if (check.liveOnly) parts.push(`${check.liveOnly} available live but not found in QA`);
  if (check.cmsOnly) parts.push(`${check.cmsOnly} available only in CMS Lite`);
  if (check.cmsPublishingUnverified) parts.push(`${check.cmsPublishingUnverified} CMS Lite asset publication state unverified`);
  if (check.qaLiveUnverified) parts.push(`${check.qaLiveUnverified} available in QA with live version unverified`);
  if (check.sessionUnverified) parts.push(`${check.sessionUnverified} could not be verified automatically`);
  if (check.safetyBlocked) parts.push(`${check.safetyBlocked} not checked for safety`);
  if (check.redirects) parts.push(`${check.redirects} redirect${check.redirects === 1 ? "" : "s"} to review`);
  if (check.signInRequired) parts.push(`${check.signInRequired} sign-in redirect${check.signInRequired === 1 ? "" : "s"} encountered`);
  if (check.serverErrors) parts.push(`${check.serverErrors} server error${check.serverErrors === 1 ? "" : "s"}`);
  const couldNotVerify = (check.permissionRequired || 0) + (check.restricted || 0) + (check.rateLimited || 0) + (check.clientErrors || 0) + (check.unavailable || 0);
  if (couldNotVerify) parts.push(`${couldNotVerify} could not be verified`);
  if (check.pending) parts.push(`${check.pending} not checked`);
  return parts.join(" · ") || linkCheckCoverage(report);
}

function aggregateLinkCheckResultSummary(reports) {
  const checks = (reports || []).map(report => report && report.linkCheck).filter(Boolean);
  if (!checks.length) return "Not checked";
  const total = key => checks.reduce((sum, check) => sum + (Number(check[key]) || 0), 0);
  const totalFound = total("totalFound");
  if (!totalFound) return "No web destinations to check";
  const okay = total("okay");
  const broken = total("broken");
  const liveNotFound = total("liveNotFound");
  const qaOnly = total("qaOnly");
  const liveOnly = total("liveOnly");
  const cmsOnly = total("cmsOnly");
  const cmsPublishingUnverified = total("cmsPublishingUnverified");
  const qaLiveUnverified = total("qaLiveUnverified");
  const sessionUnverified = total("sessionUnverified");
  const safetyBlocked = total("safetyBlocked");
  const redirects = total("redirects");
  const signInRequired = total("signInRequired");
  const serverErrors = total("serverErrors");
  const couldNotVerify = total("permissionRequired") + total("restricted") + total("rateLimited") + total("clientErrors") + total("unavailable");
  const pending = total("pending");
  const parts = [];
  if (okay) parts.push(`${okay} working`);
  if (broken) parts.push(`${broken} broken`);
  if (liveNotFound) parts.push(`${liveNotFound} live version${liveNotFound === 1 ? "" : "s"} not found`);
  if (qaOnly) parts.push(`${qaOnly} available in QA but not found live`);
  if (liveOnly) parts.push(`${liveOnly} available live but not found in QA`);
  if (cmsOnly) parts.push(`${cmsOnly} available only in CMS Lite`);
  if (cmsPublishingUnverified) parts.push(`${cmsPublishingUnverified} CMS Lite asset publication state unverified`);
  if (qaLiveUnverified) parts.push(`${qaLiveUnverified} available in QA with live version unverified`);
  if (sessionUnverified) parts.push(`${sessionUnverified} could not be verified automatically`);
  if (safetyBlocked) parts.push(`${safetyBlocked} not checked for safety`);
  if (redirects) parts.push(`${redirects} redirect${redirects === 1 ? "" : "s"} to review`);
  if (signInRequired) parts.push(`${signInRequired} sign-in redirect${signInRequired === 1 ? "" : "s"} encountered`);
  if (serverErrors) parts.push(`${serverErrors} server error${serverErrors === 1 ? "" : "s"}`);
  if (couldNotVerify) parts.push(`${couldNotVerify} could not be verified`);
  if (pending) parts.push(`${pending} not checked`);
  return parts.join(" · ") || "Checked";
}

function linkRows(report) {
  const allLinks = (((report.pageDetails || {}).links) || []);
  const results = report.linkCheck && Array.isArray(report.linkCheck.results) ? report.linkCheck.results : [];
  const resultByDestination = new Map();
  results.forEach(result => {
    const key = result.linkKey || remoteLinkKey(result.link) || canonicalUrl(result.checkedUrl || "");
    if (key) resultByDestination.set(key, result);
  });
  return allLinks.map(link => {
    const prepared = prepareRemoteLink(link, report.page.url);
    const result = prepared ? resultByDestination.get(remoteLinkKey(prepared)) : null;
    let checkResult = "Not checked";
    let detail = "";
    if (result) {
      checkResult = linkResultLabel(result.status);
      const environmentDetail = [];
      if (result.cmsCheckedUrl) environmentDetail.push(`CMS Lite: ${result.cmsStatus === "ok" ? "Working" : linkResultLabel(result.cmsStatus)}${result.cmsCode ? ` (HTTP ${result.cmsCode})` : ""}`);
      if (result.qaCheckedUrl) environmentDetail.push(`QA: ${result.qaStatus === "ok" ? "Working" : result.qaStatus === "broken" ? "Not found" : linkResultLabel(result.qaStatus)}${result.qaCode ? ` (HTTP ${result.qaCode})` : ""}`);
      if (result.liveCheckedUrl) environmentDetail.push(`Live: ${result.liveStatus === "ok" ? "Working" : result.liveStatus === "broken" ? "Not found" : linkResultLabel(result.liveStatus)}${result.liveCode ? ` (HTTP ${result.liveCode})` : ""}`);
      detail = [...environmentDetail, result.error || ""].filter(Boolean).join(" · ");
    } else if (String(link.rawHref || "").startsWith("#")) checkResult = "Checked on page";
    else if (link.kind === "email") checkResult = "Email link · not a web check";
    else if (link.kind === "phone") checkResult = "Phone link · not a web check";
    else if (!prepared && /^https?:/i.test(String(link.href || ""))) checkResult = "Same-page link · not a web check";
    return [
      report.page.title, report.page.url, link.location || "Page", link.text || "[No accessible name]", link.href || link.rawHref || "",
      checkResult, result ? (result.code || "") : "", result ? (result.checkedUrl || "") : "", result ? (result.finalUrl || "") : "", detail, 1
    ];
  });
}

function checkedSheetNames(ids) {
  return new Set(ids.filter(id => elements[id] && elements[id].checked).map(id => elements[id].dataset.sheet).filter(Boolean));
}

function currentCustomSheetNames() {
  return checkedSheetNames([
    "current-custom-summary", "current-custom-issues", "current-custom-findings",
    "current-custom-page-details", "current-custom-links", "current-custom-metadata"
  ]);
}

const CURRENT_LINK_SENSITIVE_SHEETS = new Set(["Summary", "Issue summary", "Findings detail", "Page details", "Links"]);

function workbookSheetsNeedLinkCheck(sheetNames) {
  return Array.from(sheetNames || []).some(name => CURRENT_LINK_SENSITIVE_SHEETS.has(name));
}

function currentWorkbookNeedsLinkCheck() {
  const preset = elements["current-export-preset"].value || "full";
  if (preset === "full") return true;
  if (preset === "custom") return workbookSheetsNeedLinkCheck(currentCustomSheetNames());
  return true;
}

function batchCustomSheetNames() {
  return checkedSheetNames([
    "batch-custom-summary", "batch-custom-pages", "batch-custom-site-wide", "batch-custom-issues-page",
    "batch-custom-findings", "batch-custom-links", "batch-custom-metadata", "batch-custom-scan-log"
  ]);
}

function currentWorkbookSheets() {
  if (!state.activeReport) return [];
  const report = state.activeReport;
  const includeReviewed = elements["current-export-reviewed"].checked;
  const preset = elements["current-export-preset"].value || "full";
  const allSheets = [
    { name: "Summary", rows: summarySheetRows(report), widths: [40, 24, 72], maxColumnWidth: 72 },
    { name: "Issue summary", rows: [ISSUE_SUMMARY_HEADER, ...issueSummaryRows(report, includeReviewed)], filterRow: 1, widths: [34, 24, 22, 14, 14, 10, 36, 60, 60, 54, 24], maxColumnWidth: 60 },
    { name: "Findings detail", rows: [FINDING_DETAIL_HEADER, ...findingDetailRows(report, includeReviewed)], filterRow: 1, widths: [14, 32, 48, 34, 24, 20, 36, 14, 14, 64, 24, 64, 64, 12, 40, 54, 24, 12], maxColumnWidth: 64 },
    { name: "Page details", rows: pageDetailsRows(report), filterRow: 1, widths: [34, 54], maxColumnWidth: 54 },
    { name: "Links", rows: [LINK_EXPORT_HEADER, ...linkRows(report)], filterRow: 1, widths: [30, 48, 32, 40, 55, 28, 12, 55, 55, 45, 12], maxColumnWidth: 55 },
    { name: "Metadata", rows: [BATCH_METADATA_HEADER, metadataRow(report)], filterRow: 1, maxColumnWidth: 48 }
  ];
  if (preset === "custom") {
    const selected = currentCustomSheetNames();
    return allSheets.filter(sheet => selected.has(sheet.name));
  }
  return allSheets;
}

function downloadCurrentWorkbook() {
  downloadWorkbook(currentWorkbookSheets(), `bc-web-style-audit-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function updateCurrentExportDialog() {
  if (!state.activeReport) return;
  const report = state.activeReport;
  const includeReviewed = elements["current-export-reviewed"].checked;
  const preset = elements["current-export-preset"].value || "full";
  const findings = findingsForExport(report, includeReviewed);
  const occurrenceCount = findings.reduce((total, finding) => total + findingOccurrences(finding), 0);
  const findingCount = findings.length;
  elements["copy-detailed-findings"].textContent = occurrenceCount === findingCount
    ? `Copy detailed findings — ${findingCount} finding${findingCount === 1 ? "" : "s"}`
    : `Copy detailed findings — ${findingCount} rows · ${occurrenceCount} occurrences`;
  elements["current-export-preset-description"].textContent = preset === "custom"
    ? "Choose which sheets to include."
    : "Includes the summary, findings, page details, links and metadata.";
  elements["current-export-custom"].hidden = preset !== "custom";

  const needsLinkCheck = currentWorkbookNeedsLinkCheck();
  const coverage = linkCheckCoverage(report);
  const remoteCount = remoteLinksForReport(report).length;
  const status = elements["current-export-status"];
  const checkButton = elements["check-links-and-download-current"];
  const downloadButton = elements["download-current-workbook"];
  status.hidden = !needsLinkCheck;
  status.classList.toggle("is-complete", needsLinkCheck && (coverage === "Complete" || remoteCount === 0));
  checkButton.hidden = !needsLinkCheck || coverage === "Complete" || remoteCount === 0;
  checkButton.disabled = state.linkCheckRunning;

  if (!needsLinkCheck) {
    status.textContent = "";
    downloadButton.textContent = "Download workbook";
    downloadButton.className = "button primary";
    return;
  }

  if (!remoteCount) {
    status.textContent = "No web links need checking. In-page links are checked with the page.";
    downloadButton.textContent = "Download workbook";
    downloadButton.className = "button primary";
  } else if (state.linkCheckRunning) {
    const check = report.linkCheck || {};
    status.textContent = `Checking links: ${check.completed || 0} of ${check.totalFound || remoteCount} checked. You can download now or wait for the check to finish.`;
    checkButton.textContent = "Checking links…";
    downloadButton.textContent = "Download current results";
    downloadButton.className = "button secondary";
  } else if (coverage === "Complete") {
    status.textContent = `Link check complete: ${report.linkCheck.totalFound || 0} link${(report.linkCheck.totalFound || 0) === 1 ? "" : "s"} checked.`;
    downloadButton.textContent = "Download workbook";
    downloadButton.className = "button primary";
  } else {
    status.textContent = coverage === "Website access declined"
      ? "Website access was not allowed. You can still export the report, but unchecked links will not be reported as broken."
      : coverage === "Partially checked"
        ? "Some links could not be checked. The report will show which ones; unchecked links are not treated as working."
        : "Links have not been checked. Broken links will not be included in the findings.";
    checkButton.textContent = coverage === "Website access declined" ? "Allow access, check links and download" : "Check links and download";
    downloadButton.textContent = coverage === "Partially checked" ? "Download current results" : "Download without checking";
    downloadButton.className = "button secondary";
  }
}

async function checkLinksAndDownloadCurrentWorkbook() {
  if (!state.activeReport || state.linkCheckRunning) return;
  if (!currentWorkbookNeedsLinkCheck()) {
    downloadCurrentWorkbook();
    return;
  }
  if (!await ensurePreviewCanRun()) return;
  elements["check-links-and-download-current"].disabled = true;
  elements["check-links-and-download-current"].textContent = "Checking links…";
  await checkHttpLinks({ quiet: true });
  updateCurrentExportDialog();
  downloadCurrentWorkbook();
}

function openCurrentExportDialog() {
  clearTimeout(copyCurrentDetailedFindings.timeout);
  elements["current-export-confirmation"].hidden = true;
  updateCurrentExportDialog();
  elements["export-dialog"].showModal();
}

const BATCH_PAGES_HEADER = [
  "Page ID", "Page", "URL", "Review priority", "Main reasons", "Page information", "Plain language", "Structure and navigation",
  "Accessibility", "Links and documents", "Style and proofreading", "Reading grade", "Difficult sections", "Longest content without heading",
  "Long sentences", "Sentences checked", "Long-sentence %", "Words", "Fix", "Check", "Review", "Findings", "Issue types", "Link check coverage", "Link results",
  "Links", "Links flagged", "Images", "Images flagged", "Headings", "Lists", "Scope", "Site profile", "Scan status", "Scanned at", "Rules version"
];

const SITE_WIDE_HEADER = [
  "Issue", "Area", "Category", "Review level", "Status", "Affected pages", "% of scanned pages", "Findings", "Most affected pages",
  "Recommended action", "Guidance", "Rule ID"
];

const ISSUES_BY_PAGE_HEADER = [
  "Page ID", "Page", "URL", "Issue", "Area", "Category", "Review level", "Status", "Findings", "Sections affected",
  "Example evidence", "Recommended action", "Guidance", "Rule ID"
];

function profileValue(profile, name) {
  const area = profile.find(item => item.name === name);
  return area ? ATTENTION_LABEL[area.level] : "Nothing flagged";
}

function batchPageRecords(records) {
  return records.map((record, index) => ({ ...record, pageNumber: index + 1, profile: record.status === "complete" ? pageReviewProfile(record.report) : [] }));
}

function pageExportMetrics(record) {
  const report = record.report;
  const open = openFindings(report);
  const profile = record.profile || pageReviewProfile(report);
  const profileCounts = attentionCounts(profile);
  const details = report.pageDetails || { headings: [], counts: {} };
  const counts = details.counts || {};
  const longSentences = countRule(open, "sentence-long");
  const sentences = Number(report.stats.sentences) || 0;
  const difficultSections = countRule(open, "section-reading-level");
  const longestWithoutHeading = open.filter(finding => finding.ruleId === "section-heading-density")
    .reduce((max, finding) => Math.max(max, Number.isFinite(finding.analysisWords) ? finding.analysisWords : numericEvidenceValue(finding, /^(\d+) words/i) || 0), 0);
  const reportFindingCounts = reportCounts(report);
  const fixes = reportFindingCounts.fix;
  const checks = reportFindingCounts.check;
  const reviews = reportFindingCounts.review;
  const linkFindings = open.filter(finding => findingArea(finding) === "Links and documents");
  const imageFindings = open.filter(finding => ["image-alt-missing", "image-alt-empty", "image-alt-length", "image-alt-prefix", "image-alt-meaningless", "linked-image-alt", "broken-image"].includes(finding.ruleId));
  return {
    profile,
    profileCounts,
    reviewPriority: pageReviewPriority(profile),
    mainConcerns: mainConcerns(profile),
    readingGrade: report.stats.readingGrade === null ? "" : report.stats.readingGrade,
    difficultSections,
    longestWithoutHeading,
    longSentences,
    sentences,
    longSentencePct: sentences ? `${Math.round((longSentences / sentences) * 100)}%` : "",
    words: report.stats.words || 0,
    fixes,
    checks,
    reviews,
    total: fixes + checks + reviews,
    issueTypes: new Set([...open.map(finding => finding.ruleId), ...truncatedFindingRules(report).filter(item => omittedOpenCount(item)).map(item => item.ruleId)]).size,
    findingCoverage: truncatedFindingRules(report).length ? "Finding safety limit reached" : "Complete",
    linkCheck: linkCheckCoverage(report),
    linkResults: linkCheckResultSummary(report),
    links: counts.links || 0,
    linksFlagged: distinctSelectors(linkFindings),
    images: counts.images || report.stats.images || 0,
    imagesFlagged: distinctSelectors(imageFindings),
    headings: (details.headings || []).filter(heading => report.settings.profile !== "cms-lite" || !heading.component).length,
    lists: counts.lists || 0
  };
}

function batchPagesRows(records) {
  const complete = records.filter(record => record.status === "complete").map(record => ({ ...record, metrics: pageExportMetrics(record) }));
  const completeRows = complete.sort(pagePriorityCompare).map(record => {
    const report = record.report;
    const m = record.metrics;
    return [
      `P${String(record.pageNumber).padStart(3, "0")}`, report.page.title, report.page.url,
      m.reviewPriority,
      m.mainConcerns.join(" | "), profileValue(m.profile, "Page information"), profileValue(m.profile, "Plain language"),
      profileValue(m.profile, "Structure and navigation"), profileValue(m.profile, "Accessibility"), profileValue(m.profile, "Links and documents"),
      profileValue(m.profile, "Style and proofreading"), m.readingGrade, m.difficultSections, m.longestWithoutHeading, m.longSentences, m.sentences,
      m.longSentencePct, m.words, m.fixes, m.checks, m.reviews, m.total, m.issueTypes, m.linkCheck, m.linkResults, m.links, m.linksFlagged,
      m.images, m.imagesFlagged, m.headings, m.lists, report.settings.scope === "whole" ? "Whole page" : "Page content", report.settings.profileLabel,
      m.findingCoverage, formatDate(report.scannedAt), report.ruleVersion || ""
    ];
  });
  const failedRows = records.filter(record => record.status !== "complete").map(record => {
    const row = Array(BATCH_PAGES_HEADER.length).fill("");
    row[BATCH_PAGES_HEADER.indexOf("Page ID")] = `P${String(record.pageNumber).padStart(3, "0")}`;
    row[BATCH_PAGES_HEADER.indexOf("Page")] = "[Scan failed]";
    row[BATCH_PAGES_HEADER.indexOf("URL")] = record.submittedUrl || "";
    row[BATCH_PAGES_HEADER.indexOf("Main reasons")] = record.error || "Scan failed";
    row[BATCH_PAGES_HEADER.indexOf("Review priority")] = "Scan failed";
    row[BATCH_PAGES_HEADER.indexOf("Scan status")] = "Failed";
    row[BATCH_PAGES_HEADER.indexOf("Scanned at")] = formatDate(record.scannedAt || "");
    return row;
  });
  return [...completeRows, ...failedRows];
}

function siteWideIssueRecords(records, includeReviewed) {
  const complete = records.filter(record => record.status === "complete");
  const groups = new Map();
  complete.forEach(record => groupedFindingsForExport(record.report, includeReviewed).forEach(group => {
    const key = `${group.status}|${group.finding.ruleId}`;
    if (!groups.has(key)) groups.set(key, { finding: group.finding, status: group.status, pages: new Map(), occurrences: 0 });
    const site = groups.get(key);
    const current = site.pages.get(record.report.page.url) || { title: record.report.page.title, count: 0 };
    current.count += group.occurrenceCount;
    site.pages.set(record.report.page.url, current);
    site.occurrences += group.occurrenceCount;
  }));
  return Array.from(groups.values()).sort((a, b) => b.pages.size - a.pages.size || b.occurrences - a.occurrences || a.finding.title.localeCompare(b.finding.title));
}

function siteWideRows(records, includeReviewed) {
  const completeCount = records.filter(record => record.status === "complete").length;
  return siteWideIssueRecords(records, includeReviewed).map(item => {
    const mostAffected = Array.from(item.pages.values()).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)).slice(0, 3);
    return [
      item.finding.title, findingArea(item.finding), item.finding.category, sentenceLabel(item.finding.severity), sentenceLabel(item.status), item.pages.size,
      completeCount ? `${Math.round((item.pages.size / completeCount) * 100)}%` : "", item.occurrences,
      mostAffected.map(page => `${page.title} (${page.count})`).join("; "), item.finding.suggestion, item.finding.sourceUrl, item.finding.ruleId
    ];
  });
}

function issuesByPageRows(records, includeReviewed) {
  return records.filter(record => record.status === "complete").flatMap(record => {
    const pageId = `P${String(record.pageNumber).padStart(3, "0")}`;
    return issueSummaryRows(record.report, includeReviewed).map(row => [pageId, record.report.page.title, record.report.page.url, ...row]);
  });
}

function batchSummaryRows(records, includeReviewed) {
  const complete = records.filter(record => record.status === "complete");
  const failed = records.filter(record => record.status !== "complete");
  const profiles = complete.map(record => record.profile || pageReviewProfile(record.report));
  const areaNames = ["Page information", "Plain language", "Structure and navigation", "Accessibility", "Links and documents", "Style and proofreading"];
  const exportedFindings = complete.flatMap(record => findingsForExport(record.report, includeReviewed));
  const omittedBySeverity = { fix: 0, check: 0, review: 0 };
  complete.forEach(record => truncatedFindingRules(record.report).forEach(item => {
    const severity = ["fix", "check", "review"].includes(item.severity) ? item.severity : "review";
    omittedBySeverity[severity] += includeReviewed ? (Number(item.omitted) || 0) : omittedOpenCount(item);
  }));
  const totalOmitted = omittedBySeverity.fix + omittedBySeverity.check + omittedBySeverity.review;
  const totalFindings = exportedFindings.reduce((total, finding) => total + findingOccurrences(finding), 0) + totalOmitted;
  const fixFindings = exportedFindings.filter(finding => finding.severity === "fix").reduce((total, finding) => total + findingOccurrences(finding), 0) + omittedBySeverity.fix;
  const checkFindings = exportedFindings.filter(finding => finding.severity === "check").reduce((total, finding) => total + findingOccurrences(finding), 0) + omittedBySeverity.check;
  const reviewFindings = exportedFindings.filter(finding => finding.severity === "review").reduce((total, finding) => total + findingOccurrences(finding), 0) + omittedBySeverity.review;
  const allIssueTypes = new Set([
    ...exportedFindings.map(finding => finding.ruleId),
    ...complete.flatMap(record => truncatedFindingRules(record.report).filter(item => includeReviewed || omittedOpenCount(item)).map(item => item.ruleId))
  ]);
  const incompletePages = complete.filter(record => truncatedFindingRules(record.report).length);
  const linkCoverageCounts = complete.reduce((map, record) => { const label = linkCheckCoverage(record.report); map[label] = (map[label] || 0) + 1; return map; }, {});
  const linkCoverageText = ["Complete", "Partially checked", "Website access declined", "Not checked"]
    .filter(label => linkCoverageCounts[label])
    .map(label => `${label}: ${linkCoverageCounts[label]} page${linkCoverageCounts[label] === 1 ? "" : "s"}`)
    .join(" · ") || "No scanned pages";
  const prioritized = complete.filter(record => (record.profile || pageReviewProfile(record.report)).some(area => area.level !== "nothing-flagged")).sort(pagePriorityCompare);
  const pageLimit = Math.min(10, prioritized.length);
  const widespread = siteWideIssueRecords(records, includeReviewed).filter(item => item.pages.size >= 2).slice(0, 10);
  const rows = [
    sheetRow(["B.C. Web Style Guide batch review", "", "", "", "", ""], "title"),
    sheetRow(["Scan overview", "", "", "", "", ""], "section"),
    sheetRow(["Measure", "Value", "", "", "", "Detail"], "header"),
    sheetRow(["Pages requested", records.length, "", "", "", ""]),
    sheetRow(["Pages scanned", complete.length, "", "", "", ""]),
    sheetRow(["Pages failed", failed.length, "", "", "", failed.length ? "See Scan log for details" : ""]),
    sheetRow(["Automated findings", totalFindings, "", "", "", "Items identified by automated checks"]),
    sheetRow(["Fix", fixFindings, "", "", "", "High-confidence problems that usually need a change"]),
    sheetRow(["Check", checkFindings, "", "", "", "Likely concerns where context affects the action"]),
    sheetRow(["Review", reviewFindings, "", "", "", "Editorial judgement may be needed"]),
    sheetRow(["Issue types", allIssueTypes.size, "", "", "", "Distinct checker rules with findings"]),
    sheetRow(["Finding coverage", incompletePages.length ? `${incompletePages.length} page${incompletePages.length === 1 ? "" : "s"} reached a safety limit` : "Complete", "", "", "", incompletePages.length ? "See each page's findings and detected totals" : "All detected findings are available for review"]),
    sheetRow(["Link check coverage", linkCoverageText, "", "", "", ""]),
    sheetRow(["Link check results", aggregateLinkCheckResultSummary(complete.map(record => record.report)), "", "", "", ""]),
    sheetRow([totalFindings
      ? "Automated findings identify items to review; they are not confirmed compliance failures."
      : "No automated findings were recorded. This does not mean the pages passed an accessibility, quality or compliance assessment.", "", "", "", "", ""], "note"),
    sheetRow(["Review priorities by area", "", "", "", "", ""], "section"),
    sheetRow(["Area", "Review first (pages)", "Needs attention (pages)", "Worth checking (pages)", "Nothing flagged (pages)", ""], "header"),
    ...areaNames.map(name => {
      const counts = { "review-first": 0, "needs-attention": 0, "worth-checking": 0, "nothing-flagged": 0 };
      profiles.forEach(profile => { const area = profile.find(item => item.name === name); counts[area ? area.level : "nothing-flagged"] += 1; });
      return sheetRow([name, counts["review-first"], counts["needs-attention"], counts["worth-checking"], counts["nothing-flagged"], ""]);
    }),
    sheetRow(["Pages to review first", "", "", "", "", ""], "section"),
    sheetRow(["Page", "Review priority", "Fix", "Check", "Review", "Main reasons"], "header"),
    ...prioritized.slice(0, pageLimit).map(record => {
      const metrics = pageExportMetrics(record);
      return sheetRow([record.report.page.title, metrics.reviewPriority, metrics.fixes, metrics.checks, metrics.reviews, metrics.mainConcerns.join(" | ")]);
    })
  ];
  if (!prioritized.length) rows.push(sheetRow(["No scanned page has an area marked Review first, Needs attention or Worth checking.", "", "", "", "", ""], "note"));
  else if (prioritized.length > pageLimit) rows.push(sheetRow([`Showing ${pageLimit} of ${prioritized.length} pages with automated review priorities. See the Pages sheet for the complete list.`, "", "", "", "", ""], "note"));
  rows.push(sheetRow(["Most common findings", "", "", "", "", ""], "section"));
  rows.push(sheetRow(["Issue", "Review level", "Affected pages", "% pages", "Findings", "Recommended action"], "header"));
  if (widespread.length) widespread.forEach(item => rows.push(sheetRow([
    item.finding.title, sentenceLabel(item.finding.severity), item.pages.size,
    complete.length ? `${Math.round((item.pages.size / complete.length) * 100)}%` : "", item.occurrences, item.finding.suggestion
  ])));
  else rows.push(sheetRow(["No finding type was flagged on 2 or more scanned pages.", "", "", "", "", ""], "note"));
  return rows;
}

function batchWorkbookSheets(records, includeReviewed, preset, customSelection) {
  const pages = batchPagesRows(records);
  const scanLogHeader = ["Submitted URL", "Result", "Page title", "Final URL", "Scanned at", "Message"];
  const scanLogRows = records.map(record => record.status === "complete"
    ? [record.submittedUrl, "Complete", record.report.page.title, record.report.page.url, formatDate(record.report.scannedAt), ""]
    : [record.submittedUrl, "Failed", "", "", formatDate(record.scannedAt || ""), record.error || "Unknown error"]);
  const allSheets = [
    { name: "Summary", rows: batchSummaryRows(records, includeReviewed), widths: [38, 22, 18, 18, 18, 72], maxColumnWidth: 72 },
    { name: "Pages", rows: [BATCH_PAGES_HEADER, ...pages], filterRow: 1, widths: [12, 34, 48, 18, 62, 18, 18, 24, 18, 22, 22, 14, 16, 20, 14, 18, 16, 12, 10, 10, 10, 12, 12, 22, 42, 10, 14, 10, 14, 10, 10, 18, 18, 14, 22, 14], maxColumnWidth: 62 },
    { name: "Site-wide findings", rows: [SITE_WIDE_HEADER, ...siteWideRows(records, includeReviewed)], filterRow: 1, widths: [36, 24, 20, 14, 14, 14, 16, 12, 54, 60, 54, 24], maxColumnWidth: 60 },
    { name: "Page issue summary", rows: [ISSUES_BY_PAGE_HEADER, ...issuesByPageRows(records, includeReviewed)], filterRow: 1, widths: [12, 34, 48, 36, 24, 20, 14, 14, 12, 40, 60, 60, 54, 24], maxColumnWidth: 60 },
    { name: "Findings detail", rows: [FINDING_DETAIL_HEADER, ...records.filter(record => record.status === "complete").flatMap(record => findingDetailRows(record.report, includeReviewed, record.submittedUrl, record.pageNumber))], filterRow: 1, widths: [14, 32, 48, 34, 24, 20, 36, 14, 14, 64, 24, 64, 64, 12, 40, 54, 24, 12], maxColumnWidth: 64 },
    { name: "Links", rows: [LINK_EXPORT_HEADER, ...records.filter(record => record.status === "complete").flatMap(record => linkRows(record.report))], filterRow: 1, maxColumnWidth: 55 },
    { name: "Metadata", rows: [BATCH_METADATA_HEADER, ...records.filter(record => record.status === "complete").map(record => metadataRow(record.report, record.submittedUrl))], filterRow: 1, widths: [32, 48, 48, 24, 22, 30, 34, 60, 28, 16, 14, 34, 60, 34, 60, 42, 60], maxColumnWidth: 60 },
    { name: "Scan log", rows: [scanLogHeader, ...scanLogRows], filterRow: 1, widths: [52, 14, 34, 52, 24, 60], maxColumnWidth: 60 }
  ];
  const byName = new Map(allSheets.map(sheet => [sheet.name, sheet]));
  if (preset === "full") return allSheets;
  if (preset === "custom") {
    const selected = customSelection instanceof Set ? customSelection : new Set(customSelection || []);
    return allSheets.filter(sheet => selected.has(sheet.name));
  }
  return allSheets;
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
  if (!granted) throw new Error("Website access was not allowed, so the batch scan cannot check these pages.");
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
      optionalChecks: settings.optionalChecks || state.optionalChecks,
      exceptions: state.exceptions
    });
    return { submittedUrl: url, status: "complete", report };
  } catch (error) {
    return { submittedUrl: url, status: "error", error: readableScanError(error), scannedAt: new Date().toISOString() };
  } finally {
    if (tab && tab.id) {
      try { await chrome.tabs.remove(tab.id); } catch (_) { }
    }
    state.batch.tempTabId = null;
  }
}

function batchLinkPlan(records) {
  const perRecord = new Map();
  const destinations = new Map();
  records.filter(record => record.status === "complete" && record.report).forEach(record => {
    const pageLinks = remoteLinksForReport(record.report);
    perRecord.set(record, pageLinks);
    pageLinks.forEach(link => {
      const key = remoteLinkKey(link);
      if (!destinations.has(key)) destinations.set(key, {
        key,
        checkUrl: link.checkUrl || link.href,
        href: link.href,
        qaFamily: link.qaFamily || "",
        qaLive: Boolean(link.qaLive),
        qaUrl: link.qaUrl || "",
        liveUrl: link.liveUrl || "",
        publicQaPair: Boolean(link.publicQaPair),
        cmsLiteAssetGuid: link.cmsLiteAssetGuid || "",
        cmsLiteAssetFamily: link.cmsLiteAssetFamily || "",
        cmsLiteEditorLink: Boolean(link.cmsLiteEditorLink),
        sessionAware: Boolean(link.sessionAware),
        signInRequired: Boolean(link.signInRequired)
      });
    });
  });
  return { perRecord, destinations };
}

function batchLinkPermissionOrigins(plan) {
  return Array.from(new Set(Array.from(plan.destinations.values())
    .filter(item => !item.signInRequired)
    .flatMap(item => permissionOriginsForPreparedLink(item))
    .filter(Boolean)));
}

async function batchLinkPermissionsGranted(origins) {
  if (!origins.length) return true;
  try { return await chrome.permissions.contains({ origins }); } catch (_) { return false; }
}

function applyBatchLinkPermissionDenied(plan) {
  plan.perRecord.forEach((links, record) => {
    const results = links.map(link => linkResultFromRemote(link, link.signInRequired
      ? { status: "sign-in", checkedUrl: link.checkUrl || link.href, finalUrl: link.checkUrl || link.href, error: sessionVerificationMessage("sign-in") }
      : { status: "permission", checkedUrl: link.checkUrl || link.href, finalUrl: link.checkUrl || link.href, error: "Website access was not granted." }));
    record.report.linkCheck = {
      state: "permission-denied",
      permissionDeclined: true,
      startedAt: new Date().toISOString(),
      checkedAt: "",
      results,
      ...summarizeLinkCheck(links.length, results)
    };
  });
}

async function runBatchLinkChecks(plan) {
  const batch = state.batch;
  const destinations = Array.from(plan.destinations.values());
  batch.phase = "links";
  batch.running = true;
  batch.linkCheckTotal = destinations.length;
  batch.linkCheckCompleted = 0;
  await persistBatchState();
  renderBatchProgress();

  if (!destinations.length) {
    plan.perRecord.forEach((links, record) => {
      record.report.linkCheck = {
        state: "complete",
        startedAt: new Date().toISOString(),
        checkedAt: new Date().toISOString(),
        results: [],
        ...summarizeLinkCheck(0, [])
      };
    });
    return;
  }

  const resultByDestination = new Map();
  let index = 0;
  const worker = async () => {
    while (index < destinations.length && !batch.cancelled) {
      await waitForResume();
      if (batch.cancelled) break;
      const destination = destinations[index];
      index += 1;
      let result;
      if (destination.cmsLiteAssetGuid) {
        result = {
          status: "session-unverified",
          combinedStatus: "cms-publishing-unverified",
          checkedUrl: destination.href,
          finalUrl: destination.href,
          error: "CMS Lite assets cannot be fully checked in a batch because the editor must stay open."
        };
      } else if (destination.signInRequired) {
        result = { status: "sign-in", checkedUrl: destination.checkUrl, finalUrl: destination.checkUrl, error: sessionVerificationMessage("sign-in") };
      } else if (destination.qaFamily === "public" && destination.qaLive) {
        const qaResult = await checkPublicQaWithCurrentAccess(
          null,
          destination.qaUrl || destination.href,
          10000,
          Boolean(destination.publicQaPair)
        );
        const liveResult = await checkRemoteUrl(destination.liveUrl || destination.checkUrl, 10000, { sessionAware: false });
        result = publicQaLiveRemoteResult(destination, qaResult, liveResult);
      } else if (destination.qaFamily === "intranet" && destination.qaLive) {
        const qaResult = await checkRemoteUrl(destination.href, 10000, { sessionAware: true });
        if (qaResult.status === "ok") {
          const liveResult = await checkRemoteUrl(destination.checkUrl, 10000, { sessionAware: true });
          result = {
            status: liveResult.status,
            combinedStatus: liveResult.status === "ok" ? "qa-live-ok" : liveResult.status === "broken" ? "qa-only" : "qa-live-unverified",
            code: "",
            checkedUrl: destination.href,
            finalUrl: qaResult.finalUrl || destination.href,
            qaStatus: "ok",
            qaCode: qaResult.code || "",
            qaCheckedUrl: destination.href,
            liveStatus: liveResult.status,
            liveCode: liveResult.code || "",
            liveCheckedUrl: destination.checkUrl,
            accessMode: qaResult.accessMode || "current-session",
            error: liveResult.status === "ok"
              ? "Available in QA and live. Live was verified using your current browser access."
              : liveResult.status === "broken"
                ? "Works in QA. The live intranet version was not found."
                : `Works in QA. The live intranet version could not be checked.${liveResult.error ? ` ${liveResult.error}` : ""}`
          };
        } else {
          result = { ...qaResult, checkedUrl: destination.href };
        }
      } else {
        result = await checkRemoteUrl(destination.checkUrl, 10000, { sessionAware: destination.sessionAware });
      }
      resultByDestination.set(destination.key, result);
      batch.linkCheckCompleted = resultByDestination.size;
      renderBatchProgress();
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, destinations.length) }, worker));

  plan.perRecord.forEach((links, record) => {
    const results = links.map(link => {
      const key = remoteLinkKey(link);
      const remoteResult = resultByDestination.get(key) || { status: "unavailable", finalUrl: link.checkUrl || link.href, error: "The batch link check stopped before this link was checked." };
      return linkResultFromRemote(link, remoteResult);
    });
    addHttpLinkFindings(record.report, results);
    record.report.linkCheck = {
      state: batch.cancelled ? "stopped" : "complete",
      startedAt: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
      results,
      ...summarizeLinkCheck(links.length, results)
    };
  });
}

async function prepareBatchLinkCheck({ requestPermissions = false } = {}) {
  const plan = batchLinkPlan(state.batch.records);
  const origins = batchLinkPermissionOrigins(plan);
  state.batch.linkCheckTotal = plan.destinations.size;
  state.batch.linkCheckCompleted = 0;

  let granted = false;
  if (requestPermissions) {
    try { granted = !origins.length || await chrome.permissions.request({ origins }); } catch (_) { granted = false; }
  } else {
    granted = await batchLinkPermissionsGranted(origins);
    if (!granted) return { plan, origins, needsPermission: true };
  }
  if (!granted) {
    applyBatchLinkPermissionDenied(plan);
    state.batch.linkCheckCompleted = plan.destinations.size;
    return { plan, origins, permissionDeclined: true };
  }
  await runBatchLinkChecks(plan);
  return { plan, origins, complete: true };
}

function batchHasIncompletePageScan() {
  const batch = state.batch;
  return Boolean(batch.urls.length && batch.records.length < batch.urls.length && !batch.cancelled && ["scanning", "paused"].includes(batch.phase));
}

function batchLinkPermissionModeFromUi() {
  return "found";
}

function applyBatchStateToControls() {
  const batch = state.batch;
  if (batch.urls.length && !normalizeSpace(elements["batch-urls"].value)) elements["batch-urls"].value = batch.urls.join("\n");
  if (batch.settings && batch.settings.scope) elements["batch-scope"].value = batch.settings.scope;
  elements["batch-colour-control"].checked = batch.settings ? batch.settings.canControlColour !== false : true;
  elements["batch-check-links"].checked = Boolean(batch.checkLinks);
  elements["batch-export-preset"].value = batch.exportPreset === "custom" ? "custom" : "full";
  elements["batch-include-reviewed"].checked = Boolean(batch.includeReviewed);
  const custom = new Set(batch.customSheets || []);
  document.querySelectorAll("#batch-export-custom [data-sheet]").forEach(input => { input.checked = custom.has(input.dataset.sheet); });
}

function batchExportSnapshotFromUi() {
  const preset = elements["batch-export-preset"].value === "custom" ? "custom" : "full";
  return {
    settings: { scope: elements["batch-scope"].value, canControlColour: elements["batch-colour-control"].checked, optionalChecks: { ...state.optionalChecks } },
    checkLinks: elements["batch-check-links"].checked,
    linkPermissionMode: batchLinkPermissionModeFromUi(),
    exportPreset: preset,
    customSheets: preset === "custom" ? Array.from(batchCustomSheetNames()) : [],
    includeReviewed: elements["batch-include-reviewed"].checked
  };
}

function updateBatchExportDescription() {
  const preset = elements["batch-export-preset"].value === "custom" ? "custom" : "full";
  elements["batch-export-description"].textContent = preset === "custom"
    ? "Choose which sheets to include."
    : "Includes the summary, page priorities, findings, links, metadata and scan log.";
  elements["batch-export-custom"].hidden = preset !== "custom";
}

function updateBatchControls() {
  const batch = state.batch;
  const running = batch.running;
  const waitingForLinkAccess = batch.phase === "link-permission";
  const resumable = batchHasIncompletePageScan();
  const lockSetup = running || waitingForLinkAccess || resumable;
  elements["batch-start-button"].disabled = previewLifecycleBlocksUse() || running || waitingForLinkAccess;
  elements["batch-start-button"].textContent = resumable ? `Resume batch scan · ${batch.records.length} of ${batch.urls.length}` : "Start batch scan";
  elements["batch-pause-button"].hidden = !running;
  elements["batch-cancel-button"].hidden = !running && !resumable;
  elements["batch-cancel-button"].textContent = resumable && !running ? "Stop saved batch" : "Stop";
  elements["batch-pause-button"].textContent = batch.paused ? "Resume" : "Pause";
  elements["batch-csv-button"].disabled = running || waitingForLinkAccess || !batch.records.length;
  elements["batch-csv-button"].textContent = batch.downloaded ? "Download again" : "Download workbook";
  elements["batch-urls"].disabled = lockSetup;
  elements["batch-scope"].disabled = lockSetup;
  elements["batch-colour-control"].disabled = lockSetup;
  elements["batch-check-links"].disabled = lockSetup;
  elements["batch-link-access-note"].hidden = !elements["batch-check-links"].checked;
  elements["batch-link-finish-actions"].hidden = !waitingForLinkAccess;
  updateBatchExportDescription();
}

function renderBatchProgress() {
  const batch = state.batch;
  const done = batch.records.length;
  const checkingLinks = batch.phase === "links";
  const waitingForLinkAccess = batch.phase === "link-permission";
  const resumable = batchHasIncompletePageScan();
  elements["batch-progress-panel"].hidden = !batch.running && !done && !waitingForLinkAccess && !resumable && batch.phase !== "done";
  elements["batch-progress"].max = checkingLinks ? Math.max(1, batch.linkCheckTotal || 0) : Math.max(1, batch.urls.length || 0);
  elements["batch-progress"].value = checkingLinks ? batch.linkCheckCompleted : done;
  elements["batch-progress-count"].textContent = checkingLinks
    ? `${batch.linkCheckCompleted} of ${batch.linkCheckTotal} unique destination${batch.linkCheckTotal === 1 ? "" : "s"}`
    : `${done} of ${batch.urls.length} page${batch.urls.length === 1 ? "" : "s"}`;

  if (batch.running) {
    if (checkingLinks) elements["batch-progress-label"].textContent = batch.paused ? "Link check paused" : "Checking links";
    else {
      const current = batch.urls[Math.max(0, batch.currentIndex)] || "";
      elements["batch-progress-label"].textContent = batch.paused ? "Batch scan paused" : `Scanning ${hostnameFor(current) || current}`;
    }
  } else if (waitingForLinkAccess) {
    elements["batch-progress-label"].textContent = "Pages checked · allow website access to finish checking links";
  } else if (resumable) {
    elements["batch-progress-label"].textContent = `Batch scan paused · ${done} of ${batch.urls.length} pages`;
  } else if (batch.cancelled) {
    elements["batch-progress-label"].textContent = "Batch scan stopped";
  } else if (batch.phase === "done" || done) {
    const accessDeclined = batch.records.some(record => record.status === "complete" && record.report.linkCheck && record.report.linkCheck.state === "permission-denied");
    elements["batch-progress-label"].textContent = accessDeclined
      ? "Batch scan complete · website access not allowed"
      : batch.checkLinks ? "Batch scan and link check complete" : "Batch scan complete";
  }

  if (batch.downloaded && batch.downloadFilename) {
    elements["batch-download-status"].textContent = `Workbook downloaded: ${batch.downloadFilename}`;
  } else if (batch.phase === "done" && done) {
    elements["batch-download-status"].textContent = "Workbook ready to download.";
  } else {
    elements["batch-download-status"].textContent = "";
  }

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

async function continueBatchPageScan() {
  if (!await ensurePreviewCanRun()) return;
  const batch = state.batch;
  batch.running = true;
  batch.paused = false;
  batch.cancelled = false;
  batch.phase = "scanning";
  await persistBatchState();
  renderBatchProgress();

  for (let index = batch.records.length; index < batch.urls.length; index += 1) {
    if (batch.cancelled) break;
    if (!await ensurePreviewCanRun()) {
      batch.running = false;
      batch.phase = "paused";
      await persistBatchState().catch(() => {});
      renderBatchProgress();
      return;
    }
    await waitForResume();
    if (batch.cancelled) break;
    batch.currentIndex = index;
    renderBatchProgress();
    const record = await scanBatchUrl(batch.urls[index], batch.settings);
    batch.records.push(record);
    batch.currentIndex = index;
    await persistBatchState();
    renderBatchProgress();
  }

  if (batch.cancelled) {
    batch.running = false;
    batch.phase = "cancelled";
    await persistBatchState();
    renderBatchProgress();
    return;
  }

  if (batch.records.length < batch.urls.length) {
    batch.running = false;
    batch.phase = "paused";
    await persistBatchState();
    renderBatchProgress();
    return;
  }

  if (batch.checkLinks) {
    const linkResult = await prepareBatchLinkCheck({ requestPermissions: false });
    if (batch.cancelled) {
      batch.running = false;
      batch.phase = "cancelled";
      await persistBatchState();
      renderBatchProgress();
      return;
    }
    if (linkResult.needsPermission) {
      batch.running = false;
      batch.phase = "link-permission";
      await persistBatchState();
      renderBatchProgress();
      return;
    }
  }
  await finalizeBatchScan(true);
}

async function startBatchScan() {
  if (!await ensurePreviewCanRun()) return;
  elements["batch-error"].hidden = true;

  if (batchHasIncompletePageScan()) {
    try {
      await continueBatchPageScan();
    } catch (error) {
      state.batch.running = false;
      state.batch.phase = "paused";
      await persistBatchState().catch(() => {});
      elements["batch-error-message"].textContent = readableScanError(error);
      elements["batch-error"].hidden = false;
      renderBatchProgress();
    }
    return;
  }

  const parsed = renderBatchValidation();
  if (!parsed.valid.length) {
    elements["batch-error-message"].textContent = "Add at least one valid web address.";
    elements["batch-error"].hidden = false;
    return;
  }

  const snapshot = batchExportSnapshotFromUi();
  try {
    await requestBatchPermissions(parsed.valid);
  } catch (error) {
    elements["batch-error-message"].textContent = readableScanError(error);
    elements["batch-error"].hidden = false;
    return;
  }

  state.batch = {
    ...state.batch,
    running: true,
    paused: false,
    cancelled: false,
    phase: "scanning",
    urls: parsed.valid,
    records: [],
    currentIndex: -1,
    tempTabId: null,
    checkLinks: snapshot.checkLinks,
    linkPermissionMode: "found",
    linkCheckTotal: 0,
    linkCheckCompleted: 0,
    settings: snapshot.settings,
    exportPreset: snapshot.exportPreset,
    customSheets: snapshot.customSheets,
    includeReviewed: snapshot.includeReviewed,
    downloaded: false,
    downloadFilename: "",
    downloadedAt: ""
  };
  await persistBatchState();
  try {
    await continueBatchPageScan();
  } catch (error) {
    state.batch.running = false;
    state.batch.phase = state.batch.records.length < state.batch.urls.length ? "paused" : "done";
    await persistBatchState().catch(() => {});
    elements["batch-error-message"].textContent = readableScanError(error);
    elements["batch-error"].hidden = false;
    renderBatchProgress();
  }
}

function toggleBatchPause() {
  state.batch.paused = !state.batch.paused;
  if (!state.batch.running && batchHasIncompletePageScan()) {
    startBatchScan();
    return;
  }
  persistBatchState().catch(() => {});
  updateBatchControls();
  renderBatchProgress();
}

async function cancelBatch() {
  state.batch.cancelled = true;
  state.batch.paused = false;
  state.batch.running = false;
  state.batch.phase = "cancelled";
  if (state.batch.tempTabId) {
    try { await chrome.tabs.remove(state.batch.tempTabId); } catch (_) { }
  }
  await persistBatchState().catch(() => {});
  renderBatchProgress();
}

async function requestBatchLinkAccessAndFinish() {
  if (!await ensurePreviewCanRun()) return;
  elements["batch-error"].hidden = true;
  try {
    const result = await prepareBatchLinkCheck({ requestPermissions: true });
    if (result.permissionDeclined) {
      elements["batch-error-message"].textContent = "Website access was not allowed. The workbook will still be created, but those links will remain unchecked.";
      elements["batch-error"].hidden = false;
    }
    await finalizeBatchScan(true);
  } catch (error) {
    state.batch.running = false;
    state.batch.phase = "link-permission";
    await persistBatchState().catch(() => {});
    elements["batch-error-message"].textContent = `Link checking could not finish: ${readableScanError(error)}`;
    elements["batch-error"].hidden = false;
    renderBatchProgress();
  }
}

async function finishBatchWithoutLinks() {
  state.batch.checkLinks = false;
  state.batch.linkCheckTotal = 0;
  state.batch.linkCheckCompleted = 0;
  await finalizeBatchScan(true);
}

async function finalizeBatchScan(autoDownload = false) {
  state.batch.running = false;
  state.batch.paused = false;
  state.batch.cancelled = false;
  state.batch.phase = "done";
  state.batch.currentIndex = Math.max(-1, state.batch.urls.length - 1);
  await persistBatchState();
  renderBatchProgress();
  if (autoDownload) await downloadBatchWorkbook({ auto: true });
}

async function downloadBatchWorkbook({ auto = false } = {}) {
  const batch = state.batch;
  const records = batchPageRecords(batch.records);
  if (!records.length) { showToast("Run a batch scan before exporting."); return false; }
  const preset = auto ? batch.exportPreset : (elements["batch-export-preset"].value === "custom" ? "custom" : "full");
  const includeReviewed = auto ? batch.includeReviewed : elements["batch-include-reviewed"].checked;
  const customSheets = preset === "custom" ? new Set(auto ? batch.customSheets : Array.from(batchCustomSheetNames())) : null;
  const filename = `bc-web-style-batch-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const downloaded = downloadWorkbook(batchWorkbookSheets(records, includeReviewed, preset, customSheets), filename);
  if (downloaded) {
    batch.downloaded = true;
    batch.downloadFilename = filename;
    batch.downloadedAt = new Date().toISOString();
    await persistBatchState().catch(() => {});
    renderBatchProgress();
    showToast(auto ? "Workbook downloaded." : "Workbook downloaded again.");
    return true;
  }
  batch.downloaded = false;
  batch.downloadFilename = "";
  await persistBatchState().catch(() => {});
  renderBatchProgress();
  return false;
}

function downloadBatchCsv() {
  return downloadBatchWorkbook({ auto: false });
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
else if (button.classList.contains("locate-button")) {
  locateFinding(
    finding || button.dataset.selector,
    Number(button.dataset.editorRegion) || null,
    button.dataset.editorId || ""
  );
}
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
      await saveNavigation().catch(() => { });
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
  elements["preview-continue-button"].addEventListener("click", () => {
    previewNoticeDismissed = true;
    if (previewLifecycleState && !previewLifecycleState.blocksUse) {
      elements["preview-lifecycle-banner"].hidden = true;
    }
  });
  elements["preview-check-again-button"].addEventListener("click", async () => {
    elements["preview-check-again-button"].disabled = true;
    try {
      const result = await refreshPreviewLifecycle({
        forceRemote: true,
        focusIfBlocked: true
      });
      if (!result.blocksUse) {
        await syncActiveTab();
        updateBatchControls();
        renderPreviewLifecycle(result);
      }
    } finally {
      elements["preview-check-again-button"].disabled = false;
    }
  });
  elements["scan-permission-button"].addEventListener("click", openPermissionDialog);
  elements["rescan-button"].addEventListener("click", () => { elements["more-dialog"].close(); showRescanSettings(); });
  elements["stale-rescan-button"].addEventListener("click", showRescanSettings);
  elements["cancel-settings-button"].addEventListener("click", hideScanSettings);

  elements["more-menu-button"].addEventListener("click", () => {
    elements["rescan-button"].hidden = !state.activeReport;
    elements["more-dialog"].showModal();
  });
  elements["more-close"].addEventListener("click", () => elements["more-dialog"].close());
  elements["feedback-header-button"].addEventListener("click", openFeedbackView);
  elements["feedback-back-button"].addEventListener("click", closeFeedbackView);
  elements["open-feedback-button"].addEventListener("click", () => { elements["more-dialog"].close(); openFeedbackView(); });
  elements["open-workspace-button"].addEventListener("click", () => { elements["more-dialog"].close(); openWorkspace("current"); });
  elements["open-batch-button"].addEventListener("click", () => { elements["more-dialog"].close(); workspaceSurface ? switchView("batch") : openWorkspace("batch"); });
  elements["open-settings-button"].addEventListener("click", () => { elements["more-dialog"].close(); workspaceSurface ? switchView("terms") : openWorkspace("terms"); });

  elements["csv-button"].addEventListener("click", openCurrentExportDialog);
  elements["export-close"].addEventListener("click", () => elements["export-dialog"].close());
  elements["copy-detailed-findings"].addEventListener("click", copyCurrentDetailedFindings);
  elements["check-links-and-download-current"].addEventListener("click", checkLinksAndDownloadCurrentWorkbook);
  elements["current-export-reviewed"].addEventListener("change", updateCurrentExportDialog);
  elements["current-export-preset"].addEventListener("change", updateCurrentExportDialog);
  [
    "current-custom-summary", "current-custom-issues", "current-custom-findings",
    "current-custom-page-details", "current-custom-links", "current-custom-metadata"
  ].forEach(id => elements[id].addEventListener("change", updateCurrentExportDialog));

  elements["open-filter-button"].addEventListener("click", () => elements["filter-panel"].showModal());
  elements["filter-close"].addEventListener("click", () => elements["filter-panel"].close());
  elements["filter-panel"].querySelector("form").addEventListener("submit", () => renderFindings());
  elements["status-filter"].addEventListener("change", renderFindings);
  elements["category-filter"].addEventListener("change", renderFindings);
  elements["sort-order"].addEventListener("change", () => {
    renderReviewView();
    persistReviewContext(state.activePageKey).catch(() => { });
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
    const fingerprint = elements["review-issues-button"].dataset.fingerprint || "";
    if (ruleId) openRuleGroup(ruleId, fingerprint);
  });
  elements["restore-skipped-rules"].addEventListener("click", restoreSkippedIssueTypes);
  elements["link-check-shortcut"].addEventListener("click", () => {
    state.reviewView = "details";
    state.pageDetailSection = "links";
    renderReviewView();
    persistReviewContext(state.activePageKey).catch(() => { });
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
  const handlePageAuditClick = event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.detailSection) { renderPageDetails(button.dataset.detailSection); persistReviewContext(state.activePageKey).catch(() => { }); }
    else if (button.dataset.overlay) runPageOverlay(button.dataset.overlay);
    else if (button.classList.contains("link-check-button")) checkHttpLinks();
    else if (button.classList.contains("link-check-pause")) toggleLinkCheckPause();
    else if (button.classList.contains("link-check-stop")) stopLinkCheck();
    else if (button.classList.contains("manage-permissions-button")) openPermissionDialog();
    else if (button.classList.contains("link-result-category-toggle")) toggleLinkResultCategory(button);
    else if (button.classList.contains("detail-jump")) locateFinding(
      button.dataset.selector,
      Number(button.dataset.editorRegion) || null,
      button.dataset.editorId || ""
    );
    else if (button.classList.contains("open-background-link")) {
      persistReviewContext(state.activePageKey).catch(() => { });
      chrome.tabs.create({ url: button.dataset.url, active: false }).then(() => showToast("Destination opened in the background.")).catch(() => showToast("The destination could not be opened."));
    }
  };
  elements["page-details"].addEventListener("click", handlePageAuditClick);
  elements["page-details"].addEventListener("toggle", event => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.classList.contains("link-result-group")) return;
    syncLinkResultCategoryToggle(details.closest(".link-result-category"));
  }, true);

  elements["exception-form"].addEventListener("submit", saveException);
  elements["exception-cancel"].addEventListener("click", () => elements["exception-dialog"].close());
  elements["section-cancel"].addEventListener("click", () => elements["section-dialog"].close());
  elements["permission-close"].addEventListener("click", () => elements["permission-dialog"].close());
  elements["permission-linked"].addEventListener("click", requestLinkedPermissions);
  elements["permission-revoke"].addEventListener("click", revokeAllPermissions);
  elements["settings-permission-button"].addEventListener("click", openPermissionDialog);
  elements["clear-page-reviews"].addEventListener("click", clearSavedPageReviews);
  elements["clear-batch-data"].addEventListener("click", clearSavedBatch);
  elements["clear-unsent-feedback"].addEventListener("click", () => clearFeedbackData(false));
  elements["clear-sent-feedback"].addEventListener("click", () => clearFeedbackData(true));
  elements["clear-allowed-terms"].addEventListener("click", clearAllowedTerms);
  elements["clear-page-preferences"].addEventListener("click", clearPagePreferences);
  elements["optional-non-breaking-space"].addEventListener("change", saveOptionalChecks);
  elements["optional-passive-voice"].addEventListener("change", saveOptionalChecks);
  elements["return-review-button"].addEventListener("click", returnToReview);
  elements["note-form"].addEventListener("submit", saveAuditNote);
  elements["note-cancel"].addEventListener("click", () => elements["note-dialog"].close());
  elements["add-feedback-button"].addEventListener("click", () => openFeedbackDialog());
  elements["feedback-form"].addEventListener("submit", saveFeedbackNote);
  elements["feedback-dialog-close"].addEventListener("click", closeFeedbackDialog);
  elements["feedback-cancel"].addEventListener("click", closeFeedbackDialog);
  elements["copy-feedback-report"].addEventListener("click", openFeedbackCopyDialog);
  elements["export-feedback-csv"].addEventListener("click", exportFeedbackCsv);
  elements["create-feedback-email"].addEventListener("click", createFeedbackEmail);
  elements["feedback-email-close"].addEventListener("click", () => elements["feedback-email-dialog"].close());
  elements["keep-prepared-feedback"].addEventListener("click", () => elements["feedback-email-dialog"].close());
  elements["archive-prepared-feedback"].addEventListener("click", archivePreparedFeedback);
  elements["feedback-copy-close"].addEventListener("click", () => elements["feedback-copy-dialog"].close());
  elements["feedback-copy-options"].addEventListener("click", event => {
    const button = event.target.closest("[data-feedback-copy-mode]");
    if (button) handleFeedbackCopyMode(button.dataset.feedbackCopyMode);
  });
  elements["feedback-copy-list"].addEventListener("change", updateFeedbackCopyCount);
  elements["feedback-select-all"].addEventListener("click", () => setFeedbackCopySelection("all"));
  elements["feedback-select-unsent"].addEventListener("click", () => setFeedbackCopySelection("unsent"));
  elements["feedback-select-sent"].addEventListener("click", () => setFeedbackCopySelection("sent"));
  elements["feedback-select-none"].addEventListener("click", () => setFeedbackCopySelection("none"));
  elements["feedback-copy-selected"].addEventListener("click", async () => {
    await copyFeedbackNotes(selectedFeedbackCopyNotes());
    elements["feedback-copy-dialog"].close();
  });
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
  elements["batch-check-links"].addEventListener("change", updateBatchControls);
  elements["batch-link-access-button"].addEventListener("click", requestBatchLinkAccessAndFinish);
  elements["batch-finish-without-links"].addEventListener("click", finishBatchWithoutLinks);
  elements["batch-export-preset"].addEventListener("change", updateBatchControls);
  elements["download-current-workbook"].addEventListener("click", downloadCurrentWorkbook);
  elements["download-current-action-csv"].addEventListener("click", () => {
    if (!state.activeReport) return;
    downloadCsvRows(actionRows(state.activeReport, elements["current-export-reviewed"].checked), `bc-web-style-findings-${new Date().toISOString().slice(0, 10)}.csv`, ACTION_HEADER);
  });
  document.addEventListener("keydown", event => {
    if (state.reviewMode !== "detail" || event.defaultPrevented || /INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement && document.activeElement.tagName)) return;
    if (event.key.toLowerCase() === "n") { event.preventDefault(); event.shiftKey ? jumpIssueType(1) : moveGuided(1); }
    if (event.key.toLowerCase() === "p") { event.preventDefault(); moveGuided(-1); }
  });

  let scrollTimer;
  document.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => persistReviewContext(state.activePageKey).catch(() => { }), 250);
  }, { passive: true });

  if (!workspaceSurface) chrome.tabs.onActivated.addListener(() => { if (!state.batch.running) clearPageOverlays().finally(syncActiveTab); });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!workspaceSurface && state.activeTab && tabId === state.activeTab.id && changeInfo.status === "complete" && !state.batch.running) clearPageOverlays().finally(syncActiveTab);
  });
}

function syncStickyHeaderOffset() {
  const header = document.querySelector(".app-header");
  if (!header) return;
  document.documentElement.style.setProperty("--app-header-height", `${Math.ceil(header.getBoundingClientRect().height)}px`);
}

async function init() {
  cacheElements();
  document.body.dataset.surface = workspaceSurface ? "workspace" : "panel";
  syncStickyHeaderOffset();
  if (typeof ResizeObserver === "function") {
    const header = document.querySelector(".app-header");
    if (header) new ResizeObserver(syncStickyHeaderOffset).observe(header);
  }
  if (workspaceSurface) {
    elements["open-workspace-button"].hidden = true;
    elements["workspace-review-note"].hidden = false;
  }
  bindEvents();
  await loadState();
  renderFeedback();
  renderTerms();
  applyBatchStateToControls();
  renderBatchValidation();
  if (state.batch.records.length || state.batch.urls.length) renderBatchProgress();
  else updateBatchControls();
  await syncActiveTab();
  await refreshPreviewLifecycle({ forceRemote: true });
  const requestedView = surfaceParams.get("view");
  if (workspaceSurface && ["current", "batch", "terms"].includes(requestedView)) switchView(requestedView);
}

init().catch(error => {
  if (elements["current-error-message"]) showCurrentState("error", readableScanError(error));
});
