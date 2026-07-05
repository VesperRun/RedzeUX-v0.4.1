// brief-builder.js
// Paste-ready executive briefs from structured analysis (no raw DOM, plain text only).

(function initBriefBuilder(globalScope) {
  const MAX_LINE = 420;
  const MAX_TITLE = 140;

  function clean(text, max = MAX_LINE) {
    return String(text || '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\|/g, '-')
      .trim()
      .slice(0, max);
  }

  function hostname(url) {
    try {
      return new URL(url).hostname.replace(/^www\./i, '');
    } catch (error) {
      return clean(url, 80);
    }
  }

  function joinLabels(items, getter, maxItems = 6) {
    if (!items || items.length === 0) {
      return 'None noted from visible UI.';
    }
    return items
      .slice(0, maxItems)
      .map(getter)
      .map((part) => clean(part, 80))
      .filter(Boolean)
      .join(' · ');
  }

  function buildPageBrief(result) {
    const detection = result.detection || {};
    const heuristics = result.heuristics || {};
    const ai = result.ai || {};
    const host = hostname(detection.url || '');
    const siteLabel = heuristics.categoryBenchmark?.siteTypeLabel || detection.siteType || 'Unknown';
    const visible = joinLabels(heuristics.observableFeatures, (item) => item.label || item.name);
    const missing = joinLabels(heuristics.missingWeakFeatures, (item) => item.label || item.name);
    const suggestions = joinLabels(ai.aiSuggestions || [], (item) => item.text, 3);
    const categoryNote = clean(heuristics.categoryBenchmark?.narrative);
    const evidence = clean(heuristics.evidenceScopeNote, 220);
    const friction = joinLabels(heuristics.possibleFrictionPoints || [], (item) => item.text, 2);
    const today = new Date().toISOString().slice(0, 10);

    const lines = [
      `## RedzeUX brief — ${host}`,
      `**Page:** ${clean(detection.title, MAX_TITLE)}`,
      `**Type:** ${clean(siteLabel)} (visible UI only)`,
      '',
      `**Visible patterns (high confidence):** ${visible}`,
      `**Pattern gaps (medium confidence):** ${missing}`
    ];

    if (categoryNote) {
      lines.push(`**Benchmark:** ${categoryNote}`);
    }

    lines.push(
      `**Friction signals (medium):** ${friction}`,
      `**Worth a look (advisory):** ${suggestions}`,
      '',
      `**Evidence limits:** ${evidence}`,
      '',
      '_RedzeUX suggests. You synthesize. You decide._',
      `_Generated ${today} with Redze UX (local, visible UI only)._`
    );

    return lines.join('\n');
  }

  function buildCompareBrief(benchmark) {
    if (!benchmark || !benchmark.ok) {
      return '';
    }

    const shared =
      benchmark.commonFeatures && benchmark.commonFeatures.length > 0
        ? benchmark.commonFeatures.slice(0, 6).join(' · ')
        : 'Few overlapping visible patterns.';
    const topGap = benchmark.gapsAcrossSites && benchmark.gapsAcrossSites[0];
    const gapLine = topGap
      ? `**Notable gap:** ${topGap.label} — on ${topGap.coverage} sites; missing on ${topGap.missingOn.join(', ')}.`
      : '';
    const verdict = clean(benchmark.narrative, 320);

    return [
      '',
      '---',
      '## Competitor compare',
      `**Sites compared:** ${benchmark.siteCount || '?'}`,
      `**Shared visible patterns:** ${shared}`,
      gapLine,
      verdict ? `**Competitor snapshot:** ${verdict}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  }

  function buildCompareOnlyBrief(benchmark) {
    if (!benchmark || !benchmark.ok) {
      return 'Run **Compare Competitors** with at least two sites open in tabs, then copy again.';
    }

    const shared =
      benchmark.commonFeatures && benchmark.commonFeatures.length > 0
        ? benchmark.commonFeatures.join(' · ')
        : 'Few overlapping visible patterns.';
    const today = new Date().toISOString().slice(0, 10);

    return [
      '## RedzeUX compare brief',
      `**Sites compared:** ${benchmark.siteCount || '?'}`,
      `**Shared visible patterns:** ${shared}`,
      clean(benchmark.narrative, 400),
      '',
      '_RedzeUX suggests. You synthesize. You decide._',
      `_Generated ${today} with Redze UX._`
    ].join('\n');
  }

  function buildBrief(result, benchmark, options) {
    const opts = options || {};
    if (!result && benchmark?.ok) {
      return buildCompareOnlyBrief(benchmark);
    }
    if (!result) {
      return 'Run **Generate UX Snapshot** (or compare competitors), then tap **Copy Brief** again.';
    }
    const pageBrief = buildPageBrief(result);
    const compareSection = benchmark?.ok ? buildCompareBrief(benchmark) : '';
    let text = pageBrief + compareSection;
    if (opts.watermark) {
      text += '\n\n— RedzeUX Free (early access) · Options → Supporter removes this line';
    }
    return text;
  }

  globalScope.ObserveUXBriefBuilder = {
    clean,
    buildPageBrief,
    buildCompareBrief,
    buildCompareOnlyBrief,
    buildBrief
  };
})(window);
