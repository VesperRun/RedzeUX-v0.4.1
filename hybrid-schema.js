// hybrid-schema.js — Single source of truth for hybrid tiers (Application layer).
// Free · Pro (subscription) · Agency (kit + maintenance). See PRICING.md.

(function initHybridSchema(globalScope) {
  const TIERS = {
    FREE: 'free',
    PRO: 'pro',
    AGENCY: 'agency'
  };

  globalScope.RedzeUXHybrid = {
    TIERS,
    LABELS: {
      [TIERS.FREE]: 'Free (Snapshot)',
      [TIERS.PRO]: 'Pro (Teardown)',
      [TIERS.AGENCY]: 'Agency (Kit)'
    },
    PRICING: {
      pro: { monthlyUsd: 24, annualUsd: 199 },
      agency: { licenseUsd: 1299, maintenanceUsd: 299 },
      soloSource: { licenseUsd: 349, maintenanceUsd: 99 }
    },
    KEYS: {
      PRO_PATTERN: /^RZX-PRO-[A-Z0-9]{8,}$/,
      AGENCY_PATTERN: /^RZX-AGENCY-[A-Z0-9]{8,}$/,
      DEV_PRO: 'RZX-PRO-VESPER-DEV',
      DEV_AGENCY: 'RZX-AGENCY-VESPER-DEV'
    },
    /** Which tiers unlock each capability */
    CAPABILITIES: {
      analyze: [TIERS.FREE, TIERS.PRO, TIERS.AGENCY],
      unlimitedBriefs: [TIERS.PRO, TIERS.AGENCY],
      compare: [TIERS.PRO, TIERS.AGENCY],
      clientExport: [TIERS.PRO, TIERS.AGENCY],
      remoteAi: [TIERS.PRO, TIERS.AGENCY],
      stripePortal: [TIERS.PRO],
      whiteLabelKit: [TIERS.AGENCY]
    },
    FREE_DAILY_BRIEFS: 3,
    laneSummary() {
      return [
        { id: TIERS.FREE, label: this.LABELS[TIERS.FREE], price: '$0' },
        { id: TIERS.PRO, label: this.LABELS[TIERS.PRO], price: '$24/mo · $199/yr' },
        { id: TIERS.AGENCY, label: this.LABELS[TIERS.AGENCY], price: '$1,299 + $299/yr maintenance' }
      ];
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
