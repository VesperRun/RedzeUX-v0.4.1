// hybrid-schema.js — Single source of truth for hybrid tiers (Application layer).
// Launch: generous Free (early access) · Supporter subscription. See PRICING.md.

(function initHybridSchema(globalScope) {
  const TIERS = {
    FREE: 'free',
    PRO: 'pro',
    AGENCY: 'agency'
  };

  const PRICING = {
    pro: { monthlyUsd: 5, annualUsd: 39 },
    agency: { licenseUsd: 1299, maintenanceUsd: 299 },
    soloSource: { licenseUsd: 349, maintenanceUsd: 99 }
  };

  globalScope.RedzeUXHybrid = {
    TIERS,
    LABELS: {
      [TIERS.FREE]: 'Free (Early Access)',
      [TIERS.PRO]: 'Supporter',
      [TIERS.AGENCY]: 'Agency (Kit)'
    },
    PRICING,
    KEYS: {
      PRO_PATTERN: /^RZX-PRO-[A-Z0-9]{8,}$/,
      AGENCY_PATTERN: /^RZX-AGENCY-[A-Z0-9]{8,}$/,
      DEV_PRO: 'RZX-PRO-VESPER-DEV',
      DEV_AGENCY: 'RZX-AGENCY-VESPER-DEV'
    },
    /** Which tiers unlock each capability */
    CAPABILITIES: {
      analyze: [TIERS.FREE, TIERS.PRO, TIERS.AGENCY],
      unlimitedBriefs: [TIERS.FREE, TIERS.PRO, TIERS.AGENCY],
      compare: [TIERS.FREE, TIERS.PRO, TIERS.AGENCY],
      clientExport: [TIERS.FREE, TIERS.PRO, TIERS.AGENCY],
      remoteAi: [TIERS.FREE, TIERS.PRO, TIERS.AGENCY],
      stripePortal: [TIERS.PRO],
      whiteLabelKit: [TIERS.AGENCY]
    },
    /** Legacy fallback if unlimitedBriefs ever narrowed again */
    FREE_DAILY_BRIEFS: 3,
    formatSupporterPrice() {
      const p = this.PRICING.pro;
      return `$${p.monthlyUsd}/mo · $${p.annualUsd}/yr`;
    },
    laneSummary(options) {
      const opts = options || {};
      const lanes = [
        { id: TIERS.FREE, label: this.LABELS[TIERS.FREE], price: '$0 — full tool during early access' },
        {
          id: TIERS.PRO,
          label: this.LABELS[TIERS.PRO],
          price: `${this.formatSupporterPrice()} — optional; removes brief watermark`
        }
      ];
      if (!opts.publicOnly) {
        lanes.push({
          id: TIERS.AGENCY,
          label: this.LABELS[TIERS.AGENCY],
          price: 'Contact operator — white-label kit (not public SKU)'
        });
      }
      return lanes;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
