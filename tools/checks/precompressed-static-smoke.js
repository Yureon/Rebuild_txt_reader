const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v349-precompressed-static-smoke-pass';

function runPrecompressedStaticSmoke(root = path.join(__dirname, '..', '..')) {
  const middlewarePath = path.join(root, 'server/middleware/precompressed-static.js');
  assert.ok(fs.existsSync(middlewarePath), 'precompressed middleware exists');
  const source = fs.readFileSync(middlewarePath, 'utf8');
  for (const token of ['createPrecompressedStaticMiddleware', 'Content-Encoding', 'Accept-Encoding', 'if-none-match', 'if-modified-since', 'X-Precompressed-Static']) {
    assert.ok(source.includes(token), `middleware token: ${token}`);
  }
  const app = fs.readFileSync(path.join(root, 'server/app.js'), 'utf8');
  assert.ok(app.includes('createPrecompressedStaticMiddleware(paths.PUBLIC_DIR)'), 'middleware wired before static');
  assert.ok(app.indexOf('createPrecompressedStaticMiddleware(paths.PUBLIC_DIR)') < app.indexOf('express.static(paths.PUBLIC_DIR'), 'precompressed before express.static');

  const rebuildDir = path.join(root, 'public/scripts/rebuild');
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && full.endsWith('.mjs')) files.push(full);
    }
  }
  walk(rebuildDir);
  assert.strictEqual(files.length, 240, 'expected rebuild .mjs count');
  for (const file of files) {
    assert.ok(fs.existsSync(file + '.br'), `missing br sidecar: ${path.relative(root, file)}`);
    assert.ok(fs.existsSync(file + '.gz'), `missing gz sidecar: ${path.relative(root, file)}`);
  }
  assert.strictEqual(files.filter(file => fs.existsSync(file + '.br')).length, 240, 'br sidecar count');
  assert.strictEqual(files.filter(file => fs.existsSync(file + '.gz')).length, 240, 'gz sidecar count');

  for (const rel of ['public/styles/app.css', 'public/styles/owner.css', 'public/fragments/app-shell.html']) {
    assert.ok(fs.existsSync(path.join(root, rel + '.br')), `missing ${rel}.br`);
    assert.ok(fs.existsSync(path.join(root, rel + '.gz')), `missing ${rel}.gz`);
  }
  return { pass: PASS, mjs: files.length };
}

if (require.main === module) {
  console.log(JSON.stringify(runPrecompressedStaticSmoke(path.join(__dirname, '..', '..'))));
}

module.exports = { runPrecompressedStaticSmoke };
