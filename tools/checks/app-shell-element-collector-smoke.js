const fs = require('fs');
const path = require('path');

const APP_SHELL_ELEMENT_COLLECTOR_SMOKE_PASS = 'v276-app-shell-element-collector-reverse-smoke-pass';
const ALLOWED_SHELL_ONLY_IDS = new Set([
  'app','search-history-box','folder-bulk-actions','main','toolbar','bookmark-modal-desc','bookmark-modal-title','settings-panel-title','settings-panel-desc','settings-panel-body','settings-tab-general','settings-tab-viewer','settings-tab-function','settings-tab-data','settings-tab-debug','general-panel','data-panel','debug-panel','viewer-panel','viewer-preview-stats','viewer-preview-content','viewer-preview-size-down','viewer-preview-size-up','viewer-preview-brightness','pad-v-val','func-panel','fcontrol-panel','fstatusbar-panel','safe-area-fit-card','device-management-title','device-management-desc','read-data-desc','read-data-title','toast-wrap','sync-status-dock','sync-status-pill','sync-status-text','chunk-jumper-overlay','chunk-jumper-panel','chunk-jumper-title','chunk-slider','chunk-input','chunk-cancel','chunk-go','custom-css-title','custom-css-desc','shortcut-title','shortcut-desc','nsearch-title','nsearch-desc','preprocess-editor-title','preprocess-editor-desc','font-modal-header','font-modal-title','font-modal-desc','font-modal-body','font-system-title','font-preview','font-custom-title','recovery-center-title','recovery-center-desc','recovery-center-more','theme-editor-title','theme-editor-desc','site-language-editor-title','site-language-editor-desc','account-password-overlay','account-password-modal','account-password-modal-title','account-password-modal-close','open-account-password-modal-btn','devdbg-title','devdbg-desc'
]);

function collectQuotedIdsFromElementsSource(source) {
  const match = source.match(/const ids = \[([\s\S]*?)\];/);
  if (!match) throw new Error('collectElements ids array not found');
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map(item => item[1]);
}

function collectIdsFromAppShell(shell) {
  return new Set(Array.from(shell.matchAll(/\bid="([^"]+)"/g)).map(item => item[1]));
}

function runAppShellElementCollectorSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runAppShellElementCollectorSmoke requires projectRoot');
  const shell = fs.readFileSync(path.join(projectRoot, 'public', 'fragments', 'app-shell.html'), 'utf8') + '\n' + fs.readFileSync(path.join(projectRoot, 'public', 'fragments', 'deferred-ui.html'), 'utf8');
  const elements = fs.readFileSync(path.join(projectRoot, 'public', 'scripts', 'rebuild', 'features', 'ui', 'elements.mjs'), 'utf8');
  const collectedIds = collectQuotedIdsFromElementsSource(elements);
  const shellIds = collectIdsFromAppShell(shell);
  const collected = new Set(collectedIds);
  const missing = collectedIds.filter(id => !shellIds.has(id));
  if (missing.length) throw new Error('app.els collector has IDs missing from app-shell fragments: ' + missing.join(', '));
  const unexpectedShellOnly = Array.from(shellIds).filter(id => !collected.has(id) && !ALLOWED_SHELL_ONLY_IDS.has(id)).sort();
  if (unexpectedShellOnly.length) throw new Error('app-shell fragments have IDs without collector classification: ' + unexpectedShellOnly.join(', '));
  const staleAllowed = Array.from(ALLOWED_SHELL_ONLY_IDS).filter(id => !shellIds.has(id)).sort();
  if (staleAllowed.length) throw new Error('app shell reverse audit allowlist contains stale IDs: ' + staleAllowed.join(', '));
  if (!collectedIds.includes('library-quick-list')) throw new Error('app.els collector must keep library-quick-list');
  if (!shell.includes('data-library-quick-pass="v273"')) throw new Error('app-shell quick list version marker mismatch');
  return { pass: APP_SHELL_ELEMENT_COLLECTOR_SMOKE_PASS, collected: collectedIds.length, shellIds: shellIds.size, missing: missing.length, shellOnlyAllowed: ALLOWED_SHELL_ONLY_IDS.size };
}

module.exports = { APP_SHELL_ELEMENT_COLLECTOR_SMOKE_PASS, runAppShellElementCollectorSmoke };
