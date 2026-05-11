import { createEl, formatBytes } from '../../core/utils.mjs';
import { getReaderCacheDefaultPruneLimits } from '../reader/cache-store.mjs';
import { buildRecoveryCacheManagementRows, formatPrunePlan, getRecoveryReaderCacheTopNovelRows } from './cache-diagnostics.mjs';
import { bindRecoveryCacheManagementPanelActions } from './cache-management-panel-actions.mjs';
import { createRecoveryLowLevelActionRow } from './action-button-layout.mjs';

export const RECOVERY_CACHE_MANAGEMENT_PANEL_REFACTOR_PASS = 'v172-recovery-cache-management-panel-pass';

export function renderRecoveryCacheManagementPanel(app, info = {}, actions = {}) {
  const readerCache = info.readerCacheDiagnostics || {};
  const plan = info.cachePrunePlan || {};
  const limits = getReaderCacheDefaultPruneLimits();
  const formatRelativeTime = typeof actions.formatRelativeTime === 'function' ? actions.formatRelativeTime : fallbackRelativeTime;
  const maxEntriesInput = createEl('input', { class:'recovery-cache-input', type:'number', min:'20', step:'20', value:String(plan.maxEntries || limits.maxEntries) });
  const maxMbInput = createEl('input', { class:'recovery-cache-input', type:'number', min:'1', step:'4', value:String(Math.max(1, Math.round((plan.maxBytes || limits.maxBytes) / 1024 / 1024))) });
  const radiusInput = createEl('input', { class:'recovery-cache-input small', type:'number', min:'0', step:'1', value:String(plan.protectRadius ?? 8) });
  const protectInput = createEl('input', { type:'checkbox' });
  protectInput.checked = plan.protectCurrent !== false;
  const refs = { maxEntriesInput, maxMbInput, radiusInput, protectInput };
  const planBox = createEl('pre', { class:'recovery-cache-plan', text:formatPrunePlan(plan, { formatRelativeTime }) });
  refs.planBox = planBox;

  const dryRunBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'Prune 예상' });
  const runBtn = createEl('button', { class:'devdbg-btn danger', type:'button', text:'Prune 실행' });
  const copyBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'계획 JSON 복사' });
  const allNovelsBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'전체 cached novels' });
  const defaultPresetBtn = createEl('button', { class:'devdbg-btn tiny', type:'button', text:'기본값' });
  const conservativePresetBtn = createEl('button', { class:'devdbg-btn tiny', type:'button', text:'보수' });
  const compactPresetBtn = createEl('button', { class:'devdbg-btn tiny', type:'button', text:'압축' });

  bindRecoveryCacheManagementPanelActions(app, refs, { defaultPresetBtn, conservativePresetBtn, compactPresetBtn, dryRunBtn, allNovelsBtn, runBtn, copyBtn }, actions);

  const rows = buildRecoveryCacheManagementRows(app, readerCache, plan);
  const topNovelRows = getRecoveryReaderCacheTopNovelRows(readerCache, 12);
  const novelList = topNovelRows.length
    ? createEl('div', { class:'recovery-cache-manage-list' }, topNovelRows.map(item => {
        const deleteBtn = createEl('button', { class:'devdbg-btn danger tiny', type:'button', text:'삭제' });
        deleteBtn.addEventListener('click', () => actions.deleteNovelCache?.(app, item));
        return createEl('div', { class:'recovery-cache-manage-row' }, [
          createEl('div', { class:'recovery-cache-novel-main' }, [
            createEl('div', { class:'recovery-cache-novel-title', text:item.title || item.novelId }),
            createEl('div', { class:'recovery-cache-novel-meta', text:`${item.entries} entries · ${item.chunks} chunks · ${item.episodes} episodes · ${formatBytes(item.bytes)} · ${item.lastAccessedAt ? formatRelativeTime(item.lastAccessedAt) : '-'}` })
          ]),
          deleteBtn
        ]);
      }))
    : createEl('div', { class:'recovery-cache-empty', text:'삭제할 작품별 IndexedDB cache 항목이 없습니다.' });

  return createEl('section', { class:'recovery-section recovery-cache-management-panel', dataset:{ recoverySection:'cache-management' } }, [
    createEl('div', { class:'recovery-section-title-row' }, [
      createEl('div', {}, [createEl('div', { class:'recovery-section-title', text:'Reader cache 관리' })]),
      allNovelsBtn
    ]),
    createEl('div', { class:'recovery-section-desc', text:'IndexedDB reader cache를 현재 작품 보호 규칙으로 dry-run한 뒤 수동 정리합니다. 서버 데이터, 읽기 위치, 북마크는 삭제하지 않습니다.' }),
    createEl('div', { class:'recovery-status-table' }, rows.map(([k, v]) => createEl('div', { class:'recovery-status-row' }, [
      createEl('div', { class:'recovery-status-key', text:k }),
      createEl('div', { class:'recovery-status-val', text:v })
    ]))),
    createEl('div', { class:'recovery-cache-controls' }, [
      createEl('label', {}, [createEl('span', { text:'최대 entries' }), maxEntriesInput]),
      createEl('label', {}, [createEl('span', { text:'최대 MB' }), maxMbInput]),
      createEl('label', { class:'recovery-cache-check' }, [protectInput, createEl('span', { text:'현재 작품 주변 보호' })]),
      createEl('label', {}, [createEl('span', { text:'보호 반경' }), radiusInput]),
      createRecoveryLowLevelActionRow([defaultPresetBtn, conservativePresetBtn, compactPresetBtn], { className:'recovery-prune-presets recovery-low-level-action-row', group:'cache-management-presets', tiny:true })
    ]),
    createRecoveryLowLevelActionRow([dryRunBtn, runBtn, copyBtn], { className:'recovery-inline-actions recovery-cache-actions recovery-low-level-action-row', group:'cache-management' }),
    planBox,
    createEl('div', { class:'recovery-cache-subtitle', text:'작품별 cache 삭제' }),
    novelList
  ]);
}

// copyRecoveryPrunePlan moved to cache-management-panel-actions.mjs in v244.

function fallbackRelativeTime(ts) {
  const value = Number(ts) || 0;
  if (!value) return '-';
  try { return new Date(value).toLocaleString(); } catch { return String(ts || '-'); }
}
