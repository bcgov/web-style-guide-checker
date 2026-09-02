"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");

const manifest = JSON.parse(read("manifest.json"));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, "1.3.1");
assert.ok(manifest.optional_host_permissions.includes("http://*/*"));
assert.ok(manifest.optional_host_permissions.includes("https://*/*"));

const html = read("sidepanel.html");
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, "Side panel IDs must be unique");
const idSet = new Set(ids);
[...html.matchAll(/\b(?:aria-controls|aria-labelledby)="([^"]+)"/g)].forEach(match => {
  match[1].split(/\s+/).forEach(id => assert.ok(idSet.has(id), `ARIA reference missing ID: ${id}`));
});
[...html.matchAll(/<button\b([^>]*)>/g)].forEach(match => assert.match(match[1], /\btype=/, "Every button must declare its type"));

[
  "severity-filter",
  "filter-panel",
  "open-filter-button",
  "stale-report-banner",
  "permission-dialog",
  "permission-linked",
  "permission-all",
  "permission-revoke",
  "important-filter",
  "review-issues-button",
  "review-back-button",
  "next-issue-type",
  "more-dialog",
  "export-dialog",
  "page-details",
  "note-dialog",
  "download-current-workbook",
  "current-export-preset",
  "current-export-custom",
  "check-links-and-download-current",
  "copy-detailed-findings",
  "batch-check-links",
  "batch-export-preset",
  "batch-export-custom",
  "sort-order",
  "follow-page",
  "manual-review",
  "feedback-header-button",
  "feedback-view",
  "feedback-dialog",
  "feedback-list",
  "link-check-shortcut",
  "link-check-shortcut-status",
  "stale-report-title",
  "stale-report-message",
  "stale-rescan-button",
  "create-feedback-email",
  "copy-feedback-report",
  "export-feedback-csv"
].forEach(id => assert.ok(ids.includes(id), `Missing required control: ${id}`));

const reviewTabs = [...html.matchAll(/data-review-view="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(reviewTabs, ["review", "details"]);

const script = read("sidepanel.js");
const cacheBlock = script.match(/function cacheElements\(\) \{([\s\S]*?)\.forEach\(id/);
assert.ok(cacheBlock, "Element cache must be readable by the static test");
const cachedReferences = [...cacheBlock[1].matchAll(/"([a-z][a-z0-9-]+)"/g)].map(match => match[1]);
cachedReferences.forEach(id => assert.ok(ids.includes(id), `Element cache references missing ID: ${id}`));
const staticReferences = [...script.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map(match => match[1]);
staticReferences.forEach(id => assert.ok(ids.includes(id), `JavaScript references missing ID: ${id}`));
const elementReferences = [...script.matchAll(/elements\[["']([^"']+)["']\]/g)].map(match => match[1]);
elementReferences.forEach(id => assert.ok(ids.includes(id), `JavaScript element reference missing ID: ${id}`));
assert.doesNotMatch(script, /slice\(0,\s*100\)/, "HTTP link checks must not stop at 100 destinations");
assert.match(script, /const credentials = sessionAware \? "include" : "omit"/, "Only explicitly session-aware checks may send existing browser credentials");
assert.match(script, /const TRUSTED_SESSION_HOSTS = new Set\(\[[\s\S]*"intranet\.gov\.bc\.ca"[\s\S]*"intranet\.qa\.gov\.bc\.ca"[\s\S]*"bcgov\.sharepoint\.com"/, "Session-aware checking must use an explicit trusted-host allowlist");
assert.match(script, /TRUSTED_SESSION_SUFFIXES[\s\S]*"\.gww\.gov\.bc\.ca"/, "The authenticated GWW service family must be trusted explicitly");
assert.match(script, /function intranetContentIdResolver\(/, "Legacy intranet content-ID links must use a narrowly scoped resolver");
assert.match(script, /url\.pathname !== "\/intranet\/content"[\s\S]*\^\[a-f0-9\]\{32\}\$/i, "The intranet resolver must accept only the known GUID content route");
assert.match(script, /async function checkIntranetContentIdResolver\([\s\S]*method: "GET"[\s\S]*Range: "bytes=0-0"[\s\S]*credentials: "include"[\s\S]*redirect: "follow"[\s\S]*hostnameFor\(finalUrl\) !== resolver\.host/, "The legacy intranet resolver may follow only its bounded authenticated GET and must accept only the same intranet environment");
assert.match(script, /canUseIntranetResolverSession\(report\)/, "The legacy intranet GET must be limited to trusted B.C. publishing review contexts");
assert.match(script, /trustedPublishingSource[\s\S]*"www2\.gov\.bc\.ca"[\s\S]*"www2\.qa\.gov\.bc\.ca"[\s\S]*"intranet\.gov\.bc\.ca"/, "Legacy intranet resolver access from public pages must be limited to known B.C. publishing surfaces");
assert.doesNotMatch(script, /TRUSTED_SESSION_HOSTS[\s\S]{0,300}\*\.gov\.bc\.ca/, "Session-aware checking must not trust every B.C. government subdomain");
assert.match(script, /function authenticationRedirectHost\(/, "Authentication redirects must be recognized without storing full sign-in URLs");
assert.match(script, /function looksLikeAuthenticationRedirect\(/, "Redirects to clear sign-in paths must not be reported as ordinary working links");
assert.match(script, /function checkWithCurrentPageSession\(/, "Same-origin internal links must support checking with the already-open page session");
assert.match(script, /parsed\.origin !== startingOrigin/, "Page-session checks must be restricted to the current page origin");
assert.match(script, /allowGetFallback: false/, "Signed-in verification must not automatically fall back to a GET request");
assert.match(script, /redirect:\s*"manual"/, "Remote checks must handle redirects deliberately");
assert.match(script, /fetchRemoteFollowingRedirects/, "Remote checks must attempt permitted redirect chains before falling back to manual handling");
assert.match(script, /if \(!allowGetFallback \|\| sessionAware\) throw error;[\s\S]*return rangedGet\(\);/, "Anonymous link checks must retry a bounded GET when a public HEAD request fails, without extending that fallback to signed-in checks");
assert.match(script, /!sessionAware && isManualRedirect\(response\)[\s\S]*rangedGet\(\)/, "Anonymous link checks must retry a bounded GET when HEAD itself produces an unresolved redirect");
assert.match(script, /Redirect could not be verified/, "Unverified redirects must be reported as uncertainty rather than a broken link");
assert.match(script, /function qaProductionEquivalent\(/, "QA destinations must support matching live-address checks");
assert.match(script, /www2\.qa\.gov\.bc\.ca/, "QA hostname handling must be explicit");
assert.match(script, /www2\.gov\.bc\.ca/, "Public QA checks must map to the live B.C. hostname");
assert.match(script, /function publicCmsEnvironmentPair\([\s\S]*publicQaReviewContext\(sourcePageUrl\)[\s\S]*www2\.qa\.gov\.bc\.ca[\s\S]*www2\.gov\.bc\.ca/, "Public CMS Lite editor and QA reviews must construct explicit QA/live destination pairs");
assert.match(script, /function publicQaCmsDestination\([\s\S]*www2\.qa\.gov\.bc\.ca/, "Signed-in public QA checking must use an explicit QA-host predicate");
assert.match(script, /\(\?:gov\|assets\)/, "Signed-in public QA checking must be limited to CMS content and asset routes");
assert.match(script, /function checkPublicQaWithCurrentAccess\(/, "Public QA must have a dedicated current-access checker");
assert.match(script, /checkPublicQaWithCurrentAccess[\s\S]*Range: "bytes=0-0"[\s\S]*credentials: "include"/, "The public QA checker may use only a bounded signed-in GET fallback");
assert.match(script, /checkPublicQaWithCurrentAccess[\s\S]*hostnameFor\(finalUrl\) !== "www2\.qa\.gov\.bc\.ca"/, "The public QA checker must reject final destinations outside the QA publishing host");
assert.match(script, /publicQaPageSession[\s\S]*hostnameFor\(sourceUrl\) === "www2\.qa\.gov\.bc\.ca"[\s\S]*publicQaCmsDestination\(value\)/, "An open QA page must be able to verify same-origin QA links with its current session");
assert.match(script, /link\.qaFamily === "public" && link\.qaLive[\s\S]*checkPublicQaWithCurrentAccess[\s\S]*checkRemoteUrl\(link\.liveUrl[\s\S]*combinedPublicQaResult/, "Public QA-family links must verify QA with the appropriate QA access and verify live separately");
assert.match(script, /intranet\.qa\.gov\.bc\.ca[\s\S]*intranet\.gov\.bc\.ca/, "Intranet QA checks must map explicitly to the live intranet hostname");
assert.match(script, /qa-live-unverified/, "Intranet QA links must distinguish a working QA destination from an unverified live destination");
assert.match(script, /session-unverified/, "Authenticated destinations must preserve uncertainty rather than being treated as broken");
assert.match(script, /result\.status === "session-ok"[\s\S]*Verified using/, "Only successful current-session checks may display a verified-with-current-access message");
assert.match(script, /function remoteLinkKey\(/, "QA and live destinations must use a stable environment-aware deduplication key");
assert.match(script, /link\.qaFamily \? link\.href : \(link\.checkUrl \|\| link\.href\)/, "QA destinations must not collapse into an explicit live link with the same path");
assert.match(script, /function prepareRemoteLink\(/, "Network checks must filter fragment and non-web links before fetching");
assert.match(script, /rawHref\.startsWith\("#"\)/, "In-page fragment links must not be network checked");
assert.match(script, /Check whether links work/, "Link-check interface must use plain-language wording");
assert.match(script, /live-not-found/, "QA link checks must distinguish a missing live equivalent");
assert.match(script, /sign-in/, "Network checks must distinguish destinations that may require sign-in");
assert.match(script, /const LINK_RESULT_GROUPS = \[[\s\S]*key: "problems"[\s\S]*key: "review"[\s\S]*key: "working"/, "Link results must be grouped into Problems, Needs review and Working sections");
assert.match(script, /label: "Working", statuses: \["session-ok", "ok"\]/, "Anonymous and current-session successes must share one Working result bucket");
assert.doesNotMatch(script, /opensByDefault/, "Link-result accordions must not open automatically");
assert.match(script, /Available in QA and live/, "Successful QA/live links must use an environment-status label rather than an authentication label");
assert.match(script, /Could not verify automatically/, "Authenticated uncertainty must be described as an automatic-check limitation");
assert.match(script, /link-result-category-toggle/, "Each link-result category must provide an expand/collapse-all control");
assert.match(script, /function toggleLinkResultCategory\(button\)/, "Link-result category controls must open or close only their own status accordions");
assert.match(script, /groups\.forEach\(group => \{ group\.open = shouldOpen; \}\)/, "Category expand/collapse must update all status accordions in that category");
assert.doesNotMatch(script, /<details class="link-result-group[^>]*"[^>]*\sopen(?:\s|>)/, "Link-result accordions must remain collapsed by default");
assert.match(script, /function cmsLiteManagedAssetGuid\(/, "CMS Lite managed assets must be recognized by their stable asset ID");
assert.match(script, /assets\\\/download[\s\S]*\[a-f0-9\]\{32\}/i, "CMS Lite managed asset recognition must be limited to the GUID download route");
assert.match(script, /function cmsLiteAssetPublishingFamily\(/, "CMS Lite asset resolution must identify public and intranet publishing families");
assert.match(script, /assets\\\/gov[\s\S]*return "public"[\s\S]*assets\\\/intranet[\s\S]*return "intranet"/, "Resolved CMS Lite asset paths must map explicitly to public or intranet publishing");
assert.match(script, /function cmsLiteAssetEnvironmentUrls\(/, "CMS Lite asset IDs must map to QA and live environment URLs");
assert.match(script, /www2\.qa\.gov\.bc\.ca\/assets\/download[\s\S]*www2\.gov\.bc\.ca\/assets\/download/, "Public CMS Lite assets must keep the same asset ID in QA and live");
assert.match(script, /intranet\.qa\.gov\.bc\.ca\/assets\/download[\s\S]*intranet\.gov\.bc\.ca\/assets\/download/, "Intranet CMS Lite assets must keep the same asset ID in QA and live");
assert.match(script, /function checkCmsLiteManagedAssetLink\(/, "CMS Lite managed asset link checks must compare publishing environments");
assert.match(script, /function checkCmsLiteManagedAssetSource\(/, "CMS Lite managed assets must have a narrowly scoped editor-session resolver when HEAD is unsupported");
assert.match(script, /checkCmsLiteManagedAssetSource[\s\S]*method: "GET"[\s\S]*Range: "bytes=0-0"/, "CMS Lite managed asset resolution must use only a ranged GET on the known download route");
assert.match(script, /content-range[\s\S]*totalFromRange[\s\S]*contentLength/, "Ranged CMS Lite asset checks must retain the total file size rather than the one-byte response length");
assert.match(script, /cmsLiteManagedAssetGuid\(checkUrl\)[\s\S]*checkCmsLiteManagedAssetSource\(report, checkUrl, 8000\)/, "CMS Lite asset metadata checks must reuse the scoped editor-session resolver");
assert.match(script, /checkCmsLiteManagedAssetSource[\s\S]*parsed\.origin !== location\.origin[\s\S]*assets\\\/download/, "CMS Lite managed asset GETs must remain same-origin and restricted to GUID download routes");
assert.match(script, /function cmsLiteEditorHomeLink\(/, "The open CMS Lite editor must establish access to the CMS Lite home origin without requiring a HEAD request");
assert.match(script, /cmsLiteEditorHomeLink\(report, link\.href\)[\s\S]*combinedStatus: "session-ok"/, "A CMS Lite home link from the open editor must be reported as working");
assert.match(script, /Asset Not Found[\s\S]*The asset cannot be found/, "Managed asset checks must recognize the B.C. government Asset Not Found page");
assert.match(script, /function knownManagedAssetEnvironmentUrl\([\s\S]*www2\.qa\.gov\.bc\.ca[\s\S]*intranet\.gov\.bc\.ca[\s\S]*assets\\\/download/, "Managed-asset response reads must be limited to known B.C. publishing hosts and GUID download routes");
assert.match(script, /cmsLiteEditorSession[\s\S]*report\.settings[\s\S]*editorMode/, "CMS Lite credentials may be used only through the already-open editor session");
assert.doesNotMatch(script, /TRUSTED_SESSION_HOSTS[\s\S]{0,300}"cmslite\.gov\.bc\.ca"/, "CMS Lite must not become a globally trusted authenticated destination");
assert.match(script, /cms-publishing-unverified/, "CMS Lite assets with unknown publication state must remain a review result rather than being called broken");
assert.match(script, /querySelectorAll\("\[data-bc-style-checker-highlight\]"\)/, "Section findings must be able to highlight and clear multiple page blocks");
assert.match(script, /Promise\.all\(Array\.from\(\{ length: Math\.min\(4, links\.length\) \}/, "Link queue must retain limited concurrency");
assert.match(script, /function downloadWorkbook\(/, "Workbook export must be available");
assert.match(script, /function pageReviewProfile\(/, "Exports must derive a page review profile from the findings");
assert.match(script, /function findingDetailRows\(/, "Exports must retain individual finding rows");
assert.match(script, /function issueSummaryRows\(/, "Exports must provide a grouped issue summary");
assert.match(script, /function batchWorkbookSheets\(/, "Batch exports must use the structured audit workbook model");
assert.match(script, /function batchLinkPlan\(/, "Batch link checks must deduplicate destinations across scanned pages");
assert.match(script, /destination\.qaFamily === "public" && destination\.qaLive[\s\S]*checkPublicQaWithCurrentAccess[\s\S]*publicQaLiveRemoteResult/, "Batch link checks must retain public QA/live environment comparison and use QA access only for explicit publishing pairs");
assert.match(script, /async function prepareBatchLinkCheck\(/, "Batch reports must prepare optional link checking after page scans");
assert.match(script, /async function requestBatchLinkAccessAndFinish\(/, "Batch link permission must be requestable from an explicit user action");
assert.match(script, /Resume batch scan/, "Interrupted batch scans must expose a resume action");
assert.match(script, /Workbook downloaded:/, "Completed batch scans must confirm automatic workbook download");
assert.match(script, /function worksheetRelationshipsXml\(/, "Workbook URLs must be represented as real external hyperlinks");
assert.match(script, /relationships\/hyperlink/, "Workbook hyperlink relationships must be emitted");
assert.match(script, /name:\s*"Summary"/, "Batch workbooks must include a Summary sheet");
assert.match(script, /name:\s*"Pages"/, "Batch workbooks must include a Pages sheet");
assert.match(script, /name:\s*"Site-wide findings"/, "Batch workbooks must include a Site-wide findings sheet");
assert.match(script, /Review first/, "Exports must use the agreed attention labels");
assert.match(script, /Nothing flagged/, "Exports must use neutral nothing-flagged language");
assert.doesNotMatch(script, /<pane ySplit=/, "Workbook exports must not freeze panes");
assert.match(html, /Most links are checked without signing in/, "Privacy wording must explain that most link checks do not use sign-in");
assert.match(html, /does not read or store your sign-in information/, "Privacy wording must explain that sign-in information is not read or stored");
assert.match(html, /supported internal sites[\s\S]*current browser access/, "Privacy wording must explain supported signed-in link checks");
assert.match(html, /CMS Lite assets may be checked in CMS Lite, QA and live/, "Privacy wording must explain CMS Lite asset environment checks");
assert.match(html, /asset link[\s\S]*Asset Not Found/, "Privacy wording must disclose the limited managed-asset response read");
assert.match(html, /value="custom">Customize workbook</, "Export presets must keep detailed sheet selection behind a Customize option");
const currentPresetHtml = (html.match(/<select id="current-export-preset">([\s\S]*?)<\/select>/) || [])[1] || "";
assert.match(currentPresetHtml, /<option value="full" selected>Full audit<\/option>[\s\S]*<option value="custom">Customize workbook<\/option>/, "Single-page exports should expose Full audit and Customize workbook presets");
assert.doesNotMatch(currentPresetHtml, /value="standard"|value="summary"/, "Legacy single-page workbook presets must be removed");
assert.doesNotMatch(html, /id="copy-button"|Copy issue summary/, "Single-page exports must not offer the low-value Copy issue summary action");
assert.match(html, /id="download-current-action-csv" class="button tertiary"/, "Download findings CSV must be presented as a button");
assert.match(script, /async function copyCurrentDetailedFindings\(/, "Detailed findings copy action must remain available");
assert.match(script, /const CURRENT_LINK_SENSITIVE_SHEETS = new Set\(\["Summary", "Issue summary", "Findings detail", "Page details", "Links"\]\)/, "Single-page exports must declare which sheets depend on link checking");
assert.match(script, /status\.hidden = !needsLinkCheck/, "Link-check status must be hidden when selected workbook sheets do not use it");
assert.doesNotMatch(html, /id="batch-export-findings"|id="current-export-findings"/, "Legacy checkbox-wall export controls must be removed");
assert.match(script, /function groupedFindingTypes\(/, "Findings must be grouped into a flat issue-type overview");
assert.match(script, /function openRuleGroup\(/, "Issue types must open in the focused review view");
assert.match(script, /function jumpIssueType\(/, "Issue-type navigation must be available");
assert.match(script, /items\.findIndex\(\(finding, index\) => index > state\.guidedIndex && finding\.ruleId !== current\.ruleId\)/, "Skipping must continue with the next issue type in the review sequence");
assert.match(script, /function handleTablistKeys\(/, "Tab lists must support keyboard navigation");
assert.match(script, /auditNotesV1/, "Audit notes must use local extension storage");
assert.match(script, /feedbackNotesV1/, "Feedback notes must use local extension storage");
assert.match(script, /function captureFeedbackContext\(/, "Feedback must capture diagnostic and page context");
assert.match(script, /function feedbackReportText\(/, "Feedback must provide a readable bulk report");
assert.match(script, /function createFeedbackEmail\(/, "Feedback must provide an explicit email-draft action");
assert.match(script, /function downloadTextFile\(/, "Long feedback reports must be downloadable for attachment");
assert.match(script, /julia\.ready@gov\.bc\.ca/, "Julia must receive prepared feedback emails");
assert.match(script, /karmen\.abrahams-munroe@gov\.bc\.ca/, "Karmen must receive prepared feedback emails");
assert.match(script, /Web Style Guide Checker feedback — v/, "Feedback email subjects must use the agreed syntax");
assert.match(script, /document\.body\.dataset\.surface = workspaceSurface/, "Panel and workspace layouts must be explicit");
const decisionFunction = script.match(/async function setDecision\([\s\S]*?\n\}/);
assert.ok(decisionFunction, "Review decision handler must exist");
assert.match(decisionFunction[0], /nextInGroup/, "Review decisions must advance to the next finding");
assert.match(script, /Follow findings on page|follow-page/, "Guided review must expose automatic page following");
assert.match(script, /highlightSelector\(\s*findingSelectors\(finding\),\s*true,\s*false,\s*finding\.editorSource \|\| null,\s*Number\(finding\.editorRegion\) \|\| null\s*\)/, "Automatic page following must preserve the CMS Lite editor source and region without activating another tab");
assert.match(script, /elements\["manual-review"\]\.hidden = section !== "overview"/, "The manual checklist must appear only on the Page details overview");
assert.match(script, /elements\["sort-order"\]\.value === "page"/, "Findings must support page-order sorting");
assert.match(script, /continueAfterAllowedTerm/, "Allowed terms must rebase the active review queue");
assert.match(script, /function orderedReviewFindings\(/, "Guided review must use an explicit continuous review sequence");
assert.match(script, /items\.slice\(\)\.sort\(\(first, second\) =>[\s\S]*first\.pageOrder/, "Page-order review must sort individual findings by document order");
assert.match(html, /<option value="type">By issue type<\/option>/, "The issue-type order label must describe its behaviour");
assert.match(html, /<option value="page">In page order<\/option>/, "The page-order label must describe its behaviour");
assert.match(script, /state\.guidedIndex === 0/, "Previous must remain available until the start of the continuous sequence");
assert.match(script, /chrome\.permissions\.request\(\{ origins \}\)/, "Link checking must request access to linked sites");
assert.match(script, /state:\s*"permission-denied"/, "Declined link access must be reported clearly");
assert.match(script, /savedExceptions\.filter/, "Unsafe saved exceptions must be removed during migration");
assert.match(script, /classList\.toggle\("is-placeholder", hideIssueTypeShortcut\)/, "Finding navigation must retain its layout when the issue-type shortcut is unavailable");
assert.doesNotMatch(script, /<summary>More actions<\/summary>/, "Exact-term actions must remain visible");
assert.match(script, /"Finding ID", "Page", "Page URL", "Where on the page"/, "Detailed finding exports must retain individual evidence and location");
assert.match(script, /"Issue", "Area", "Category", "Review level", "Status", "Findings"/, "Issue summaries must use plain-language grouped columns");
assert.match(script, /function showStaleState\(/, "Saved reports must explain when the source page has been reloaded");
assert.match(script, /function showRescanSettings\(/, "Rescan must return to the scan-options screen before checking again");
assert.match(script, /showCurrentState\("idle"\);[\s\S]{0,120}showScanSettings\(\);/, "Rescan must hide the old findings while scan options are being reviewed");
assert.doesNotMatch(html, /id="change-scan-button"/, "The redundant Change scan scope action must be removed");
assert.match(script, /performance\.timeOrigin/, "Page reload detection must compare document instances");
assert.doesNotMatch(script, /setTimeout\([\s\S]{0,200}data-bc-style-checker-highlight/, "Finding highlights must remain until the reviewer moves or clears them");

assert.ok(manifest.permissions.includes("unlimitedStorage"), "Large resumable batch scans must not be constrained by the default local-storage quota");
const batchPresetHtml = (html.match(/<select id="batch-export-preset">([\s\S]*?)<\/select>/) || [])[1] || "";
assert.match(batchPresetHtml, /<option value="full" selected>Full audit<\/option>[\s\S]*<option value="custom">Customize workbook<\/option>/, "Batch exports should expose Full audit and Customize workbook presets");
assert.doesNotMatch(batchPresetHtml, /value="standard"|value="summary"/, "Legacy batch workbook presets must be removed from the batch workflow");
assert.match(script, /function batchStorageValue\(/, "Batch progress must have a persistable state snapshot");
assert.match(script, /await persistBatchState\(\);[\s\S]{0,220}renderBatchProgress\(\);/, "Batch progress must be saved as page scanning advances");
assert.match(script, /Resume batch scan/, "Interrupted batch scans must provide a resume path");
assert.match(script, /chrome\.permissions\.request\(\{ origins: \["http:\/\/\*\/\*", "https:\/\/\*\/\*"\] \}\)/, "One-step batch link checking must require an explicit all-sites permission request");
assert.match(script, /MAILTO_SAFE_URI_LIMIT = 7000/, "Feedback email batches must use a conservative complete-mailto size ceiling");
assert.doesNotMatch(script, /feedbackEmailSummary|downloadTextFile\(report/, "Feedback email creation must never replace a complete batch with a truncated summary or attachment fallback");
assert.match(html, /I sent it/, "Feedback must require explicit sent confirmation before archiving");
assert.match(html, /data-feedback-copy-mode="unsent"[\s\S]*data-feedback-copy-mode="all"[\s\S]*data-feedback-copy-mode="choose"/, "Copy report must support unsent, all and selected feedback");
assert.match(script, /name: "Page issue summary"/, "Batch workbook must use the clearer Page issue summary sheet name");
const batchMetadataHeader = (script.match(/const BATCH_METADATA_HEADER = \[([\s\S]*?)\];/) || [])[1] || "";
assert.doesNotMatch(batchMetadataHeader, /Canonical URL/, "Batch metadata must not include the redundant Canonical URL column");
assert.doesNotMatch(script, /"Page order", "Where on the page"/, "Findings detail must not expose the internal Page order column");
const findingDetailHeader = (script.match(/const FINDING_DETAIL_HEADER = \[([\s\S]*?)\];/) || [])[1] || "";
assert.doesNotMatch(findingDetailHeader, /Who can fix it|Page order/, "Findings detail must not expose internal page order or low-value ownership columns");

const core = read("checker-core.js");
assert.match(core, /const RULE_VERSION = "1\.3\.0"/);
assert.match(core, /‘BC’ by itself cannot be allowed/, "Bare BC must be rejected as an allowed term");
assert.match(core, /function isCmsLiteTemplateImage\(/, "CMS Lite template images must be identifiable");
assert.match(core, /pageOrder:/, "Findings must retain document order");
assert.match(core, /evidenceMatchIndex:/, "Displayed evidence must retain the highlighted match position after excerpting");
assert.match(core, /selectors:/, "Findings must support multi-block section locations");
assert.match(core, /shouldFlagReadingGrade\(grade\)/, "Reading-level findings must use the Grade 9 threshold helper");
assert.doesNotMatch(core, /querySelectorAll\("a\[href\]"\)\)\.filter\(isVisible\)\.slice\(/, "Page audit must retain every visible link");
assert.match(script, /iframe\.cke_wysiwyg_frame/, "CMS Lite editor scanning must discover CKEditor frames");
assert.match(script, /body\.cke_editable/, "CMS Lite editor scanning must target editable CKEditor bodies");
assert.match(script, /editorRegion:\s*index \+ 1/, "Each CMS Lite editor scan must carry a stable editor-region identifier");
assert.match(core, /const editorRegion = Number\(options\.editorRegion\) \|\| null/, "Core findings must receive the CMS Lite editor-region identifier before fingerprinting");
assert.match(core, /if \(editorRegion\) parts\.push\(`editor-\$\{editorRegion\}`\)/, "CMS Lite findings in different editor regions must have distinct fingerprints");
assert.match(core, /options\.pageUrlOverride/, "CMS Lite editor scans must use the outer page URL for stable page-scoped identity");
assert.match(script, /"broken-anchor"[\s\S]*"undefined-acronym"/, "Checks that require cross-editor page context must be deferred in CMS Lite editor mode");
assert.match(script, /instanceId:\s*String\(performance\.timeOrigin \|\| ""\)/, "CMS Lite editor reports must retain the outer page instance for stale-report detection");
assert.match(script, /metadata:\s*\{\s*unavailable:\s*true,\s*reason:\s*"cms-lite-editor"/, "CMS Lite editor reports must mark page-level metadata as unavailable rather than missing");
assert.match(script, /url\.hostname\.toLowerCase\(\) !== "cmslite\.gov\.bc\.ca"[\s\S]*url\.hostname = "gov\.bc\.ca"/, "CMS Lite editor links must resolve to their published gov.bc.ca address");
assert.match(script, /const targetDocument = documentFor\(item\)/, "Page overlays must resolve items inside the correct CMS Lite editor document");
assert.doesNotMatch(script, /[\u00C2\u00E2\u00C3]/, "Side panel source must not contain UTF-8 mojibake markers");
[
  "file-link-size-spacing",
  "file-link-label-format",
  "link-trailing-space",
  "missing-space-after-ampersand",
  "bold-link",
  "all-caps",
  "at-symbol",
  "image-alt-empty"
].forEach(rule => assert.match(core, new RegExp(`"${rule}"`), `Missing rule: ${rule}`));
["government-capitalization", "moved-page-notice", "heading-dash", "heading-parentheses", "heading-colon-case", "heading-empty-sequence", "image-alt-length", "image-alt-prefix", "time-zone", "currency-cents", "canadian-spelling", "canadian-spelling-context", "list-introduction", "file-link-type", "file-link-size", "split-link", "dash-separator", "wifi-format", "fake-list", "image-alt-meaningless", "proofreading-pubic", "proofreading-repeat", "section-reading-level", "section-heading-density"].forEach(rule => {
  assert.match(core, new RegExp(`"${rule}"`), `Missing updated-guide rule: ${rule}`);
});
assert.match(core, /function isOnThisPageList\(/, "List-introduction checks must reuse structural On this page recognition");
assert.match(core, /function isMeaningfulList\(/, "List rules must ignore empty editor markup");
assert.match(script, /async function revealFindingElements\(/, "Show on page must use a testable reveal helper");
assert.match(script, /data-bs-target/, "Show on page must recognize Bootstrap-style accordion triggers");
assert.doesNotMatch(core, /Shorter sections are flagged only at Grade 12 or higher|substantial list item/, "Section readability findings must not expose threshold mechanics");
assert.doesNotMatch(core, /The 200-word threshold is a checker review heuristic|checker uses 200 words/, "Heading-density findings must not expose internal threshold mechanics");
assert.match(core, /sectionFindings\.forEach/, "Difficult sections must remain independent findings when the page-wide grade is high");
assert.match(core, /function comparisonText\(/, "Hidden formatting characters must be ignored during exact heading comparison");
assert.match(core, /function acronymBase\(/, "Plural acronyms must normalize to their base form");
assert.match(core, /function exactTokenIndex\(/, "Flagged acronym positions must use exact token boundaries");
assert.match(core, /contentSignature:/, "Saved reports must retain a source-content signature");
assert.match(core, /instanceId:/, "Saved reports must retain the source document instance");
assert.doesNotMatch(core, /\["accommodation",|\["individual",|\["request",/, "Context-sensitive words must not use unconditional simple-word replacements");
assert.match(core, /SIMPLE_PHRASE_VARIANTS/, "Inflected guide terms must use controlled variants instead of a generic stemmer");
assert.match(core, /\["assistance",\s*"help"\]/, "The guide's assistance → help entry must be included");
assert.match(core, /\["administer",\s*"do"\]/, "The guide's administer → do entry must be included");
["main-landmark", "skip-link-target", "disclosure-state", "broken-image", "staging-url"].forEach(rule => assert.match(core, new RegExp(`"${rule}"`), `Missing structural rule: ${rule}`));

const css = read("sidepanel.css");
assert.match(css, /@font-face\s*\{[\s\S]*BC Sans/);
assert.match(css, /--navy:\s*#013366/i);
assert.match(css, /--gold:\s*#fcba19/i);
assert.match(css, /--gold-focus:\s*#ffc000/i);
assert.match(css, /\.issue-row/);
assert.match(css, /body\[data-surface="workspace"\]/);
assert.match(css, /\.link-result-category\.problems[\s\S]*var\(--fix\)/, "Problem link results must use the error colour family");
assert.match(css, /\.link-result-category\.review[\s\S]*var\(--check\)/, "Review link results must use the warning colour family");
assert.match(css, /\.link-result-category\.working[\s\S]*var\(--success\)/, "Working link results must use the success colour family");
assert.match(css, /\.link-result-category-heading-actions/, "Link-result category headings must lay out expand/collapse controls beside their counts");
assert.match(css, /\.link-result-category-toggle/, "Link-result category expand/collapse controls must have dedicated compact styling");
assert.match(css, /prefers-reduced-motion:\s*reduce/);

["fonts/BCSans-Regular.woff2", "fonts/BCSans-Bold.woff2", "fonts/LICENSE_OFL.txt"].forEach(name => {
  assert.ok(fs.statSync(path.join(root, name)).size > 1000, `Missing or empty bundled asset: ${name}`);
});
["icons/icon-16.png", "icons/icon-32.png", "icons/icon-48.png", "icons/icon-128.png"].forEach(name => {
  assert.ok(fs.statSync(path.join(root, name)).size > 250, `Missing or empty icon: ${name}`);
});

console.log("Static build tests passed");
