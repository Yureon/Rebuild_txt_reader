const { runModuleSmokeScript } = require('./smoke-child-runner.js');

const RECOVERY_ACTION_ROW_DOM_SMOKE_PASS = 'v253-recovery-action-row-dom-smoke-pass';

function runRecoveryActionRowDomSmoke(projectRoot) {
  const script = `
    class FakeClassList {
      constructor(el) { this.el = el; this.set = new Set(); }
      add(...names) { names.filter(Boolean).forEach(name => this.set.add(String(name))); this.el.className = Array.from(this.set).join(' '); }
      contains(name) { return this.set.has(String(name)); }
    }
    class FakeElement {
      constructor(tag) { this.tagName = String(tag).toUpperCase(); this.dataset = {}; this.children = []; this.textContent = ''; this.className = ''; this.classList = new FakeClassList(this); this.attrs = {}; }
      append(child) { this.children.push(child); }
      setAttribute(key, value) { this.attrs[key] = String(value); }
      addEventListener() {}
    }
    globalThis.Node = FakeElement;
    globalThis.document = {
      createElement(tag) { return new FakeElement(tag); },
      createTextNode(text) { const node = new FakeElement('#text'); node.textContent = String(text); return node; }
    };
    const mod = await import('./public/scripts/rebuild/features/recovery/action-button-layout.mjs');
    const buttons = [document.createElement('button'), document.createElement('button')];
    buttons[0].textContent = '복사';
    buttons[1].textContent = '저장';
    buttons[1].disabled = true;
    const row = mod.createRecoveryCopyDownloadActionRow(buttons, { group:'dom-smoke' });
    if (row.dataset.recoveryCopyDownloadActionRowPass !== 'v252-recovery-action-button-copy-download-row-pass') throw new Error('copy/download row pass missing');
    if (row.dataset.recoveryLowLevelActionLayoutPass !== 'v251-recovery-action-button-low-level-layout-pass') throw new Error('low-level row pass missing');
    if (!row.classList.contains('recovery-copy-download-action-row')) throw new Error('copy/download row class missing');
    if (buttons.some((button, index) => button.dataset.recoveryActionButtonIndex !== String(index))) throw new Error('button index dataset missing');
    if (buttons[0].dataset.recoveryActionButtonState !== 'enabled' || buttons[1].dataset.recoveryActionButtonState !== 'disabled') throw new Error('button state dataset missing');
    if (!buttons.every(button => button.dataset.recoveryActionButtonRole === 'copy-download')) throw new Error('copy/download role dataset missing');
    const cacheButton = document.createElement('button');
    cacheButton.textContent = '캐시 정리';
    cacheButton.disabled = true;
    const searchButton = document.createElement('button');
    searchButton.textContent = '검색 진단';
    mod.createRecoveryLowLevelActionRow([cacheButton], { group:'cache', role:'cache-action' });
    mod.createRecoveryLowLevelActionRow([searchButton], { group:'search', role:'search-action' });
    const matrix = mod.buildRecoveryActionButtonStateMatrix([
      { group:'copy-download', buttons },
      { group:'cache', buttons:[cacheButton] },
      { group:'search', buttons:[searchButton] }
    ]);
    if (matrix.pass !== 'v255-recovery-action-button-state-matrix-pass' || matrix.rows !== 3 || matrix.totalButtons !== 4 || matrix.disabledButtons !== 2) throw new Error('action row state matrix mismatch');
    const panelMatrix = mod.buildRecoveryActionPanelStateMatrix([
      { panel:'reader-failure', rows:[{ group:'copy-download', buttons }] },
      { panel:'cache', rows:[{ group:'cache', buttons:[cacheButton] }] },
      { panel:'search', rows:[{ group:'search', buttons:[searchButton] }] }
    ]);
    if (panelMatrix.pass !== 'v256-recovery-action-button-panel-matrix-pass' || panelMatrix.panels !== 3 || panelMatrix.totalRows !== 3 || panelMatrix.totalButtons !== 4 || panelMatrix.disabledButtons !== 2) throw new Error('action row panel matrix mismatch');
    const section = mod.createRecoveryActionPanelMatrixSection([
      { panel:'reader-failure', rows:[{ group:'copy-download', buttons }] },
      { panel:'cache', rows:[{ group:'cache', buttons:[cacheButton] }] },
      { panel:'search', rows:[{ group:'search', buttons:[searchButton] }] }
    ]);
    if (section.dataset.recoveryActionButtonPanelMatrixRenderPass !== 'v257-recovery-action-button-panel-matrix-render-pass') throw new Error('action row panel matrix render pass missing');
    if (section.children.length !== 3 || section.dataset.recoveryActionButtonPanelMatrixButtons !== '4') throw new Error('action row panel matrix render rows mismatch');
    const summary = mod.summarizeRecoveryActionButtonLayout(buttons);
    if (summary.copyDownloadPass !== 'v252-recovery-action-button-copy-download-row-pass' || summary.count !== 2) throw new Error('action row summary mismatch');
    if (summary.stateSummaryPass !== 'v254-recovery-action-button-state-summary-pass' || summary.stateMatrixPass !== 'v255-recovery-action-button-state-matrix-pass' || summary.panelMatrixPass !== 'v256-recovery-action-button-panel-matrix-pass' || summary.panelMatrixRenderPass !== 'v257-recovery-action-button-panel-matrix-render-pass' || summary.state.disabled !== 1 || summary.state.enabled !== 1) throw new Error('action row state summary mismatch');
  `;
  return runModuleSmokeScript(projectRoot, script, { label:'recovery action row DOM smoke', timeoutMs:8000 })
    .then(() => ({ pass: RECOVERY_ACTION_ROW_DOM_SMOKE_PASS }));
}

module.exports = { RECOVERY_ACTION_ROW_DOM_SMOKE_PASS, runRecoveryActionRowDomSmoke };
