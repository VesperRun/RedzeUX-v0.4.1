// service_worker.js
// Popup routing, comparison workflow, panel persistence, and script injection recovery.

import { buildComparisonBenchmark, compareHost, findTabForUrl, normalizeUrl } from './comparison-benchmark.js';

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

async function snapshotTabWithRecovery(tabId) {
  let response = await sendMessageToTab(tabId, { type: 'OBSERVEUX_GET_COMPACT_SUMMARY' });
  if (response?.ok) return response;

  if (!shouldInjectScripts(response?.error)) return response;
  const injected = await injectContentScripts(tabId);
  if (!injected) return response;

  return sendMessageToTab(tabId, { type: 'OBSERVEUX_GET_COMPACT_SUMMARY' });
}

function mergeCompareUrls(urls, prependUrls = []) {
  const seen = new Set();
  const out = [];
  for (const raw of [...prependUrls, ...urls]) {
    const host = compareHost(raw);
    if (!host || seen.has(host)) continue;
    seen.add(host);
    out.push(normalizeUrl(raw));
  }
  return out;
}

async function collectComparisonSummaries(selectedUrls, senderTabId) {
  const stored = await getComparisonUrls();
  const picked = Array.isArray(selectedUrls) && selectedUrls.length > 0 ? selectedUrls : stored;

  let prepend = [];
  if (typeof senderTabId === 'number') {
    try {
      const senderTab = await chrome.tabs.get(senderTabId);
      if (senderTab?.url && isSupportedUrl(senderTab.url)) {
        prepend = [senderTab.url];
      }
    } catch (error) {
      // Sender tab unavailable — continue with selected URLs only.
    }
  }

  const urls = mergeCompareUrls(picked, prepend);
  if (urls.length < 2) {
    return {
      ok: false,
      message: 'Add at least 1 competitor URL — this page counts as one site in the compare.'
    };
  }

  const tabs = await queryAllTabs();
  const results = [];
  const usedTabIds = new Set();

  for (const url of urls) {
    const existingTab = findTabForUrl(tabs, url, usedTabIds);
    if (!existingTab || typeof existingTab.id !== 'number') {
      results.push({
        url,
        status: 'not-open',
        note: 'Open this site in a tab (any page on the domain), then compare again.'
      });
      continue;
    }

    usedTabIds.add(existingTab.id);
    const response = await snapshotTabWithRecovery(existingTab.id);
    if (!response.ok) {
      results.push({
        url,
        status: 'error',
        note: response.error || 'Could not snapshot tab.'
      });
      continue;
    }
    results.push({
      url: existingTab.url || url,
      status: 'ok',
      analysis: response.result
    });
  }

  const readyCount = results.filter((item) => item.status === 'ok').length;
  const notOpen = results.filter((item) => item.status === 'not-open');

  if (readyCount < 2) {
    const hosts = notOpen.map((item) => compareHost(item.url) || item.url);
    const hostHint =
      hosts.length > 0
        ? ` Open a tab for: ${hosts.join(', ')} (homepage or any page on that site).`
        : '';
    return {
      ok: false,
      message: `Need 2+ sites snapshotted for a compare.${hostHint}`,
      results
    };
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
    collectComparisonSummaries(message.selectedUrls, sender?.tab?.id).then((result) => sendResponse(result));
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
