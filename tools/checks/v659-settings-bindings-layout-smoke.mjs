import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('public/fragments/deferred-ui.html');
const css = read('public/styles/deferred-ui.css');
const elements = read('public/scripts/rebuild/features/ui/elements.mjs');
const appearance = read('public/scripts/rebuild/features/settings/appearance.mjs');
const dataTools = read('public/scripts/rebuild/features/settings/data-tools.mjs');

for (const id of ['viewer-preview-size-down','viewer-preview-size-up','viewer-preview-brightness','settings-reset-sync-status']) {
  assert.ok(html.includes(`id="${id}"`), `${id} missing from settings fragment`);
  assert.ok(elements.includes(`'${id}'`), `${id} missing from element collection`);
}
for (const token of ['viewerPreviewSizeDown','viewerPreviewSizeUp','viewerPreviewBrightness','[data-preview-bg]','[data-preview-text]','syncViewerPreview']) {
  assert.ok(appearance.includes(token), `${token} missing from actual appearance binding`);
}
for (const token of ['settingsResetSyncBtn','settingsResetSharedBtn','settingsResetDeviceBtn','putSharedPatch','putDevicePatch','splitPreferencesForSync','resetSyncedSettings']) {
  assert.ok(dataTools.includes(token), `${token} missing from sync reset binding`);
}
assert.ok(css.includes('z-index:var(--z-settings-panel,190)!important'), 'library settings must remain below child modal layer');
assert.ok(css.includes('#read-data-modal[data-modal-a11y-pass]'), 'read-data modal layout contract missing');
assert.ok(css.includes('@media(max-width:760px)'), 'viewport-based mobile modal contract missing');
assert.ok(!css.includes('body[data-client-profile="mobile"] #read-data-overlay.open'), 'profile-only read-data mobile ownership must be removed');
assert.ok(css.lastIndexOf('.settings-panel .sp-tab-panel[hidden]{display:none!important}') > css.lastIndexOf('.settings-panel.settings-page .sp-tab'), 'hidden settings contexts must win final cascade');
assert.ok(css.lastIndexOf('#read-data-overlay,') > css.lastIndexOf('#read-data-overlay{z-index:78 !important;}'), 'read-data child overlay must win legacy z-index');
assert.ok(!css.includes('grid-template-columns:minmax(180px,.72fr) minmax(0,1.28fr)'), 'old imbalanced settings ratio grid remains');
console.log(JSON.stringify({ pass:'v659-settings-bindings-layout-smoke-pass', assertions:28 }, null, 2));
