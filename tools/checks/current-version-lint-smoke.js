const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const current = require('./current-rebuild-version');
const releaseNumber = current.CURRENT_REBUILD_VERSION_NUMBER;
const version = current.CURRENT_REBUILD_VERSION;
const allow = new Set(['docs/release-history.md']);
const currentFacing = new Set([
  'README.md',
  'docs/README.md',
  'docs/api-contract.md',
  'docs/deployment-guide.md',
  'docs/handoff.md',
  'docs/next-session-handoff-prompt.md',
  'docs/operations-checklist.md',
  'docs/performance-cache.md',
  'docs/production-diagnostics.md',
  'docs/project-status-roadmap.md',
  'docs/pwa-offline.md',
  'docs/release-notes.md',
  'docs/security.md',
  'docs/storage-architecture.md',
  'docs/user-data-isolation.md',
  'docs/web-metadata.md'
]);
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
const staleCurrentHeaders = [];
for (const file of walk(root)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (allow.has(rel) || /\.(br|gz|zip|png|jpg|jpeg|webp|ico)$/.test(rel)) continue;
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch (_e) { continue; }
  if (/rebuild-v41[0-9]/.test(text)) stale.push(rel);
  if (currentFacing.has(rel)) {
    const headerLines = text.split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('<!--'));
    const header = headerLines.slice(0, 4).join('\n');
    const firstLine = headerLines[0] || '';
    const currentHeaderPattern = new RegExp(`(?:\\bv${releaseNumber}\\b|rebuild-v${releaseNumber}|${String(releaseNumber).split('').join('\\.').replace(/^/, '6\\.')})`);
    const staleHeaderPattern = new RegExp(`(?:\\bv(?!${releaseNumber}\\b)\\d{3}\\b|rebuild-v(?!${releaseNumber}\\b)\\d{3})`);
    if (!currentHeaderPattern.test(header) || staleHeaderPattern.test(firstLine)) {
      staleCurrentHeaders.push(rel);
    }
  }
}
assert.deepStrictEqual(stale, [], 'stale rebuild marker found: ' + stale.join(', '));
assert.deepStrictEqual(staleCurrentHeaders, [], 'stale current document header found: ' + staleCurrentHeaders.join(', '));
assert.ok(fs.readFileSync(path.join(root, 'public/scripts/rebuild/core/utils.mjs'), 'utf8').includes(version), 'current utils marker missing');
for (const rel of ['README.md','docs/README.md','docs/deployment-guide.md','docs/project-status-roadmap.md']) {
  assert.ok(fs.readFileSync(path.join(root, rel), 'utf8').includes(version), `current build marker missing in ${rel}`);
}
console.log('v430-current-version-lint-smoke-pass');
