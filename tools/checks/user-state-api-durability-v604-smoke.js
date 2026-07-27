#!/usr/bin/env node
const assert = require('assert');
const normalizer = require('../../server/services/state-normalizer');
const { createStateWriteService } = require('../../server/services/state-write-service');

const PASS = 'v604-user-state-api-durability-smoke-pass';

(async () => {
  let state = normalizer.createEmptyUserState();
  let flushes = 0;
  const service = createStateWriteService({
    syncStateService:{
      get:() => state,
      set:value => (state = value),
      saveSoon:() => true,
      async flushAndWait() { flushes += 1; return true; }
    },
    normalizer
  });
  const shared = await service.saveSharedStateAsync({ favorites:['n1'], syncVersion:0, updatedAt:Date.now() });
  assert.strictEqual(shared.persisted, true);
  assert.strictEqual(flushes, 1);
  assert.deepStrictEqual(state.shared.favorites, ['n1']);

  let failedState = normalizer.createEmptyUserState();
  const failure = createStateWriteService({
    syncStateService:{
      get:() => failedState,
      set:value => (failedState = value),
      saveSoon:() => true,
      async flushAndWait() { throw Object.assign(new Error('disk unavailable'), { code:'EIO' }); }
    },
    normalizer
  });
  await assert.rejects(
    () => failure.saveSharedStateAsync({ favorites:['n2'], syncVersion:0, updatedAt:Date.now() }),
    error => error && error.statusCode === 503 && error.code === 'STATE_PERSISTENCE_FAILED'
  );
  assert.deepStrictEqual(failedState.shared.favorites, [], 'failed persistence must roll memory state back');

  const routeSource = require('fs').readFileSync('server/routes/state-routes.js', 'utf8');
  for (const method of ['saveSharedStateAsync', 'saveProgressStateAsync', 'saveProgressDeltaAsync', 'saveDeviceStateAsync']) {
    assert(routeSource.includes(method), `state route must prefer ${method}`);
  }
  console.log(JSON.stringify({ pass:PASS, flushes }));
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
