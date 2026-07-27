#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { createDiskCacheJanitorService, DISK_CACHE_IN_USE_PROTECTION_PASS } = require('../../server/services/disk-cache-janitor-service');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v570-janitor-'));
const dataDir = path.join(tmp, 'data');
const cacheDir = path.join(dataDir, 'normalized_content');
fs.mkdirSync(cacheDir, { recursive: true });
const protectedPath = path.join(cacheDir, 'protected.text');
const disposablePath = path.join(cacheDir, 'disposable.text');
fs.writeFileSync(protectedPath, 'protected');
fs.writeFileSync(disposablePath, 'delete');
const old = new Date(Date.now() - 120000);
fs.utimesSync(protectedPath, old, old);
fs.utimesSync(disposablePath, old, old);
const janitor = createDiskCacheJanitorService({
  dataDir,
  cacheDirs: [{ label: 'normalized_content', dir: cacheDir }],
  enabled: true,
  minFileAgeMs: 0,
  maxDeletePerRun: 10,
  isPathProtected: candidate => path.resolve(candidate) === path.resolve(protectedPath)
});
const result = janitor.pruneOnce(true);
assert.ok(fs.existsSync(protectedPath), 'in-use normalized cache file must not be deleted');
assert.ok(!fs.existsSync(disposablePath), 'unprotected cache file should be eligible for deletion');
assert.equal(result.inUseProtectionPass, DISK_CACHE_IN_USE_PROTECTION_PASS);
assert.ok(result.metrics.protectedFilesSkipped >= 1);

// Re-check immediately before unlink to close the candidate-collection TOCTOU window.
const racePath = path.join(cacheDir, 'race.text');
fs.writeFileSync(racePath, 'race');
fs.utimesSync(racePath, old, old);
let raceChecks = 0;
const raceJanitor = createDiskCacheJanitorService({
  dataDir,
  cacheDirs: [{ label:'normalized_content', dir:cacheDir }],
  enabled:true,
  minFileAgeMs:0,
  maxDeletePerRun:10,
  isPathProtected: candidate => path.resolve(candidate) === path.resolve(racePath) && ++raceChecks >= 2
});
raceJanitor.pruneOnce(true);
assert.ok(fs.existsSync(racePath), 'candidate becoming active before unlink must be preserved');
assert.ok(raceChecks >= 2, 'janitor must re-check protection at delete time');

console.log(JSON.stringify({ pass: 'v570-disk-cache-in-use-protection-smoke-pass' }));
