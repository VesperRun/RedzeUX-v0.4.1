// entitlements.js — Hybrid tier gate: free · pro · agency (Application layer only).

(function initEntitlements(globalScope) {
  const hybrid = () => globalScope.RedzeUXHybrid || {};
  const TIERS = () => hybrid().TIERS || { FREE: 'free', PRO: 'pro', AGENCY: 'agency' };

  const STORAGE_KEYS = {
    licenseKey: 'redzeux_license_key',
    licenseTier: 'redzeux_license_tier',
    briefCopyDate: 'redzeux_brief_copy_date',
    briefCopyCount: 'redzeux_brief_copy_count',
    licenseActive: 'redzeux_license_active',
    licenseVerifiedAt: 'redzeux_license_verified_at',
    licenseExpiresAt: 'redzeux_license_expires_at'
  };

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

  function tierFromKey(key) {
    const normalized = normalizeKey(key);
    const keys = hybrid().KEYS || {};
    if (normalized === keys.DEV_AGENCY) return TIERS().AGENCY;
    if (normalized === keys.DEV_PRO) return TIERS().PRO;
    if (keys.AGENCY_PATTERN?.test(normalized)) return TIERS().AGENCY;
    if (keys.PRO_PATTERN?.test(normalized)) return TIERS().PRO;
    return TIERS().FREE;
  }

  function matchesLicensePattern(key) {
    return tierFromKey(key) !== TIERS().FREE;
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
      [STORAGE_KEYS.licenseTier]: TIERS().FREE,
      [STORAGE_KEYS.licenseActive]: false,
      [STORAGE_KEYS.licenseVerifiedAt]: null,
      [STORAGE_KEYS.licenseExpiresAt]: null
    });
  }

  async function getLicenseKey() {
    const data = await storageGet([STORAGE_KEYS.licenseKey]);
    return data[STORAGE_KEYS.licenseKey] || '';
  }

  async function getStoredTier() {
    const data = await storageGet([STORAGE_KEYS.licenseTier, STORAGE_KEYS.licenseKey]);
    const fromStorage = data[STORAGE_KEYS.licenseTier];
    if (fromStorage === TIERS().PRO || fromStorage === TIERS().AGENCY) {
      return fromStorage;
    }
    const fromKey = tierFromKey(data[STORAGE_KEYS.licenseKey]);
    return fromKey === TIERS().FREE ? TIERS().FREE : fromKey;
  }

  async function verifyLicenseWithServer(key) {
    const normalized = normalizeKey(key);
    const keyTier = tierFromKey(normalized);

    if (keyTier === TIERS().FREE) {
      await clearLicenseVerification();
      return { valid: false, error: 'invalid_format' };
    }

    const keys = hybrid().KEYS || {};
    if (normalized === keys.DEV_PRO || normalized === keys.DEV_AGENCY) {
      await storageSet({
        [STORAGE_KEYS.licenseTier]: keyTier,
        [STORAGE_KEYS.licenseActive]: true,
        [STORAGE_KEYS.licenseVerifiedAt]: new Date().toISOString(),
        [STORAGE_KEYS.licenseExpiresAt]: null
      });
      return { valid: true, tier: keyTier, source: 'dev' };
    }

    const verifyUrl = String(getBilling().licenseVerifyUrl || '').trim();
    if (!verifyUrl) {
      await storageSet({
        [STORAGE_KEYS.licenseTier]: keyTier,
        [STORAGE_KEYS.licenseActive]: true,
        [STORAGE_KEYS.licenseVerifiedAt]: new Date().toISOString(),
        [STORAGE_KEYS.licenseExpiresAt]: null
      });
      return { valid: true, tier: keyTier, source: 'offline_pattern' };
    }

    try {
      const response = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: normalized })
      });
      const data = await response.json();
      const valid = Boolean(data.valid);
      const tier = valid ? data.tier || keyTier : TIERS().FREE;
      await storageSet({
        [STORAGE_KEYS.licenseTier]: tier,
        [STORAGE_KEYS.licenseActive]: valid,
        [STORAGE_KEYS.licenseVerifiedAt]: new Date().toISOString(),
        [STORAGE_KEYS.licenseExpiresAt]: data.expiresAt || null
      });
      return {
        valid,
        tier,
        source: 'server_verify',
        hasBillingPortal: Boolean(data.hasBillingPortal),
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

  async function isLicenseValid() {
    const key = await getLicenseKey();
    if (!matchesLicensePattern(key)) return false;

    const keys = hybrid().KEYS || {};
    const normalized = normalizeKey(key);
    if (normalized === keys.DEV_PRO || normalized === keys.DEV_AGENCY) return true;

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
    return Date.now() - new Date(verifiedAt).getTime() <= maxAgeMs;
  }

  async function getTier() {
    if (!(await isLicenseValid())) return TIERS().FREE;
    return getStoredTier();
  }

  function preLaunchGatesOpen() {
    return Boolean(hybrid().PRE_LAUNCH_GATES_OPEN);
  }

  async function isPaid() {
    const tier = await getTier();
    return tier === TIERS().PRO || tier === TIERS().AGENCY;
  }

  async function isPro() {
    return (await getTier()) === TIERS().PRO;
  }

  async function isAgency() {
    return (await getTier()) === TIERS().AGENCY;
  }

  async function hasCapability(cap) {
    if (preLaunchGatesOpen()) return true;
    const caps = hybrid().CAPABILITIES || {};
    const allowed = caps[cap];
    if (!Array.isArray(allowed)) return false;
    const tier = await getTier();
    return allowed.includes(tier);
  }

  async function getTierLabel() {
    const labels = hybrid().LABELS || {};
    return labels[await getTier()] || 'Free (Snapshot)';
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

  async function shouldApplyBriefWatermark() {
    if (preLaunchGatesOpen()) return false;
    return !(await isPaid());
  }

  async function canUseCompare() {
    return hasCapability('compare');
  }

  async function canUseRemoteAi() {
    return hasCapability('remoteAi');
  }

  async function canUseExport() {
    return hasCapability('clientExport');
  }

  async function canCopyBrief() {
    if (preLaunchGatesOpen()) {
      const tier = await getTier();
      return { ok: true, remaining: Infinity, tier };
    }

    if (await hasCapability('unlimitedBriefs')) {
      const tier = await getTier();
      return { ok: true, remaining: Infinity, tier };
    }

    const limit = hybrid().FREE_DAILY_BRIEFS || 3;
    const today = new Date().toISOString().slice(0, 10);
    const data = await storageGet([STORAGE_KEYS.briefCopyDate, STORAGE_KEYS.briefCopyCount]);
    let count = 0;
    if (data[STORAGE_KEYS.briefCopyDate] === today) {
      count = Number(data[STORAGE_KEYS.briefCopyCount]) || 0;
    }

    if (count >= limit) {
      const price =
        typeof hybrid().formatSupporterPrice === 'function'
          ? hybrid().formatSupporterPrice()
          : '$5/mo · $39/yr';
      return {
        ok: false,
        remaining: 0,
        tier: TIERS().FREE,
        message: `Free tier: ${limit} brief copies/day. Optional Supporter (${price}) in Options removes limits and watermark.`
      };
    }

    return { ok: true, remaining: limit - count, tier: TIERS().FREE };
  }

  async function recordBriefCopy() {
    if (preLaunchGatesOpen()) return;
    if (await hasCapability('unlimitedBriefs')) return;

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

  async function openBillingPortal() {
    if (!(await isPro())) {
      return { ok: false, error: 'pro_only' };
    }

    const key = await getLicenseKey();
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

  function onTierChanged(callback) {
    if (!chrome.storage?.onChanged) return () => {};
    const listener = (changes, area) => {
      if (area !== 'local') return;
      if (
        changes[STORAGE_KEYS.licenseKey] ||
        changes[STORAGE_KEYS.licenseTier] ||
        changes[STORAGE_KEYS.licenseActive] ||
        changes[STORAGE_KEYS.licenseVerifiedAt]
      ) {
        callback();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }

  globalScope.RedzeUXEntitlements = {
    getLicenseKey,
    setLicenseKey,
    verifyLicenseWithServer,
    matchesLicensePattern,
    matchesProPattern: matchesLicensePattern,
    tierFromKey,
    getTier,
    isPaid,
    isPro,
    isAgency,
    isLicenseValid,
    preLaunchGatesOpen,
    hasCapability,
    getTierLabel,
    shouldApplyBriefWatermark,
    canUseCompare,
    canUseRemoteAi,
    canUseExport,
    canCopyBrief,
    recordBriefCopy,
    openStripeCheckout,
    openBillingPortal,
    getBillingPortalUrl,
    onTierChanged,
    DEV_PRO_KEY: (hybrid().KEYS || {}).DEV_PRO || 'RZX-PRO-VESPER-DEV',
    DEV_AGENCY_KEY: (hybrid().KEYS || {}).DEV_AGENCY || 'RZX-AGENCY-VESPER-DEV',
    FREE_DAILY_BRIEFS: hybrid().FREE_DAILY_BRIEFS || 3
  };
})(typeof window !== 'undefined' ? window : globalThis);
