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

  const EXPECTED_BY_SITE_TYPE = {
    ecommerce: ['search', 'navigation', 'cart', 'checkout', 'reviews', 'support'],
    saas_or_web_app: ['navigation', 'auth', 'pricing', 'support', 'onboarding'],
    simple_marketing_site: ['navigation', 'cta', 'pricing', 'support'],
    general_web_app: ['navigation', 'search', 'support', 'auth'],
    marketplace: ['search', 'navigation', 'filters', 'reviews', 'auth']
  };

  /** Plain-language context for why a site type has a benchmark baseline. */
  const SITE_TYPE_GAP_CONTEXT = {
    marketplace: {
      intro:
        'Marketplace pages usually help people browse many listings from different sellers. Shoppers often expect quick ways to search, move between categories, narrow results, read social proof, and sign in before they buy or list.',
      peerSnapshot:
        'Competitive marketplace snapshots commonly show search in the header, category navigation, filter controls on listing views, review or rating cues near products, and visible account entry points.'
    },
    ecommerce: {
      intro:
        'E-commerce pages usually guide someone from discovery to purchase in a few clear steps. Shoppers often expect search, navigation, cart access, a path to checkout, reviews, and somewhere to turn when something goes wrong.',
      peerSnapshot:
        'Typical store snapshots surface product search, primary navigation, cart icon or link, checkout affordances, review widgets, and help or policy links — often in the header or footer.'
    },
    saas_or_web_app: {
      intro:
        'SaaS and web app pages usually orient new and returning users quickly: where to go, how to sign in, what it costs, how to get help, and sometimes a first-run tour.',
      peerSnapshot:
        'Common SaaS snapshots show primary navigation, sign-in or sign-up entry points, pricing or plan cues, support or docs links, and onboarding hints on first visit.'
    },
    simple_marketing_site: {
      intro:
        'Marketing sites usually make the offer obvious fast: clear navigation, a primary call to action, pricing or plan information when relevant, and a way to reach the team or find answers.',
      peerSnapshot:
        'Typical landing-page snapshots lead with navigation, a prominent CTA, pricing or “Get started” paths, and contact or help links in the header or footer.'
    },
    general_web_app: {
      intro:
        'General web apps often combine browsing, account access, and task completion. People usually expect navigation, search on larger sites, help when stuck, and sign-in when the experience is personalized.',
      peerSnapshot:
        'Many app snapshots show header navigation, search on content-heavy views, account entry points, and help or FAQ links — though patterns vary widely by product.'
    }
  };

  /**
   * Why a feature matters when it is missing from the benchmark set.
   * `hint` = common false-negative (present but not detected).
   */
  const FEATURE_GAP_RATIONALE = {
    search: {
      why:
        'Search helps people jump straight to what they want instead of clicking through every category — especially when the catalog is large.',
      hint: 'May appear as a magnifying-glass icon, “Find”, or a collapsed field that only opens after click.'
    },
    navigation: {
      why:
        'Primary navigation orients visitors and shows what the site considers important — categories, departments, or core product areas.',
      hint: 'May live in a hamburger menu, mega-menu, or custom component whose markup does not use a literal nav element.'
    },
    cart: {
      why:
        'A visible cart or bag cue reassures shoppers their selections are saved and gives a clear next step toward purchase.',
      hint: 'Often an icon with a badge count, or labeled Basket / Bag without “cart” in the class name.'
    },
    checkout: {
      why:
        'Checkout affordances signal how someone finishes a purchase — even before they add an item, it sets expectations about friction and trust.',
      hint: 'May only appear after items are added, or use labels like “Pay”, “Secure checkout”, or a multi-step drawer.'
    },
    reviews: {
      why:
        'Reviews and ratings help visitors judge quality and trust — particularly when they cannot inspect the product in person.',
      hint: 'May use stars without the word “review”, or load below the fold / inside tabs on product detail pages.'
    },
    filters: {
      why:
        'Filters help people narrow a large set of listings by price, location, category, or attributes — core to marketplace browsing.',
      hint: 'May be labeled Sort, Refine, Facets, or live in a sidebar that is collapsed on mobile until opened.'
    },
    auth: {
      why:
        'Sign-in and sign-up entry points matter when accounts unlock saved items, seller tools, order history, or personalized results.',
      hint: 'May say Log in, Register, My account, or appear only after clicking an avatar or profile menu.'
    },
    pricing: {
      why:
        'Pricing cues help visitors decide whether to invest time in a trial or demo — especially on SaaS and marketing sites.',
      hint: 'May use Plans, Subscribe, or tier cards without “pricing” in the URL or class name.'
    },
    support: {
      why:
        'Help and support reduce hesitation when something breaks, policies are unclear, or a buyer needs reassurance before committing.',
      hint: 'Often labeled Contact, Customer service, FAQ, Help center, or Trust & safety — without “help” or “support” in links or classes.'
    },
    onboarding: {
      why:
        'Onboarding or tour patterns help first-time users learn layout and key actions without reading documentation.',
      hint: 'May appear as a one-time modal, checklist, or coach marks that only show on first visit.'
    },
    cta: {
      why:
        'A clear primary call to action tells visitors the one thing the page wants them to do next — sign up, buy, book, or learn more.',
      hint: 'May be a single hero button whose styling does not match generic btn class patterns.'
    }
  };

  const SITE_FEATURE_GAP_EMPHASIS = {
    marketplace: {
      search: 'On marketplaces, search is often the fastest path across thousands of listings — absence can push all discovery through browse alone.',
      filters: 'Marketplace shoppers frequently expect to slice listings by price, location, condition, or seller — filters are part of the core loop.',
      reviews: 'Trust between buyer and seller is central; review or rating cues near listings are a common competitive pattern.',
      auth: 'Accounts often gate saved searches, messaging, seller dashboards, or checkout — visible entry points set expectations early.',
      navigation: 'Category and department navigation helps people explore inventory when they do not yet know what to search for.',
      support: 'Buyers may look for dispute help, return policies, or seller rules before transacting — especially with third-party listings.'
    },
    ecommerce: {
      search: 'Store shoppers often search by product name or SKU; missing search can force long category drills.',
      cart: 'Cart visibility is a strong e-commerce convention — it confirms selections and shortens the path to checkout.',
      checkout: 'Even on browse-heavy pages, signaling how checkout works builds confidence before add-to-cart.',
      reviews: 'Product reviews are a standard trust layer on retail sites.',
      support: 'Returns, shipping, and warranty questions are common pre-purchase — help links signal policy transparency.'
    },
    saas_or_web_app: {
      auth: 'Returning users expect a obvious sign-in; prospects may look for sign-up near the hero.',
      pricing: 'Plan or pricing visibility is a common SaaS pattern for self-serve evaluation.',
      onboarding: 'First-run tours or empty states help new users map the product without reading docs.',
      support: 'Docs, chat, or “Contact sales” often sit in header or footer for stuck users.'
    },
    simple_marketing_site: {
      cta: 'Marketing pages usually lead with one primary action — its absence can make intent ambiguous.',
      pricing: 'Even simple sites often surface pricing, “Book a demo”, or tier cards for qualification.',
      support: 'Contact or FAQ links reassure visitors who are not ready for the main CTA.'
    },
    general_web_app: {
      search: 'On larger apps, search is a safety net when navigation alone cannot surface the right screen.',
      auth: 'Personalized experiences usually expose account entry somewhere in the chrome.',
      support: 'Help, FAQ, or feedback links are a common fallback when in-app guidance is thin.'
    }
  };

  function labelFeature(key) {
    return FEATURE_LABELS[key] || key;
  }

  function labelSiteType(key) {
    return SITE_TYPE_LABELS[key] || key;
  }

  function getSiteTypeGapContext(siteTypeKey) {
    return (
      SITE_TYPE_GAP_CONTEXT[siteTypeKey] || {
        intro:
          'This page was compared against common patterns for similar sites. Gaps flag conventions that peers often show in the main view — not a verdict that your UX is wrong.',
        peerSnapshot:
          'Benchmarks are conservative and based on visible structure only, not analytics or user research.'
      }
    );
  }

  function getFeatureGapRationale(featureKey, siteTypeKey) {
    const base = FEATURE_GAP_RATIONALE[featureKey] || {
      why: `${labelFeature(featureKey)} is part of the benchmark set for this site type — peers often expose it without deep digging.`,
      hint: 'It may use different labeling, sit in a menu, or appear only after interaction.'
    };
    const emphasis = SITE_FEATURE_GAP_EMPHASIS[siteTypeKey]?.[featureKey] || '';
    return {
      why: emphasis || base.why,
      hint: base.hint || 'It may use different labeling or sit outside the current viewport.'
    };
  }

  function getExpectedFeatureLabels(siteTypeKey) {
    const keys = EXPECTED_BY_SITE_TYPE[siteTypeKey] || EXPECTED_BY_SITE_TYPE.general_web_app;
    return keys.map((key) => labelFeature(key));
  }

  globalScope.ObserveUXFeatureTaxonomy = {
    FEATURE_LABELS,
    SITE_TYPE_LABELS,
    EXPECTED_BY_SITE_TYPE,
    labelFeature,
    labelSiteType,
    getSiteTypeGapContext,
    getFeatureGapRationale,
    getExpectedFeatureLabels
  };
})(window);
