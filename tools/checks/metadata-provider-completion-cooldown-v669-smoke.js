#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const {
  createProviderCompletionCooldownCoordinator,
  METADATA_PROVIDER_COMPLETION_COOLDOWN_PASS
} = require('../../server/services/metadata-service');

async function tick() {
  await new Promise(resolve => setImmediate(resolve));
}

async function run() {
  let virtualNow = 0;
  const events = [];
  const waits = [];
  let releaseFirstA;
  const firstABarrier = new Promise(resolve => { releaseFirstA = resolve; });
  const coordinator = createProviderCompletionCooldownCoordinator({
    now:() => virtualNow,
    delay:async ms => {
      waits.push({ at:virtualNow, ms });
      virtualNow += ms;
    },
    cooldownMsForProvider:() => 4500
  });

  const firstA = coordinator.run('provider-a', null, async () => {
    events.push({ type:'start', provider:'A', at:virtualNow });
    virtualNow += 100;
    await firstABarrier;
    virtualNow += 50;
    events.push({ type:'finish', provider:'A', at:virtualNow });
    return 'A1';
  });
  await tick();

  const secondA = coordinator.run('provider-a', null, async () => {
    events.push({ type:'start', provider:'A2', at:virtualNow });
    return 'A2';
  });
  const firstB = coordinator.run('provider-b', null, async () => {
    events.push({ type:'start', provider:'B', at:virtualNow });
    virtualNow += 20;
    events.push({ type:'finish', provider:'B', at:virtualNow });
    return 'B1';
  });
  await firstB;

  assert(events.some(item => item.provider === 'B'), 'provider B must start while provider A is still active');
  assert(!events.some(item => item.provider === 'A2'), 'second provider A collection must wait for first A completion');
  assert.equal(waits.length, 0, 'provider A must not impose a cooldown on the first provider B collection');

  releaseFirstA();
  assert.equal(await firstA, 'A1');
  assert.equal(await secondA, 'A2');

  const firstAFinish = events.find(item => item.type === 'finish' && item.provider === 'A');
  const secondAStart = events.find(item => item.type === 'start' && item.provider === 'A2');
  assert(firstAFinish && secondAStart, 'provider A completion/start events must be present');
  assert.equal(secondAStart.at - firstAFinish.at, 4500, 'same-provider cooldown must start at previous collection completion');
  assert.deepEqual(waits, [{ at:firstAFinish.at, ms:4500 }], 'only the second A collection should consume A cooldown');

  const aStatus = coordinator.status('provider-a');
  const bStatus = coordinator.status('provider-b');
  assert.equal(aStatus.pass, METADATA_PROVIDER_COMPLETION_COOLDOWN_PASS);
  assert.equal(bStatus.pass, METADATA_PROVIDER_COMPLETION_COOLDOWN_PASS);
  assert.notEqual(aStatus.nextAllowedAt, bStatus.nextAllowedAt, 'provider cooldown timestamps must remain independent');

  const source = fs.readFileSync('server/services/metadata-service.js', 'utf8');
  assert(source.includes('runProviderCollection(provider, context, () => collectProviderSearch(job, provider, context))'), 'search collection must be wrapped by the provider completion cooldown');
  assert(source.includes('return runProviderCollection(provider, context, async () => {'), 'direct collection must be wrapped by the provider completion cooldown');
  assert(!source.includes('await waitProvider(provider.id'), 'individual HTTP requests must not consume the provider collection cooldown');
  assert(source.includes('nextAllowedAtByProvider.set(key, completedAt + cooldownMs)'), 'next slot must be based on collection completion time');

  console.log(JSON.stringify({
    pass:METADATA_PROVIDER_COMPLETION_COOLDOWN_PASS,
    scope:'per-provider',
    startsAt:'collection-completion',
    crossProviderBlocking:false,
    waits
  }));
}

run().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
