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
  AbortController,
  setTimeout,
  clearTimeout,
  Promise,
  console,
  globalThis: null,
  chrome: {
    permissions: {
      contains: async () => true
    }
  },
  fetch: async () => { throw new Error("fetch stub not installed"); }
};
context.globalThis = context;
context.BCWebStyleGuideChecker = {
  helpers: {
    canonicalUrl(value) {
      try { const url = new URL(value); url.hash = ""; return url.href; }
      catch (_) { return String(value || "").split("#")[0]; }
    }
  }
};

const helperChunk = sourceBetween("function canonicalUrl(value)", "async function requestPagePermission");
vm.runInNewContext(`${helperChunk}\nthis.networkHelpers = { canonicalUrl, hostnameFor, originPattern, qaProductionEquivalent, signInMayBeRequired, prepareRemoteLink, remoteLinksForReport, linkResultFromRemote, permissionOriginsForRemoteUrl };`, context);
const helpers = context.networkHelpers;

assert.equal(
  helpers.qaProductionEquivalent("https://www2.qa.gov.bc.ca/gov/content/example?x=1#part"),
  "https://www2.gov.bc.ca/gov/content/example?x=1#part"
);
assert.equal(helpers.qaProductionEquivalent("https://other.qa.gov.bc.ca/example"), "");
assert.equal(helpers.prepareRemoteLink({ rawHref: "#donate", href: "https://cmslite.gov.bc.ca/page#donate" }, "https://cmslite.gov.bc.ca/page"), null);
assert.equal(helpers.prepareRemoteLink({ rawHref: "mailto:name@gov.bc.ca", href: "mailto:name@gov.bc.ca" }, "https://www2.gov.bc.ca/page"), null);
assert.equal(helpers.prepareRemoteLink({ rawHref: "tel:+12505550123", href: "tel:+12505550123" }, "https://www2.gov.bc.ca/page"), null);
assert.equal(helpers.prepareRemoteLink({ rawHref: "/page#part", href: "https://www2.gov.bc.ca/page#part" }, "https://www2.gov.bc.ca/page"), null);
const qaLink = helpers.prepareRemoteLink({ rawHref: "/gov/content/test", href: "https://www2.qa.gov.bc.ca/gov/content/test" }, "https://www2.qa.gov.bc.ca/source");
assert.equal(qaLink.qaLive, true);
assert.equal(qaLink.checkUrl, "https://www2.gov.bc.ca/gov/content/test");
assert.equal(qaLink.signInRequired, false);
const cmsLink = helpers.prepareRemoteLink(
  { rawHref: "/page", href: "https://cmslite.gov.bc.ca/page" },
  "https://cmslite.gov.bc.ca/source"
);
assert.equal(cmsLink.cmsLiteEditorLink, true);
assert.equal(cmsLink.sessionAware, true);
assert.equal(cmsLink.signInRequired, false);
assert.deepEqual(Array.from(helpers.permissionOriginsForRemoteUrl("http://www.clicklaw.bc.ca/page")), ["http://www.clicklaw.bc.ca/*", "https://www.clicklaw.bc.ca/*", "https://clicklaw.bc.ca/*"]);
assert.deepEqual(Array.from(helpers.permissionOriginsForRemoteUrl("https://www.choa.bc.ca/")), ["https://www.choa.bc.ca/*", "https://choa.bc.ca/*"], "The initial permission prompt must include a common www-to-apex HTTPS redirect");

const deduped = helpers.remoteLinksForReport({
  page: { url: "https://www2.qa.gov.bc.ca/source" },
  pageDetails: { links: [
    { rawHref: "#local", href: "https://www2.qa.gov.bc.ca/source#local", text: "Local" },
    { rawHref: "/gov/content/test", href: "https://www2.qa.gov.bc.ca/gov/content/test", text: "First" },
    { rawHref: "/gov/content/test", href: "https://www2.qa.gov.bc.ca/gov/content/test", text: "Second" }
  ] }
});
assert.equal(deduped.length, 1, "A page link check must skip fragments and check a repeated destination only once");
assert.equal(deduped[0].occurrences, 2);
assert.equal(deduped[0].checkUrl, "https://www2.gov.bc.ca/gov/content/test");
assert.equal(helpers.linkResultFromRemote(deduped[0], { status: "broken", code: 404 }).status, "live-not-found");

const batchPlanSource = sourceBetween("function batchLinkPlan(records)", "function batchLinkPermissionOrigins");
vm.runInNewContext(`${batchPlanSource}\nthis.batchPlan = batchLinkPlan;`, context);
const plan = context.batchPlan([
  {
    status: "complete",
    report: {
      page: { url: "https://www2.qa.gov.bc.ca/source-one" },
      pageDetails: { links: [
        { rawHref: "/gov/content/shared", href: "https://www2.qa.gov.bc.ca/gov/content/shared" },
        { rawHref: "https://example.com/shared", href: "https://example.com/shared" }
      ] }
    }
  },
  {
    status: "complete",
    report: {
      page: { url: "https://www2.gov.bc.ca/source-two" },
      pageDetails: { links: [
        { rawHref: "https://www2.gov.bc.ca/gov/content/shared", href: "https://www2.gov.bc.ca/gov/content/shared" },
        { rawHref: "https://example.com/shared", href: "https://example.com/shared" }
      ] }
    }
  }
]);
assert.equal(
  plan.destinations.size,
  3,
  "Batch link checking must keep a QA/live publishing pair separate from an independently discovered live-only destination"
);
const plannedDestinations = Array.from(plan.destinations.values());

assert.equal(
  plannedDestinations.some(destination =>
    destination.qaFamily === "public" &&
    destination.qaLive === true &&
    destination.qaUrl === "https://www2.qa.gov.bc.ca/gov/content/shared" &&
    destination.liveUrl === "https://www2.gov.bc.ca/gov/content/shared"
  ),
  true,
  "The QA-page link must retain its QA/live publishing pair"
);

assert.equal(
  plannedDestinations.some(destination =>
    destination.href === "https://www2.gov.bc.ca/gov/content/shared" &&
    destination.qaLive === false
  ),
  true,
  "A separately discovered live-page link must remain a live-only destination"
);

assert.equal(
  plannedDestinations.filter(destination =>
    destination.href === "https://example.com/shared"
  ).length,
  1,
  "Ordinary duplicate destinations across batch pages must still be deduplicated"
);

const remoteChunk = sourceBetween("function isManualRedirect(response)", "async function verifyOneAsset");
vm.runInNewContext(`${remoteChunk}\nthis.remoteHelpers = { isManualRedirect, fetchRemoteFollowingRedirects, fetchRemoteOnce, checkRemoteUrl };`, context);
const remote = context.remoteHelpers;

function response(status, { type = "basic", url = "https://example.com/", headers = {}, redirected = false } = {}) {
  return {
    status,
    type,
    url,
    redirected,
    headers: { get: key => headers[String(key).toLowerCase()] || null },
    body: { cancel: async () => {} }
  };
}

(async () => {
  let calls = [];
  context.chrome.permissions.contains = async () => true;
  context.fetch = async (url, options) => {
    calls.push({ url, options });
    return response(200, { url });
  };
  let result = await remote.checkRemoteUrl("https://example.com/page");
  assert.equal(result.status, "ok");
  assert.equal(calls[0].options.method, "HEAD");
  assert.equal(calls[0].options.redirect, "follow");
  assert.equal(calls[0].options.credentials, "omit");

  calls = [];
  context.fetch = async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? response(405, { url }) : response(206, { url });
  };
  result = await remote.checkRemoteUrl("https://example.com/page");
  assert.equal(result.status, "ok");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.method, "GET");
  assert.equal(calls[1].options.headers.Range, "bytes=0-0");


  calls = [];
  context.fetch = async (url, options) => {
    calls.push({ url, options });
    return response(200, { url: "https://www2.gov.bc.ca/gov/content/governments/example", redirected: true });
  };
  result = await remote.checkRemoteUrl("https://www2.gov.bc.ca/gov/content?id=6C755E6BC175424FAB0185807314FB66");
  assert.equal(result.status, "ok");
  assert.equal(result.redirected, true);
  assert.equal(result.finalUrl, "https://www2.gov.bc.ca/gov/content/governments/example");
  assert.equal(calls[0].options.redirect, "follow", "Known www2.gov.bc.ca GUID links should follow their public same-site redirect");

  calls = [];
  context.chrome.permissions.contains = async ({ origins }) => String(origins[0]).startsWith("https://adminlawbc.ca/");
  context.fetch = async (url, options) => {
    calls.push({ url, options });
    return response(200, { url: "https://adminlawbc.ca/", redirected: true });
  };
  result = await remote.checkRemoteUrl("https://adminlawbc.ca/index.php/");
  assert.equal(result.status, "ok", "Same-origin path redirects should work with limited access to that origin");
  assert.equal(result.redirected, true);
  assert.equal(result.finalUrl, "https://adminlawbc.ca/");

  calls = [];
  context.chrome.permissions.contains = async ({ origins }) => String(origins[0]).startsWith("https://www.accessprobono.ca/");
  context.fetch = async (url, options) => {
    calls.push({ url, options });
    return response(200, { url: "https://www.accessprobono.ca/our-programs/legal-referral-service", redirected: true });
  };
  result = await remote.checkRemoteUrl("https://www.accessprobono.ca/our-programs/lawyer-referral-service");
  assert.equal(result.status, "ok");
  assert.equal(result.finalUrl, "https://www.accessprobono.ca/our-programs/legal-referral-service");

  calls = [];
  context.chrome.permissions.contains = async () => true;
  context.fetch = async (url, options) => {
    calls.push({ url, options });
    return response(200, { url: "https://other.example/final", redirected: true });
  };
  result = await remote.checkRemoteUrl("https://example.com/start");
  assert.equal(result.status, "ok", "Cross-origin redirects should be verified when the final origin is permitted");
  assert.equal(result.finalUrl, "https://other.example/final");

  calls = [];
  context.chrome.permissions.contains = async ({ origins }) => String(origins[0]).startsWith("https://example.com/");
  context.fetch = async (url, options) => {
    calls.push({ url, options });
    if (options.redirect === "follow") throw new TypeError("Redirect target is outside host permissions");
    return response(0, { type: "opaqueredirect", url });
  };
  result = await remote.checkRemoteUrl("https://example.com/page");
  assert.equal(result.status, "redirect");
  assert.equal(
  result.error,
  "This link redirects, but the final page could not be checked. Open it to confirm."
  );
  assert.equal(
  calls.length,
  3,
  "An inaccessible public redirect should try HEAD, then a bounded GET, before falling back to a manual redirect check"
);

assert.equal(calls[0].options.method, "HEAD");
assert.equal(calls[0].options.redirect, "follow");
assert.equal(calls[0].options.credentials, "omit");

assert.equal(calls[1].options.method, "GET");
assert.equal(calls[1].options.redirect, "follow");
assert.equal(calls[1].options.credentials, "omit");
assert.equal(calls[1].options.headers.Range, "bytes=0-0");

assert.equal(calls[2].options.method, "HEAD");
assert.equal(calls[2].options.redirect, "manual");
assert.equal(calls[2].options.credentials, "omit");

  context.chrome.permissions.contains = async ({ origins }) => !String(origins[0]).includes("blocked.example");
  result = await remote.checkRemoteUrl("https://blocked.example/page");
  assert.equal(result.status, "permission");

  result = await remote.checkRemoteUrl("https://cmslite.gov.bc.ca/page");
  assert.equal(result.status, "sign-in");

  console.log("Network helper tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
