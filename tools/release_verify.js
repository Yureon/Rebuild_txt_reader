#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const PASS = 'v429-release-verify-step-logs-pass';
const TIMEOUT_PASS = 'v429-release-verify-timeout-option-pass';
const WITH_SERVER_PASS = 'v429-release-verify-with-server-pass';
const forbidden = new Set(['node_modules', 'data', 'sync_data.json', 'sync_data.json.bak', 'test_novels', '.npm-cache']);
const rawArgs = process.argv.slice(2);
const zipArg = rawArgs.find(arg => !arg.startsWith('--'));
const withServer = rawArgs.includes('--with-server');
const timeoutArg = rawArgs.find(arg => arg.startsWith('--timeout-ms='));
const timeoutMs = timeoutArg ? Number(timeoutArg.split('=')[1]) : 120000;
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('--timeout-ms must be a positive number');
const zipPath = path.resolve(zipArg || path.join(root, '..', 'txt_reader_multi_v429.zip'));
function step(label){ console.log('[release-verify] ' + label); }
function run(cmd, args, cwd, options = {}) {
  step([cmd].concat(args).join(' '));
  const spawnOptions = { cwd, encoding:'utf8', stdio:'pipe', timeout:options.timeoutMs || timeoutMs, maxBuffer:32 * 1024 * 1024, env:Object.assign({}, process.env, { CI:'true' }) };
  const res = spawnSync(cmd, args, spawnOptions);
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error([cmd].concat(args).join(' ') + ' failed with ' + res.status);
  return res;
}
function walk(dir, out = []) { for (const ent of fs.readdirSync(dir, { withFileTypes:true })) { const full = path.join(dir, ent.name); if (ent.isDirectory()) walk(full, out); else out.push(full); } return out; }
function runNodeScripts(tmp, scripts){
  for (const script of scripts) {
    const args = script.args || [script.path || script];
    run(process.execPath, args, tmp, { timeoutMs:script.timeoutMs });
  }
}
if (!fs.existsSync(zipPath)) throw new Error('ZIP not found: ' + zipPath);
step('verify zip integrity');
run('unzip', ['-tq', zipPath], root);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v429-verify-'));
try {
  step('clean extract');
  run('unzip', ['-q', zipPath, '-d', tmp], root);
  step('forbidden entries');
  const files = walk(tmp);
  const offenders = files.map(f => path.relative(tmp, f).replace(/\\/g, '/')).filter(rel => rel.split('/').some(part => forbidden.has(part)) || forbidden.has(path.basename(rel)));
  if (offenders.length) throw new Error('forbidden entries found: ' + offenders.join(', '));
  step('static release smoke set');
  runNodeScripts(tmp, [
    'tools/checks/precompressed-static-smoke.js',
    'tools/checks/precompressed-static-metadata-cache-smoke.js',
    'tools/checks/precompressed-hash-smoke.js',
    'tools/checks/current-version-lint-smoke.js',
    'tools/checks/version-toast-smoke.js',
    'tools/checks/modulepreload-entrypoints-smoke.js',
    'tools/checks/versioned-rebuild-cache-smoke.js',
    'tools/checks/block-manifest-conditional-cache-smoke.js',
    'tools/checks/reader-api-conditional-cache-smoke.js',
    'tools/checks/reader-api-cache-hardening-smoke.js',
    'tools/checks/content-cache-io-diagnostics-smoke.js',
    'tools/checks/content-worker-pool-abort-smoke.js',
    'tools/checks/admin-io-diagnostics-table-smoke.js',
    'tools/checks/reader-api-cold-warm-cache-smoke.js',
    'tools/checks/cache-strategy-adjustment-smoke.js',
    'tools/checks/admin-owner-css-split-review-smoke.js',
    'tools/checks/css-html-boundary-contract-smoke.js',
    'tools/checks/modulepreload-cache-policy-boundary-smoke.js',
    'tools/checks/owner-session-entry-redirect-smoke.js',
    'tools/checks/cache-metrics-threshold-diagnostics-smoke.js',
    'tools/checks/cache-invalidation-contract-smoke.js',
    'tools/checks/deployed-cache-header-script-smoke.js',
    'tools/checks/admin-js-deeper-split-smoke.js',
    'tools/checks/admin-user-actions-split-smoke.js',
    'tools/checks/admin-signup-audit-actions-split-smoke.js',
    'tools/checks/admin-ops-detail-table-smoke.js',
    'tools/checks/admin-state-actions-split-smoke.js',
    'tools/checks/admin-permission-actions-split-smoke.js',
    'tools/checks/admin-diagnostics-filter-smoke.js',
    'tools/checks/admin-dead-code-after-split-smoke.js',
    'tools/checks/search-option-dead-code-smoke.js',
    'tools/checks/skeleton-empty-state-guard-smoke.js',
    'tools/checks/recovery-center-compact-ui-smoke.js',
    'tools/checks/recovery-unused-files-pruned-smoke.js',
    'tools/checks/recovery-status-actionable-badge-smoke.js',
    'tools/checks/reader-multi-file-slider-totalchunks-smoke.js',
    'tools/checks/reader-multi-file-slider-dom-progress-smoke.js',
    'tools/checks/reader-safe-area-multifile-progress-smoke.js',
    'tools/checks/reader-multi-file-body-anchor-smoke.js',
    'tools/checks/reader-anchor-trace-export-smoke.js',
    'tools/checks/reader-anchor-trace-low-overhead-smoke.js',
    'tools/checks/reader-body-anchor-inertia-retain-smoke.js',
    'tools/checks/reader-inertia-fixture-expansion-smoke.js',
    'tools/checks/reader-anchor-regression-report-smoke.js',
    'tools/checks/reader-safe-area-body-progress-smoke.js',
    'tools/checks/reader-multi-file-progress-stability-smoke.js',
    'tools/checks/reader-buffer-append-current-chunk-retain-smoke.js',
    'tools/checks/reader-progress-manifest-adoption-guard-smoke.js',
    'tools/checks/reader-append-seam-70-85-progress-fixture-smoke.js',
    'tools/checks/reader-append-inertia-damp-smoke.js',
    'tools/checks/reader-ipad-touch-coast-retain-smoke.js',
    'tools/checks/library-catalog-performance-smoke.js',
    'tools/checks/search-worker-warm-start-smoke.js',
    'tools/checks/search-full-scan-speed-smoke.js',
    'tools/checks/reader-row-measure-cache-diagnostics-smoke.js',
    'tools/checks/static-asset-preload-budget-smoke.js',
    'tools/checks/status-pill-fullscreen-compact-smoke.js',
    'tools/checks/recovery-reader-stale-cache-summary-smoke.js',
    'tools/checks/font-user-scope-smoke.js',
    'tools/checks/multi-user-isolation-boundary-smoke.js',
    'tools/checks/personal-data-isolation-doc-smoke.js',
    'tools/checks/font-account-scope-ui-smoke.js'
  ]);
  if (withServer) {
    step('server dependency install');
    run('npm', ['install', '--no-audit', '--no-fund', '--package-lock=false'], tmp, { timeoutMs });
    step('server structure smoke');
    run(process.execPath, ['tools/check_server_structure.js'], tmp, { timeoutMs });
    step('server http smoke');
    run(process.execPath, ['tools/smoke_server_http.js'], tmp, { timeoutMs });
    console.log(WITH_SERVER_PASS);
  }
  console.log(TIMEOUT_PASS + ' timeoutMs=' + timeoutMs);
  console.log(PASS + ' ' + path.basename(zipPath));
} finally { fs.rmSync(tmp, { recursive:true, force:true }); }
