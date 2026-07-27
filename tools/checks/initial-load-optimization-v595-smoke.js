#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../../public/scripts/rebuild');
const PASS = 'v595-initial-load-optimization-smoke-pass';
const MAX_MODULES = 105;
const TARGET_SOURCE_BYTES = 540000;
const WARN_SOURCE_BYTES = 560000;
const MAX_SOURCE_BYTES = 580000;
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
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }

const runtime = fs.readFileSync(path.join(root, 'features/settings/site-language-runtime.mjs'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'features/settings/site-language.mjs'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'core/user-scope-bootstrap.mjs'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.mjs'), 'utf8');
assert(runtime.includes("import('./site-language-en.mjs')"), 'English map must be loaded dynamically');
assert(editor.includes("from './site-language-runtime.mjs'"), 'language editor must share the runtime module');
assert(editor.includes("import('./site-language-en.mjs')"), 'language template map must remain lazy');
assert(!editor.includes('const EN = {'), 'language editor must not duplicate the English dictionary');
assert(bootstrap.includes("import('../features/reader/cache-store.mjs')"), 'reader cache maintenance must be lazy');
assert(!/^\s*import\s+[^\n]+reader\/cache-store\.mjs/m.test(bootstrap), 'reader cache maintenance must not be statically imported');
assert(main.includes("import('./features/library.mjs')") && main.includes("import('./features/lazy-features.mjs')"), 'heavy boot features must be staged dynamically');

const results = [];
for (const entryName of ['library-page.mjs', 'site.mjs', 'mobile.mjs']) {
  const files = staticGraph(path.join(root, entryName));
  const names = files.map(rel);
  const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  assert(files.length <= MAX_MODULES, `${entryName} initial module count exceeded: ${files.length}`);
  assert(bytes <= MAX_SOURCE_BYTES, `${entryName} initial source bytes exceeded: ${bytes}`);
  for (const deferred of [
    'features/settings/site-language.mjs',
    'features/settings/site-language-en.mjs',
    'features/reader/cache-store.mjs',
    'features/theme-settings.mjs'
  ]) assert(!names.includes(deferred), `${entryName} unexpectedly includes ${deferred}`);
  assert(names.includes('features/settings/site-language-runtime.mjs'), `${entryName} missing shared language runtime`);
  results.push({ entry: entryName, modules: files.length, bytes, target:TARGET_SOURCE_BYTES, warning:bytes > WARN_SOURCE_BYTES });
}
console.log(JSON.stringify({ pass: PASS, results }));
