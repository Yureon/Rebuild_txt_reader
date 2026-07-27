#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'public/scripts/rebuild/core/feature-fragments.mjs'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles/deferred-ui.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/fragments/deferred-ui.html'), 'utf8');

assert(source.includes("DEFERRED_UI_STYLE_PASS = 'v645-deferred-ui-style-recovery-pass'"), 'deferred style recovery marker missing');
assert(/if \(hasCompleteDeferredUi\(\)\) \{\s*await ensureDeferredStyle\(\);/.test(source), 'existing deferred HTML must still verify/reload its stylesheet');
assert(source.includes('dataset.deferredUiStyleRecoveryPass'), 'deferred style recovery diagnostic marker missing');
assert(source.includes('link.dataset.deferredUiStyleLoaded'), 'stylesheet load completion marker missing');
assert(html.includes('id="nsearch-panel"') && html.includes('class="legacy-modal-panel nsearch-modal-panel"'), 'search modal panel contract missing');
assert(css.includes('#nsearch-panel.open{display:flex !important}') && css.includes('#nsearch-overlay.open{display:block !important}'), 'search modal open-state CSS missing');
assert(css.includes('.nsearch-head{') && css.includes('.nsearch-toolbar{') && css.includes('.nsearch-results-scroll{'), 'search modal structural CSS missing');
console.log(JSON.stringify({ pass:'v645-deferred-ui-style-recovery-pass' }));
