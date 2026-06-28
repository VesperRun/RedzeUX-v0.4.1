// content.js
// Purpose: Orchestrate analysis in this tab and connect panel + runtime messages.

(function initContentOrchestrator(globalScope) {
  async function runSingleAnalysis() {
    const detection = globalScope.ObserveUXDomDetector.detectFeatures();
    const heuristics = globalScope.ObserveUXHeuristicEngine.categorize(detection);
    const ai = await globalScope.ObserveUXAiWrapper.generateSuggestions(detection, heuristics);
    return { detection, heuristics, ai };
  }

  async function buildCompactSummary() {
    const result = await runSingleAnalysis();
    return {
      url: result.detection.url,
      title: result.detection.title,
      siteType: result.detection.siteType,
      evidenceScope: result.detection.evidenceScope,
      summary: result.ai.structuredPayload,
      categoryGaps: (result.heuristics.categoryBenchmark?.categoryGaps || []).map((item) => item.key),
      confidenceGuide: result.heuristics.confidenceGuide
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    if (message.type === 'OBSERVEUX_OPEN_PANEL') {
      globalScope.ObserveUXFloatingPanel
        .openPanel()
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    if (message.type === 'OBSERVEUX_CLOSE_PANEL') {
      globalScope.ObserveUXFloatingPanel
        .closePanel()
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    if (message.type === 'OBSERVEUX_ANALYZE_CURRENT_PAGE') {
      runSingleAnalysis().then((result) => {
        if (globalScope.ObserveUXFloatingPanel) {
          globalScope.ObserveUXFloatingPanel.applyResults(result);
        }
        sendResponse({ ok: true, result });
      });
      return true;
    }

    if (message.type === 'OBSERVEUX_GET_COMPACT_SUMMARY') {
      buildCompactSummary().then((result) => sendResponse({ ok: true, result }));
      return true;
    }
  });

  globalScope.ObserveUXOrchestrator = {
    runSingleAnalysis
  };

  // Restore panel on navigation only if the user left it open.
  if (globalScope.ObserveUXFloatingPanel) {
    globalScope.ObserveUXFloatingPanel.restoreIfOpen();
  }
})(window);
