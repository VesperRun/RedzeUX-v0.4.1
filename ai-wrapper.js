// ai-wrapper.js
// Structured payloads and bounded AI-style suggestions (no raw DOM).

(function initAiWrapper(globalScope) {
  const STORAGE_KEYS = {
    aiEnabled: 'observeux_ai_enabled',
    aiEndpoint: 'observeux_ai_endpoint',
    aiApiKey: 'observeux_ai_api_key'
  };

  function labelFeature(name) {
    const tax = globalScope.ObserveUXFeatureTaxonomy;
    return tax ? tax.labelFeature(name) : name;
  }

  function buildStructuredSummary(detection, heuristics) {
    return {
      site_type: detection.siteType,
      site_type_label: heuristics.categoryBenchmark?.siteTypeLabel || detection.siteType,
      detected_features: heuristics.observableFeatures.map((item) => item.name),
      detected_feature_labels: heuristics.observableFeatures.map((item) => item.label || labelFeature(item.name)),
      prominent_features: heuristics.prominentFeatures.map((item) => item.name),
      missing_features: heuristics.missingWeakFeatures.map((item) => item.name),
      missing_feature_labels: heuristics.missingWeakFeatures.map((item) => item.label || labelFeature(item.name)),
      category_gaps: (heuristics.categoryBenchmark?.categoryGaps || []).map((item) => item.label),
      possible_friction_points: heuristics.possibleFrictionPoints.map((item) => item.text),
      evidence_scope: detection.evidenceScope || 'light_dom',
      observation_limits: detection.observationLimits || {},
      confidence_context: heuristics.confidenceGuide
    };
  }

  function localSuggestionFallback(summary) {
    const suggestions = [];
    if (summary.missing_features.includes('search')) {
      suggestions.push('People may find content faster if a clear search option is visible.');
    }
    if (summary.missing_features.includes('support')) {
      suggestions.push('Visitors might feel more confident if help options are easier to find.');
    }
    if ((summary.category_gaps || []).length > 0) {
      suggestions.push(
        `For this type of site, you might review whether ${summary.category_gaps.slice(0, 2).join(' and ')} should be easier to spot.`
      );
    }
    if (summary.possible_friction_points.some((p) => p.toLowerCase().includes('dense'))) {
      suggestions.push('Spacing and visual grouping could be simplified to reduce overwhelm.');
    }
    if (summary.prominent_features.includes('cta') && summary.prominent_features.length > 2) {
      suggestions.push('Important buttons could stand out more clearly with fewer competing actions.');
    }
    if (summary.evidence_scope === 'light_dom_closed_shadow_limited') {
      suggestions.push('Some UI may live inside closed components; scroll or open menus before concluding a feature is missing.');
    }
    if (suggestions.length === 0) {
      suggestions.push('Insufficient visible evidence for strong change suggestions right now.');
    }
    return suggestions.map((text) => ({
      text,
      confidence: 'advisory',
      source: 'local_bounded_rules'
    }));
  }

  async function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        [STORAGE_KEYS.aiEnabled, STORAGE_KEYS.aiEndpoint, STORAGE_KEYS.aiApiKey],
        (result) => resolve(result)
      );
    });
  }

  async function fetchAiSuggestions(summary, settings) {
    const promptPayload = {
      instruction:
        'You are an observational UX assistant. Use only the provided structured summary. Do not claim hidden analytics, certainty, or guaranteed outcomes. Use plain language and cautious terms like may/might/could.',
      constraints: {
        max_suggestions: 5,
        tone: 'plain_non_technical',
        uncertainty_required: true,
        reject_if_insufficient_evidence: true
      },
      summary
    };

    const response = await fetch(settings[STORAGE_KEYS.aiEndpoint], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings[STORAGE_KEYS.aiApiKey]}`
      },
      body: JSON.stringify(promptPayload)
    });
    if (!response.ok) {
      throw new Error(`AI endpoint failed with status ${response.status}`);
    }
    const data = await response.json();
    const list = Array.isArray(data.suggestions) ? data.suggestions : [];
    return list.map((text) => ({
      text: String(text),
      confidence: 'advisory',
      source: 'remote_ai_structured'
    }));
  }

  async function generateSuggestions(detection, heuristics) {
    const summary = buildStructuredSummary(detection, heuristics);
    const settings = await getSettings();
    const aiEnabled = Boolean(settings[STORAGE_KEYS.aiEnabled]);
    const hasRemoteConfig =
      typeof settings[STORAGE_KEYS.aiEndpoint] === 'string' &&
      settings[STORAGE_KEYS.aiEndpoint].length > 0 &&
      typeof settings[STORAGE_KEYS.aiApiKey] === 'string' &&
      settings[STORAGE_KEYS.aiApiKey].length > 0;
    const proForRemote = globalScope.RedzeUXEntitlements
      ? await globalScope.RedzeUXEntitlements.canUseRemoteAi()
      : false;

    if (!aiEnabled || !hasRemoteConfig || !proForRemote) {
      return {
        aiSuggestions: localSuggestionFallback(summary),
        aiMode: 'local_fallback',
        structuredPayload: summary
      };
    }

    try {
      const remoteSuggestions = await fetchAiSuggestions(summary, settings);
      if (remoteSuggestions.length === 0) {
        return {
          aiSuggestions: localSuggestionFallback(summary),
          aiMode: 'remote_empty_fallback',
          structuredPayload: summary
        };
      }
      return {
        aiSuggestions: remoteSuggestions,
        aiMode: 'remote_structured',
        structuredPayload: summary
      };
    } catch (error) {
      return {
        aiSuggestions: localSuggestionFallback(summary),
        aiMode: 'remote_error_fallback',
        structuredPayload: summary,
        aiError: error.message
      };
    }
  }

  globalScope.ObserveUXAiWrapper = {
    generateSuggestions,
    buildStructuredSummary
  };
})(window);
