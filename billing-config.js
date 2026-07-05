// billing-config.js — Operator URLs + hybrid lane config (Application layer).

(function initBillingConfig(globalScope) {
  /**
   * Pro money-back guarantee — operator sets environmentalFeeUsd (USD retained per refund).
   * Refund = first Pro payment − environmental fee − non-recoverable Stripe processing fees.
   */
  const refundPolicy = {
    /** Pro / Teardown only; Agency kit uses manual terms */
    appliesTo: 'pro',
    guaranteeDays: 14,
    /** Fixed USD kept on approved refund (handling, labor, infra — operator-defined) */
    environmentalFeeUsd: 8,
    /** Subtract estimated Stripe fees not returned to merchant on refund */
    deductStripeProcessingFees: true,
    stripePercent: 0.029,
    stripeFixedUsd: 0.3,
    supportEmail: 'support@redzeux.local',
    /** One cash refund per customer email / Stripe customer (honor manually at launch) */
    oneRefundPerCustomer: true
  };

  function roundUsd(value) {
    return Math.round(value * 100) / 100;
  }

  function estimateStripeProcessingFeeUsd(paymentUsd) {
    const amount = Number(paymentUsd) || 0;
    if (amount <= 0) return 0;
    return roundUsd(amount * refundPolicy.stripePercent + refundPolicy.stripeFixedUsd);
  }

  function computeProRefundBreakdown(paymentUsd) {
    const gross = roundUsd(Number(paymentUsd) || 0);
    const environmentalFee = roundUsd(Math.min(refundPolicy.environmentalFeeUsd, gross));
    const stripeFee = refundPolicy.deductStripeProcessingFees ? estimateStripeProcessingFeeUsd(gross) : 0;
    const nonRefundable = roundUsd(Math.min(gross, environmentalFee + stripeFee));
    const netRefund = roundUsd(Math.max(0, gross - nonRefundable));
    return { gross, environmentalFee, stripeFee, nonRefundable, netRefund };
  }

  function formatProGuaranteeSummary() {
    const days = refundPolicy.guaranteeDays;
    const env = refundPolicy.environmentalFeeUsd;
    const stripePart = refundPolicy.deductStripeProcessingFees
      ? ' plus non-recoverable payment processing fees (Stripe)'
      : '';
    return (
      `${days}-day Supporter satisfaction guarantee: approved first-payment refunds return your payment ` +
      `minus a $${env} environmental/handling charge${stripePart}. No exceptions. Contact ${refundPolicy.supportEmail}.`
    );
  }

  function formatProRefundExample(paymentUsd) {
    const b = computeProRefundBreakdown(paymentUsd);
    if (b.gross <= 0) return '';
    return (
      `Example on $${b.gross}: refund about $${b.netRefund} ` +
      `($${b.environmentalFee} environmental/handling` +
      (b.stripeFee > 0 ? `, ~$${b.stripeFee} Stripe processing` : '') +
      ' retained).'
    );
  }

  globalScope.RedzeUXBilling = {
    /** Supporter — Stripe Payment Link ($5/mo or $39/yr products) */
    stripePaymentLink: '',
    /** POST { key } → { valid, tier, expiresAt } */
    licenseVerifyUrl: '',
    /** Optional override; default derived from licenseVerifyUrl */
    billingPortalUrl: '',
    licenseCacheHours: 24,
    /** Agency lane — contact for manual kit sales */
    agencySalesEmail: 'support@redzeux.local',
    agencyInfoUrl: '',
    refundPolicy,
    estimateStripeProcessingFeeUsd,
    computeProRefundBreakdown,
    formatProGuaranteeSummary,
    formatProRefundExample
  };
})(typeof window !== 'undefined' ? window : globalThis);
