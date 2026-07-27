#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outputArg = process.argv.find(arg => arg.startsWith('--output='));
const outputPath = path.resolve(root, outputArg ? outputArg.slice('--output='.length) : 'v682_targeted_results.json');
const tests = [
  'tools/checks/release-verify-current-coverage-v682-smoke.js',
  'tools/checks/v682-active-check-registration-smoke.js',
  'tools/checks/v682-library-organization-powershell51-compat-smoke.js',
  'tools/checks/v681-metadata-manual-provider-filter-smoke.js',
  'tools/checks/v680-login-owner-palette-smoke.js',

  'tools/checks/v680-user-theme-bootstrap-smoke.js',
  'tools/checks/v680-theme-runtime-contract-smoke.js',
  'tools/checks/v678-extension-popup-fixed-width-smoke.js',
  'tools/checks/v678-extension-popup-narrow-layout-smoke.js',
  'tools/checks/v678-metadata-folder-theme-smoke.js',
  'tools/checks/v679-metadata-folder-disclosure-smoke.js',
  'tools/checks/v677-metadata-hard-cap-incremental-smoke.js',
  'tools/checks/v677-library-tree-folder-cursor-smoke.js',
  'tools/checks/v677-cover-audit-nofollow-smoke.js',
  'tools/checks/v677-package-format-parser-smoke.js',
  'tools/checks/v677-runtime-dependency-install-smoke.js',
  'tools/checks/v676-compose-environment-yaml-smoke.js',
  'tools/checks/v676-trusted-proxy-validation-smoke.js',
  'tools/checks/v676-metadata-bounded-resident-smoke.js',
  'tools/checks/v676-reader-prefetch-orphan-circuit-smoke.mjs',
  'tools/checks/v676-modal-stack-runtime-smoke.mjs',
  'tools/checks/v676-font-io-error-propagation-smoke.js',
  'tools/checks/v676-progress-journal-symlink-smoke.js',
  'tools/checks/v676-extension-shortcut-responsive-smoke.js',
  'tools/checks/v676-metadata-folder-continuity-smoke.mjs',
  'tools/checks/v675-progress-delta-journal-smoke.js',
  'tools/checks/v675-metadata-compact-index-smoke.js',
  'tools/checks/v675-trusted-proxy-source-smoke.js',
  'tools/checks/v675-reader-prefetch-watchdog-smoke.mjs',
  'tools/checks/v675-service-worker-dual-failure-smoke.js',
  'tools/checks/v675-font-symlink-boundary-smoke.js',
  'tools/checks/v675-modal-focus-manager-smoke.mjs',
  'tools/checks/v675-profile-skeleton-smoke.mjs',
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
  const missingRuntimeDependency = /Cannot find module '(?:express|iconv-lite|jschardet|playwright(?:-chromium)?)'/u.test(stderr);
  const explicitBlock = run.status === 77 || missingRuntimeDependency;
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
  pass:'v682-targeted-results-pass',
  version:682,
  packageVersion:'6.82.0',
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
process.exit(payload.codeFailures || payload.timedOut ? 1 : 0);
