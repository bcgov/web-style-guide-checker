"use strict";

// Run with: node tests/asset-size.test.js
// Exercise the shipped functions with controlled HTTP responses. No network or
// Chrome installation is needed; authenticated browser access remains a manual check.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");
const core = fs.readFileSync(path.join(root, "checker-core.js"), "utf8");
const panel = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8").replace(/\r\n/g, "\n");

function shippedFunction(name) {
  const match = new RegExp(`^(?:async )?function ${name}\\(`, "m").exec(panel);
  assert.ok(match, `Missing function ${name}`);
  const tail = panel.slice(match.index + match[0].length);
  const next = /\n(?:async )?function \w+\(/.exec(tail);
  assert.ok(next, `Missing boundary after ${name}`);
  return panel.slice(match.index, match.index + match[0].length + next.index);
}

function response(bytes, { status = 200, headers = {}, serialized = false } = {}) {
  const raw = new Headers({ "content-type": "application/pdf", ...headers });
  if (bytes !== null) raw.set("content-length", String(bytes));
  return serialized ? { status: "ok", code: status, headers: {
    contentLength: raw.get("content-length") || "",
    contentRange: raw.get("content-range") || "",
    contentEncoding: raw.get("content-encoding") || "",
    contentType: raw.get("content-type") || "",
    contentDisposition: raw.get("content-disposition") || ""
  } } : { status: "ok", response: { status, headers: raw } };
}

function environment(result) {
  const requests = [];
  const context = vm.createContext({ URL, Headers, AbortController, setTimeout, clearTimeout,
    normalizeSpace: value => String(value || "").replace(/\s+/g, " ").trim(),
    cmsLiteManagedAssetGuid: () => false,
    checkCmsLiteManagedAssetSource: async () => null,
    checkWithCurrentPageSession: async () => null,
    hostnameFor: value => new URL(value).hostname,
    // Deliberately return a different live version if anything substitutes QA.
    qaProductionEquivalent: value => value.replace("www2.qa.gov.bc.ca", "www2.gov.bc.ca"),
    checkRemoteUrl: async (url, timeout, options) => {
      requests.push({ url, timeout, options });
      return typeof result === "function" ? result(url) : result;
    }
  });
  vm.runInContext(core.replace(/      assetLabel,\r?\n/, "      assetLabel, cssPath, adjacentAssetLabel,\n"), context, { filename: "checker-core.js" });
  vm.runInContext(panel.slice(panel.indexOf("const TRUSTED_SESSION_HOSTS ="),
    panel.indexOf("const AUTH_REDIRECT_HOSTS =")), context);
  for (const name of ["trustedSessionHost", "mimeAssetType", "declaredBytes", "displayBytes", "assetResponseHeader",
    "verifiedAssetSize", "assetSizeTolerance", "assetSizeMismatch", "updateAssetLabelSuggestion", "editorSourceKey",
    "appendUniqueFinding", "measureEditorAssetInPage", "measureEditorAssetSize", "verifyOneAsset", "enrichAssetChecks", "scanTab"]) {
    vm.runInContext(shippedFunction(name), context, { filename: `sidepanel.js:${name}` });
  }
  return { context, requests };
}

function fixture(context, text = "Application form (PDF)", extra = {}) {
  const checker = context.BCWebStyleGuideChecker;
  const label = checker.helpers.assetLabel(text);
  const asset = { href: "https://www2.gov.bc.ca/assets/form.pdf", text, selector: "#form",
    editorRegion: null, expectedType: "PDF", declaredType: label.type,
    declaredSize: label.size, declaredUnit: label.unit, validLabel: label.valid,
    labelStatus: label.status, ...extra };
  const report = { page: { url: "https://www2.gov.bc.ca/forms" }, settings: {}, issues: [], assets: [asset] };
  const rule = { "missing-label": "file-link-label", "missing-size": "file-link-size", "missing-type": "file-link-type" }[label.status];
  if (rule) {
    const finding = checker.createExternalFinding(rule, report.page.url, {
      ...asset, evidence: text, matchText: label.raw, replacement: extra.replacement || ""
    });
    finding.occurrenceCount = 2;
    report.issues.push(finding);
  }
  return { asset, report };
}

for (const measured of [2.21, 2.3, 2.39, 2.2, 2.4]) {
  test(`2.3MB accepts ${measured}MB, including inclusive tolerance boundaries`, async () => {
    const { context } = environment(response(Math.round(measured * 1024 ** 2)));
    const { report, asset } = fixture(context, "Form (PDF, 2.3MB)");
    await context.verifyOneAsset(report, asset);
    assert.equal(report.issues.length, 0);
  });
}
for (const measured of [2.09, 2.41, 3]) {
  test(`2.3MB flags ${measured}MB with a measured suggested action`, async () => {
    const { context } = environment(response(Math.round(measured * 1024 ** 2)));
    const { report, asset } = fixture(context, "Form (PDF, 2.3MB)");
    await context.verifyOneAsset(report, asset);
    assert.equal(report.issues.length, 1);
    assert.equal(report.issues[0].ruleId, "file-link-size-mismatch");
    assert.match(report.issues[0].suggestion, /^Change 2\.3MB to [\d.]+MB\.$/);
  });
}
test("KB tolerance accepts both conventions and flags beyond their outer boundaries", async () => {
  for (const [bytes, mismatch] of [[261000, false], [260999, true], [281 * 1024, false], [281 * 1024 + 1, true]]) {
    const { context } = environment(response(bytes));
    const { report, asset } = fixture(context, "Form (PDF, 271KB)");
    await context.verifyOneAsset(report, asset);
    assert.equal(report.issues.length, mismatch ? 1 : 0);
  }
});
test("GB labels retain their existing tolerance", async () => {
  for (const measured of [2.95, 3.05, 3.5]) {
    const { context } = environment(response(Math.round(measured * 1024 ** 3)));
    const { report, asset } = fixture(context, "Form (PDF, 3GB)");
    await context.verifyOneAsset(report, asset);
    assert.equal(report.issues.length, measured === 3.5 ? 1 : 0);
  }
});

for (const text of ["Application form", "Application form (PDF)", "Application form (200KB)"]) {
  test(`Measured label updates the original finding for: ${text}`, async () => {
    const { context } = environment(response(296 * 1024));
    const { report, asset } = fixture(context, text);
    const original = report.issues[0];
    const fingerprint = original.fingerprint;
    const evidence = original.evidence;
    await context.verifyOneAsset(report, asset);
    assert.equal(report.issues.length, text.includes("200KB") ? 2 : 1);
    assert.equal(report.issues[0], original);
    assert.equal(original.suggestion, "Add (PDF, 296KB) to the link text.");
    assert.equal(original.fingerprint, fingerprint);
    assert.equal(original.evidence, evidence);
    assert.equal(original.occurrenceCount, 2);
    if (original.matchText) assert.equal(original.replacement, "(PDF, 296KB)");
  });
}
test("Unknown size leaves an existing complete label quiet", async () => {
  const { context } = environment(response(null));
  const { report, asset } = fixture(context, "Form (PDF, 296KB)");
  await context.verifyOneAsset(report, asset);
  assert.equal(report.issues.length, 0);
  assert.equal(asset.actualSize, null);
});
test("Unknown size supplies a placeholder and keeps the missing-size finding", async () => {
  const { context } = environment(response(null));
  const { report, asset } = fixture(context);
  await context.verifyOneAsset(report, asset);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].suggestion, "Add (PDF, [file size]) to the link text. Use KB or MB for the size.");
});
test("Permission failures retain plain fallback wording with no arbitrary size", async () => {
  const { context } = environment({ status: "permission" });
  for (const text of ["Form", "Form (PDF)", "Form (PDF, 296KB)"]) {
    const { report, asset } = fixture(context, text);
    await context.verifyOneAsset(report, asset);
    assert.equal(report.issues.length, text.endsWith("296KB)") ? 0 : 1);
    if (report.issues.length) assert.doesNotMatch(report.issues[0].suggestion, /\d+(?:\.\d+)?\s*(?:KB|MB)/);
  }
});

for (const serialized of [false, true]) {
  test(`Partial response uses full file size (${serialized ? "frame headers" : "Response headers"})`, async () => {
    const { context } = environment(response(1, { serialized, status: 206,
      headers: { "content-range": `bytes 0-0/${296 * 1024}` } }));
    const { report, asset } = fixture(context);
    await context.verifyOneAsset(report, asset);
    assert.equal(asset.actualSize, 296 * 1024);
    assert.equal(report.issues[0].suggestion, "Add (PDF, 296KB) to the link text.");
  });
  test(`Compressed response leaves a complete label quiet (${serialized ? "frame" : "public"})`, async () => {
    const { context } = environment(response(100, { serialized, headers: { "content-encoding": "gzip" } }));
    const { report, asset } = fixture(context, "Form (PDF, 296KB)");
    await context.verifyOneAsset(report, asset);
    assert.equal(asset.actualSize, null);
    assert.equal(report.issues.length, 0);
  });
}
test("Malformed, unknown, empty and inconsistent lengths stay unverified", async () => {
  const invalid = [response(1, { status: 206 }),
    response(1, { status: 206, headers: { "content-range": "bytes 0-0/*" } }),
    response(1, { status: 206, headers: { "content-range": "bytes 0-9/20" } }),
    response(1, { status: 206, headers: { "content-range": "bytes 2-1/20" } }),
    response(1, { status: 206, headers: { "content-range": "bytes 20-20/20" } }),
    response(1, { headers: { "content-range": "bytes 0-0/100" } }),
    response(0), response("-1"), response("bad"), response("1.5"),
    response("9007199254740992"), response(100, { status: 204 })];
  for (const result of invalid) {
    const { context } = environment(result);
    const { report, asset } = fixture(context, "Form (PDF, 296KB)");
    await context.verifyOneAsset(report, asset);
    assert.equal(asset.actualSize, null);
    assert.equal(report.issues.length, 0);
  }
});
test("HTML success responses cannot become a document's measured size", async () => {
  for (const contentType of ["text/html; charset=utf-8", "application/xhtml+xml"]) {
    const { context } = environment(response(100, { headers: { "content-type": contentType } }));
    const { report, asset } = fixture(context, "Form (PDF, 296KB)");
    await context.verifyOneAsset(report, asset);
    assert.equal(asset.actualSize, null);
    assert.equal(report.issues.length, 0);
  }
});
test("QA size checking requests the linked QA file even when live differs", async () => {
  const { context, requests } = environment(url => response((url.includes(".qa.") ? 296 : 500) * 1024));
  const { report, asset } = fixture(context, "Form (PDF, 296KB)", { href: "https://www2.qa.gov.bc.ca/assets/form.pdf" });
  await context.verifyOneAsset(report, asset);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, asset.href);
  assert.equal(requests[0].options.sessionAware, false);
  assert.equal(asset.checkedUrl, asset.href);
  assert.equal(report.issues.length, 0);
});
test("Public asset requests retain anonymous settings", async () => {
  const { context, requests } = environment(response(296 * 1024));
  const { report, asset } = fixture(context);
  await context.verifyOneAsset(report, asset);
  assert.equal(requests[0].options.sessionAware, false);
});
test("Identical selectors in separate editor fields update only their own finding", async () => {
  const { context } = environment(response(296 * 1024));
  const first = fixture(context, "Form (PDF)", { editorRegion: 1, editorSource: { editorKey: "field-one" } });
  const second = fixture(context, "Form (PDF)", { editorRegion: 1, editorSource: { editorKey: "field-two" } });
  const unchanged = second.report.issues[0].suggestion;
  first.report.issues.push(second.report.issues[0]);
  await context.verifyOneAsset(first.report, first.asset);
  assert.equal(first.report.issues[0].suggestion, "Add (PDF, 296KB) to the link text.");
  assert.equal(first.report.issues[1].suggestion, unchanged);
});
test("Type mismatch findings still work", async () => {
  const { context } = environment(response(296 * 1024, { headers: { "content-type": "application/msword" } }));
  const { report, asset } = fixture(context, "Form (PDF, 296KB)");
  await context.verifyOneAsset(report, asset);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].ruleId, "file-link-type-mismatch");
});
test("The normal scan path returns the enriched original finding", async () => {
  const { context } = environment(response(296 * 1024));
  const { report } = fixture(context);
  context.injectScanner = async () => report;
  const scanned = await context.scanTab(10, {});
  assert.equal(scanned, report);
  assert.equal(scanned.issues[0].suggestion, "Add (PDF, 296KB) to the link text.");
});

test("Both injected session readers preserve range and encoding headers", async () => {
  for (const name of ["checkWithCurrentPageSession", "checkCmsLiteManagedAssetSource"]) {
    const target = "https://cmslite.gov.bc.ca/assets/download/0123456789abcdef0123456789abcdef";
    const { context } = environment(response(null));
    Object.assign(context, {
      remoteDestinationSafety: () => ({ allowed: true }), authenticatedActionUrl: () => false,
      cmsLiteManagedAssetGuid: () => "0123456789abcdef0123456789abcdef",
      cmsLiteEditorSource: () => true, hostnameFor: value => new URL(value).hostname,
      urlOrigin: value => new URL(value).origin, publicQaCmsDestination: () => false,
      currentReviewTab: async () => ({ id: 10, url: target }),
      location: { href: target, origin: new URL(target).origin },
      fetch: async () => ({ status: 206, url: target, redirected: false,
        headers: new Headers({ "content-length": "1", "content-range": "bytes 0-0/303104",
          "content-type": "application/pdf", "content-encoding": "br" }),
        body: { cancel: async () => {} } }),
      chrome: { scripting: { executeScript: async ({ func, args }) => [{ result: await func(...args) }] } }
    });
    vm.runInContext(shippedFunction(name), context);
    const result = await context[name]({ page: { url: target }, settings: { editorMode: true } }, target);
    assert.equal(result.headers.contentLength, "1");
    assert.equal(result.headers.contentRange, "bytes 0-0/303104");
    assert.equal(result.headers.contentEncoding, "br");
    assert.equal(context.verifiedAssetSize(result), null);
    result.headers.contentEncoding = "";
    assert.equal(context.verifiedAssetSize(result), 303104);
  }
});

test("The finding card renders the measured action shown to the author", async () => {
  const { context } = environment(response(296 * 1024));
  const { report, asset } = fixture(context);
  await context.verifyOneAsset(report, asset);
  Object.assign(context, {
    state: { activeReport: { settings: { profile: "cms-lite", scope: "content" } } },
    effectiveStatus: () => "open", auditNote: () => ({}), feedbackNotesForFinding: () => [],
    escapeHtml: value => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    sentenceLabel: value => value, renderedContrastDetails: () => "",
    renderedEvidence: finding => finding.evidence, editorDataAttributes: () => "",
    workspaceSurface: false
  });
  vm.runInContext(shippedFunction("renderFinding"), context);
  const html = context.renderFinding(report.issues[0]);
  assert.match(html, /Suggested action:<\/strong> Add \(PDF, 296KB\) to the link text\./);
  assert.doesNotMatch(html, /504KB/);
});

// These tests exercise the actual request path as well as the finding update.
// The birth-form server returned 200 for HEAD without a length, then ignored
// Range and returned a complete 183,657-byte PDF without length headers.
function networkEnvironment(reply, { permitted = true } = {}) {
  const { context } = environment(null);
  const requests = [];
  Object.assign(context, {
    remoteDestinationSafety: () => ({ allowed: true }),
    authenticatedActionUrl: () => false, signInMayBeRequired: () => false,
    looksLikeAuthenticationRedirect: () => false,
    originPattern: url => new URL(url).origin + "/*", canonicalUrl: url => url,
    chrome: { permissions: { contains: async () => permitted } },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      return reply(url, options);
    }
  });
  for (const name of ["measurePublicAssetSize", "isManualRedirect", "fetchRemoteFollowingRedirects",
    "fetchRemoteOnce", "sessionVerificationMessage", "safetyBlockedResult", "checkRemoteUrl"]) {
    vm.runInContext(shippedFunction(name), context);
  }
  return { context, requests };
}

function networkResponse(body = null, { status = 200, headers = {} } = {}) {
  return new Response(body, { status, headers: { "content-type": "application/pdf", ...headers } });
}

test("Birth-form response without length or range support supplies a measured suggestion", async () => {
  const { context, requests } = networkEnvironment((_url, options) =>
    networkResponse(options.method === "HEAD" ? null : new Uint8Array(183657)));
  const { report, asset } = fixture(context, "Application for Birth Certificate or Registration Photocopy");
  const original = report.issues[0];
  await context.verifyOneAsset(report, asset);
  assert.equal(asset.actualSize, 183657);
  assert.equal(report.issues[0], original);
  assert.equal(original.suggestion, "Add (PDF, 179KB) to the link text.");
  assert.deepEqual(requests.map(item => item.method), ["HEAD", "GET"]);
  assert.equal(requests[1].headers.Range, "bytes=0-0");
  assert.equal(requests[1].redirect, "error");
  assert.ok(requests.every(item => item.credentials === "omit"));
  assert.equal(requests[1].url, asset.href);
});

test("A range retry uses the full total without reading the body", async () => {
  let cancelled = false;
  const { context } = networkEnvironment((_url, options) => options.method === "HEAD" ? networkResponse()
    : networkResponse(new ReadableStream({ cancel() { cancelled = true; } }), {
      status: 206, headers: { "content-range": "bytes 0-0/183657", "content-length": "1" }
    }));
  const { report, asset } = fixture(context);
  await context.verifyOneAsset(report, asset);
  assert.equal(asset.actualSize, 183657);
  assert.equal(cancelled, true);
});

test("Byte-counted sizes also correct existing inaccurate labels", async () => {
  const { context } = networkEnvironment((_url, options) =>
    networkResponse(options.method === "HEAD" ? null : new Uint8Array(183657)));
  const { report, asset } = fixture(context, "Form (PDF, 299KB)");
  await context.verifyOneAsset(report, asset);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].suggestion, "Change 299KB to 179KB.");
});

test("Known lengths, ordinary link checks and signed-in requests do not start size downloads", async () => {
  for (const kind of ["known", "ordinary", "session"]) {
    const { context, requests } = networkEnvironment(() => networkResponse(null, {
      headers: kind === "known" ? { "content-length": "183657" } : {}
    }));
    const target = kind === "session" ? "https://intranet.gov.bc.ca/assets/form.pdf"
      : "https://www2.gov.bc.ca/assets/form.pdf";
    await context.checkRemoteUrl(target, 8000, {
      sessionAware: kind === "session", measureAssetSize: kind !== "ordinary"
    });
    assert.deepEqual(requests.map(item => item.method), ["HEAD"], kind);
  }
});

test("Denied permission and unsuccessful or HTML HEAD responses do not start size downloads", async () => {
  for (const kind of ["permission", "restricted", "html"]) {
    const { context, requests } = networkEnvironment(() => networkResponse(null, {
      status: kind === "restricted" ? 403 : 200,
      headers: kind === "html" ? { "content-type": "text/html" } : {}
    }), { permitted: kind !== "permission" });
    const { report, asset } = fixture(context, "Form (PDF, 299KB)");
    await context.verifyOneAsset(report, asset);
    assert.equal(report.issues.length, 0, kind);
    assert.ok(requests.every(item => item.method === "HEAD"), kind);
  }
});

test("Invalid, interrupted, oversized and redirected size downloads leave an existing label quiet", async () => {
  for (const kind of ["empty", "partial", "ambiguous", "html", "restricted", "oversized", "interrupted", "redirect"]) {
    let cancelled = false;
    const { context } = networkEnvironment((_url, options) => {
      if (options.method === "HEAD") return networkResponse();
      if (kind === "redirect") throw new TypeError("Redirect disallowed");
      if (kind === "interrupted") return networkResponse(new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array(100)); controller.error(new Error("Connection lost")); }
      }));
      if (kind === "oversized") return networkResponse(new ReadableStream({
        pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
        cancel() { cancelled = true; }
      }));
      return networkResponse(kind === "empty" ? null : new Uint8Array(100), {
        status: kind === "partial" ? 206 : kind === "restricted" ? 403 : 200,
        headers: kind === "html" ? { "content-type": "text/html" }
          : kind === "ambiguous" ? { "content-range": "bytes 0-99/200" } : {}
      });
    });
    const { report, asset } = fixture(context, "Form (PDF, 299KB)");
    await context.verifyOneAsset(report, asset);
    assert.equal(asset.actualSize, null, kind);
    assert.equal(report.issues.length, 0, kind);
    if (kind === "oversized") assert.equal(cancelled, true);
  }
});

test("Missing labels keep the placeholder when the optional download fails", async () => {
  const { context } = networkEnvironment((_url, options) => {
    if (options.method === "GET") throw new Error("Network unavailable");
    return networkResponse();
  });
  const { report, asset } = fixture(context);
  await context.verifyOneAsset(report, asset);
  assert.equal(report.issues[0].suggestion, "Add (PDF, [file size]) to the link text. Use KB or MB for the size.");
});

test("Compressed full responses use decoded stream bytes instead of transfer length", async () => {
  // Fetch exposes decoded bytes while preserving the original encoding header.
  const { context } = networkEnvironment((_url, options) => networkResponse(
    options.method === "HEAD" ? null : new Uint8Array(183657),
    { headers: { "content-encoding": "gzip", "content-length": "90000" } }
  ));
  const { report, asset } = fixture(context);
  await context.verifyOneAsset(report, asset);
  assert.equal(asset.actualSize, 183657);
  assert.equal(report.issues[0].suggestion, "Add (PDF, 179KB) to the link text.");
});

test("The download timeout interrupts a stalled size stream", async () => {
  let aborted = false;
  const { context } = networkEnvironment((_url, options) => options.method === "HEAD" ? networkResponse()
    : networkResponse(new ReadableStream({
      start(controller) {
        options.signal.addEventListener("abort", () => {
          aborted = true;
          controller.error(new Error("Timed out"));
        }, { once: true });
      }
    })));
  const result = await context.checkRemoteUrl("https://www2.gov.bc.ca/assets/form.pdf", 20, { measureAssetSize: true });
  assert.equal(aborted, true);
  assert.equal(result.status, "ok");
  assert.equal(context.verifiedAssetSize(result), null);
});

test("A slow HEAD request leaves a fresh timeout window for the size download", async () => {
  const signals = [];
  const { context } = networkEnvironment(async (_url, options) => {
    signals.push(options.signal);
    await new Promise(resolve => setTimeout(resolve, 30));
    if (options.signal.aborted) throw new Error("Timed out");
    return networkResponse(options.method === "HEAD" ? null : new Uint8Array(183657));
  });
  const result = await context.checkRemoteUrl("https://www2.gov.bc.ca/assets/form.pdf", 50, { measureAssetSize: true });
  assert.equal(context.verifiedAssetSize(result), 183657);
  assert.notEqual(signals[0], signals[1]);
});

// Small DOM fixture for sibling traversal and the selectors used by real scans.
// Query matching is independent of cssPath and checks direct-child relationships.
function domFixture() {
  const elements = [];
  const doc = { defaultView: { getComputedStyle: node => ({ display: node.hidden ? 'none' : 'inline', visibility: 'visible' }) } };
  function element(tag, parent = null, attrs = {}) {
    const node = { nodeType: 1, tagName: tag.toUpperCase(), ownerDocument: doc,
      parentElement: parent, children: [], childNodes: [], nextSibling: null,
      getAttribute: key => attrs[key] || null, hidden: !!attrs.hidden };
    Object.defineProperty(node, 'textContent', { get: () => node.childNodes.map(n => n.textContent).join('') });
    elements.push(node); attach(node, parent); return node;
  }
  function attach(node, parent) {
    if (!parent) return;
    const previous = parent.childNodes.at(-1);
    if (previous) previous.nextSibling = node;
    parent.childNodes.push(node);
    if (node.nodeType === 1) parent.children.push(node);
  }
  function text(value, parent) {
    const node = { nodeType: 3, textContent: value, parentElement: parent, nextSibling: null };
    attach(node, parent); return node;
  }
  function matches(node, part) {
    if (!node) return false;
    const m = /^(\w+)(?::nth-of-type\((\d+)\))?$/.exec(part);
    if (!m || node.tagName.toLowerCase() !== m[1]) return false;
    return !m[2] || node.parentElement.children.filter(n => n.tagName === node.tagName).indexOf(node) + 1 === Number(m[2]);
  }
  doc.querySelectorAll = selector => elements.filter(node => {
    for (const part of selector.split(' > ').reverse()) {
      if (!matches(node, part)) return false;
      node = node.parentElement;
    }
    return true;
  });
  doc.documentElement = element('html');
  const body = element('body', doc.documentElement);
  return { doc, body, element, text };
}

test('Repeated table structures have distinct selectors that resolve to the correct links', () => {
  const { context } = environment(null);
  const d = domFixture();
  const links = [];
  for (let i = 0; i < 3; i++) {
    let node = d.element('section', d.body);
    for (const tag of ['div','div','table','tbody','tr','td','ul','li','a']) node = d.element(tag, node);
    links.push(node);
  }
  const paths = links.map(context.BCWebStyleGuideChecker.helpers.cssPath);
  assert.equal(new Set(paths).size, 3);
  paths.forEach((p, i) => assert.deepEqual(d.doc.querySelectorAll(p), [links[i]]));
});

test('Adjacent labels are recognized in text, inline wrappers and outside a wrapped link', () => {
  const { context } = environment(null);
  for (const mode of ['text', 'wrapped-label', 'wrapped-link', 'partial-type', 'partial-size']) {
    const d = domFixture();
    const p = d.element('p', d.body);
    const a = d.element('a', mode === 'wrapped-link' ? d.element('strong', p) : p);
    d.text('Application form', a);
    d.text('\u00a0', p);
    const raw = mode === 'partial-type' ? '(PDF)' : mode === 'partial-size' ? '(299KB)' : '(PDF, 299KB)';
    d.text(raw, mode === 'wrapped-label' ? d.element('span', p) : p);
    const label = context.BCWebStyleGuideChecker.helpers.adjacentAssetLabel(a);
    assert.equal(label.raw, raw, mode);
  }
});

test('Adjacent label lookup stops at links, line breaks, other blocks and intervening prose', () => {
  const { context } = environment(null);
  for (const mode of ['a', 'br', 'p', 'prose', 'hidden', 'unrelated']) {
    const d = domFixture(); const p = d.element('p', d.body); const a = d.element('a', p);
    d.text('Form', a);
    if (mode === 'prose') d.text(' More details ', p);
    else if (mode === 'unrelated') d.text('(online submission) ', p);
    else d.element(mode === 'hidden' ? 'span' : mode, p, { hidden: mode === 'hidden' });
    d.text('(PDF, 299KB)', p);
    assert.equal(context.BCWebStyleGuideChecker.helpers.adjacentAssetLabel(a), null, mode);
  }
});

test('A different asset URL cannot overwrite a finding even if selectors collide', async () => {
  const { context } = environment(response(183657));
  const first = fixture(context, 'Birth form');
  const other = fixture(context, 'Death form', { href: 'https://www2.gov.bc.ca/assets/death.pdf' });
  first.report.issues[0].assetHref = first.asset.href;
  other.report.issues[0].assetHref = other.asset.href;
  const original = other.report.issues[0].suggestion;
  first.report.issues.push(other.report.issues[0]);
  await context.verifyOneAsset(first.report, first.asset);
  assert.equal(first.report.issues[0].suggestion, 'Add (PDF, 179KB) to the link text.');
  assert.equal(other.report.issues[0].suggestion, original);
});

function outsideFixture(context, raw) {
  const label = context.BCWebStyleGuideChecker.helpers.assetLabel(raw);
  const { asset, report } = fixture(context, 'Application form', {
    labelStatus: 'outside-link', outsideLabel: raw,
    declaredType: label.type, declaredSize: label.size, declaredUnit: label.unit
  });
  report.issues = [context.BCWebStyleGuideChecker.createExternalFinding('file-link-label-outside', report.page.url, {
    ...asset, evidence: `Application form ${raw}`, suggestion: 'Move the file details into the link text.'
  })];
  return { asset, report };
}

test('Outside label with the wrong size gets one finding to move and correct it', async () => {
  const { context } = environment(response(183657));
  const { report, asset } = outsideFixture(context, '(PDF, 299KB)');
  await context.verifyOneAsset(report, asset);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].title, 'Correct the size and move the file details');
  assert.equal(report.issues[0].suggestion,
    'Change 299KB to 179KB. Move (PDF, 179KB) into the link text.');
});

test('Outside labels within tolerance keep the displayed size and remove unit spacing', async () => {
  for (const [label, bytes, expected] of [['(PDF, 1.1 MB)', 1161 * 1024, '1.1MB'], ['(PDF, 2.3MB)', 2.21 * 1024 ** 2, '2.3MB']]) {
    const { context } = environment(response(Math.round(bytes)));
    const { report, asset } = outsideFixture(context, label);
    await context.verifyOneAsset(report, asset);
    assert.equal(report.issues.length, 1);
    assert.equal(report.issues[0].suggestion, `Move the file details into the link text: (PDF, ${expected}).`);
  }
});

test('Unknown size preserves an outside label with a placement finding only', async () => {
  const { context } = environment(response(null));
  const { report, asset } = outsideFixture(context, '(PDF, 299KB)');
  await context.verifyOneAsset(report, asset);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].suggestion, 'Move the file details into the link text: (PDF, 299KB).');
  assert.doesNotMatch(report.issues[0].suggestion, /unverified|could not|change/i);
});

test('KB suggestions match document properties and MB suggestions retain tenths', () => {
  const { context } = environment(null);
  for (const [bytes, expected] of [
    [1499, '1KB'], [1535, '1KB'], [1536, '2KB'], [183657, '179KB'],
    [999499, '976KB'], [999500, '976KB'], [1000000, '1MB'],
    [1749999, '1.7MB'], [1750000, '1.8MB'], [1788000, '1.8MB'], [1834000, '1.8MB']
  ]) assert.equal(context.displayBytes(bytes), expected, String(bytes));
});

test('1788KB gets a 1.8MB suggestion while an existing 1.7MB label passes', async () => {
  const { context } = environment(response(1788000));
  const missing = fixture(context, 'Form (PDF)');
  await context.verifyOneAsset(missing.report, missing.asset);
  assert.equal(missing.report.issues[0].suggestion, 'Add (PDF, 1.8MB) to the link text.');
  const existing = fixture(context, 'Form (PDF, 1.7MB)');
  await context.verifyOneAsset(existing.report, existing.asset);
  assert.equal(existing.report.issues.length, 0);
});

test('Screenshot case: 1834KB document properties do not flag an existing 1.9MB label', async () => {
  // Cover both properties conventions and their whole-KB rounding interval.
  for (const base of [1000, 1024]) {
    for (const displayedKB of [1833.5, 1834, 1834.499]) {
      const { context } = environment(response(Math.round(displayedKB * base)));
      const { report, asset } = fixture(context, 'VSA 413 (PDF, 1.9MB)');
      await context.verifyOneAsset(report, asset);
      assert.equal(report.issues.length, 0, `${displayedKB} * ${base}`);
    }
  }
});

test('Existing decimal and binary KB labels pass without forced unit conversion', async () => {
  for (const [bytes, text] of [[183657, 'Form (PDF, 179KB)'], [183657, 'Form (PDF, 184KB)'],
    [1788000, 'Form (PDF, 1788KB)'], [1788000, 'Form (PDF, 1.8MB)']]) {
    const { context } = environment(response(bytes));
    const { report, asset } = fixture(context, text);
    await context.verifyOneAsset(report, asset);
    assert.equal(report.issues.length, 0, text);
  }
});

test('MB tolerance uses raw bytes and still flags beyond both conventions', () => {
  const { context } = environment(null);
  const asset = { declaredSize: 2.3, declaredUnit: 'MB' };
  assert.equal(context.assetSizeMismatch(asset, 2200000), false);
  assert.equal(context.assetSizeMismatch(asset, 2199999), true);
  const upper = asset.declaredSize * 1024 ** 2 + context.assetSizeTolerance(asset, 0);
  assert.equal(context.assetSizeMismatch(asset, Math.floor(upper)), false);
  assert.equal(context.assetSizeMismatch(asset, Math.floor(upper) + 1), true);
});

test('An outside 1.7MB label is retained for a measured 1788KB file', async () => {
  const { context } = environment(response(1788000));
  const { report, asset } = outsideFixture(context, '(PDF, 1.7MB)');
  await context.verifyOneAsset(report, asset);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].suggestion, 'Move the file details into the link text: (PDF, 1.7MB).');
});

function editorEnvironment(reply) {
  const { context } = environment(null);
  const requests = [];
  const origin = 'https://cmslite.gov.bc.ca';
  Object.assign(context, {
    remoteDestinationSafety: () => ({ allowed: true }), authenticatedActionUrl: () => false,
    cmsLiteManagedAssetGuid: value => /\/assets\/download\/[a-f0-9]{32}/i.test(value),
    cmsLiteEditorSource: value => new URL(value).hostname === 'cmslite.gov.bc.ca',
    urlOrigin: value => new URL(value).origin, publicQaCmsDestination: () => false,
    currentReviewTab: async () => ({ id: 10, url: origin + '/editor' }),
    chrome: { scripting: { executeScript: async ({ func, args }) => {
      // Chrome runs this function without side-panel closures, then serializes it.
      const isolated = vm.runInNewContext('(' + func.toString() + ')', {
        URL, AbortController, setTimeout, clearTimeout,
        location: { href: origin + '/editor', origin },
        fetch: async (url, options) => {
          requests.push({ url, ...options });
          return reply(url, options, requests.length);
        }
      });
      return [{ result: JSON.parse(JSON.stringify(await isolated(...args))) }];
    } } }
  });
  for (const name of ['checkWithCurrentPageSession', 'checkCmsLiteManagedAssetSource']) {
    vm.runInContext(shippedFunction(name), context);
  }
  return { context, requests, origin };
}

function editorFixture(context, href, text = 'Form (PDF, 532KB)') {
  const result = fixture(context, text, { href, editorRegion: 2, editorSource: { editorKey: 'body-field' } });
  result.report.page.url = 'https://cmslite.gov.bc.ca/editor';
  result.report.settings.editorMode = true;
  return result;
}

test('CMS Lite editor flags a size mismatch for chunked managed and direct asset responses', async () => {
  for (const route of ['/assets/download/0123456789abcdef0123456789abcdef', '/assets/gov/form.pdf']) {
    const { context, requests, origin } = editorEnvironment((url, options) => {
      const r = networkResponse(options.method === 'HEAD' ? null : new Uint8Array(311000));
      Object.defineProperty(r, 'url', { value: 'https://cmslite.gov.bc.ca/assets/gov/form.pdf' });
      return r;
    });
    const { report, asset } = editorFixture(context, origin + route);
    await context.verifyOneAsset(report, asset);
    assert.equal(asset.actualSize, 311000, route);
    assert.equal(report.issues.length, 1);
    assert.equal(report.issues[0].suggestion, 'Change 532KB to 304KB.');
    assert.equal(report.issues[0].evidence, 'Form (PDF, 532KB)');
    assert.equal(report.issues[0].editorSource.editorKey, 'body-field');
    assert.equal(requests.length, 2);
    assert.equal(requests[1].credentials, 'include');
    assert.equal(requests[1].redirect, 'error');
    assert.equal(requests[1].url, origin + '/assets/gov/form.pdf');
  }
});

test('CMS Lite editor updates a missing-size finding from a complete download', async () => {
  const { context, origin } = editorEnvironment((_url, options) => networkResponse(
    options.method === 'HEAD' ? null : new Uint8Array(311000)));
  const { report, asset } = editorFixture(context, origin + '/assets/gov/form.pdf', 'Form (PDF)');
  await context.verifyOneAsset(report, asset);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].suggestion, 'Add (PDF, 304KB) to the link text.');
});

test('Editor GET headers replace old HEAD headers for range totals and content type', async () => {
  for (const type of ['application/pdf', 'text/html']) {
    const { context, origin } = editorEnvironment((_url, options) => options.method === 'HEAD' ? networkResponse()
      : networkResponse(new Uint8Array(1), { status: 206, headers: {
        'content-type': type, 'content-length': '1', 'content-range': 'bytes 0-0/311000'
      } }));
    const { report, asset } = editorFixture(context, origin + '/assets/gov/form.pdf');
    await context.verifyOneAsset(report, asset);
    assert.equal(asset.actualSize, type === 'text/html' ? null : 311000);
    assert.equal(report.issues.length, type === 'text/html' ? 0 : 1);
  }
});

test('Compressed editor responses use decoded file bytes', async () => {
  const { context, origin } = editorEnvironment((_url, options) => networkResponse(
    options.method === 'HEAD' ? null : new Uint8Array(311000),
    { headers: { 'content-encoding': 'gzip', 'content-length': '90000' } }));
  const { report, asset } = editorFixture(context, origin + '/assets/gov/form.pdf');
  await context.verifyOneAsset(report, asset);
  assert.equal(asset.actualSize, 311000);
  assert.equal(report.issues[0].suggestion, 'Change 532KB to 304KB.');
});

test('Editor failures and incomplete downloads preserve an existing size silently', async () => {
  for (const kind of ['html', 'denied', 'partial', 'oversize', 'interrupted', 'redirect']) {
    const { context, origin } = editorEnvironment((_url, options) => {
      if (options.method === 'HEAD') return networkResponse();
      if (kind === 'redirect') throw new TypeError('Redirect disallowed');
      if (kind === 'interrupted') return networkResponse(new ReadableStream({
        start(c) { c.error(new Error('Connection lost')); }
      }));
      if (kind === 'oversize') return networkResponse(new Uint8Array(5 * 1024 ** 2 + 1));
      return networkResponse(new Uint8Array(100), {
        status: kind === 'denied' ? 403 : kind === 'partial' ? 206 : 200,
        headers: kind === 'html' ? { 'content-type': 'text/html' } : {}
      });
    });
    const { report, asset } = editorFixture(context, origin + '/assets/gov/form.pdf');
    await context.verifyOneAsset(report, asset);
    assert.equal(asset.actualSize, null, kind);
    assert.equal(report.issues.length, 0, kind);
  }
});

test('Editor fallback stays within the editor origin and known asset paths', async () => {
  const { context, requests, origin } = editorEnvironment(() => { throw new Error('Unexpected request'); });
  const { report } = editorFixture(context, origin + '/assets/gov/form.pdf');
  for (const url of ['https://www2.gov.bc.ca/assets/gov/form.pdf', origin + '/editor/delete',
    origin + '/assets/other/form.pdf']) {
    const result = { status: 'ok', code: 200, finalUrl: url, headers: { contentType: 'application/pdf' } };
    const checked = await context.measureEditorAssetSize(report, result);
    assert.equal(checked, result);
  }
  assert.equal(requests.length, 0);
});

test('Editor fallback timeout stops a stalled stream', async () => {
  let aborted = false;
  const { context, origin } = editorEnvironment((_url, options) => networkResponse(new ReadableStream({
    start(c) { options.signal.addEventListener('abort', () => { aborted = true; c.error(new Error('Aborted')); }); }
  })));
  const { report } = editorFixture(context, origin + '/assets/gov/form.pdf');
  const result = { status: 'ok', code: 200, finalUrl: origin + '/assets/gov/form.pdf', headers: { contentType: 'application/pdf' } };
  const checked = await context.measureEditorAssetSize(report, result, 20);
  assert.equal(aborted, true);
  assert.equal(context.verifiedAssetSize(checked), null);
});

test('Combined correction shows a clear title and two escaped numbered actions', async () => {
  const { context } = environment(response(183657));
  const { report, asset } = outsideFixture(context, '(PDF, 299KB)');
  await context.verifyOneAsset(report, asset);
  assert.equal(report.issues[0].title, 'Correct the size and move the file details');
  assert.deepEqual(Array.from(report.issues[0].suggestionSteps), [
    'Change 299KB to 179KB.', 'Move (PDF, 179KB) into the link text.'
  ]);
  Object.assign(context, {
    state: { activeReport: { settings: { profile: 'cms-lite', scope: 'content' } } },
    effectiveStatus: () => 'open', auditNote: () => ({}), feedbackNotesForFinding: () => [],
    escapeHtml: value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    sentenceLabel: value => value, renderedContrastDetails: () => '',
    renderedEvidence: finding => finding.evidence, editorDataAttributes: () => '', workspaceSurface: false
  });
  vm.runInContext(shippedFunction('renderFinding'), context);
  const html = context.renderFinding(report.issues[0]);
  assert.match(html, /<ol><li>Change 299KB to 179KB\.<\/li><li>Move \(PDF, 179KB\) into the link text\.<\/li><\/ol>/);
  report.issues[0].suggestionSteps = ['<img src=x onerror=alert(1)>'];
  assert.match(context.renderFinding(report.issues[0]), /&lt;img/);
});

test('Screenshot case: 832734 measured bytes recommend 813KB', async () => {
  const { context } = environment(response(832734));
  const { report, asset } = fixture(context, 'Adult Application for Change of Name (PDF, 963KB)');
  await context.verifyOneAsset(report, asset);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].suggestion, 'Change 963KB to 813KB.');
  assert.equal(context.displayBytes(asset.actualSize), '813KB');
  const corrected = fixture(context, 'Adult Application for Change of Name (PDF, 813KB)');
  await context.verifyOneAsset(corrected.report, corrected.asset);
  assert.equal(corrected.report.issues.length, 0);
});

test('KB suggestions round to the nearest whole KB on both sides of the midpoint', () => {
  const { context } = environment(null);
  for (const [bytes, label] of [[812 * 1024 + 511, '812KB'], [812 * 1024 + 512, '813KB'],
    [813 * 1024 + 511, '813KB'], [813 * 1024 + 512, '814KB']]) {
    assert.equal(context.displayBytes(bytes), label);
  }
});
