// options.js — Application settings (Stripe Pro, BYOK AI, export branding).

const AI_KEYS = {
  aiEnabled: 'observeux_ai_enabled',
  aiEndpoint: 'observeux_ai_endpoint',
  aiApiKey: 'observeux_ai_api_key'
};

const tierStatus = document.getElementById('tier-status');
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

function formatVerifyResult(result) {
  if (result.cleared) {
    return 'Key cleared — Free (Snapshot) tier restored.';
  }
  if (result.valid) {
    if (result.source === 'stripe_verify') {
      return 'Pro verified with Stripe license server. Compare, exports, and unlimited briefs unlocked.';
    }
    if (result.source === 'dev') {
      return 'Dev Pro key active (local testing).';
    }
    return 'Pro unlocked locally (offline pattern mode — set licenseVerifyUrl for Stripe verify).';
  }
  if (result.error === 'network') {
    return 'Could not reach license server. Check billing-config.js URL and try Re-verify.';
  }
  if (result.error === 'invalid_format') {
    return 'Key not recognized. Format: RZX-PRO-XXXXXXXXXXXX (from Stripe checkout email).';
  }
  return 'Key inactive or not found. Confirm subscription in Stripe or contact support.';
}

async function refreshTierStatus() {
  const label = await RedzeUXEntitlements.getTierLabel();
  tierStatus.textContent = label;

  const pro = await RedzeUXEntitlements.isPro();
  const portalConfigured = Boolean(RedzeUXEntitlements.getBillingPortalUrl());
  if (pro && portalConfigured) {
    manageBillingBtn.classList.remove('hidden');
  } else {
    manageBillingBtn.classList.add('hidden');
  }
}

function configureStripeButton() {
  const link = String(RedzeUXBilling?.stripePaymentLink || '').trim();
  if (!link) {
    stripeHint.classList.remove('hidden');
    upgradeStripeBtn.disabled = true;
    return;
  }
  stripeHint.classList.add('hidden');
  upgradeStripeBtn.disabled = false;
}

async function loadBrandSettings() {
  if (!globalThis.RedzeUXExport) return;
  const brand = await RedzeUXExport.getBrandSettings();
  brandAgency.value = brand.agencyName || '';
  brandPrepared.value = brand.preparedFor || '';
}

async function loadSettings() {
  configureStripeButton();
  const key = await RedzeUXEntitlements.getLicenseKey();
  licenseInput.value = key;

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
  const opened = RedzeUXEntitlements.openStripeCheckout();
  if (!opened) {
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
    if (result.error === 'portal_not_configured') {
      licenseMessage.textContent = 'Set licenseVerifyUrl in billing-config.js (portal URL is derived automatically).';
      return;
    }
    if (result.error === 'no_stripe_customer') {
      licenseMessage.textContent = 'This key has no Stripe customer yet. Use a key from checkout email.';
      return;
    }
    licenseMessage.textContent = 'Could not open billing portal. Re-verify your key and try again.';
  }
});

document.getElementById('save-brand').addEventListener('click', async () => {
  if (!globalThis.RedzeUXExport) {
    brandMessage.textContent = 'Export module not loaded. Reload extension.';
    return;
  }
  await RedzeUXExport.saveBrandSettings(brandAgency.value, brandPrepared.value);
  brandMessage.textContent = 'Branding saved for client exports.';
});

document.getElementById('save-ai').addEventListener('click', async () => {
  const pro = await RedzeUXEntitlements.isPro();
  if (!pro) {
    aiMessage.textContent = 'Remote AI is a Pro feature. Upgrade with Stripe first.';
    return;
  }

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
