// feature-taxonomy.js
// Shared UX feature labels and category expectations (competitive benchmark baseline).

(function initFeatureTaxonomy(globalScope) {
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

  const SITE_TYPE_LABELS = {
    ecommerce: 'E-commerce',
    saas_or_web_app: 'SaaS / web app',
    simple_marketing_site: 'Marketing site',
    general_web_app: 'General web app',
    marketplace: 'Marketplace'
  };

  const EXPECTED_BY_SITE_TYPE = {
    ecommerce: ['search', 'navigation', 'cart', 'checkout', 'reviews', 'support'],
    saas_or_web_app: ['navigation', 'auth', 'pricing', 'support', 'onboarding'],
    simple_marketing_site: ['navigation', 'cta', 'pricing', 'support'],
    general_web_app: ['navigation', 'search', 'support', 'auth'],
    marketplace: ['search', 'navigation', 'filters', 'reviews', 'auth']
  };

  function labelFeature(key) {
    return FEATURE_LABELS[key] || key;
  }

  function labelSiteType(key) {
    return SITE_TYPE_LABELS[key] || key;
  }

  globalScope.ObserveUXFeatureTaxonomy = {
    FEATURE_LABELS,
    SITE_TYPE_LABELS,
    EXPECTED_BY_SITE_TYPE,
    labelFeature,
    labelSiteType
  };
})(window);
