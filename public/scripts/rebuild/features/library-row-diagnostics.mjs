export const LIBRARY_ROW_DIAGNOSTICS_SPLIT_PASS = 'v197-library-row-diagnostics-split-pass';
export const LIBRARY_VIRTUAL_SCROLL_PREFETCH_OVERSCAN_PASS = 'v518-library-virtual-scroll-prefetch-overscan-pass';

const LIBRARY_ROW_HEIGHT_MEASUREMENT_LIMIT = 120;
const LIBRARY_ROW_HEIGHT_SAMPLE_LIMIT = 24;
const LIBRARY_ROW_HEIGHT_WARN_DELTA_PX = 10;
const LIBRARY_ROW_HEIGHT_BAD_DELTA_PX = 18;
const LIBRARY_ROW_HEIGHT_WARN_RANGE_PX = 18;
const LIBRARY_ROW_HEIGHT_BAD_RANGE_PX = 32;

export function getLibraryRowKeyFromElement(el) {
  if (!el) return '';
  if (el.dataset?.libraryRowKey) return String(el.dataset.libraryRowKey || '');
  if (el.classList?.contains?.('cat-header')) return `folder:${el.dataset.folderKey || ''}`;
  if (el.classList?.contains?.('ep-item')) return `episode:${el.dataset.novelId || ''}:${el.dataset.episodeId || ''}`;
  if (el.classList?.contains?.('novel-item')) return `novel:${el.dataset.novelId || ''}`;
  return '';
}

export function getLibraryRowTypeFromElement(el) {
  if (!el) return 'unknown';
  if (el.classList?.contains?.('cat-header')) return 'folder';
  if (el.classList?.contains?.('ep-item')) return 'episode';
  if (el.classList?.contains?.('novel-item')) return 'novel';
  return String(el.dataset?.type || 'unknown') || 'unknown';
}

export function getLibraryRowTitleFromElement(el) {
  if (!el) return '';
  const titleEl = el.querySelector?.('.folder-title,.novel-title,.ep-title');
  return String(titleEl?.textContent || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

function percentile(sorted = [], ratio = 0.5) {
  const list = Array.isArray(sorted) ? sorted.filter(n => Number.isFinite(Number(n))).map(Number).sort((a, b) => a - b) : [];
  if (!list.length) return 0;
  const index = Math.min(list.length - 1, Math.max(0, Math.round((list.length - 1) * ratio)));
  return list[index];
}

export function buildLibraryRowHeightStats(samples = [], estimatePx = 56) {
  const heights = (Array.isArray(samples) ? samples : [])
    .map(item => Number(item?.height))
    .filter(n => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const count = heights.length;
  if (!count) {
    return {
      count: 0,
      min: 0,
      max: 0,
      average: 0,
      median: 0,
      p90: 0,
      range: 0,
      maxAbsDeltaFromEstimate: 0,
      meanAbsDeltaFromEstimate: 0
    };
  }
  const sum = heights.reduce((acc, n) => acc + n, 0);
  const average = sum / count;
  const fixed = Math.max(1, Number(estimatePx) || 56);
  const deltas = heights.map(n => Math.abs(n - fixed));
  return {
    count,
    min: Math.round(heights[0]),
    max: Math.round(heights[heights.length - 1]),
    average: Math.round(average * 10) / 10,
    median: Math.round(percentile(heights, 0.5) * 10) / 10,
    p90: Math.round(percentile(heights, 0.9) * 10) / 10,
    range: Math.round((heights[heights.length - 1] - heights[0]) * 10) / 10,
    maxAbsDeltaFromEstimate: Math.round(Math.max(...deltas) * 10) / 10,
    meanAbsDeltaFromEstimate: Math.round((deltas.reduce((acc, n) => acc + n, 0) / count) * 10) / 10
  };
}

export function summarizeLibraryRowHeightMeasurement(measurement = null) {
  if (!measurement?.available) return null;
  const stats = measurement.stats || {};
  return {
    available: true,
    renderer: measurement.renderer || '',
    sampleRows: measurement.sampleRows || 0,
    totalDomRows: measurement.totalDomRows || 0,
    fixedEstimatePx: measurement.fixedEstimatePx || 0,
    averagePx: stats.average || 0,
    medianPx: stats.median || 0,
    rangePx: stats.range || 0,
    maxAbsDeltaPx: stats.maxAbsDeltaFromEstimate || 0,
    riskLevel: measurement.risk?.level || 'unknown',
    riskReason: measurement.risk?.reason || '',
    estimatedTotalHeightPx: measurement.comparison?.estimatedTotalHeightPx ?? null,
    actualScrollHeightPx: measurement.comparison?.actualScrollHeightPx ?? null,
    estimatedVsActualScrollHeightDeltaPx: measurement.comparison?.estimatedVsActualScrollHeightDeltaPx ?? null,
    computedAt: measurement.computedAt || Date.now()
  };
}

export function getLibraryRowHeightMeasurementDiagnostics(app, options = {}) {
  const box = app?.els?.novelList || null;
  const fixedEstimate = Math.max(24, Math.min(160, Math.round(Number(options.fixedEstimatePx) || 56)));
  if (!box) {
    return {
      available: false,
      reason: 'novel-list-missing',
      fixedEstimatePx: fixedEstimate,
      computedAt: Date.now()
    };
  }
  const allRows = Array.from(box.querySelectorAll('.cat-header,.novel-item,.ep-item'));
  const measuredRows = allRows.slice(0, LIBRARY_ROW_HEIGHT_MEASUREMENT_LIMIT).map((el, index) => {
    let height = 0;
    try { height = Number(el.getBoundingClientRect?.().height) || 0; } catch {}
    const rounded = Math.round(height * 10) / 10;
    return {
      index,
      type: getLibraryRowTypeFromElement(el),
      key: getLibraryRowKeyFromElement(el),
      depth: Number.isFinite(Number(el.dataset?.libraryDepth)) ? Number(el.dataset.libraryDepth) : null,
      height: rounded,
      deltaFromEstimate: Math.round((rounded - fixedEstimate) * 10) / 10,
      title: getLibraryRowTitleFromElement(el)
    };
  }).filter(item => Number.isFinite(item.height) && item.height > 0);
  const stats = buildLibraryRowHeightStats(measuredRows, fixedEstimate);
  const byType = ['folder', 'novel', 'episode'].reduce((acc, type) => {
    const rows = measuredRows.filter(item => item.type === type);
    acc[type] = buildLibraryRowHeightStats(rows, fixedEstimate);
    return acc;
  }, {});
  const typeAverageValues = Object.values(byType).filter(item => item.count > 0).map(item => Number(item.average) || 0);
  const typeAverageRange = typeAverageValues.length
    ? Math.round((Math.max(...typeAverageValues) - Math.min(...typeAverageValues)) * 10) / 10
    : 0;
  const actualScrollHeight = Math.max(0, Math.round(Number(box.scrollHeight) || 0));
  const estimatedTotalHeight = Math.round(allRows.length * fixedEstimate);
  const estimatedVsActualScrollHeightDelta = actualScrollHeight ? Math.round(estimatedTotalHeight - actualScrollHeight) : null;
  const measuredSampleHeight = Math.round(measuredRows.reduce((sum, item) => sum + item.height, 0));
  const estimatedSampleHeight = Math.round(measuredRows.length * fixedEstimate);
  const sampleDelta = measuredRows.length ? Math.round(estimatedSampleHeight - measuredSampleHeight) : null;
  const highRisk = stats.maxAbsDeltaFromEstimate >= LIBRARY_ROW_HEIGHT_BAD_DELTA_PX || stats.range >= LIBRARY_ROW_HEIGHT_BAD_RANGE_PX || typeAverageRange >= LIBRARY_ROW_HEIGHT_BAD_DELTA_PX;
  const mediumRisk = stats.maxAbsDeltaFromEstimate >= LIBRARY_ROW_HEIGHT_WARN_DELTA_PX || stats.range >= LIBRARY_ROW_HEIGHT_WARN_RANGE_PX || typeAverageRange >= LIBRARY_ROW_HEIGHT_WARN_DELTA_PX;
  const riskLevel = !measuredRows.length ? 'unavailable' : highRisk ? 'high' : mediumRisk ? 'medium' : 'low';
  const renderer = box.dataset?.libraryVirtualActive === '1' ? 'windowed' : 'full';
  return {
    available: true,
    mode: 'live-dom-sample-diagnostic-only',
    renderer,
    measuredScope: renderer === 'windowed' ? 'current virtual window rows only' : 'current full DOM rows sample',
    totalDomRows: allRows.length,
    sampleRows: measuredRows.length,
    sampleLimit: LIBRARY_ROW_HEIGHT_MEASUREMENT_LIMIT,
    fixedEstimatePx: fixedEstimate,
    stats,
    byType,
    variation: {
      typeAverageRangePx: typeAverageRange,
      warnDeltaPx: LIBRARY_ROW_HEIGHT_WARN_DELTA_PX,
      badDeltaPx: LIBRARY_ROW_HEIGHT_BAD_DELTA_PX,
      warnRangePx: LIBRARY_ROW_HEIGHT_WARN_RANGE_PX,
      badRangePx: LIBRARY_ROW_HEIGHT_BAD_RANGE_PX
    },
    comparison: {
      estimatedSampleHeightPx: estimatedSampleHeight,
      measuredSampleHeightPx: measuredSampleHeight,
      sampleEstimatedMinusMeasuredPx: sampleDelta,
      estimatedTotalHeightPx: estimatedTotalHeight,
      actualScrollHeightPx: actualScrollHeight || null,
      estimatedVsActualScrollHeightDeltaPx: estimatedVsActualScrollHeightDelta
    },
    risk: {
      level: riskLevel,
      variableHeightLikely: riskLevel === 'medium' || riskLevel === 'high',
      reason: riskLevel === 'high'
        ? 'sample row height variance can materially distort fixed-height window/spacer estimates'
        : riskLevel === 'medium'
          ? 'sample row height variance is visible; keep fixed-height virtualization behind diagnostics/trial'
          : riskLevel === 'low'
            ? 'sample rows are close enough to the current fixed row-height estimate'
            : 'no measurable row sample was available',
      suggestedAction: riskLevel === 'high'
        ? 'row type별 height cache 또는 prefix-sum 기반 spacer 계산을 검토하기 전까지 기본 ON 전환을 보류하세요.'
        : riskLevel === 'medium'
          ? '긴 제목/회차 row가 섞인 상태에서 safe trial과 scroll/top-anchor 관측을 추가로 확보하세요.'
          : riskLevel === 'low'
            ? '현재 샘플 기준으로는 fixed row-height 추정 위험이 낮습니다. 다른 필터/폴더 깊이에서도 재확인하세요.'
            : '목록을 렌더한 뒤 Row height diagnostics를 다시 확인하세요.'
    },
    samples: measuredRows.slice(0, LIBRARY_ROW_HEIGHT_SAMPLE_LIMIT),
    note: 'diagnostic-only; computeLibraryWindow still uses one fixed rowHeight estimate in v91',
    computedAt: Date.now()
  };
}

export function getLibraryWindowDomMetrics(app, options = {}) {
  const box = app.els.novelList;
  if (!box) {
    return {
      rowHeight: 56,
      viewportHeight: 640,
      scrollTop: 0,
      actualDomRows: 0,
      actualChildElements: 0,
      actualScrollTop: 0,
      actualClientHeight: 0,
      actualScrollHeight: 0,
      measuredRowHeight: 56,
      rowHeightMeasurement: {
        available: false,
        reason: 'novel-list-missing',
        fixedEstimatePx: 56,
        computedAt: Date.now()
      }
    };
  }
  const lightweight = options.lightweight === true;
  const preliminaryRows = Array.from(box.querySelectorAll('.cat-header,.novel-item,.ep-item'));
  const preliminaryHeights = preliminaryRows
    .slice(0, lightweight ? 8 : 24)
    .map(el => {
      try { return el.getBoundingClientRect?.().height || 0; }
      catch { return 0; }
    })
    .filter(n => Number.isFinite(n) && n > 0);
  const measured = preliminaryHeights.length
    ? preliminaryHeights.reduce((sum, n) => sum + n, 0) / preliminaryHeights.length
    : 56;
  const rowHeight = Math.round(Math.max(24, Math.min(160, measured || 56)));
  let rowHeightMeasurement = null;
  if (lightweight) {
    rowHeightMeasurement = app.state.libraryRowHeightMeasurementLast || {
      available: false,
      reason: 'lightweight-scroll-sample-skipped',
      fixedEstimatePx: rowHeight,
      computedAt: Date.now()
    };
  } else {
    rowHeightMeasurement = getLibraryRowHeightMeasurementDiagnostics(app, { fixedEstimatePx: rowHeight });
    app.state.libraryRowHeightMeasurementLast = rowHeightMeasurement;
  }
  return {
    rowHeight,
    viewportHeight: Math.max(120, Math.round(Number(box.clientHeight) || 640)),
    scrollTop: Math.max(0, Math.round(Number(box.scrollTop) || 0)),
    actualDomRows: preliminaryRows.length,
    actualChildElements: box.children ? box.children.length : 0,
    actualScrollTop: Math.max(0, Math.round(Number(box.scrollTop) || 0)),
    actualClientHeight: Math.max(0, Math.round(Number(box.clientHeight) || 0)),
    actualScrollHeight: Math.max(0, Math.round(Number(box.scrollHeight) || 0)),
    measuredRowHeight: Math.round(measured || 56),
    rowHeightMeasurement,
    overscan: lightweight ? 48 : 24,
    maxWindowRows: lightweight ? 420 : 360,
    virtualScrollPrefetchPass: lightweight ? LIBRARY_VIRTUAL_SCROLL_PREFETCH_OVERSCAN_PASS : ''
  };
}
