#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { computeRandomRequestDelayMs } = require('../../server/services/metadata-service');

const previous = process.env.METADATA_REQUEST_INTERVAL_MS;
delete process.env.METADATA_REQUEST_INTERVAL_MS;
delete require.cache[require.resolve('../../server/config/env')];
const env = require('../../server/config/env');
if (previous === undefined) delete process.env.METADATA_REQUEST_INTERVAL_MS;
else process.env.METADATA_REQUEST_INTERVAL_MS = previous;

assert.equal(env.METADATA_REQUEST_INTERVAL_MS, 3000, 'metadata provider completion cooldown base default must be 3000ms');
assert.equal(computeRandomRequestDelayMs(3000, 0), 4500);
assert.equal(computeRandomRequestDelayMs(3000, 0.5), 5250);
assert.equal(computeRandomRequestDelayMs(3000, 0.999999), 6000);

const service = read('server/services/metadata-service.js');
assert(service.includes('createProviderCompletionCooldownCoordinator'), 'per-provider completion cooldown coordinator missing');
assert(service.includes('const nextAllowedAtByProvider = new Map()'), 'per-provider completion timestamp map missing');
assert(service.includes('nextAllowedAtByProvider.set(key, completedAt + cooldownMs)'), 'same-provider cooldown must begin at collection completion');
assert(service.includes('runProviderCollection(provider, context, () => collectProviderSearch(job, provider, context))'), 'search attempts must use provider completion cooldown');
assert(!service.includes('await waitProvider(provider.id'), 'individual HTTP requests must not reserve the provider cooldown');
assert(service.includes('v627-metadata-abort-safe-pacing-pass'), 'abort-safe pacing marker missing');
assert(service.includes('v669-metadata-provider-completion-cooldown-pass'), 'completion cooldown marker missing');
for (const rel of ['docker-compose.yml','docker-compose.example.yml','docker-compose.cloudflare-tunnel.example.yml']) {
  assert(read(rel).includes('METADATA_REQUEST_INTERVAL_MS=${METADATA_REQUEST_INTERVAL_MS:-3000}'), `${rel} metadata default mismatch`);
}
assert(read('.env.example').includes('METADATA_REQUEST_INTERVAL_MS=3000'));
console.log(JSON.stringify({ pass:'v582-metadata-pacing-smoke-pass', baseMs:3000, delayRangeMs:[4500,6000], scope:'per-provider', startsAt:'collection-completion' }));
