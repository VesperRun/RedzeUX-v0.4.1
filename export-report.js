// export-report.js — Branded client exports (Pro). Application layer only.

(function initExportReport(globalScope) {
  const BRAND_KEYS = {
    agency: 'redzeux_brand_agency',
    preparedFor: 'redzeux_brand_prepared_for'
  };

  function slugHost(url) {
    try {
      return new URL(url).hostname.replace(/^www\./i, '').replace(/[^a-z0-9.-]+/gi, '-');
    } catch {
      return 'page';
    }
  }

  function todayStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function markdownToPlain(markdown) {
    return String(markdown || '')
      .replace(/^##?\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/^---$/gm, '────────────────')
      .trim();
  }

  function markdownToHtmlLines(markdown) {
    return String(markdown || '')
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return '<br/>';
        if (trimmed.startsWith('## ')) {
          return `<h2>${escapeHtml(trimmed.slice(3))}</h2>`;
        }
        if (trimmed.startsWith('---')) {
          return '<hr/>';
        }
        const withBold = escapeHtml(trimmed).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        const withEm = withBold.replace(/_([^_]+)_/g, '<em>$1</em>');
        return `<p>${withEm}</p>`;
      })
      .join('\n');
  }

  async function getBrandSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(Object.values(BRAND_KEYS), (result) => {
        resolve({
          agencyName: result[BRAND_KEYS.agency] || 'Redze UX',
          preparedFor: result[BRAND_KEYS.preparedFor] || ''
        });
      });
    });
  }

  async function saveBrandSettings(agencyName, preparedFor) {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        {
          [BRAND_KEYS.agency]: String(agencyName || '').trim(),
          [BRAND_KEYS.preparedFor]: String(preparedFor || '').trim()
        },
        () => resolve()
      );
    });
  }

  function buildFilename(briefMeta, ext) {
    const host = slugHost(briefMeta?.url || 'report');
    return `redzeux-brief-${host}-${todayStamp()}.${ext}`;
  }

  function downloadBlob(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.documentElement.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function buildBrandedPrintHtml(markdownBrief, brand, meta) {
    const prepared = brand.preparedFor
      ? `<p class="meta"><strong>Prepared for:</strong> ${escapeHtml(brand.preparedFor)}</p>`
      : '';
    const pageLine = meta?.title
      ? `<p class="meta"><strong>Page:</strong> ${escapeHtml(meta.title)}</p>`
      : '';
    const urlLine = meta?.url ? `<p class="meta subtle">${escapeHtml(meta.url)}</p>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>RedzeUX Report — ${escapeHtml(slugHost(meta?.url))}</title>
  <style>
    :root { --accent: #4858c8; --ink: #12131a; --muted: #5a6278; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", system-ui, sans-serif; color: var(--ink); margin: 0; padding: 32px 40px 48px; }
    header { border-bottom: 3px solid var(--accent); padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); font-weight: 700; }
    h1 { margin: 8px 0 4px; font-size: 26px; }
    .meta { margin: 4px 0; font-size: 14px; }
    .subtle { color: var(--muted); font-size: 12px; word-break: break-all; }
    main h2 { font-size: 16px; margin: 20px 0 8px; color: var(--accent); }
    main p { line-height: 1.55; margin: 6px 0; font-size: 14px; }
    footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: var(--muted); }
    .doctrine { color: var(--accent); font-weight: 600; }
    .disclaimer { margin-top: 8px; font-style: italic; }
    .noprint { margin: 16px 0 24px; }
    .noprint button { background: var(--accent); color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-size: 14px; }
    @media print {
      .noprint { display: none !important; }
      body { padding: 16px 20px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">${escapeHtml(brand.agencyName)}</div>
    <h1>Competitive UX Snapshot</h1>
    ${prepared}
    ${pageLine}
    ${urlLine}
    <p class="meta subtle">Generated ${todayStamp()} · visible UI only · advisory not verdicts</p>
  </header>
  <div class="noprint">
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <main>${markdownToHtmlLines(markdownBrief)}</main>
  <footer>
    <p class="doctrine">RedzeUX suggests. You synthesize. You decide.</p>
    <p class="disclaimer">This report reflects observable page UI only. It is not a certification, legal advice, or guaranteed business outcome.</p>
    <p>For the people · Local only · Always.</p>
  </footer>
</body>
</html>`;
  }

  function openPrintReport(markdownBrief, brand, meta) {
    const html = buildBrandedPrintHtml(markdownBrief, brand, meta);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, '_blank');
    if (!tab) {
      URL.revokeObjectURL(url);
      return { ok: false, error: 'popup_blocked' };
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { ok: true };
  }

  async function exportMarkdown(markdownBrief, meta) {
    const brand = await getBrandSettings();
    const header = brand.preparedFor
      ? `# Prepared for: ${brand.preparedFor}\n**Agency:** ${brand.agencyName}\n\n`
      : `# ${brand.agencyName}\n\n`;
    const body = header + markdownBrief;
    downloadBlob(buildFilename(meta, 'md'), body, 'text/markdown;charset=utf-8');
    return { ok: true, format: 'md' };
  }

  async function exportPlainText(markdownBrief, meta) {
    const brand = await getBrandSettings();
    const header = brand.preparedFor
      ? `Prepared for: ${brand.preparedFor}\nAgency: ${brand.agencyName}\n${'─'.repeat(40)}\n\n`
      : `${brand.agencyName}\n${'─'.repeat(40)}\n\n`;
    const body = header + markdownToPlain(markdownBrief);
    downloadBlob(buildFilename(meta, 'txt'), body, 'text/plain;charset=utf-8');
    return { ok: true, format: 'txt' };
  }

  async function exportPdfPrint(markdownBrief, meta) {
    const brand = await getBrandSettings();
    return openPrintReport(markdownBrief, brand, meta);
  }

  globalScope.RedzeUXExport = {
    getBrandSettings,
    saveBrandSettings,
    exportMarkdown,
    exportPlainText,
    exportPdfPrint,
    markdownToPlain
  };
})(window);
