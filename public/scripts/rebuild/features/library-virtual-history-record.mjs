import { classifyLibraryVirtualFailure, getLibraryVirtualFailureCategoryLabel, getLibraryVirtualFailureSuggestion, getLibraryVirtualFallbackKind } from './library-virtual-fallback-policy.mjs';

export const LIBRARY_VIRTUAL_HISTORY_RECORD_SPLIT_PASS = 'v204-library-virtual-history-record-split-pass';

export function compactLibraryVirtualHistoryRecord(record = {}) {
  const gate = record.gate || null;
  const scrollPolicy = record.scrollPolicy || null;
  const kind = record.kind || getLibraryVirtualFallbackKind(record);
  const blocking = kind === 'blocking-failure';
  const category = record.category || (blocking ? classifyLibraryVirtualFailure(record.reason || '', gate, record.error || null) : (kind === 'windowed-render' ? 'windowed-render' : 'informational'));
  return {
    mode: record.mode || (kind === 'windowed-render' ? 'windowed' : (record.reason ? (blocking ? 'fallback' : 'full') : 'unknown')),
    kind,
    blocking,
    reason: record.reason || '',
    category,
    categoryLabel: record.categoryLabel || getLibraryVirtualFailureCategoryLabel(category),
    suggestedAction: record.suggestedAction || getLibraryVirtualFailureSuggestion(category),
    source: record.source || '',
    errorMessage: record.error?.message || '',
    rowCount: Number.isFinite(Number(record.rowCount)) ? Number(record.rowCount) : null,
    renderedRows: Number.isFinite(Number(record.renderedRows)) ? Number(record.renderedRows) : null,
    rowsCacheHit: record.rowsCacheHit == null ? null : !!record.rowsCacheHit,
    rowsCachePass: record.rowsCachePass || '',
    renderWindowSkipPass: record.renderWindowSkipPass || '',
    rowHeightEstimate: Number.isFinite(Number(record.rowHeightEstimate || record.rowHeight)) ? Number(record.rowHeightEstimate || record.rowHeight) : null,
    rowHeightRisk: record.rowHeightMeasurement?.riskLevel || record.rowHeightMeasurement?.risk?.level || '',
    rowHeightRangePx: Number.isFinite(Number(record.rowHeightMeasurement?.rangePx || record.rowHeightMeasurement?.stats?.range)) ? Number(record.rowHeightMeasurement?.rangePx || record.rowHeightMeasurement?.stats?.range) : null,
    renderStart: Number.isFinite(Number(record.renderStart)) ? Number(record.renderStart) : null,
    renderEnd: Number.isFinite(Number(record.renderEnd)) ? Number(record.renderEnd) : null,
    gateAllowed: gate ? !!gate.allowed : null,
    gateReason: gate?.reason || '',
    scrollPolicy: scrollPolicy ? {
      resetScroll: !!scrollPolicy.resetScroll,
      anchorKey: scrollPolicy.anchorKey || '',
      anchorApplied: !!scrollPolicy.anchorApplied,
      anchorRestored: !!scrollPolicy.anchorRestored,
      followActive: !!scrollPolicy.followActive,
      activeFollowApplied: !!scrollPolicy.activeFollowApplied,
      activeFollowIndex: Number.isFinite(Number(scrollPolicy.activeFollowIndex)) ? Number(scrollPolicy.activeFollowIndex) : null
    } : null,
    at: record.at || Date.now()
  };
}
