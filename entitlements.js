// entitlements.js — Application-tier local plan gate (no Core logic).

(function initEntitlements(globalScope) {
  const STORAGE_KEYS = {
    licenseKey: 'redzeux_license_key',
    briefCopyDate: 'redzeux_brief_copy_date',
    briefCopyCount: 'redzeux_brief_copy_count',
    licenseActive: 'redzeux_license_active',
    licenseVerifiedAt: 'redzeux_license_verified_at',
    licenseExpiresAt: 'redzeux_license_expires_at'
  };

  const FREE_DAILY_BRIEFS = 3;
  const DEV_PRO_KEY = 'RZX-PRO-VESPER-DEV';
  const PRO_KEY_PATTERN = /^RZX-PRO-[A-Z0-9]{8,}$/;

  function getBilling() {
    return globalScope.RedzeUXBilling || {};
  }

  function cacheHours() {
    const hours = Number(getBilling().licenseCacheHours);
    return Number.isFinite(hours) && hours > 0 ? hours : 24;
  }

  function normalizeKey(key) {
    return String(key || '')
      .trim()
      .toUpperCase();
  }

  function matchesProPattern(key) {
    const normalized = normalizeKey(key);
    if (!normalized) return false;
    if (normalized === DEV_PRO_KEY) return true;
    return PRO_KEY_PATTERN.test(normalized);
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          resolve({});
          return;
        }
        resolve(result || {});
      });
    });
  }

  function storageSet(payload) {
    return new Promise((resolve) => {
      chrome.storage.local.set(payload, () => resolve());
    });
  }

  async function clearLicenseVerification() {
    await storageSet({
      [STORAGE_KEYS.licenseActive]: false,
      [STORAGE_KEYS.licenseVerifiedAt]: null,
      [STORAGE_KEYS.licenseExpiresAt]: null
    });
  }

  async function getLicenseKey() {
    const data = await storageGet([STORAGE_KEYS.licenseKey]);
    return data[STORAGE_KEYS.licenseKey] || '';
  }

  async function verifyLicenseWithServer(key) {
    const normalized = normalizeKey(key);
    if (!matchesProPattern(normalized)) {
      await clearLicenseVerification();
      return { valid: false, error: 'invalid_format' };
    }

    if (normalized === DEV_PRO_KEY) {
      await storageSet({
        [STORAGE_KEYS.licenseActive]: true,
        [STORAGE_KEYS.licenseVerifiedAt]: new Date().toISOString(),
        [STORAGE_KEYS.licenseExpiresAt]: null
      });
      return { valid: true, tier: 'pro', source: 'dev' };
    }

    const verifyUrl = String(getBilling().licenseVerifyUrl || '').trim();
    if (!verifyUrl) {
      await storageSet({
        [STORAGE_KEYS.licenseActive]: true,
        [STORAGE_KEYS.licenseVerifiedAt]: new Date().toISOString(),
        [STORAGE_KEYS.licenseExpiresAt]: null
      });
      return { valid: true, tier: 'pro', source: 'offline_pattern' };
    }

    try {
      const response = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: normalized })
      });
      const data = await response.json();
      const valid = Boolean(data.valid);
      await storageSet({
        [STORAGE_KEYS.licenseActive]: valid,
        [STORAGE_KEYS.licenseVerifiedAt]: new Date().toISOString(),
        [STORAGE_KEYS.licenseExpiresAt]: data.expiresAt || null
      });
      return {
        valid,
        tier: valid ? 'pro' : 'free',
        source: 'stripe_verify',
        error: valid ? null : data.error || 'inactive'
      };
    } catch (error) {
      return { valid: false, error: 'network', message: error.message };
    }
  }

  async function setLicenseKey(key) {
    const normalized = normalizeKey(key);
    await storageSet({ [STORAGE_KEYS.licenseKey]: normalized });
    if (!normalized) {
      await clearLicenseVerification();
      return { valid: false, cleared: true };
    }
    return verifyLicenseWithServer(normalized);
  }

  async function isPro() {
    const key = await getLicenseKey();
    if (!matchesProPattern(key)) return false;

    const normalized = normalizeKey(key);
    if (normalized === DEV_PRO_KEY) return true;

    const verifyUrl = String(getBilling().licenseVerifyUrl || '').trim();
    if (!verifyUrl) return true;

    const data = await storageGet([
      STORAGE_KEYS.licenseActive,
      STORAGE_KEYS.licenseVerifiedAt,
      STORAGE_KEYS.licenseExpiresAt
    ]);

    if (!data[STORAGE_KEYS.licenseActive]) return false;

    const expiresAt = data[STORAGE_KEYS.licenseExpiresAt];
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      return false;
    }

    const verifiedAt = data[STORAGE_KEYS.licenseVerifiedAt];
    if (!verifiedAt) return false;

    const maxAgeMs = cacheHours() * 60 * 60 * 1000;
    if (Date.now() - new Date(verifiedAt).getTime() > maxAgeMs) {
      return false;
    }

    return true;
  }

  function getBillingPortalUrl() {
    const explicit = String(getBilling().billingPortalUrl || '').trim();
    if (explicit) return explicit;
    const verify = String(getBilling().licenseVerifyUrl || '').trim();
    if (!verify) return '';
    return verify.replace(/\/v1\/license\/verify\/?$/i, '/v1/billing/portal');
  }

  function openStripeCheckout() {
    const url = String(getBilling().stripePaymentLink || '').trim();
    if (!url) return false;
    chrome.tabs.create({ url });
    return true;
  }

  async function getTierLabel() {
    return (await isPro()) ? 'Pro (Teardown)' : 'Free (Snapshot)';
  }

  async function canUseCompare() {
    return isPro();
  }

  async function canUseRemoteAi() {
    return isPro();
  }

  async function canCopyBrief() {
    if (await isPro()) {
      return { ok: true, remaining: Infinity, tier: 'pro' };
    }

    const today = new Date().toISOString().slice(0, 10);
    const data = await storageGet([STORAGE_KEYS.briefCopyDate, STORAGE_KEYS.briefCopyCount]);
    let count = 0;
    if (data[STORAGE_KEYS.briefCopyDate] === today) {
      count = Number(data[STORAGE_KEYS.briefCopyCount]) || 0;
    }

    if (count >= FREE_DAILY_BRIEFS) {
      return {
        ok: false,
        remaining: 0,
        tier: 'free',
        message: `Free tier includes ${FREE_DAILY_BRIEFS} brief copies per day. Upgrade to Pro in Options (Stripe) for unlimited copies and compare.`
      };
    }

    return {
      ok: true,
      remaining: FREE_DAILY_BRIEFS - count,
      tier: 'free'
    };
  }

  async function recordBriefCopy() {
    if (await isPro()) return;

    const today = new Date().toISOString().slice(0, 10);
    const data = await storageGet([STORAGE_KEYS.briefCopyDate, STORAGE_KEYS.briefCopyCount]);
    let count = 0;
    if (data[STORAGE_KEYS.briefCopyDate] === today) {
      count = Number(data[STORAGE_KEYS.briefCopyCount]) || 0;
    }

    await storageSet({
      [STORAGE_KEYS.briefCopyDate]: today,
      [STORAGE_KEYS.briefCopyCount]: count + 1
    });
  }

  function onTierChanged(callback) {
    if (!chrome.storage?.onChanged) return () => {};
    const listener = (changes, area) => {
      if (area !== 'local') return;
      if (
        changes[STORAGE_KEYS.licenseKey] ||
        changes[STORAGE_KEYS.licenseActive] ||
        changes[STORAGE_KEYS.licenseVerifiedAt]
      ) {
        callback();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }

  async function canUseExport() {
    return isPro();
  }

  async function openBillingPortal() {
    const key = await getLicenseKey();
    if (!matchesProPattern(key)) {
      return { ok: false, error: 'no_key' };
    }

    const portalUrl = getBillingPortalUrl();
    if (!portalUrl) {
      return { ok: false, error: 'portal_not_configured' };
    }

    try {
      const response = await fetch(portalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: normalizeKey(key) })
      });
      const data = await response.json();
      if (!data.ok || !data.url) {
        return { ok: false, error: data.error || 'portal_failed' };
      }
      chrome.tabs.create({ url: data.url });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: 'network', message: error.message };
    }
  }

  globalScope.RedzeUXEntitlements = {
    FREE_DAILY_BRIEFS,
    DEV_PRO_KEY,
    getLicenseKey,
    setLicenseKey,
    verifyLicenseWithServer,
    matchesProPattern,
    isPro,
    getTierLabel,
    canUseCompare,
    canUseRemoteAi,
    canUseExport,
    canCopyBrief,
    recordBriefCopy,
    openStripeCheckout,
    openBillingPortal,
    getBillingPortalUrl,
    onTierChanged
  };
})(typeof window !== 'undefined' ? window : globalThis);
