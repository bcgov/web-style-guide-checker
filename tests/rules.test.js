"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

async function scan(page, body, options = {}, language = "en-CA") {
  await page.setContent(`<html lang="${language}"><head><meta name="description" content="Test page"></head><body><main><h1>Rule test page</h1>${body}</main></body></html>`);
  await page.addScriptTag({ path: path.join(__dirname, "..", "checker-core.js") });
  return page.evaluate(scanOptions => globalThis.BCWebStyleGuideChecker.scanPage(document, {
    scope: "content",
    profile: "standard",
    canControlColour: false,
    ...scanOptions
  }), options);
}

function has(report, ruleId) {
  return report.issues.some(issue => issue.ruleId === ruleId);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let report = await scan(page, "<p>The Government introduced a new service.</p>");
  assert.equal(has(report, "government-capitalization"), true);
  report = await scan(page, "<p>The Government of British Columbia introduced a new service.</p>");
  assert.equal(has(report, "government-capitalization"), false);
  report = await scan(page, "<p>Contact Government Communications and Public Engagement.</p>");
  assert.equal(has(report, "government-capitalization"), false);
  report = await scan(page, "<p>The office is at 501 Government Street.</p>");
  assert.equal(has(report, "government-capitalization"), false);

  report = await scan(page, "<p>Contact Dr. Jane Smith for advice.</p>");
  assert.equal(has(report, "academic-title"), true);
  report = await scan(page, "<p>Mail the form to 10 Cedar Dr., Victoria, B.C.</p>");
  assert.equal(has(report, "academic-title"), false);
  report = await scan(page, "<p>She has a Master of Science.</p>");
  assert.equal(has(report, "academic-degree-case"), true);

  report = await scan(page, "<h2>Housing benefits – How to apply</h2><p>Details.</p>");
  assert.equal(has(report, "heading-dash"), true);
  report = await scan(page, "<h2>Long-term planning</h2><p>Details.</p>");
  assert.equal(has(report, "heading-dash"), false);
  report = await scan(page, "<h2>Medical Services Plan (MSP)</h2><p>Details.</p>");
  assert.equal(has(report, "heading-parentheses"), false);
  report = await scan(page, "<h2>Application process (updated)</h2><p>Details.</p>");
  assert.equal(has(report, "heading-parentheses"), true);
  report = await scan(page, "<h2>Housing benefits: how to apply</h2><p>Details.</p>");
  assert.equal(has(report, "heading-colon-case"), true);

  report = await scan(page, '<img src="test.jpg" alt="Photo of a family outside their new home">');
  assert.equal(has(report, "image-alt-prefix"), true);
  report = await scan(page, '<img src="test.jpg" alt="A family stands outside their home after completing an application for housing assistance through the provincial program">');
  assert.equal(has(report, "image-alt-length"), true);

  report = await scan(page, "<p>PST applies to some purchases.</p>");
  assert.equal(has(report, "time-zone"), false);
  report = await scan(page, "<p>The meeting starts at 9:30 am PST.</p>");
  assert.equal(has(report, "time-zone"), true);
  report = await scan(page, "<p>The meeting starts at 9 am NT.</p>");
  assert.equal(has(report, "province-abbreviation"), false);
  report = await scan(page, "<p>People in NB can apply.</p>");
  assert.equal(has(report, "province-abbreviation"), true);

  report = await scan(page, "<p>The fee is $0.75.</p>");
  assert.equal(has(report, "currency-cents"), true);
  report = await scan(page, "<p>The fee is $75.00.</p>");
  assert.equal(has(report, "currency-trailing-zeros"), true);
  report = await scan(page, "<p>The grant is $15000.</p>");
  assert.equal(has(report, "currency-comma"), true);
  report = await scan(page, "<p>Funding ranges from $200-$400.</p>");
  assert.equal(has(report, "currency-range"), true);

  report = await scan(page, "<p>The route is 100kms long.</p>");
  assert.equal(has(report, "metric-plural"), true);
  assert.equal(has(report, "metric-spacing"), false);
  report = await scan(page, "<p>The speed limit is 30 km/h.</p>");
  assert.equal(has(report, "slash"), false);
  assert.equal(has(report, "metric-spacing"), false);
  report = await scan(page, "<p>Use a 5/32 inch fitting.</p>");
  assert.equal(has(report, "slash"), false);

  report = await scan(page, "<p>Students entering grade 6 attend the local school.</p>");
  assert.equal(has(report, "grade-capitalization"), true);
  report = await scan(page, "<p>Use grade 8 bolts for the installation.</p>");
  assert.equal(has(report, "grade-capitalization"), false);

  report = await scan(page, "<p>Contact your advisor about the request.</p>");
  assert.equal(has(report, "canadian-spelling"), true);
  report = await scan(page, "<p>Renew your driver license online.</p>");
  assert.equal(has(report, "canadian-spelling-context"), true);
  report = await scan(page, "<p>The ministry can license an operator.</p>");
  assert.equal(has(report, "canadian-spelling-context"), false);
  report = await scan(page, "<p>The medical practice is downtown.</p>");
  assert.equal(has(report, "canadian-spelling-context"), false);
  report = await scan(page, "<p>Contact the Department of Defense.</p>", {
    exceptions: [{ id: "defense-name", ruleId: "canadian-spelling", phrase: "Defense", domain: "" }]
  });
  assert.equal(report.issues.some(issue => issue.ruleId === "canadian-spelling" && issue.automaticStatus === "ignored"), true);

  report = await scan(page, "<p>The decision was made yesterday.</p>");
  assert.equal(has(report, "passive-voice"), true);
  report = await scan(page, "<p>The office is located downtown.</p>");
  assert.equal(has(report, "passive-voice"), false);
  report = await scan(page, "<p>We haven't received the form.</p>");
  assert.equal(has(report, "negative-contraction"), true);

  report = await scan(page, "<p>The event is on 2026-08-24.</p>");
  assert.equal(has(report, "numeric-date"), true);
  report = await scan(page, "<table><tr><th>Date</th></tr><tr><td>2026-08-24</td></tr></table>");
  assert.equal(has(report, "numeric-date"), false);
  report = await scan(page, "<p>The meeting begins at 9am.</p>");
  assert.equal(has(report, "time-format"), true);

  report = await scan(page, "<p>Choose the service that applies</p><ul><li>Apply online</li><li>Call the office</li></ul>");
  assert.equal(has(report, "list-introduction"), true);
  report = await scan(page, "<p>Choose a service:</p><ul><li>Apply online</li><li>Call the office</li></ul>");
  assert.equal(has(report, "list-introduction"), false);
  report = await scan(page, "<ul><li>Apply online. Keep a copy for your records</li></ul>");
  assert.equal(has(report, "list-multiple-sentences"), true);

  report = await scan(page, "<p>Therefore, applicants must provide documentation.</p>");
  assert.equal(has(report, "formal-sentence-starter"), true);
  report = await scan(page, "<p>Le gouvernement fournit des services. Therefore est un mot anglais.</p>", {}, "fr-CA");
  assert.equal(has(report, "formal-sentence-starter"), false);
  assert.equal(report.stats.readingGrade, null);

  await browser.close();
  console.log("Style-guide rule tests passed");
})().catch(error => {
  if (/Executable doesn't exist/i.test(String(error && error.message))) {
    console.log("Style-guide rule tests skipped: Playwright Chromium is not installed.");
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
