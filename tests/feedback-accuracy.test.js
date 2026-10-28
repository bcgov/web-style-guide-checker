"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
require("../checker-core.js");
const h = globalThis.BCWebStyleGuideChecker.helpers;
const sentenceCases = [
  ["Techniques for supporting Indigenous language characters in B.C. government systems (DevHub)", 1],
  ["Prepared by Dr. A. Smith, Ph.D., at 5 p.m. on Mon. Jan. 5", 1],
  ["increase the maximum allowable floor area from 465 sq.m. to 1103.2 sq.m.", 1],
  ["Dr. A. Smith spoke. Applications open Monday.", 2],
  ["The workshop starts at 5 p.m. Please register.", 2],
  ["Contact the B.C. Wildfire Service. Apply online.", 2],
  ["We met in B.C. The meeting ended.", 2],
  ["RH Architects on behalf of Westland Living (1075683 BC Ltd.) applied for rezoning on May 28, 2021.", 1],
  ["She has a Ph.D.Next steps follow.", 2],
  ["She has a Ph.D., and works here.", 1],
  ["Visit Yaqan nu?kiy. Apply online.", 2],
  ["Read e.g. a passport. Apply online.", 2]
];
for (const [text, count] of sentenceCases) {
  assert.equal(h.sentences(text).length, count, text);
  assert.equal(h.sentences(text).join(" ").replace(/\s+/g, " "), text.replace(/(?<=Ph\.D\.)Next/, " Next"), "Segmentation must preserve the wording");
}
assert.deepEqual(h.missingSpaceAfterSentencePunctuationOccurrences("Wrong on purpose:Missing space after a colon. Another example,with a comma. Is this fine?Maybe not.").map(item=>item.text), [":M", ",w", "?M"]);
assert.deepEqual(h.missingSpaceAfterSentencePunctuationOccurrences("She has a Ph.D.Next steps follow.").map(item=>item.text), [".N"]);
assert.equal(h.sentences("Keep the glyph \ue000 intact.")[0], "Keep the glyph \ue000 intact.");
for (const text of ["2225 Acadia Rd.", "5800 University Boulevard", "5506-5536 Kings Rd", "5800 16th Avenue", "5800 Côte-des-Neiges Road", "1075683 BC Ltd.", "1075683 B.C. Ltd.", "1075683 BC Limited", "1075683\u202fBC\u202fLtd.", "Invoice ID 1234-5678", "INV-1075683", "Application #1234-5678", "250-555-0123", "2026-10-23"]) assert.equal(h.numberSeparatorOccurrences(text).length,0,text);
assert.deepEqual(h.numberSeparatorOccurrences("We received 15000-20000 applications.").map(item=>item.text), ["15000", "20000"]);
assert.deepEqual(h.numberSeparatorOccurrences("Plan 15000 new homes. Order 16000 copies.").map(item=>item.text), ["15000", "16000"]);
assert.equal(h.proposeExactPhrase("RH Architects represents 1075683 BC Ltd.", "RH Architects represents 1075683 BC Ltd.".indexOf("BC"), "BC"), "1075683 BC Ltd.");
assert.equal(h.validateExceptionPhrase("BC", "BC").valid, false);
console.log("Feedback accuracy helper tests passed.");
let chromium;
try { ({chromium} = require("playwright")); }
catch(error) {
  if(process.env.REQUIRE_BROWSER_TESTS === "1") throw error;
  console.log("Feedback accuracy browser tests skipped: Playwright unavailable.");
  process.exit(0);
}
const cases=[
 ['Spacing across inline markup','<p>Is this fine?<strong>Maybe</strong> not.</p>',{'missing-space-after-punctuation':1}],
 ['Existing inline space','<p>Is this fine?<strong> Maybe</strong> not.</p>',{'missing-space-after-punctuation':0}],
 ['Mixed address and quantity','<p>Visit 2225 Acadia Rd. We received 15000 applications.</p>',{'number-comma':1}],
 ['Inline address number','<p>Visit <strong>5800</strong> University Boulevard, Vancouver BC V6T 1Z4.</p>',{'number-comma':0,'bc-abbreviation':0}],
 ['Lowercase street with postal code','<p>Visit 5800 university boulevard, Vancouver BC V6T 1Z4.</p>',{'number-comma':0}],
 ['Street ranges','<p>Visit 5506-5536 Kings Rd and 5519-5549 Toronto Rd.</p>',{'number-comma':0}],
 ['Quantity range','<p>We received 15000-20000 applications.</p>',{'number-comma':2}],
 ['Company, generic BC and quantity','<p>RH Architects represents 1075683 BC Ltd. People in BC submitted 15000 applications.</p>',{'number-comma':1,'bc-abbreviation':1}],
 ['Company Limited suffix','<p>RH Architects represents 1075683 BC Limited.</p>',{'number-comma':0,'bc-abbreviation':0}],
 ['Inline company number','<p>RH Architects represents <strong>1075683</strong> BC Ltd.</p>',{'number-comma':0,'bc-abbreviation':0}],
 ['Company suffix word boundary','<p>1075683 BC Ltdx</p>',{'number-comma':1,'bc-abbreviation':1}],
 ['Title-case legal description','<p>The legal description reads: The north 1/2 of Lot A (Explanatory Plan 3423), Block 99, District Lot 140, Plan 5449.</p>',{'number-comma':0}],
 ['Imperative quantities','<p>Plan 15000 new homes. Order 16000 copies.</p>',{'number-comma':2}],
 ['Plan reference and quantity','<p>See Plan 5449 for details. It received 15000 responses.</p>',{'number-comma':1}],
 ['Linked file label','<h2><a href="/file.pdf">Appointment process (PDF, 34KB)</a></h2>',{'heading-parentheses':0}],
 ['Adjacent file label','<h2><a href="/file.pdf">Appointment process</a> (PDF, 34KB)</h2>',{'heading-parentheses':0,'file-link-label-outside':1}],
 ['Other heading parentheses','<h2><a href="/file.pdf">Appointment process (updated) (PDF, 34KB)</a></h2>',{'heading-parentheses':1}],
 ['Repeated file label with only one linked','<h2><a href="/file.pdf">Appointment process (PDF, 34KB)</a> and commentary (PDF, 34KB)</h2>',{'heading-parentheses':1}],
 ['Email query and punctuation','<p>Email <a href="mailto:PlanUEL@gov.bc.ca?subject=Hello">PlanUEL@gov.bc.ca.</a></p>',{'email-link-text':0,'linked-period':1}],
 ['Different email and punctuation','<p>Email <a href="mailto:other@gov.bc.ca">PlanUEL@gov.bc.ca.</a></p>',{'email-link-text':1,'linked-period':1}],
 ['Encoded email plus','<p>Email <a href="mailto:person%2Btag@example.ca">person+tag@example.ca.</a></p>',{'email-link-text':0,'linked-period':1}],
 ['Malformed email encoding','<p>Email <a href="mailto:person%ZZ@example.ca">person@example.ca</a></p>',{'email-link-destination':1}],
 ['Encoded email controls','<p>Email <a href="mailto:person%0D%0A@example.ca">person@example.ca</a></p>',{'email-link-destination':1}],
 ['Single-cell action','<table><tr><td>Apply for parking permits</td></tr></table>',{'table-layout':1,'table-caption':0,'table-headers':0}],
 ['Single-cell with caption','<table><caption>Permit applications</caption><tr><td>Apply for parking permits</td></tr></table>',{'table-layout':1}],
 ['Hidden second row','<table><tr><td>Apply for parking permits</td></tr><tr hidden><td>Other content</td></tr></table>',{'table-layout':0}],
 ['Data table','<table><caption>Permit fees</caption><tr><th>Permit</th><th>Fee</th></tr><tr><td>Parking</td><td>$25</td></tr></table>',{'table-layout':0,'table-headers':0,'table-caption':0}],
 ['Nested header','<table><tr><td>Permit information</td><td><table><tr><th>Inner header</th></tr></table></td></tr></table>',{'table-headers':1}]
];

cases.push(
 ["Quoted span boundary", "<p>Example,<q>with</q> a word. Reference 12<q>3456</q>.</p>", {"missing-space-after-punctuation":0,"number-comma":0}],
 ["Exact reported spacing paragraph", "<h2>Indigenous language characters</h2><p>Wrong on purpose:Missing space after a colon. Another example,with a comma. Is this fine?Maybe not.</p>", {"missing-space-after-punctuation":3}],
 ["Exact reported B.C. list", "<ul><li>Techniques for supporting Indigenous language characters in B.C. government systems (DevHub)</li></ul>", {"list-multiple-sentences":0}],
 ["Exact reported credentials", "<ul><li>Prepared by Dr. A. Smith, Ph.D., at 5 p.m. on Mon. Jan. 5</li></ul>", {"list-multiple-sentences":0,"missing-space-after-punctuation":0,"time-format":1}],
 ["Exact reported address group", "<p>The site is at 2225 Acadia Rd., 5506-5536 Kings Rd, and 5519-5549 Toronto Rd. The Change of Land Use District (rezoning) Application #4/21 applies.</p>", {"number-comma":0}],
 ["Exact reported postal address", "<p>Visit 5800 University Boulevard, Vancouver BC V6T 1Z4 for more information. Rezoning application #1/22 applies there.</p>", {"number-comma":0,"bc-abbreviation":0}],
 ["Exact reported company", "<p>RH Architects on behalf of Westland Living (1075683 BC Ltd.) applied for rezoning on May 28, 2021.</p>", {"number-comma":0,"bc-abbreviation":0}],
 ["Exact reported table", "<table><tr><td>Apply for multi-family parking permits</td></tr></table>", {"table-layout":1,"table-headers":0,"table-caption":0}],
 ["Original place-name correction", "<h2>100 Mile House</h2><p>Drive 5 miles from <strong>100 Mile</strong> House.</p>", {"heading-title-case":0,"imperial-unit":1}],
 ["Sentence endings beside credentials", "<ul><li>She has a Ph.D.Next steps follow.</li></ul>", {"missing-space-after-punctuation":1,"list-multiple-sentences":1}],
 ["Time ending a sentence", "<ul><li>The workshop starts at 5 p.m. Please register.</li></ul>", {"list-multiple-sentences":1,"time-format":1}],
 ["Inline comma and colon", "<p>Example,<strong>with</strong> a comma. Label:<em>Missing</em> a space.</p>", {"missing-space-after-punctuation":2}],
 ["Technical punctuation", "<p>Use https://example.ca/path?a=b,c or mailto:person@example.ca at 9:30 am with a 1:2 ratio and 15,000 records. <code>alpha,beta:key</code></p>", {"missing-space-after-punctuation":0}],
 ["Existing whitespace", "<p>Example, with a comma. Label: Missing a space. Ready? Maybe.</p>", {"missing-space-after-punctuation":0}],
 ["Names with ordinary English punctuation nearby", "<p>NIȽ TU,O Child and Family Services Society and (?Aq'am). Example,with a comma.</p>", {"missing-space-after-punctuation":1}],
 ["Inline language override", "<p lang='crk'>Example,with 15000 items. <span lang='en'>Example,with 16000 items.</span></p>", {"missing-space-after-punctuation":1,"number-comma":1}],
 ["Language boundary across comma", "<p>Example,<span lang='crk'>with</span> a word.</p>", {"missing-space-after-punctuation":0}],
 ["Boundary across a line break", "<p>Example,<br>with a word.</p>", {"missing-space-after-punctuation":0}],
 ["Quoted punctuation and quantities", "<p>“Example,with 15000 records” is quoted. We received 16000 records.</p>", {"missing-space-after-punctuation":0,"number-comma":1}],
 ["Whole number split across markup", "<p>We received 15<strong>000</strong> applications.</p>", {"number-comma":1}],
 ["Unlinked file label", "<h2>Appointment process (PDF, 34KB)</h2>", {"heading-parentheses":1}],
 ["Opaque CMS Lite file URL", "<h2><a href='/cmslite/content/asset/0123456789'>Appointment process <span>(PDF, 34KB)</span></a></h2>", {"heading-parentheses":0}],
 ["File label size spacing", "<h2><a href='/file.pdf'>Appointment process (PDF, 34 KB)</a></h2>", {"heading-parentheses":0}],
 ["Two identical linked file labels", "<h2><a href='/one.pdf'>Guide (PDF, 34KB)</a> and <a href='/two.pdf'>Guide (PDF, 34KB)</a></h2>", {"heading-parentheses":0}],
 ["Single-cell header is still a review", "<table><caption>Permits</caption><tr><th>Apply for permits</th></tr></table>", {"table-layout":1,"table-headers":0,"table-caption":0}],
 ["Merged-cell structure", "<table><tr><td colspan='2'>Apply for permits</td></tr></table>", {"table-layout":0}],
 ["Empty table", "<table><tr><td></td></tr></table>", {"table-layout":0}],
 ["Presentation table", "<table role='presentation'><tr><td>Apply</td><td>Contact us</td></tr></table>", {"table-layout":1,"table-headers":0,"table-caption":0}]
);

(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  await page.route("**/*", route=>route.fulfill({contentType:"text/html",body:"<html lang='en'><body></body></html>"}));
  await page.goto("https://example.gov.bc.ca/accuracy-test");
  async function fixture(html) {
   await page.setContent(`<html lang="en-CA"><head><title>Accuracy test</title><meta name="description" content="Test"></head><body><main><h1>Accuracy test</h1>${html}</main></body></html>`);
   await page.addScriptTag({path:path.join(__dirname,"..","review-exclusions.js")});
   await page.addScriptTag({path:path.join(__dirname,"..","checker-core.js")});
  }
  async function scan(profile,options={}) {return page.evaluate(({profile,options})=>BCWebStyleGuideChecker.scanPage(document,{scope:"content",profile,canControlColour:false,...options}),{profile,options});}
  for(const profile of ["standard","cms-lite"]) {
   for(const [label,html,want] of cases) {
    await fixture(html);
    const before=await page.locator('body').innerHTML();
    const report=await scan(profile);
    assert.equal(await page.locator('body').innerHTML(),before,"Scanning must not edit the page");
    assert.equal(report.ruleBuild,globalThis.BCWebStyleGuideChecker.ruleBuild);
    for(const [rule,count] of Object.entries(want)) assert.equal(report.issues.filter(i=>i.ruleId===rule).length,count,`${profile}: ${label}: ${rule}`);
    for(const issue of report.issues.filter(i=>["number-comma","missing-space-after-punctuation"].includes(i.ruleId))) {
     assert.equal(issue.evidence.slice(issue.evidenceMatchIndex,issue.evidenceMatchIndex+issue.matchText.length),issue.matchText,`${profile}: ${label}: evidence offset`);
     assert.ok(await page.locator(issue.selector).count(),`${profile}: ${label}: finding target`);
    }
   }
   await fixture('<p>Example,<span id="skip">excluded</span>with text. 1075683 <span id="gap">excluded</span>BC Ltd.</p>');
   const exclusions=await page.evaluate(()=>["#skip","#gap"].map(selector=>({id:selector,scope:"page",url:location.href,...BCReviewExclusions.describe(document.querySelector(selector))})));
   const excluded=await scan(profile,{exclusions});
   assert.equal(excluded.issues.filter(i=>i.ruleId==="missing-space-after-punctuation").length,0,"Spacing must not bridge excluded content");
   assert.equal(excluded.issues.filter(i=>i.ruleId==="number-comma").length,1,"A company match must not bridge excluded content");
   await fixture('<details open><summary>Data</summary><table><caption>Permit fees</caption><tr><th>Permit</th><th>Fee</th></tr><tr><td>Parking</td><td>$25</td></tr></table></details>');
   assert.equal((await scan(profile)).issues.filter(i=>i.ruleId==="table-accordion").length,profile==="cms-lite"?1:0);
  }
  console.log(`Feedback accuracy browser tests passed (${cases.length} cases in both profiles, plus exclusions and placement).`);
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
