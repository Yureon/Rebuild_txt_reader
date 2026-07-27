#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  normalizeArchiveEntryName,
  validateArchiveEntryNames,
  inspectArchiveBeforeExtract
} = require('../archive-safety');

assert.strictEqual(normalizeArchiveEntryName('./public/app.js'), 'public/app.js');
assert.throws(() => normalizeArchiveEntryName('../escape.txt'), /traversal/);
assert.throws(() => normalizeArchiveEntryName('/absolute.txt'), /absolute/);
assert.throws(() => normalizeArchiveEntryName('C:/absolute.txt'), /absolute/);
assert.throws(() => normalizeArchiveEntryName('public\\app.js'), /unsafe/);
assert.throws(() => validateArchiveEntryNames(['./a.txt', 'a.txt']), /duplicate/);
assert.throws(() => validateArchiveEntryNames(['Case.txt', 'case.txt']), /collision/);
assert.throws(() => validateArchiveEntryNames(['folder/', 'folder']), /collision/);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-archive-safety-'));
try {
  fs.writeFileSync(path.join(root, 'probe.txt'), 'ok');
  const archive = path.join(root, 'probe.zip');
  const packed = spawnSync('zip', ['-q', archive, 'probe.txt'], { cwd:root, encoding:'utf8' });
  if (packed.error || packed.status !== 0) {
    console.log(JSON.stringify({ partialPass:'v611-archive-preextract-safety-pass', blockedCapabilities:['zip-create'] }));
    process.exit(77);
  }
  const result = inspectArchiveBeforeExtract(archive);
  assert.strictEqual(result.format, 'zip');
  assert.ok(result.entries.includes('probe.txt'));
  console.log(JSON.stringify({ pass:'v611-archive-preextract-safety-pass', entries:result.rawEntryCount }));
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
