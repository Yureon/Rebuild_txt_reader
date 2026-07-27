#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '../../public/scripts/rebuild');
const PASS = 'v588-initial-module-graph-budget-smoke-pass';
const MAX_INITIAL_SOURCE_BYTES = 762500; // v588 metadata permission UI adds < 0.3% while preserving lazy heavy features.
const importRe = /^\s*import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/gm;
function resolveImport(from, specifier) {
  if (!specifier.startsWith('.')) return null;
  let target = path.resolve(path.dirname(from), specifier);
  if (!path.extname(target)) target += '.mjs';
  return target;
}
function staticGraph(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    importRe.lastIndex = 0;
    let match;
    while ((match = importRe.exec(source))) {
      const target = resolveImport(file, match[1]);
      if (target) queue.push(target);
    }
  }
  return [...seen];
}
for (const entryName of ['library-page.mjs','site.mjs','mobile.mjs']) {
  const files = staticGraph(path.join(root, entryName));
  const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  assert.ok(files.length <= 115, `${entryName} initial static graph too large: ${files.length}`);
  assert.ok(bytes <= MAX_INITIAL_SOURCE_BYTES, `${entryName} initial source budget exceeded: ${bytes}`);
  for (const heavy of ['features/reader.mjs','features/search.mjs','features/bookmarks.mjs','features/theme-settings.mjs','features/sync-devtools.mjs']) {
    assert.ok(!files.some(file => path.relative(root, file).replace(/\\/g,'/') === heavy), `${entryName} unexpectedly includes ${heavy}`);
  }
  console.log(JSON.stringify({ pass:PASS, entry:entryName, modules:files.length, bytes }));
}
