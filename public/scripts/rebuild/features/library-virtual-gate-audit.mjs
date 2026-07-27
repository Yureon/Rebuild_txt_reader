import { buildLibraryVirtualFailureCategories, getLibraryVirtualFailureSuggestion } from './library-virtual-fallback-policy.mjs';
import { summarizeLibraryActionAudit } from './library-action-audit-summary.mjs';
import { comparePrototypeLibraryRow } from './library-virtual-row-inspection.mjs';
import { buildLibraryVirtualGateDetail } from './library-virtual-gate-detail.mjs';

export const LIBRARY_VIRTUAL_GATE_AUDIT_PASS = 'v207-library-virtual-gate-audit-pass';
export const LIBRARY_VIRTUAL_GATE_DETAIL_BRIDGE_PASS = 'v209-library-virtual-gate-detail-bridge-pass';

export function buildLibraryVirtualGateAudit({
  rows = [],
  prototypeRows = [],
  interactionSafety = null,
  actionAudit = null,
  actualRows = [],
  alreadyVirtual = false,
  cacheSignature = '',
  startedAt = Date.now(),
  rowsCachePass = '',
  rowsCacheHit = false,
  maintenancePass = '',
  prototypeWindowDiagnostics = null
} = {}) {
  const visibleRows = Array.isArray(rows) ? rows : [];
  const inspectedPrototypeRows = Array.isArray(prototypeRows) ? prototypeRows : [];
  const inspectedActualRows = Array.isArray(actualRows) ? actualRows : [];
  const duplicateKeys = getDuplicateLibraryVirtualRowKeys(visibleRows);
  const missingRequired = inspectedPrototypeRows.filter(row => row.datasetMissing?.length || row.actionDatasetMissing?.length || row.classMissing?.length || row.actionMissing);
  const actualComparison = buildLibraryVirtualActualComparison({
    visibleRows,
    prototypeRows: inspectedPrototypeRows,
    actualRows: inspectedActualRows,
    alreadyVirtual
  });
  const problems = buildLibraryVirtualGateProblems({
    duplicateKeys,
    missingRequired,
    interactionSafety,
    actionAudit,
    actualComparison
  });
  const categoryGroups = buildLibraryVirtualFailureCategories(problems, null);
  const primaryCategory = categoryGroups[0]?.category || 'unknown';
  const detail = buildLibraryVirtualGateDetail({
    problems,
    primaryCategory,
    categoryGroups,
    duplicateKeys,
    missingRequired,
    interactionSafety,
    actualComparison
  });
  return {
    available: true,
    allowed: problems.length === 0,
    problems,
    primaryCategory,
    categoryGroups,
    suggestedAction: getLibraryVirtualFailureSuggestion(primaryCategory),
    detail,
    duplicateKeys,
    prototypeRows: inspectedPrototypeRows.length,
    missingRequiredRows: missingRequired.length,
    missingRequiredSample: missingRequired.slice(0, 12),
    interactionSafety,
    actionAudit: summarizeLibraryActionAudit(actionAudit),
    actualComparison,
    actualComparisonSkipped: !actualComparison,
    rowsCachePass,
    rowsCacheHit: !!rowsCacheHit,
    maintenancePass,
    prototypeWindowDiagnostics,
    reason: problems.length ? problems.join(',') : 'pass',
    cacheSignature,
    computedAt: startedAt,
    gateAuditPass: LIBRARY_VIRTUAL_GATE_AUDIT_PASS
  };
}

export function getDuplicateLibraryVirtualRowKeys(rows = []) {
  const keys = new Set();
  const duplicates = [];
  (Array.isArray(rows) ? rows : []).forEach(row => {
    const key = String(row?.key || '');
    if (!key) return;
    if (keys.has(key) && duplicates.length < 20) duplicates.push(key);
    keys.add(key);
  });
  return duplicates;
}

export function buildLibraryVirtualActualComparison({ visibleRows = [], prototypeRows = [], actualRows = [], alreadyVirtual = false } = {}) {
  const rows = Array.isArray(visibleRows) ? visibleRows : [];
  const protoRows = Array.isArray(prototypeRows) ? prototypeRows : [];
  const actual = Array.isArray(actualRows) ? actualRows : [];
  if (alreadyVirtual || actual.length < rows.length || rows.length <= 0) return null;
  const actualByKey = new Map(actual.map(row => [row.key, row]));
  const comparisons = protoRows.map(protoRow => comparePrototypeLibraryRow(protoRow, actualByKey.get(protoRow.key) || null));
  return {
    checkedRows: comparisons.length,
    mismatches: comparisons.filter(item => item.status !== 'ok').length,
    sample: comparisons.filter(item => item.status !== 'ok').slice(0, 12)
  };
}

export function buildLibraryVirtualGateProblems({ duplicateKeys = [], missingRequired = [], interactionSafety = null, actionAudit = null, actualComparison = null } = {}) {
  const problems = [];
  if (Array.isArray(duplicateKeys) && duplicateKeys.length) problems.push('duplicate-row-key');
  if (Array.isArray(missingRequired) && missingRequired.length) problems.push('prototype-required-dataset-missing');
  if (interactionSafety && !interactionSafety.safe) problems.push('interaction-target-unsafe');
  if (actionAudit?.prototype && !actionAudit.prototype.safe) problems.push('action-audit-unsafe');
  if (actualComparison && actualComparison.mismatches) problems.push('actual-dom-mismatch');
  return problems;
}
