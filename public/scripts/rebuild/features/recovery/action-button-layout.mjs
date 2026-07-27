import { createEl } from '../../core/utils.mjs';

export const RECOVERY_ACTION_BUTTON_LAYOUT_PASS = 'v251-recovery-action-button-layout-pass';
export const RECOVERY_ACTION_BUTTON_LAYOUT_LOW_LEVEL_PASS = 'v251-recovery-action-button-low-level-layout-pass';
export const RECOVERY_ACTION_BUTTON_COPY_DOWNLOAD_ROW_PASS = 'v252-recovery-action-button-copy-download-row-pass';
export const RECOVERY_ACTION_BUTTON_STATE_SUMMARY_PASS = 'v254-recovery-action-button-state-summary-pass';
export const RECOVERY_ACTION_BUTTON_STATE_MATRIX_PASS = 'v255-recovery-action-button-state-matrix-pass';
export const RECOVERY_ACTION_BUTTON_PANEL_MATRIX_PASS = 'v256-recovery-action-button-panel-matrix-pass';
export const RECOVERY_ACTION_BUTTON_PANEL_MATRIX_RENDER_PASS = 'v257-recovery-action-button-panel-matrix-render-pass';

export function normalizeRecoveryActionButton(button, index = 0, options = {}) {
  if (!button) return button;
  button.dataset.recoveryActionButtonLayoutPass = RECOVERY_ACTION_BUTTON_LAYOUT_PASS;
  button.dataset.recoveryActionButtonIndex = String(index);
  if (options.role) button.dataset.recoveryActionButtonRole = options.role;
  button.dataset.recoveryActionButtonState = button.disabled ? 'disabled' : 'enabled';
  if (!button.classList.contains('devdbg-btn')) button.classList.add('devdbg-btn');
  if (options.tiny && !button.classList.contains('tiny')) button.classList.add('tiny');
  return button;
}

export function createRecoveryActionButtonRow(buttons = [], options = {}) {
  const list = (Array.isArray(buttons) ? buttons : []).filter(Boolean).map((button, index) => normalizeRecoveryActionButton(button, index, options));
  return createEl('div', {
    class: options.className || 'recovery-action-button-row',
    dataset: {
      recoveryActionButtonLayoutPass: RECOVERY_ACTION_BUTTON_LAYOUT_PASS,
      recoveryActionButtonGroup: options.group || 'default'
    }
  }, list);
}

export function createRecoveryLowLevelActionRow(buttons = [], options = {}) {
  const row = createRecoveryActionButtonRow(buttons, {
    ...options,
    className: options.className || 'recovery-inline-actions recovery-low-level-action-row',
    role: options.role || 'low-level'
  });
  row.dataset.recoveryLowLevelActionLayoutPass = RECOVERY_ACTION_BUTTON_LAYOUT_LOW_LEVEL_PASS;
  return row;
}

export function appendRecoveryActionButtonRowClass(row, className = '') {
  if (!row || !className) return row;
  String(className).split(/\s+/).filter(Boolean).forEach(name => row.classList.add(name));
  return row;
}

export function summarizeRecoveryActionButtonState(buttons = []) {
  const list = Array.isArray(buttons) ? buttons.filter(Boolean) : [];
  return {
    pass: RECOVERY_ACTION_BUTTON_STATE_SUMMARY_PASS,
    count: list.length,
    disabled: list.filter(btn => !!btn.disabled).length,
    enabled: list.filter(btn => !btn.disabled).length,
    roles: list.map(btn => btn?.dataset?.recoveryActionButtonRole || '').filter(Boolean)
  };
}

export function buildRecoveryActionButtonStateMatrix(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const matrix = list.map((entry, index) => {
    const buttons = Array.isArray(entry?.buttons) ? entry.buttons : [];
    const state = summarizeRecoveryActionButtonState(buttons);
    return {
      index,
      group: entry?.group || 'default',
      count: state.count,
      enabled: state.enabled,
      disabled: state.disabled,
      roles: state.roles
    };
  });
  return {
    pass: RECOVERY_ACTION_BUTTON_STATE_MATRIX_PASS,
    rows: matrix.length,
    totalButtons: matrix.reduce((sum, row) => sum + row.count, 0),
    disabledButtons: matrix.reduce((sum, row) => sum + row.disabled, 0),
    matrix
  };
}


export function buildRecoveryActionPanelStateMatrix(panels = []) {
  const list = Array.isArray(panels) ? panels : [];
  const panelMatrix = list.map((panel, index) => {
    const rows = Array.isArray(panel?.rows) ? panel.rows : [];
    const rowMatrix = buildRecoveryActionButtonStateMatrix(rows);
    return {
      index,
      panel: panel?.panel || panel?.name || 'unknown',
      rowCount: rowMatrix.rows,
      totalButtons: rowMatrix.totalButtons,
      disabledButtons: rowMatrix.disabledButtons,
      rows: rowMatrix.matrix
    };
  });
  return {
    pass: RECOVERY_ACTION_BUTTON_PANEL_MATRIX_PASS,
    panels: panelMatrix.length,
    totalRows: panelMatrix.reduce((sum, panel) => sum + panel.rowCount, 0),
    totalButtons: panelMatrix.reduce((sum, panel) => sum + panel.totalButtons, 0),
    disabledButtons: panelMatrix.reduce((sum, panel) => sum + panel.disabledButtons, 0),
    panelMatrix
  };
}


export function createRecoveryActionPanelMatrixSection(panels = [], options = {}) {
  const matrix = buildRecoveryActionPanelStateMatrix(panels);
  const rows = matrix.panelMatrix.map(panel => createEl('div', {
    class: 'recovery-action-panel-matrix-row',
    dataset: {
      recoveryActionButtonPanel: panel.panel,
      recoveryActionButtonRows: String(panel.rowCount),
      recoveryActionButtonTotal: String(panel.totalButtons),
      recoveryActionButtonDisabled: String(panel.disabledButtons)
    }
  }, [
    createEl('strong', {}, [panel.panel]),
    createEl('span', {}, [` rows:${panel.rowCount} buttons:${panel.totalButtons} disabled:${panel.disabledButtons}`])
  ]));
  const section = createEl(options.tag || 'section', {
    class: options.className || 'recovery-action-panel-matrix-section',
    dataset: {
      recoveryActionButtonPanelMatrixPass: RECOVERY_ACTION_BUTTON_PANEL_MATRIX_PASS,
      recoveryActionButtonPanelMatrixRenderPass: RECOVERY_ACTION_BUTTON_PANEL_MATRIX_RENDER_PASS,
      recoveryActionButtonPanelMatrixPanels: String(matrix.panels),
      recoveryActionButtonPanelMatrixButtons: String(matrix.totalButtons)
    }
  }, rows);
  section.__recoveryActionPanelMatrix = matrix;
  return section;
}

export function summarizeRecoveryActionButtonLayout(buttons = []) {
  const list = Array.isArray(buttons) ? buttons.filter(Boolean) : [];
  return {
    pass: RECOVERY_ACTION_BUTTON_LAYOUT_PASS,
    lowLevelPass: RECOVERY_ACTION_BUTTON_LAYOUT_LOW_LEVEL_PASS,
    copyDownloadPass: RECOVERY_ACTION_BUTTON_COPY_DOWNLOAD_ROW_PASS,
    stateSummaryPass: RECOVERY_ACTION_BUTTON_STATE_SUMMARY_PASS,
    stateMatrixPass: RECOVERY_ACTION_BUTTON_STATE_MATRIX_PASS,
    panelMatrixPass: RECOVERY_ACTION_BUTTON_PANEL_MATRIX_PASS,
    panelMatrixRenderPass: RECOVERY_ACTION_BUTTON_PANEL_MATRIX_RENDER_PASS,
    state: summarizeRecoveryActionButtonState(list),
    count: list.length,
    labels: list.map(btn => String(btn?.textContent || btn?.innerText || '').trim()).filter(Boolean),
    className: 'recovery-action-button-row'
  };
}

export function createRecoveryCopyDownloadActionRow(buttons = [], options = {}) {
  const row = createRecoveryLowLevelActionRow(buttons, {
    ...options,
    group: options.group || 'copy-download',
    role: options.role || 'copy-download'
  });
  row.classList.add('recovery-copy-download-action-row');
  row.dataset.recoveryCopyDownloadActionRowPass = RECOVERY_ACTION_BUTTON_COPY_DOWNLOAD_ROW_PASS;
  return row;
}
