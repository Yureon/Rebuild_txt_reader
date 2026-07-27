#!/usr/bin/env node
const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRebuildZip, writePackageManifestFile, DEFAULT_PACKAGE_EXCLUDES } = require('../package_rebuild');

const zipProbe = childProcess.spawnSync('zip', ['-v'], { encoding:'utf8' });
if (zipProbe.error?.code === 'ENOENT' || zipProbe.status == null) {
  console.log(JSON.stringify({
    partialPass:'v610-package-archive-fallback-preflight-pass',
    blockedCapabilities:['zip-create'],
    reason:zipProbe.error?.message || 'zip command unavailable'
  }));
  process.exit(77);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-package-fallback-'));
try {
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{}\n');
  fs.writeFileSync(path.join(root, 'probe.txt'), 'archive fallback probe\n');
  fs.mkdirSync(path.join(root, 'node_modules'));
  fs.writeFileSync(path.join(root, 'node_modules', 'excluded.txt'), 'excluded\n');
  const target = path.join(root, 'bundle.zip');
  const manifest = {
    version:0,
    fileName:'bundle.zip',
    manifestPath:'package-manifest-v0.json',
    excludes:DEFAULT_PACKAGE_EXCLUDES,
    changedFileGroups:{ groups:{ other:['probe.txt'] } },
    docs:[]
  };
  writePackageManifestFile(root, manifest);
  const inventory = JSON.parse(fs.readFileSync(path.join(root, manifest.manifestPath), 'utf8')).files;
  assert.deepStrictEqual(inventory.map(item => item.path).sort(), ['package-lock.json', 'probe.txt']);
  const result = createRebuildZip(root, target, manifest);
  assert.ok(result.integrity.ok);
  assert.strictEqual(result.entryAudit.missing, 0);
  assert.ok(fs.statSync(target).size > 0);
  console.log(JSON.stringify({ pass:'v610-package-archive-fallback-pass', bytes:result.bytes }));
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
