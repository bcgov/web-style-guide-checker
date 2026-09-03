"use strict";

(function (global) {
  const POLICY_URL =
    "https://raw.githubusercontent.com/bcgov/web-style-guide-checker/main/preview-status.json";
  const CACHE_KEY = "previewLifecyclePolicyV1";
  const CACHE_TIME_KEY = "previewLifecyclePolicyFetchedAtV1";
  const SCHEMA_VERSION = 1;
  const REQUEST_TIMEOUT_MS = 4000;
  const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
  const BUILT_IN_EXPIRY = "2026-10-31";
  const ALLOWED_PILOT_STATUSES = new Set(["active", "ended"]);
  const VERSION_PATTERN = /^\d+(?:\.\d+){0,3}$/;
  const ALLOWED_DOWNLOAD_HOSTS = new Set(["github.com"]);

  let lastResult = null;
  let lastCheckedAt = 0;

  function normalizeVersion(value) {
    const text = String(value || "").trim();
    return VERSION_PATTERN.test(text) ? text : "";
  }

  function versionParts(value) {
    const normalized = normalizeVersion(value);
    return normalized ? normalized.split(".").map(part => Number.parseInt(part, 10)) : null;
  }

  function compareVersions(first, second) {
    const a = versionParts(first);
    const b = versionParts(second);
    if (!a || !b) throw new Error("Invalid version.");
    const length = Math.max(a.length, b.length);
    for (let index = 0; index < length; index += 1) {
      const left = a[index] || 0;
      const right = b[index] || 0;
      if (left < right) return -1;
      if (left > right) return 1;
    }
    return 0;
  }

function validHttpsUrl(value, { download = false } = {}) {
  if (!value) return "";

  try {
    const url = new URL(String(value));

    // Allow the approved mailto address for preview requests.
    if (download && url.protocol === "mailto:") {
      const recipient = decodeURIComponent(url.pathname).toLowerCase();

      if (recipient !== "karmen.abrahams-munroe@gov.bc.ca") return "";

      return url.href;
    }

    // All other accepted URLs must use HTTPS.
    if (url.protocol !== "https:") return "";

    if (download) {
      if (!ALLOWED_DOWNLOAD_HOSTS.has(url.hostname.toLowerCase())) return "";
      if (!/^\/bcgov\/web-style-guide-checker(?:\/|$)/i.test(url.pathname)) return "";
    }

    return url.href;
  } catch (_) {
    return "";
  }
}

  function validatePolicy(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    if (input.schemaVersion !== SCHEMA_VERSION) return null;
    if (!ALLOWED_PILOT_STATUSES.has(input.pilotStatus)) return null;

    const latestVersion = normalizeVersion(input.latestVersion);
    const promptBelowVersion = normalizeVersion(input.promptBelowVersion);
    const minimumSupportedVersion = normalizeVersion(input.minimumSupportedVersion);
    if (!latestVersion || !promptBelowVersion || !minimumSupportedVersion) return null;
    if (compareVersions(promptBelowVersion, latestVersion) > 0) return null;
    if (compareVersions(minimumSupportedVersion, latestVersion) > 0) return null;

    const blockedVersions = Array.isArray(input.blockedVersions)
      ? input.blockedVersions.map(normalizeVersion).filter(Boolean)
      : null;
    if (!blockedVersions || blockedVersions.length > 100) return null;
    if (blockedVersions.length !== input.blockedVersions.length) return null;

    const downloadUrl = validHttpsUrl(input.downloadUrl, { download: true });
    if (input.downloadUrl && !downloadUrl) return null;

    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      pilotStatus: input.pilotStatus,
      latestVersion,
      promptBelowVersion,
      minimumSupportedVersion,
      blockedVersions: Object.freeze([...new Set(blockedVersions)]),
      downloadUrl,
      message: typeof input.message === "string" ? input.message.trim().slice(0, 500) : "",
      lastUpdated: typeof input.lastUpdated === "string" ? input.lastUpdated.trim().slice(0, 64) : ""
    });
  }

  function bundledPolicy(installedVersion) {
    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      pilotStatus: "active",
      latestVersion: installedVersion,
      promptBelowVersion: installedVersion,
      minimumSupportedVersion: installedVersion,
      blockedVersions: Object.freeze([]),
      downloadUrl: "",
      message: "",
      lastUpdated: ""
    });
  }

  function isoToday(date = new Date()) {
    return date.toISOString().slice(0, 10);
  }

  function evaluatePolicy(policy, installedVersion, today = isoToday()) {
    const current = normalizeVersion(installedVersion);
    const validPolicy = validatePolicy(policy);
    if (!current || !validPolicy) {
      return {
        kind: "current", blocksUse: false,
        installedVersion: current || String(installedVersion || ""),
        latestVersion: current || "", downloadUrl: "", message: "", source: "bundled"
      };
    }

    const base = {
      installedVersion: current,
      latestVersion: validPolicy.latestVersion,
      downloadUrl: validPolicy.downloadUrl,
      message: validPolicy.message,
      policy: validPolicy
    };

    if (validPolicy.pilotStatus === "ended") return { ...base, kind: "pilot-ended", blocksUse: true };
    if (today > BUILT_IN_EXPIRY) return { ...base, kind: "build-expired", blocksUse: true };
    if (validPolicy.blockedVersions.includes(current)) return { ...base, kind: "version-blocked", blocksUse: true };
    if (compareVersions(current, validPolicy.minimumSupportedVersion) < 0) return { ...base, kind: "update-required", blocksUse: true };
    if (compareVersions(current, validPolicy.promptBelowVersion) < 0) return { ...base, kind: "update-recommended", blocksUse: false };
    if (compareVersions(current, validPolicy.latestVersion) < 0) return { ...base, kind: "update-available", blocksUse: false };
    return { ...base, kind: "current", blocksUse: false };
  }

  async function readCachedPolicy() {
    if (!global.chrome || !chrome.storage || !chrome.storage.local) return null;
    try {
      const stored = await chrome.storage.local.get([CACHE_KEY, CACHE_TIME_KEY]);
      const policy = validatePolicy(stored[CACHE_KEY]);
      return policy ? { policy, fetchedAt: Number(stored[CACHE_TIME_KEY]) || 0 } : null;
    } catch (_) {
      return null;
    }
  }

  async function saveCachedPolicy(policy) {
    if (!global.chrome || !chrome.storage || !chrome.storage.local) return;
    try {
      await chrome.storage.local.set({ [CACHE_KEY]: policy, [CACHE_TIME_KEY]: Date.now() });
    } catch (_) {}
  }

  async function fetchRemotePolicy() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const separator = POLICY_URL.includes("?") ? "&" : "?";
      const response = await fetch(`${POLICY_URL}${separator}preview_check=${Date.now()}`, {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      if (!response.ok) return null;
      const policy = validatePolicy(await response.json());
      if (!policy) return null;
      await saveCachedPolicy(policy);
      return policy;
    } catch (_) {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  function installedVersion() {
    try { return chrome.runtime.getManifest().version; }
    catch (_) { return "0.0.0"; }
  }

  async function check({ forceRemote = false } = {}) {
    const now = Date.now();
    if (!forceRemote && lastResult && now - lastCheckedAt < CHECK_INTERVAL_MS) return lastResult;

    const currentVersion = installedVersion();
    const cached = await readCachedPolicy();
    const cachedIsFresh = Boolean(
      cached && cached.policy && cached.fetchedAt > 0 &&
      cached.fetchedAt <= now && now - cached.fetchedAt < CHECK_INTERVAL_MS
    );
    let policy = !forceRemote && cachedIsFresh ? cached.policy : await fetchRemotePolicy();
    let source = !forceRemote && cachedIsFresh ? "cached" : "remote";

    if (!policy) {
      if (cached && cached.policy) {
        policy = cached.policy;
        source = "cached";
      }
    }

    if (!policy) {
      policy = bundledPolicy(currentVersion);
      source = "bundled";
    }

    lastResult = {
      ...evaluatePolicy(policy, currentVersion),
      source,
      checkedAt: new Date().toISOString(),
      builtInExpiry: BUILT_IN_EXPIRY
    };
    lastCheckedAt = now;
    return lastResult;
  }

  const api = Object.freeze({
    policyUrl: POLICY_URL,
    builtInExpiry: BUILT_IN_EXPIRY,
    compareVersions,
    validatePolicy,
    evaluatePolicy,
    check
  });

  global.BCWebStyleGuidePreviewLifecycle = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
