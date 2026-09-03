"use strict";

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

chrome.runtime.onInstalled.addListener(() => {
  Promise.all([configureExtensionSecurity(), removeLegacyBroadWebsiteAccess()]).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  configureExtensionSecurity().catch(() => {});
});

configureExtensionSecurity().catch(() => {});
