"use strict";

let exclusionSelection = null;
let exclusionPickerRunning = false;
let exclusionFontsPromise = null;
let exclusionReviewTab = null;
let exclusionMatchRequest = 0;
let exclusionLiveMatches = null;

// Confirm selectors in the live document; URL scope alone cannot identify an area.
async function refreshExcludedAreaMatches(tab = state.activeTab) {
  const request = ++exclusionMatchRequest;
  const rules = BCReviewExclusions.applicableRules(state.exclusions, tab?.url || "");
  exclusionLiveMatches = null;
  let ids = null;
  try {
    if (!rules.length) ids = [];
    else if (tab?.id && !isCmsLiteEditorUrl(tab.url) && await chrome.permissions.contains({ origins: [originPattern(tab.url)] })) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["review-exclusions.js"] });
      const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, args: [rules, tab.url], func: (saved, url) => {
        if (location.href !== url) return null;
        return saved.filter(rule => BCReviewExclusions.match(document, rule).status === "applied").map(rule => rule.id);
      } });
      ids = results[0]?.result ?? null;
    }
  } catch (_) { /* Without access, do not claim that saved selectors match. */ }
  if (request !== exclusionMatchRequest) return;
  exclusionLiveMatches = { tabId: tab?.id, url: tab?.url, ids };
  if (tab?.id === state.activeTab?.id && tab?.url === state.activeTab?.url) {
    const matching = rules.filter(rule => ids?.includes(rule.id));
    elements["exclusion-settings-summary"].textContent = ids === null && rules.length
      ? "Allow access to this page to check saved areas."
      : matching.length ? `${matching.length} area${matching.length === 1 ? "" : "s"} found on this page` : "No saved areas found on this page.";
    elements["exclusion-settings-areas"].innerHTML = matching.reverse().map(rule => `<li data-exclusion-id="${escapeHtml(rule.id)}"><button type="button" class="text-button" data-exclusion-action="show" aria-label="${escapeHtml(`Show ${rule.name} on page`)}">${escapeHtml(rule.name)}</button></li>`).join("");
  }
  if (elements["exclusions-dialog"].open) renderExclusionsList();
}

function exclusionIdentity(locator) {
  return locator.elementName || (locator.selector.startsWith("#") ? `${locator.tag.toLowerCase()}${locator.selector}` : locator.tag.toLowerCase());
}

function renderExclusionSettings() {
  const api = globalThis.BCReviewExclusions;
  if (!api || !elements["exclusion-settings-summary"]) return;
  const url = state.activeTab && state.activeTab.url || "";
  elements["excluded-areas-data-count"].textContent = `${(state.exclusions || []).length} saved`;
  elements["clear-excluded-areas"].disabled = !(state.exclusions || []).length;
  const enabled = !isCmsLiteEditorUrl(url) && elements["exclude-areas"].checked;
  elements["exclusion-scan-options"].hidden = !enabled;
  elements["exclude-areas"].setAttribute("aria-expanded", String(enabled));
  elements["exclusion-settings-areas"].innerHTML = "";
  elements["exclusion-settings-summary"].textContent = "Checking saved areas…";
  refreshExcludedAreaMatches(elements["exclusions-dialog"].open ? exclusionReviewTab : state.activeTab);
  const batch = state.batch;
  const locked = batch.running || batchHasIncompletePageScan() || batch.phase === "link-permission";
  const useExclusions = locked ? (batch.settings.useExclusions ?? Boolean(batch.settings.exclusions?.length)) : elements["batch-use-exclusions"].checked;
  if (locked) elements["batch-use-exclusions"].checked = useExclusions;
  elements["batch-exclusion-summary"].textContent = locked
    ? useExclusions ? "Saved areas are skipped where found. This batch keeps the settings it started with." : "This batch reviews all areas. It keeps the settings it started with."
    : useExclusions ? "Skip saved areas where they are found. Pages without matching areas are reviewed normally." : "Review all areas, including any saved excluded areas.";
  const report = state.activeReport, outcomes = report && report.settings.exclusions || [];
  const applied = outcomes.filter(result => result.status === "applied").length;
  const problem = outcomes.filter(result => ["ambiguous", "changed"].includes(result.status)).length;
  const included = Boolean(report && report.settings.includeExcludedAreas);
  const changed = Boolean(report && (included ? report.settings.includedExclusionRevision || "" : report.settings.exclusionRevision || "") !== api.revision(included || enabled ? state.exclusions : [], report.page.url));
  const empty = Boolean(report && report.settings.emptyReviewScope);
  const relevant = Boolean(report && !report.settings.editorMode && !included && outcomes.length);
  elements["exclusion-report-summary"].hidden = !relevant || !applied;
  elements["optional-exclusions-summary"].hidden = !report || !excludedOptionalCheckLabels(report).length;
  if (report) elements["optional-exclusions-summary"].innerHTML = excludedOptionalCheckLabels(report).length ? `<strong>Excluded from this scan:</strong> ${escapeHtml(excludedOptionalCheckLabels(report).join(", "))}.` : "";
  elements["manage-report-exclusions"].textContent = `Excluded areas (${applied})`;
  elements["manage-report-exclusions"].setAttribute("aria-label", `Manage excluded areas. ${applied} applied to this saved review.`);
  const warning = [empty ? "No content remains in the selected review area." : "", problem ? `${problem} exclusion${problem === 1 ? " needs" : "s need"} a new selection; that content was reviewed.` : "", changed ? "Excluded areas changed. Rescan to update these results." : ""].filter(Boolean).join(" ");
  elements["exclusion-report-text"].textContent = warning;
  elements["exclusion-report-text"].hidden = !relevant || !warning;
  if (elements["exclusions-dialog"].open) renderExclusionsList();
}

function renderExclusionsList() {
  const api = BCReviewExclusions, rules = api.normalizeRules(state.exclusions).reverse();
  const list = elements["exclusions-list"], focused = document.activeElement;
  const focusId = focused && focused.closest("[data-exclusion-id]")?.dataset.exclusionId, focusAction = focused && focused.dataset.exclusionAction;
  const opened = new Set(Array.from(list.querySelectorAll("details[open]")).map(item => item.dataset.exclusionGroup || item.dataset.exclusionDetails));
  const page = api.webUrl(exclusionReviewTab && exclusionReviewTab.url);
  const report = state.activeReport;
  const outcomes = report && api.webUrl(report.page.url)?.href === page?.href ? report.settings.exclusions || [] : [];
  elements["exclusions-page-address"].textContent = page ? page.href : "Open a webpage to choose or show areas.";
  elements["choose-exclusion"].disabled = !page || exclusionPickerRunning || (state.batch.running && !state.batch.paused);
  const groups = { matching: [], missing: [], pages: [], sites: [], off: [] };
  const confirmed = exclusionLiveMatches && exclusionLiveMatches.tabId === exclusionReviewTab?.id && exclusionLiveMatches?.url === exclusionReviewTab?.url ? exclusionLiveMatches.ids : null;
  elements["show-all-exclusions"].disabled = !confirmed?.length;
  rules.forEach(rule => {
    const sameSite = page && page.origin === api.webUrl(rule.url).origin;
    const onPage = page && api.applies({ ...rule, enabled: true }, page.href);
    const key = !rule.enabled ? "off" : onPage ? (confirmed?.includes(rule.id) ? "matching" : "missing") : sameSite ? "pages" : "sites";
    const outcome = outcomes.find(result => result.id === rule.id);
    const status = outcome && ({ applied: "Applied in the saved review", missing: "Area was not found in the saved review", ambiguous: "Several areas matched. Reselect the area.", changed: "The area changed. Reselect the area.", "outside-scope": "Already outside the saved review scope" })[outcome.status];
    const problem = outcome && ["missing", "ambiguous", "changed"].includes(outcome.status);
    const action = (value, label) => `<button type="button" class="text-button" data-exclusion-action="${value}">${label}</button>`;
    groups[key].push(`<article class="exclusion-entry" data-exclusion-id="${escapeHtml(rule.id)}">
      <div class="exclusion-entry-heading"><h3><button type="button" class="text-button exclusion-area-name" data-exclusion-action="${onPage ? "show" : "open"}" aria-label="${escapeHtml(`${onPage ? "Show area" : "Open original page"}: ${rule.name}`)}">${escapeHtml(rule.name)}</button></h3><span>${rule.scope === "site" ? "Website" : rule.scope === "section" ? "Section" : "Page"}${rule.skipLinks ? " · Link checks skipped" : ""}</span></div>
      ${problem ? `<p class="exclusion-match-warning">${escapeHtml(status)}</p>` : ""}
      <div class="inline-actions">${action("edit", "Edit")}${sameSite && !onPage && rule.scope === "page" ? action("copy", "Add to review page") : ""}${action("toggle", rule.enabled ? "Turn off" : "Turn on")}${action("remove", "Remove")}</div>
    </article>`);
  });
  list.innerHTML = `<section class="exclusion-group" aria-labelledby="matching-exclusions-heading"><h3 id="matching-exclusions-heading" class="exclusion-group-heading">For the review page (${groups.matching.length})</h3>${groups.matching.join("") || `<p class="hint">${confirmed ? "No saved areas found on this page." : "Saved areas have not been checked on this page."}</p>`}</section>` +
    [["missing", confirmed ? "Not found on this page" : "Not yet checked on this page"], ["pages", "Other pages on this website"], ["sites", "Other websites"], ["off", "Turned off"]].filter(([key]) => groups[key].length).map(([key, label]) => `<details class="exclusion-group" data-exclusion-group="${key}"${opened.has(key) ? " open" : ""}><summary>${label} (${groups[key].length})</summary><div class="exclusion-group-items">${groups[key].join("")}</div></details>`).join("");
  if (focusId && elements["exclusions-dialog"].open) {
    const entry = Array.from(list.querySelectorAll("[data-exclusion-id]")).find(item => item.dataset.exclusionId === focusId);
    const replacement = entry && Array.from(entry.querySelectorAll("[data-exclusion-action]")).find(item => item.dataset.exclusionAction === focusAction);
    if (replacement) { for (let parent = replacement.parentElement; parent && parent !== list; parent = parent.parentElement) if (parent.tagName === "DETAILS") parent.open = true; }
    (replacement || elements["choose-exclusion"]).focus({ preventScroll: true });
  }
}

async function openExclusionsDialog() {
  if (elements["more-dialog"].open) elements["more-dialog"].close();
  elements["exclusions-status"].textContent = "";
  exclusionReviewTab = await currentReviewTab().catch(() => null);
  renderExclusionsList();
  if (!elements["exclusions-dialog"].open) elements["exclusions-dialog"].showModal();
  await refreshExcludedAreaMatches(exclusionReviewTab);
}

async function refreshExclusionReviewPage() {
  if (!elements["exclusions-dialog"].open || exclusionPickerRunning) return;
  const tab = await currentReviewTab().catch(() => null);
  if (tab?.id !== exclusionReviewTab?.id || tab?.url !== exclusionReviewTab?.url) {
    exclusionReviewTab = tab;
    elements["exclusions-status"].textContent = "";
  }
  await refreshExcludedAreaMatches(tab);
  renderExclusionsList();
}

async function showAllExcludedAreas() {
  try {
    const tab = await currentReviewTab(), api = BCReviewExclusions;
    if (!tab || !isScannableUrl(tab.url)) throw new Error("Open the review page first.");
    if (!await requestPagePermission(tab.url)) throw new Error("Allow access to this page to show excluded areas.");
    exclusionReviewTab = tab;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["review-exclusions.js"] });
    const rules = api.applicableRules(state.exclusions, tab.url);
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, args: [rules], func: saved => saved.filter(rule => BCReviewExclusions.match(document, rule).status === "applied").map(rule => rule.locator.selector) });
    const selectors = results[0]?.result || [];
    if (selectors.length) await highlightSelector(selectors, false, true);
    else await clearPageOverlays();
    renderExclusionsList();
    elements["exclusions-status"].textContent = selectors.length ? `${selectors.length} excluded area${selectors.length === 1 ? "" : "s"} highlighted on the page.${rules.length > selectors.length ? ` ${rules.length - selectors.length} could not be found safely.` : ""}` : "No saved excluded areas could be identified on this page.";
  } catch (error) { elements["exclusions-status"].textContent = readableScanError(error); }
}

async function persistExclusions(rules) {
  const normalized = BCReviewExclusions.normalizeRules(rules);
  await saveKey(STORAGE_KEYS.exclusions, normalized);
  const url = state.activeTab?.url || "";
  const firstArea = !BCReviewExclusions.applicableRules(state.exclusions, url).length && BCReviewExclusions.applicableRules(normalized, url).length;
  state.exclusions = normalized;
  if (firstArea) { elements["exclude-areas"].checked = true; await saveDomainSettings().catch(() => showToast("Area saved. The scan setting could not be saved.")); }
  renderExclusionSettings();
  renderExclusionsList();
}

function loadExclusionFonts() {
  if (!exclusionFontsPromise) exclusionFontsPromise = Promise.all(["Regular", "Bold"].map(async variant => {
    const response = await fetch(chrome.runtime.getURL(`fonts/BCSans-${variant}.woff2`));
    if (!response.ok) throw new Error("BC Sans could not be loaded. Reload the checker and try again.");
    return Array.from(new Uint8Array(await response.arrayBuffer()));
  })).then(([regular, bold]) => ({ "400": regular, "700": bold })).catch(error => { exclusionFontsPromise = null; throw error; });
  return exclusionFontsPromise;
}

function exclusionDraft() {
  return { name: elements["exclusion-name"].value, scope: document.querySelector("input[name='exclusion-scope']:checked").value, skipLinks: elements["exclusion-skip-links"].checked, enabled: elements["exclusion-enabled"].checked };
}

function showExclusionForm(candidate, draft = null) {
  const api = BCReviewExclusions, page = api.webUrl(candidate.pageUrl);
  if (!page || !candidate.locator || !candidate.locator.selector || candidate.locator.selector.length > 1500) throw new Error("That area could not be identified. Reselect the area.");
  exclusionSelection = candidate;
  elements["exclusion-save-heading"].textContent = candidate.existing ? "Edit excluded area" : "Exclude this area";
  elements["exclusion-duplicate-notice"].hidden = !candidate.duplicate;
  elements["exclusion-duplicate-notice"].textContent = candidate.duplicate ? `This area is already saved as “${candidate.existing.name}”. You can update it here.` : "";
  elements["exclusion-enabled-choice"].hidden = !candidate.existing || candidate.existing.enabled;
  elements["exclusion-enabled"].checked = draft && typeof draft.enabled === "boolean" ? draft.enabled : !candidate.existing || candidate.existing.enabled;
  if (elements["exclusions-dialog"].open) elements["exclusions-dialog"].close();
  elements["exclusion-name"].value = draft ? draft.name : candidate.existing ? candidate.existing.name : "";
  elements["exclusion-selection-description"].textContent = exclusionIdentity(candidate.locator);
  elements["exclusion-page-address"].textContent = page.href;
  elements["exclusion-site-address"].textContent = page.origin + "/";
  const scope = draft ? draft.scope : candidate.existing ? candidate.existing.scope === "site" ? "site" : "page" : "site";
  document.querySelector(`input[name='exclusion-scope'][value='${scope}']`).checked = true;
  elements["exclusion-skip-links"].checked = draft ? draft.skipLinks : Boolean(candidate.existing && candidate.existing.skipLinks);
  elements["exclusion-stability-note"].textContent = candidate.existing && candidate.existing.scope === "section" ? "This saved exclusion currently covers a section. Saving replaces that scope with your choice above." : "The checker confirms the area on each page. If it cannot identify the area, the content stays in the review.";
  elements["exclusion-save-status"].textContent = "";
  elements["exclusion-save-rescan"].hidden = !state.activeReport;
  if (!elements["exclusion-save-dialog"].open) elements["exclusion-save-dialog"].showModal();
}

async function chooseExcludedArea(existing = null, draft = null) {
  if (exclusionPickerRunning) return;
  exclusionPickerRunning = true;
  renderExclusionsList();
  let workspaceTab;
  try {
    if (state.batch.running && !state.batch.paused) throw new Error("Pause or finish the batch before choosing an area.");
    const tab = await currentReviewTab();
    if (!tab || !tab.id || !isScannableUrl(tab.url)) throw new Error("Open the webpage you want to review first.");
    if (isCmsLiteEditorUrl(tab.url)) throw new Error("Choose excluded areas on a QA or live page. The CMS Lite editor has a different page structure.");
    if (!await requestPagePermission(tab.url)) throw new Error("Allow access to this page before choosing an area.");
    const fonts = await loadExclusionFonts();
    workspaceTab = workspaceSurface ? await currentTab() : null;
    exclusionPickerRunning = true;
    exclusionSelection = null;
    if (elements["exclusion-save-dialog"].open) elements["exclusion-save-dialog"].close();
    if (elements["exclusions-dialog"].open) elements["exclusions-dialog"].close();
    await clearPageOverlays();
    state.lastReviewTabId = tab.id;
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["review-exclusions.js", "exclusion-picker.js"] });
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, args: [{ fonts, rules: state.exclusions }], func: async options => {
      const selected = await globalThis.BCExclusionPicker.pick(options);
      if (selected) selected.matchingIds = BCReviewExclusions.matchingAreaIds(document, options.rules, selected.locator, selected.pageUrl);
      return selected;
    } });
    const result = results[0];
    if (workspaceTab && workspaceTab.id) await chrome.tabs.update(workspaceTab.id, { active: true });
    if (!result || !result.result) { await openExclusionsDialog(); return; }
    const duplicate = BCReviewExclusions.findDuplicate(state.exclusions, { id: existing?.id, scope: "page", url: result.result.pageUrl, locator: result.result.locator }, result.result.matchingIds);
    const selectedExisting = duplicate || existing;
    showExclusionForm({ ...result.result, tabId: tab.id, documentId: result.documentId, existing: selectedExisting, duplicate: Boolean(duplicate), validate: true }, duplicate ? null : draft);
  } catch (error) {
    if (workspaceTab && workspaceTab.id) await chrome.tabs.update(workspaceTab.id, { active: true }).catch(() => {});
    if (elements["exclusion-save-dialog"].open) elements["exclusion-save-status"].textContent = readableScanError(error);
    else { await openExclusionsDialog(); elements["exclusions-status"].textContent = readableScanError(error); }
  } finally { exclusionPickerRunning = false; renderExclusionsList(); }
}

async function editExcludedArea(rule, copyToPage = false) {
  const tab = await currentReviewTab(), api = BCReviewExclusions;
  const current = api.webUrl(tab && tab.url), source = api.webUrl(rule.sourceUrl || rule.url);
  const sameSite = current && current.origin === source.origin;
  const pageUrl = copyToPage ? current && current.href : rule.scope === "page" ? rule.url : sameSite ? current.href : source.href;
  if (copyToPage && !sameSite) throw new Error("Open another page on this site first.");
  if (copyToPage) {
    if (!await requestPagePermission(tab.url)) throw new Error("Allow access to this page before adding the exclusion.");
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["review-exclusions.js"] });
    const result = await chrome.scripting.executeScript({ target: { tabId: tab.id }, args: [rule], func: saved => globalThis.BCReviewExclusions.match(document, saved).status });
    const draft = { name: rule.name, scope: "page", skipLinks: rule.skipLinks };
    if (result[0]?.result !== "applied") { await chooseExcludedArea(null, draft); return; }
    showExclusionForm({ locator: rule.locator, pageUrl, tabId: tab.id, documentId: result[0].documentId, validate: true, existing: null }, draft);
  } else showExclusionForm({ locator: rule.locator, pageUrl, tabId: sameSite ? tab.id : null, validate: false, existing: rule });
}

async function saveSelectedExclusion(event) {
  event.preventDefault();
  if (!exclusionSelection) return;
  const buttons = Array.from(elements["exclusion-save-form"].querySelectorAll("button"));
  buttons.forEach(button => { button.disabled = true; });
  try {
    const selected = exclusionSelection, api = BCReviewExclusions, draft = exclusionDraft(), page = api.webUrl(selected.pageUrl);
    if (!draft.name.trim()) { elements["exclusion-name"].focus(); throw new Error("Enter a descriptive area name, such as Left navigation panel."); }
    const action = event.submitter && event.submitter.value || "close";
    const rule = { id: selected.existing ? selected.existing.id : crypto.randomUUID(), name: draft.name, enabled: selected.existing ? draft.enabled : true,
      scope: draft.scope, url: draft.scope === "site" ? page.origin + "/" : page.href, sourceUrl: page.href, locator: selected.locator, skipLinks: draft.skipLinks };
    const normalized = api.normalizeRules([rule])[0];
    if (!normalized) throw new Error("This area could not be saved. Reselect the area.");
    let matchingIds = [];
    if (selected.validate) {
      const target = selected.documentId ? { tabId: selected.tabId, documentIds: [selected.documentId] } : { tabId: selected.tabId };
      const results = await chrome.scripting.executeScript({ target, args: [normalized, page.href, state.exclusions], func: (value, expectedUrl, saved) => {
        if (globalThis.BCReviewExclusions.webUrl(location.href)?.href !== expectedUrl) return false;
        return { matched: globalThis.BCReviewExclusions.match(document, value).status === "applied", matchingIds: globalThis.BCReviewExclusions.matchingAreaIds(document, saved, value.locator, expectedUrl) };
      } });
      if (!results[0]?.result?.matched) throw new Error("The page or selected area changed. Select Reselect area to choose it again.");
      matchingIds = results[0].result.matchingIds;
    }
    const duplicate = api.findDuplicate(state.exclusions, normalized, matchingIds);
    const unchangedArea = selected.existing && api.sameArea(selected.existing.locator, normalized.locator) && selected.existing.scope === normalized.scope && selected.existing.url === normalized.url;
    if (duplicate && !unchangedArea) throw new Error(`This area is already saved as “${duplicate.name}”. Edit that exclusion instead of saving another copy.`);
    const reviewTab = action === "rescan" ? await currentReviewTab() : null;
    if (action === "rescan" && (!reviewTab || !api.applies({ ...normalized, enabled: true }, reviewTab.url))) throw new Error("Open a matching page to rescan, or use Save and close.");
    const next = state.exclusions.filter(item => item.id !== normalized.id);
    if (next.length >= api.MAX_EXCLUSIONS) throw new Error("Remove a saved exclusion before adding another.");
    await persistExclusions(selected.existing ? state.exclusions.map(item => item.id === normalized.id ? normalized : item) : [...next, normalized]);
    exclusionSelection = null;
    elements["exclusion-save-dialog"].close();
    if (action === "add") await chooseExcludedArea();
    else if (action === "rescan") { state.lastReviewTabId = reviewTab.id; state.activeTab = reviewTab; await scanCurrentPage(); }
    else if (selected.existing) {
      await openExclusionsDialog();
      elements["exclusions-status"].textContent = "Saved. Rescan matching pages to update their results.";
      const entry = Array.from(elements["exclusions-list"].querySelectorAll("[data-exclusion-id]")).find(item => item.dataset.exclusionId === normalized.id);
      if (entry) { for (let parent = entry.parentElement; parent && parent !== elements["exclusions-list"]; parent = parent.parentElement) if (parent.tagName === "DETAILS") parent.open = true; entry.querySelector('[data-exclusion-action="edit"]').focus(); }
    } else {
      const returnTo = ["manage-exclusions", "manage-report-exclusions", "more-menu-button"].map(id => elements[id]).find(element => element && element.getClientRects().length);
      if (returnTo) returnTo.focus();
      showToast("Excluded area saved. Applies on the next scan.");
    }
  } catch (error) { elements["exclusion-save-status"].textContent = readableScanError(error); }
  finally { buttons.forEach(button => { button.disabled = false; }); }
}

async function handleExclusionAction(event) {
  const button = event.target.closest("[data-exclusion-action]");
  if (!button) return;
  const id = button.closest("[data-exclusion-id]").dataset.exclusionId, rule = state.exclusions.find(item => item.id === id);
  if (!rule) return;
  try {
    const action = button.dataset.exclusionAction;
    if (action === "choose") { await chooseExcludedArea(rule); return; }
    if (action === "edit" || action === "copy") { await editExcludedArea(rule, action === "copy"); return; }
    if (action === "open") {
      const tab = await chrome.tabs.create({ url: rule.sourceUrl || rule.url, active: true });
      state.lastReviewTabId = tab.id;
      exclusionReviewTab = tab;
      renderExclusionsList();
      return;
    }
    if (action === "show") {
      const tab = await currentReviewTab();
      if (!tab || !BCReviewExclusions.applies({ ...rule, enabled: true }, tab.url)) throw new Error("Open a page covered by this exclusion to show the area.");
      if (!await requestPagePermission(tab.url)) throw new Error("Allow access to this page to show the area.");
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["review-exclusions.js"] });
      const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, args: [rule], func: value => globalThis.BCReviewExclusions.match(document, value).status });
      if (results[0]?.result !== "applied") throw new Error("The saved area could not be identified. Select Reselect area to choose it again.");
      await highlightSelector(rule.locator.selector, false, true);
      elements["exclusions-status"].textContent = "Area highlighted on the page.";
      if (!elements["exclusions-dialog"].open) showToast("Area highlighted on the page.");
      return;
    }
    const next = action === "remove" ? state.exclusions.filter(item => item.id !== id) : state.exclusions.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item);
    await persistExclusions(next);
    elements["exclusions-status"].textContent = "Saved. Rescan matching pages to update their results.";
  } catch (error) { elements["exclusions-status"].textContent = readableScanError(error); if (!elements["exclusions-dialog"].open) showToast(readableScanError(error)); }
}

function bindExclusionEvents() {
  elements["exclude-areas"].addEventListener("change", handleSettingsChange);
  elements["exclusion-settings-areas"].addEventListener("click", handleExclusionAction);
  ["manage-exclusions", "manage-report-exclusions", "manage-batch-exclusions", "menu-exclusions"].forEach(id => elements[id].addEventListener("click", openExclusionsDialog));
  elements["clear-excluded-areas"].addEventListener("click", async () => {
    if (!state.exclusions.length || !confirm("Delete all saved excluded areas? Existing reports and batches keep their original coverage. Rescan pages to include these areas again.")) return;
    try { await persistExclusions([]); elements["data-management-status"].textContent = "Saved excluded areas deleted. Rescan matching pages to update their results."; }
    catch (error) { elements["data-management-status"].textContent = readableScanError(error); }
  });
  elements["exclusions-close"].addEventListener("click", () => elements["exclusions-dialog"].close());
  elements["show-all-exclusions"].addEventListener("click", showAllExcludedAreas);
  elements["exclusion-save-close"].addEventListener("click", () => elements["exclusion-save-dialog"].close());
  elements["choose-exclusion"].addEventListener("click", () => chooseExcludedArea());
  elements["exclusions-list"].addEventListener("click", handleExclusionAction);
  elements["exclusion-save-form"].addEventListener("submit", saveSelectedExclusion);
  elements["exclusion-reselect"].addEventListener("click", () => { const selected = exclusionSelection; if (selected) chooseExcludedArea(selected.existing, exclusionDraft()); });
  elements["exclusion-save-cancel"].addEventListener("click", () => elements["exclusion-save-dialog"].close());
  elements["exclusion-save-dialog"].addEventListener("close", () => {
    if (elements["exclusion-save-dialog"].open) return;
    const cancelled = Boolean(exclusionSelection);
    exclusionSelection = null;
    if (cancelled) openExclusionsDialog().then(() => elements["choose-exclusion"].focus());
  });
  chrome.tabs.onActivated.addListener(refreshExclusionReviewPage);
  chrome.tabs.onUpdated.addListener((tabId, change) => {
    if (change.url || change.status === "complete") {
      if (elements["exclusions-dialog"].open) refreshExclusionReviewPage();
      else if (tabId === state.activeTab?.id) refreshExcludedAreaMatches();
    }
  });
  if (chrome.storage.onChanged) chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEYS.exclusions]) return;
    state.exclusions = BCReviewExclusions.normalizeRules(changes[STORAGE_KEYS.exclusions].newValue);
    renderExclusionSettings();
  });
}
