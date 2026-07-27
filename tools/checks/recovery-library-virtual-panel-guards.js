const fs = require('fs');
const path = require('path');

const RECOVERY_LIBRARY_VIRTUAL_PANEL_GUARD_PASS = 'v276-recovery-library-virtual-panel-guard-pass';

function runRecoveryLibraryVirtualPanelGuards(projectRoot) {
  if (!projectRoot) throw new Error('runRecoveryLibraryVirtualPanelGuards requires projectRoot');
  const panelPath = path.join(projectRoot, 'public', 'scripts', 'rebuild', 'features', 'recovery', 'library-virtual-basic-panels.mjs');
  const source = fs.readFileSync(panelPath, 'utf8');
  [
    "formatLibraryFallbackGroups",
    "from './library-formatters.mjs'",
    "createLibraryVirtualFallbackUxReviewPanel"
  ].forEach(marker => {
    if (!source.includes(marker)) throw new Error('recovery library-virtual panel guard missing marker: ' + marker);
  });
  return { pass: RECOVERY_LIBRARY_VIRTUAL_PANEL_GUARD_PASS };
}

module.exports = { RECOVERY_LIBRARY_VIRTUAL_PANEL_GUARD_PASS, runRecoveryLibraryVirtualPanelGuards };
