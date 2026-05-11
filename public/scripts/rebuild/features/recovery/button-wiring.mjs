import { createEl } from '../../core/utils.mjs';
import { toast } from '../ui.mjs';
import { exportRecoveryJsonPayload } from './export-utils.mjs';

export const RECOVERY_BUTTON_WIRING_REFACTOR_PASS = 'v163-recovery-button-wiring-helper-pass';

function normalizeFactory(value) {
  return typeof value === 'function' ? value : () => value;
}

export function createRecoveryJsonCopyButton(app, options = {}) {
  const text = options.text || 'JSON 복사';
  const btn = createEl('button', {
    class: options.className || 'devdbg-btn',
    type: 'button',
    text
  });
  const payloadFactory = normalizeFactory(options.payload);
  btn.addEventListener('click', async () => {
    try {
      const payload = payloadFactory();
      await exportRecoveryJsonPayload(app, payload);
      toast(app, 'success', options.successTitle || `${text} 완료`, options.successMessage || 'Recovery Center JSON을 클립보드에 복사했습니다.');
    } catch (error) {
      toast(app, 'error', options.errorTitle || `${text} 실패`, error?.message || String(error));
    }
  });
  return btn;
}
