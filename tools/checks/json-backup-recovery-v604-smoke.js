#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  loadJsonWithBackup,
  loadJsonWithBackupAsync,
  atomicWriteJsonSync,
  atomicWriteJsonAsync
} = require('../../server/repositories/json-file-store');

const PASS = 'v604-json-backup-recovery-smoke-pass';

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v604-json-recovery-'));
  const blockedCapabilities = [];
  try {
    const file = path.join(root, 'state.json');
    const backup = `${file}.bak`;
    fs.writeFileSync(file, '{broken', { mode:0o600 });
    fs.writeFileSync(backup, JSON.stringify({ revision:7 }), { mode:0o600 });

    assert.deepStrictEqual(loadJsonWithBackup(file, null), {
      ok:true, data:{ revision:7 }, source:'backup', path:backup
    });
    assert.deepStrictEqual(await loadJsonWithBackupAsync(file, null), {
      ok:true, data:{ revision:7 }, source:'backup', path:backup
    });

    atomicWriteJsonSync(file, { revision:8 });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { revision:8 });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(backup, 'utf8')), { revision:7 }, 'corrupt primary must not replace the last valid backup');
    if (process.platform === 'win32') {
      blockedCapabilities.push('posix-mode-bits');
    } else {
      assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
      assert.strictEqual(fs.statSync(backup).mode & 0o777, 0o600);
    }

    await atomicWriteJsonAsync(file, { revision:9 });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { revision:9 });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(backup, 'utf8')), { revision:8 });

    const external = path.join(root, 'external.json');
    const link = path.join(root, 'linked.json');
    fs.writeFileSync(external, JSON.stringify({ secret:'must-not-load' }));
    try {
      fs.symlinkSync(external, link);
      const linkedLoad = loadJsonWithBackup(link, { safe:true });
      assert.strictEqual(linkedLoad.ok, false, 'state loaders must not follow symbolic links');
      assert.deepStrictEqual(linkedLoad.data, { safe:true });
      atomicWriteJsonSync(link, { safe:'replacement' });
      assert.strictEqual(fs.lstatSync(link).isSymbolicLink(), false, 'atomic replacement must replace, not follow, a state-file symlink');
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(external, 'utf8')), { secret:'must-not-load' });
      assert.strictEqual(fs.existsSync(`${link}.bak`), false, 'external symlink target must never be copied into a local backup');
    } catch (error) {
      if (error && ['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) blockedCapabilities.push('symlink');
      else throw error;
    }

    assert.strictEqual(fs.readdirSync(root).filter(name => name.endsWith('.tmp')).length, 0);
    if (blockedCapabilities.length) {
      console.log(JSON.stringify({ partialPass:PASS, blockedCapabilities }));
      process.exitCode = 77;
    } else {
      console.log(JSON.stringify({ pass:PASS }));
    }
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
