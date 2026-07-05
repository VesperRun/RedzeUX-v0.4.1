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

export function compareHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (error) {
    return String(url || '').trim().toLowerCase();
  }
}

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

function buildSiteRecord(item) {
  const summary = item.analysis?.summary || {};
  const features = summary.detected_features || [];
  const featureLabels =
    summary.detected_feature_labels?.length > 0
      ? summary.detected_feature_labels
      : features.map(labelFeature);
  const missingLabels =
    summary.missing_feature_labels?.length > 0
      ? summary.missing_feature_labels
      : (summary.missing_features || []).map(labelFeature);

  return {
    url: item.url,
    host: hostLabel(item.url),
    title: item.analysis?.title || '',
    siteType: item.analysis?.siteType || summary.site_type || 'general_web_app',
    siteTypeLabel: summary.site_type_label || item.analysis?.siteType || 'Web page',
    features,
    featureLabels,
    missingLabels,
    evidenceScope: item.analysis?.evidenceScope || summary.evidence_scope || 'light_dom'
  };
}

function buildDetailedNarrative(sites, commonFeatures, gapsAcrossSites, uniqueBySite) {
  const parts = [`Side-by-side read of ${sites.length} sites: ${sites.map((s) => s.host).join(', ')}.`];

  for (const site of sites) {
    const visible =
      site.featureLabels.length > 0
        ? site.featureLabels.slice(0, 8).join(', ')
        : 'no visible patterns detected (try focusing that tab and comparing again)';
    const missing =
      site.missingLabels.length > 0
        ? ` · Benchmark gaps: ${site.missingLabels.slice(0, 4).join(', ')}`
        : '';
    const pageHint = site.title ? ` (“${site.title.slice(0, 60)}”)` : '';
    parts.push(`${site.host}${pageHint}: ${visible}${missing}.`);
  }

  if (commonFeatures.length > 0) {
    parts.push(`Shared across all ${sites.length}: ${commonFeatures.join(', ')}.`);
  }

  for (const gap of gapsAcrossSites.slice(0, 5)) {
    parts.push(
      `"${gap.label}" on ${gap.coverage} site(s) — not visible on ${gap.missingOn.join(', ')}.`
    );
  }

  for (const entry of uniqueBySite) {
    if (entry.unique.length > 0) {
      parts.push(`Distinct on ${entry.host}: ${entry.unique.join(', ')}.`);
    }
  }

  if (sites.every((site) => site.features.length === 0)) {
    parts.push(
      'Background tabs often snapshot empty — click each competitor tab once, then Compare again.'
    );
  }

  return parts.join(' ');
}

export function buildComparisonBenchmark(results) {
  const completed = results.filter((item) => item.status === 'ok' && item.analysis);
  if (completed.length < 2) {
    return {
      ok: false,
      narrative: 'Insufficient visible evidence for reliable side-by-side comparison.',
      matrix: [],
      sites: [],
      commonFeatures: [],
      uniqueBySite: [],
      gapsAcrossSites: []
    };
  }

  const sites = completed.map(buildSiteRecord);

  const allFeatures = new Set();
  sites.forEach((site) => {
    site.features.forEach((feature) => allFeatures.add(feature));
  });

  const matrix = Array.from(allFeatures)
    .sort()
    .map((feature) => {
      const presence = sites.map((site) => site.features.includes(feature));
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

  const uniqueBySite = sites.map((site, siteIndex) => {
    const unique = matrix
      .filter((row) => row.presence[siteIndex] && row.presentCount === 1)
      .map((row) => row.label);
    return { host: site.host, unique };
  });

  const gapsAcrossSites = matrix
    .filter((row) => row.presentCount > 0 && row.presentCount < sites.length)
    .map((row) => ({
      label: row.label,
      coverage: row.coverage,
      missingOn: sites.filter((_, index) => !row.presence[index]).map((site) => site.host)
    }));

  const narrative = buildDetailedNarrative(sites, commonFeatures, gapsAcrossSites, uniqueBySite);

  return {
    ok: true,
    narrative: narrative.trim(),
    matrix,
    sites,
    commonFeatures,
    uniqueBySite,
    gapsAcrossSites,
    siteCount: sites.length
  };
}

export function findTabForUrl(tabs, targetUrl, excludeTabIds = null) {
  const excluded = excludeTabIds || new Set();
  const targetHost = compareHost(targetUrl);
  if (!targetHost) return null;

  const candidates = (tabs || []).filter(
    (tab) =>
      typeof tab.id === 'number' &&
      !excluded.has(tab.id) &&
      typeof tab.url === 'string' &&
      /^https?:\/\//i.test(tab.url)
  );

  const exact = candidates.find((tab) => tab.url === targetUrl);
  if (exact) return exact;

  const normalized = normalizeUrl(targetUrl);
  const normalizedMatch = candidates.find((tab) => normalizeUrl(tab.url) === normalized);
  if (normalizedMatch) return normalizedMatch;

  return candidates.find((tab) => compareHost(tab.url) === targetHost);
}
