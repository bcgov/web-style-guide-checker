"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "checker-core.js"), "utf8");
const catalogue = JSON.parse(fs.readFileSync(path.join(root, "data", "indigenous-name-catalogue.json"), "utf8"));
const compiler = require("../scripts/sync-indigenous-names.js");
require("../checker-core.js");
const h = globalThis.BCWebStyleGuideChecker.helpers;
const approved = catalogue.records.flatMap(record => record.forms.filter(form => form.recognize).map(form => ({ record, ...form })));
const names = Array.from(new Set(approved.map(form => form.text)));
const legacy = JSON.parse(source.match(/const LEGACY_INDIGENOUS_NAMES = (\[[\s\S]*?\n\s*\]);/)[1]);
assert.equal(compiler.sync(true), compiler.generatedNames(catalogue).length);
assert.match(catalogue.source.sha256, /^[a-f0-9]{64}$/);
const ids = new Set(catalogue.records.map(record => record.id));
assert.equal(ids.size, catalogue.records.length);
const fullMatch = (api, text) => api.indigenousNameRanges(text).some(range => range.start === 0 && range.end === text.length);
for (const name of legacy) assert.ok(fullMatch(h, name), `Preserve existing recognition: ${name}`);
for (const form of approved) {
  assert.equal(form.record.verificationBasis, "Official page read");
  assert.ok(form.record.evidenceUrls.length);
  assert.ok(fullMatch(h, form.text), `${form.record.id}: ${form.text}`);
  assert.ok(fullMatch(h, form.text.normalize("NFD")), `Canonical combining marks: ${form.text}`);
  const sentence = form.text.endsWith(".") ? form.text : form.text + ".";
  assert.equal(h.sentences(sentence + " Apply online.").length, 2, `Real sentence boundary after ${form.text}`);
}
for (const record of catalogue.records.filter(record => record.verificationBasis !== "Official page read")) {
  assert.equal(record.forms.some(form => form.recognize), false, `${record.id}: held evidence must not create a new exception`);
}
// Compare the same implementation without the new snapshot: recognition alone
// must not change word counting or withhold more English readability estimates.
const begin = source.indexOf("  // BEGIN GENERATED INDIGENOUS NAME CATALOGUE");
const endMarker = "  // END GENERATED INDIGENOUS NAME CATALOGUE";
const end = source.indexOf(endMarker, begin) + endMarker.length;
const legacyContext = {};
vm.runInNewContext(source.slice(0, begin) + "  const REVIEWED_INDIGENOUS_NAMES = [];\n" + source.slice(end), legacyContext);
const previous = legacyContext.BCWebStyleGuideChecker.helpers;
for (const name of names) {
  assert.deepEqual(Array.from(h.words(name)), Array.from(previous.words(name)), `Word-count stability: ${name}`);
  const text = `People can find a service and read the information. We explain how to apply. ${name} shares more information.`;
  assert.equal(h.canEstimateEnglishReadability(text), previous.canEstimateEnglishReadability(text), `Reading-model eligibility: ${name}`);
}
for (const text of ["TNG", "SCC", "LTC", "KCFN", "TTML", "SteS", "NStQ", "Stone", "Stoney", "3 Nations", "3Nations"]) {
  assert.equal(fullMatch(h, text), fullMatch(previous, text), `No new global short-form exception: ${text}`);
}
const government = "Gitlax̱t’aamiks Village Government";
for (const ending of ["’s services", "-led projects", "-owned records", "-operated services", "-owned-and-operated services"]) {
  assert.ok(h.indigenousNameRanges(government + ending).some(range => range.start === 0 && range.end === government.length));
}
for (const text of [government + "al", government + "-example", "X" + government, "invented'" + government]) {
  assert.equal(h.indigenousNameRanges(text).length, 0, `Do not expand the name into ${text}`);
}
assert.ok(h.indigenousNameRanges("Saulteau First Nations’ services").some(range => range.end === "Saulteau First Nations".length));
assert.equal(h.indigenousNameRanges("100 Mile House-based services").length, 0);
assert.equal(h.imperialUnitOccurrences("100 Mile House-based services").length, 0);
assert.equal(h.endsStylePunctuation("Ts’elxwéyeqw Tribe Management Ltd."), false);
assert.equal(h.endsStylePunctuation("Ts’elxwéyeqw Tribe Management Ltd.."), true);
assert.equal(h.endsStylePunctuation("Ts’elxwéyeqw Tribe Management Ltd. Apply online."), true);

const validRecord = { id: "test", verificationBasis: "Official page read", evidenceUrls: ["https://example.ca/"], forms: [{ text: "Test (A+B) Nation", role: "observed-website-name", recognize: true }] };
const compile = record => compiler.generatedNames({ schemaVersion: 1, records: [record] });
assert.equal(compile(validRecord)[0], "Test (A+B) Nation");
assert.throws(() => compile({ ...validRecord, verificationBasis: "Own-site name unverified" }), /Unreviewed/);
assert.throws(() => compile({ ...validRecord, evidenceUrls: ["javascript:alert(1)"] }), /Missing naming evidence/);
assert.throws(() => compile({ ...validRecord, forms: [{ ...validRecord.forms[0], text: "Unsafe\nName" }] }), /Invalid literal/);
assert.throws(() => compile({ ...validRecord, forms: [{ ...validRecord.forms[0], role: "acronym" }] }), /Unscoped short form/);
// Research commentary and entity interpretations do not belong in the code
// catalogue. Keep the accepted maintenance fields explicit.
for (const field of ["sourceNotes", "reportedOtherForms", "reportedHistoricalOrLegalContext", "workbookEntityType", "recordScope", "notes"]) {
  assert.throws(() => compile({ ...validRecord, [field]: "Research commentary" }), /Only name-recognition metadata/);
}
assert.throws(() => compile({ ...validRecord, forms: [{ ...validRecord.forms[0], notes: "Research commentary" }] }), /Unsupported name-form metadata/);
assert.throws(() => compile({ ...validRecord, holdReason: "Research commentary" }), /Unknown record hold reason/);
assert.throws(() => compile({ ...validRecord, forms: [{ ...validRecord.forms[0], reason: "Research commentary" }] }), /Unknown name-form hold reason/);
assert.throws(() => compiler.generatedNames({ schemaVersion: 1, records: [validRecord, validRecord] }), /unique/);
const literalContext = {};
const literalBlock = compiler.generatedBlock({ schemaVersion: 1, records: [validRecord] });
vm.runInNewContext(source.slice(0, begin) + literalBlock + source.slice(end), literalContext);
assert.equal(fullMatch(literalContext.BCWebStyleGuideChecker.helpers, "Test (A+B) Nation"), true);
assert.equal(fullMatch(literalContext.BCWebStyleGuideChecker.helpers, "Test AAAAAAB Nation"), false, "Catalogue strings are literal, not regular expressions");
console.log(`Indigenous-name catalogue helpers passed (${approved.length} reviewed source forms, ${legacy.length} preserved legacy forms).`);

let chromium;
try { ({ chromium } = require("playwright")); }
catch (error) {
  if (process.env.REQUIRE_BROWSER_TESTS === "1") throw error;
  console.log("Indigenous-name catalogue browser tests skipped: Playwright unavailable.");
  process.exit(0);
}
const escape = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const protectedRules = new Set(["heading-title-case", "heading-punctuation", "page-title-punctuation", "heading-dash", "heading-parentheses", "heading-colon-case", "all-caps", "government-capitalization", "acronym-in-heading", "undefined-acronym", "acronym-definition-format", "list-lowercase", "list-punctuation", "list-multiple-sentences", "missing-space-after-punctuation", "slash"]);
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/*", route => route.fulfill({ contentType: "text/html", body: "<html lang='en'><body></body></html>" }));
    await page.goto("https://example.gov.bc.ca/name-test");
    async function fixture(html) {
      await page.setContent(`<html lang="en-CA"><head><title>Name catalogue test</title></head><body><main><h1>Name catalogue test</h1>${html}</main></body></html>`);
      if (!await page.evaluate(() => Boolean(globalThis.BCWebStyleGuideChecker))) await page.addScriptTag({ path: path.join(root, "checker-core.js") });
      if (!await page.evaluate(() => Boolean(globalThis.BCReviewExclusions))) await page.addScriptTag({ path: path.join(root, "review-exclusions.js") });
    }
    async function scan(profile, options = {}) {
      return page.evaluate(({ profile, options }) => BCWebStyleGuideChecker.scanPage(document, { scope: "content", profile, canControlColour: false, ...options }), { profile, options });
    }
    const count = (report, rule) => report.issues.filter(issue => issue.ruleId === rule).length;
    for (const profile of ["standard", "cms-lite"]) {
      for (let start = 0; start < names.length; start += 10) {
        const group = names.slice(start, start + 10);
        await fixture(group.map(name => `<section><h2>${escape(name)}</h2><p>${escape(name)}</p><ul><li>${escape(name)}</li></ul></section>`).join(""));
        const before = await page.locator("body").innerHTML();
        const report = await scan(profile);
        assert.deepEqual(report.issues.filter(issue => protectedRules.has(issue.ruleId)), [], `${profile}: ${group.join(" / ")}`);
        assert.equal(await page.locator("body").innerHTML(), before, "Recognition must not edit page text");
      }
      for (const [html, expected] of [
        ["<p>‘Namgis will utilize 15000 records while it’s available.</p>", 1],
        ["<p>‘Gitlax̱t’aamiks Village Government will utilize 15000 records.’</p>", 0],
        ["<p>'Gitlax̱t’aamiks Village Government will utilize 15000 records.'</p>", 0],
        ["<p>‘Gitlax̱t’aamiks Village Government’ will utilize 15000 records.</p>", 1]
      ]) {
        await fixture(html);
        const report = await scan(profile);
        assert.equal(count(report, "complex-phrase"), expected, `${profile}: name apostrophe versus quotation`);
        assert.equal(count(report, "number-comma"), expected, `${profile}: quantity outside/inside quotation`);
      }
      await fixture(`<h2>${government} Application Requirements</h2><p>${government}-led projects will utilize 15000 records. The provincial Government will review them.</p>`);
      let report = await scan(profile);
      assert.equal(count(report, "government-capitalization"), 1, "Generic Government remains reviewable outside the complete name");
      assert.equal(count(report, "complex-phrase"), 1);
      assert.equal(count(report, "number-comma"), 1);
      assert.equal(count(report, "heading-title-case"), 1, "English words outside the name remain reviewable");
      for (const issue of report.issues.filter(issue => ["government-capitalization", "number-comma", "complex-phrase"].includes(issue.ruleId))) {
        assert.equal(issue.evidence.slice(issue.evidenceMatchIndex, issue.evidenceMatchIndex + issue.matchText.length), issue.matchText);
      }
      await fixture(`<h2><span>Gitlax̱t’aamiks</span> Village <strong>Government</strong></h2><p>${escape("Tŝilhqot’in National Government".normalize("NFD"))} will utilize 15000 records.</p>`);
      report = await scan(profile);
      assert.equal(count(report, "government-capitalization"), 0, "Names remain complete across inline markup and canonical combining forms");
      for (const issue of report.issues.filter(issue => ["number-comma", "complex-phrase"].includes(issue.ruleId))) assert.equal(issue.evidence.slice(issue.evidenceMatchIndex, issue.evidenceMatchIndex + issue.matchText.length), issue.matchText);
      await fixture("<p>We placed a Stone near 3 Nations. SCC, LTC, TNG and KCFN are unrelated abbreviations here.</p>");
      report = await scan(profile);
      for (const acronym of ["SCC", "LTC", "TNG", "KCFN"]) assert.ok(report.issues.some(issue => issue.ruleId === "undefined-acronym" && issue.flaggedToken === acronym), acronym);
      await fixture("<p>Lillooet Tribal Council (LTC) shares information.</p><p>LTC shares services.</p>");
      assert.equal(count(await scan(profile), "undefined-acronym"), 0, "An actual acronym definition still works");
      await fixture(`<h2>${government}</h2><p><a href='/service'>Click here</a></p><img src='/test.png'><table><tr><td>Permit</td><td>Fee</td></tr></table>`);
      report = await scan(profile);
      for (const rule of ["generic-link", "image-alt-missing", "table-headers"]) assert.ok(count(report, rule) > 0, `${profile}: structural/accessibility checks remain active: ${rule}`);
      await fixture("<h2>100 Mile House-based services</h2><p>Drive 5 miles from 100 Mile House.</p>");
      assert.equal(count(await scan(profile), "imperial-unit"), 1, "Keep the place-name correction and genuine measurement");
      await fixture(`<h2>${government}</h2><p>Gitlax̱t’aamiks <span id='excluded'>excluded</span>Village Government</p>`);
      const exclusions = await page.evaluate(() => [{ id: "excluded", scope: "page", url: location.href, ...BCReviewExclusions.describe(document.querySelector("#excluded")) }]);
      assert.equal(count(await scan(profile, { exclusions }), "government-capitalization"), 1, "Name recognition must not bridge excluded content");
      await fixture(`<p lang='crk'>Example,with 15000 records.</p><p lang='en'>${government} will utilize 16000 records.</p>`);
      report = await scan(profile);
      assert.equal(count(report, "number-comma"), 1, "Retain local language boundaries and English overrides");
    }
    console.log(`Indigenous-name catalogue browser tests passed (${names.length} observed forms in both profiles, plus scoped controls).`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
