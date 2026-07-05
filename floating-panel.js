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

  function benchmarkHeading(heuristics, detection) {
    const siteLabel = heuristics?.categoryBenchmark?.siteTypeLabel || detection?.siteType || 'site';
    return `Benchmark vs typical ${siteLabel} patterns`;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function labelForFeatureKey(key) {
    const tax = globalScope.ObserveUXFeatureTaxonomy;
    return tax ? tax.labelFeature(key) : key;
  }

  function renderFeatureChips(features) {
    if (!features || features.length === 0) {
      return '<p class="observeux-disclosure">Insufficient visible evidence.</p>';
    }
    return features
      .map((feature) => {
        const key = escapeHtml(feature.name);
        const label = escapeHtml(featureLabel(feature));
        return `<button type="button" class="observeux-chip observeux-chip-btn" data-feature="${key}" title="See what was found">${label} (${feature.count})</button>`;
      })
      .join('');
  }

  function renderClickableFeatureList(items) {
    if (!items || items.length === 0) {
      return '<li class="observeux-disclosure">Insufficient visible evidence.</li>';
    }
    return items
      .map((item) => {
        const key = escapeHtml(item.name);
        const label = escapeHtml(featureLabel(item));
        return `<li><button type="button" class="observeux-list-btn" data-feature="${key}">${label}</button></li>`;
      })
      .join('');
  }

  function renderMatchRow(match) {
    const source =
      match.source === 'shadow'
        ? `shadow · ${escapeHtml(match.host || 'custom element')}`
        : 'page';
    return `<li class="observeux-match-item">
      <span class="observeux-match-label">${escapeHtml(match.label)}</span>
      <span class="observeux-match-meta">${escapeHtml(match.tag)} · ${source}</span>
      <code class="observeux-match-selector">${escapeHtml(match.selector)}</code>
    </li>`;
  }

  function renderSelectorList(selectors) {
    if (!selectors || selectors.length === 0) {
      return '<li class="observeux-disclosure">No selectors defined.</li>';
    }
    return selectors.map((selector) => `<li><code>${escapeHtml(selector)}</code></li>`).join('');
  }

  function closeDetailDrawer(panel) {
    const drawer = panel?.querySelector('#observeux-detail-drawer');
    if (drawer) {
      drawer.classList.add('hidden');
      drawer.innerHTML = '';
    }
    panel?.querySelectorAll('.observeux-chip-btn.is-active, .observeux-list-btn.is-active').forEach((node) => {
      node.classList.remove('is-active');
    });
  }

  function openDetailDrawer(panel, title, bodyHtml) {
    let drawer = panel.querySelector('#observeux-detail-drawer');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'observeux-detail-drawer';
      drawer.className = 'observeux-detail-drawer';
      const body = panel.querySelector('.observeux-body');
      const results = panel.querySelector('.observeux-results');
      if (body && results) {
        results.insertAdjacentElement('afterend', drawer);
      } else if (body) {
        body.appendChild(drawer);
      }
    }
    drawer.classList.remove('hidden');
    drawer.innerHTML = `
      <div class="observeux-detail-header">
        <strong>${title}</strong>
        <button type="button" class="observeux-btn observeux-detail-close" aria-label="Close details">Close</button>
      </div>
      <div class="observeux-detail-body">${bodyHtml}</div>
    `;
    drawer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function isListedPatternGap(featureKey, heuristics) {
    const missing = heuristics?.missingWeakFeatures || [];
    const categoryGaps = heuristics?.categoryBenchmark?.categoryGaps || [];
    return (
      missing.some((item) => item.name === featureKey) ||
      categoryGaps.some((item) => item.key === featureKey)
    );
  }

  function renderPatternGapExplanation(featureKey, label, detection, heuristics, selectors) {
    const siteTypeKey = detection?.siteType || heuristics?.categoryBenchmark?.siteType || 'general_web_app';
    const siteLabel =
      heuristics?.categoryBenchmark?.siteTypeLabel || labelSiteType(siteTypeKey) || 'this type of site';
    const tax = globalScope.ObserveUXFeatureTaxonomy;
    const siteContext = tax?.getSiteTypeGapContext?.(siteTypeKey) || {};
    const rationale = tax?.getFeatureGapRationale?.(featureKey, siteTypeKey) || {};
    const expectedLabels = tax?.getExpectedFeatureLabels?.(siteTypeKey) || [];
    const expectedLine =
      expectedLabels.length > 0
        ? expectedLabels.join(', ')
        : 'patterns common to this category';
    const evidenceNote = heuristics?.evidenceScopeNote || 'Evidence is from visible UI on the current view only.';
    const closedHosts = detection?.observationLimits?.closedShadowHostsEstimated || 0;
    const shadowHint =
      closedHosts > 0
        ? ` Also, about ${closedHosts} custom element(s) on this page may hide controls inside closed shadow regions we cannot inspect.`
        : '';
    const whyText = rationale.why || `${label} is commonly expected on ${siteLabel} pages.`;
    const hintText =
      rationale.hint ||
      'It may be present under a different label, inside a menu, below the fold, or only after a click.';

    return `
      <p class="observeux-disclosure observeux-gap-lead">
        <strong>${escapeHtml(label)}</strong> is flagged as a <strong>pattern gap</strong> on this
        <strong>${escapeHtml(siteLabel)}</strong> snapshot — not because we found something wrong with it,
        but because similar pages often make this pattern easy to spot in the main view, and our visible scan
        did not pick it up here.
      </p>
      <h5 class="observeux-detail-subhead">About ${escapeHtml(siteLabel)} benchmarks</h5>
      <p class="observeux-disclosure">${escapeHtml(siteContext.intro || '')}</p>
      <p class="observeux-disclosure">${escapeHtml(siteContext.peerSnapshot || '')}</p>
      <h5 class="observeux-detail-subhead">Why ${escapeHtml(label)} matters in this comparison</h5>
      <p class="observeux-disclosure">${escapeHtml(whyText)}</p>
      <p class="observeux-disclosure">
        For this benchmark, we compare against: ${escapeHtml(expectedLine)}.
        This item returned <strong>0 visible matches</strong> on the current view (medium confidence).
      </p>
      <h5 class="observeux-detail-subhead">What we checked on this page</h5>
      <ul class="observeux-list observeux-selector-list">${renderSelectorList(selectors)}</ul>
      <h5 class="observeux-detail-subhead">Before you treat this as confirmed missing</h5>
      <ul class="observeux-list">
        <li>${escapeHtml(hintText)}</li>
        <li>Try scrolling the footer, opening the main menu, or expanding collapsed panels — then run another snapshot.</li>
        <li>${escapeHtml(evidenceNote)}${escapeHtml(shadowHint)}</li>
      </ul>
      <p class="observeux-disclosure observeux-footnote">
        Pattern gaps are advisory benchmarks, not defects. RedzeUX suggests — you synthesize and decide.
      </p>
    `;
  }

  function labelSiteType(key) {
    const tax = globalScope.ObserveUXFeatureTaxonomy;
    return tax ? tax.labelSiteType(key) : key;
  }

  function renderAbsentFeatureExplanation(label, selectors) {
    return `
      <p class="observeux-disclosure">
        <strong>${escapeHtml(label)}</strong> was not detected on this view with the checks below.
        It may be absent, use different labeling, or sit outside what the scan can see from here.
      </p>
      <h5 class="observeux-detail-subhead">What we checked</h5>
      <ul class="observeux-list observeux-selector-list">${renderSelectorList(selectors)}</ul>
    `;
  }

  function showFeatureDetail(panel, featureKey) {
    const result = briefCache.result;
    if (!result?.detection) return;

    const detection = result.detection;
    const heuristics = result.heuristics || {};
    const count = detection.featureCounts?.[featureKey] || 0;
    const label = labelForFeatureKey(featureKey);
    const matches = detection.featureMatches?.[featureKey] || [];
    const selectors =
      globalScope.ObserveUXDomDetector?.getFeatureSelectors?.(featureKey) || [];
    const isGap = isListedPatternGap(featureKey, heuristics);

    panel.querySelectorAll('.observeux-chip-btn.is-active, .observeux-list-btn.is-active').forEach((node) => {
      node.classList.remove('is-active');
    });
    panel.querySelectorAll(`[data-feature="${featureKey}"]`).forEach((node) => {
      node.classList.add('is-active');
    });

    let bodyHtml = '';
    let drawerTitle = `${escapeHtml(label)} — evidence`;

    if (count === 0 && isGap) {
      drawerTitle = `${escapeHtml(label)} — pattern gap`;
      bodyHtml = renderPatternGapExplanation(featureKey, label, detection, heuristics, selectors);
    } else if (count === 0) {
      bodyHtml = renderAbsentFeatureExplanation(label, selectors);
    } else if (matches.length === 0) {
      bodyHtml = `
        <p class="observeux-disclosure"><strong>${count}</strong> visible match${count === 1 ? '' : 'es'} for ${escapeHtml(label)}. Detailed samples were not captured — rescan to refresh.</p>
      `;
    } else {
      const capped = count > matches.length;
      bodyHtml = `
        <p class="observeux-disclosure"><strong>${count}</strong> visible · showing ${matches.length}${capped ? ' (sample)' : ''}</p>
        <ul class="observeux-match-list">${matches.map(renderMatchRow).join('')}</ul>
      `;
    }

    openDetailDrawer(panel, drawerTitle, bodyHtml);
  }

  function showEvidenceDetail(panel) {
    const result = briefCache.result;
    if (!result?.detection) return;

    const detection = result.detection;
    const limits = detection.observationLimits || {};
    const details = detection.evidenceDetails || {};
    const scopeLabel = detection.evidenceScopeLabel || detection.evidenceScope?.replace(/_/g, ' ') || 'Visible UI';
    const hosts = details.openShadowHosts || [];
    const hostList =
      hosts.length > 0
        ? hosts
            .map((host) => {
              const bits = [host.tag];
              if (host.id) bits.push(`#${host.id}`);
              if (host.classes) bits.push(`.${host.classes.split(/\s+/)[0]}`);
              return `<li><code>${escapeHtml(bits.join(''))}</code></li>`;
            })
            .join('')
        : '<li class="observeux-disclosure">No open shadow regions scanned.</li>';

    const bodyHtml = `
      <p class="observeux-disclosure"><strong>${escapeHtml(scopeLabel)}</strong> — ${escapeHtml(result.heuristics?.evidenceScopeNote || 'Visible UI only.')}</p>
      <h5 class="observeux-detail-subhead">Scan coverage</h5>
      <ul class="observeux-list">
        <li><strong>${limits.nodesScanned || 0}</strong> DOM nodes visited</li>
        <li><strong>${details.shadowRegionsScanned || limits.openShadowRootsScanned || 0}</strong> open shadow region(s)</li>
        <li><strong>${details.closedShadowHostsEstimated || limits.closedShadowHostsEstimated || 0}</strong> possible closed-shadow custom element(s)</li>
      </ul>
      <h5 class="observeux-detail-subhead">Open shadow hosts (sample)</h5>
      <ul class="observeux-list observeux-selector-list">${hostList}</ul>
      <p class="observeux-disclosure observeux-footnote">Iframes, credentials, and closed shadow content are excluded.</p>
    `;

    openDetailDrawer(panel, 'What we can see — details', bodyHtml);
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
      watermark = await globalScope.RedzeUXEntitlements.shouldApplyBriefWatermark();
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
      showToast(panel, 'Could not build brief. Generate a UX snapshot first.');
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
      const watermark = entitlements
        ? await entitlements.shouldApplyBriefWatermark()
        : false;
      const { markdown, meta } = await resolveBriefMarkdown(panel, { watermark });
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
      showToast(panel, 'Export failed. Generate a UX snapshot first.');
    }
  }

  async function applyTierUi(panel) {
    if (!panel) return;
    const entitlements = globalScope.RedzeUXEntitlements;
    if (!entitlements) return;

    const compareCard = panel.querySelector('#observeux-compare-card');
    const compareLock = panel.querySelector('#observeux-compare-lock');
    const exportCard = panel.querySelector('#observeux-export-card');
    const exportLock = panel.querySelector('#observeux-export-lock');
    const copyBtn = panel.querySelector('#observeux-copy-brief');

    if (entitlements.preLaunchGatesOpen()) {
      compareCard?.classList.remove('observeux-pro-locked');
      exportCard?.classList.remove('observeux-pro-locked');
      compareLock?.classList.add('hidden');
      exportLock?.classList.add('hidden');
      if (copyBtn) copyBtn.textContent = 'Copy Brief';
      return;
    }

    const paid = await entitlements.isPaid();
    const canCompare = await entitlements.canUseCompare();
    const canExport = await entitlements.canUseExport();

    if (compareCard) {
      compareCard.classList.toggle('observeux-pro-locked', !canCompare);
    }
    if (compareLock) {
      compareLock.classList.toggle('hidden', canCompare);
    }
    if (exportCard) {
      exportCard.classList.toggle('observeux-pro-locked', !canExport);
    }
    if (exportLock) {
      if (canExport && !paid) {
        exportLock.textContent =
          'Free exports include a brief footer watermark. Optional Supporter in Options removes it.';
        exportLock.classList.remove('hidden');
      } else {
        exportLock.classList.toggle('hidden', canExport);
      }
    }

    if (copyBtn) {
      if (paid) {
        copyBtn.textContent = 'Copy Brief';
      } else {
        const gate = await entitlements.canCopyBrief();
        const left = gate.remaining === Infinity ? '' : ` (${gate.remaining} left today)`;
        copyBtn.textContent = `Copy Brief${left}`;
      }
    }
  }

  function showProToast(panel, feature) {
    showToast(panel, `${feature} unavailable — reload the extension or open Options.`);
  }

  function renderEvidenceBanner(detection, heuristics) {
    const scopeLabel = detection?.evidenceScopeLabel || detection?.evidenceScope?.replace(/_/g, ' ') || 'Visible UI';
    const note = heuristics?.evidenceScopeNote || 'Visible UI only.';
    const shadowCount = detection?.evidenceDetails?.shadowRegionsScanned || detection?.observationLimits?.openShadowRootsScanned || 0;
    const shadowHint =
      shadowCount > 0
        ? ` Includes up to ${shadowCount} open shadow region${shadowCount === 1 ? '' : 's'}.`
        : '';
    return `
      <div class="observeux-card observeux-scope-banner">
        <h4>What we can see</h4>
        <p class="observeux-disclosure">
          <button type="button" class="observeux-evidence-link" data-evidence-detail="true" title="See scan coverage">
            <strong>${escapeHtml(scopeLabel)}</strong>
          </button>
          — ${escapeHtml(note)}${escapeHtml(shadowHint)}
          <button type="button" class="observeux-evidence-link observeux-evidence-link-inline" data-evidence-detail="true">Details</button>
        </p>
      </div>
    `;
  }

  function pageHost(result) {
    try {
      return new URL(result?.detection?.url || window.location.href).hostname.replace(/^www\./i, '');
    } catch (error) {
      return 'this page';
    }
  }

  function renderCompareMatrix(benchmark) {
    if (!benchmark?.ok) {
      return '<p class="observeux-disclosure">Compare could not build a matrix from the open tabs.</p>';
    }

    const sites = benchmark.sites || [];
    const siteHosts = sites.map((site) => site.host);

    let html = '';

    if (sites.length > 0) {
      html += '<div class="observeux-compare-sites">';
      for (const site of sites) {
        const visible =
          site.featureLabels?.length > 0
            ? site.featureLabels.slice(0, 10).join(' · ')
            : 'No patterns detected — focus that tab and compare again.';
        const gaps =
          site.missingLabels?.length > 0
            ? `<p class="observeux-disclosure observeux-compare-gap">Benchmark gaps: ${escapeHtml(site.missingLabels.slice(0, 6).join(' · '))}</p>`
            : '';
        html += `
          <div class="observeux-compare-site">
            <strong>${escapeHtml(site.host)}</strong>
            <span class="observeux-disclosure"> · ${escapeHtml(site.siteTypeLabel || site.siteType)}</span>
            <p class="observeux-disclosure">${escapeHtml(visible)}</p>
            ${gaps}
          </div>
        `;
      }
      html += '</div>';
    }

    if (benchmark.gapsAcrossSites?.length > 0) {
      html += '<h5 class="observeux-detail-subhead">Cross-site gaps</h5><ul class="observeux-list">';
      for (const gap of benchmark.gapsAcrossSites.slice(0, 8)) {
        html += `<li><strong>${escapeHtml(gap.label)}</strong> — ${escapeHtml(gap.coverage)} sites · missing on ${escapeHtml(gap.missingOn.join(', '))}</li>`;
      }
      html += '</ul>';
    }

    if (benchmark.uniqueBySite?.some((entry) => entry.unique.length > 0)) {
      html += '<h5 class="observeux-detail-subhead">Distinct patterns</h5><ul class="observeux-list">';
      for (const entry of benchmark.uniqueBySite) {
        if (entry.unique.length === 0) continue;
        html += `<li><strong>${escapeHtml(entry.host)}:</strong> ${escapeHtml(entry.unique.join(', '))}</li>`;
      }
      html += '</ul>';
    }

    const rows = (benchmark.matrix || []).filter((row) => row.presentCount > 0).slice(0, 14);
    if (rows.length > 0 && siteHosts.length > 0) {
      const head = siteHosts.map((host) => `<th>${escapeHtml(host)}</th>`).join('');
      const body = rows
        .map((row) => {
          const cells = row.presence
            .map((present) => `<td>${present ? '✓' : '—'}</td>`)
            .join('');
          return `<tr><td>${escapeHtml(row.label)}</td>${cells}</tr>`;
        })
        .join('');
      html += `
        <h5 class="observeux-detail-subhead">Pattern matrix</h5>
        <table class="observeux-matrix observeux-matrix-compare">
          <thead><tr><th>Pattern</th>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      `;
    } else if (sites.length > 0) {
      html +=
        '<p class="observeux-disclosure">No overlapping pattern keys yet — per-site reads above still apply.</p>';
    }

    return html;
  }

  function applyResultantSynthesis(result, benchmark) {
    const assistantBody = document.querySelector(`#${ASSISTANT_PANEL_ID} .observeux-assistant-body`);
    if (!assistantBody) return;

    const h = result?.heuristics;
    const ai = result?.ai;
    const detection = result?.detection;
    const host = pageHost(result);
    const pageTitle = detection?.title ? escapeHtml(detection.title.slice(0, 100)) : '';
    const suggestions = (ai?.aiSuggestions || []).slice(0, 4);
    const friction = (h?.possibleFrictionPoints || []).slice(0, 2);
    const benchmarkBlock =
      benchmark?.ok
        ? `
        <div class="observeux-card">
          <h4>Competitor compare (${benchmark.siteCount || benchmark.sites?.length || '?'} sites)</h4>
          <p class="observeux-disclosure">${escapeHtml(benchmark.narrative || 'Insufficient visible evidence.')}</p>
          ${renderCompareMatrix(benchmark)}
        </div>
      `
        : '';

    assistantBody.innerHTML = `
      <div class="observeux-card">
        <h4>RedzeUX Resultant — ${escapeHtml(host)}</h4>
        ${pageTitle ? `<p class="observeux-disclosure observeux-page-title">${pageTitle}</p>` : ''}
        <p class="observeux-disclosure">${h?.categoryBenchmark?.narrative || 'Generate a UX snapshot to see category context.'}</p>
      </div>
      <div class="observeux-card">
        <h4>Visible patterns here <span class="${confidenceClass('high')}">(high)</span></h4>
        <div class="observeux-chip-row">${renderFeatureChips(h?.observableFeatures || [])}</div>
      </div>
      <div class="observeux-card">
        <h4>Friction signals <span class="${confidenceClass('medium')}">(medium)</span></h4>
        <ul class="observeux-list">${renderList(friction, (item) => item.text)}</ul>
      </div>
      <div class="observeux-card">
        <h4>Advisory suggestions <span class="${confidenceClass('advisory')}">(advisory)</span></h4>
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
        <h4>${benchmarkHeading(h, detection)} <span class="${confidenceClass('medium')}">(medium confidence)</span></h4>
        <p class="observeux-disclosure">${h.categoryBenchmark?.narrative || 'Insufficient visible evidence.'}</p>
      </div>
      <div class="observeux-card">
        <h4>Visible patterns <span class="${confidenceClass('high')}">(high confidence)</span></h4>
        <div class="observeux-chip-row">
          ${renderFeatureChips(h.observableFeatures)}
        </div>
      </div>
      <div class="observeux-card">
        <h4>Standout patterns <span class="${confidenceClass('medium')}">(medium confidence)</span></h4>
        <ul class="observeux-list observeux-clickable-list">${renderClickableFeatureList(h.prominentFeatures)}</ul>
      </div>
      <div class="observeux-card">
        <h4>Pattern gaps <span class="${confidenceClass('medium')}">(medium confidence)</span></h4>
        <ul class="observeux-list observeux-clickable-list">${renderClickableFeatureList(h.missingWeakFeatures)}</ul>
      </div>
      <div class="observeux-card">
        <h4>UX observations <span class="${confidenceClass('medium')}">(medium confidence)</span></h4>
        <ul class="observeux-list">${renderList(h.heuristicInsights, (item) => item.text)}</ul>
      </div>
      <div class="observeux-card">
        <h4>Advisory suggestions <span class="${confidenceClass('advisory')}">(advisory)</span></h4>
        <ul class="observeux-list">${renderList(ai.aiSuggestions, (item) => item.text)}</ul>
      </div>
    `;

    briefCache.result = result;
    applyResultantSynthesis(result, briefCache.benchmark);
    updateBriefButtonState(panelFromDom());
    closeDetailDrawer(panelFromDom());
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
      : 'Generates a snapshot if needed, then copies a paste-ready brief';
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
          <input type="checkbox" value="${url}" checked />
          <span title="${url}">${url}</span>
          <button class="observeux-btn observeux-remove-url" data-url="${url}">Remove</button>
        </li>
      `
      )
      .join('');
    updateCompareSummaryHint(urls.length);
  }

  function updateCompareSummaryHint(urlCount) {
    const summaryCard = document.querySelector('#observeux-panel .observeux-compare-summary');
    if (!summaryCard) return;
    if (urlCount >= 1) {
      summaryCard.textContent =
        'This page is included. Open each checked competitor in a tab (any page on that site), then Compare.';
    } else {
      summaryCard.textContent =
        'Add at least 1 competitor URL. This page counts as one site — open competitors in other tabs to compare.';
    }
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
      analyzeBtn.textContent = 'Generating snapshot…';
      await openAssistantPanel(panel);
      const result = await globalScope.ObserveUXOrchestrator.runSingleAnalysis();
      applyResults(result);
      analyzeBtn.textContent = 'Generate UX Snapshot';
    });

    addUrlBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (globalScope.RedzeUXEntitlements && !(await globalScope.RedzeUXEntitlements.canUseCompare())) {
        showProToast(panel, 'Compare competitors');
        return;
      }
      const input = panel.querySelector('#observeux-url-input');
      const value = input.value.trim();
      if (!value) return;
      const outcome = await globalScope.ObserveUXComparisonManager.addUrl(value);
      if (!outcome.ok) {
        showToast(panel, outcome.message);
        return;
      }
      input.value = '';
      await renderUrlList();
      if (outcome.message) {
        showToast(panel, outcome.message);
      }
    });

    panel.addEventListener('click', async (event) => {
      if (event.target.closest('.observeux-detail-close')) {
        closeDetailDrawer(panel);
        return;
      }
      if (event.target.closest('[data-evidence-detail]')) {
        const drawer = panel.querySelector('#observeux-detail-drawer');
        const evidenceOpen = drawer && !drawer.classList.contains('hidden');
        const headerText = drawer?.querySelector('.observeux-detail-header strong')?.textContent || '';
        if (evidenceOpen && headerText.includes('What we can see')) {
          closeDetailDrawer(panel);
        } else {
          showEvidenceDetail(panel);
        }
        return;
      }
      const featureBtn = event.target.closest('.observeux-chip-btn, .observeux-list-btn');
      if (featureBtn) {
        const featureKey = featureBtn.getAttribute('data-feature');
        if (featureKey) {
          if (featureBtn.classList.contains('is-active')) {
            closeDetailDrawer(panel);
          } else {
            showFeatureDetail(panel, featureKey);
          }
        }
        return;
      }
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

    compareSelectedBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (globalScope.RedzeUXEntitlements && !(await globalScope.RedzeUXEntitlements.canUseCompare())) {
        showProToast(panel, 'Compare competitors');
        return;
      }
      let selected = Array.from(panel.querySelectorAll('#observeux-url-list input:checked')).map(
        (node) => node.value
      );
      if (selected.length < 1) {
        selected = await globalScope.ObserveUXComparisonManager.getUrls();
      }
      if (selected.length < 1) {
        showToast(panel, 'Add at least 1 competitor URL. This page is included in the compare.');
        return;
      }
      await openAssistantPanel(panel);
      chrome.runtime.sendMessage(
        { type: 'OBSERVEUX_COMPARE_SITES', selectedUrls: selected },
        (response) => {
          if (!response?.ok) {
            showToast(panel, response?.message || 'Competitor compare failed.');
            return;
          }
          if (response.benchmark) {
            briefCache.benchmark = response.benchmark;
            updateBriefButtonState(panel);
            const summaryCard = panel.querySelector('.observeux-compare-summary');
            if (summaryCard && response.benchmark.ok) {
              summaryCard.innerHTML = `<strong>Compare ready</strong> — ${escapeHtml(response.benchmark.narrative || response.summaryText || '')}`;
            }
            const orchestrator = globalScope.ObserveUXOrchestrator;
            if (orchestrator?.runSingleAnalysis) {
              orchestrator
                .runSingleAnalysis()
                .then((current) => {
                  briefCache.result = current;
                  applyResults(current);
                  applyResultantSynthesis(current, response.benchmark);
                })
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
          <p class="observeux-disclosure">Generate a UX snapshot or compare competitors to populate results.</p>
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
          <button id="observeux-analyze-page" class="observeux-btn observeux-primary">Generate UX Snapshot</button>
        </div>
        <div class="observeux-action-row">
          <button id="observeux-copy-brief" class="observeux-btn observeux-hook" type="button" title="Paste-ready brief for Slack, Notion, or email">
            Copy Brief
          </button>
        </div>
        <div id="observeux-export-card" class="observeux-card observeux-export-card">
          <h4>Client export</h4>
          <p id="observeux-export-lock" class="observeux-disclosure observeux-pro-lock hidden">
            Branded .md, .txt, and print/PDF reports. Set agency name in Options.
          </p>
          <div class="observeux-action-row observeux-export-row">
            <button id="observeux-export-md" class="observeux-btn" type="button">.md</button>
            <button id="observeux-export-txt" class="observeux-btn" type="button">.txt</button>
            <button id="observeux-export-pdf" class="observeux-btn observeux-primary" type="button">Print / PDF</button>
          </div>
        </div>
        <div class="observeux-card observeux-disclosure">
          Advisory suggestions only. Visible UI — you synthesize and decide.
        </div>
        <div class="observeux-results"></div>
        <div id="observeux-compare-card" class="observeux-card observeux-compare-card">
          <h4>Compare Competitors (up to 5)</h4>
          <p id="observeux-compare-lock" class="observeux-disclosure observeux-pro-lock hidden">
            Save competitor URLs and run side-by-side snapshots. Unlock in extension Options.
          </p>
          <div class="observeux-compare-row">
            <input id="observeux-url-input" type="text" inputmode="url" autocomplete="off" placeholder="sephora.com or https://…" />
            <button id="observeux-add-url" class="observeux-btn">Add</button>
          </div>
          <ul id="observeux-url-list" class="observeux-url-list"></ul>
          <div class="observeux-action-row">
            <button id="observeux-compare-selected" class="observeux-btn">Compare Competitors</button>
            <button id="observeux-remove-selected" class="observeux-btn">Remove Selected</button>
          </div>
          <button id="observeux-clear-urls" class="observeux-btn">Clear List</button>
          <div class="observeux-card observeux-compare-summary">Add competitor URLs, open each site in a tab, then Compare. This page is included automatically.</div>
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
      await applyTierUi(existing);
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
