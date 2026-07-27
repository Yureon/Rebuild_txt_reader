const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const PASS = 'v434-modulepreload-entrypoints-pass';
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
const required = [
  '/scripts/rebuild/core/app-shell.mjs',
  '/scripts/rebuild/main.mjs',
  '/scripts/rebuild/core/api.mjs',
  '/scripts/rebuild/core/utils.mjs',
  '/scripts/rebuild/state/app-state.mjs',
  '/scripts/rebuild/features/ui.mjs',
  '/scripts/rebuild/core/user-scope-bootstrap.mjs',
  '/scripts/rebuild/features/lazy-features.mjs',
  '/scripts/rebuild/features/library.mjs',
];
for (const rel of ['public/library.html', 'public/site.html', 'public/mobile.html']) {
  const html = read(rel);
  for (const href of required) {
    assert.ok(html.includes(`<link rel="modulepreload" href="${href}">`), `${rel} missing modulepreload ${href}`);
    assert.ok(!html.includes(`<link rel="modulepreload" href="${href}?v=`), `${rel} modulepreload must match queryless ESM import URL for ${href}`);
  }
}
for (const rel of ['public/library.html', 'public/site.html', 'public/mobile.html']) {
  const html = read(rel);
  for (const href of ['/scripts/rebuild/features/settings/appearance.mjs']) {
    assert.ok(!html.includes(`<link rel="modulepreload" href="${href}">`), `${rel} must defer ${href}`);
  }
}
console.log(JSON.stringify({ pass: PASS, preloads: required.length }));
