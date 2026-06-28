// billing-config.js — Operator Stripe URLs (Application layer). No secret keys here.
// Replace placeholders before you take money. See stripe/README.md.

(function initBillingConfig(globalScope) {
  globalScope.RedzeUXBilling = {
    /** Stripe Payment Link (Dashboard → Payment Links → copy URL) */
    stripePaymentLink: '',
    /** HTTPS endpoint for POST { "key": "RZX-PRO-..." } → { "valid": true|false } */
    licenseVerifyUrl: '',
    /**
     * Billing portal session endpoint (optional).
     * Default: licenseVerifyUrl with /v1/license/verify → /v1/billing/portal
     */
    billingPortalUrl: '',
    /** Hours to cache a successful server verify in chrome.storage.local */
    licenseCacheHours: 24
  };
})(typeof window !== 'undefined' ? window : globalThis);
