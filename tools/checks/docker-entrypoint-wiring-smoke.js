#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
const entrypoint = fs.readFileSync(path.join(root, 'docker-entrypoint.sh'), 'utf8');
assert.ok(dockerfile.includes('COPY --chown=node:node docker-entrypoint.sh /app/docker-entrypoint.sh'));
assert.ok(dockerfile.includes('RUN chmod 0755 /app/docker-entrypoint.sh'));
assert.ok(dockerfile.includes('USER 1000:0'));
assert.ok(dockerfile.includes('ENTRYPOINT ["/app/docker-entrypoint.sh"]'));
assert.ok(entrypoint.includes('write_check_directory'));
for (const rel of ['docker-compose.yml','docker-compose.example.yml','docker-compose.cloudflare-tunnel.example.yml','.env.example']) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  assert.ok(!/APP_(?:UID|GID|RUNTIME_GID)\s*=/.test(source), rel + ' must not advertise unsupported runtime identity changes');
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-entrypoint-'));
try {
  fs.mkdirSync(path.join(tmp, 'user-data'));
  const result = spawnSync('sh', [path.join(root, 'docker-entrypoint.sh'), process.execPath, '-e', "process.stdout.write('entrypoint-ok')"], {
    env:{ ...process.env, DATA_DIR:tmp }, encoding:'utf8'
  });
  if (result.error && result.error.code === 'ENOENT') {
    console.log(JSON.stringify({ partialPass:'v573-docker-entrypoint-wiring-smoke-pass', blockedCapabilities:['sh'] }));
    process.exitCode = 77;
  } else {
    assert.equal(result.status, 0, result.stderr || result.error);
    assert.equal(result.stdout, 'entrypoint-ok');
  }
} finally { fs.rmSync(tmp, { recursive:true, force:true }); }
if (process.exitCode !== 77) console.log(JSON.stringify({ pass:'v573-docker-entrypoint-wiring-smoke-pass' }));
