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
assert.equal(helpers.sentences("1.3.1 Info and relationships – level A").length, 1);
assert.equal(helpers.isLikelyTitleCase("Apply For Medical Insurance"), true);
assert.equal(helpers.isLikelyTitleCase("Apply for medical insurance"), false);

const simple = "Use short words. Help people find what they need. Put the key fact first. Keep each sentence clear. This page explains the service. Tell people how to apply. Give them a phone number when they need help.";
const complex = "The institutionalization of multifaceted administrative methodologies necessitates comprehensive consideration of approximately innumerable organizational eventualities. Interdepartmental implementation responsibilities are subsequently communicated through extraordinarily complicated procedural documentation and administrative correspondence. Organizational representatives facilitate additional interdisciplinary consultation.";
assert.ok(helpers.readingGrade(simple) < helpers.readingGrade(complex));
assert.equal(Number(helpers.contrastRatio([0, 0, 0, 1], [255, 255, 255, 1]).toFixed(1)), 21);
assert.ok(helpers.contrastRatio([118.66, 118.66, 118.66, 1], [255, 255, 255, 1]) < 4.5, "Contrast thresholds must not be rounded up");
assert.ok(Math.abs(helpers.luminance([10.2, 10.2, 10.2, 1]) - 0.0030959752) < 0.0000001, "Relative luminance must use the WCAG 2.2 sRGB breakpoint");
assert.deepEqual(helpers.sequentialFakeListDetails("a. First item\nb. Second item\nc. Third item", "letters"), { marker: "sequential letters", count: 3 });
assert.deepEqual(helpers.sequentialFakeListDetails("1. First item\n2. Second item\n3. Third item", "numbers"), { marker: "sequential numbers", count: 3 });
assert.equal(helpers.sequentialFakeListDetails("1. First item\n3. Third item\n5. Fifth item", "numbers"), null);
assert.equal(helpers.sequentialFakeListDetails("Version 1.3.1 includes three corrections.", "numbers"), null);
assert.equal(helpers.listEndingNeedsRemoval("314 Cedar St."), false);
assert.equal(helpers.listEndingNeedsRemoval("Apply before Friday."), true);

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
assert.equal(helpers.emptySamePageFragment("#", "https://example.com/page"), true);
assert.equal(helpers.emptySamePageFragment("https://example.com/page#", "https://example.com/page"), true);
assert.equal(helpers.emptySamePageFragment("https://example.com/other#", "https://example.com/page"), false);
assert.equal(helpers.emptySamePageFragment("#section", "https://example.com/page"), false);
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
assert.deepEqual(helpers.assetLabel("Application form (PDF, 1.MB)"), { valid: false, status: "malformed-size", type: "PDF", size: null, unit: "MB", raw: "(PDF, 1.MB)", sizeText: "1.MB", replacement: "" });
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
assert.equal(helpers.acronymDefinitionStyleInText("Medical Services Plan, or MSP", "MSP"), "alternative");
assert.equal(helpers.acronymDefinedInText("Medical Services Plan, or MSP", "MSP"), true);
assert.equal(helpers.acronymDefinitionStyleInText("Medical Services Plan (MSP)", "MSP"), "parenthetical");
assert.equal(helpers.acronymDefinedInText("Choose Medical Services Plan or MSP", "MSP"), false, "Only the explicit comma-or definition pattern should be inferred as a definition");
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
const seenEditorAcronyms = new Set();
assert.equal(helpers.editorAcronymFindingIncluded({ ruleId: "undefined-acronym", flaggedToken: "ZXQ" }, [], seenEditorAcronyms), true);
assert.equal(helpers.editorAcronymFindingIncluded({ ruleId: "undefined-acronym", flaggedToken: "ZXQ" }, [], seenEditorAcronyms), false, "Only the first undefined use across CMS Lite fields should remain");
assert.equal(helpers.editorAcronymFindingIncluded({ ruleId: "undefined-acronym", flaggedToken: "FTA" }, ["Free Trade Agreement (FTA)"], new Set()), false, "A definition in an earlier CMS Lite field should suppress a later undefined-acronym finding");
assert.equal(helpers.editorAcronymFindingIncluded({ ruleId: "time-format", flaggedToken: "PM" }, [], new Set()), true, "Non-acronym findings must pass through the CMS Lite aggregation helper");
assert.equal(helpers.isBcPostalAddressContext("Victoria, BC V8W 9M8", "Victoria, BC V8W 9M8".indexOf("BC")), true);
assert.equal(helpers.isBcPostalAddressContext("People in BC can apply", "People in BC can apply".indexOf("BC")), false);

const ordinaryNumber = helpers.numberSeparatorOccurrences("The program received 15000 applications.");
assert.equal(ordinaryNumber.length, 1);
assert.deepEqual(ordinaryNumber[0], { text: "15000", index: 21, replacement: "15,000" });
assert.equal(helpers.numberSeparatorOccurrences("The year is 2026.").length, 0);
assert.equal(helpers.numberSeparatorOccurrences("The year was 1800.").length, 0);
assert.equal(helpers.numberSeparatorOccurrences("The date was June 15, 1800.").length, 0);
assert.equal(helpers.numberSeparatorOccurrences("Reference ID 15000").length, 0);
assert.equal(helpers.numberSeparatorOccurrences("The grant is $15000.").length, 0);
assert.equal(helpers.numberSeparatorOccurrences("The date is 2019/06/30.").length, 0);
assert.equal(helpers.numberSeparatorOccurrences("Read https://example.gov/item/15000").length, 0);
assert.equal(helpers.numberSeparatorOccurrences("Call #7277 on the Telus Mobility Network.").length, 0, "A hash-prefixed mobile shortcode is not a quantity");
assert.equal(helpers.numberSeparatorOccurrences("The service received 7277 calls.").length, 1, "An ordinary unformatted number must still be checked");
assert.equal(helpers.acronymContextExcluded("The meeting starts at 4:00 pm PT.", "The meeting starts at 4:00 pm PT.".indexOf("PT"), "PT"), true);
assert.equal(helpers.acronymContextExcluded("The PT program is changing.", "The PT program is changing.".indexOf("PT"), "PT"), false);
assert.equal(helpers.acronymContextExcluded("NOTE: apply before Friday.", 0, "NOTE"), true, "NOTE is emphasized wording rather than an acronym");

assert.deepEqual(helpers.missingSpaceAfterSentencePunctuationOccurrences("The road is closed.Consult the engineer."), [{ text: ".C", index: 18, replacement: ". C" }]);
assert.equal(helpers.missingSpaceAfterSentencePunctuationOccurrences("Services are available in B.C. Apply online.").length, 0);
assert.equal(helpers.missingSpaceAfterSentencePunctuationOccurrences("Read https://Example.Gov/Apply before continuing.").length, 0);
assert.equal(helpers.missingSpaceAfterSentencePunctuationOccurrences("Download the file.PDF version.").length, 0);
assert.equal(helpers.missingSpaceAfterSentencePunctuationOccurrences("Email FLNREng.Branch@gov.bc.ca for assistance.").length, 0);
assert.equal(helpers.missingSpaceAfterSentencePunctuationOccurrences("Email First.Last+Alerts@Gov.BC.CA for assistance.").length, 0);
assert.equal(helpers.missingSpaceAfterSentencePunctuationOccurrences("Visit Services.Gov.BC.CA for information.").length, 0);
assert.equal(helpers.missingSpaceAfterSentencePunctuationOccurrences("Download Report.Final.Docx before continuing.").length, 0);
assert.equal(helpers.missingSpaceAfterSentencePunctuationOccurrences("Follow @BCGov.News for updates.").length, 0);
assert.deepEqual(helpers.missingSpaceAfterSentencePunctuationOccurrences("Email FLNREng.Branch@gov.bc.ca for details.Consult the engineer."), [{ text: ".C", index: 42, replacement: ". C" }]);
assert.deepEqual(helpers.missingSpaceAfterSentencePunctuationOccurrences("Email FLNREng.Branch@gov.bc.ca.Consult the engineer."), [{ text: ".C", index: 30, replacement: ". C" }]);
assert.deepEqual(helpers.missingSpaceAfterSentencePunctuationOccurrences("Visit Services.Gov.BC.CA.Consult the guide."), [{ text: ".C", index: 24, replacement: ". C" }]);
assert.deepEqual(helpers.missingSpaceAfterSentencePunctuationOccurrences("Download Report.Final.Docx.Open the file."), [{ text: ".O", index: 26, replacement: ". O" }]);
assert.deepEqual(helpers.missingSpaceAfterSentencePunctuationOccurrences("The file is ready.Open it now."), [{ text: ".O", index: 17, replacement: ". O" }]);

assert.equal(helpers.allCapsHeadingDetails("MULTI-USE LIST REQUEST FOR QUALIFICATIONS - GOODS").text, "MULTI-USE LIST REQUEST FOR QUALIFICATIONS - GOODS");
assert.equal(helpers.allCapsHeadingDetails("BC SPCA"), null, "A short formal acronym heading must remain allowed");
assert.equal(helpers.allCapsHeadingDetails("Contracting opportunities"), null);

assert.equal(helpers.nonBreakingSpaceOccurrences("Apply\u00a0online today.").length, 1);
assert.equal(helpers.nonBreakingSpaceOccurrences("Travel 30\u00a0km today.").length, 0, "A number and measurement unit may intentionally stay together");
assert.equal(helpers.nonBreakingSpaceOccurrences("The file is 1\u00a0MB.").length, 0, "Specific file-size formatting rules should handle a number and unit");
assert.equal(helpers.nonBreakingSpaceOccurrences("Attendance was 10\u00a0%.").length, 0, "A number and percent sign may intentionally stay together");
assert.equal(helpers.nonBreakingSpaceOccurrences("The event is June\u00a015, 2026.").length, 0, "A month and day may intentionally stay together");
assert.equal(helpers.nonBreakingSpaceOccurrences("Mail it to V8W\u00a09M8.").length, 0, "A Canadian postal code may intentionally stay together");
assert.equal(helpers.nonBreakingSpaceOccurrences("Use B.C.\u00a0government guidance.").length, 0, "An abbreviation and following word may intentionally stay together");
assert.equal(helpers.nonBreakingSpaceOccurrences("One\u00a0\u00a0two").length, 0, "Repeated spacing is handled by the double-space rule");

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


// v1.3 regression coverage
assert.equal(helpers.sentences("Follow any of B.C.'s fire prohibitions and restrictions").length, 1);
assert.equal(helpers.sentences("Read B.C.'s campfire regulations (PDF, 1.7MB) poster and continue.").length, 1);
assert.equal(helpers.sentences("Use examples, e.g. a passport, when you apply. Another sentence follows.").length, 2);
assert.equal(helpers.sentences("Use the form, i.e. the current application, when you apply.").length, 1);
assert.equal(helpers.isLikelyTitleCase("1. Executive summary"), false);
assert.equal(helpers.isLikelyTitleCase("2026 Tax Changes"), true);
assert.equal(helpers.isValidTelHref("tel:+18442275422"), true);
assert.equal(helpers.isValidTelHref("tel:+1-844-227-5422"), true);
assert.equal(helpers.isValidTelHref("tel:+442071838750"), true);
assert.equal(helpers.isValidTelHref("tel:911"), true);
assert.equal(helpers.isValidTelHref("tel:*5555"), true);
assert.equal(helpers.isValidTelHref("tel:18442275422"), false);
assert.equal(helpers.assetLabel("Municipal Participation Map (2 MB)").status, "missing-type");
assert.equal(helpers.assetLabel("Guide (PDF)").status, "missing-size");
assert.equal(helpers.doubleSpaceOccurrences("One  two\u00a0\u00a0three").length, 2);
assert.equal(helpers.isMeaninglessAlt("image"), true);
assert.equal(helpers.isMeaninglessAlt("IMG_1234.jpg"), true);
assert.equal(helpers.isMeaninglessAlt("Map of service regions"), false);
assert.equal(helpers.sectionReadingThreshold({ words: 39, sentences: 4, grade: 15 }), null);
assert.equal(helpers.sectionReadingThreshold({ words: 40, sentences: 2, grade: 11.9 }), null);
assert.equal(helpers.sectionReadingThreshold({ words: 40, sentences: 2, grade: 12 }), 12);
assert.equal(helpers.sectionReadingThreshold({ words: 74, sentences: 2, grade: 12 }), 12);
assert.equal(helpers.sectionReadingThreshold({ words: 75, sentences: 2, grade: 9.9 }), null);
assert.equal(helpers.sectionReadingThreshold({ words: 75, sentences: 2, grade: 10 }), 10);
assert.equal(helpers.sectionReadingThreshold({ words: 90, sentences: 1, grade: 16 }), null);
const pubicPageException = { id: "p-1", ruleId: "proofreading-pubic", phrase: "Pubic", domain: "example.com", page: "https://example.com/page" };
assert.equal(helpers.exceptionMatches(pubicPageException, "proofreading-pubic", "pubic health", "example.com", "https://example.com/page#section"), true);
assert.equal(helpers.exceptionMatches(pubicPageException, "proofreading-pubic", "pubic health", "example.com", "https://example.com/other"), false);


// v1.3 testing-correction helper coverage
const centredEvidence = helpers.excerptAroundMatch(
  "Start text BCeID stays valid while a much later formal name uses BC Online for the service.",
  "Start text BCeID stays valid while a much later formal name uses BC Online for the service.".indexOf("BC Online"),
  "BC",
  55
);
assert.equal(centredEvidence.text.slice(centredEvidence.matchIndex, centredEvidence.matchIndex + 2), "BC");
assert.equal(centredEvidence.text.indexOf("BC Online"), centredEvidence.matchIndex);
assert.equal(helpers.indexInsideUrl("Read https://example.com/and/or/index", "Read https://example.com/and/or/index".indexOf("and/or")), true);
assert.equal(helpers.indexInsideUrl("Choose and/or apply", "Choose and/or apply".indexOf("and/or")), false);
assert.equal(helpers.isWifiVariant("WIFI"), true);
assert.equal(helpers.isWifiVariant("Wi-Fi"), false);
assert.equal(helpers.acronymContextExcluded("In CMS Lite, add an anchor.", 3, "CMS"), true);
assert.equal(helpers.acronymContextExcluded("The CMS renewal begins this year.", 4, "CMS"), false);
[
  "Monday-Friday", "9 am - 5 pm", "9:00 A.M. – 4:30 P.M.", "12 noon – 1:00 PM", "9 a.m. – noon", "midnight – 6:30 a.m.",
  "May 1-June 2", "May 1-5", "2019-2020", "sections 3-5", "5%-10%", "5°C-10°C", "123 - 456"
].forEach(value => assert.ok(helpers.rangeDashOccurrences(value).length, `Expected range: ${value}`));
["2020-21", "1-800-663-7867", "2026-08-27", "Unit 5 - 123 Main St.", "Case 123 - 456", "192.168.1.1 - 192.168.1.2"].forEach(value => assert.equal(helpers.rangeDashOccurrences(value).length, 0, `Unexpected range: ${value}`));
assert.equal(helpers.dashSeparatorOccurrences("Ferrets - Do not pet under any circumstances").length, 1);
assert.equal(helpers.dashSeparatorOccurrences("Include a copy – if you cannot provide one").length, 1);
assert.equal(helpers.dashSeparatorOccurrences("Mental Health Services – Northern Health").length, 0);
assert.equal(helpers.dashSeparatorOccurrences("backyard Hen Form – Part A – Section 1").length, 0);
assert.equal(helpers.dashSeparatorOccurrences("x - y = 3").length, 0);
assert.equal(helpers.dashSeparatorOccurrences("Case 123 - 456").length, 0);
assert.equal(helpers.dashSeparatorOccurrences("192.168.1.1 - 192.168.1.2").length, 0);
assert.equal(helpers.dashSeparatorOccurrences("Mental Health Services - Northern Health").length, 1);
for (const value of ["9:00 A.M. – 4:30 P.M.", "12 noon – 1:00 PM", "9 a.m. – noon", "midnight – 6:30 a.m."]) {
  const ranges = helpers.rangeDashOccurrences(value);
  assert.equal(helpers.dashSeparatorOccurrences(value, ranges).length, 0, `Time range must not fall through to dash-separator: ${value}`);
}

for (const [input, expected] of [["12:00 pm", "12 pm"], ["1:00 pm", "1 pm"], ["9am", "9 am"], ["9:45PM", "9:45 pm"], ["9 a.m. to 4 p.m.", "9 am"], ["9 A.M. PT", "9 am"]]) {
  assert.equal(helpers.timeFormatOccurrences(input)[0].replacement, expected, input);
}
for (const input of ["9 am", "9 am.", "9:45 pm", "9\u00a0am", "noon", "midnight", "x9am", "9amazing", "13:00", "13 pm", "9:99 pm", "https://example.com/9am"]) {
  assert.equal(helpers.timeFormatOccurrences(input).length, 0, input);
}
const wholeHour = helpers.timeFormatOccurrences("8:30 am to 12:00 pm and 1:00 pm to 4:30 pm");
assert.deepEqual(wholeHour.map(item => item.text), ["12:00 pm", "1:00 pm"]);
assert.deepEqual(wholeHour[0].reasons, ["Remove :00 from this whole-hour time."]);
assert.equal(helpers.timeFormatOccurrences("We close at 9 a.m.")[0].text, "9 a.m", "Keep the sentence full stop outside the changed time");
for (const name of ["100 Mile House", "70 Mile House", "108 Mile Ranch", "150 Mile House", "100 MILE HOUSE", "100\u00a0Mile\u00a0House", "100 Mile House’s residents"]) {
  assert.equal(helpers.imperialUnitOccurrences(name).length, 0, name);
}
assert.deepEqual(helpers.imperialUnitOccurrences("Drive 5 miles from 100 Mile House and carry 20 pounds.").map(item => item.text), ["5 miles", "20 pounds"]);
assert.deepEqual(helpers.imperialUnitOccurrences("100 Mile Houses; 1100 Mile House").map(item => item.text), ["100 Mile", "1100 Mile"]);
assert.equal(helpers.imperialUnitOccurrences("See https://example.com/100miles").length, 0);
assert.equal(helpers.indigenousNameRanges("100 Mile House").length, 0, "A numbered municipality must not be classified as an Indigenous name");

// Identifier exceptions must preserve quantities elsewhere in the same content.
for (const address of [
  "2225 Acadia Rd.", "2225 Acadia Rd", "5800 University Boulevard",
  "5800 WEST UNIVERSITY BOULEVARD", "5800 West University Blvd.",
  "Suite 200, 5800 University Boulevard", "5800 16th Avenue", "5800 Côte-des-Neiges Road"
]) {
  assert.equal(helpers.numberSeparatorOccurrences(address).length, 0, address);
}
const mixedAddresses = "2225 Acadia Rd. and 5800 University Boulevard received 15000 applications.";
assert.deepEqual(helpers.numberSeparatorOccurrences(mixedAddresses).map(item => item.text), ["15000"]);
for (const company of ["1075683 BC Ltd.", "1075683 BC Ltd", "1075683 B.C. LTD.", "1075683\u00a0BC\u00a0Ltd."]) {
  assert.equal(helpers.numberSeparatorOccurrences(company).length, 0, company);
  assert.equal(helpers.numberIdentifierRanges(company).some(range => range.kind === "company"), true);
}
for (const text of ["15000 BC residents", "15000 BC Limitedness", "15000 Main applications", "15000 BC residents on Main Street", "5800 University benefits", "1075683 BC\nLtd.", "5800 University\nBoulevard"]) {
  assert.equal(helpers.numberSeparatorOccurrences(text).length, 1, text);
}
const mixedCompany = "1075683 BC Ltd. received 15000 applications from BC residents.";
assert.deepEqual(helpers.numberSeparatorOccurrences(mixedCompany).map(item => item.text), ["15000"]);
const companyRange = helpers.numberIdentifierRanges(mixedCompany).find(range => range.kind === "company");
assert.equal(mixedCompany.slice(companyRange.start, companyRange.end), "1075683 BC Ltd.");
assert.ok(mixedCompany.lastIndexOf("BC") >= companyRange.end);

// Original UEL email examples plus encoded, malformed and misleading cases.
for (const [href, label] of [
  ["mailto: PlanUEL@gov.bc.ca", "PlanUEL@gov.bc.ca"],
  [" MAILTO:PlanUEL%40gov.bc.ca%20?subject=Question%3F", "planuel@gov.bc.ca"],
  ["mailto:service+help@gov.bc.ca", "service+help@gov.bc.ca"],
  ["mailto:service%2Bhelp@gov.bc.ca", "service+help@gov.bc.ca"],
  ["mailto:first@example.ca, second@example.ca", "first@example.ca,second@example.ca"]
]) {
  const result = helpers.emailLinkComparison(href, label);
  assert.equal(result.invalid, false, href);
  assert.equal(result.matches, true, href);
}
for (const punctuation of [".", ",", ";", ":", "!"]) {
  const result = helpers.emailLinkComparison("mailto:PlanUEL@gov.bc.ca", "PlanUEL@gov.bc.ca" + punctuation);
  assert.equal(result.matches, false);
  assert.equal(result.punctuationOnly, true);
}
for (const [href, label] of [
  ["mailto:other@gov.bc.ca", "PlanUEL@gov.bc.ca."],
  ["mailto:service+help@gov.bc.ca", "service@gov.bc.ca"],
  ["mailto:service%252Bhelp@gov.bc.ca", "service+help@gov.bc.ca"],
  ["mailto:PlanUEL@gov.bc.ca", "PlanUEL\u200b@gov.bc.ca"],
  ["mailto:first@example.ca,second@example.ca", "first@example.ca"]
]) {
  const result = helpers.emailLinkComparison(href, label);
  assert.equal(result.matches, false, href);
  assert.equal(result.punctuationOnly, false, href);
}
for (const href of ["mailto:broken%ZZ@example.ca", "mailto:PlanUEL@gov.bc.ca%0D%0ABcc:other@example.ca", "mailto:%00service@example.ca"]) {
  assert.equal(helpers.emailLinkComparison(href, "service@example.ca").invalid, true, href);
}
assert.match(helpers.emailComparisonEvidence("PlanUEL\u200b@gov.bc.ca"), /U\+200B/);
for (const mode of ["normal", "nowrap", "pre-line", "collapse", "preserve-breaks"]) {
  assert.equal(helpers.doubleSpaceOccurrences("For  more information", mode).length, 0, mode);
  assert.equal(helpers.doubleSpaceOccurrences("For\u00a0\u00a0more information", mode).length, 1, mode);
  const mixed = helpers.doubleSpaceOccurrences("For   \u00a0more information", mode)[0];
  assert.equal(mixed.count, 2);
  assert.match(mixed.evidence, /For ⟦2 spaces⟧ more information/);
}
for (const mode of ["pre", "pre-wrap", "break-spaces", "preserve", "preserve nowrap", "preserve-spaces"]) {
  assert.equal(helpers.doubleSpaceOccurrences("For  more information", mode)[0].count, 2, mode);
}


// Time guidance is specific to each occurrence, with stable source offsets.
for (const [source, replacement, reason] of [
  ["8:30am", "8:30 am", "Add a space"],
  ["12:00 pm", "12 pm", "Remove :00"],
  ["1:00 PM", "1 pm", "lower case"],
  ["4 p.m.", "4 pm", "Remove the periods"],
  ["4:00PM", "4 pm", "Add a space"]
]) {
  const issue = helpers.timeFormatOccurrences(source)[0];
  assert.equal(issue.text, source === "4 p.m." ? "4 p.m" : source, "Keep sentence punctuation outside the replacement");
  assert.equal(issue.replacement, replacement);
  assert.ok(issue.reason.includes(reason));
}
for (const source of ["8:30 am to 4:30 pm", "4\u00a0pm", "9 am.", "13 pm", "9:75 am", "0 am", "2019am", "9 amperes"]) {
  assert.equal(helpers.timeFormatOccurrences(source).length, 0, source);
}
const times = "8:30 am to 12:00 pm and 1:00 pm to 4:30 pm";
const timeIssues = helpers.timeFormatOccurrences(times);
assert.deepEqual(timeIssues.map(issue => issue.text), ["12:00 pm", "1:00 pm"]);
for (const issue of timeIssues) {
  assert.equal(times.slice(issue.index, issue.index + issue.text.length), issue.text);
  assert.equal(issue.reason.includes("Add a space"), false);
}
const repeatedTimes = helpers.timeFormatOccurrences("9AM and 9AM");
assert.equal(repeatedTimes.length, 2);
assert.notEqual(repeatedTimes[0].index, repeatedTimes[1].index);
assert.equal(helpers.contrastReviewReason("background image"), "The text appears over a background image.");
assert.equal(helpers.contrastReviewReason("element transparency"), "Transparency affects the colours.");
assert.equal(helpers.contrastReviewReason("unknown future effect"), "The colours could not be measured reliably.");
const privateField = { tagName: "INPUT", value: "PRIVATE DATA", getAttribute: name => name === "type" ? "search" : "PRIVATE ATTRIBUTE" };
assert.equal(helpers.formControlDescription(privateField), "Search field");


// Contextual identifiers: protect the reference, never nearby quantities.
for (const text of [
  "Ministerial order number M294", "ministerial order M294", "Order No. M294",
  "PLAN 5449", "Plan No. 5449", "Plan: 5449", "Plan #5449",
  "Explanatory Plan 3423", "See Plan 5449 for details", "Shown on Order M294",
  "Refer to the plan 5449", "Plan\u00a0No.\u00a05449"
]) {
  const ranges = helpers.labelledIdentifierRanges(text);
  assert.ok(ranges.length, text);
  for (const range of ranges) assert.match(text.slice(range.start, range.end), /^(?:[A-Z]*\d+[A-Z]?)$/i);
  assert.equal(helpers.numberSeparatorOccurrences(text).length, 0, text);
}
for (const text of ["Plan 15000 new homes", "Order 15000 copies", "The plan received 15000 responses", "See the plan for 15000 new homes"]) {
  assert.equal(helpers.numberSeparatorOccurrences(text).length, 1, text);
  assert.equal(helpers.labelledIdentifierRanges(text).length, 0, text);
}
const legalDescription = "THE NORTH 1/2 OF LOT A (EXPLANATORY PLAN 3423) BLOCK 99 DISTRICT LOT 140 PLAN 5449";
assert.equal(helpers.numberSeparatorOccurrences(legalDescription).length, 0);
assert.deepEqual(helpers.numberSeparatorOccurrences("See Plan 5449 for details. It received 15000 responses.").map(item => item.text), ["15000"]);
assert.equal(helpers.labelledIdentifierRanges("An unfamiliar X294 term").length, 0, "Digits alone do not establish an identifier");
for (const text of [
  "5800 University Boulevard, Vancouver BC V6T 24",
  "5800 University Blvd., Vancouver BC",
  "123 Main Street\nNorth Vancouver BC",
  "Suite 200, 5800 University Boulevard\nVancouver BC V6T 24"
]) assert.equal(helpers.isBcPostalAddressContext(text, text.indexOf("BC")), true, text);
for (const text of [
  "People in BC can apply", "Visit 5800 University Boulevard and discuss BC policy",
  "5800 University Boulevard\u2029Vancouver BC V6T 24",
  "5800 University Boulevard\n\nVancouver BC V6T 24",
  "5800 University Boulevard, Vancouver BC residents can apply"
]) assert.equal(helpers.isBcPostalAddressContext(text, text.indexOf("BC")), false, text);
const addressAndProse = "Visit 5800 University Boulevard, Vancouver BC. Services are available to BC residents.";
assert.equal(helpers.isBcPostalAddressContext(addressAndProse, addressAndProse.indexOf("BC")), true);
assert.equal(helpers.isBcPostalAddressContext(addressAndProse, addressAndProse.lastIndexOf("BC")), false);
assert.equal(helpers.isBcPostalAddressContext("BC\u2029V8W 9M8", 0), false, "Excluded content is a hard boundary");
const correction = helpers.alternativeAcronymCorrection("B.C. resident newborns must be enrolled in the Medical Services Plan, or MSP.", "MSP");
assert.equal(correction.text, "Medical Services Plan, or MSP");
assert.equal(correction.replacement, "Medical Services Plan (MSP)");
assert.equal(helpers.acronymDefinedInText("Medical Services Plan, or MSP. MSP is used later.", "MSP"), true);
assert.equal(helpers.alternativeAcronymCorrection("No definition here", "MSP"), null);

console.log("Helper tests passed");
