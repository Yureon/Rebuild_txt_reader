#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outputArg = process.argv.find(arg => arg.startsWith('--output='));
const outputPath = path.resolve(root, outputArg ? outputArg.slice('--output='.length) : 'v674_targeted_results.json');
const tests = [
  'tools/checks/release-verify-current-coverage-v674-smoke.js',
  'tools/checks/v674-progress-local-compaction-smoke.mjs',
  'tools/checks/v674-reader-prefetch-cancel-race-smoke.mjs',
  'tools/checks/v674-library-bounded-fallback-smoke.mjs',
  'tools/checks/v674-service-worker-navigation-state-failure-smoke.js',
  'tools/checks/v674-server-filesystem-durability-smoke.js',
  'tools/checks/v674-server-device-profile-cap-smoke.js',
  'tools/checks/v674-metadata-playwright-dns-pinning-smoke.js',
  'tools/checks/v674-cross-platform-gate-contract-smoke.js',
  'tools/checks/metadata-routes-access-smoke.js',
  'tools/checks/v673-metadata-applied-index-smoke.js',
  'tools/checks/v673-metadata-applied-shard-smoke.js',
  'tools/checks/v673-metadata-candidate-shard-race-smoke.js',
  'tools/checks/v673-metadata-sparse-shard-init-smoke.js',
  'tools/checks/v673-library-shelf-hot-path-smoke.js',
  'tools/checks/v673-library-variant-coarse-bucket-smoke.js',
  'tools/checks/v673-disk-cache-bounded-candidate-smoke.js',
  'tools/checks/v672-metadata-cpu-optimization-smoke.js',
  'tools/checks/v671-p0-p1-stability-smoke.js',
  'tools/checks/metadata-manual-fast-path-v648-smoke.mjs',
  'tools/checks/metadata-store-async-persistence-v592-smoke.js',
  'tools/checks/metadata-compressed-store-v642-smoke.js',
  'tools/checks/metadata-manual-candidate-delete-v630-smoke.js',
  'tools/checks/metadata-candidate-dedup-v615-smoke.js',
  'tools/checks/metadata-candidate-maintenance-v642-smoke.js',
  'tools/checks/metadata-store-idempotency-v606-smoke.js',
  'tools/checks/metadata-store-queue-smoke.js',
  'tools/checks/library-request-resilience-v646-smoke.mjs',
  'tools/checks/library-variant-grouping-smoke.js',
  'tools/checks/library-variant-preference-v642-smoke.js',
  'tools/checks/library-variant-relations-v642-smoke.js',
  'tools/checks/library-metadata-content-grouping-v642-smoke.js',
  'tools/checks/library-grouping-runtime-wiring-v642-smoke.js',
  'tools/checks/disk-cache-auto-prune-smoke.js',
  'tools/checks/disk-cache-in-use-protection-smoke.js'
];

const results = tests.map((file, index) => {
  const started = process.hrtime.bigint();
  const run = spawnSync(process.execPath, [file], {
    cwd:root,
    encoding:'utf8',
    timeout:120_000,
    windowsHide:true,
    maxBuffer:16 * 1024 * 1024
  });
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  const stdout = String(run.stdout || '').trim();
  const stderr = String(run.stderr || '').trim();
  const explicitBlock = run.status === 77;
  const timedOut = run.error?.code === 'ETIMEDOUT';
  const passed = run.status === 0 && !timedOut;
  process.stdout.write(`[${index + 1}/${tests.length}] ${passed ? 'PASS' : explicitBlock ? 'BLOCK' : timedOut ? 'TIMEOUT' : 'FAIL'} ${file}\n`);
  return {
    file,
    passed,
    environmentBlocked:explicitBlock,
    timedOut,
    exitCode:run.status,
    elapsedMs:Math.round(elapsedMs * 100) / 100,
    stdout,
    stderr,
    error:run.error?.message || ''
  };
});

const payload = {
  schemaVersion:1,
  pass:'v674-targeted-results-pass',
  version:674,
  packageVersion:'6.74.0',
  generatedAt:new Date().toISOString(),
  total:results.length,
  passed:results.filter(item => item.passed).length,
  environmentBlocked:results.filter(item => item.environmentBlocked).length,
  codeFailures:results.filter(item => !item.passed && !item.environmentBlocked && !item.timedOut).length,
  timedOut:results.filter(item => item.timedOut).length,
  results
};
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n');
console.log(JSON.stringify({ ...payload, results:undefined, output:path.relative(root, outputPath) }, null, 2));
if (payload.codeFailures || payload.timedOut) process.exitCode = 1;
