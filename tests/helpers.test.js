"use strict";

const assert = require("node:assert/strict");
require("../checker-core.js");

const helpers = globalThis.BCWebStyleGuideChecker.helpers;

assert.equal(helpers.normalizeSpace("  B.C.\u00a0 government  "), "B.C. government");
assert.equal(helpers.comparisonText("\u200bMaintain business records"), "Maintain business records");
assert.equal(helpers.comparisonText("Maintain\u2060 business records"), "Maintain business records");
assert.deepEqual(helpers.words("People’s 2 options"), ["People’s", "2", "options"]);
assert.equal(helpers.sentences("One sentence. Another sentence!").length, 2);
assert.equal(helpers.sentences("The capacity of the M.V. Osprey 2000 is 80 vehicles. The M.V. Balfour can accommodate 19 vehicles.").length, 2);
assert.equal(helpers.sentences("Services are available in B.C. Apply online.").length, 2);
assert.equal(helpers.sentences("Contact the B.C. Wildfire Service for help. Check current conditions.").length, 2);
assert.equal(helpers.sentences("Refund requests must be sent to FishandWildlife@gov.bc.ca, with the subject line Refund Request.").length, 1);
assert.equal(helpers.sentences("Download the map (PDF, 5.17 MB).").length, 1);
assert.equal(helpers.sentences("Read https://www2.gov.bc.ca/example. Apply online.").length, 2);
assert.equal(helpers.isLikelyTitleCase("Apply For Medical Insurance"), true);
assert.equal(helpers.isLikelyTitleCase("Apply for medical insurance"), false);

const simple = "Use short words. Help people find what they need. Put the key fact first. Keep each sentence clear. This page explains the service. Tell people how to apply. Give them a phone number when they need help.";
const complex = "The institutionalization of multifaceted administrative methodologies necessitates comprehensive consideration of approximately innumerable organizational eventualities. Interdepartmental implementation responsibilities are subsequently communicated through extraordinarily complicated procedural documentation and administrative correspondence. Organizational representatives facilitate additional interdisciplinary consultation.";
assert.ok(helpers.readingGrade(simple) < helpers.readingGrade(complex));
assert.equal(Number(helpers.contrastRatio([0, 0, 0, 1], [255, 255, 255, 1]).toFixed(1)), 21);

const formalNameText = "Employees in the BC Public Service work across B.C.";
const formalRanges = helpers.approvedTermRanges(formalNameText);
assert.equal(formalRanges.some(range => range.term === "BC Public Service" && formalNameText.slice(range.start, range.end) === "BC Public Service"), true);

const bcIndex = formalNameText.indexOf("BC");
assert.equal(helpers.proposeExactPhrase(formalNameText, bcIndex, "BC"), "BC Public Service");
assert.equal(helpers.proposeExactPhrase("People in BC can apply", 10, "BC"), "BC");
assert.equal(helpers.proposeExactPhrase("Apply through StrongerBC today", "Apply through StrongerBC today".indexOf("BC"), "BC"), "StrongerBC");
assert.deepEqual(helpers.validateExceptionPhrase("BC Public Service", "BC"), { valid: true, phrase: "BC Public Service" });
assert.equal(helpers.validateExceptionPhrase("BC", "BC").valid, false);
assert.match(helpers.validateExceptionPhrase("BC", "BC").reason, /complete formal name/i);
assert.deepEqual(helpers.validateExceptionPhrase("TV", "TV"), { valid: true, phrase: "TV" });
assert.deepEqual(helpers.validateExceptionPhrase("StrongerBC", "BC"), { valid: true, phrase: "StrongerBC" });
assert.equal(helpers.validateExceptionPhrase("", "BC").valid, false);
assert.equal(helpers.validateExceptionPhrase("BC * Service", "BC").valid, false);

const exception = { id: "x-1", ruleId: "bc-abbreviation", phrase: "BC Public Service", domain: "*" };
assert.equal(helpers.exceptionMatches(exception, "bc-abbreviation", formalNameText, "example.com"), true);
assert.equal(helpers.exceptionMatches(exception, "heading-title-case", formalNameText, "example.com"), false);
assert.equal(helpers.exceptionMatches(exception, "bc-abbreviation", "BC public service", "example.com"), false);
assert.equal(helpers.exceptionMatches({ ...exception, phrase: "BC" }, "bc-abbreviation", "Fireworks Act of BC", "example.com"), false);
assert.equal(helpers.exceptionMatches({ ...exception, phrase: "BC Driver" }, "bc-abbreviation", "BC Driver's Licence", "example.com"), false);
assert.equal(helpers.exceptionAtIndex([exception], "bc-abbreviation", formalNameText, bcIndex, "example.com").id, "x-1");
assert.equal(helpers.exceptionAtIndex([exception], "bc-abbreviation", "BC residents and the BC Public Service", 0, "example.com"), null);
assert.equal(helpers.builtInTermAtIndex("Contact Service BC for help", 16), "Service BC");
const strongerException = { id: "x-2", ruleId: "bc-abbreviation", phrase: "StrongerBC", domain: "*" };
assert.equal(helpers.exceptionAtIndex([strongerException], "bc-abbreviation", "Use StrongerBC today", "Use StrongerBC today".indexOf("BC"), "example.com").id, "x-2");

assert.equal(helpers.canonicalUrl("https://example.com/page#section"), "https://example.com/page");
assert.equal(helpers.detectProfile("https://www2.gov.bc.ca/gov/content/example", "auto"), "cms-lite");
assert.equal(helpers.detectProfile("https://www2.qa.gov.bc.ca/gov/content/example", "auto"), "cms-lite");
assert.equal(helpers.detectProfile("https://intranet.gov.bc.ca/example", "auto"), "cms-lite");
assert.equal(helpers.detectProfile("https://intranet.qa.gov.bc.ca/example", "auto"), "cms-lite");
assert.equal(helpers.detectProfile("https://antiracism.gov.bc.ca/example", "auto"), "standard");
const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
assert.equal(helpers.isCmsLiteTemplateImage({ src: transparentPixel, naturalWidth: 1, naturalHeight: 1 }, "cms-lite"), true);
assert.equal(helpers.isCmsLiteTemplateImage({ src: transparentPixel, naturalWidth: 1, naturalHeight: 1 }, "standard"), false);
const cmsListIcon = "https://www2.qa.gov.bc.ca/icons/list.svg";
assert.equal(helpers.isCmsLiteTemplateImage({ src: cmsListIcon, alt: "", hasAttribute: () => true }, "cms-lite"), true);
assert.equal(helpers.isCmsLiteTemplateImage({ src: cmsListIcon, alt: "List", hasAttribute: () => true }, "cms-lite"), false);
assert.equal(helpers.isCmsLiteTemplateImage({ src: cmsListIcon, alt: "", hasAttribute: () => true }, "standard"), false);

const blockReading = helpers.readingGradeFromBlocks([
  "Apply online using your account",
  "Gather the documents you need",
  "Check the information before submitting",
  "Contact the service if you need help",
  "Keep a copy for your records",
  "You can update your application later"
]);
assert.equal(blockReading.sentences, 6);
assert.equal(blockReading.words, 34);
assert.equal(helpers.shouldFlagReadingGrade(8.9), false);
assert.equal(helpers.shouldFlagReadingGrade(9), true);
assert.equal(helpers.isEnglishLanguage("en-CA"), true);
assert.equal(helpers.isEnglishLanguage(""), true);
assert.equal(helpers.isEnglishLanguage("fr-CA"), false);

assert.equal(helpers.passiveVoiceParticiple("The decision was made yesterday.").participle, "made");
assert.equal(helpers.passiveVoiceParticiple("The fee is paid online.").participle, "paid");
assert.equal(helpers.passiveVoiceParticiple("The office is located downtown."), null);
assert.equal(helpers.passiveVoiceParticiple("The program is committed to accessibility."), null);

assert.equal(Boolean(helpers.headingStructureDetails("Housing benefits – How to apply").dash), true);
assert.equal(Boolean(helpers.headingStructureDetails("Long-term planning").dash), false);
assert.equal(Boolean(helpers.headingStructureDetails("Medical Services Plan (MSP)").parentheses), false);
assert.equal(Boolean(helpers.headingStructureDetails("Application process (updated)").parentheses), true);
assert.equal(Boolean(helpers.headingStructureDetails("Housing benefits: how to apply").colon), true);
assert.equal(Boolean(helpers.headingStructureDetails("Housing benefits: How to apply").colon), false);

assert.deepEqual(helpers.measurementDetails("The route is 100kms long."), { ruleId: "metric-plural", text: "100kms", index: 13, replacement: "100 km" });
assert.deepEqual(helpers.measurementDetails("Bring a 5L container."), { ruleId: "metric-spacing", text: "5L", index: 8, replacement: "5 L" });
assert.equal(helpers.measurementDetails("The speed limit is 30 km/h."), null);
assert.equal(helpers.educationContext("Students enter school in September."), true);
assert.equal(helpers.educationContext("Grade A beef is available."), false);
assert.deepEqual(helpers.academicDegreeDetails("She has a Master of Science."), { text: "Master", index: 10, replacement: "master" });
assert.deepEqual(helpers.academicDegreeDetails("The Master of Science program starts today."), { text: "Master", index: 4, replacement: "master" });
assert.equal(helpers.academicDegreeDetails("She has a master of English."), null);
assert.deepEqual(helpers.canadianSpellingContextDetails("Renew your driver license online."), { text: "license", index: 18, replacement: "licence", role: "likely noun" });
assert.equal(helpers.canadianSpellingContextDetails("The ministry can license an operator."), null);
assert.deepEqual(helpers.canadianSpellingContextDetails("You can practice before the test."), { text: "practice", index: 8, replacement: "practise", role: "likely verb" });
assert.equal(helpers.canadianSpellingContextDetails("The medical practice is downtown."), null);

assert.deepEqual(helpers.assetLabel("Application form (PDF, 23KB)"), { valid: true, status: "valid", type: "PDF", size: 23, unit: "KB", raw: "(PDF, 23KB)", sizeText: "23KB", replacement: "23KB" });
assert.equal(helpers.assetLabel("Application form (PDF)").status, "missing-size");
assert.equal(helpers.assetLabel("Application form (PDF, 23 KB)").status, "size-spacing");
assert.equal(helpers.assetLabel("Application form (PDF, 23 KB)").replacement, "23KB");
assert.equal(helpers.assetLabel("Application form [PDF, 23KB]").valid, true);
assert.equal(helpers.assetLabel("Application form [PDF, 271 KB]").status, "size-spacing");
assert.deepEqual(helpers.assetLabel("Application form (PDF 159 KB)"), { valid: false, status: "label-format", type: "PDF", size: 159, unit: "KB", raw: "(PDF 159 KB)", sizeText: "159KB", replacement: "(PDF, 159KB)" });
assert.equal(helpers.assetTypeFromUrl("https://example.com/files/form.docx?download=1"), "DOCX");
assert.equal(helpers.endsStylePunctuation("Learn about B.C."), false);
assert.equal(helpers.endsStylePunctuation("Services in N.T."), false);
assert.equal(helpers.endsStylePunctuation("Learn about services."), true);
assert.equal(helpers.linkPunctuationIssue(","), "punctuation-only");
assert.equal(helpers.linkPunctuationIssue("B.C."), "none");
assert.equal(helpers.linkPunctuationIssue("Apply now,"), "terminal");
assert.equal(helpers.listEndingNeedsRemoval("Before you apply:"), false);
assert.equal(helpers.listEndingNeedsRemoval("A formal name (registered)"), false);
assert.equal(helpers.listEndingNeedsRemoval("The sign says “Stop”"), false);
assert.equal(helpers.listEndingNeedsRemoval("Gather your documents."), true);

assert.equal(helpers.acronymDefinedInText("Provincial Sales Tax (PST)", "PST"), true);
assert.equal(helpers.acronymDefinedInText("Free Trade Agreement (FTA)", "FTAs"), true);
assert.equal(helpers.acronymDefinedInText("Free Trade Agreements (FTAs)", "FTAs"), true);
assert.equal(helpers.acronymDefinedInText("Recreation Sites and Trails B.C. (RSTBC)", "RSTBC"), true);
assert.equal(helpers.acronymDefinedInText("Find PST requirements", "PST"), false);
assert.equal(helpers.acronymDefinedInText("PST is Provincial Sales Tax (PST)", "PST"), false);
assert.equal(helpers.acronymDefinedInText("WorkSafeBC (WSBC) guidance", "PST"), false);
assert.equal(helpers.acronymDefinedAcrossParts(["Provincial Sales Tax ", "(PST) applies"], 1, 1, "PST"), true);
assert.equal(helpers.acronymDefinedAcrossParts(["Provincial Sales Tax", "PST applies"], 1, 0, "PST"), false);
assert.equal(helpers.acronymDefinedAcrossParts(["PST applies", "Provincial Sales Tax (PST)"], 0, 0, "PST"), false);
assert.equal(helpers.isWellKnownAcronym("PST"), true);
assert.equal(helpers.isWellKnownAcronym("GST"), true);
assert.equal(helpers.isWellKnownAcronym("HR"), true);
assert.equal(helpers.isWellKnownAcronym("DOCX"), true);
assert.equal(helpers.isWellKnownAcronym("ZXQ"), false);
assert.equal(helpers.acronymBase("FTAs"), "FTA");
assert.equal(helpers.acronymBase("CIPO"), "CIPO");
const acronymHighlightText = "Canadian Intellectual Property Office (CIPO) offers IP tools";
const acronymHighlightIndex = helpers.exactTokenIndex(acronymHighlightText, "IP");
assert.equal(acronymHighlightText.slice(acronymHighlightIndex, acronymHighlightIndex + 2), "IP");
assert.ok(acronymHighlightIndex > acronymHighlightText.indexOf("CIPO"));
assert.equal(helpers.isCommonRomanNumeral("II"), true);
assert.equal(helpers.isCommonRomanNumeral("XX"), true);
assert.equal(helpers.isCommonRomanNumeral("MIX"), false);
assert.equal(helpers.isPostalAcronymContext("STN", "PO Box 9363 STN PROV GOVT Victoria, B.C. V8W 9M8"), true);
assert.equal(helpers.isPostalAcronymContext("STN", "The STN program is changing"), false);

const visibleDoubleSpace = helpers.doubleSpaceDetails("Information is safe.  For immediate help call 911.");
assert.equal(visibleDoubleSpace.count, 2);
assert.match(visibleDoubleSpace.evidence, /safe\. ⟦2 spaces⟧ For/);
assert.equal(helpers.doubleSpaceDetails("First line\n    Second line"), null);
assert.equal(helpers.doubleSpaceDetails("One space only."), null);

assert.equal(helpers.anchorTextScore("Personal property", "Personal property"), 1);
assert.ok(helpers.anchorTextScore("Phone number links", "Phone numbers links") > 0.7);
assert.ok(helpers.anchorTextScore("Personal property", "Business licences") < 0.3);

const baseFinding = { ruleId: "bc-abbreviation", evidence: "BC residents", selector: "#content", matchIndex: 0 };
assert.equal(helpers.findingFingerprint("https://example.com/page#one", baseFinding), helpers.findingFingerprint("https://example.com/page#two", baseFinding));
assert.notEqual(helpers.findingFingerprint("https://example.com/page", baseFinding), helpers.findingFingerprint("https://example.com/page", { ...baseFinding, evidence: "BC businesses" }));

console.log("Helper tests passed");
