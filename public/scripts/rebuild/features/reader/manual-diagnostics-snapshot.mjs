export const READER_MANUAL_DIAGNOSTICS_SNAPSHOT_PASS = 'v245-reader-manual-diagnostics-snapshot-pass';
export const READER_MANUAL_DIAGNOSTICS_HISTORY_PASS = 'v246-reader-manual-diagnostics-history-pass';
export const READER_MANUAL_DIAGNOSTICS_BROWSER_VERIFICATION_PASS = 'v252-reader-manual-diagnostics-browser-verification-pass';
export const READER_MANUAL_DIAGNOSTICS_RECOVERY_SUMMARY_PASS = 'v253-reader-manual-diagnostics-recovery-summary-pass';
export const READER_MANUAL_DIAGNOSTICS_TREND_BUNDLE_PASS = 'v255-reader-manual-diagnostics-trend-bundle-pass';
export const READER_MANUAL_DIAGNOSTICS_REAL_EXPORT_TREND_PASS = 'v258-reader-manual-diagnostics-real-export-trend-pass';

function normalizeBooleanOrNull(value) {
  return value === true ? true : value === false ? false : null;
}

export function normalizeManualDiagnosticsEntry(entry = {}) {
  const recordedAt = Number(entry.recordedAt || entry.at) || Date.now();
  return {
    source: entry.source || 'manual-browser-check',
    recordedAt,
    at: recordedAt,
    pcDragSmooth: normalizeBooleanOrNull(entry.pcDragSmooth),
    mobileScrollSmooth: normalizeBooleanOrNull(entry.mobileScrollSmooth),
    searchJumpOk: normalizeBooleanOrNull(entry.searchJumpOk ?? entry.searchResultNavigationOk),
    liveRowAvailable: normalizeBooleanOrNull(entry.liveRowAvailable),
    highlightedMatch: normalizeBooleanOrNull(entry.highlightedMatch),
    retryCount: Math.max(0, Number(entry.retryCount) || 0),
    importSource: String(entry.importSource || entry.browser || entry.device || '').slice(0, 80),
    notes: String(entry.notes || entry.memo || entry.comment || '').slice(0, 500)
  };
}

function countFlag(entries = [], key, expected) {
  return entries.filter(item => item?.[key] === expected).length;
}

export function summarizeReaderManualBrowserVerification(history = []) {
  const recent = (Array.isArray(history) ? history : []).slice(-5).map(normalizeManualDiagnosticsEntry);
  const issueCount = recent.reduce((sum, item) => sum
    + (item.pcDragSmooth === false ? 1 : 0)
    + (item.mobileScrollSmooth === false ? 1 : 0)
    + (item.searchJumpOk === false ? 1 : 0), 0);
  const smoothCount = countFlag(recent, 'pcDragSmooth', true) + countFlag(recent, 'mobileScrollSmooth', true);
  const searchOkCount = countFlag(recent, 'searchJumpOk', true);
  const liveDomEvidenceCount = recent.filter(item => item.liveRowAvailable === true || item.highlightedMatch === true).length;
  return {
    pass: READER_MANUAL_DIAGNOSTICS_BROWSER_VERIFICATION_PASS,
    count: recent.length,
    issueCount,
    smoothCount,
    searchOkCount,
    liveDomEvidenceCount,
    lastAt: recent.at?.(-1)?.recordedAt || null,
    label: recent.length ? `browser checks ${recent.length} · issues ${issueCount} · search ok ${searchOkCount}` : 'browser checks none'
  };
}


export function buildReaderManualDiagnosticsTrendBundle(history = []) {
  const recent = (Array.isArray(history) ? history : []).slice(-8).map(normalizeManualDiagnosticsEntry);
  const verification = summarizeReaderManualBrowserVerification(recent);
  const latest = recent.at?.(-1) || null;
  const bySource = recent.reduce((acc, item) => {
    const key = String(item.source || 'manual-browser-check');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    pass: READER_MANUAL_DIAGNOSTICS_TREND_BUNDLE_PASS,
    browserVerificationPass: READER_MANUAL_DIAGNOSTICS_BROWSER_VERIFICATION_PASS,
    trendBundlePass: READER_MANUAL_DIAGNOSTICS_TREND_BUNDLE_PASS,
    realExportTrendPass: READER_MANUAL_DIAGNOSTICS_REAL_EXPORT_TREND_PASS,
    count: recent.length,
    latestAt: latest?.recordedAt || null,
    issueCount: verification.issueCount,
    liveDomEvidenceCount: verification.liveDomEvidenceCount,
    searchOkCount: verification.searchOkCount,
    smoothCount: verification.smoothCount,
    retryCount: recent.reduce((sum, item) => sum + (Number(item.retryCount) || 0), 0),
    bySource,
    sourceCoverage: {
      pc: recent.filter(item => /pc|desktop/i.test(item.source + ' ' + item.importSource)).length,
      mobile: recent.filter(item => /mobile|ios|android/i.test(item.source + ' ' + item.importSource)).length,
      imported: recent.filter(item => /import|export/i.test(item.source + ' ' + item.importSource)).length
    },
    lastFlags: latest ? {
      pcDragSmooth: latest.pcDragSmooth,
      mobileScrollSmooth: latest.mobileScrollSmooth,
      searchJumpOk: latest.searchJumpOk,
      liveRowAvailable: latest.liveRowAvailable,
      highlightedMatch: latest.highlightedMatch
    } : null,
    label: recent.length ? `manual trend ${recent.length} · issues ${verification.issueCount} · live DOM ${verification.liveDomEvidenceCount}` : 'manual trend none'
  };
}

export function buildReaderManualDiagnosticsRecoverySummary(history = []) {
  const recent = (Array.isArray(history) ? history : []).slice(-8).map(normalizeManualDiagnosticsEntry);
  const verification = summarizeReaderManualBrowserVerification(recent);
  const trendBundle = buildReaderManualDiagnosticsTrendBundle(recent);
  const latest = recent.at?.(-1) || null;
  const issueNotes = recent
    .filter(item => item.pcDragSmooth === false || item.mobileScrollSmooth === false || item.searchJumpOk === false)
    .map(item => ({ at:item.at, notes:item.notes, pcDragSmooth:item.pcDragSmooth, mobileScrollSmooth:item.mobileScrollSmooth, searchJumpOk:item.searchJumpOk }))
    .slice(-3);
  return {
    pass: READER_MANUAL_DIAGNOSTICS_RECOVERY_SUMMARY_PASS,
    browserVerificationPass: READER_MANUAL_DIAGNOSTICS_BROWSER_VERIFICATION_PASS,
    trendBundlePass: READER_MANUAL_DIAGNOSTICS_TREND_BUNDLE_PASS,
    realExportTrendPass: READER_MANUAL_DIAGNOSTICS_REAL_EXPORT_TREND_PASS,
    count: recent.length,
    issueCount: verification.issueCount,
    liveDomEvidenceCount: verification.liveDomEvidenceCount,
    searchOkCount: verification.searchOkCount,
    latestAt: latest?.recordedAt || null,
    latestNotes: latest?.notes || '',
    trendBundle,
    issueNotes,
    label: recent.length ? `manual browser checks ${recent.length} · issues ${verification.issueCount} · live DOM ${verification.liveDomEvidenceCount}` : 'manual browser checks none'
  };
}

export function appendReaderManualDiagnosticsSnapshot(app = null, entry = {}, limit = 8) {
  if (!app?.state) return null;
  const next = normalizeManualDiagnosticsEntry(entry);
  const history = Array.isArray(app.state.readerManualDiagnosticsHistory)
    ? app.state.readerManualDiagnosticsHistory.slice()
    : [];
  history.push(next);
  app.state.readerManualDiagnosticsHistory = history.slice(-Math.max(1, Number(limit) || 8));
  app.state.readerManualDiagnostics = next;
  return next;
}

export function buildReaderManualDiagnosticsHistorySummary(app = null) {
  const history = Array.isArray(app?.state?.readerManualDiagnosticsHistory)
    ? app.state.readerManualDiagnosticsHistory
    : [];
  const recent = history.slice(-5).map(normalizeManualDiagnosticsEntry);
  const smoothCount = recent.filter(item => item.pcDragSmooth === true || item.mobileScrollSmooth === true).length;
  const issueCount = recent.filter(item => item.pcDragSmooth === false || item.mobileScrollSmooth === false || item.searchJumpOk === false).length;
  return {
    pass: READER_MANUAL_DIAGNOSTICS_HISTORY_PASS,
    browserVerificationPass: READER_MANUAL_DIAGNOSTICS_BROWSER_VERIFICATION_PASS,
    count: history.length,
    recent,
    smoothCount,
    issueCount,
    verification: summarizeReaderManualBrowserVerification(history),
    recoverySummary: buildReaderManualDiagnosticsRecoverySummary(history),
    trendBundle: buildReaderManualDiagnosticsTrendBundle(history),
    label: history.length ? `manual checks ${history.length} · issues ${issueCount}` : 'manual checks none'
  };
}

export function buildReaderManualDiagnosticsSnapshot(app = null, diagnostics = {}) {
  const manual = app?.state?.readerManualDiagnostics ? normalizeManualDiagnosticsEntry(app.state.readerManualDiagnostics) : null;
  const scrollStats = diagnostics?.scrollInputStats || null;
  const historySummary = buildReaderManualDiagnosticsHistorySummary(app);
  const liveDom = diagnostics?.searchLiveDomDiagnostics || diagnostics?.liveDomDiagnostics || null;
  return {
    pass: READER_MANUAL_DIAGNOSTICS_SNAPSHOT_PASS,
    historyPass: READER_MANUAL_DIAGNOSTICS_HISTORY_PASS,
    browserVerificationPass: READER_MANUAL_DIAGNOSTICS_BROWSER_VERIFICATION_PASS,
    available: !!manual || !!scrollStats || historySummary.count > 0 || !!liveDom,
    source: manual?.source || 'runtime-diagnostics',
    recordedAt: manual?.recordedAt || null,
    at: manual?.at || null,
    pcDragSmooth: manual?.pcDragSmooth ?? null,
    mobileScrollSmooth: manual?.mobileScrollSmooth ?? null,
    searchJumpOk: manual?.searchJumpOk ?? null,
    liveRowAvailable: manual?.liveRowAvailable ?? liveDom?.liveRowAvailable ?? null,
    highlightedMatch: manual?.highlightedMatch ?? liveDom?.highlightedMatch ?? null,
    retryCount: manual?.retryCount ?? (Number(diagnostics?.searchJumpRetryCount || liveDom?.retryCount || 0) || 0),
    notes: manual?.notes || '',
    history: historySummary,
    browserVerification: historySummary.verification,
    recoverySummary: historySummary.recoverySummary,
    searchLiveDomDiagnostics: liveDom,
    multiFileBodyAnchorPass: diagnostics?.multiFileBodyAnchorPass || '',
    anchorTracePass: diagnostics?.anchorTracePass || '',
    anchorTraceSummary: diagnostics?.anchorTraceSummary || null,
    anchorTrace: Array.isArray(diagnostics?.anchorTrace) ? diagnostics.anchorTrace.slice(-8) : [],
    lastAnchorTraceEvent: diagnostics?.lastAnchorTraceEvent || null,
    lastUserScrollSource: diagnostics?.lastUserScrollSource || '',
    userScrollActive: !!diagnostics?.userScrollActive,
    measureDeferralCount: Number(diagnostics?.measureDeferralCount) || 0,
    renderReuseCount: Number(diagnostics?.renderReuseCount) || 0,
    lastActiveRenderPatch: diagnostics?.lastActiveRenderPatch || null,
    lastScrollSettleCompaction: diagnostics?.lastScrollSettleCompaction || null,
    lastScrollSettleNativeFreeze: diagnostics?.lastScrollSettleNativeFreeze || null,
    ipadScrollCoastRetainPass: diagnostics?.ipadScrollCoastRetainPass || '',
    lastIpadScrollCoastRetain: diagnostics?.lastIpadScrollCoastRetain || null,
    nativeForwardScrollRetainPass: diagnostics?.nativeForwardScrollRetainPass || '',
    lastNativeForwardScrollRetain: diagnostics?.lastNativeForwardScrollRetain || null,
    nativeForwardSeamTransitLockPass: diagnostics?.nativeForwardSeamTransitLockPass || '',
    lastNativeForwardSeamTransitLock: diagnostics?.lastNativeForwardSeamTransitLock || null,
    nativeForwardSeamRenderHoldPass: diagnostics?.nativeForwardSeamRenderHoldPass || '',
    lastNativeForwardSeamRenderHold: diagnostics?.lastNativeForwardSeamRenderHold || null,
    seamTransitMeasureDeferPass: diagnostics?.seamTransitMeasureDeferPass || '',
    lastSeamTransitMeasureDefer: diagnostics?.lastSeamTransitMeasureDefer || null,
    scrollAppendChunkWindowDeferPass: diagnostics?.scrollAppendChunkWindowDeferPass || '',
    activeForwardRenderAnchorSuppressPass: diagnostics?.activeForwardRenderAnchorSuppressPass || '',
    scrollInputStats: scrollStats,
    policy: 'manual browser notes are optional runtime state; smoke tests only verify snapshot shape'
  };
}
