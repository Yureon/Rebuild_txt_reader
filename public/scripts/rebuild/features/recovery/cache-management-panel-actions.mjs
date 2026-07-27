import { planReaderCachePrune } from '../reader/cache-store.mjs';
import { toast } from '../ui.mjs';
import { exportRecoveryJsonPayload } from './export-utils.mjs';
import { parseRecoveryPruneOptions } from './cache-diagnostics.mjs';

export const RECOVERY_CACHE_MANAGEMENT_PANEL_ACTIONS_PASS = 'v244-recovery-cache-management-panel-actions-pass';

export function bindRecoveryCacheManagementPanelActions(app, refs = {}, buttons = {}, actions = {}) {
  buttons.defaultPresetBtn?.addEventListener('click', () => actions.applyPreset?.(app, refs, 'default'));
  buttons.conservativePresetBtn?.addEventListener('click', () => actions.applyPreset?.(app, refs, 'conservative'));
  buttons.compactPresetBtn?.addEventListener('click', () => actions.applyPreset?.(app, refs, 'compact'));
  buttons.dryRunBtn?.addEventListener('click', () => actions.runDryRun?.(app, refs));
  buttons.allNovelsBtn?.addEventListener('click', () => actions.openCachedNovelsModal?.(app));
  buttons.runBtn?.addEventListener('click', () => actions.runPrune?.(app, refs));
  buttons.copyBtn?.addEventListener('click', () => copyRecoveryPrunePlan(app, refs));
}

export async function copyRecoveryPrunePlan(app, refs) {
  const options = parseRecoveryPruneOptions(refs);
  const nextPlan = await planReaderCachePrune(app, options);
  try {
    await exportRecoveryJsonPayload(app, nextPlan);
    toast(app, 'success', 'Prune 계획 복사 완료', '캐시 정리 dry-run 결과를 클립보드에 복사했습니다.');
  } catch (error) {
    toast(app, 'error', 'Prune 계획 복사 실패', error.message || String(error));
  }
}
