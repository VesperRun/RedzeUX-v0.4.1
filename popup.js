// popup.js — Simple launcher (Philosophia §VI.1: one action outside, depth in panel + Options).

const tierStatus = document.getElementById('tier-status');
const statusLine = document.getElementById('status-line');

function sendBackgroundMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response.' });
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response from page.' });
    });
  });
}

function getCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
  });
}

async function refreshTier() {
  const label = await RedzeUXEntitlements.getTierLabel();
  tierStatus.textContent = label;
}

async function openPanel() {
  const response = await sendBackgroundMessage({ type: 'OBSERVEUX_OPEN_PANEL_FROM_POPUP' });
  if (!response.ok) {
    statusLine.textContent = `Could not open panel: ${response.error || 'unknown error'}`;
    return;
  }
  statusLine.textContent = 'Panel open — generate a snapshot or copy a brief from there.';
}

async function analyzeCurrentPage() {
  const tab = await getCurrentTab();
  if (!tab?.id) {
    statusLine.textContent = 'No active tab available.';
    return;
  }
  await openPanel();
  const response = await sendTabMessage(tab.id, { type: 'OBSERVEUX_ANALYZE_CURRENT_PAGE' });
  if (!response.ok) {
    statusLine.textContent = `Snapshot failed: ${response.error || 'unknown error'}`;
    return;
  }
  statusLine.textContent = 'Snapshot ready — see floating panel.';
}

document.getElementById('open-panel').addEventListener('click', openPanel);
document.getElementById('analyze-current').addEventListener('click', analyzeCurrentPage);
document.getElementById('open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

refreshTier();
