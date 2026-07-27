import { createEl, downloadTextFile } from '../../core/utils.mjs';
import {
  READ_DATA_IMPORT_POLICIES,
  READ_DATA_IMPORT_RESULT_LIMIT,
  READ_DATA_IMPORT_TYPES
} from './read-data-import-constants.mjs';
import { emptyImportDetail, itemTimestamp, resolveImportChoice } from './read-data-import-merge.mjs';

export function renderReadDataImportCompactSummary(app, preview) {
  const summary = buildReadDataImportCompactSummary(app, preview);
  const metricItems = [
    ['대상', summary.total.entries],
    ['가져오기', summary.total.imported],
    ['현재 유지', summary.total.currentKept],
    ['제외', summary.total.excluded],
    ['최신값', summary.total.newer],
    ['교체 삭제', summary.total.replaceDrops],
    ['목록 없음', summary.total.stale]
  ];
  const bucketRows = summary.buckets.map(bucket => createEl('div', { class: 'rdm-compact-row' }, [
    createEl('div', { class: 'rdm-compact-row-main' }, [
      createEl('span', { class: 'rdm-compact-bucket', text: bucket.label }),
      createEl('span', { class: 'rdm-compact-policy', text: getImportPolicyLabel(bucket.policy) })
    ]),
    createEl('div', { class: 'rdm-compact-row-meta', text: formatCompactBucketSummary(bucket) })
  ]));
  return createEl('div', { class: 'rdm-compact-summary' }, [
    createEl('div', { class: 'rdm-compact-head' }, [
      createEl('div', {}, [
        createEl('div', { class: 'rdm-compact-title', text: '적용 결과 요약' }),
        createEl('div', { class: 'rdm-compact-sub', text: `현재 정책과 항목별 선택 기준 · override ${summary.total.overrides}개` })
      ]),
      createEl('button', { class: 'rdm-compact-export', type: 'button', text: '요약 JSON', onclick: () => exportReadDataImportSummary(app, preview) })
    ]),
    createEl('div', { class: 'rdm-compact-metrics' }, metricItems.map(([label, value]) => createEl('div', { class: 'rdm-compact-metric' }, [
      createEl('span', { text: label }),
      createEl('b', { text: String(value || 0) })
    ]))),
    createEl('div', { class: 'rdm-compact-rows' }, bucketRows)
  ]);
}

export function buildReadDataImportCompactSummary(app, preview) {
  const total = createEmptyCompactImportSummary('all', '전체', 'mixed');
  const buckets = READ_DATA_IMPORT_TYPES.map(type => {
    const detail = preview.details?.[type.id] || emptyImportDetail();
    const policy = preview.policies?.[type.id] || 'merge';
    const staleKeys = new Set((detail.stale || []).map(entry => entry.key));
    const entries = [
      ...(detail.conflicts || []).map(entry => normalizeImportPreviewEntry(type, entry, 'conflict', staleKeys)),
      ...(detail.added || []).map(entry => normalizeImportPreviewEntry(type, entry, 'added', staleKeys))
    ];
    const bucket = createEmptyCompactImportSummary(type.id, type.label, policy);
    bucket.current = detail.current || 0;
    bucket.incoming = detail.incoming || 0;
    bucket.entries = entries.length;
    bucket.conflicts = detail.conflicts?.length || 0;
    bucket.added = detail.added?.length || 0;
    bucket.stale = detail.stale?.length || 0;
    bucket.overrides = Object.keys(preview.overrides?.[type.id] || {}).length;
    bucket.replaceDrops = policy === 'replace' ? Math.max(0, bucket.current - bucket.conflicts) : 0;
    entries.forEach(entry => {
      const override = preview.overrides?.[type.id]?.[entry.key];
      const action = resolveImportAction(policy, override, entry.current, entry.incoming);
      if (action.choice === 'newer') bucket.newer += 1;
      if (action.skipped) bucket.skipped += 1;
      if (action.action === 'incoming') bucket.imported += 1;
      else if (action.action === 'current') bucket.currentKept += 1;
      else bucket.excluded += 1;
    });
    addCompactBucketToTotal(total, bucket);
    return bucket;
  });
  return { total, buckets };
}

function normalizeImportPreviewEntry(type, entry, status, staleKeys) {
  return { ...entry, typeId: type.id, typeLabel: type.label, status, isStale: staleKeys.has(entry.key) };
}

function createEmptyCompactImportSummary(typeId, label, policy) {
  return {
    typeId,
    label,
    policy,
    current: 0,
    incoming: 0,
    entries: 0,
    conflicts: 0,
    added: 0,
    stale: 0,
    imported: 0,
    currentKept: 0,
    excluded: 0,
    newer: 0,
    skipped: 0,
    replaceDrops: 0,
    overrides: 0
  };
}

function addCompactBucketToTotal(total, bucket) {
  ['current', 'incoming', 'entries', 'conflicts', 'added', 'stale', 'imported', 'currentKept', 'excluded', 'newer', 'skipped', 'replaceDrops', 'overrides'].forEach(key => {
    total[key] += Number(bucket[key]) || 0;
  });
}

function resolveImportAction(policy, override, currentItem, incomingItem) {
  const skipped = policy === 'skip' && !override;
  const choice = resolveImportChoice(policy, override, currentItem, incomingItem);
  if (choice === 'incoming') return { choice, action: 'incoming', skipped };
  if (choice === 'newer') {
    if (!currentItem) return { choice, action: 'incoming', skipped };
    if (!incomingItem) return { choice, action: 'current', skipped };
    return { choice, action: itemTimestamp(incomingItem) >= itemTimestamp(currentItem) ? 'incoming' : 'current', skipped };
  }
  return { choice: 'current', action: currentItem ? 'current' : 'exclude', skipped };
}

export function formatCompactBucketSummary(bucket) {
  const parts = [
    `대상 ${bucket.entries}`,
    `가져오기 ${bucket.imported}`,
    `현재 유지 ${bucket.currentKept}`,
    `제외 ${bucket.excluded}`
  ];
  if (bucket.newer) parts.push(`최신값 ${bucket.newer}`);
  if (bucket.replaceDrops) parts.push(`교체 삭제 ${bucket.replaceDrops}`);
  if (bucket.conflicts) parts.push(`충돌 ${bucket.conflicts}`);
  if (bucket.added) parts.push(`신규 ${bucket.added}`);
  if (bucket.stale) parts.push(`목록 없음 ${bucket.stale}`);
  if (bucket.skipped) parts.push(`건너뜀 ${bucket.skipped}`);
  if (bucket.overrides) parts.push(`override ${bucket.overrides}`);
  return parts.join(' · ');
}

export function getImportPolicyLabel(policy) {
  return READ_DATA_IMPORT_POLICIES.find(item => item.id === policy)?.label || policy || '정책';
}

export function exportReadDataImportSummary(app, preview) {
  if (!preview) return;
  const summary = buildReadDataImportCompactSummary(app, preview);
  const payload = {
    schema: 'txt-reader-read-data-import-summary-v1',
    exportedAt: new Date().toISOString(),
    sourceFileName: preview.fileName || '',
    policies: preview.policies || {},
    overrides: preview.overrides || {},
    total: summary.total,
    buckets: summary.buckets
  };
  downloadTextFile(`txt-reader-read-data-import-summary-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2));
}

export function countImportOverrides(preview) {
  return READ_DATA_IMPORT_TYPES.reduce((sum, type) => sum + Object.keys(preview.overrides?.[type.id] || {}).length, 0);
}

export function formatImportChoiceLabel(choice) {
  if (choice === 'incoming') return '가져오기';
  if (choice === 'current') return '현재/제외';
  if (choice === 'newer') return '최신값';
  return '기본 정책';
}

export function exportReadDataImportDiff(app, preview, mode = 'all', providedEntries = null, filter = null) {
  if (!preview) return;
  const entries = Array.isArray(providedEntries) ? providedEntries : [];
  const payload = {
    schema: 'txt-reader-read-data-import-diff-v1',
    exportedAt: new Date().toISOString(),
    sourceFileName: preview.fileName || '',
    mode: mode === 'filtered' ? 'filtered' : 'all',
    filter: mode === 'filtered' ? (filter || { type: 'all', status: 'all', query: '' }) : { type: 'all', status: 'all', query: '' },
    counts: {
      total: Number(preview.__lastImportEntryTotal) || entries.length,
      exported: entries.length,
      overrides: countImportOverrides(preview)
    },
    summary: preview.summary || {},
    policies: preview.policies || {},
    entries: entries.slice(0, READ_DATA_IMPORT_RESULT_LIMIT).map(entry => serializeImportDiffEntry(preview, entry))
  };
  if (entries.length > READ_DATA_IMPORT_RESULT_LIMIT) payload.truncated = entries.length - READ_DATA_IMPORT_RESULT_LIMIT;
  const scope = mode === 'filtered' ? 'filtered' : 'all';
  downloadTextFile(`txt-reader-read-data-import-diff-${scope}-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2));
}

function serializeImportDiffEntry(preview, entry) {
  return {
    type: entry.typeId,
    typeLabel: entry.typeLabel,
    status: entry.isStale ? 'stale' : entry.status,
    key: entry.key,
    label: entry.label,
    override: preview.overrides?.[entry.typeId]?.[entry.key] || 'policy',
    effectiveChoice: resolveImportChoice(preview.policies?.[entry.typeId] || 'merge', preview.overrides?.[entry.typeId]?.[entry.key], entry.current, entry.incoming),
    currentTimestamp: itemTimestamp(entry.current || {}),
    incomingTimestamp: itemTimestamp(entry.incoming || {}),
    current: entry.current || null,
    incoming: entry.incoming || null
  };
}
