#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDiskCacheJanitorService } = require('../../server/services/disk-cache-janitor-service');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-janitor-lifecycle-'));
const cache = path.join(root, 'cache');
fs.mkdirSync(cache, { recursive:true });

const original = {
  setInterval:global.setInterval,
  clearInterval:global.clearInterval,
  setTimeout:global.setTimeout,
  clearTimeout:global.clearTimeout
};
const cleared = new Set();
let seq = 0;
function handle(kind) { return { kind, id:++seq, unref(){} }; }
global.setInterval = () => handle('interval');
global.setTimeout = () => handle('timeout');
global.clearInterval = value => { if (value) cleared.add(`${value.kind}:${value.id}`); };
global.clearTimeout = value => { if (value) cleared.add(`${value.kind}:${value.id}`); };

try {
  const service = createDiskCacheJanitorService({ dataDir:root, cacheDirs:[{ label:'cache', dir:cache }], intervalMs:60_000 });
  service.start();
  const active = service.getStatus();
  assert.equal(active.lastResult.timerActive, true, 'periodic timer must be active after start');
  assert.equal(active.lastResult.initialTimerActive, true, 'initial delayed timer must be active after start');
  service.stop();
  const stopped = service.getStatus();
  assert.equal(stopped.lastResult.timerActive, false, 'periodic timer must be inactive after stop');
  assert.equal(stopped.lastResult.initialTimerActive, false, 'initial delayed timer must be inactive after stop');
  assert.ok([...cleared].some(item => item.startsWith('interval:')), 'stop must clear periodic interval');
  assert.ok([...cleared].some(item => item.startsWith('timeout:')), 'stop must clear initial delayed timeout');
  console.log(JSON.stringify({ pass:'v589-disk-cache-janitor-lifecycle-pass', cleared:[...cleared].sort() }));
} finally {
  Object.assign(global, original);
  fs.rmSync(root, { recursive:true, force:true });
}
