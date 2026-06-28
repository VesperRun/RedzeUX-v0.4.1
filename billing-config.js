// billing-config.js — Operator URLs + hybrid lane config (Application layer).

(function initBillingConfig(globalScope) {
  globalScope.RedzeUXBilling = {
    /** Pro — Stripe Payment Link ($24/mo or $199/yr products) */
    stripePaymentLink: '',
    /** POST { key } → { valid, tier, expiresAt } */
    licenseVerifyUrl: '',
    /** Optional override; default derived from licenseVerifyUrl */
    billingPortalUrl: '',
    licenseCacheHours: 24,
    /** Agency lane — contact for manual kit sales */
    agencySalesEmail: 'support@redzeux.local',
    agencyInfoUrl: ''
  };
})(typeof window !== 'undefined' ? window : globalThis);
