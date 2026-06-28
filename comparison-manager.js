// comparison-manager.js
// Purpose: Manage user-selected comparison URLs in local storage.
// Privacy model: Only store URLs explicitly added by user action.

(function initComparisonManager(globalScope) {
  const STORAGE_KEY = 'comparisonUrls';
  const LEGACY_KEY = 'observeux_comparison_urls';
  const LIMIT = 5;

  function normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      parsed.hash = '';
      return parsed.toString();
    } catch (error) {
      return null;
    }
  }

  async function getUrls() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY, LEGACY_KEY], (result) => {
        const current = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
        const legacy = Array.isArray(result[LEGACY_KEY]) ? result[LEGACY_KEY] : [];
        resolve(current.length > 0 ? current : legacy);
      });
    });
  }

  async function setUrls(urls) {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        {
          [STORAGE_KEY]: urls.slice(0, LIMIT),
          [LEGACY_KEY]: urls.slice(0, LIMIT)
        },
        () => resolve()
      );
    });
  }

  async function addUrl(rawUrl) {
    const normalized = normalizeUrl(rawUrl);
    if (!normalized) {
      return { ok: false, message: 'Please enter a valid URL.' };
    }
    const current = await getUrls();
    if (current.includes(normalized)) {
      return { ok: false, message: 'This URL is already in your comparison list.' };
    }
    if (current.length >= LIMIT) {
      return { ok: false, message: 'You can save up to 5 URLs.' };
    }
    const next = [...current, normalized];
    await setUrls(next);
    return { ok: true, urls: next };
  }

  async function removeUrl(url) {
    const current = await getUrls();
    const next = current.filter((item) => item !== url);
    await setUrls(next);
    return next;
  }

  async function clearAll() {
    await setUrls([]);
    return [];
  }

  globalScope.ObserveUXComparisonManager = {
    getUrls,
    addUrl,
    removeUrl,
    clearAll,
    LIMIT
  };
})(window);
