'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { CURRENT_REBUILD_VERSION } = require('./current-rebuild-version.js');

const root = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const htmlFiles = [
  'public/index.html',
  'public/library.html',
  'public/login.html',
  'public/site.html',
  'public/offline.html',
  'public/mobile.html',
  'public/metadata.html'
];
const iconRefPattern = /\/icon\/[A-Za-z0-9_.-]+\.(?:png|ico)(?:\?[^"'\s<)]*)?/g;
const expectedSuffix = `?v=${CURRENT_REBUILD_VERSION}`;

for (const rel of htmlFiles) {
  const refs = read(rel).match(iconRefPattern) || [];
  assert.ok(refs.length > 0, `${rel} must contain at least one icon reference`);
  for (const ref of refs) assert.ok(ref.endsWith(expectedSuffix), `${rel} has unversioned immutable icon reference: ${ref}`);
}

const manifest = JSON.parse(read('public/manifest.json'));
const manifestRefs = [
  ...(manifest.icons || []).map(item => item && item.src),
  ...(manifest.shortcuts || []).flatMap(item => (item && item.icons) || []).map(item => item && item.src)
].filter(Boolean);
assert.ok(manifestRefs.length >= 6, 'manifest icon coverage unexpectedly small');
for (const ref of manifestRefs) assert.ok(ref.endsWith(expectedSuffix), `manifest has unversioned immutable icon reference: ${ref}`);

const sw = read('public/sw.js');
for (const ref of sw.match(iconRefPattern) || []) {
  assert.ok(ref.endsWith(expectedSuffix), `service worker has unversioned immutable icon reference: ${ref}`);
}

const cachePolicy = read('server/middleware/cache-policy.js');
assert.ok(cachePolicy.includes("normalizedPath.includes('/public/icon/')"), 'immutable icon cache policy is missing');
console.log(JSON.stringify({ pass:'v604-immutable-icon-versioning-pass', iconRefs:manifestRefs.length }));
