#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseEnvText, parseArgs, NODE_LAUNCHER_PASS } = require('../../server/node-launcher');

const root = path.resolve(__dirname, '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

assert.equal(NODE_LAUNCHER_PASS, 'v665-node-direct-launcher-pass');
assert.deepStrictEqual(parseEnvText('A=1\nexport B="two words"\nC=value # note\n'), { A:'1', B:'two words', C:'value' });
assert.deepStrictEqual(parseEnvText('\uFEFFexport PORT=4111\nTXT_READER_DATA_DIR="data folder" # comment\nHASH=value#kept\n'), { PORT:'4111', TXT_READER_DATA_DIR:'data folder', HASH:'value#kept' });
assert.equal(parseArgs(['--port','3456','--library=./novels']).overrides.PORT, '3456');
assert.equal(pkg.main, 'server.js');
assert.equal(pkg.bin['txt-reader'], 'server.js');
assert.equal(pkg.scripts.start, 'node server.js');
assert.equal(pkg.scripts['start:check'], 'node server.js --check-config');
assert.equal(lock.packages[''].bin['txt-reader'], 'server.js');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v665-node-launch-'));
try {
  const envFile = path.join(temp, '.env');
  fs.writeFileSync(envFile, 'PORT=4567\nHOST=127.0.0.1\nLIBRARY_PATH=./library\nTXT_READER_DATA_DIR=./data\n');
  const result = spawnSync(process.execPath, [path.join(root, 'server.js'), '--env-file', envFile, '--check-config'], {
    cwd:os.tmpdir(), encoding:'utf8', timeout:10000
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const config = JSON.parse(result.stdout);
  assert.equal(config.pass, NODE_LAUNCHER_PASS);
  assert.equal(config.port, '4567');
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.libraryPath, path.join(temp, 'library'));
  assert.equal(config.dataDir, path.join(temp, 'data'));

  const help = spawnSync(process.execPath, [path.join(root, 'server.js'), '--help'], { cwd:os.tmpdir(), encoding:'utf8', timeout:10000 });
  assert.equal(help.status, 0);
  assert(help.stdout.includes('node . [options]'));

  const invalid = spawnSync(process.execPath, [path.join(root, 'server.js'), '--no-env', '--check-config', '--port', '70000'], { cwd:os.tmpdir(), encoding:'utf8', timeout:10000 });
  assert.notEqual(invalid.status, 0);

  console.log(JSON.stringify({ pass:'v665-node-direct-launch-pass', cwdIndependent:true, envFile:true, checkConfig:true }));
} finally {
  fs.rmSync(temp, { recursive:true, force:true });
}
