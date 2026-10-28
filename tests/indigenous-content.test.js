"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
require("../checker-core.js");
const checker = globalThis.BCWebStyleGuideChecker;
const h = checker.helpers;

const samples = [
  "Da'naxda'xw/Awaetlala First Nation", "Da̱'naxda'x̱w / Awa’etłala First Nation",
  "G̱ilakas’la", "Wei Wai Kum", "shishalh", "yaqan nukiy", "?Akisq'nuk First Nation",
  "Yaqan nu?kiy", "Leq'a:mel First Nation", "Stó:lo Nation", "NIȽ TU,O",
  "Ka:'yu:'k't'h'/Che:k'tles7et'h' First Nations", "Yunesit’in Government",
  "Yaq̓it ʔa·knuqⱡi ‘it First Nation (Tobacco Plains Indian Band)"
];
for (const name of samples) {
  const ranges = h.indigenousNameRanges(name);
  assert.ok(ranges.some(range => range.start === 0 && range.end === name.length), name);
  assert.equal(h.isLikelyTitleCase(h.englishCaseText(name)), false, name);
}
for (const name of ["Tk̓emlúps te Secwépemc", "K'ómoks First Nation"]) {
  const decomposed = name.normalize("NFD");
  const prefix = "Before ";
  const ranges = h.indigenousNameRanges(prefix + decomposed + " after");
  assert.ok(ranges.some(range => range.start === prefix.length && range.end === prefix.length + decomposed.length), name);
}
assert.equal(h.indigenousNameRanges("Katzie First Nationsomething").length, 0);
assert.equal(h.indigenousNameRanges("Cariboo").length, 0, "A regional navigation label is not a reviewed name");
assert.equal(h.indigenousNameRanges("We acknowledge Indigenous Peoples.").length, 0);
assert.equal(h.isLikelyTitleCase(h.englishCaseText("Apply For Café Licences")), true);
assert.equal(h.isLikelyTitleCase(h.englishCaseText("Apply For Wei Wai Kum Applications")), true);
assert.equal(h.sentences("Visit Yaqan nu?kiy. Apply online.").length, 2);
assert.equal(h.sentences("Ready?Apply online.").length, 2);
for (const name of ["?Akisq'nuk First Nation", "Yaqan nu?kiy"]) assert.equal(h.validateExceptionPhrase(name, name.split(" ")[0]).valid, true);
assert.equal(h.validateExceptionPhrase("BC*", "BC").valid, false);
assert.equal(h.validateExceptionPhrase("anything?", "anything").valid, false);
assert.equal(h.proposeExactPhrase("Visit Yaqan nu?kiy today", 12, "kiy"), "Yaqan nu?kiy");
for (const word of ["Da̱'naxda'x̱w", "ʔakink̓umǂasnuqǂiʔit", "Sḵwx̱wú7mesh", "ᓀᐦᐃᔭᐍᐏᐣ", "Leq'a:mel", "?Akin'Um+Asnuq+I?It"]) {
  assert.equal(h.words(word).length, 1, `Keep a written word intact: ${word}`);
  assert.equal(h.words(word.normalize("NFD")).length, 1, `Decomposed marks: ${word}`);
}
assert.deepEqual(h.words("Don't change long-term wording. Ready?Apply now."), ["Don't", "change", "long", "term", "wording", "Ready", "Apply", "now"]);
assert.equal(h.sentences("Visit ?Akin'Um+Asnuq+I?It. Apply online.").length, 2);
assert.equal(h.indigenousNameRanges("Nisg̱a’a Lisims Government’s services").length, 1);
assert.equal(h.indigenousNameRanges("Nisg̱a’a Lisims Governmental services").length, 0);
for (const token of ["US", "USA", "OK"]) assert.equal(h.isWellKnownAcronym(token), true);
assert.equal(h.isWellKnownAcronym("QZX"), false);
assert.equal(h.readingGrade("We visit ʔakink̓umǂasnuqǂiʔit and meet people. ".repeat(10)), null);
assert.equal(h.readingGrade("ᓀᐦᐃᔭᐍᐏᐣ ".repeat(40)), null);
assert.equal(h.canEstimateEnglishReadability("We visit a café."), true);
assert.equal(h.canEstimateEnglishReadability("We visit a café.".normalize("NFD")), true);
assert.equal(h.anchorTextScore("Yaq̓it", "Yaqʔit"), 0);
assert.equal(h.anchorTextScore("ᓀᐦᐃᔭᐍᐏᐣ", "ᓀᐦᐃᔭᐍᐏᐣ"), 1);
const literal = { ruleId: "undefined-acronym", phrase: "?Akisq'nuk First Nation", domain: "example.com" };
assert.equal(h.exceptionMatches(literal, literal.ruleId, "Visit ?Akisq'nuk First Nation today", "example.com"), true);
assert.equal(h.exceptionMatches(literal, literal.ruleId, "Visit XAkisq'nuk First Nation today", "example.com"), false);
assert.equal(h.exceptionMatches({ ruleId: "undefined-acronym", phrase: "NI" }, "undefined-acronym", "NIȽ", "example.com"), false);
assert.equal(h.indigenousWordingOccurrences("indigenous plants and indigenous species").length, 0);
assert.equal(h.indigenousWordingOccurrences('She wrote “indigenous people”.').length, 0);
assert.equal(h.indigenousWordingOccurrences("indigenous people and Inuit people").length, 2);
for (const word of ["gaps", "grant", "permit", "should", "best", "stakeholders", "traditional", "Indian cuisine"]) {
  assert.equal(h.indigenousWordingOccurrences("Indigenous people discuss " + word).length, 0);
}
console.log("Indigenous content helper tests passed");

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    async function scan(body, extra = {}, corePath = path.join(__dirname, "..", "checker-core.js"), language = "en-CA") {
      await page.setContent(`<html lang="${language}"><head><title>Example page</title><meta name="description" content="Example"></head><body><main><h1>Example page</h1>${body}</main></body></html>`);
      await page.addScriptTag({ path: corePath });
      return page.evaluate(options => globalThis.BCWebStyleGuideChecker.scanPage(document, { profile: "standard", scope: "content", canControlColour: false, ...options }), extra);
    }
    const issues = (report, rule) => report.issues.filter(item => item.ruleId === rule);
    for (const name of samples) {
      const report = await scan(`<h2>${name}</h2><p>We work with ${name}.</p><ul><li>${name}</li></ul>`);
      for (const rule of ["heading-title-case", "acronym-in-heading", "undefined-acronym", "government-capitalization", "list-lowercase", "heading-colon-case", "missing-space-after-punctuation"]) {
        assert.equal(issues(report, rule).length, 0, `${rule}: ${name}`);
      }
    }
    let report = await scan('<h2>NI<span>Ƚ</span> TU,O</h2><p>NI<span>Ƚ</span> TU,O works with QZX.</p>');
    assert.equal(issues(report, "acronym-in-heading").length, 0);
    assert.deepEqual(issues(report, "undefined-acronym").map(item => item.flaggedToken), ["QZX"]);
    report = await scan('<h2><span lang="crk">QZX</span> <span>and</span> <span>RST</span></h2><p><span lang="crk">Government QZX</span> QZX helps people.</p>');
    assert.deepEqual(issues(report, "acronym-in-heading").map(item => item.flaggedToken), ["RST"]);
    assert.equal(issues(report, "government-capitalization").length, 0);
    assert.ok(issues(report, "undefined-acronym").some(item => item.flaggedToken === "QZX" && item.evidenceMatchIndex === item.evidence.lastIndexOf("QZX")));
    report = await scan('<section lang="crk"><h2>Capital Words Here</h2><p>Government QZX</p><p><span lang="en">The Government RST helps people.</span></p><img src="missing.png"></section>');
    assert.equal(issues(report, "heading-title-case").length, 0);
    assert.equal(issues(report, "government-capitalization").length, 1);
    assert.deepEqual(issues(report, "undefined-acronym").map(item => item.flaggedToken), ["RST"]);
    assert.equal(issues(report, "image-alt-missing").length, 1);
    report = await scan('<h2>Apply For Café Licences</h2><h2>Apply For Wei Wai Kum Applications</h2><h2>Elders and Knowledge Keepers</h2><h2>Chief and Council</h2><h2>Section 35 Rights</h2><h2>Treaty 8 Rights</h2>');
    assert.deepEqual(issues(report, "heading-title-case").map(item => item.evidence), ["Apply For Café Licences", "Apply For Wei Wai Kum Applications"]);
    report = await scan('<h2>Leq\'a:mel First Nation: services</h2><h2>Ch\'ich\'iyúy Elxwíkn (The Lions)</h2><h2>Wei Wai Kum (application tips)</h2>');
    assert.equal(issues(report, "heading-colon-case").length, 1);
    assert.deepEqual(issues(report, "heading-parentheses").map(item => item.matchText), ["(application tips)"]);
    report = await scan('<p><i>Da̱\'naxda\'x̱w</i></p><table><tr><td>A</td><td>B</td></tr></table><p style="text-align:center">Wei Wai Kum</p>');
    assert.equal(issues(report, "italics").length, 1);
    assert.equal(issues(report, "table-caption").length, 1);
    assert.equal(issues(report, "text-alignment").length, 1);
    report = await scan('<p>We support indigenous people and Inuit people.</p><p>indigenous plants grow here.</p><p>She wrote “indigenous people”.</p><q>Inuit people</q><a href="/report">Inuit people</a>');
    assert.equal(issues(report, "indigenous-identity-case").length, 1);
    assert.equal(issues(report, "indigenous-inuit-people").length, 1);
    report = await scan('<p>Funding will assist First Nations.</p><p>We assist people completing the form.</p>');
    assert.equal(issues(report, "complex-phrase").filter(item => item.matchText === "assist").length, 1);
    report = await scan('<p>Indigenous people discuss funding gaps, grants, permits, stakeholders, traditional knowledge, best practices and should.</p><p>Native plants and Indian cuisine.</p>');
    assert.equal(report.issues.filter(item => item.ruleId.startsWith("indigenous-")).length, 0);
    report = await scan('<h2><span lang="crk">IMPORTANT REQUIRED APPLY</span></h2><p lang="crk">Some long form (QZX).</p><p>QZX helps people.</p>');
    assert.equal(issues(report, "all-caps").length, 0);
    assert.ok(issues(report, "undefined-acronym").some(item => item.flaggedToken === "QZX"));
    report = await scan('<h2 lang="crk"><span lang="en">IMPORTANT REQUIRED APPLY</span></h2>');
    assert.equal(issues(report, "all-caps").length, 1);
    report = await scan('<h2><span lang="crk">Words: lowercase</span> Note: apply</h2>');
    assert.equal(issues(report, "heading-colon-case").length, 1);
    assert.equal(issues(report, "heading-colon-case")[0].matchText, ": a");
    report = await scan('<p>We support <em>indigenous</em> people.</p><p>We work with Inuit <span>people</span>.</p>');
    for (const finding of report.issues.filter(item => item.ruleId.startsWith("indigenous-"))) {
      assert.equal(finding.evidence.slice(finding.evidenceMatchIndex, finding.evidenceMatchIndex + finding.matchText.length), finding.matchText);
    }
    assert.doesNotMatch(JSON.stringify(report), /sourceNode/);
    report = await scan('<p lang="crk">BC and Alta.</p><p>BC residents can apply.</p>');
    assert.equal(issues(report, "bc-abbreviation").length, 1);
    assert.equal(issues(report, "province-abbreviation").length, 0);
    const prose = 'People can find information and read the available content. '.repeat(30);
    report = await scan(`<p lang="crk">${prose}</p>`);
    assert.equal(report.stats.readingGrade, null);
    assert.equal(issues(report, "reading-level").length, 0);
    assert.ok(issues(report, "section-heading-density").length > 0, "Withholding an English reading grade must retain structural review");
    await scan('<p><span lang="crk">Wei Wai Kum</span> (WWK)</p><p lang="crk">Different long form (QZX)</p>');
    const editorText = await page.evaluate(() => globalThis.BCWebStyleGuideChecker.helpers.englishAcronymText(document.querySelector('main')));
    assert.ok(h.acronymDefinedInText(editorText, "WWK"));
    assert.equal(h.acronymDefinedInText(editorText, "QZX"), false);

    report = await scan('<h2>Wei<br>Wai Kum</h2><p>NI<span>Ƚ</span> TU,O</p><p>ORDINARY<span>WORD</span> text.</p>');
    assert.equal(issues(report, "heading-title-case").length, 0);
    assert.equal(issues(report, "undefined-acronym").length, 0);

    report = await scan('<h2>US, USA and OK</h2><p>The US border, USA border and OK response are mentioned here. QZX remains undefined.</p>');
    assert.deepEqual(issues(report, "undefined-acronym").map(item => item.flaggedToken), ["QZX"]);
    assert.equal(issues(report, "acronym-in-heading").length, 0);
    for (const profile of ["standard", "cms-lite"]) {
      report = await scan(`<p>?Aq'am</p><p>(?Aq'am)</p><p>Tsilhoot'in National Government</p><p>Tsilhqot'in National Government</p><p>Tŝilhqot’in National Government</p><p>(Tl'etinqox-t'in Government Office)</p><p>In-<span>SHUCK</span>-ch Nation, Lower Stl'atl'imx Tribal Council</p><p>The Government uses QZX.</p>`, { profile });
      assert.equal(issues(report, "missing-space-after-punctuation").length, 0, profile);
      assert.deepEqual(issues(report, "government-capitalization").map(item => item.matchText), ["Government"], profile);
      assert.deepEqual(issues(report, "undefined-acronym").map(item => item.flaggedToken), ["QZX"], profile);
    }

    report = await scan(`<h2>?Akin'Um+Asnuq+I?It</h2><p>?Akin'<span>Um+Asnuq+I?</span>It</p><ul><li>?Akin'Um+Asnuq+I?It</li></ul><p>Ready?Apply now.</p>`);
    assert.deepEqual(issues(report, "missing-space-after-punctuation").map(item => item.matchText), ["?A"]);
    assert.equal(issues(report, "missing-space-after-punctuation")[0].evidence, "Ready?Apply now.");
    assert.equal(issues(report, "list-multiple-sentences").length, 0);
    assert.equal(issues(report, "heading-title-case").length, 0);

    const shortSentence = "Learn about the history and community of ʔakink̓umǂasnuqǂiʔit and meet our team during your visit this summer.";
    assert.equal(h.words(shortSentence).length, 17);
    report = await scan(`<p>${shortSentence}</p>`);
    assert.equal(issues(report, "sentence-long").length, 0);
    report = await scan('<p>This ordinary English sentence contains enough separate words to go beyond the twenty word limit and should still receive a sentence length finding.</p>');
    assert.equal(issues(report, "sentence-long").length, 1);
    report = await scan(`<p>${'We visit ʔakink̓umǂasnuqǂiʔit and meet people. '.repeat(40)}</p>`);
    assert.equal(report.stats.readingGrade, null);
    assert.ok(issues(report, "section-heading-density").length > 0);
    const englishProse = "People can read the information and find a service. ".repeat(10);
    const englishOnly = await scan(`<p>${englishProse}</p>`);
    report = await scan(`<p>${englishProse}</p><p>${'We visit Sḵwx̱wú7mesh and meet people. '.repeat(20)}</p>`);
    assert.equal(report.stats.readingGrade, englishOnly.stats.readingGrade, "Unscorable blocks must not distort the remaining English estimate");

    // The English-looking collision strings deliberately test local language
    // boundaries; they are not examples or translations of these languages.
    const collisionText = 'Ready?Apply now; 12000 items! assistance QZX';
    report = await scan(`<section lang="kut"><p>${collisionText}</p><h2>Words: lowercase (details)</h2><ul><li>one two three.</li><li>one two four.</li><li>one two five.</li></ul><img src="missing.png"></section><p lang="">${collisionText}</p><p>${collisionText}</p>`);
    for (const rule of ["missing-space-after-punctuation", "semicolon", "exclamation", "number-comma", "complex-phrase", "undefined-acronym"]) {
      assert.equal(issues(report, rule).length, 1, `${rule} should review only the English occurrence`);
    }
    for (const rule of ["heading-colon-case", "heading-parentheses", "list-punctuation", "list-multiple-sentences", "list-repetition"]) assert.equal(issues(report, rule).length, 0, rule);
    assert.equal(issues(report, "image-alt-missing").length, 1);
    report = await scan(`<section lang="kut"><p>${collisionText} <span lang="en">${collisionText}</span></p><h2><span lang="en">Note: apply</span></h2></section>`);
    for (const rule of ["missing-space-after-punctuation", "semicolon", "exclamation", "number-comma", "complex-phrase", "undefined-acronym", "heading-colon-case"]) assert.equal(issues(report, rule).length, 1, `Nested English override: ${rule}`);
    report = await scan(`<p>${collisionText}</p><p lang="en">${collisionText}</p>`, {}, undefined, "kut");
    for (const rule of ["missing-space-after-punctuation", "semicolon", "exclamation", "number-comma", "complex-phrase", "undefined-acronym"]) assert.equal(issues(report, rule).length, 1, `English on a non-English page: ${rule}`);

    report = await scan('<h2>Aboriginal Rights and Title</h2><h2>Indigenous Governments and Institutions</h2><h2>ʔakink̓umǂasnuqǂiʔit (Tobacco Plains)</h2><h2>Wei Wai Kum (application tips)</h2><p>We work with the Nisg̱a’a Lisims <span>Government</span>’s services.</p><p>Indigenous people meet with the Government about services.</p>');
    assert.equal(issues(report, "heading-title-case").length, 0);
    assert.deepEqual(issues(report, "heading-parentheses").map(item => item.matchText), ["(application tips)"]);
    assert.deepEqual(issues(report, "government-capitalization").map(item => item.evidence), ["Indigenous people meet with the Government about services."]);

    report = await scan('<ul><li>Wei Wai Kum community services</li><li>Wei Wai Kum application details</li><li>Wei Wai Kum contact information</li></ul>');
    assert.equal(issues(report, "list-repetition").length, 0);
    report = await scan('<ul><li>Wei Wai Kum you can apply</li><li>Wei Wai Kum you can call</li><li>Wei Wai Kum you can visit</li></ul>');
    assert.equal(issues(report, "list-repetition").length, 1);
    assert.match(issues(report, "list-repetition")[0].evidence, /‘you can’/);
    report = await scan('<ul lang="crk"><li>one two three</li><li>one two four</li><li>one two five</li><li lang="en">You can apply</li><li lang="en">You can call</li><li lang="en">You can visit</li></ul>');
    assert.equal(issues(report, "list-repetition").length, 1);
    assert.match(issues(report, "list-repetition")[0].evidence, /‘you can’/);

    report = await scan('<blockquote><p>The Government will assist people! Ready?Apply now.</p></blockquote><p>She wrote “The <span>Government</span> will assist people!” We assist people with the form.</p><p>For guidance, refer to Dr. Gregory Younging’s <cite>Elements of Indigenous Style</cite>.</p><p>Dr. Smith gives advice. Refer to <cite>Another book</cite>.</p>');
    assert.equal(issues(report, "government-capitalization").length, 0);
    assert.equal(issues(report, "missing-space-after-punctuation").length, 0);
    assert.equal(issues(report, "exclamation").length, 0);
    assert.deepEqual(issues(report, "complex-phrase").map(item => item.matchText), ["assist"]);
    assert.equal(issues(report, "academic-title").length, 1);
    assert.match(issues(report, "academic-title")[0].matchText, /Dr\. Smith/);
    report = await scan('<p>Refer to <span>Dr. Gregory Younging’s</span> <em><cite>Elements of Indigenous Style</cite></em>.</p><p><span>Dr. Smith</span> gives advice. Refer to <cite>Another book</cite>.</p>');
    assert.equal(issues(report, "academic-title").length, 1);
    assert.match(issues(report, "academic-title")[0].matchText, /Dr\. Smith/);
    report = await scan('<p>“assistance” assistance is available.</p><p>“Don’t” don’t use this wording.</p><p>“e.g.” e.g. forms.</p>');
    for (const rule of ["complex-phrase", "negative-contraction", "latin-abbreviation"]) {
      assert.equal(issues(report, rule).length, 1, `Keep the unquoted occurrence: ${rule}`);
      const finding = issues(report, rule)[0];
      assert.ok(finding.evidenceMatchIndex > finding.evidence.indexOf('”'));
    }
    report = await scan('<blockquote><p>QZX</p></blockquote><p>She wrote “RST” and RST remains undefined.</p><p>Now QZX needs a definition.</p>');
    assert.deepEqual(issues(report, "undefined-acronym").map(item => item.flaggedToken).sort(), ["QZX", "RST"]);
    report = await scan('<p>She wrote “The <span>QZX</span> service”. QZX remains undefined.</p>');
    assert.equal(issues(report, "undefined-acronym").length, 1);
    assert.equal(issues(report, "undefined-acronym")[0].evidenceMatchIndex, issues(report, "undefined-acronym")[0].evidence.lastIndexOf("QZX"));
    report = await scan('<h2>“Capital Words Here” and services</h2><p>“Hello!” Apply now!</p><p>“One; two” Choose; apply.</p><p>“A & B” Forms & services.</p><p>“12:00 PM” is the quoted time.</p>');
    assert.equal(issues(report, "heading-title-case").length, 0);
    for (const rule of ["exclamation", "semicolon", "ampersand"]) {
      assert.equal(issues(report, rule).length, 1, `Unquoted punctuation: ${rule}`);
      assert.ok(issues(report, rule)[0].evidenceMatchIndex > issues(report, rule)[0].evidence.indexOf('”'));
    }
    assert.equal(issues(report, "time-format").length, 0);
    // Optional before/after comparison uses the actual pre-patch core, outside the
    // distributed repository. This verifies fingerprints as well as findings.
    if (process.env.INDIGENOUS_BASELINE_CORE) {
      const body = '<h2>Apply For Available Services</h2><p>The Government will assist people. QZX provides 12000 items at 12:00 PM.</p><ul><li>apply online</li></ul><p>Ready?Apply now.</p><p><i>Local Government Act</i></p>';
      const before = await scan(body, {}, process.env.INDIGENOUS_BASELINE_CORE);
      const after = await scan(body);
      const stable = result => result.issues.map(({ ruleId, evidence, matchText, matchIndex, fingerprint }) => ({ ruleId, evidence, matchText, matchIndex, fingerprint }));
      assert.deepEqual(stable(after), stable(before), "Unrelated English findings and identities must remain stable");
    }
    console.log("Indigenous content browser tests passed");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
