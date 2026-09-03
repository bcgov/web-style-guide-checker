"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const requireBrowserTests = process.env.REQUIRE_BROWSER_TESTS === "1";
let chromium;
try { ({ chromium } = require("playwright")); }
catch (error) {
  if (requireBrowserTests) {
    console.error("Browser regression tests require Playwright in strict test mode.");
    console.error(error);
    process.exit(1);
  }
  console.log("Browser regression tests skipped: Playwright package is not installed.");
  process.exit(0);
}

async function scan(page, html, options = {}) {
  await page.setContent(html);
  await page.addScriptTag({ path: path.join(__dirname, "..", "checker-core.js") });
  return page.evaluate(scanOptions => globalThis.BCWebStyleGuideChecker.scanPage(document, {
    scope: "content",
    profile: "standard",
    canControlColour: false,
    ...scanOptions
  }), options);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const contextualH1 = await scan(page, `
    <header><nav><a href="/">Home</a></nav><h1>Feral horse management</h1></header>
    <main><h2 id="overview">Overview</h2><p>This is enough ordinary page content for a scan.</p></main>`);
  assert.equal(contextualH1.issues.some(issue => issue.ruleId === "h1-count"), false);
  assert.equal(contextualH1.pageDetails.headings[0].level, 1);
  assert.equal(contextualH1.pageDetails.headings[0].text, "Feral horse management");

  const namedAnchor = await scan(page, `
    <main><h1>Hours and breaks</h1><p><a href="#jumplinks-0">Overview</a></p>
    <a name="jumplinks-0"></a><h2>Overview</h2><p>Published content.</p></main>`);
  assert.equal(namedAnchor.issues.some(issue => issue.ruleId === "broken-anchor"), false);

  const generatedToc = await scan(page, `
    <main><h1>Feral horse management</h1>
      <div class="generated-jump-links"><div>On this page:</div><ul>
        <li><a href="#overview">Overview</a></li><li><a href="#eligibility">Eligibility</a></li><li><a href="#contact">Contact</a></li>
      </ul></div>
      <h2 id="overview">Overview</h2><p>Overview content.</p>
      <h2 id="eligibility">Eligibility</h2><p>Eligibility content.</p>
      <h2 id="contact">Contact</h2><p>Contact content.</p>
    </main>`);
  assert.equal(generatedToc.issues.some(issue => issue.ruleId === "on-this-page-missing"), false);
  assert.equal(generatedToc.issues.some(issue => issue.ruleId === "on-this-page-format"), false);
  assert.equal(generatedToc.issues.some(issue => issue.ruleId === "on-this-page-links"), false);

  const hiddenCharacterToc = await scan(page, `
    <main><h1>Business records</h1><h2>On this page</h2><ul>
      <li><a href="#start">Start a business</a></li><li><a href="#records">Maintain business records</a></li><li><a href="#close">Close a business</a></li>
    </ul><h2 id="start">Start a business</h2><p>Start here.</p><h2 id="records">\u200bMaintain business records</h2><p>Keep records.</p><h2 id="close">Close a business</h2><p>Close it.</p></main>`);
  assert.equal(hiddenCharacterToc.issues.some(issue => issue.ruleId === "on-this-page-links"), false);

  const wrappedCmsToc = await scan(page, `
    <main class="topicMain__container"><h1>Grammar, spelling and tone</h1>
      <p>Write content that is easy to understand by focusing on grammar, spelling and tone.</p>
      <div class="on-this-page-wrapper"><div data-component="heading"><h2>On this page</h2></div><div data-component="links"><ul>
        <li><a href="#grammar">Grammar</a></li><li><a href="#spelling">Spelling and word choice</a></li><li><a href="#tone">Tone</a></li>
      </ul></div></div>
      <h2 id="grammar">Grammar</h2><p>Grammar content.</p>
      <h2 id="spelling">Spelling and word choice</h2><p>Spelling content.</p>
      <h2 id="tone">Tone</h2><p>Tone content.</p>
    </main>`, { profile: "cms-lite" });
  assert.equal(wrappedCmsToc.issues.some(issue => issue.ruleId === "list-introduction"), false);
  assert.equal(wrappedCmsToc.issues.some(issue => issue.ruleId === "on-this-page-missing"), false);
  assert.equal(wrappedCmsToc.issues.some(issue => issue.ruleId === "on-this-page-format"), false);
  assert.equal(wrappedCmsToc.issues.some(issue => issue.ruleId === "on-this-page-links"), false);

  const cmsTocWithLaterAnchor = await scan(page, `
    <main class="topicMain__container"><h1>Sign standards</h1><div id="body">
      <h2>On this page</h2><ul>
        <li><a href="#coating">Anti-graffiti coating</a></li><li><a href="#orders">Standard sign order forms</a></li><li><a href="#radio">Radio signage</a></li>
      </ul><h2 id="coating">Anti-graffiti coating</h2><p>Details.</p>
      <h2 id="orders">Standard sign order forms</h2><p>See the <a href="#radio">radio signage forms</a>.</p>
      <h2 id="radio">Radio signage</h2><p>Details.</p>
    </div></main>`, { profile: "cms-lite" });
  assert.equal(cmsTocWithLaterAnchor.issues.some(issue => issue.ruleId === "on-this-page-links"), false, "A later in-page link outside the On this page list must not inflate its link count");

  const authoredTocLabel = await scan(page, `
    <main><h1>Service information</h1><p>On this page:</p><ul>
      <li><a href="#overview">Overview</a></li><li><a href="#eligibility">Eligibility</a></li><li><a href="#contact">Contact</a></li>
    </ul><h2 id="overview">Overview</h2><p>Overview content.</p><h2 id="eligibility">Eligibility</h2><p>Eligibility content.</p><h2 id="contact">Contact</h2><p>Contact content.</p></main>`);
  assert.equal(authoredTocLabel.issues.some(issue => issue.ruleId === "on-this-page-format"), true);

  const assetSpacing = await scan(page, `
    <main><h1>Employment guidance</h1><p><a href="/guide.pdf">Code of employment practice [PDF, 271 KB]</a></p></main>`);
  assert.equal(assetSpacing.issues.some(issue => issue.ruleId === "file-link-size-spacing"), true);
  assert.equal(assetSpacing.issues.some(issue => issue.ruleId === "file-link-label"), false);
  assert.equal(assetSpacing.issues.find(issue => issue.ruleId === "file-link-size-spacing").replacement, "271KB");

  const malformedAssetLabel = await scan(page, `
    <main><h1>Conservation surcharges</h1><p><a href="/guide.pdf">Guidelines for angling (PDF 159 KB)</a></p></main>`);
  assert.equal(malformedAssetLabel.issues.some(issue => issue.ruleId === "file-link-label-format"), true);
  assert.equal(malformedAssetLabel.issues.some(issue => issue.ruleId === "file-link-label"), false);
  assert.equal(malformedAssetLabel.issues.find(issue => issue.ruleId === "file-link-label-format").replacement, "(PDF, 159KB)");

  const safeAcronymContexts = await scan(page, `
    <main><h1>Application information</h1>
      <p>Core HR responsibilities are included.</p>
      <p>Download the application (DOCX, 162KB).</p>
      <p>The Class II section opens in June.</p>
      <address>Wildlife Branch PO Box 9363 STN PROV GOVT Victoria, B.C. V8W 9M8</address>
    </main>`);
  ["HR", "DOCX", "II", "STN", "PROV", "GOVT"].forEach(token => {
    assert.equal(safeAcronymContexts.issues.some(issue => issue.ruleId === "undefined-acronym" && issue.flaggedToken === token), false, `${token} should not be treated as an undefined acronym here`);
  });

  const acronymDefinitions = await scan(page, `
    <main><h1>Export agreements</h1>
      <p>Canada has several Free Trade Agreements (FTAs).</p>
      <p>Recreation Sites and Trails B.C. (RSTBC) manages public recreation sites.</p>
    </main>`);
  assert.equal(acronymDefinitions.issues.some(issue => issue.ruleId === "undefined-acronym" && ["FTA", "FTAs", "RSTBC"].includes(issue.flaggedToken)), false);

  const exactAcronymHighlight = await scan(page, `
    <main><h1>Protect intellectual property</h1>
      <p>Canadian Intellectual Property Office (CIPO) offers IP tools and resources.</p>
    </main>`);
  const ipFinding = exactAcronymHighlight.issues.find(issue => issue.ruleId === "undefined-acronym" && issue.flaggedToken === "IP");
  assert.ok(ipFinding, "IP should still be reviewed when only CIPO is defined");
  assert.equal(ipFinding.evidence.slice(ipFinding.evidenceMatchIndex, ipFinding.evidenceMatchIndex + 2), "IP");

  const whitespaceChecks = await scan(page, `
    <main><h1>Trail information</h1>
      <p><a href="/manual">Chapter 10 of the Recreation Manual </a></p>
      <p><a href="/map"><span>Download the trail map&nbsp;</span></a></p>
      <p>Recreation Sites &amp;Trails BC manages this service.</p>
    </main>`);
  assert.equal(whitespaceChecks.issues.filter(issue => issue.ruleId === "link-trailing-space").length, 1, "Only the visibly enlarged non-breaking-space link should be reported");
  assert.equal(whitespaceChecks.issues.some(issue => issue.ruleId === "missing-space-after-ampersand"), true);
  assert.equal(whitespaceChecks.issues.some(issue => issue.ruleId === "ampersand"), true);

  const editorialChecks = await scan(page, `
    <main><h1>Business taxes</h1><p>PST applies to some purchases.</p><p>APPLY FOR SUPPORT</p><img src="decorative.png" alt=""></main>`);
  assert.equal(editorialChecks.issues.some(issue => issue.ruleId === "undefined-acronym" && issue.flaggedToken === "PST"), false);
  assert.equal(editorialChecks.issues.some(issue => issue.ruleId === "all-caps"), true);
  assert.equal(editorialChecks.issues.some(issue => issue.ruleId === "image-alt-empty"), true);

  const allowedAcronym = await scan(page, `
    <main><h1>Emergency information</h1><p>TV broadcasts may carry emergency alerts. This paragraph provides enough context for the checker.</p></main>`, {
      exceptions: [{ id: "tv", ruleId: "undefined-acronym", phrase: "TV", domain: "" }]
    });
  assert.equal(allowedAcronym.issues.some(issue => issue.ruleId === "undefined-acronym" && issue.flaggedToken === "TV" && issue.automaticStatus === "ignored"), true);

  const orderedFindings = await scan(page, `
    <main><h1>Page order example</h1><p>Start here; then continue.</p><p>Apply and/or contact the program.</p></main>`);
  const semicolon = orderedFindings.issues.find(issue => issue.ruleId === "semicolon");
  const slash = orderedFindings.issues.find(issue => issue.ruleId === "slash");
  assert.equal(Number.isFinite(semicolon.pageOrder), true);
  assert.equal(semicolon.pageOrder < slash.pageOrder, true);

  const headingOverlap = await scan(page, `
    <main><h1>Conservation Surcharges</h1><h2><strong>Important information</strong></h2><p>Read the details.</p></main>`);
  assert.equal(headingOverlap.issues.filter(issue => issue.ruleId === "heading-title-case" && /Conservation Surcharges/.test(issue.evidence)).length, 1);
  assert.equal(headingOverlap.issues.filter(issue => issue.ruleId === "heading-formatting").length, 1);
  assert.equal(headingOverlap.issues.some(issue => ["bold-block", "bold-link", "italic", "underline"].includes(issue.ruleId) && /Important information/.test(issue.evidence)), false);

  const governmentNames = await scan(page, `
    <main><h1>Government services</h1>
      <p>The Government of British Columbia provides the service.</p>
      <p>The B.C. Government updated the page.</p>
    </main>`);
  assert.equal(governmentNames.issues.filter(issue => issue.ruleId === "government-capitalization").length, 1);
  assert.match(governmentNames.issues.find(issue => issue.ruleId === "government-capitalization").evidence, /B\.C\. Government/);

  const h3JumpLink = await scan(page, `
    <main><h1>Application guide</h1><h2>On this page</h2><ul>
      <li><a href="#overview">Overview</a></li><li><a href="#documents">Documents</a></li><li><a href="#contact">Contact</a></li>
    </ul><h2 id="overview">Overview</h2><p>Overview.</p><h3 id="documents">Documents</h3><p>Documents.</p><h2 id="contact">Contact</h2><p>Contact.</p></main>`);
  const jumpFinding = h3JumpLink.issues.find(issue => issue.ruleId === "on-this-page-links");
  assert.ok(jumpFinding);
  assert.equal(jumpFinding.diagnostics.some(message => /points to H3 “Documents”/.test(message)), true);

  const cmsComponents = await scan(page, `
    <main class="topicMain__container"><h1>CMS Lite content</h1>
      <section id="cmf-ui-supplementary-content"><h2>Help &amp; Support</h2><p>Supplemental authored content.</p></section>
      <section class="accordion"><button aria-expanded="false" aria-controls="answer">Details</button><div id="answer" class="collapse" style="display:none"><h3>Apply &amp;Pay</h3><p>Collapsed authored content.</p></div></section>
    </main>`, { profile: "cms-lite" });
  assert.equal(cmsComponents.issues.some(issue => issue.ruleId === "ampersand" && /Help & Support/.test(issue.evidence)), true);
  assert.equal(cmsComponents.issues.some(issue => issue.ruleId === "missing-space-after-ampersand" && /Apply &Pay/.test(issue.evidence)), true);

  const cmsTemplateNavigation = await scan(page, `
    <main class="topicMain__container"><h1>Planning your visit</h1>
      <div id="cmf-ui-page-navigation"><button><h2 style="text-align:center">More topics</h2></button></div>
      <p style="text-align:center">Authored centred content.</p>
    </main>`, { profile: "cms-lite" });
  assert.equal(cmsTemplateNavigation.issues.some(issue => issue.ruleId === "text-alignment" && /More topics/.test(issue.evidence)), false, "CMS Lite template navigation is not author-controlled content");
  assert.equal(cmsTemplateNavigation.issues.some(issue => issue.ruleId === "text-alignment" && /Authored centred content/.test(issue.evidence)), true, "Authored centred content must remain checkable");

  const malformedToc = await scan(page, `
    <main><h1>Service information</h1><h5>ON THIS PAGE:</h5><ol>
      <li><a href="#a">Wrong A</a></li><li><a href="#b">Wrong B</a></li><li><a href="#c">Wrong C</a></li>
    </ol><h2 id="a">Alpha</h2><p>Text.</p><h2 id="b">Beta</h2><p>Text.</p><h2 id="c">Gamma</h2><p>Text.</p></main>`);
  assert.equal(malformedToc.issues.some(issue => issue.ruleId === "on-this-page-missing"), false);
  assert.equal(malformedToc.issues.some(issue => issue.ruleId === "on-this-page-format"), true);

  const cmsMoreTopics = await scan(page, `
    <main class="topicMain__container"><h1>CMS Lite content</h1><p>Authored content.</p>
      <aside class="sideBar"><h2>MORE TOPICS</h2><ul><li><a href="/one">One</a><ul><li><a href="/two">Two</a><ul><li><a href="/three">Three</a></li></ul></li></ul></li></ul></aside>
    </main>`, { profile: "cms-lite" });
  assert.equal(cmsMoreTopics.issues.some(issue => issue.ruleId === "list-depth"), false);

  await browser.close();
  console.log("Browser regression tests passed");
})().catch(error => {
  if (!requireBrowserTests && /Executable doesn't exist/i.test(String(error && error.message))) {
    console.log("Browser regression tests skipped: Playwright Chromium is not installed.");
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
