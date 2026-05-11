export const LIBRARY_ACTION_AUDIT_SUMMARY_SPLIT_PASS = 'v197-library-action-audit-summary-split-pass';

export function countLibraryRowTypes(rows = []) {
  return (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
    const type = row?.type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
}

export function mergeCountObjects(...items) {
  return items.reduce((acc, item) => {
    Object.entries(item || {}).forEach(([key, value]) => { acc[key] = (acc[key] || 0) + (Number(value) || 0); });
    return acc;
  }, {});
}

export function compactLibraryActionAuditRow(row = {}) {
  return {
    source: row.source || '',
    index: row.index,
    type: row.type || '',
    key: row.key || '',
    title: row.title || '',
    actionType: row.actionType || '',
    ready: !!row.ready,
    failures: Array.isArray(row.failures) ? row.failures.slice(0, 8) : [],
    identity: row.identity ? {
      valid: !!row.identity.valid,
      novelId: row.identity.novelId || '',
      episodeId: row.identity.episodeId || '',
      folderKey: row.identity.folderKey || '',
      reasons: Array.isArray(row.identity.reasons) ? row.identity.reasons.slice(0, 8) : []
    } : null,
    action: row.action ? {
      valid: !!row.action.valid,
      type: row.action.type || '',
      reasons: Array.isArray(row.action.reasons) ? row.action.reasons.slice(0, 8) : []
    } : null
  };
}

export function summarizeLibraryActionAudit(audit = null) {
  if (!audit) return null;
  return {
    available: !!audit.available,
    mode: audit.mode || 'diagnostic-only',
    safe: !!audit.safe,
    rows: Number(audit.rows) || 0,
    readyRows: Number(audit.readyRows) || 0,
    failedRows: Number(audit.failedRows) || 0,
    currentRenderer: audit.currentRenderer || 'unknown',
    nativeDndSupported: !!audit.nativeDndSupported,
    actionTypes: audit.actionTypes || {},
    summary: audit.summary || {},
    sampleFailures: Array.isArray(audit.sampleFailures) ? audit.sampleFailures.slice(0, 10) : []
  };
}
