#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
const css = [
  fs.readFileSync(path.join(root, 'public/styles/app.css'), 'utf8'),
  fs.readFileSync(path.join(root, 'public/styles/owner.css'), 'utf8')
].join('\n');
const shell = fs.readFileSync(path.join(root, 'public/fragments/app-shell.html'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');
const release = fs.readFileSync(path.join(root, 'docs/release-history.md'), 'utf8');
const PASS = 'v382-mobile-modal-layout-smoke-pass';
for (const marker of [
  'body[data-client-profile="mobile"] #devdbg-modal.open',
  'height:var(--app-vh,100dvh)',
  'body[data-client-profile="mobile"] #devdbg-modal[data-devdbg-quality-pass] .devdbg-grid',
  'body[data-client-profile="mobile"] #devdbg-modal[data-devdbg-quality-pass] .devdbg-output',
  '-webkit-overflow-scrolling:touch',
  'body[data-client-profile="mobile"] #read-data-overlay.open',
  'body[data-client-profile="mobile"] #read-data-modal[data-modal-a11y-pass]',
  'body[data-client-profile="mobile"] #read-data-modal[data-modal-a11y-pass] .rdm-body',
  'body[data-client-profile="mobile"] #read-data-modal[data-modal-a11y-pass] .rdm-footer',
  'body[data-client-profile="mobile"] #read-data-modal[data-modal-a11y-pass] .rdm-folder-summary',
  'grid-template-columns:repeat(2,minmax(0,1fr))'
]) assert.ok(css.includes(marker), `mobile modal CSS guard missing: ${marker}`);
assert.ok(shell.includes('id="devdbg-output"'), 'developer debug output element must exist');
assert.ok(shell.includes('id="rdm-body"'), 'read-data body element must exist');
assert.ok(shell.includes('id="rdm-tabs"'), 'read-data tabs element must exist');
assert.ok(runner.includes('tools/checks/mobile-modal-layout-smoke.js'), 'smoke runner must include mobile modal layout smoke');
assert.ok(release.includes(PASS), 'release history must mention v382 mobile modal layout smoke pass');
console.log(JSON.stringify({ pass: PASS }));
