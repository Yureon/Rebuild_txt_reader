export const RECOVERY_MODAL_LAYER_PASS = 'v175-recovery-modal-layer-helper-pass';

export function markRecoverySubModalLayer(overlay, modal, label = 'recovery-submodal') {
  if (overlay) {
    overlay.dataset.recoveryModalLayerPass = 'v175';
    overlay.dataset.recoveryModalRole = label;
    overlay.setAttribute('aria-hidden', 'false');
  }
  if (modal) {
    modal.dataset.recoveryModalLayerPass = 'v175';
    modal.setAttribute('role', modal.getAttribute('role') || 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('tabindex', modal.getAttribute('tabindex') || '-1');
  }
}
