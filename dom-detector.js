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

  let nodesScanned = 0;

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight * 1.5;
  }

  function queryVisibleInRoot(root, selector) {
    let count = 0;
    if (nodesScanned >= MAX_NODES_SCANNED) return 0;
    try {
      const nodes = root.querySelectorAll(selector);
      for (let i = 0; i < nodes.length; i += 1) {
        if (nodesScanned >= MAX_NODES_SCANNED) break;
        nodesScanned += 1;
        if (isVisible(nodes[i])) count += 1;
      }
    } catch (err) {
      // Invalid selector in some roots — skip safely.
    }
    return count;
  }

  function walkShadowRoots(root, depth, stats) {
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
        walkShadowRoots(shadow, depth + 1, stats);
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

  function safeCount(selectorList, roots) {
    let total = 0;
    selectorList.forEach((selector) => {
      roots.forEach((root) => {
        total += queryVisibleInRoot(root, selector);
      });
    });
    return total;
  }

  function getSearchRoots() {
    const roots = [document];
    const stats = { openShadowRoots: 0 };
    walkShadowRoots(document, 0, stats);
    // Collect open shadow roots one level deep for querying (bounded).
    try {
      document.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot && roots.length < 12) {
          roots.push(el.shadowRoot);
        }
      });
    } catch (err) {
      // Ignore.
    }
    return { roots, stats };
  }

  function repeatedStructureScore(roots) {
    const classMap = new Map();
    roots.forEach((root) => {
      try {
        root.querySelectorAll('section, article, li, div').forEach((node) => {
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

  function detectFeatures() {
    nodesScanned = 0;
    const { roots, stats: shadowStats } = getSearchRoots();
    const closedHosts = countClosedShadowHosts();

    const featureCounts = {};
    Object.entries(SELECTORS).forEach(([feature, selectors]) => {
      featureCounts[feature] = safeCount(selectors, roots);
    });

    const ctaCount = featureCounts.cta || 0;
    const headingCount = safeCount(['h1', 'h2', 'h3'], roots);
    const formCount = safeCount(['form', 'input', 'textarea', 'select'], roots);

    const evidenceScope = buildEvidenceScope(shadowStats, closedHosts);

    return {
      url: location.href,
      title: document.title || 'Untitled page',
      timestamp: new Date().toISOString(),
      siteType: estimateSiteType(featureCounts),
      featureCounts,
      featureDensityScore: Math.min(100, Math.round((ctaCount + formCount + headingCount) * 1.6)),
      repeatedStructureScore: repeatedStructureScore(roots),
      ctaCount,
      headingCount,
      formCount,
      evidenceScope,
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
    detectFeatures
  };
})(window);
