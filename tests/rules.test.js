"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
let chromium;
try { ({ chromium } = require("playwright")); }
catch (_) {
  console.log("Style-guide rule tests skipped: Playwright package is not installed.");
  process.exit(0);
}

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
  report = await scan(page, "<p>The B.C. Government introduced a new service.</p>");
  assert.equal(report.issues.filter(issue => issue.ruleId === "government-capitalization").length, 1);

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
  report = await scan(page, `<p>Write content that is easy to understand by focusing on grammar, spelling and tone.</p>
    <div class="on-this-page-wrapper"><div data-component="heading"><h2>On this page</h2></div><div data-component="links"><ul>
      <li><a href="#grammar">Grammar</a></li><li><a href="#spelling">Spelling and word choice</a></li><li><a href="#tone">Tone</a></li>
    </ul></div></div>
    <h2 id="grammar">Grammar</h2><p>Grammar content.</p><h2 id="spelling">Spelling and word choice</h2><p>Spelling content.</p><h2 id="tone">Tone</h2><p>Tone content.</p>`, { profile: "cms-lite" });
  assert.equal(has(report, "list-introduction"), false);
  report = await scan(page, "<ul><li>Apply online. Keep a copy for your records</li></ul>");
  assert.equal(has(report, "list-multiple-sentences"), true);
  report = await scan(page, "<ul><li>MPL British Columbia Distributors Inc. Agency Designation (2022)</li></ul>");
  assert.equal(has(report, "list-multiple-sentences"), false, "Corporate suffixes inside titles must not create a false second sentence");
  report = await scan(page, "<ul><li>Acme Inc. Apply online before Friday.</li></ul>");
  assert.equal(has(report, "list-multiple-sentences"), true, "A real sentence boundary after a corporate suffix must still be recognized");
  report = await scan(page, "<ul><li>Acme Inc. Employees must apply before Friday.</li></ul>");
  assert.equal(has(report, "list-multiple-sentences"), true, "An uppercase sentence after a corporate suffix must still be recognized when the item continues as prose");
  report = await scan(page, "<ul><li>Acme Inc. provides local services.</li></ul>");
  assert.equal(has(report, "list-multiple-sentences"), false, "A corporate suffix inside an ordinary sentence must not create a false boundary");

  report = await scan(page, "<p>Therefore, applicants must provide documentation.</p>");
  assert.equal(has(report, "formal-sentence-starter"), true);
  report = await scan(page, "<p>Le gouvernement fournit des services. Therefore est un mot anglais.</p>", {}, "fr-CA");
  assert.equal(has(report, "formal-sentence-starter"), false);
  assert.equal(report.stats.readingGrade, null);

  report = await scan(page, "<p>To request an accommodation, contact the office.</p><p>Submit individual applications.</p><p>Use the subject line Refund Request.</p>");
  ["accommodation", "individual", "request"].forEach(word => {
    assert.equal(report.issues.some(issue => issue.ruleId === "complex-phrase" && issue.flaggedToken && issue.flaggedToken.toLowerCase() === word), false);
  });

  report = await scan(page, `<p>Several options were given consideration to by the team. The framework was utilized by the individuals who applied. Credits will be disbursed later. The program has been established. It was administered by another ministry. Contact the office for assistance.</p>`);
  for (const wording of ["given consideration to", "utilized", "individuals", "disbursed", "established", "administered", "assistance"]) {
    assert.equal(report.issues.some(issue => issue.ruleId === "complex-phrase" && issue.matchText && issue.matchText.toLowerCase() === wording), true, `Expected complex-phrase for: ${wording}`);
  }
  const repeatedSimpleTerms = Array.from({ length: 30 }, (_, index) => `<p>Approximately ${index + 1} applications were received.</p>`).join("");
  report = await scan(page, `${repeatedSimpleTerms}<p>The program was administered by another ministry.</p>`);
  assert.equal(report.issues.some(issue => issue.ruleId === "complex-phrase" && issue.matchText && issue.matchText.toLowerCase() === "administered"), true, "A distinct guide term must remain available in a repetitive rule group");

  const passiveFindings = async count => {
    const content = Array.from({ length: count }, () => "<p>The request was approved.</p>").join("");
    const result = await scan(page, content);
    return {
      report: result,
      count: result.issues.filter(issue => issue.ruleId === "passive-voice").reduce((total, issue) => total + (issue.occurrenceCount || 1), 0)
    };
  };
  for (const count of [25, 26, 83, 500]) {
    const boundary = await passiveFindings(count);
    assert.equal(boundary.count, count, `${count} findings of one type must remain available`);
    assert.equal(boundary.report.findingLimits.complete, true, `${count} findings must not trigger the 500-finding safety limit`);
  }
  const overLimit = await passiveFindings(501);
  assert.equal(overLimit.count, 500, "The report must retain 500 actionable findings for one issue type");
  assert.equal(overLimit.report.totals["passive-voice"], 501, "The report must preserve the detected total beyond the safety limit");
  assert.deepEqual(overLimit.report.findingLimits.truncatedRules.find(item => item.ruleId === "passive-voice"), {
    ruleId: "passive-voice",
    title: "Rewrite the passive sentence",
    severity: "review",
    category: "Plain language",
    detected: 501,
    retained: 500,
    omitted: 1,
    detectedOpen: 501,
    retainedOpen: 500,
    omittedOpen: 1
  });

  report = await scan(page, "<h2>1. Executive summary</h2><ul><li>Follow any of B.C.'s fire prohibitions and restrictions</li><li>Read B.C.'s campfire regulations (PDF, 1.7MB) poster</li></ul>");
  assert.equal(has(report, "heading-title-case"), false);
  assert.equal(has(report, "list-multiple-sentences"), false);

  report = await scan(page, '<p>NOTE: potable water is unavailable. Email EMCR.ESS@gov.bc.ca. Closed until 1:00 PM. The KUU-US Crisis Line provides support.</p><h2>ON THIS PAGE</h2>');
  ["NOTE", "EMCR", "PM", "US", "THIS"].forEach(token => {
    assert.equal(report.issues.some(issue => ["undefined-acronym", "acronym-in-heading"].includes(issue.ruleId) && issue.flaggedToken === token), false);
  });

  report = await scan(page, '<p><a href="tel:+18442275422">1-844-227-5422</a> <a href="tel:911">9-1-1</a> <a href="tel:18442275422">1-844-227-5422</a></p>');
  assert.equal(report.issues.filter(issue => issue.ruleId === "phone-link-format").length, 1);
  assert.match(report.issues.find(issue => issue.ruleId === "phone-link-format").evidence, /tel:18442275422/);

  report = await scan(page, '<p><a class="btn btn-primary" href="#destination">Search interactive map </a> <a href="#destination">Regular text link </a></p><h2 id="destination">Destination</h2>');
  assert.equal(report.issues.filter(issue => issue.ruleId === "link-trailing-space").length, 1);

  report = await scan(page, '<p>• Plan ahead and prepare • Take only photos • Control your pets</p><p>- first you get the form<br>- then you fill it out<br>- then you send it in</p>');
  assert.equal(report.issues.filter(issue => issue.ruleId === "fake-list").length, 2);

  report = await scan(page, '<img src="one.png" alt="image"><a href="/apply"><img src="two.png" alt="photo"></a>');
  assert.equal(report.issues.filter(issue => issue.ruleId === "image-alt-meaningless").length, 1);
  assert.equal(report.issues.filter(issue => issue.ruleId === "linked-image-alt").length, 1);

  report = await scan(page, '<p>Contact the Pubic Service about pubic engagement and the the notice.</p>');
  assert.equal(report.issues.filter(issue => issue.ruleId === "proofreading-pubic").length, 2);
  assert.equal(report.issues.filter(issue => issue.ruleId === "proofreading-repeat").length, 1);

  const sentenceWithWords = count => `${Array(count).fill("Simple").join(" ")}.`;
  const paragraph4x25 = Array(4).fill(sentenceWithWords(25)).join(" ");
  const paragraph5x20 = Array(5).fill(sentenceWithWords(20)).join(" ");
  const paragraph5x23 = Array(5).fill(sentenceWithWords(23)).join(" ");
  const paragraph6x8 = Array(6).fill(sentenceWithWords(8)).join(" ");
  report = await scan(page, `<p id="p4">${paragraph4x25}</p><p id="p5100">${paragraph5x20}</p><p id="p5115">${paragraph5x23}</p><p id="p6">${paragraph6x8}</p>`);
  const paragraphSelectors = new Set(report.issues.filter(issue => issue.ruleId === "paragraph-long").map(issue => issue.selector));
  assert.equal(paragraphSelectors.has("#p4"), true);
  assert.equal(paragraphSelectors.has("#p5100"), false);
  assert.equal(paragraphSelectors.has("#p5115"), true);
  assert.equal(paragraphSelectors.has("#p6"), true);

  const seventyWords = `${Array(70).fill("clear").join(" ")}.`;
  report = await scan(page, `<p>${seventyWords}</p><p>${seventyWords}</p><h3>Subsection</h3><p>${seventyWords}</p><h4>More detail</h4><p>${seventyWords}</p>`);
  assert.equal(has(report, "section-heading-density"), false);
  report = await scan(page, `<p>${Array(205).fill("clear").join(" ")}.</p>`);
  assert.equal(has(report, "section-heading-density"), true);

  const hardSection = Array(7).fill("Administrative institutionalization necessitates comprehensive interdisciplinary coordination.").join(" ");
  const easySection = Array(40).fill("Use clear words. Help people.").join(" ");
  report = await scan(page, `<h2>Hard section</h2><p>${hardSection}</p><h2>Easy section</h2><p>${easySection}</p>`);
  assert.equal(has(report, "reading-level"), false);
  assert.equal(has(report, "section-reading-level"), true);

  const anotherHardSection = Array(8).fill("Institutional administrative requirements necessitate comprehensive multidisciplinary coordination.").join(" ");
  report = await scan(page, `<h2>First hard section</h2><p>${hardSection}</p><h2>Second hard section</h2><p>${anotherHardSection}</p>`);
  assert.equal(has(report, "reading-level"), true);
  const difficultSectionFindings = report.issues.filter(issue => issue.ruleId === "section-reading-level");
  assert.equal(difficultSectionFindings.length, 2);
  difficultSectionFindings.forEach(issue => {
    assert.match(issue.evidence, /^Estimated reading grade: /);
    assert.equal((issue.diagnostics || []).length, 0);
  });
  const pageReadingFinding = report.issues.find(issue => issue.ruleId === "reading-level");
  assert.equal((pageReadingFinding.diagnostics || []).length, 0);

  const fourWordItem = "Administrative systems require coordination";
  const fiveWordItem = "Administrative systems require comprehensive coordination";
  report = await scan(page, `<h2>Short fragments</h2><ul>${Array(12).fill(`<li>${fourWordItem}</li>`).join("")}</ul>`);
  assert.equal(report.stats.readingWords, 0);
  report = await scan(page, `<h2>Substantial bullets</h2><ul>${Array(12).fill(`<li>${fiveWordItem}</li>`).join("")}</ul>`);
  assert.equal(report.stats.readingWords, 60);


  // v1.3 testing-correction regressions
  report = await scan(page, "<h2>Small claims court - procedures and fees</h2><p>Details.</p>");
  const headingDashFinding = report.issues.find(issue => issue.ruleId === "heading-dash");
  assert.ok(headingDashFinding);
  assert.equal(headingDashFinding.severity, "fix");

  const rangeCases = [
    "Open Monday-Friday.",
    "The office is open 9 am - 5 pm.",
    "Open Monday–Friday, 9:00 A.M. – 4:30 P.M. PST.",
    "Closed 12 noon – 1:00 PM daily.",
    "Open 9 a.m. – noon.",
    "Closed midnight – 6:30 a.m.",
    "Apply May 1-June 2.",
    "Apply May 1-5.",
    "Read reports from 2019-2020.",
    "Review sections 3-5.",
    "About 5%-10% qualify.",
    "Temperatures range from 5°C-10°C.",
    "Use 123 - 456 as the stated range."
  ];
  for (const text of rangeCases) {
    report = await scan(page, `<p>${text}</p>`);
    assert.equal(has(report, "range-dash"), true, `Expected range-dash for: ${text}`);
  }
  for (const text of [
    "Read the 2020-21 annual report.",
    "Call 1-800-663-7867.",
    "Use 2026-08-27 in this table only.",
    "Visit Unit 5 - 123 Main St.",
    "The formula is x - y = 3.",
    "Case 123 - 456 is the reference pair.",
    "Compare 192.168.1.1 - 192.168.1.2 in the technical notes.",
    "This is a long-term plan."
  ]) {
    report = await scan(page, `<p>${text}</p>`);
    assert.equal(has(report, "dash-separator"), false, `Unexpected dash-separator for: ${text}`);
  }
  for (const text of [
    "Open Monday–Friday, 9:00 A.M. – 4:30 P.M. PST.",
    "Closed 12 noon – 1:00 PM daily."
  ]) {
    report = await scan(page, `<p>${text}</p>`);
    assert.equal(has(report, "range-dash"), true, `Expected range-dash for: ${text}`);
    assert.equal(has(report, "dash-separator"), false, `Time range must not become dash-separator: ${text}`);
  }
  report = await scan(page, "<p>Include a copy – if you cannot provide one, include the following information.</p>");
  assert.equal(has(report, "dash-separator"), true);
  report = await scan(page, "<ul><li>Ferrets - Do not pet under any circumstances</li></ul>");
  assert.equal(has(report, "dash-separator"), true);
  report = await scan(page, "<ul><li>Mental Health Services – Northern Health</li></ul>");
  assert.equal(has(report, "dash-separator"), false);
  report = await scan(page, "<p>backyard Hen Form – Part A – Section 1</p>");
  assert.equal(has(report, "dash-separator"), false, "Label-style en dashes must not be treated as sentence separators merely because capitalization is inconsistent");
  report = await scan(page, "<ul><li>Mental Health Services - Northern Health</li></ul>");
  assert.equal(has(report, "dash-separator"), true);

  for (const text of ["and/or", "and / or", "and/ or", "and /or"]) {
    report = await scan(page, `<p>Choose ${text} apply.</p>`);
    assert.equal(has(report, "slash"), true, `Expected slash finding for ${text}`);
  }
  report = await scan(page, "<p>Read https://example.com/and/or/index.html.</p>");
  assert.equal(has(report, "slash"), false);

  report = await scan(page, "<p>Public WIFI is available.</p>");
  assert.equal(has(report, "wifi-format"), true);
  assert.equal(report.issues.some(issue => issue.ruleId === "undefined-acronym" && issue.flaggedToken === "WIFI"), false);

  report = await scan(page, "<p>Employees MUST complete the form before the deadline.</p>");
  assert.equal(has(report, "all-caps"), true, "Common emphasis words in all caps should be flagged as formatting");
  assert.equal(has(report, "undefined-acronym"), false, "A common all-caps word must not also be treated as an undefined acronym");
  report = await scan(page, "<p>Employees DO NOT APPLY until instructed.</p>");
  assert.equal(report.issues.filter(issue => issue.ruleId === "all-caps").length, 1, "Adjacent emphasis words should be one all-caps finding");
  assert.match(report.issues.find(issue => issue.ruleId === "all-caps").matchText, /DO NOT APPLY/);
  report = await scan(page, "<p>We hear appeals about BC SPCA animal custody decisions.</p>");
  assert.equal(has(report, "all-caps"), false, "Formal organization names must not be treated as all-caps emphasis");
  assert.equal(report.issues.some(issue => issue.ruleId === "undefined-acronym" && issue.flaggedToken === "SPCA"), false, "Acronyms inside a recognized formal organization name must not require expansion");
  report = await scan(page, "<p>Download the PDF before applying.</p>");
  assert.equal(has(report, "all-caps"), false, "Familiar acronyms should not be treated as all-caps emphasis");
  report = await scan(page, "<p>Connect to COURT_WIFI when instructed.</p>");
  assert.equal(has(report, "wifi-format"), false);
  report = await scan(page, "<p>Read https://wifi.example.com/setup.</p>");
  assert.equal(has(report, "wifi-format"), false);

  report = await scan(page, "<p><a href='/one'>Find out how</a> <a href='/two'>Find out how to respond to a jury summons</a></p>");
  assert.equal(report.issues.filter(issue => issue.ruleId === "generic-link").length, 1);
  assert.equal(report.issues.find(issue => issue.ruleId === "generic-link").evidence, "Find out how");

  report = await scan(page, "<ul><li>First item</li><li>Second item</li></ul><p><a class='btn btn-primary' href='/help'>Get help during an evacuation</a></p><ul></ul>");
  assert.equal(report.issues.some(issue => issue.ruleId === "list-introduction" && /Get help during an evacuation/.test(issue.evidence)), false, "Empty CMS/editor lists must not create list-introduction findings");
  assert.equal(report.pageDetails.counts.lists, 1, "Empty lists must not inflate the page list count");
  report = await scan(page, "<p>Bring these items</p><ul><li>Photo identification</li><li>Your summons</li></ul>");
  assert.equal(report.issues.some(issue => issue.ruleId === "list-introduction"), true, "Meaningful lists must retain the introduction check");

  report = await scan(page, "<p><a href='/act'>Civil Resolution</a><a href='/act'> Tribunal Act</a></p>");
  assert.equal(report.issues.filter(issue => issue.ruleId === "split-link").length, 1);
  assert.equal(has(report, "link-trailing-space"), false);
  report = await scan(page, "<p><a href='/act'>Find</a><a href='/act'> </a><a href='/act'> information</a></p>");
  assert.equal(report.issues.filter(issue => issue.ruleId === "split-link").length, 1);
  assert.equal(has(report, "empty-link"), false);
  report = await scan(page, "<h4><a href='/complaint'></a><a href='/complaint'>What happens after filing</a></h4>");
  assert.equal(report.issues.filter(issue => issue.ruleId === "split-link").length, 1, "Split links inside headings must be recognized");
  assert.equal(has(report, "empty-link"), false, "The empty fragment of a same-destination split link must not also be reported");
  report = await scan(page, "<ul><li><a href='/old-handout.pdf' target='_blank'></a><a href='/current-form.pdf'>Notice of Complaint Form (PDF, 142KB)</a></li></ul>");
  assert.equal(report.issues.filter(issue => issue.ruleId === "empty-link").length, 1, "A different-destination invisible anchor is a real empty link");
  assert.match(report.issues.find(issue => issue.ruleId === "empty-link").evidence, /Invisible link points to:/);
  assert.equal(report.issues.some(issue => ["file-link-label", "file-link-type", "file-link-size", "file-link-label-format", "file-link-size-spacing", "new-tab"].includes(issue.ruleId) && /old-handout/.test(issue.evidence)), false, "Empty links must suppress secondary link-text and file-label findings");
  assert.equal(report.assets.some(asset => /old-handout\.pdf/.test(asset.href)), true, "An empty document link should remain in the asset inventory");
  report = await scan(page, "<p><a href='#one'>One</a><a href='#two'>Two</a></p><h2 id='one'>One</h2><p>Text.</p><h2 id='two'>Two</h2><p>Text.</p>");
  assert.equal(has(report, "split-link"), false);
  report = await scan(page, "<p><a class='btn btn-primary' href='/apply'>Apply</a><a class='btn btn-primary' href='/apply'>Apply now</a></p>");
  assert.equal(has(report, "split-link"), false);
  report = await scan(page, "<p><a href='/same'>One</a><br><a href='/same'>Two</a></p>");
  assert.equal(has(report, "split-link"), false);

  report = await scan(page, "<h2>Location</h2><h2>Contact information</h2><h2>Wi-Fi</h2>");
  assert.equal(has(report, "heading-empty-sequence"), true);
  report = await scan(page, "<h2>Location</h2><p>Victoria courthouse</p><h2>Contact information</h2><ul><li>Call the registry</li></ul><h2>Wi-Fi</h2>");
  assert.equal(has(report, "heading-empty-sequence"), false);

  const listHeavy = Array(18).fill(0).map((_, index) => `<li>${Array(12).fill("clear word").join(" ")} item ${index}</li>`).join("");
  report = await scan(page, `<ul>${listHeavy}</ul>`);
  assert.equal(has(report, "section-heading-density"), true);
  const beforeAlert = `${Array(110).fill("clear").join(" ")}.`;
  const alertWords = `${Array(220).fill("administrative").join(" ")}.`;
  const afterAlert = `${Array(110).fill("simple").join(" ")}.`;
  report = await scan(page, `<p>${beforeAlert}</p><div class="alert"><p>${alertWords}</p></div><p>${afterAlert}</p>`);
  assert.equal(has(report, "section-heading-density"), false);

  const hardForHighlight = Array(12).fill("Administrative institutionalization necessitates comprehensive interdisciplinary coordination.").join(" ");
  const easyForHighlight = Array(30).fill("Use clear words. Help people.").join(" ");
  report = await scan(page, `<h2>Hard section</h2><p id="hard-one">${hardForHighlight}</p><ul id="hard-list"><li>Administrative systems require comprehensive institutional coordination today</li><li>Administrative processes require multidisciplinary institutional coordination today</li></ul><p id="hard-two">Contact the office for help.</p><h2>Easy section</h2><p>${easyForHighlight}</p>`);
  const sectionFinding = report.issues.find(issue => issue.ruleId === "section-reading-level");
  assert.ok(sectionFinding);
  assert.doesNotMatch(sectionFinding.evidence, /\bwords?\b/i);
  assert.ok(sectionFinding.selectors.length >= 4);
  assert.ok(sectionFinding.selectors.includes("#hard-one"));
  assert.ok(sectionFinding.selectors.includes("#hard-list"));
  assert.ok(sectionFinding.selectors.includes("#hard-two"));

  const longEvidenceText = "You also have the option to file documents electronically through Court Services Online (CSO). To do so, you must have a registered account with CSO and either a BCeID account with a credit card or a BC Online account with access.";
  report = await scan(page, `<p>${longEvidenceText}</p>`);
  const bcEvidenceFinding = report.issues.find(issue => issue.ruleId === "bc-abbreviation" && issue.proposedPhrase === "BC Online");
  assert.ok(bcEvidenceFinding);
  assert.match(bcEvidenceFinding.evidence, /BCeID[\s\S]*BC Online/);
  assert.equal(bcEvidenceFinding.evidence.slice(bcEvidenceFinding.evidenceMatchIndex, bcEvidenceFinding.evidenceMatchIndex + 2), "BC");
  assert.equal(bcEvidenceFinding.evidence.indexOf("BC Online"), bcEvidenceFinding.evidenceMatchIndex);
  report = await scan(page, "<p>Last updated on January 1, 2020</p><p>This page has moved to the new service page.</p>");
  assert.equal(has(report, "moved-page-notice"), true, "An old explicit moved-page notice should be surfaced for review");
  report = await scan(page, "<p>Last updated on January 1, 2020</p><p>Find the current service on another page.</p>");
  assert.equal(has(report, "moved-page-notice"), false, "Ordinary links to other pages must not trigger the moved-page heuristic");

  report = await scan(page, `<style>.low-contrast { color: #777; }</style>
    <p class="low-contrast">First affected paragraph</p><p class="low-contrast">Second affected paragraph</p>
    <p class="low-contrast">Third affected paragraph</p><p class="low-contrast">Fourth affected paragraph</p>`, { canControlColour: true });
  const repeatedContrast = report.issues.filter(issue => issue.ruleId === "contrast");
  assert.equal(repeatedContrast.length, 4, "Every low-contrast element sharing a CSS class must be retained");
  assert.equal(new Set(repeatedContrast.map(issue => issue.selector)).size, 4, "Repeated contrast findings must preserve every location");
  assert.equal(new Set(repeatedContrast.map(issue => issue.contrast.signature)).size, 1, "Equivalent colours may share a review signature without losing occurrences");

  const passingContrastCandidates = Array.from({ length: 500 }, (_, index) => `<p id="passing-${index}" style="color:#000">Passing candidate ${index}</p>`).join("");
  report = await scan(page, `${passingContrastCandidates}<p id="after-old-cutoff" style="color:#777">Affected after the old cutoff</p>`, { canControlColour: true });
  assert.equal(report.issues.some(issue => issue.ruleId === "contrast" && issue.selector === "#after-old-cutoff"), true, "A failing region after 500 passing candidates must still be checked");

  report = await scan(page, `<p id="outer" style="color:#777">Outside text <a id="inner" href="#" style="color:#777">linked text</a></p>`, { canControlColour: true });
  assert.equal(report.issues.filter(issue => issue.ruleId === "contrast").length, 2, "Different connected text regions must be separate occurrences");
  assert.deepEqual(report.issues.filter(issue => issue.ruleId === "contrast").map(issue => issue.selector).sort(), ["#inner", "#outer"]);
  report = await scan(page, `<p><a id="only-region" href="#" style="color:#777">Only linked text</a></p>`, { canControlColour: true });
  assert.equal(report.issues.filter(issue => issue.ruleId === "contrast").length, 1, "A parent with no direct text must not duplicate its child text finding");

  report = await scan(page, `<p style="color:#777;font-size:24px">Large text can use the 3:1 threshold</p><p style="color:#777">Normal text needs 4.5:1</p>`, { canControlColour: true });
  assert.equal(report.issues.filter(issue => issue.ruleId === "contrast").length, 1, "Large and normal text thresholds must remain distinct");
  assert.equal(report.issues.find(issue => issue.ruleId === "contrast").contrast.required, 4.5);

  report = await scan(page, `<style>input::placeholder { color: #aaa; opacity: 1; }</style><input id="email" placeholder="Email address">`, { canControlColour: true });
  const placeholderContrast = report.issues.find(issue => issue.ruleId === "contrast" && issue.selector === "#email");
  assert.ok(placeholderContrast, "Visible placeholder text must be checked");
  assert.equal(placeholderContrast.contrast.displayState, "::placeholder");

  report = await scan(page, `<button disabled style="color:#ddd;background:#fff">Unavailable</button><div role="img" aria-label="Example logo" style="color:#ddd">Example logo</div>`, { canControlColour: true });
  assert.equal(has(report, "contrast"), false, "Inactive controls and logotypes are WCAG contrast exceptions");
  assert.equal(has(report, "contrast-unverified"), false);

  report = await scan(page, `<div style="background:linear-gradient(#fff,#000)"><p id="gradient-text" style="color:#777">Text over a gradient</p></div>`, { canControlColour: true });
  const gradientContrast = report.issues.find(issue => issue.ruleId === "contrast-unverified" && issue.selector === "#gradient-text");
  assert.ok(gradientContrast, "Gradient backgrounds must produce a manual verification finding instead of being skipped");
  assert.match(gradientContrast.contrast.reason, /gradient background/);
  assert.equal(report.issues.some(issue => issue.ruleId === "contrast" && issue.selector === "#gradient-text"), false, "An unreliable background must not be reported as a confirmed ratio");

  report = await scan(page, `<div style="background-image:url(example.jpg)"><p id="opaque-region" style="background:#fff;color:#777">Opaque text region</p></div>`, { canControlColour: true });
  assert.equal(report.issues.some(issue => issue.ruleId === "contrast" && issue.selector === "#opaque-region"), true, "An opaque local background permits a reliable measurement over an ancestor image");
  assert.equal(report.issues.some(issue => issue.ruleId === "contrast-unverified" && issue.selector === "#opaque-region"), false);

  report = await scan(page, `<div style="opacity:.8"><p id="transparent-region" style="background:#fff;color:#777">Transparent rendered group</p></div>`, { canControlColour: true });
  assert.equal(report.issues.some(issue => issue.ruleId === "contrast-unverified" && issue.selector === "#transparent-region"), true, "Ancestor transparency must be sent for manual verification");

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
