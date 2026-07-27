#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');

const read = file => fs.readFileSync(file, 'utf8');
const html = read('public/metadata.html');
const page = read('public/scripts/rebuild/metadata-page.mjs');
const modal = read('public/scripts/rebuild/features/library-metadata-runtime.mjs');
const metadataCss = read('public/styles/metadata-page.css');
const appCss = read('public/styles/app.css');
const themeBoot = read('public/scripts/theme-boot.js');
const appState = read('public/scripts/rebuild/state/app-state.mjs');
const service = read('server/services/metadata-service.js');
const queue = read('server/services/metadata-queue-service.js');
const routes = read('server/routes/metadata-routes.js');

assert.ok(html.includes('id="metadata-collect-missing-btn"'), 'metadata page needs one prominent bulk action in the content banner');
assert.ok(!html.includes('id="metadata-collect-all-btn"'), 'mobile header must not duplicate the bulk action');
assert.ok(html.includes('metadata-bulk-banner') && html.includes('서재 전체 메타데이터 관리') && html.includes('전체 수집 시작'));
assert.ok(page.includes('function activeBulkJob(') && page.includes('collectMissingMetadata({ providerIds:enabledProviders })'));
assert.ok(!page.includes('window.prompt') && !/Math\.min\(500(?:\D|$)/.test(page), 'dedicated page must not retain the 500 item prompt');
assert.ok(!modal.includes('1~500') && !/Math\.min\(500(?:\D|$)/.test(modal) && !modal.includes('{ limit,'), 'per-work modal must use the same unlimited bulk contract');
assert.ok(routes.includes('await metadataService.collectMissing') && !routes.includes('req.body && req.body.limit'));
assert.ok(service.includes('REQUEST_DELAY_MIN_MULTIPLIER = 1.5') && service.includes('REQUEST_DELAY_MAX_MULTIPLIER = 2'));
assert.ok(service.includes('const nextAllowedAtByProvider = new Map()') && service.includes('nextAllowedAtByProvider.set(key, completedAt + cooldownMs)') && service.includes('v669-metadata-provider-completion-cooldown-pass'), 'provider collection attempts need completion-based, per-provider randomized cooldown');
assert.ok(service.includes('for (const descriptor of enabledDescriptors) if (!ids.includes(descriptor.id)) ids.push(descriptor.id)'), 'requested providers must fall back to other enabled providers');
assert.ok(service.includes("settings.priority == null || settings.priority === ''"), 'unset provider priority must preserve registry order');
assert.ok(service.includes('async function writeBulkBatch') && service.includes('await new Promise(resolve => setImmediate(resolve))'), 'large bulk snapshots must yield to the event loop');
assert.ok(queue.includes('Math.min(200000') && !queue.includes('list.length > 500'));
assert.ok(metadataCss.includes('refined metadata workspace') && metadataCss.includes('.metadata-bulk-banner') && metadataCss.includes('.metadata-page-toast.error'));
assert.ok(appCss.includes('softer library surfaces and dark-amber first-paint continuity'));
assert.ok(themeBoot.includes('MutationObserver') && themeBoot.includes('LEGACY_PRESETS') && themeBoot.includes('v578-theme-first-paint-pass'));
assert.ok(appState.includes('BUILT_IN_THEME_COLOR_MIGRATIONS') && appState.includes('migrateBuiltInThemeColors'));
for (const file of ['index.html','library.html','login.html','metadata.html','mobile.html','site.html']) {
  const source = read(`public/${file}`);
  const bootAt = source.indexOf('/scripts/theme-boot.js');
  const styleAt = source.indexOf('rel="stylesheet"');
  assert.ok(bootAt > 0 && styleAt > bootAt, `${file} must execute theme boot before stylesheets`);
  assert.ok(!/<body[^>]*data-theme="light"/.test(source), `${file} must not hard-code a light body before theme boot`);
}
console.log('v578-metadata-theme-bulk-smoke-pass');
