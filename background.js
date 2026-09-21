"use strict";

const CHECKER_SIDE_PANEL_PATH = "sidepanel.html";
const CMS_LITE_HOSTNAME = "cmslite.gov.bc.ca";

async function configureSidePanel() {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

async function restrictLocalStorageAccess() {
  if (!chrome.storage || !chrome.storage.local || !chrome.storage.local.setAccessLevel) return;
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}

async function configureExtensionSecurity() {
  await Promise.all([configureSidePanel(), restrictLocalStorageAccess()]);
}

async function removeLegacyBroadWebsiteAccess() {
  const origins = ["http://*/*", "https://*/*"];
  const granted = (await Promise.all(origins.map(async origin =>
    await chrome.permissions.contains({ origins: [origin] }).catch(() => false) ? origin : ""
  ))).filter(Boolean);
  if (granted.length) await chrome.permissions.remove({ origins: granted }).catch(() => false);
}

function checkerSidePanelEvent(info) {
  const path = String(info && info.path || "").replace(/^\/+/, "");
  return !path || path === CHECKER_SIDE_PANEL_PATH;
}

async function activeTabForSidePanel(info) {
  if (Number.isInteger(info && info.tabId)) {
    return await chrome.tabs.get(info.tabId).catch(() => null);
  }
  const query = { active: true };
  if (Number.isInteger(info && info.windowId)) query.windowId = info.windowId;
  else query.currentWindow = true;
  const tabs = await chrome.tabs.query(query).catch(() => []);
  return tabs[0] || null;
}

async function minimizeCmsLiteEditors(info) {
  if (!checkerSidePanelEvent(info)) return;
  const tab = await activeTabForSidePanel(info);
  if (!tab || !Number.isInteger(tab.id) || !tab.url) return;

  let url;
  try { url = new URL(tab.url); }
  catch (_) { return; }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== CMS_LITE_HOSTNAME) return;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: () => {
        const controls = Array.from(document.querySelectorAll(".cke_button__bcgovmaximize"));
        let minimized = 0;
        controls.forEach(control => {
          const active = Boolean(
            control.classList.contains("cke_button_on") ||
            String(control.getAttribute("aria-pressed") || "").toLowerCase() === "true" ||
            String(control.getAttribute("title") || "").trim().toLowerCase() === "minimize"
          );
          if (!active || typeof control.click !== "function") return;
          control.click();
          minimized += 1;
        });
        return minimized;
      }
    });
    return Number(results[0] && results[0].result) || 0;
  } catch (_) {
    // Opening and closing the side panel must remain available when the page
    // has not granted access or the active tab changed during the event.
  }
}

if (chrome.sidePanel.onOpened) {
  chrome.sidePanel.onOpened.addListener(info => {
    minimizeCmsLiteEditors(info).catch(() => {});
  });
}

if (chrome.sidePanel.onClosed) {
  chrome.sidePanel.onClosed.addListener(info => {
    minimizeCmsLiteEditors(info).catch(() => {});
  });
}

chrome.runtime.onInstalled.addListener(() => {
  Promise.all([configureExtensionSecurity(), removeLegacyBroadWebsiteAccess()]).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  configureExtensionSecurity().catch(() => {});
});

configureExtensionSecurity().catch(() => {});
