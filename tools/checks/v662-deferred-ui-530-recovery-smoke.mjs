#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const loader = read('public/scripts/rebuild/core/feature-fragments.mjs');
const sw = read('public/sw.js');
const auth = read('server/middleware/auth.js');

for (const token of [
  'DEFERRED_ASSET_RETRYABLE_STATUS', '530', 'Retry-After', 'cf-ray',
  'cloudflareErrorCode', "cache:attempt === 0 ? 'force-cache' : 'no-store'",
  'edge_retry=', 'deferredUiStyleAttempt', 'DEFERRED_UI_EDGE_RECOVERY_PASS', 'v662-deferred-ui-edge-recovery-pass'
]) assert.ok(loader.includes(token), `loader recovery token missing: ${token}`);
assert.ok(sw.includes('`/styles/deferred-ui.css?v=${BUILD}`'), 'deferred CSS must be precached');
assert.ok(sw.includes('`/fragments/deferred-ui.html?v=${BUILD}`'), 'deferred fragment must be precached');
assert.ok(auth.includes("'/styles/deferred-ui.css'"), 'deferred CSS must be public for unauthenticated SW install');
assert.ok(auth.includes("'/fragments/deferred-ui.html'"), 'deferred fragment must be public for unauthenticated SW install');

let executable = loader
  .replace(/^import[^\n]+\n/, '')
  .replace(/export const /g, 'const ')
  .replace(/export async function /g, 'async function ')
  .replace('const DEFERRED_ASSET_RETRY_DELAYS_MS = Object.freeze([0, 900, 2200]);', 'const DEFERRED_ASSET_RETRY_DELAYS_MS = Object.freeze([0, 0, 0]);');
executable += '\n;globalThis.__v662test={fetchDeferredAsset,cloudflareErrorCode,parseRetryAfterMs};';

const calls = [];
const responses = [
  {
    ok:false, status:530,
    headers:{ get(name){ const key=String(name).toLowerCase(); return key==='cf-ray'?'abc123-ICN':(key==='retry-after'?'0':''); } },
    async text(){ return '<html><span class="code">1033</span></html>'; }
  },
  {
    ok:true, status:200,
    headers:{ get(){ return ''; } },
    async text(){ return '<div id="settings-panel"></div>'; }
  }
];
const context = {
  console,
  Blob,
  CustomEvent: class {},
  setTimeout(fn){ fn(); return 1; },
  clearTimeout(){},
  fetch: async (url, options) => { calls.push({url,options}); return responses.shift(); },
  document:{},
  window:{},
  performance:{ now:()=>0 }
};
context.globalThis = context;
vm.runInNewContext(executable, context, { filename:'feature-fragments.mjs' });
const api = context.__v662test;
assert.equal(api.cloudflareErrorCode('<span class="code">1033</span>'), '1033');
const html = await api.fetchDeferredAsset('/fragments/deferred-ui.html?v=rebuild-v667', { accept:'text/html', asText:true });
assert.equal(html, '<div id="settings-panel"></div>');
assert.equal(calls.length, 2, '530 must trigger one retry before success');
assert.equal(calls[0].options.cache, 'force-cache');
assert.equal(calls[1].options.cache, 'no-store');
assert.match(calls[1].url, /edge_retry=1-/);

const failContext = { ...context, fetch:async () => ({ ok:false,status:404,headers:{get(){return ''}},async text(){return 'missing'}}) };
failContext.globalThis = failContext;
vm.runInNewContext(executable, failContext, { filename:'feature-fragments-404.mjs' });
await assert.rejects(
  failContext.__v662test.fetchDeferredAsset('/fragments/deferred-ui.html?v=rebuild-v667', { asText:true }),
  error => Number(error.status) === 404
);

console.log(JSON.stringify({ pass:'v662-deferred-ui-530-recovery-smoke-pass', retryCalls:calls.length }));
