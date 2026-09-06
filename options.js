// options.js — Launch lanes: Free (early access) · Supporter

const AI_KEYS = {
  aiEnabled: 'observeux_ai_enabled',
  aiEndpoint: 'observeux_ai_endpoint',
  aiApiKey: 'observeux_ai_api_key'
};

const tierStatus = document.getElementById('tier-status');
const laneList = document.getElementById('lane-list');
const supporterHeading = document.getElementById('supporter-heading');
const licenseInput = document.getElementById('license-key');
const licenseMessage = document.getElementById('license-message');
const stripeHint = document.getElementById('stripe-hint');
const upgradeStripeBtn = document.getElementById('upgrade-stripe');
const manageBillingBtn = document.getElementById('manage-billing');
const aiEnabled = document.getElementById('ai-enabled');
const aiEndpoint = document.getElementById('ai-endpoint');
const aiApiKey = document.getElementById('ai-api-key');
const aiMessage = document.getElementById('ai-message');
const brandAgency = document.getElementById('brand-agency');
const brandPrepared = document.getElementById('brand-prepared');
const brandMessage = document.getElementById('brand-message');
const proGuarantee = document.getElementById('pro-guarantee');
const proRefundExample = document.getElementById('pro-refund-example');

function renderHybridLanes() {
  if (!globalThis.RedzeUXHybrid?.laneSummary) return;
  laneList.innerHTML = RedzeUXHybrid.laneSummary({ publicOnly: true })
    .map(
      (lane) =>
        `<li><strong>${lane.label}</strong> <span class="lane-price">${lane.price}</span></li>`
    )
    .join('');
}

function formatVerifyResult(result) {
  if (result.cleared) {
    return 'Key cleared — Free (Early Access) restored.';
  }
  if (result.valid) {
    const label = RedzeUXHybrid?.LABELS?.[result.tier] || result.tier;
    if (result.source === 'server_verify') {
      return `${label} verified. Watermark removed on briefs and exports.`;
    }
    if (result.source === 'dev') {
      return `${label} dev key active.`;
    }
    return `${label} unlocked (offline verify — set licenseVerifyUrl for production).`;
  }
  if (result.error === 'network') {
    return 'Could not reach license server. Check billing-config.js.';
  }
  if (result.error === 'invalid_format') {
    return 'Use RZX-PRO-… (Supporter subscription).';
  }
  return 'Key inactive or not found.';
}

async function refreshTierStatus() {
  const label = await RedzeUXEntitlements.getTierLabel();
  tierStatus.textContent = RedzeUXEntitlements.proBonoPopuli?.()
    ? label
    : RedzeUXEntitlements.preLaunchGatesOpen()
      ? `${label} · all features unlocked (pre-launch testing)`
      : label;

  const isProTier = await RedzeUXEntitlements.isPro();
  const portalConfigured = Boolean(RedzeUXEntitlements.getBillingPortalUrl());
  if (isProTier && portalConfigured) {
    manageBillingBtn.classList.remove('hidden');
  } else {
    manageBillingBtn.classList.add('hidden');
  }
}

function configureStripeButton() {
  const link = String(RedzeUXBilling?.stripePaymentLink || '').trim();
  upgradeStripeBtn.disabled = !link;
  stripeHint.classList.toggle('hidden', Boolean(link));
}

function configureSupporterHeading() {
  if (!supporterHeading || !globalThis.RedzeUXHybrid?.formatSupporterPrice) return;
  supporterHeading.textContent = `Supporter (${RedzeUXHybrid.formatSupporterPrice()})`;
}

function configureProGuarantee() {
  if (!proGuarantee || !globalThis.RedzeUXBilling?.formatProGuaranteeSummary) return;
  proGuarantee.textContent = RedzeUXBilling.formatProGuaranteeSummary();
  if (proRefundExample && RedzeUXBilling.formatProRefundExample && RedzeUXHybrid?.PRICING?.pro) {
    const { monthlyUsd, annualUsd } = RedzeUXHybrid.PRICING.pro;
    const monthly = RedzeUXBilling.formatProRefundExample(monthlyUsd);
    const annual = RedzeUXBilling.formatProRefundExample(annualUsd);
    proRefundExample.textContent = `${monthly} ${annual}`;
  }
}

async function loadBrandSettings() {
  if (!globalThis.RedzeUXExport) return;
  const brand = await RedzeUXExport.getBrandSettings();
  brandAgency.value = brand.agencyName || '';
  brandPrepared.value = brand.preparedFor || '';
}

function applyProBonoUi() {
  if (!globalThis.RedzeUXHybrid?.PRO_BONO_POPULI) return;
  ['monetization-supporter', 'monetization-license'].forEach((id) => {
    document.getElementById(id)?.classList.add('hidden');
  });
}

async function loadSettings() {
  renderHybridLanes();
  applyProBonoUi();
  configureSupporterHeading();
  configureStripeButton();
  configureProGuarantee();
  licenseInput.value = await RedzeUXEntitlements.getLicenseKey();

  chrome.storage.local.get(Object.values(AI_KEYS), (result) => {
    aiEnabled.checked = Boolean(result[AI_KEYS.aiEnabled]);
    aiEndpoint.value = result[AI_KEYS.aiEndpoint] || '';
    aiApiKey.value = result[AI_KEYS.aiApiKey] || '';
  });

  await loadBrandSettings();
  await refreshTierStatus();
}

async function saveAndVerifyLicense() {
  const result = await RedzeUXEntitlements.setLicenseKey(licenseInput.value);
  await refreshTierStatus();
  licenseMessage.textContent = formatVerifyResult(result);
}

document.getElementById('upgrade-stripe').addEventListener('click', () => {
  if (!RedzeUXEntitlements.openStripeCheckout()) {
    stripeHint.classList.remove('hidden');
    licenseMessage.textContent = 'Set stripePaymentLink in billing-config.js first.';
  }
});

document.getElementById('save-license').addEventListener('click', saveAndVerifyLicense);

document.getElementById('verify-license').addEventListener('click', async () => {
  const result = await RedzeUXEntitlements.verifyLicenseWithServer(licenseInput.value);
  await refreshTierStatus();
  licenseMessage.textContent = formatVerifyResult(result);
});

document.getElementById('manage-billing').addEventListener('click', async () => {
  const result = await RedzeUXEntitlements.openBillingPortal();
  if (!result.ok) {
    licenseMessage.textContent =
      result.error === 'pro_only'
        ? 'Billing portal is for Supporter subscriptions only.'
        : 'Could not open billing portal.';
  }
});

document.getElementById('save-brand').addEventListener('click', async () => {
  if (!globalThis.RedzeUXExport) return;
  await RedzeUXExport.saveBrandSettings(brandAgency.value, brandPrepared.value);
  brandMessage.textContent = 'Branding saved for exports.';
});

document.getElementById('save-ai').addEventListener('click', () => {
  chrome.storage.local.set(
    {
      [AI_KEYS.aiEnabled]: aiEnabled.checked,
      [AI_KEYS.aiEndpoint]: aiEndpoint.value.trim(),
      [AI_KEYS.aiApiKey]: aiApiKey.value.trim()
    },
    () => {
      aiMessage.textContent = 'AI settings saved locally.';
    }
  );
});

loadSettings();
