// floating-panel.js
// Purpose: Create draggable, collapsible, pinnable floating overlay for low-friction in-page analysis.

(function initFloatingPanel(globalScope) {
  const PANEL_ID = 'observeux-panel';
  const ASSISTANT_PANEL_ID = 'observeux-results-panel';
  const STORAGE_KEYS = {
    panelOpen: 'panelOpen',
    panelMinimized: 'panelMinimized',
    panelPinned: 'panelPinned',
    panelPosition: 'panelPosition',
    assistantOpen: 'assistantOpen',
    assistantPosition: 'assistantPosition',
    userSettings: 'userSettings'
  };

  let state = {
    open: false,
    collapsed: false,
    pinned: false,
    assistantOpen: false,
    userSettings: {},
    x: null,
    y: null,
    assistantX: null,
    assistantY: null
  };

  const briefCache = {
    result: null,
    benchmark: null
  };

  function isExtensionContextValid() {
    try {
      return Boolean(chrome?.runtime?.id && chrome?.storage?.local);
    } catch (error) {
      return false;
    }
  }

  function safeStorageGet(keys) {
    return new Promise((resolve) => {
      if (!isExtensionContextValid()) {
        resolve({});
        return;
      }
      try {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            resolve({});
            return;
          }
          resolve(result || {});
        });
      } catch (error) {
        resolve({});
      }
    });
  }

  function safeStorageSet(payload) {
    return new Promise((resolve) => {
      if (!isExtensionContextValid()) {
        resolve(false);
        return;
      }
      try {
        chrome.storage.local.set(payload, () => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(true);
        });
      } catch (error) {
        resolve(false);
      }
    });
  }

  function notifyPanelStateChange(open) {
    if (!isExtensionContextValid()) return;
    try {
      chrome.runtime.sendMessage({ type: 'OBSERVEUX_PANEL_STATE_CHANGED', open: Boolean(open) }, () => {
        // Ignore runtime errors; this is best-effort synchronization with service worker.
      });
    } catch (error) {
      // No-op by design.
    }
  }

  async function loadState() {
    const result = await safeStorageGet(Object.values(STORAGE_KEYS));
    state.open = Boolean(result[STORAGE_KEYS.panelOpen]);
    state.collapsed = Boolean(result[STORAGE_KEYS.panelMinimized]);
    state.pinned = Boolean(result[STORAGE_KEYS.panelPinned]);
    state.userSettings = result[STORAGE_KEYS.userSettings] || {};
    state.assistantOpen = Boolean(result[STORAGE_KEYS.assistantOpen]);
    const position = result[STORAGE_KEYS.panelPosition];
    if (position && typeof position === 'object') {
      state.x = position.x || null;
      state.y = position.y || null;
    }
    const assistantPosition = result[STORAGE_KEYS.assistantPosition];
    if (assistantPosition && typeof assistantPosition === 'object') {
      state.assistantX = assistantPosition.x || null;
      state.assistantY = assistantPosition.y || null;
    }
  }

  async function saveState() {
    await safeStorageSet({
      [STORAGE_KEYS.panelOpen]: state.open,
      [STORAGE_KEYS.panelMinimized]: state.collapsed,
      [STORAGE_KEYS.panelPinned]: state.pinned,
      [STORAGE_KEYS.panelPosition]: { x: state.x, y: state.y },
      [STORAGE_KEYS.assistantOpen]: state.assistantOpen,
      [STORAGE_KEYS.assistantPosition]: { x: state.assistantX, y: state.assistantY },
      [STORAGE_KEYS.userSettings]: state.userSettings
    });
  }

  function confidenceClass(level) {
    if (level === 'high') return 'observeux-confidence-high';
    if (level === 'medium') return 'observeux-confidence-medium';
    return 'observeux-confidence-advisory';
  }

  function renderList(items, mapper) {
    if (!items || items.length === 0) return '<li>Insufficient visible evidence.</li>';
    return items.map((item) => `<li>${mapper(item)}</li>`).join('');
  }

  function featureLabel(item) {
    return item.label || item.name;
  }

  function showToast(anchorPanel, message) {
    if (!anchorPanel) return;
    const existing = anchorPanel.querySelector('.observeux-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'observeux-toast';
    toast.textContent = message;
    anchorPanel.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 2800);
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.documentElement.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }

  async function resolveBriefMarkdown(panel, options) {
    const builder = globalScope.ObserveUXBriefBuilder;
    if (!builder) {
      throw new Error('Brief builder unavailable');
    }

    let result = briefCache.result;
    if (!result && globalScope.ObserveUXOrchestrator?.runSingleAnalysis) {
      showToast(panel, 'Preparing brief…');
      result = await globalScope.ObserveUXOrchestrator.runSingleAnalysis();
      briefCache.result = result;
      applyResults(result);
    }

    const opts = options || {};
    let watermark = Boolean(opts.watermark);
    if (opts.watermark === undefined && globalScope.RedzeUXEntitlements) {
      watermark = !(await globalScope.RedzeUXEntitlements.isPaid());
    }

    const markdown = builder.buildBrief(result, briefCache.benchmark, { watermark });
    const meta = {
      url: result?.detection?.url || window.location.href,
      title: result?.detection?.title || document.title
    };
    return { markdown, meta, result };
  }

  async function copyExecutiveBrief(panel) {
    const builder = globalScope.ObserveUXBriefBuilder;
    if (!builder) {
      showToast(panel, 'Brief builder unavailable. Reload the extension.');
      return;
    }

    const entitlements = globalScope.RedzeUXEntitlements;
    if (entitlements) {
      const gate = await entitlements.canCopyBrief();
      if (!gate.ok) {
        showToast(panel, gate.message || 'Brief copy limit reached.');
        return;
      }
    }

    try {
      const { markdown } = await resolveBriefMarkdown(panel);
      const copied = await copyTextToClipboard(markdown);
      if (!copied) {
        showToast(panel, 'Copy failed. Try again after clicking the page.');
        return;
      }
      if (entitlements) {
        await entitlements.recordBriefCopy();
        await applyTierUi(panel);
      }
      showToast(panel, 'Brief copied — paste in Slack or Notion');
    } catch (error) {
      showToast(panel, 'Could not build brief. Run Analyze Page first.');
    }
  }

  async function runProExport(panel, format) {
    const entitlements = globalScope.RedzeUXEntitlements;
    if (entitlements && !(await entitlements.canUseExport())) {
      showProToast(panel, 'Client export (.md / .txt / PDF)');
      return;
    }

    const exporter = globalScope.RedzeUXExport;
    if (!exporter) {
      showToast(panel, 'Export module unavailable. Reload extension.');
      return;
    }

    try {
      const { markdown, meta } = await resolveBriefMarkdown(panel, { watermark: false });
      if (format === 'md') {
        await exporter.exportMarkdown(markdown, meta);
        showToast(panel, 'Markdown report downloaded');
      } else if (format === 'txt') {
        await exporter.exportPlainText(markdown, meta);
        showToast(panel, 'Text report downloaded');
      } else if (format === 'pdf') {
        const outcome = await exporter.exportPdfPrint(markdown, meta);
        if (!outcome.ok) {
          showToast(panel, 'Allow pop-ups to open print/PDF view.');
          return;
        }
        showToast(panel, 'Print view opened — Save as PDF');
      }
    } catch (error) {
      showToast(panel, 'Export failed. Analyze page first.');
    }
  }

  async function applyTierUi(panel) {
    if (!panel) return;
    const entitlements = globalScope.RedzeUXEntitlements;
    if (!entitlements) return;

    const pro = await entitlements.isPaid();
    const compareCard = panel.querySelector('#observeux-compare-card');
    const compareLock = panel.querySelector('#observeux-compare-lock');
    const exportCard = panel.querySelector('#observeux-export-card');
    const exportLock = panel.querySelector('#observeux-export-lock');
    const copyBtn = panel.querySelector('#observeux-copy-brief');

    if (compareCard) {
      compareCard.classList.toggle('observeux-pro-locked', !pro);
    }
    if (compareLock) {
      compareLock.classList.toggle('hidden', pro);
    }
    if (exportCard) {
      exportCard.classList.toggle('observeux-pro-locked', !pro);
    }
    if (exportLock) {
      exportLock.classList.toggle('hidden', pro);
    }

    if (copyBtn) {
      if (pro) {
        copyBtn.textContent = 'Copy Executive Brief';
      } else {
        const gate = await entitlements.canCopyBrief();
        const left = gate.remaining === Infinity ? '' : ` (${gate.remaining} left today)`;
        copyBtn.textContent = `Copy Executive Brief${left}`;
      }
    }
  }

  function showProToast(panel, feature) {
    showToast(panel, `${feature} requires Pro or Agency — Options → upgrade or paste license key.`);
  }

  function renderEvidenceBanner(detection, heuristics) {
    const scope = detection?.evidenceScope || 'light_dom';
    const note = heuristics?.evidenceScopeNote || 'Visible UI only.';
    return `
      <div class="observeux-card observeux-scope-banner">
        <h4>What we can see</h4>
        <p class="observeux-disclosure"><strong>${scope.replace(/_/g, ' ')}</strong> — ${note}</p>
      </div>
    `;
  }

  function renderCompareMatrix(benchmark) {
    if (!benchmark?.ok || !benchmark.matrix?.length) {
      return '<p class="observeux-disclosure">No overlap matrix yet. Open compared URLs in tabs and run compare again.</p>';
    }
    const topRows = benchmark.matrix
      .filter((row) => row.presentCount > 0)
      .sort((a, b) => b.presentCount - a.presentCount)
      .slice(0, 12);
    const rows = topRows
      .map(
        (row) => `
        <tr>
          <td>${row.label}</td>
          <td>${row.coverage}</td>
        </tr>
      `
      )
      .join('');
    return `
      <table class="observeux-matrix">
        <thead><tr><th>Pattern</th><th>Sites</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function applyResultantSynthesis(result, benchmark) {
    const assistantBody = document.querySelector(`#${ASSISTANT_PANEL_ID} .observeux-assistant-body`);
    if (!assistantBody) return;

    const h = result.heuristics;
    const ai = result.ai;
    const suggestions = (ai?.aiSuggestions || []).slice(0, 4);
    const friction = (h?.possibleFrictionPoints || []).slice(0, 2);
    const benchmarkBlock = benchmark
      ? `
        <div class="observeux-card">
          <h4>Compare synthesis</h4>
          <p class="observeux-disclosure">${benchmark.narrative || 'Insufficient visible evidence.'}</p>
          ${renderCompareMatrix(benchmark)}
        </div>
      `
      : '';

    assistantBody.innerHTML = `
      <div class="observeux-card">
        <h4>RedzeUX Resultant</h4>
        <p class="observeux-disclosure">${h?.categoryBenchmark?.narrative || 'Run analysis to see category context.'}</p>
      </div>
      <div class="observeux-card">
        <h4>Friction signals <span class="${confidenceClass('medium')}">(medium)</span></h4>
        <ul class="observeux-list">${renderList(friction, (item) => item.text)}</ul>
      </div>
      <div class="observeux-card">
        <h4>AI suggestions <span class="${confidenceClass('advisory')}">(advisory)</span></h4>
        <ul class="observeux-list">${renderList(suggestions, (item) => item.text)}</ul>
      </div>
      ${benchmarkBlock}
      <p class="observeux-disclosure observeux-footnote">RedzeUX suggests. You synthesize. You decide.</p>
    `;
  }

  function safeNumber(value, fallback) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function setPanelPosition(panel, x, y) {
    panel.style.left = `${Math.max(4, x)}px`;
    panel.style.top = `${Math.max(4, y)}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  // Keep the assistant visible and out of the main panel footprint.
  function computeAssistantPosition(mainPanel) {
    if (!mainPanel) return { x: 20, y: 120 };
    const mainRect = mainPanel.getBoundingClientRect();
    const panelWidth = 300;
    const gap = 14;
    const leftCandidate = mainRect.left - panelWidth - gap;
    const rightCandidate = mainRect.right + gap;

    if (leftCandidate > 6) {
      return { x: leftCandidate, y: mainRect.top };
    }
    if (rightCandidate + panelWidth < window.innerWidth - 6) {
      return { x: rightCandidate, y: mainRect.top };
    }
    return { x: Math.max(6, mainRect.left), y: Math.min(window.innerHeight - 220, mainRect.bottom + gap) };
  }

  function applyResults(result) {
    const body = document.querySelector('#observeux-panel .observeux-results');
    if (!body) return;
    const h = result.heuristics;
    const ai = result.ai;
    const detection = result.detection;

    body.innerHTML = `
      ${renderEvidenceBanner(detection, h)}
      <div class="observeux-card">
        <h4>Category benchmark <span class="${confidenceClass('medium')}">(medium confidence)</span></h4>
        <p class="observeux-disclosure">${h.categoryBenchmark?.narrative || 'Insufficient visible evidence.'}</p>
      </div>
      <div class="observeux-card">
        <h4>Observed features <span class="${confidenceClass('high')}">(high confidence)</span></h4>
        <div>
          ${(h.observableFeatures || [])
            .map((f) => `<span class="observeux-chip">${featureLabel(f)} (${f.count})</span>`)
            .join('')}
        </div>
      </div>
      <div class="observeux-card">
        <h4>Prominent features <span class="${confidenceClass('medium')}">(medium confidence)</span></h4>
        <ul class="observeux-list">${renderList(h.prominentFeatures, (item) => featureLabel(item))}</ul>
      </div>
      <div class="observeux-card">
        <h4>Missing / weak features <span class="${confidenceClass('medium')}">(medium confidence)</span></h4>
        <ul class="observeux-list">${renderList(h.missingWeakFeatures, (item) => featureLabel(item))}</ul>
      </div>
      <div class="observeux-card">
        <h4>Heuristic insights <span class="${confidenceClass('medium')}">(medium confidence)</span></h4>
        <ul class="observeux-list">${renderList(h.heuristicInsights, (item) => item.text)}</ul>
      </div>
      <div class="observeux-card">
        <h4>AI suggestions <span class="${confidenceClass('advisory')}">(advisory)</span></h4>
        <ul class="observeux-list">${renderList(ai.aiSuggestions, (item) => item.text)}</ul>
      </div>
    `;

    briefCache.result = result;
    applyResultantSynthesis(result);
    updateBriefButtonState(panelFromDom());
  }

  function panelFromDom() {
    return document.getElementById(PANEL_ID);
  }

  function updateBriefButtonState(panel) {
    if (!panel) return;
    const copyBtn = panel.querySelector('#observeux-copy-brief');
    if (!copyBtn) return;
    const hasData = Boolean(briefCache.result || briefCache.benchmark?.ok);
    copyBtn.title = hasData
      ? 'Copy markdown brief to clipboard'
      : 'Runs analyze if needed, then copies a paste-ready brief';
    copyBtn.disabled = false;
  }

  async function renderUrlList() {
    const listNode = document.querySelector('#observeux-url-list');
    if (!listNode || !globalScope.ObserveUXComparisonManager) return;
    const urls = await globalScope.ObserveUXComparisonManager.getUrls();
    listNode.innerHTML = urls
      .map(
        (url) => `
        <li class="observeux-url-item">
          <input type="checkbox" value="${url}" />
          <span title="${url}">${url}</span>
          <button class="observeux-btn observeux-remove-url" data-url="${url}">Remove</button>
        </li>
      `
      )
      .join('');
  }

  function attachDragging(panel, header) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener('mousedown', (event) => {
      dragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (event) => {
      if (!dragging) return;
      panel.style.left = `${Math.max(4, event.clientX - offsetX)}px`;
      panel.style.top = `${Math.max(4, event.clientY - offsetY)}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      state.x = panel.style.left;
      state.y = panel.style.top;
    });

    document.addEventListener('mouseup', async () => {
      if (!dragging) return;
      dragging = false;
      header.style.cursor = 'grab';
      await saveState();
    });
  }

  function wireActions(panel) {
    const collapseBtn = panel.querySelector('#observeux-toggle-collapse');
    const pinBtn = panel.querySelector('#observeux-toggle-pin');
    const closeBtn = panel.querySelector('#observeux-close');
    const analyzeBtn = panel.querySelector('#observeux-analyze-page');
    const addUrlBtn = panel.querySelector('#observeux-add-url');
    const clearBtn = panel.querySelector('#observeux-clear-urls');
    const compareSelectedBtn = panel.querySelector('#observeux-compare-selected');
    const removeSelectedBtn = panel.querySelector('#observeux-remove-selected');
    const copyBriefBtn = panel.querySelector('#observeux-copy-brief');
    const exportMdBtn = panel.querySelector('#observeux-export-md');
    const exportTxtBtn = panel.querySelector('#observeux-export-txt');
    const exportPdfBtn = panel.querySelector('#observeux-export-pdf');

    copyBriefBtn.addEventListener('click', async () => {
      const original = copyBriefBtn.textContent;
      copyBriefBtn.textContent = 'Copying…';
      await copyExecutiveBrief(panel);
      copyBriefBtn.textContent = original;
    });

    exportMdBtn.addEventListener('click', () => runProExport(panel, 'md'));
    exportTxtBtn.addEventListener('click', () => runProExport(panel, 'txt'));
    exportPdfBtn.addEventListener('click', () => runProExport(panel, 'pdf'));

    collapseBtn.addEventListener('click', async () => {
      state.collapsed = !state.collapsed;
      panel.classList.toggle('observeux-collapsed', state.collapsed);
      collapseBtn.textContent = state.collapsed ? 'Expand' : 'Collapse';
      await saveState();
    });

    pinBtn.addEventListener('click', async () => {
      state.pinned = !state.pinned;
      pinBtn.textContent = state.pinned ? 'Unpin' : 'Pin';
      await saveState();
    });

    closeBtn.addEventListener('click', async () => {
      state.open = false;
      await saveState();
      notifyPanelStateChange(false);
      panel.remove();
    });

    analyzeBtn.addEventListener('click', async () => {
      analyzeBtn.textContent = 'Analyzing...';
      await openAssistantPanel(panel);
      const result = await globalScope.ObserveUXOrchestrator.runSingleAnalysis();
      applyResults(result);
      analyzeBtn.textContent = 'Analyze Page';
    });

    addUrlBtn.addEventListener('click', async () => {
      if (globalScope.RedzeUXEntitlements && !(await globalScope.RedzeUXEntitlements.canUseCompare())) {
        showProToast(panel, 'Compare sites');
        return;
      }
      const input = panel.querySelector('#observeux-url-input');
      const value = input.value.trim();
      if (!value) return;
      const outcome = await globalScope.ObserveUXComparisonManager.addUrl(value);
      if (!outcome.ok) {
        alert(outcome.message);
        return;
      }
      input.value = '';
      await renderUrlList();
    });

    panel.addEventListener('click', async (event) => {
      const removeButton = event.target.closest('.observeux-remove-url');
      if (removeButton) {
        const url = removeButton.getAttribute('data-url');
        await globalScope.ObserveUXComparisonManager.removeUrl(url);
        await renderUrlList();
      }
    });

    clearBtn.addEventListener('click', async () => {
      await globalScope.ObserveUXComparisonManager.clearAll();
      await renderUrlList();
    });

    compareSelectedBtn.addEventListener('click', async () => {
      if (globalScope.RedzeUXEntitlements && !(await globalScope.RedzeUXEntitlements.canUseCompare())) {
        showProToast(panel, 'Compare sites');
        return;
      }
      const selected = Array.from(panel.querySelectorAll('#observeux-url-list input:checked')).map(
        (node) => node.value
      );
      await openAssistantPanel(panel);
      chrome.runtime.sendMessage(
        { type: 'OBSERVEUX_COMPARE_SITES', selectedUrls: selected },
        (response) => {
          if (!response?.ok) {
            alert(response?.message || 'Comparison failed.');
            return;
          }
          const summaryCard = panel.querySelector('.observeux-compare-summary');
          summaryCard.textContent = '';
          const summaryStrong = document.createElement('strong');
          summaryStrong.textContent = 'Compare summary:';
          summaryCard.appendChild(summaryStrong);
          summaryCard.appendChild(
            document.createTextNode(` ${response.summaryText || 'Insufficient visible evidence.'}`)
          );
          if (response.benchmark) {
            briefCache.benchmark = response.benchmark;
            updateBriefButtonState(panel);
            const orchestrator = globalScope.ObserveUXOrchestrator;
            if (orchestrator?.runSingleAnalysis) {
              orchestrator
                .runSingleAnalysis()
                .then((current) => applyResultantSynthesis(current, response.benchmark))
                .catch(() => applyResultantSynthesis(null, response.benchmark));
            } else {
              applyResultantSynthesis(null, response.benchmark);
            }
          }
        }
      );
    });

    removeSelectedBtn.addEventListener('click', async () => {
      const selected = Array.from(panel.querySelectorAll('#observeux-url-list input:checked')).map(
        (node) => node.value
      );
      for (const url of selected) {
        await globalScope.ObserveUXComparisonManager.removeUrl(url);
      }
      await renderUrlList();
    });
  }

  function wireAssistantDragging(panel) {
    const header = panel.querySelector('.observeux-assistant-header');
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener('mousedown', (event) => {
      dragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (event) => {
      if (!dragging) return;
      const x = Math.max(4, event.clientX - offsetX);
      const y = Math.max(4, event.clientY - offsetY);
      setPanelPosition(panel, x, y);
      state.assistantX = `${x}px`;
      state.assistantY = `${y}px`;
    });

    document.addEventListener('mouseup', async () => {
      if (!dragging) return;
      dragging = false;
      header.style.cursor = 'grab';
      await saveState();
    });
  }

  async function openAssistantPanel(mainPanel) {
    const existing = document.getElementById(ASSISTANT_PANEL_ID);
    if (existing) {
      existing.style.display = '';
      state.assistantOpen = true;
      await saveState();
      return;
    }

    const assistant = document.createElement('section');
    assistant.id = ASSISTANT_PANEL_ID;
    assistant.innerHTML = `
      <div class="observeux-assistant-header">
        <div class="observeux-title">RedzeUX Resultant</div>
        <div class="observeux-controls">
          <button id="observeux-copy-brief-assistant" class="observeux-btn observeux-hook" type="button">Copy brief</button>
          <button id="observeux-close-assistant" class="observeux-btn" type="button">Close</button>
        </div>
      </div>
      <div class="observeux-assistant-body">
        <div class="observeux-card">
          <h4>Results Snapshot</h4>
          <p class="observeux-disclosure">Run Analyze Page or Compare Selected to populate results.</p>
        </div>
      </div>
    `;

    // Use saved assistant position if present; otherwise avoid overlap with main panel.
    const computed = computeAssistantPosition(mainPanel);
    const x = safeNumber(state.assistantX, computed.x);
    const y = safeNumber(state.assistantY, computed.y);
    setPanelPosition(assistant, x, y);
    state.assistantX = `${x}px`;
    state.assistantY = `${y}px`;

    assistant.querySelector('#observeux-close-assistant').addEventListener('click', async () => {
      state.assistantOpen = false;
      await saveState();
      assistant.remove();
    });

    assistant.querySelector('#observeux-copy-brief-assistant').addEventListener('click', async () => {
      await copyExecutiveBrief(mainPanel || panelFromDom() || assistant);
    });

    document.documentElement.appendChild(assistant);
    wireAssistantDragging(assistant);
    state.assistantOpen = true;
    await saveState();
  }

  async function closeAssistantPanel() {
    const existing = document.getElementById(ASSISTANT_PANEL_ID);
    if (existing) {
      existing.remove();
    }
    state.assistantOpen = false;
    await saveState();
  }

  async function createPanel() {
    await loadState();
    if (document.getElementById(PANEL_ID)) return;
    state.open = true;
    // Results panel is action-triggered only; never auto-restore on new pages.
    state.assistantOpen = false;

    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = state.collapsed ? 'observeux-collapsed' : '';
    panel.innerHTML = `
      <div class="observeux-header">
        <div class="observeux-title">Redze UX</div>
        <div class="observeux-controls">
          <button id="observeux-toggle-collapse" class="observeux-btn">${state.collapsed ? 'Expand' : 'Collapse'}</button>
          <button id="observeux-toggle-pin" class="observeux-btn">${state.pinned ? 'Unpin' : 'Pin'}</button>
          <button id="observeux-close" class="observeux-btn">Close</button>
        </div>
      </div>
      <div class="observeux-body">
        <div class="observeux-action-row">
          <button id="observeux-analyze-page" class="observeux-btn observeux-primary">Analyze Page</button>
        </div>
        <div class="observeux-action-row">
          <button id="observeux-copy-brief" class="observeux-btn observeux-hook" type="button" title="Paste-ready brief for Slack, Notion, or email">
            Copy Executive Brief
          </button>
        </div>
        <div id="observeux-export-card" class="observeux-card observeux-export-card">
          <h4>Client export (Pro / Agency)</h4>
          <p id="observeux-export-lock" class="observeux-disclosure observeux-pro-lock">
            Branded .md, .txt, and print/PDF reports. Set agency name in Options.
          </p>
          <div class="observeux-action-row observeux-export-row">
            <button id="observeux-export-md" class="observeux-btn" type="button">.md</button>
            <button id="observeux-export-txt" class="observeux-btn" type="button">.txt</button>
            <button id="observeux-export-pdf" class="observeux-btn observeux-primary" type="button">Print / PDF</button>
          </div>
        </div>
        <div class="observeux-card observeux-disclosure">
          AI suggestions are advisory. Visible UI only — you synthesize and decide.
        </div>
        <div class="observeux-results"></div>
        <div id="observeux-compare-card" class="observeux-card observeux-compare-card">
          <h4>Compare Sites (Pro / Agency · up to 5)</h4>
          <p id="observeux-compare-lock" class="observeux-disclosure observeux-pro-lock">
            Save competitor URLs and run side-by-side teardowns. Unlock in extension Options.
          </p>
          <div class="observeux-compare-row">
            <input id="observeux-url-input" type="url" placeholder="https://example.com" />
            <button id="observeux-add-url" class="observeux-btn">Add</button>
          </div>
          <ul id="observeux-url-list" class="observeux-url-list"></ul>
          <div class="observeux-action-row">
            <button id="observeux-compare-selected" class="observeux-btn">Compare Selected</button>
            <button id="observeux-remove-selected" class="observeux-btn">Remove Selected</button>
          </div>
          <button id="observeux-clear-urls" class="observeux-btn">Clear List</button>
          <div class="observeux-card observeux-compare-summary">Select at least 2 sites and click Compare Selected.</div>
        </div>
        <p class="observeux-doctrine-footer">For the people · Local only · Always.</p>
      </div>
    `;

    if (state.x) {
      setPanelPosition(panel, safeNumber(state.x, 20), safeNumber(state.y, 20));
    }

    document.documentElement.appendChild(panel);
    attachDragging(panel, panel.querySelector('.observeux-header'));
    wireActions(panel);
    updateBriefButtonState(panel);
    await renderUrlList();
    await applyTierUi(panel);
    await saveState();
    notifyPanelStateChange(true);
  }

  async function openPanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      existing.style.display = '';
      state.open = true;
      await saveState();
      notifyPanelStateChange(true);
      await renderUrlList();
      return;
    }
    await createPanel();
  }

  async function closePanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      existing.remove();
    }
    await closeAssistantPanel();
    state.open = false;
    await saveState();
    notifyPanelStateChange(false);
  }

  async function restoreIfOpen() {
    await loadState();
    if (state.open) {
      await createPanel();
    }
  }

  globalScope.ObserveUXFloatingPanel = {
    openPanel,
    closePanel,
    restoreIfOpen,
    createPanel,
    applyResults,
    applyResultantSynthesis,
    applyTierUi
  };

  if (globalScope.RedzeUXEntitlements?.onTierChanged) {
    globalScope.RedzeUXEntitlements.onTierChanged(() => {
      const panel = panelFromDom();
      if (panel) {
        applyTierUi(panel);
      }
    });
  }
})(window);
