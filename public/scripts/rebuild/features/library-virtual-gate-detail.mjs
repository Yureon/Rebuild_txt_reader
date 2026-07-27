import { getLibraryVirtualFailureCategoryLabel, getLibraryVirtualFailureSuggestion } from './library-virtual-fallback-policy.mjs';

export const LIBRARY_VIRTUAL_GATE_DETAIL_PASS = 'v209-library-virtual-gate-detail-pass';

export function buildLibraryVirtualGateDetail({ problems = [], primaryCategory = 'unknown', categoryGroups = [], duplicateKeys = [], missingRequired = [], interactionSafety = null, actualComparison = null } = {}) {
  const safeProblems = Array.isArray(problems) ? problems : [];
  const groups = Array.isArray(categoryGroups) ? categoryGroups : [];
  const category = primaryCategory || groups[0]?.category || 'unknown';
  return {
    pass: LIBRARY_VIRTUAL_GATE_DETAIL_PASS,
    allowed: safeProblems.length === 0,
    problemCount: safeProblems.length,
    primaryCategory: category,
    primaryCategoryLabel: getLibraryVirtualFailureCategoryLabel(category),
    suggestedAction: getLibraryVirtualFailureSuggestion(category),
    hasDuplicateKeys: Array.isArray(duplicateKeys) && duplicateKeys.length > 0,
    missingRequiredRows: Array.isArray(missingRequired) ? missingRequired.length : 0,
    interactionSafe: interactionSafety ? !!interactionSafety.safe : null,
    actualDomMismatchCount: Number(actualComparison?.mismatches) || 0,
    problemSummary: safeProblems.length ? safeProblems.join(',') : 'pass',
    groupSummary: groups.map(group => ({
      category: group.category || 'unknown',
      label: group.label || getLibraryVirtualFailureCategoryLabel(group.category),
      count: Number(group.count) || 0
    }))
  };
}
