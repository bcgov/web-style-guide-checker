"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
let chromium;
try { ({ chromium } = require("playwright")); }
catch (error) {
  if (process.env.REQUIRE_BROWSER_TESTS === "1") throw error;
  console.log("Page update date tests skipped: Playwright package is not installed.");
  process.exit(0);
}

const ruleId = "page-update-age";
const overdueRuleId = "page-update-overdue";
const corePath = path.join(__dirname, "..", "checker-core.js");
const oldLabel = "Last updated on April 25, 2023";
const body = '<div class="topicContent__main"><h2 id="details">Details</h2><p>Read the form before applying.</p></div>';
// Structure from the published Form F page: the generated date and nested H1
// precede the authored body, and the date includes an empty-alt decorative icon.
const cmsPage = label => `<main><div class="pageTitle__container"><div class="pageTitle__content"><div class="pageTitle__title"><h1>Form F: the Certificate of Payment</h1></div></div></div><span class="last_Updated_Text"><img alt=""> <!-- -->${label}</span>${body}</main>`;
const cmsOptions = { profile: "cms-lite", pageUrlOverride: "https://www2.gov.bc.ca/gov/content/form-f" };

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ timezoneId: "America/Vancouver" });
    await page.clock.setFixedTime(new Date("2026-09-15T19:00:00Z"));
    async function scan(html, options = {}) {
      await page.setContent(`<html lang="en-CA"><head><title>Date test</title><meta name="description" content="Date test"></head><body>${html}</body></html>`);
      await page.addScriptTag({ path: corePath });
      return page.evaluate(settings => globalThis.BCWebStyleGuideChecker.scanPage(document, {
        profile: "standard", scope: "content", canControlColour: false, ...settings
      }), options);
    }
    function findings(report) { return report.issues.filter(issue => issue.ruleId === ruleId || issue.ruleId === overdueRuleId); }

    for (const scope of ["content", "whole"]) {
      const report = await scan(cmsPage(oldLabel), { ...cmsOptions, scope });
      assert.equal(findings(report).length, 1, `${scope}: one finding for the CMS Lite page date`);
      const finding = findings(report)[0];
      assert.equal(finding.severity, "fix");
      assert.equal(finding.ruleId, overdueRuleId);
      assert.equal(finding.category, "Page information");
      assert.equal(finding.responsibility, "Content");
      assert.equal(finding.evidence, oldLabel);
      assert.equal(finding.matchText, "April 25, 2023");
      assert.equal(finding.location, "Page update date");
      assert.equal(finding.occurrenceCount, 1);
      assert.equal((await page.locator(finding.selector).innerText()).trim(), oldLabel);
      assert.equal(await page.locator(finding.selector).isVisible(), true);
      assert.ok(Number.isFinite(finding.pageOrder) && finding.pageOrder < Number.MAX_SAFE_INTEGER);
    }

    for (const [label, severity] of [
      ["Last updated on September 14, 2025", "review"],
      ["Last updated on September 15, 2024", "review"],
      ["Last updated on September 16, 2023", "review"],
      ["Last updated on September 15, 2023", "review"],
      ["Last updated on September 14, 2023", "fix"],
      ["Last updated: 2023-09-14", "fix"],
      ["Last updated on September 15, 2022", "fix"]
    ]) {
      const result = findings(await scan(cmsPage(label), cmsOptions));
      assert.equal(result.length, 1, `${label}: exactly one finding`);
      assert.equal(result[0].severity, severity, label);
      assert.equal(result[0].ruleId, severity === "fix" ? overdueRuleId : ruleId, label);
    }

    for (const [label, expected] of [
      ["Last updated on September 14, 2025", 1],
      ["Last updated on September 15, 2025", 0],
      ["Last updated on September 16, 2025", 0],
      ["Last updated on September 15, 2026", 0],
      ["Last updated on September 15, 2027", 0],
      ["Last updated: 2025-09-14", 1],
      ["Last updated September 15, 2025", 0],
      ["Last updated on February 29, 2023", 0],
      ["Last updated on April 31, 2023", 0],
      ["Last updated on April 00, 2023", 0],
      ["Last updated: 2023-13-01", 0],
      ["Last updated: 2023-02-30", 0],
      ["Last updated: 04/05/2023", 0],
      ["Last updated yesterday", 0],
      ["Last updated on April 25", 0],
      ["Last updated on April 25, 2023; next review April 25, 2024", 0],
      ["Published on April 25, 2023", 0],
      ["", 0]
    ]) {
      assert.equal(findings(await scan(cmsPage(label), cmsOptions)).length, expected, label || "Empty date");
    }

    for (const host of ["www2.qa.gov.bc.ca", "intranet.gov.bc.ca", "intranet.qa.gov.bc.ca"]) {
      assert.equal(findings(await scan(cmsPage(oldLabel), { profile: "auto", pageUrlOverride: `https://${host}/page` })).length, 1, host);
    }
    assert.equal(findings(await scan(cmsPage(oldLabel), { ...cmsOptions, contentRootSelector: ".topicContent__main" })).length, 1, "Explicit body-only scans still read the page date");
    assert.equal(findings(await scan(cmsPage(oldLabel), { ...cmsOptions, sectionSelector: "#details" })).length, 0, "Section-only scans skip page age");
    assert.equal(findings(await scan(cmsPage(oldLabel), { ...cmsOptions, editorRegion: 1 })).length, 0, "Editor fields skip page age");
    assert.equal(findings(await scan(cmsPage(oldLabel), { profile: "auto", pageUrlOverride: "https://cmslite.gov.bc.ca/cmslite/content/123" })).length, 0, "CMS interface timestamps are skipped");

    for (const html of [
      `<main><h1>Page</h1><p>${oldLabel}</p>${body}</main>`,
      `<header><h1>Page</h1><p>${oldLabel}</p></header><main>${body}</main>`,
      `<main><div><h1>Page</h1></div><div><span>Last updated:</span> <time datetime="2023-04-25">April 25, 2023</time></div>${body}</main>`,
      `<main><h1>Page</h1><p>Last\u00a0updated on April 25, 2023.</p>${body}</main>`,
      `<main><h1>Page</h1><span class="last_Updated_Text">${oldLabel}</span><span class="last_Updated_Text">${oldLabel}</span>${body}</main>`
    ]) {
      assert.equal(findings(await scan(html)).length, 1, "A clearly labelled page date is supported on other sites");
    }

    for (const [name, html] of [
      ["No date", `<main><h1>Page</h1>${body}</main>`],
      ["Hidden date", `<main><h1>Page</h1><span hidden class="last_Updated_Text">${oldLabel}</span>${body}</main>`],
      ["CSS-hidden ancestor", `<main><h1>Page</h1><div style="display:none"><span class="last_Updated_Text">${oldLabel}</span></div>${body}</main>`],
      ["Date only in metadata", `<meta name="dateModified" content="2023-04-25"><main><h1>Page</h1>${body}</main>`],
      ["Unlabelled date", `<main><h1>Page</h1><time datetime="2023-04-25">April 25, 2023</time>${body}</main>`],
      ["Quoted date", `<main><h1>Page</h1><blockquote>${oldLabel}</blockquote>${body}</main>`],
      ["Date in prose", `<main><h1>Page</h1><p>The form was last updated on April 25, 2023.</p>${body}</main>`],
      ["Date in article card", `<main><h1>Page</h1><article><h2>News</h2><span class="last_Updated_Text">${oldLabel}</span></article></main>`],
      ["Footer date", `<main><h1>Page</h1>${body}</main><footer><span class="last_Updated_Text">${oldLabel}</span></footer>`],
      ["Navigation date", `<main><h1>Page</h1><nav><span class="last_Updated_Text">${oldLabel}</span></nav>${body}</main>`],
      ["Conflicting visible dates", `<main><h1>Page</h1><span class="last_Updated_Text">${oldLabel}</span><span class="last_Updated_Text">Last updated on September 15, 2026</span>${body}</main>`],
      ["Date with no page H1", `<main><span class="last_Updated_Text">${oldLabel}</span>${body}</main>`]
    ]) {
      assert.equal(findings(await scan(html)).length, 0, name);
    }

    for (const [now, label, expected] of [
      ["2024-09-15T19:00:00Z", "Last updated on September 15, 2023", 0], // 366 days, exactly one year
      ["2024-09-16T19:00:00Z", "Last updated on September 15, 2023", 1],
      ["2025-02-28T20:00:00Z", "Last updated on February 29, 2024", 0],
      ["2025-03-01T20:00:00Z", "Last updated on February 29, 2024", 1],
      ["2024-02-29T20:00:00Z", "Last updated on February 28, 2023", 1],
      ["2026-09-16T01:00:00Z", "Last updated on September 15, 2025", 0], // still Sept. 15 in Vancouver
      ["2026-09-16T07:00:00Z", "Last updated on September 15, 2025", 1] // local midnight
    ]) {
      await page.clock.setFixedTime(new Date(now));
      assert.equal(findings(await scan(cmsPage(label), cmsOptions)).length, expected, `${now}: ${label}`);
    }
    for (const [now, label, severity] of [
      ["2027-02-28T20:00:00Z", "Last updated on February 29, 2024", "review"],
      ["2027-03-01T20:00:00Z", "Last updated on February 29, 2024", "fix"],
      ["2028-02-29T20:00:00Z", "Last updated on February 28, 2025", "fix"],
      ["2026-09-16T01:00:00Z", "Last updated on September 15, 2023", "review"],
      ["2026-09-16T07:00:00Z", "Last updated on September 15, 2023", "fix"]
    ]) {
      await page.clock.setFixedTime(new Date(now));
      const result = findings(await scan(cmsPage(label), cmsOptions));
      assert.equal(result.length, 1, `${now}: exactly one finding`);
      assert.equal(result[0].severity, severity, `${now}: ${label}`);
    }

    await page.clock.setFixedTime(new Date("2026-09-15T19:00:00Z"));
    const earlier = findings(await scan(cmsPage("Last updated on September 15, 2023"), cmsOptions))[0];
    await page.clock.setFixedTime(new Date("2026-09-16T19:00:00Z"));
    const overdue = findings(await scan(cmsPage("Last updated on September 15, 2023"), cmsOptions))[0];
    assert.notEqual(earlier.fingerprint, overdue.fingerprint, "Crossing three years creates a new finding for saved review decisions");
    console.log("Page update date tests passed: CMS Lite scopes, date boundaries, evidence and conservative detection.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
