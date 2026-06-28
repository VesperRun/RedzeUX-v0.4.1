// comparison-benchmark.js
// Side-by-side comparison matrix and gap narrative (service worker module).

const FEATURE_LABELS = {
  search: 'Search',
  navigation: 'Navigation',
  cart: 'Shopping cart',
  checkout: 'Checkout',
  reviews: 'Reviews',
  rewards: 'Rewards / loyalty',
  chat: 'Live chat',
  onboarding: 'Onboarding / tour',
  filters: 'Filters',
  dashboard: 'Dashboard',
  accessibility: 'Accessibility cues',
  pwaIndicator: 'PWA / mobile app',
  personalization: 'Personalization',
  cta: 'Buttons / calls to action',
  auth: 'Sign in / sign up',
  pricing: 'Pricing',
  support: 'Help / support',
  wishlist: 'Wishlist',
  newsletter: 'Newsletter signup',
  breadcrumbs: 'Breadcrumbs',
  trustSignals: 'Trust badges',
  socialProof: 'Social proof',
  footerNav: 'Footer links'
};

export function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    parsed.pathname = path;
    return parsed.href;
  } catch (error) {
    return String(url || '').trim();
  }
}

function labelFeature(key) {
  return FEATURE_LABELS[key] || key;
}

function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch (error) {
    return url;
  }
}

export function buildComparisonBenchmark(results) {
  const completed = results.filter((item) => item.status === 'ok' && item.analysis);
  if (completed.length < 2) {
    return {
      ok: false,
      narrative: 'Insufficient visible evidence for reliable side-by-side comparison.',
      matrix: [],
      commonFeatures: [],
      uniqueBySite: [],
      gapsAcrossSites: []
    };
  }

  const sites = completed.map((item) => ({
    url: item.url,
    host: hostLabel(item.url),
    features: new Set(item.analysis.summary?.detected_features || []),
    siteType: item.analysis.siteType || item.analysis.summary?.site_type || 'general_web_app'
  }));

  const allFeatures = new Set();
  sites.forEach((site) => {
    site.features.forEach((feature) => allFeatures.add(feature));
  });

  const matrix = Array.from(allFeatures)
    .sort()
    .map((feature) => {
      const presence = sites.map((site) => site.features.has(feature));
      const presentCount = presence.filter(Boolean).length;
      return {
        feature,
        label: labelFeature(feature),
        presence,
        presentCount,
        coverage: `${presentCount}/${sites.length}`
      };
    });

  const commonFeatures = matrix
    .filter((row) => row.presentCount === sites.length)
    .map((row) => row.label);

  const uniqueBySite = sites.map((site) => {
    const unique = matrix
      .filter((row) => row.presence[sites.indexOf(site)] && row.presentCount === 1)
      .map((row) => row.label);
    return { host: site.host, unique };
  });

  const gapsAcrossSites = matrix
    .filter((row) => row.presentCount > 0 && row.presentCount < sites.length)
    .map((row) => ({
      label: row.label,
      coverage: row.coverage,
      missingOn: sites
        .filter((_, index) => !row.presence[index])
        .map((site) => site.host)
    }));

  let narrative = '';
  if (commonFeatures.length > 0) {
    narrative += `Shared visible patterns: ${commonFeatures.slice(0, 6).join(', ')}. `;
  }
  if (gapsAcrossSites.length > 0) {
    const topGap = gapsAcrossSites[0];
    narrative += `Notable gap: "${topGap.label}" appears on ${topGap.coverage} sites (missing on ${topGap.missingOn.join(', ')}).`;
  } else if (commonFeatures.length === 0) {
    narrative = 'Compared sites show few overlapping visible patterns from current page views.';
  }

  return {
    ok: true,
    narrative: narrative.trim(),
    matrix,
    commonFeatures,
    uniqueBySite,
    gapsAcrossSites,
    siteCount: sites.length
  };
}

export function findTabForUrl(tabs, targetUrl) {
  const normalized = normalizeUrl(targetUrl);
  const exact = tabs.find((tab) => tab.url === targetUrl);
  if (exact) return exact;
  return tabs.find((tab) => normalizeUrl(tab.url) === normalized);
}
