#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { packageVersionToReleaseNumber } = require('../server/version-contract');

const ROOT = path.resolve(__dirname, '..');
const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const appVersion = String(pkg.version || '').trim();
const releaseNumber = packageVersionToReleaseNumber(appVersion);
const buildId = `rebuild-v${releaseNumber}`;
const releaseLabel = `v${releaseNumber}`;
const pass = `v${releaseNumber}-central-version-contract-pass`; // v682-central-version-contract-pass

function writeIfChanged(file, content) {
  const target = path.join(ROOT, file);
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current === content) return false;
  fs.mkdirSync(path.dirname(target), { recursive:true });
  fs.writeFileSync(target, content);
  return true;
}

function replaceRequired(file, pattern, replacement) {
  const target = path.join(ROOT, file);
  const current = fs.readFileSync(target, 'utf8');
  if (!pattern.test(current)) throw new Error(`${file}: version contract pattern not found`);
  const next = current.replace(pattern, replacement);
  if (next !== current) fs.writeFileSync(target, next);
  return next !== current;
}

const changed = [];
if (writeIfChanged('public/scripts/rebuild/version.mjs', [
  `export const APP_VERSION = '${appVersion}';`,
  `export const CURRENT_BUILD_ID = '${buildId}';`,
  `export const CURRENT_VERSION_NUMBER = ${releaseNumber};`,
  `export const VERSION_CONTRACT_PASS = '${pass}';`,
  ''
].join('\n'))) changed.push('public/scripts/rebuild/version.mjs');

if (writeIfChanged('public/version.json', `${JSON.stringify({ appVersion, releaseNumber, buildId, releaseLabel, pass }, null, 2)}\n`)) changed.push('public/version.json');

if (replaceRequired('public/sw.js', /const BUILD = 'rebuild-v\d+';/, `const BUILD = '${buildId}';`)) changed.push('public/sw.js');
for (const icon of ['icon-192.png', 'icon-512.png']) {
  const target = path.join(ROOT, 'public/sw.js');
  const current = fs.readFileSync(target, 'utf8');
  const escapedIcon = icon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`/icon/${escapedIcon}\\?v=rebuild-v\\d+`, 'g');
  const next = current.replace(pattern, `/icon/${icon}?v=${buildId}`);
  if (next !== current) { fs.writeFileSync(target, next); if (!changed.includes('public/sw.js')) changed.push('public/sw.js'); }
}
if (replaceRequired('public/scripts/service-worker-register.js', /var WORKER_URL = '\/sw-rebuild-v\d+\.js';/, `var WORKER_URL = '/sw-${buildId}.js';`)) changed.push('public/scripts/service-worker-register.js');
if (replaceRequired('public/scripts/service-worker-register.js', /var BUILD = 'rebuild-v\d+';/, `var BUILD = '${buildId}';`)) changed.push('public/scripts/service-worker-register.js');

for (const file of [
  'public/scripts/rebuild/core/app-shell.mjs',
  'public/scripts/rebuild/core/feature-fragments.mjs',
  'public/scripts/rebuild/core/performance-metrics.mjs',
  'public/scripts/rebuild/core/utils.mjs',
  'public/scripts/rebuild/features/devtools/report.mjs',
  'public/scripts/rebuild/features/owner-style-loader.mjs',
  'public/scripts/rebuild/features/recovery/dom-smoke-markers.mjs',
  'public/scripts/rebuild/features/search/matcher.mjs',
  'public/scripts/rebuild/features/sync-devtools.mjs',
  'public/scripts/rebuild/library-page.mjs',
  'public/scripts/rebuild/metadata-page.mjs',
  'public/scripts/rebuild/mobile.mjs',
  'public/scripts/rebuild/site.mjs',
  'public/scripts/rebuild/state/app-state.mjs'
]) {
  const target = path.join(ROOT, file);
  const current = fs.readFileSync(target, 'utf8');
  const next = current.replace(/rebuild-v\d+/g, buildId);
  if (next !== current) { fs.writeFileSync(target, next); changed.push(file); }
}
if (replaceRequired('tools/checks/current-rebuild-version.js', /const CURRENT_REBUILD_VERSION_NUMBER = \d+;/, `const CURRENT_REBUILD_VERSION_NUMBER = ${releaseNumber};`)) changed.push('tools/checks/current-rebuild-version.js');
{
  const rel = 'tools/checks/current-version-lint-smoke.js';
  const target = path.join(ROOT, rel);
  const current = fs.readFileSync(target, 'utf8');
  const pattern = /const version = 'rebuild-v\d+';/;
  if (pattern.test(current)) {
    const next = current.replace(pattern, `const version = '${buildId}';`);
    if (next !== current) { fs.writeFileSync(target, next); changed.push(rel); }
  }
}

const extensionManifestPath = path.join(ROOT, 'extensions/metadata-login-helper/manifest.json');
if (fs.existsSync(extensionManifestPath)) {
  const extensionManifest = JSON.parse(fs.readFileSync(extensionManifestPath, 'utf8'));
  extensionManifest.version = appVersion;
  fs.writeFileSync(extensionManifestPath, JSON.stringify(extensionManifest, null, 2) + '\n');
  changed.push('extensions/metadata-login-helper/manifest.json');
}

for (const file of ['public/index.html','public/library.html','public/login.html','public/metadata.html','public/mobile.html','public/site.html','public/offline.html','public/admin/users.html','public/manifest.json']) {
  const target = path.join(ROOT, file);
  let text = fs.readFileSync(target, 'utf8');
  const next = text.replace(/rebuild-v\d+/g, buildId)
    .replace(/data-current-build="v\d+"/g, `data-current-build="${releaseLabel}"`)
    .replace(/>OWNER CONSOLE · v\d+</g, `>OWNER CONSOLE · ${releaseLabel}<`)
    .replace(/<span class="metadata-build-badge"([^>]*)>v\d+<\/span>/g, `<span class="metadata-build-badge"$1>${releaseLabel}</span>`);
  if (next !== text) { fs.writeFileSync(target, next); changed.push(file); }
}

console.log(JSON.stringify({ ok:true, appVersion, releaseNumber, buildId, changed, pass }, null, 2));
