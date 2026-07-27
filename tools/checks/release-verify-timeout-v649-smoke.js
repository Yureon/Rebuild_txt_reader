#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v649-timeout-'));
try {
  const parent = path.join(temp, 'parent.js');
  fs.writeFileSync(parent, `const {spawn}=require('child_process'); const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); require('fs').writeFileSync(${JSON.stringify(path.join(temp,'child.pid'))},String(c.pid)); setInterval(()=>{},1000);`);
  const started = Date.now();
  const result = spawnSync(process.execPath, ['tools/process-tree-runner.js', '--timeout-ms=350', '--', process.execPath, parent], {
    cwd:root, encoding:'utf8', timeout:5000
  });
  const elapsedMs = Date.now() - started;
  assert.equal(result.status, 124, `expected timeout status 124, got ${result.status}: ${result.stderr}`);
  assert(elapsedMs < 4000, `timeout runner exceeded bound: ${elapsedMs}ms`);
  const childPid = Number(fs.readFileSync(path.join(temp,'child.pid'),'utf8'));
  if (process.platform !== 'win32') {
    const deadline = Date.now() + 1800;
    let alive = true;
    while (Date.now() < deadline) {
      try {
        process.kill(childPid, 0);
        const statPath = `/proc/${childPid}/stat`;
        if (fs.existsSync(statPath) && fs.readFileSync(statPath,'utf8').split(' ')[2] === 'Z') { alive = false; break; }
      } catch { alive = false; break; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
    assert.equal(alive, false, 'grandchild process survived timeout');
  }
  const verifier = fs.readFileSync(path.join(root, 'tools/release_verify.js'), 'utf8');
  assert(verifier.includes('process-tree-runner.js'));
  assert(verifier.includes('cleanupTemp'));
  assert(verifier.includes('v649-release-verify-process-tree-timeout-pass'));
  console.log(JSON.stringify({ pass:'v649-release-verify-timeout-smoke-pass', elapsedMs, processTreeTerminated:true }));
} finally {
  fs.rmSync(temp, { recursive:true, force:true });
}
