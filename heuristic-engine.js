// heuristic-engine.js
// Converts observable facts into bounded heuristics with plain-language labels and category benchmarks.

(function initHeuristicEngine(globalScope) {
  function getTaxonomy() {
    return globalScope.ObserveUXFeatureTaxonomy || null;
  }

  function labelFeature(name) {
    const tax = getTaxonomy();
    return tax ? tax.labelFeature(name) : name;
  }

  function labelSiteType(name) {
    const tax = getTaxonomy();
    return tax ? tax.labelSiteType(name) : name;
  }

  function getExpectations(siteType) {
    const tax = getTaxonomy();
    const fallback = {
      ecommerce: ['search', 'navigation', 'cart', 'checkout', 'reviews', 'support'],
      saas_or_web_app: ['navigation', 'auth', 'pricing', 'support', 'onboarding'],
      simple_marketing_site: ['navigation', 'cta', 'pricing', 'support'],
      general_web_app: ['navigation', 'search', 'support', 'auth'],
      marketplace: ['search', 'navigation', 'filters', 'reviews', 'auth']
    };
    const map = tax?.EXPECTED_BY_SITE_TYPE || fallback;
    return map[siteType] || map.general_web_app;
  }

  function topFeatures(featureCounts, limit = 5) {
    return Object.entries(featureCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name]) => name);
  }

  function missingOrWeak(featureCounts, siteType) {
    return getExpectations(siteType).filter((feature) => (featureCounts[feature] || 0) === 0);
  }

  function categoryBenchmark(detection) {
    const expectedKeys = getExpectations(detection.siteType);
    const gaps = expectedKeys.filter((key) => (detection.featureCounts[key] || 0) === 0);
    const siteLabel = labelSiteType(detection.siteType);
    let narrative = `Visible patterns align with a ${siteLabel} style page.`;
    if (gaps.length > 0) {
      narrative = `For a ${siteLabel} experience, these common patterns are not clearly visible here: ${gaps
        .map(labelFeature)
        .join(', ')}.`;
    }
    return {
      siteType: detection.siteType,
      siteTypeLabel: siteLabel,
      expectedFeatures: expectedKeys.map((key) => ({ key, label: labelFeature(key) })),
      categoryGaps: gaps.map((key) => ({ key, label: labelFeature(key), confidence: 'medium' })),
      narrative,
      confidence: 'medium'
    };
  }

  function evidenceScopeNote(detection) {
    const scope = detection.evidenceScope || 'light_dom';
    const limits = detection.observationLimits || {};
    if (scope === 'light_dom_plus_open_shadow') {
      return `Evidence includes light DOM and up to ${limits.openShadowRootsScanned || 0} open shadow region(s). Closed or iframe content is excluded.`;
    }
    if (scope === 'light_dom_closed_shadow_limited') {
      return 'Evidence is mostly light DOM. Some custom elements may hide UI in closed shadow roots we cannot read.';
    }
    return 'Evidence is from visible light DOM only (no iframes, no closed shadows).';
  }

  function inferFriction(detection) {
    const issues = [];
    if (detection.featureDensityScore > 75) {
      issues.push('The page appears visually dense, which may make scanning harder.');
    }
    if ((detection.featureCounts.search || 0) === 0 && (detection.featureCounts.navigation || 0) > 0) {
      issues.push('There is no clear search option visible for faster finding.');
    }
    if ((detection.featureCounts.support || 0) === 0) {
      issues.push('Support or help access is not obvious from visible structure.');
    }
    if ((detection.featureCounts.auth || 0) === 0 && detection.siteType !== 'simple_marketing_site') {
      issues.push('Account entry points are not clearly visible from the current view.');
    }
    if ((detection.featureCounts.accessibility || 0) < 6) {
      issues.push('Visible accessibility cues appear limited.');
    }
    if ((detection.observationLimits?.closedShadowHostsEstimated || 0) > 3) {
      issues.push('Several custom elements may hide controls inside closed shadow regions.');
    }
    return issues;
  }

  function heuristicInsights(detection) {
    const notes = [];
    const top = topFeatures(detection.featureCounts, 3).map(labelFeature);
    if (top.length > 0) {
      notes.push(`Most repeated visible patterns are: ${top.join(', ')}.`);
    }
    if ((detection.featureCounts.cta || 0) > 14) {
      notes.push('The number of action buttons appears high, which may split user attention.');
    }
    if (detection.repeatedStructureScore > 50) {
      notes.push('Repeated layout blocks suggest a strong template pattern.');
    }
    if ((detection.featureCounts.pwaIndicator || 0) > 0) {
      notes.push('This experience likely supports mobile/PWA behavior.');
    }
    if (notes.length === 0) {
      notes.push('Insufficient visible evidence for strong heuristic patterns.');
    }
    return notes;
  }

  function categorize(detection) {
    const observedFeatures = Object.entries(detection.featureCounts)
      .filter(([, count]) => count > 0)
      .map(([name, count]) => ({
        name,
        label: labelFeature(name),
        count,
        confidence: 'high'
      }));

    const prominent = topFeatures(detection.featureCounts).map((name) => ({
      name,
      label: labelFeature(name),
      confidence: 'medium'
    }));

    const missing = missingOrWeak(detection.featureCounts, detection.siteType).map((name) => ({
      name,
      label: labelFeature(name),
      confidence: 'medium'
    }));

    const insights = heuristicInsights(detection).map((text) => ({
      text,
      confidence: 'medium'
    }));

    const friction = inferFriction(detection).map((text) => ({
      text,
      confidence: 'medium'
    }));

    return {
      observableFeatures: observedFeatures,
      prominentFeatures: prominent,
      missingWeakFeatures: missing,
      heuristicInsights: insights,
      possibleFrictionPoints: friction,
      categoryBenchmark: categoryBenchmark(detection),
      evidenceScopeNote: evidenceScopeNote(detection),
      confidenceGuide: {
        high: 'observable facts from visible UI',
        medium: 'heuristic interpretation from visible patterns',
        advisory: 'AI suggestions only, not guaranteed outcomes'
      }
    };
  }

  globalScope.ObserveUXHeuristicEngine = {
    categorize,
    labelFeature
  };
})(window);
