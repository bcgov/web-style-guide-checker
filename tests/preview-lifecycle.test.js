"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const lifecycle = require("../preview-lifecycle.js");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const html = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
const script = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");

function policy(overrides = {}) {
  return {
    schemaVersion: 1,
    pilotStatus: "active",
    latestVersion: "1.3.4",
    promptBelowVersion: "1.3.3",
    minimumSupportedVersion: "1.3.1",
    blockedVersions: [],
    downloadUrl: "https://github.com/bcgov/web-style-guide-checker/releases/latest",
    message: "",
    lastUpdated: "2026-09-01T20:30:00Z",
    ...overrides
  };
}

assert.equal(lifecycle.compareVersions("1.3.1", "1.3.2"), -1);
assert.equal(lifecycle.compareVersions("1.10.0", "1.9.9"), 1);
assert.equal(lifecycle.compareVersions("1.3", "1.3.0"), 0);
assert.equal(lifecycle.evaluatePolicy(policy(), "1.3.4", "2026-09-01").kind, "current");
assert.equal(lifecycle.evaluatePolicy(policy({ promptBelowVersion: "1.3.1" }), "1.3.3", "2026-09-01").kind, "update-available");
assert.equal(lifecycle.evaluatePolicy(policy(), "1.3.2", "2026-09-01").kind, "update-recommended");

const required = lifecycle.evaluatePolicy(policy(), "1.3.0", "2026-09-01");
assert.equal(required.kind, "update-required");
assert.equal(required.blocksUse, true);

const exactBlock = lifecycle.evaluatePolicy(policy({ blockedVersions: ["1.3.3"] }), "1.3.3", "2026-09-01");
assert.equal(exactBlock.kind, "version-blocked");
assert.equal(exactBlock.blocksUse, true);

assert.equal(lifecycle.evaluatePolicy(policy({ pilotStatus: "ended" }), "1.3.4", "2026-09-01").kind, "pilot-ended");
assert.equal(lifecycle.evaluatePolicy(policy(), "1.3.4", "2026-11-01").kind, "build-expired");
assert.equal(lifecycle.validatePolicy(policy({ downloadUrl: "http://github.com/bcgov/web-style-guide-checker/releases/latest" })), null);
assert.equal(lifecycle.validatePolicy(policy({ downloadUrl: "https://example.com/fake-download" })), null);
assert.equal(lifecycle.validatePolicy(policy({ latestVersion: "1.3.4", minimumSupportedVersion: "99.0.0" })), null);
assert.equal(lifecycle.validatePolicy(policy({ blockedVersions: ["1.3.2", "not-a-version"] })), null);

assert.equal(manifest.version, "1.3.2");

const publishedPolicy = JSON.parse(fs.readFileSync(path.join(root, "preview-status.json"), "utf8"));
const formerBuild = lifecycle.evaluatePolicy(publishedPolicy, "1.3.1", "2026-09-03");
assert.equal(formerBuild.kind, "update-required");
assert.equal(formerBuild.blocksUse, true, "Versions before the current security baseline must be blocked");
assert.equal(lifecycle.evaluatePolicy(publishedPolicy, "1.3.2", "2026-09-03").kind, "current");
assert.ok(
  (manifest.host_permissions || []).includes(
    "https://raw.githubusercontent.com/bcgov/web-style-guide-checker/*"
  )
);
assert.match(html, /id="preview-lifecycle-banner"/);
assert.match(html, /<script src="preview-lifecycle\.js"><\/script>/);
assert.match(script, /async function ensurePreviewCanRun\(/);
assert.match(
  script,
  /async function scanCurrentPage\(suppliedOptions\)\s*\{\s*if \(!await ensurePreviewCanRun\(\)\) return;/
);
assert.match(
  script,
  /async function checkHttpLinks\(options = \{\}\)\s*\{\s*if \(!await ensurePreviewCanRun\(\)\) return null;/
);
assert.match(
  script,
  /async function startBatchScan\(\)\s*\{\s*if \(!await ensurePreviewCanRun\(\)\) return;/
);
assert.match(
  script,
  /async function requestBatchLinkAccessAndFinish\(\)\s*\{\s*if \(!await ensurePreviewCanRun\(\)\) return;/
);

async function lifecycleCheckWithCache({ ageMs, forceRemote = false }) {
  const now = Date.parse("2026-09-03T12:00:00Z");
  const savedPolicy = policy({ latestVersion: "1.3.2", promptBelowVersion: "1.3.2", minimumSupportedVersion: "1.3.2" });
  const storage = {
    previewLifecyclePolicyV1: savedPolicy,
    previewLifecyclePolicyFetchedAtV1: now - ageMs
  };
  let fetchCount = 0;
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const context = {
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    Date: FixedDate,
    console,
    fetch: async () => {
      fetchCount += 1;
      return { ok: true, json: async () => savedPolicy };
    },
    chrome: {
      runtime: { getManifest: () => ({ version: "1.3.2" }) },
      storage: {
        local: {
          get: async keys => Object.fromEntries(keys.map(key => [key, storage[key]])),
          set: async values => Object.assign(storage, values)
        }
      }
    },
    globalThis: null
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(root, "preview-lifecycle.js"), "utf8"), context);
  const result = await context.BCWebStyleGuidePreviewLifecycle.check({ forceRemote });
  return { result, fetchCount };
}

(async () => {
  const fresh = await lifecycleCheckWithCache({ ageMs: 60 * 60 * 1000 });
  assert.equal(fresh.fetchCount, 0, "A validated policy fetched within 24 hours must prevent another outbound request");
  assert.equal(fresh.result.source, "cached");

  const stale = await lifecycleCheckWithCache({ ageMs: 25 * 60 * 60 * 1000 });
  assert.equal(stale.fetchCount, 1, "An expired lifecycle cache must be refreshed when the extension is opened");
  assert.equal(stale.result.source, "remote");

  const forced = await lifecycleCheckWithCache({ ageMs: 60 * 60 * 1000, forceRemote: true });
  assert.equal(forced.fetchCount, 1, "Check again must bypass a fresh lifecycle cache");
  assert.equal(forced.result.source, "remote");

  console.log("Preview lifecycle tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
