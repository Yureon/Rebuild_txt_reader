const fs = require('fs');
const path = require('path');
const assert = require('assert');

const IMPORT_RE = /^\s*import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/gm;

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
    if (seen.has(file)) continue;
    assert.ok(fs.existsSync(file), `static import target missing: ${file}`);
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    IMPORT_RE.lastIndex = 0;
    let match;
    while ((match = IMPORT_RE.exec(source))) {
      const target = resolveImport(file, match[1]);
      if (target) queue.push(target);
    }
  }
  return [...seen];
}

function createLibraryArchitecture(projectRoot = process.cwd()) {
  const rebuildRoot = path.join(projectRoot, 'public/scripts/rebuild');
  const entry = path.join(rebuildRoot, 'features/library.mjs');
  const files = staticGraph(entry);
  const rel = file => path.relative(rebuildRoot, file).replace(/\\/g, '/');
  const names = new Set(files.map(rel));
  const sources = new Map(files.map(file => [rel(file), fs.readFileSync(file, 'utf8')]));
  return {
    files,
    names,
    sources,
    assertReachable(...required) {
      for (const name of required.flat()) assert.ok(names.has(name), `library graph missing ${name}`);
    },
    assertSourceContains(name, ...markers) {
      const source = sources.get(name);
      assert.equal(typeof source, 'string', `library graph source missing ${name}`);
      for (const marker of markers.flat()) assert.ok(source.includes(marker), `${name} missing ${marker}`);
    }
  };
}

module.exports = { createLibraryArchitecture, staticGraph };
