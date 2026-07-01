// service_worker.js
// Popup routing, comparison workflow, panel persistence, and script injection recovery.

import { buildComparisonBenchmark, findTabForUrl } from './comparison-benchmark.js';

const MAX_COMPARE_SITES = 5;
const CONTENT_SCRIPT_FILES = [
  'feature-taxonomy.js',
  'dom-detector.js',
  'heuristic-engine.js',
  'ai-wrapper.js',
  'comparison-manager.js',
  'brief-builder.js',
  'hybrid-schema.js',
  'entitlements.js',
  'export-report.js',
  'floating-panel.js',
  'content.js'
];
const CONTENT_STYLE_FILES = ['floating-panel.css'];
const STORAGE_KEYS = {
  comparisonUrls: 'comparisonUrls',
  panelOpen: 'panelOpen',
  panelMinimized: 'panelMinimized',
  panelPosition: 'panelPosition',
  userSettings: 'userSettings',
  legacyComparisonUrls: 'observeux_comparison_urls'
};

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
  });
}

function getPanelOpenState() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.panelOpen], (result) => {
      resolve(Boolean(result[STORAGE_KEYS.panelOpen]));
    });
  });
}

function setPanelOpenState(isOpen) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.panelOpen]: Boolean(isOpen) }, () => resolve());
  });
}

function isSupportedUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\//i.test(url);
}

function queryAllTabs() {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => resolve(tabs));
  });
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response from tab.' });
    });
  });
}

function shouldInjectScripts(errorText) {
  const text = String(errorText || '').toLowerCase();
  return text.includes('receiving end does not exist') || text.includes('could not establish connection');
}

async function injectContentScripts(tabId) {
  if (typeof tabId !== 'number') return false;
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: CONTENT_STYLE_FILES
    });
  } catch (error) {
    // CSS injection is optional for recovery.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: CONTENT_SCRIPT_FILES
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function openPanelInTabWithRecovery(tabId) {
  const first = await sendMessageToTab(tabId, { type: 'OBSERVEUX_OPEN_PANEL' });
  if (first?.ok) return first;

  if (!shouldInjectScripts(first?.error)) return first;
  const injected = await injectContentScripts(tabId);
  if (!injected) return first;

  return sendMessageToTab(tabId, { type: 'OBSERVEUX_OPEN_PANEL' });
}

async function ensurePanelOpenOnTab(tabId, url) {
  if (typeof tabId !== 'number' || !isSupportedUrl(url)) return;
  const panelOpen = await getPanelOpenState();
  if (!panelOpen) return;

  const maxAttempts = 5;
  const retryDelayMs = 350;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await openPanelInTabWithRecovery(tabId);
    if (response?.ok) return;
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
}

async function getComparisonUrls() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.comparisonUrls, STORAGE_KEYS.legacyComparisonUrls], (result) => {
      const primary = Array.isArray(result[STORAGE_KEYS.comparisonUrls]) ? result[STORAGE_KEYS.comparisonUrls] : [];
      const legacy = Array.isArray(result[STORAGE_KEYS.legacyComparisonUrls])
        ? result[STORAGE_KEYS.legacyComparisonUrls]
        : [];
      const urls = primary.length > 0 ? primary : legacy;
      resolve(urls.slice(0, MAX_COMPARE_SITES));
    });
  });
}

async function collectComparisonSummaries(selectedUrls) {
  const stored = await getComparisonUrls();
  const urls = Array.isArray(selectedUrls) && selectedUrls.length > 0 ? selectedUrls : stored;
  if (urls.length < 2) {
    return { ok: false, message: 'Add at least 2 URLs for comparison.' };
  }

  const tabs = await queryAllTabs();
  const results = [];

  for (const url of urls) {
    const existingTab = findTabForUrl(tabs, url);
    if (!existingTab || typeof existingTab.id !== 'number') {
      results.push({
        url,
        status: 'not-open',
        note: 'Open this URL in a tab, then click Compare Competitors.'
      });
      continue;
    }

    const response = await sendMessageToTab(existingTab.id, { type: 'OBSERVEUX_GET_COMPACT_SUMMARY' });
    if (!response.ok) {
      results.push({
        url,
        status: 'error',
        note: response.error || 'Could not snapshot tab.'
      });
      continue;
    }
    results.push({
      url,
      status: 'ok',
      analysis: response.result
    });
  }

  const benchmark = buildComparisonBenchmark(results);

  return {
    ok: true,
    results,
    summaryText: benchmark.narrative,
    benchmark
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === 'OBSERVEUX_OPEN_PANEL_FROM_POPUP') {
    getActiveTab().then(async (tab) => {
      if (!tab?.id) {
        sendResponse({ ok: false, error: 'No active tab found.' });
        return;
      }
      await setPanelOpenState(true);
      const response = await openPanelInTabWithRecovery(tab.id);
      sendResponse(response);
    });
    return true;
  }

  if (message.type === 'OBSERVEUX_CLOSE_PANEL_FROM_POPUP') {
    getActiveTab().then(async (tab) => {
      if (!tab?.id) {
        sendResponse({ ok: false, error: 'No active tab found.' });
        return;
      }
      await setPanelOpenState(false);
      const response = await sendMessageToTab(tab.id, { type: 'OBSERVEUX_CLOSE_PANEL' });
      sendResponse(response);
    });
    return true;
  }

  if (message.type === 'OBSERVEUX_PANEL_STATE_CHANGED') {
    setPanelOpenState(Boolean(message.open)).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'OBSERVEUX_COMPARE_SITES') {
    collectComparisonSummaries(message.selectedUrls).then((result) => sendResponse(result));
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    ensurePanelOpenOnTab(tabId, tab?.url);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    ensurePanelOpenOnTab(tabId, tab?.url);
  });
});
