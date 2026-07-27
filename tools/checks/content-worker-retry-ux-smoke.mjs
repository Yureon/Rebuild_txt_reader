#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiClient } from '../../public/scripts/rebuild/core/api.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const PASS = 'v569-content-worker-retry-ux-smoke-pass';
const originalFetch = globalThis.fetch;
globalThis.window = { location:{ origin:'http://localhost' } };
globalThis.location = { href:'', pathname:'/' };
globalThis.fetch = async () => new Response(JSON.stringify({ error:'content_worker_busy', message:'busy' }), { status:503, headers:{ 'content-type':'application/json', 'retry-after':'3' } });
try {
  const api = new ApiClient({ deviceId:'smoke-device' });
  await assert.rejects(() => api.get('/api/novels/a/content'), error => error.code === 'content_worker_busy' && error.retryAfterSeconds === 3 && error.message === 'busy');
} finally {
  globalThis.fetch = originalFetch;
}
const reader = read('public/scripts/rebuild/features/reader.mjs');
const effects = read('public/scripts/rebuild/features/reader/load-chunk-side-effects.mjs');
for (const token of ['CONTENT_WORKER_RETRY_UX_PASS','context.mode === \'replace\' || context.mode === \'jump\'','Math.min(6','waitForContentWorkerRetry','return request()']) assert.ok(reader.includes(token), `reader retry token missing: ${token}`);
assert.ok(effects.includes('CONTENT_WORKER_RETRY_UX_PASS') && effects.includes('return foreground'), 'chunk failure UX must suppress background retry noise');
console.log(JSON.stringify({ pass:PASS }));
