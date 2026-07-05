// comparison-manager.js
// Purpose: Manage user-selected comparison URLs in local storage.
// Privacy model: Only store URLs explicitly added by user action.

(function initComparisonManager(globalScope) {
  const STORAGE_KEY = 'comparisonUrls';
  const LEGACY_KEY = 'observeux_comparison_urls';
  const LIMIT = 5;

  function splitUrlInput(raw) {
    return String(raw || '')
      .split(/[\n,;]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function normalizeUrl(url) {
    const trimmed = String(url || '').trim();
    if (!trimmed) return null;

    const candidates = trimmed.includes('://') ? [trimmed] : [`https://${trimmed}`, trimmed];
    for (const candidate of candidates) {
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
        parsed.hash = '';
        return parsed.toString();
      } catch (error) {
        // try next candidate
      }
    }
    return null;
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
    const parts = splitUrlInput(rawUrl);
    if (parts.length === 0) {
      return { ok: false, message: 'Please enter a valid URL.' };
    }

    let current = await getUrls();
    const added = [];
    const invalid = [];

    for (const part of parts) {
      const normalized = normalizeUrl(part);
      if (!normalized) {
        invalid.push(part);
        continue;
      }
      if (current.includes(normalized)) {
        continue;
      }
      if (current.length >= LIMIT) {
        break;
      }
      current = [...current, normalized];
      added.push(normalized);
    }

    if (added.length === 0) {
      if (invalid.length > 0) {
        return { ok: false, message: 'Please enter a valid URL (e.g. sephora.com).' };
      }
      if (current.length >= LIMIT) {
        return { ok: false, message: 'You can save up to 5 URLs.' };
      }
      return { ok: false, message: 'These URLs are already in your comparison list.' };
    }

    await setUrls(current);

    let message = `Added ${added.length} URL${added.length === 1 ? '' : 's'}.`;
    if (invalid.length > 0) {
      message += ` Skipped ${invalid.length} invalid entr${invalid.length === 1 ? 'y' : 'ies'}.`;
    }
    if (current.length >= LIMIT && parts.length > added.length) {
      message += ' List is full (5 max).';
    }

    return { ok: true, urls: current, added, message };
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
