"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const api = require("../review-exclusions.js");
const root = path.join(__dirname, "..");
const locator = { selector: "#shared", tag: "ASIDE", role: "", landmark: "ASIDE:", stable: true, fingerprint: "" };
const saved = { id: "sidebar", name: "Shared sidebar", scope: "section", url: "https://example.ca/services/housing/", locator };
assert.deepEqual(api.sectionChoices("https://example.ca/services/housing/apply?lang=en#form"), ["https://example.ca/services/housing/", "https://example.ca/services/"]);
assert.deepEqual(api.sectionChoices("https://example.ca/services/housing/"), ["https://example.ca/services/housing/", "https://example.ca/services/"]);
assert.deepEqual(api.sectionChoices("https://example.ca/apply"), []);
for (const url of ["https://example.ca/services/housing", "https://example.ca/services/housing/apply?lang=fr"]) assert.equal(api.applies(saved, url), true);
for (const url of ["https://example.ca/services/housing-benefits/apply", "https://other.example.ca/services/housing/apply", "http://example.ca/services/housing/apply", "https://example.ca:8443/services/housing/apply", "https://example.ca/services/Housing/apply"]) assert.equal(api.applies(saved, url), false);
assert.equal(api.applies({ ...saved, scope: "page", url: "https://example.ca/apply?lang=en" }, "https://example.ca/apply?lang=en#form"), true);
assert.equal(api.applies({ ...saved, scope: "page", url: "https://example.ca/apply?lang=en" }, "https://example.ca/apply?lang=fr"), false);
assert.equal(api.normalizeRules([{ ...saved, scope: "site", locator: { ...locator, stable: false, fingerprint: "saved-content" } }]).length, 1, "Site scope permits conservative position-and-content matching");
assert.equal(api.normalizeRules([{ ...saved, locator: { ...locator, stable: false } }]).length, 0, "An unstable locator must include its content fingerprint");
assert.equal(api.normalizeRules([{ ...saved, scope: "page", locator: { ...locator, stable: false, fingerprint: "saved-content" } }]).length, 1);
assert.equal(api.normalizeRules([saved])[0].skipLinks, false, "Links are included by default, including for older exclusions");
assert.match(api.coverage({ settings: { exclusions: [{ name: "Old review", status: "applied", scope: "Website" }] } }), /link checks skipped/, "Historical reports keep their original coverage");
assert.match(api.coverage({ settings: { exclusions: [{ name: "New review", status: "applied", scope: "Website", skipLinks: false }] } }), /links included/);
assert.equal(api.normalizeRules([{ ...saved, url: "javascript:alert(1)" }]).length, 0);
assert.equal(api.normalizeRules([{ ...saved, url: "https://user:password@example.ca/" }]).length, 0);
assert.equal(api.normalizeRules([{ ...saved, locator: { ...locator, tag: "BODY" } }]).length, 0);
assert.equal(api.normalizeRules([saved, saved]).length, 1);
assert.equal(api.revision([saved], "https://other.ca/"), "");
assert.notEqual(api.revision([saved]), api.revision([{ ...saved, name: "Different name" }]));
assert.equal(api.revision([{ ...saved, enabled: false }], saved.url), "");
const siteRule = api.normalizeRules([{ ...saved, scope: "site" }])[0];
const pageRule = { ...siteRule, id: "new", scope: "page", url: "https://example.ca/services/apply" };
assert.equal(api.findDuplicate([siteRule], pageRule).id, siteRule.id, "A site exclusion already covers the same area on one page");
assert.equal(api.findDuplicate([{ ...siteRule, enabled: false }], pageRule).enabled, false, "An existing disabled area should be offered for editing");
assert.equal(api.findDuplicate([pageRule], { ...pageRule, id: "another" }).id, pageRule.id);
assert.equal(api.findDuplicate([siteRule], { ...pageRule, url: "https://other.ca/services/apply" }), null);
assert.equal(api.findDuplicate([pageRule], { ...pageRule, id: "another", url: pageRule.url + "?lang=fr" }), null);
assert.equal(api.findDuplicate([pageRule], siteRule), null, "A page-only exclusion does not prevent broadening another exclusion to the website");
assert.equal(api.findDuplicate([siteRule], { ...pageRule, locator: { ...locator, selector: "aside" } }, [siteRule.id]).id, siteRule.id, "Different selectors that resolve to the same element are duplicates");
assert.equal(api.findDuplicate([siteRule], { ...pageRule, id: siteRule.id }), null, "Editing the same rule is allowed");
assert.match(api.scopeLabel(pageRule), /^Page:/);
assert.match(api.coverage({ settings: { includeExcludedAreas: true } }), /included in this scan/);


let chromium;
try { ({ chromium } = require("playwright")); } catch (error) {
  if (process.env.REQUIRE_BROWSER_TESTS === "1") throw error;
  console.log("Exclusion address tests passed; browser tests skipped (Playwright unavailable).");
  process.exit(0);
}

(async () => {
  const server = http.createServer((req, res) => { res.setHeader("Content-Type", "text/html"); res.end("<!doctype html><html lang='en'><meta name='description' content='Test'><body></body></html>"); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1000, height: 850 } });
    await page.goto(origin + "/services/housing/apply?lang=en");
    async function fixture(body) {
      await page.setContent(`<html lang="en"><head><title>Application guide</title><meta name="description" content="Test"></head><body>${body}</body></html>`);
      await page.addScriptTag({ path: path.join(root, "review-exclusions.js") });
      await page.addScriptTag({ path: path.join(root, "checker-core.js") });
    }
    async function rule(selector, scope = "page", url = page.url()) {
      return page.evaluate(({ selector, scope, url }) => ({ id: selector, scope, url, ...BCReviewExclusions.describe(document.querySelector(selector)) }), { selector, scope, url });
    }
    async function scan(exclusions = [], options = {}) {
      return page.evaluate(({ exclusions, options }) => BCWebStyleGuideChecker.scanPage(document, { scope: "whole", profile: "standard", canControlColour: false, exclusions, ...options }), { exclusions, options });
    }
    const has = (report, id) => report.issues.some(item => item.ruleId === id);
    await fixture(`<main><h1>Application guide</h1><p>Apply for a home.</p><aside id="shared"><h2>SHARED NAVIGATION</h2><p>The Government manages these services.</p><a href="/shared">Shared link</a><img src="/image.png"><table><tr><td>Shared table</td></tr></table></aside><p><a href="/included">Included link</a></p></main>`);
    const sidebar = await rule("#shared", "section", origin + "/services/housing/");
    const duplicateIds = await page.evaluate(sidebar => BCReviewExclusions.matchingAreaIds(document, [sidebar], { ...sidebar.locator, selector: "aside" }, location.href), sidebar);
    assert.deepEqual(duplicateIds, [sidebar.id]);
    const before = await page.locator("body").innerHTML();
    const full = await scan();
    let report = await scan([sidebar]);
    assert.equal(report.settings.exclusions[0].status, "applied");
    assert.ok(report.stats.words < full.stats.words);
    assert.equal(report.stats.links, 2);
    assert.equal(report.stats.images, 0);
    assert.equal(report.pageDetails.links.length, 2);
    assert.equal(report.pageDetails.links.some(link => link.reviewExcluded && !link.excludedFromCheck), true);
    const skipLinksReport = await scan([{ ...sidebar, skipLinks: true }]);
    assert.equal(skipLinksReport.pageDetails.links.length, 2, "Skipping checks never removes links from the inventory");
    assert.equal(skipLinksReport.pageDetails.links.filter(link => link.excludedFromCheck).length, 1);
    assert.equal(report.pageDetails.images.length, 0);
    assert.equal(report.pageDetails.counts.tables, 0);
    assert.equal(report.pageDetails.headings.length, 1);
    assert.equal(report.issues.some(item => item.selector.startsWith("#shared")), false);
    assert.equal(has(report, "government-capitalization"), false);
    assert.equal(await page.locator("body").innerHTML(), before, "Scanning must leave the page intact");
    const previousFinding = full.issues.find(item => item.ruleId === "government-capitalization");
    const protectedReport = await scan([sidebar], { reviewStateCandidates: [{ fingerprint: previousFinding.fingerprint, selector: previousFinding.selector, savedAt: new Date().toISOString() }] });
    assert.equal(protectedReport.excludedReviewState[0].fingerprint, previousFinding.fingerprint, "Excluded findings with saved review data must retain their identity");
    assert.equal((await scan([], { reviewStateCandidates: protectedReport.excludedReviewState })).excludedReviewState.length, 0, "Restored findings return to the ordinary review-state lifecycle");
    assert.equal((await scan()).stats.words, full.stats.words, "A later scan without exclusions must restore full coverage");

    await fixture(`<main><h1>Application guide</h1><p id="mixed">Simple words. <span id="unowned">The Government ${"extraordinary administrative requirements ".repeat(30)}</span> Clear advice.</p></main>`);
    const nested = await rule("#unowned");
    report = await scan([nested]);
    await page.locator("#unowned").evaluate(element => element.remove());
    const removed = await scan();
    assert.equal(report.stats.words, removed.stats.words, "Excluded descendants must not leak into ancestor word counts");
    assert.equal(report.stats.readingWords, removed.stats.readingWords);
    assert.equal(report.stats.readingGrade, removed.stats.readingGrade);

    await fixture(`<main><h1>Application guide</h1><h2>One</h2><p id="shared">Shared information.</p><h2>Two</h2><p id="other-shared">More shared information.</p><h2>Three</h2><p>Included information.</p></main>`);
    report = await scan([await rule("#shared"), await rule("#other-shared")]);
    assert.equal(has(report, "heading-empty-sequence"), false, "Excluded real paragraphs still separate headings");

    await fixture(`<main><header id="shared"><h1>Application guide</h1><h2>Context</h2></header><h3>Details</h3><p>Apply online.</p></main>`);
    report = await scan([await rule("#shared")]);
    assert.equal(has(report, "h1-count"), false, "Excluding an H1 must not invent a missing H1");
    assert.equal(has(report, "heading-skip"), false, "Excluded headings must remain structural context");
    assert.equal(report.settings.structuralContext, true);
    assert.equal(report.pageDetails.headings.some(heading => heading.flags.some(flag => flag.startsWith("Skipped"))), false, "The page details outline must also preserve heading context");

    await fixture(`<main><h1>Application guide</h1><nav id="contents"><h2>On this page</h2><ul id="contents-links"><li><a href="#access">Access</a></li><li><a href="#two">Two</a></li><li><a href="#three">Three</a></li></ul></nav><section id="shared"><h2 id="access">Access</h2><p>Shared access.</p></section><h2 id="two">Two</h2><p>Second.</p><h2 id="three">Three</h2><p>Third.</p><p><a href="#access">Go to access</a> <a href="#absent">Missing destination</a></p></main>`);
    report = await scan([await rule("#shared")]);
    assert.equal(has(report, "on-this-page-links"), false, "A real excluded heading remains a valid destination");
    const missing = report.issues.filter(item => item.ruleId === "broken-anchor");
    assert.equal(missing.some(item => item.evidence.includes("#access")), false);
    assert.ok(report.issues.some(item => /#absent/.test(item.evidence)), "A genuinely absent anchor must still be reported");
    report = await scan([await rule("#contents-links")]);
    assert.equal(has(report, "on-this-page-links"), false, "Excluded real links still satisfy navigation relationships");
    report = await scan([await rule("#contents")]);
    assert.equal(has(report, "on-this-page-missing"), false, "Excluding On this page must not invent missing navigation");

    await fixture(`<main><h1>Application guide</h1><aside id="shared"><p><a href="#absent">Missing anchor</a> <a href="#">Empty anchor</a></p></aside><p>Included text.</p></main>`);
    const anchorArea = await rule("#shared", "site", origin + "/");
    report = await scan([anchorArea]);
    assert.equal(has(report, "broken-anchor"), true, "Anchor checks include excluded areas by default");
    assert.equal(has(report, "empty-fragment-link"), true);
    report = await scan([{ ...anchorArea, skipLinks: true }]);
    assert.equal(has(report, "broken-anchor"), false);
    assert.equal(has(report, "empty-fragment-link"), false);

    await fixture(`<main><h1>Application guide</h1><aside id="shared"><p>The Government provides services.</p></aside></main>`);
    const savedArea = await rule("#shared");
    await page.locator("main").evaluate(element => element.insertAdjacentHTML("beforeend", '<aside id="shared"><p>The Government provides more services.</p></aside>'));
    report = await scan([savedArea]);
    assert.equal(report.settings.exclusions[0].status, "ambiguous");
    assert.equal(has(report, "government-capitalization"), true);
    await fixture(`<main><h1>Application guide</h1><section id="shared"><p>The Government provides services.</p></section></main>`);
    report = await scan([savedArea]);
    assert.equal(report.settings.exclusions[0].status, "changed");
    assert.equal(has(report, "government-capitalization"), true);
    await page.locator("#shared").evaluate(element => element.remove());
    assert.equal((await scan([savedArea])).settings.exclusions[0].status, "missing");

    await fixture(`<aside id="outside"><p>Shared navigation.</p></aside><main><h1>Application guide</h1><p>Apply online.</p></main>`);
    assert.equal((await scan([await rule("#outside")], { scope: "content" })).settings.exclusions[0].status, "outside-scope");
    await fixture(`<main><h1>Application guide</h1><div><p>The Government provides services.</p></div></main>`);
    const positional = await rule("main > div > p");
    assert.equal(positional.locator.stable, false);
    assert.equal((await scan([positional])).issues.some(item => item.ruleId === "government-capitalization"), false);
    const positionalSite = { ...positional, scope: "site", url: origin + "/" };
    await page.goto(origin + "/other-page");
    await fixture(`<main><h1>Application guide</h1><div><p>The Government provides services.</p></div></main>`);
    assert.equal((await scan([positionalSite])).settings.exclusions[0].status, "applied", "Unchanged shared areas can be excluded across pages without a stable ID");
    await page.locator("main > div > p").evaluate(element => { element.textContent = "The Government changed this paragraph."; });
    assert.equal((await scan([positionalSite])).settings.exclusions[0].status, "changed");

    await fixture(`<main id="all"><h1>Application guide</h1><p>Apply online.</p></main>`);
    report = await scan([await rule("#all")], { scope: "content" });
    assert.equal(report.settings.emptyReviewScope, true);
    await fixture(`<main><h1 id="title">Application guide</h1>Direct text without a paragraph.</main>`);
    assert.equal((await scan([await rule("#title")])).settings.emptyReviewScope, false);

    // Real pointer, keyboard and font loading, even on a page that disallows remote fonts.
    await fixture(`<meta http-equiv="Content-Security-Policy" content="font-src 'none'"><style>body{font-family:'Times New Roman'!important}</style><main><h1>Application guide</h1><aside id="shared"><a id="target" href="#clicked">Shared link</a><p>Shared information.</p></aside></main>`);
    await page.addScriptTag({ path: path.join(root, "exclusion-picker.js") });
    const fonts = { "400": Array.from(fs.readFileSync(path.join(root, "fonts/BCSans-Regular.woff2"))), "700": Array.from(fs.readFileSync(path.join(root, "fonts/BCSans-Bold.woff2"))) };
    await page.evaluate(fonts => {
      globalThis.pickerOptions = { fonts };
      globalThis.clicked = 0;
      document.querySelector("#target").addEventListener("click", event => { event.preventDefault(); globalThis.clicked += 1; });
      globalThis.selectionPromise = BCExclusionPicker.pick(pickerOptions);
    }, fonts);
    const host = page.locator("[data-bc-wsg-exclusion-ui]");
    await host.waitFor();
    assert.match(await host.locator(".tools").evaluate(element => getComputedStyle(element).fontFamily), /BC Sans Checker/);
    assert.equal(await page.evaluate(() => Array.from(document.fonts).filter(font => font.family === "BC Sans Checker" && font.status === "loaded").length), 2);
    assert.equal(await host.getByText("Choose from a list", { exact: true }).count(), 0);
    const oldPosition = await host.locator(".tools").boundingBox();
    await host.getByRole("button", { name: /^Move controls/ }).click();
    const newPosition = await host.locator(".tools").boundingBox();
    assert.ok(newPosition.x < oldPosition.x, "The controls can move away from a covered area");
    await host.getByRole("button", { name: /^Move controls/ }).focus();
    await page.keyboard.press("ArrowRight");
    assert.ok((await host.locator(".tools").boundingBox()).x > newPosition.x);
    const moveButton = await host.getByRole("button", { name: /^Move controls/ }).boundingBox();
    const beforeDrag = await host.locator(".tools").boundingBox();
    await page.mouse.move(moveButton.x + moveButton.width / 2, moveButton.y + moveButton.height / 2);
    await page.mouse.down();
    await page.mouse.move(moveButton.x + moveButton.width / 2 + 100, moveButton.y + moveButton.height / 2 + 60);
    await page.mouse.up();
    assert.ok((await host.locator(".tools").boundingBox()).x > beforeDrag.x + 50, "The picker can be dragged");
    await host.getByRole("button", { name: /^Move controls/ }).click();
    await page.locator("#target").click();
    assert.equal(await page.evaluate(() => clicked), 0);
    assert.equal(await host.locator(".identity").innerText(), "aside#shared", "Selection starts at a meaningful content group");
    await host.getByRole("button", { name: "Select a smaller area" }).click();
    assert.equal(await host.locator(".identity").innerText(), "a#target", "The exact pointed element remains available");
    await host.getByRole("button", { name: "Reselect area", exact: true }).click();
    assert.equal(await host.getByRole("button", { name: "Use selected area" }).isDisabled(), true);
    await page.locator("#target").click();
    assert.equal(await host.locator(".identity").innerText(), "aside#shared");
    const controlsBox = await host.locator(".tools").boundingBox();
    assert.ok(controlsBox.y + controlsBox.height <= 850, "Changing the selection keeps the entire picker in view");
    await host.getByRole("button", { name: "Use selected area" }).click();
    const picked = await page.evaluate(() => selectionPromise);
    assert.equal(picked.locator.selector, "#shared");
    assert.equal(await host.count(), 0);
    assert.equal(await page.evaluate(() => Array.from(document.fonts).filter(font => font.family === "BC Sans Checker").length), 0, "Temporary fonts are cleaned up");
    await page.locator("#target").click();
    assert.equal(await page.evaluate(() => clicked), 1, "Page interaction must be restored after picking");
    await page.evaluate(() => { globalThis.selectionPromise = BCExclusionPicker.pick(pickerOptions); });
    await host.waitFor();
    await host.locator(".selection").focus();
    for (let index = 0; index < 8 && !(await host.locator(".identity").innerText()).includes("aside#shared"); index += 1) await page.keyboard.press("ArrowDown");
    assert.equal(await host.locator(".identity").innerText(), "aside#shared");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    assert.equal((await page.evaluate(() => selectionPromise)).locator.selector, "#shared");
    await page.evaluate(() => { globalThis.selectionPromise = BCExclusionPicker.pick(pickerOptions); });
    await host.waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => selectionPromise), null);
    assert.equal(await host.count(), 0);
    await fixture('<main><h1>Application guide</h1><div id="wrapper"><p id="pointed">First paragraph.</p><p>Second paragraph.</p></div><p id="standalone">An individual paragraph.</p></main>');
    await page.addScriptTag({ path: path.join(root, "exclusion-picker.js") });
    await page.evaluate(() => { globalThis.selectionPromise = BCExclusionPicker.pick(); });
    await host.waitFor();
    await page.locator("#pointed").click();
    assert.equal(await host.locator(".identity").innerText(), "div#wrapper");
    await host.getByRole("button", { name: "Reselect area", exact: true }).click();
    await page.locator("#standalone").click();
    assert.equal(await host.locator(".identity").innerText(), "p#standalone", "Do not jump from a standalone paragraph to the entire main content");
    await page.keyboard.press("Escape");
    console.log("Review exclusions tests passed (address scopes, scan coverage, structural context, matching and accessible picker).");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
