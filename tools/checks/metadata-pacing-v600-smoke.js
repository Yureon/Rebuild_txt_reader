#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
const { computeRandomRequestDelayMs, createMetadataService } = require('../../server/services/metadata-service');

assert.strictEqual(computeRandomRequestDelayMs(3000, 0), 4500);
assert.strictEqual(computeRandomRequestDelayMs(3000, 0.999999), 6000);

const envProbe = spawnSync(process.execPath, ['-e', "process.stdout.write(String(require('./server/config/env').METADATA_REQUEST_INTERVAL_MS))"], {
  cwd:path.resolve(__dirname, '../..'),
  env:{ ...process.env, METADATA_REQUEST_INTERVAL_MS:'1200' },
  encoding:'utf8'
});
assert.strictEqual(envProbe.status, 0, envProbe.stderr);
assert.strictEqual(envProbe.stdout, '3000', 'legacy 1200ms env value must clamp to 3000ms');

const temp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'metadata-pacing-v600-'));
const store = {
  getProviderSettings:()=>({ enabled:true, autoApply:true }),
  getPersistenceStatus:()=>({}),
  hasCoverAsset:()=>false,
  canAccessCover:()=>false,
  close:async()=>{}
};
const transport = {};
const coverService = {};
const service = createMetadataService({ store, transport, coverService, queuePath:path.join(temp,'queue.jsonl'), requestIntervalMs:1200 });
assert.deepStrictEqual(service.collectionCooldownRangeMs, [4500,6000], 'service-level low cooldown must clamp to 4.5–6 seconds');

const admin = fs.readFileSync('public/scripts/admin/metadata.mjs','utf8');
const serviceSource = fs.readFileSync('server/services/metadata-service.js','utf8');
assert(admin.includes('같은 공급자 수집 완료 후') && admin.includes('쿨타임 기준'), 'owner metadata UI must explain completion-based same-provider cooldown');
assert(serviceSource.includes('baseRequestIntervalMs:settings.requestIntervalMs'), 'provider descriptor must expose base pacing compatibility alias');
assert(serviceSource.includes('baseCollectionCooldownMs:settings.requestIntervalMs'), 'provider descriptor must expose completion cooldown semantics');
assert(serviceSource.includes('Math.max(3000, Math.min(60000'), 'metadata service must enforce minimum base interval');
fs.rmSync(temp, { recursive:true, force:true });
console.log(JSON.stringify({ pass:'v600-metadata-pacing-smoke-pass', baseMs:3000, rangeMs:service.collectionCooldownRangeMs, startsAt:'collection-completion' }));
