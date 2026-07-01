// dom-detector.js
// Observable visible UI detection (light DOM + bounded open shadow roots only).

(function initDomDetector(globalScope) {
  const SELECTORS = {
    search: [
      'input[type="search"]',
      'input[name*="search" i]',
      '[role="search"]',
      '[role="search"] input',
      'form[role="search"]'
    ],
    navigation: ['nav', '[role="navigation"]', '.navbar', '.nav-menu', 'header nav'],
    cart: ['[href*="cart" i]', '[class*="cart" i]', '[aria-label*="cart" i]'],
    checkout: ['[href*="checkout" i]', 'button[name*="checkout" i]', '[class*="checkout" i]'],
    reviews: ['[class*="review" i]', '[aria-label*="review" i]', '[href*="review" i]'],
    rewards: ['[class*="reward" i]', '[href*="loyalty" i]', '[class*="loyalty" i]'],
    chat: ['iframe[src*="chat" i]', '[class*="chat-widget" i]', '[aria-label*="chat" i]'],
    onboarding: ['[class*="onboarding" i]', '[class*="walkthrough" i]', '[data-tour]'],
    filters: ['[class*="filter" i]', '[aria-label*="filter" i]', '[data-testid*="filter" i]'],
    dashboard: ['[class*="dashboard" i]', '[aria-label*="dashboard" i]', 'main [class*="widget" i]'],
    accessibility: ['[aria-label]', '[role]', 'html[lang]', 'img[alt]', '[tabindex]'],
    pwaIndicator: ['link[rel="manifest"]', 'meta[name="apple-mobile-web-app-capable"]'],
    personalization: ['[class*="recommended" i]', '[class*="for-you" i]', '[data-personalized]'],
    cta: ['button', '[role="button"]', 'a[class*="btn" i]'],
    auth: ['input[type="email"]', 'input[type="password"]', '[href*="login" i]', '[href*="signup" i]'],
    pricing: ['[class*="pricing" i]', '[href*="pricing" i]', '[data-plan]'],
    support: ['[href*="support" i]', '[href*="help" i]', '[class*="support" i]', '[class*="faq" i]'],
    wishlist: ['[href*="wishlist" i]', '[class*="wishlist" i]', '[aria-label*="wishlist" i]'],
    newsletter: ['input[type="email"][name*="newsletter" i]', '[class*="newsletter" i]'],
    breadcrumbs: ['[aria-label*="breadcrumb" i]', '.breadcrumb', 'nav[aria-label*="breadcrumb" i]'],
    trustSignals: ['[class*="trust" i]', '[class*="secure" i]', '[class*="guarantee" i]'],
    socialProof: ['[class*="testimonial" i]', '[class*="social-proof" i]'],
    footerNav: ['footer a', 'footer nav']
  };

  const MAX_SHADOW_DEPTH = 3;
  const MAX_NODES_SCANNED = 2800;
  const MAX_MATCHES_PER_FEATURE = 12;

  let nodesScanned = 0;
  let matchesCollected = 0;

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight * 1.5;
  }

  function truncate(text, max = 80) {
    return String(text || '')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .slice(0, max);
  }

  function summarizeElement(el, selector, source) {
    const tag = el.tagName.toLowerCase();
    const aria = el.getAttribute('aria-label');
    const placeholder = el.getAttribute('placeholder');
    const href = el.getAttribute('href');
    const role = el.getAttribute('role');
    const text = truncate(el.innerText || el.textContent || '', 72);
    let label = aria || placeholder || '';
    if (!label && text) label = text;
    if (!label && href) label = href;
    if (!label && role) label = `role=${role}`;
    if (!label) label = `<${tag}>`;

    return {
      tag,
      label: truncate(label, 80),
      selector: truncate(selector, 80),
      source: source.type,
      host: source.hostTag || null
    };
  }

  function queryVisibleInRoot(root, selector, onMatch) {
    let count = 0;
    if (nodesScanned >= MAX_NODES_SCANNED) return 0;
    try {
      const nodes = root.querySelectorAll(selector);
      for (let i = 0; i < nodes.length; i += 1) {
        if (nodesScanned >= MAX_NODES_SCANNED) break;
        nodesScanned += 1;
        if (isVisible(nodes[i])) {
          count += 1;
          if (onMatch) onMatch(nodes[i]);
        }
      }
    } catch (err) {
      // Invalid selector in some roots — skip safely.
    }
    return count;
  }

  function walkShadowRoots(root, depth, stats, hostSummaries, seenHosts) {
    if (depth >= MAX_SHADOW_DEPTH || nodesScanned >= MAX_NODES_SCANNED) return;
    try {
      const hosts = root.querySelectorAll('*');
      for (let i = 0; i < hosts.length; i += 1) {
        if (nodesScanned >= MAX_NODES_SCANNED) break;
        const host = hosts[i];
        if (!(host instanceof Element)) continue;
        nodesScanned += 1;
        const shadow = host.shadowRoot;
        if (!shadow) continue;
        stats.openShadowRoots += 1;
        const hostTag = host.tagName.toLowerCase();
        const hostKey = `${hostTag}:${host.id || host.className || i}`;
        if (hostSummaries && seenHosts && !seenHosts.has(hostKey) && hostSummaries.length < 24) {
          seenHosts.add(hostKey);
          hostSummaries.push({
            tag: hostTag,
            id: truncate(host.id || '', 40) || null,
            classes: truncate((host.className || '').toString(), 60) || null
          });
        }
        walkShadowRoots(shadow, depth + 1, stats, hostSummaries, seenHosts);
      }
    } catch (err) {
      // Continue without shadow subtree.
    }
  }

  function countClosedShadowHosts() {
    let closed = 0;
    try {
      document.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) return;
        // Heuristic: custom elements often host closed shadows; we cannot open them.
        if (el.localName && el.localName.includes('-') && isVisible(el)) {
          closed += 1;
        }
      });
    } catch (err) {
      // Ignore.
    }
    return Math.min(closed, 50);
  }

  function safeCount(selectorList, entries, featureKey, featureMatches) {
    let total = 0;
    const matches = [];
    selectorList.forEach((selector) => {
      entries.forEach((entry) => {
        total += queryVisibleInRoot(entry.root, selector, (el) => {
          if (matches.length >= MAX_MATCHES_PER_FEATURE) return;
          if (matchesCollected >= MAX_MATCHES_PER_FEATURE * 24) return;
          matches.push(summarizeElement(el, selector, entry));
          matchesCollected += 1;
        });
      });
    });
    if (matches.length > 0) {
      featureMatches[featureKey] = matches;
    }
    return total;
  }

  function getSearchRoots() {
    const entries = [{ root: document, type: 'page', hostTag: null }];
    const stats = { openShadowRoots: 0 };
    const hostSummaries = [];
    const seenHosts = new Set();
    walkShadowRoots(document, 0, stats, hostSummaries, seenHosts);
    try {
      document.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot && entries.length < 12) {
          entries.push({
            root: el.shadowRoot,
            type: 'shadow',
            hostTag: el.tagName.toLowerCase()
          });
        }
      });
    } catch (err) {
      // Ignore.
    }
    return { entries, stats, hostSummaries };
  }

  function repeatedStructureScore(entries) {
    const classMap = new Map();
    entries.forEach((entry) => {
      try {
        entry.root.querySelectorAll('section, article, li, div').forEach((node) => {
          if (!isVisible(node)) return;
          const key = (node.className || '').toString().trim();
          if (!key || key.length < 4) return;
          classMap.set(key, (classMap.get(key) || 0) + 1);
        });
      } catch (err) {
        // Ignore.
      }
    });
    const repeatedKeys = Array.from(classMap.values()).filter((count) => count >= 4).length;
    return Math.min(100, repeatedKeys * 10);
  }

  function estimateSiteType(featureCounts) {
    if ((featureCounts.cart || 0) + (featureCounts.checkout || 0) + (featureCounts.reviews || 0) >= 3) {
      return 'ecommerce';
    }
    if ((featureCounts.filters || 0) >= 2 && (featureCounts.search || 0) >= 1) {
      return 'marketplace';
    }
    if ((featureCounts.dashboard || 0) + (featureCounts.auth || 0) + (featureCounts.pricing || 0) >= 3) {
      return 'saas_or_web_app';
    }
    if ((featureCounts.navigation || 0) + (featureCounts.cta || 0) <= 2) {
      return 'simple_marketing_site';
    }
    return 'general_web_app';
  }

  function buildEvidenceScope(shadowStats, closedHosts) {
    if (shadowStats.openShadowRoots > 0 && closedHosts > 0) {
      return 'light_dom_plus_open_shadow';
    }
    if (shadowStats.openShadowRoots > 0) {
      return 'light_dom_plus_open_shadow';
    }
    if (closedHosts > 0) {
      return 'light_dom_closed_shadow_limited';
    }
    return 'light_dom';
  }

  function buildEvidenceScopeLabel(scope) {
    const labels = {
      light_dom: 'Light DOM',
      light_dom_plus_open_shadow: 'Light DOM + open shadow',
      light_dom_closed_shadow_limited: 'Light DOM (closed shadow limited)'
    };
    return labels[scope] || scope.replace(/_/g, ' ');
  }

  function detectFeatures() {
    nodesScanned = 0;
    matchesCollected = 0;
    const { entries, stats: shadowStats, hostSummaries } = getSearchRoots();
    const closedHosts = countClosedShadowHosts();

    const featureCounts = {};
    const featureMatches = {};
    Object.entries(SELECTORS).forEach(([feature, selectors]) => {
      featureCounts[feature] = safeCount(selectors, entries, feature, featureMatches);
    });

    const ctaCount = featureCounts.cta || 0;
    const headingCount = safeCount(['h1', 'h2', 'h3'], entries, '_headings', featureMatches);
    const formCount = safeCount(['form', 'input', 'textarea', 'select'], entries, '_forms', featureMatches);

    const evidenceScope = buildEvidenceScope(shadowStats, closedHosts);

    return {
      url: location.href,
      title: document.title || 'Untitled page',
      timestamp: new Date().toISOString(),
      siteType: estimateSiteType(featureCounts),
      featureCounts,
      featureMatches,
      featureDensityScore: Math.min(100, Math.round((ctaCount + formCount + headingCount) * 1.6)),
      repeatedStructureScore: repeatedStructureScore(entries),
      ctaCount,
      headingCount,
      formCount,
      evidenceScope,
      evidenceScopeLabel: buildEvidenceScopeLabel(evidenceScope),
      evidenceDetails: {
        openShadowHosts: hostSummaries,
        closedShadowHostsEstimated: closedHosts,
        shadowRegionsScanned: shadowStats.openShadowRoots,
        iframesExcluded: true,
        credentialsExcluded: true
      },
      observationLimits: {
        openShadowRootsScanned: shadowStats.openShadowRoots,
        closedShadowHostsEstimated: closedHosts,
        nodesScanned,
        iframesExcluded: true,
        noCredentialsOrHiddenFields: true
      },
      confidence: 'high',
      privacyBoundary: 'visible_dom_only'
    };
  }

  globalScope.ObserveUXDomDetector = {
    detectFeatures,
    getFeatureSelectors(featureKey) {
      return SELECTORS[featureKey] ? [...SELECTORS[featureKey]] : [];
    }
  };
})(window);
