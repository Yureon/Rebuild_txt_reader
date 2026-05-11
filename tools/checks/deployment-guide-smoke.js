#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
function read(path) { return fs.readFileSync(path, 'utf8'); }
const dockerfile = read('Dockerfile');
assert.ok(dockerfile.includes('/healthz'), 'Dockerfile healthcheck must use /healthz');
assert.ok(!dockerfile.includes('COPY --chown=node:node test_novels'), 'Dockerfile must not copy omitted test_novels');
assert.ok(dockerfile.includes('REQUIRE_STRICT_ORIGIN=1'), 'Dockerfile must default strict origin on');
assert.ok(dockerfile.includes('USER_PASSWORD_MIN_LENGTH=8'), 'Dockerfile must default user password minimum');
assert.ok(dockerfile.includes('ALLOW_CLOUDFLARE_INSIGHTS=0'), 'Dockerfile must default Cloudflare insights CSP opt-in off');
assert.ok(dockerfile.includes('ALLOW_BLOB_WORKER=0'), 'Dockerfile must default blob worker CSP opt-in off');
assert.ok(dockerfile.includes('LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS=2000'), 'Dockerfile must default library deep signature check TTL');
for (const path of ['docker-compose.yml', 'docker-compose.example.yml']) {
  const compose = read(path);
  assert.ok(compose.includes('/healthz'), `${path} must healthcheck /healthz`);
  assert.ok(compose.includes('REQUIRE_STRICT_ORIGIN'), `${path} must pass REQUIRE_STRICT_ORIGIN`);
  assert.ok(compose.includes('USER_PASSWORD_MIN_LENGTH'), `${path} must pass USER_PASSWORD_MIN_LENGTH`);
  assert.ok(compose.includes('ALLOW_CLOUDFLARE_INSIGHTS'), `${path} must pass ALLOW_CLOUDFLARE_INSIGHTS`);
  assert.ok(compose.includes('ALLOW_BLOB_WORKER'), `${path} must pass ALLOW_BLOB_WORKER`);
  assert.ok(compose.includes('DEPLOYMENT_MODE'), `${path} must pass DEPLOYMENT_MODE`);
  assert.ok(compose.includes('LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS'), `${path} must pass LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS`);
}
assert.ok(!read('docker-compose.yml').includes('./test_novels:/app/test_novels'), 'runtime compose must not mount omitted test_novels');
const env = read('.env.example');
for (const needle of ['APP_ORIGIN', 'URL=', 'DEPLOYMENT_MODE', 'REQUIRE_STRICT_ORIGIN', '/healthz', 'OWNER_PASSWORD_MIN_LENGTH', '허용 하한은 10', 'USER_PASSWORD_MIN_LENGTH', 'ALLOW_CLOUDFLARE_INSIGHTS', 'ALLOW_BLOB_WORKER', 'LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS']) assert.ok(env.includes(needle), `.env.example must mention ${needle}`);
for (const forbidden of ['v349 precompressed static', 'search remote pill compaction', '작업 설명']) assert.ok(!env.includes(forbidden), `.env.example must not contain changelog/task note: ${forbidden}`);
console.log(JSON.stringify({ pass: 'v351-deployment-guide-smoke-pass', docIndependent: true }));
