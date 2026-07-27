import { createEl, formatBytes } from '../../core/utils.mjs';
import { toast } from '../ui.mjs';
import { getReaderPrefetchSnapshot } from '../reader/prefetch-queue.mjs';
import { getNetworkProfile } from '../reader/offline-status.mjs';
import { buildRecoveryDiagnosticsPayload, buildRecoveryDiagnosticsRows, getRecoveryReaderCacheTopNovelRows, RECOVERY_CACHE_DIAGNOSTICS_EXTRACTION_PASS } from './cache-diagnostics.mjs';
import { exportRecoveryJsonPayload } from './export-utils.mjs';
import { createRecoveryLowLevelActionRow } from './action-button-layout.mjs';
import { buildReaderAnchorRegressionReport, READER_ANCHOR_REGRESSION_REPORT_PASS } from '../reader/anchor-regression-report.mjs';

export const RECOVERY_DIAGNOSTICS_PANEL_REFACTOR_PASS = 'v169-recovery-diagnostics-panel-renderer-pass';

export function renderRecoveryDiagnosticsPanel(app, info = {}) {
  const readerCache = info.readerCacheDiagnostics || {};
  const virtual = info.virtualDiagnostics || {};
  const search = info.searchDiagnostics || {};
  const copyBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'진단 JSON 복사' });
  copyBtn.addEventListener('click', async () => {
    const payload = buildRecoveryDiagnosticsPayload({
      app,
      virtual,
      search,
      readerCache,
      libraryDiagnostics: info.libraryDiagnostics || null,
      searchCoverage: info.searchCoverage || null,
      prefetchSnapshot: getReaderPrefetchSnapshot(app),
      networkProfile: getNetworkProfile()
    });
    try {
      await exportRecoveryJsonPayload(app, payload);
      toast(app, 'success', '캐시 진단 복사 완료', 'Reader/cache/virtual 진단 JSON을 클립보드에 복사했습니다.');
    } catch (error) {
      toast(app, 'error', '캐시 진단 복사 실패', error.message || String(error));
    }
  });

  const anchorReportBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'앵커링 리포트 JSON' });
  anchorReportBtn.addEventListener('click', async () => {
    const payload = buildReaderAnchorRegressionReport(app, { notes: 'manual recovery diagnostics export' });
    try {
      await exportRecoveryJsonPayload(app, payload, { label:'reader-anchor-regression-report' });
      toast(app, 'success', '앵커링 리포트 복사 완료', 'anchorTrace, virtualDiagnostics, 현재 progress를 JSON으로 복사했습니다.');
    } catch (error) {
      toast(app, 'error', '앵커링 리포트 복사 실패', error.message || String(error));
    }
  });

  const topNovelRows = getRecoveryReaderCacheTopNovelRows(readerCache, 8);
  const rows = buildRecoveryDiagnosticsRows({ virtual, search, readerCache });

  const topList = topNovelRows.length
    ? createEl('div', { class:'recovery-cache-novel-list' }, topNovelRows.map(item => createEl('div', { class:'recovery-cache-novel-row' }, [
        createEl('div', { class:'recovery-cache-novel-main' }, [
          createEl('div', { class:'recovery-cache-novel-title', text:item.title || item.novelId }),
          createEl('div', { class:'recovery-cache-novel-meta', text:`${item.entries} entries · ${item.chunks} chunks · ${item.episodes} episodes · ${formatBytes(item.bytes)}` })
        ]),
        createEl('div', { class:'recovery-cache-novel-time', text:item.lastAccessedAt ? formatRecoveryRelativeTime(item.lastAccessedAt) : '-' })
      ])))
    : createEl('div', { class:'recovery-cache-empty', text:'작품별 IndexedDB cache 항목이 없습니다.' });

  return createEl('section', { class:'recovery-section recovery-diagnostics-panel', dataset:{ recoverySection:'diagnostics', recoveryCacheDiagnosticsPass:RECOVERY_CACHE_DIAGNOSTICS_EXTRACTION_PASS, recoveryDiagnosticsPanelPass:RECOVERY_DIAGNOSTICS_PANEL_REFACTOR_PASS, readerAnchorRegressionReportPass:READER_ANCHOR_REGRESSION_REPORT_PASS } }, [
    createEl('div', { class:'recovery-section-title-row' }, [
      createEl('div', {}, [
        createEl('div', { class:'recovery-section-title', text:'캐시/가상화 진단' }),
        createEl('div', { class:'recovery-section-desc', text:'장시간 리더 사용 시 row 측정 캐시, 검색 text cache, IndexedDB reader cache 증가량을 한 화면에서 확인합니다.' })
      ]),
      createRecoveryLowLevelActionRow([copyBtn, anchorReportBtn], { className:'recovery-inline-actions recovery-low-level-action-row', group:'diagnostics-copy' })
    ]),
    createEl('div', { class:'recovery-status-table' }, rows.map(([k, v]) => createEl('div', { class:'recovery-status-row' }, [
      createEl('div', { class:'recovery-status-key', text:k }),
      createEl('div', { class:'recovery-status-val', text:v })
    ]))),
    createEl('div', { class:'recovery-cache-subtitle', text:'IndexedDB cache 상위 작품' }),
    topList
  ]);
}

function formatRecoveryRelativeTime(ts) {
  if (!ts) return '-';
  const delta = Math.max(0, Date.now() - Number(ts));
  const sec = Math.round(delta / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.round(min / 60);
  if (hour < 48) return `${hour}h ago`;
  const day = Math.round(hour / 24);
  return `${day}d ago`;
}
