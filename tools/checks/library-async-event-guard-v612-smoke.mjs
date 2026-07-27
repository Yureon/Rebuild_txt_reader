#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createLibrarySafeEventRegistrar } from '../../public/scripts/rebuild/features/library-install-orchestrator.mjs';

const app = { state:{} };
const target = new EventTarget();
const disposers = [];
const on = createLibrarySafeEventRegistrar(app, disposers);
let calls = 0;
on(target, 'probe', async () => {
  calls += 1;
  throw new Error('async probe failed');
});
target.dispatchEvent(new Event('probe'));
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(calls,1);
assert.equal(app.state.libraryAsyncErrors.length,1);
assert.match(app.state.libraryAsyncErrors[0].message,/async probe failed/);
disposers.splice(0).forEach(dispose => dispose());
target.dispatchEvent(new Event('probe'));
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(calls,1,'disposed safe handler must not run');
console.log(JSON.stringify({pass:'v612-library-async-event-guard-smoke-pass'}));
