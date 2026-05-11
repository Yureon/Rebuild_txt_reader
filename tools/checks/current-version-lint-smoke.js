const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const version = 'rebuild-v564';
const allow = new Set(['docs/release-history.md']);
function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes:true })) {
    if (['node_modules', '.git'].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const stale = [];
for (const file of walk(root)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (allow.has(rel) || /\.(br|gz|zip|png|jpg|jpeg|webp|ico)$/.test(rel)) continue;
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch (_e) { continue; }
  if (/rebuild-v41[0-9]/.test(text)) stale.push(rel);
}
assert.deepStrictEqual(stale, [], 'stale rebuild marker found: ' + stale.join(', '));
assert.ok(fs.readFileSync(path.join(root, 'public/scripts/rebuild/core/utils.mjs'), 'utf8').includes(version), 'current utils marker missing');
console.log('v430-current-version-lint-smoke-pass');
