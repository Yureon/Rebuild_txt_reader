#!/usr/bin/env node
const assert = require('assert');
const { settleShutdownOperations, SHUTDOWN_ALL_SETTLED_PASS } = require('../../server/utils/shutdown');
const fs = require('fs');
const path = require('path');

async function main() {
  const calls = [];
  const results = await settleShutdownOperations([
    () => { calls.push('sync-failure'); throw new Error('sync failure'); },
    async () => { calls.push('async-failure'); throw new Error('async failure'); },
    () => { calls.push('success'); return { ok:true }; }
  ]);
  assert.deepStrictEqual(calls, ['sync-failure', 'async-failure', 'success']);
  assert.deepStrictEqual(results.map(item => item.status), ['rejected', 'rejected', 'fulfilled']);
  assert.strictEqual(results[2].value.ok, true);
  const appSource = fs.readFileSync(path.join(__dirname, '../../server/app.js'), 'utf8');
  assert.ok(appSource.indexOf('const primaryResults = await settleShutdownOperations(operations)') < appSource.indexOf('metadataPlaywrightService.stop()'), 'Playwright must stop after metadata queue drain settles');
  console.log(JSON.stringify({ pass:SHUTDOWN_ALL_SETTLED_PASS, operations:results.length }));
}

main().catch(error => { console.error(error); process.exit(1); });
