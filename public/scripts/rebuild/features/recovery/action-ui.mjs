import { createEl } from '../../core/utils.mjs';

export const RECOVERY_ACTION_UI_REFACTOR_PASS = 'v168-recovery-action-ui-helper-pass';

export function createRecoveryActionDetails(label, buttons = [], options = {}) {
  const details = createEl('details', { class:'recovery-action-details', dataset:{ recoveryActionGroup: options.group || label } }, [
    createEl('summary', { class:'recovery-action-summary devdbg-btn', text:label }),
    createEl('div', { class:'recovery-action-menu' }, buttons)
  ]);
  if (options.open) details.open = true;
  return details;
}

export function createRecoveryActionCluster(children = []) {
  return createEl('div', { class:'recovery-action-cluster', dataset:{ recoveryActionCompact:'v140' } }, children);
}

