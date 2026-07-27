#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { normalizeArchiveEntryName, inspectArchiveBeforeExtract, assertExtractedTreeHasNoLinks } = require('./archive-safety.js');
const root = path.resolve(__dirname, '..');
const PASS = 'v649-release-verify-process-tree-timeout-pass';
const TIMEOUT_PASS = 'v429-release-verify-timeout-option-pass';
const STEP_LOG_PASS = 'v429-release-verify-step-logs-pass';
const WITH_SERVER_PASS = 'v429-release-verify-with-server-pass';
const forbidden = new Set(['node_modules', 'data', 'sync_data.json', 'sync_data.json.bak', 'test_novels', '.npm-cache']);
const rawArgs = process.argv.slice(2);
const zipArg = rawArgs.find(arg => !arg.startsWith('--'));
const withServer = rawArgs.includes('--with-server');
const timeoutArg = rawArgs.find(arg => arg.startsWith('--timeout-ms='));
const timeoutMs = timeoutArg ? Number(timeoutArg.split('=')[1]) : 120000;
let blockedCapabilityCount = 0;
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('--timeout-ms must be a positive number');
const { CURRENT_REBUILD_PACKAGE } = require('./checks/current-rebuild-version.js');
const zipPath = path.resolve(zipArg || path.join(root, '..', CURRENT_REBUILD_PACKAGE));
function step(label){ console.log('[release-verify] ' + label); }
function run(cmd, args, cwd, options = {}) {
  step([cmd].concat(args).join(' '));
  const effectiveTimeout = options.timeoutMs || timeoutMs;
  const runner = path.join(__dirname, 'process-tree-runner.js');
  const runnerArgs = [`--cwd=${cwd}`, `--timeout-ms=${effectiveTimeout}`, '--', cmd, ...args];
  const spawnOptions = {
    cwd,
    encoding:'utf8',
    stdio:'pipe',
    timeout:effectiveTimeout + 5000,
    maxBuffer:32 * 1024 * 1024,
    env:Object.assign({}, process.env, { CI:'true', PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'1' })
  };
  const res = spawnSync(process.execPath, [runner, ...runnerArgs], spawnOptions);
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.error) throw res.error;
  if (res.status === 77) {
    blockedCapabilityCount += 1;
    console.log('[release-verify] capability blocked: ' + [cmd].concat(args).join(' '));
    return res;
  }
  if (res.status === 124) {
    const error = new Error([cmd].concat(args).join(' ') + ` timed out after ${effectiveTimeout}ms`);
    error.code = 'ETIMEDOUT';
    throw error;
  }
  if (res.status !== 0) throw new Error([cmd].concat(args).join(' ') + ' failed with ' + res.status);
  return res;
}
function runArchiveExtract(args, cwd) {
  const unzipProbe = spawnSync('unzip', ['-v'], { encoding:'utf8', stdio:'pipe' });
  if (!unzipProbe.error && unzipProbe.status === 0) return run('unzip', args, cwd);
  if (args[0] === '-tq') return run('tar', ['-tf', args[1]], cwd);
  if (args[0] === '-q' && args[2] === '-d') return run('tar', ['-xf', args[1], '-C', args[3]], cwd);
  throw new Error('unsupported archive extraction arguments: ' + args.join(' '));
}
function walk(dir, out = []) { for (const ent of fs.readdirSync(dir, { withFileTypes:true })) { const full = path.join(dir, ent.name); if (ent.isDirectory()) walk(full, out); else out.push(full); } return out; }
function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}
function verifyPackageManifest(tmp) {
  const candidates = fs.readdirSync(tmp).filter(name => /^package-manifest-v\d+\.json$/.test(name)).sort();
  if (!candidates.length) throw new Error('package manifest is missing from release root');
  const manifestName = candidates[candidates.length - 1];
  const manifest = JSON.parse(fs.readFileSync(path.join(tmp, manifestName), 'utf8'));
  if (!Array.isArray(manifest.files)) throw new Error('package manifest files list is missing');
  const expected = new Map();
  for (const item of manifest.files) {
    const rel = normalizeArchiveEntryName(String(item && item.path || '').replace(/\\/g, '/')).replace(/\/$/, '');
    if (!rel || rel === manifestName || expected.has(rel)) throw new Error('invalid package manifest path: ' + rel);
    expected.set(rel, item);
  }
  const actual = walk(tmp).map(file => path.relative(tmp, file).replace(/\\/g, '/')).filter(rel => rel !== manifestName).sort();
  const missing = Array.from(expected.keys()).filter(rel => !fs.existsSync(path.join(tmp, rel)));
  const extra = actual.filter(rel => !expected.has(rel));
  if (missing.length || extra.length) throw new Error('package manifest file set mismatch; missing=' + missing.join(',') + ' extra=' + extra.join(','));
  for (const rel of actual) {
    const item = expected.get(rel);
    const filePath = path.join(tmp, rel);
    const stat = fs.statSync(filePath);
    if (Number(item.bytes) !== stat.size) throw new Error('package manifest size mismatch: ' + rel);
    if (String(item.sha256 || '') !== sha256File(filePath)) throw new Error('package manifest hash mismatch: ' + rel);
  }
  console.log('current-package-manifest-content-verify-pass files=' + actual.length);
  return manifest;
}

function runNodeScripts(tmp, scripts){
  for (const script of scripts) {
    const args = script.args || [script.path || script];
    run(process.execPath, args, tmp, { timeoutMs:script.timeoutMs });
  }
}
if (!fs.existsSync(zipPath)) throw new Error('ZIP not found: ' + zipPath);
step('pre-extraction archive safety');
const archiveSafety = inspectArchiveBeforeExtract(zipPath);
console.log(`${archiveSafety.pass} entries=${archiveSafety.rawEntryCount}`);
step('verify zip integrity');
runArchiveExtract(['-tq', zipPath], root);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-current-verify-'));
let cleaned = false;
function cleanupTemp(){ if (cleaned) return; cleaned = true; try { fs.rmSync(tmp, { recursive:true, force:true }); } catch {} }
function handleTermination(signal){ cleanupTemp(); process.exit(signal === 'SIGINT' ? 130 : 143); }
process.once('SIGINT', handleTermination);
process.once('SIGTERM', handleTermination);
try {
  step('clean extract');
  runArchiveExtract(['-q', zipPath, '-d', tmp], root);
  assertExtractedTreeHasNoLinks(tmp);
  step('forbidden entries');
  const files = walk(tmp);
  const offenders = files.map(f => path.relative(tmp, f).replace(/\\/g, '/')).filter(rel => rel.split('/').some(part => forbidden.has(part)) || forbidden.has(path.basename(rel)));
  if (offenders.length) throw new Error('forbidden entries found: ' + offenders.join(', '));
  step('package manifest content');
  verifyPackageManifest(tmp);
  step('runtime dependency install');
  const npmProbe = spawnSync('npm', ['--version'], { encoding:'utf8', stdio:'pipe' });
  if (!npmProbe.error && npmProbe.status === 0) {
    run('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], tmp, { timeoutMs });
  } else {
    step('npm unavailable; using pnpm runtime-only fallback');
    if (process.platform === 'win32') {
      run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'pnpm.cmd import && pnpm.cmd install --prod --frozen-lockfile --ignore-scripts'], tmp, { timeoutMs });
    } else {
      run('pnpm', ['import'], tmp, { timeoutMs });
      run('pnpm', ['install', '--prod', '--frozen-lockfile', '--ignore-scripts'], tmp, { timeoutMs });
    }
  }
  step('static release smoke set');
  runNodeScripts(tmp, [
    'tools/checks/release-verify-current-coverage-v682-smoke.js',
    'tools/checks/v682-active-check-registration-smoke.js',
    'tools/checks/v682-library-organization-powershell51-compat-smoke.js',
    'tools/checks/v681-metadata-manual-provider-filter-smoke.js',
    'tools/checks/release-verify-current-coverage-v680-smoke.js',
    'tools/checks/v680-active-check-registration-smoke.js',
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
    'tools/checks/v673-metadata-applied-index-smoke.js',
    'tools/checks/v673-metadata-applied-shard-smoke.js',
    'tools/checks/v673-metadata-candidate-shard-race-smoke.js',
    'tools/checks/v673-metadata-sparse-shard-init-smoke.js',
    'tools/checks/v673-library-shelf-hot-path-smoke.js',
    'tools/checks/v673-library-variant-coarse-bucket-smoke.js',
    'tools/checks/v673-disk-cache-bounded-candidate-smoke.js',
    'tools/checks/v672-metadata-cpu-optimization-smoke.js',
    'tools/checks/v671-p0-p1-stability-smoke.js',
    'tools/checks/metadata-provider-completion-cooldown-v669-smoke.js',
    'tools/checks/v670-settings-language-advanced-smoke.mjs',
    'tools/checks/v668-library-shell-isolation-smoke.mjs',
    'tools/checks/v667-ui-metadata-provider-smoke.js',
    'tools/checks/v666-non-auth-autofill-guard-smoke.js',
    'tools/checks/v665-manual-cover-recognition-smoke.js',
    'tools/checks/v665-node-direct-launch-smoke.js',
    'tools/checks/v665-docs-consolidation-smoke.js',
    'tools/checks/v664-library-resume-explorer-quick-smoke.mjs',
    'tools/checks/v663-assets-csp-cover-smoke.mjs',
    'tools/checks/v662-deferred-ui-530-recovery-smoke.mjs',
    'tools/checks/v661-audit-fixes-env-docs-smoke.mjs',
    'tools/checks/v660-read-data-reader-tabs-isolation-smoke.mjs',
    'tools/checks/v659-settings-bindings-layout-smoke.mjs',
    'tools/checks/v659-settings-actual-bindings-runtime.mjs',
    'tools/checks/v658-settings-gesture-labels-smoke.mjs',
    'tools/checks/v657-admin-settings-viewport-smoke.mjs',
    'tools/checks/v656-mobile-explorer-settings-smoke.mjs',
    'tools/checks/v655-library-settings-admin-ux-smoke.mjs',
    'tools/checks/v654-settings-shelf-navigation-smoke.mjs',
    'tools/checks/admin-owner-layout-smoke.js',
    'tools/checks/admin-user-management-mobile-layout-smoke.js',
    'tools/checks/settings-library-tab-visibility-v653-smoke.mjs',
    'tools/checks/library-mobile-header-reveal-v653-smoke.mjs',
    'tools/checks/settings-workspace-v652-smoke.mjs',
    'tools/checks/admin-cleanup-summary-v651-smoke.mjs',
    'tools/checks/reader-jump-percent-input-v652-smoke.mjs',
    'tools/checks/admin-cleanup-summary-v651-smoke.mjs',
    'tools/checks/update-banner-critical-v651-smoke.js',
    'tools/checks/settings-page-state-v651-smoke.mjs',
    'tools/checks/library-mutation-journal-v649-smoke.js',
    'tools/checks/v649-audit-fixes-smoke.js',
    'tools/checks/release-verify-timeout-v649-smoke.js',
    'tools/checks/admin-responsive-permission-cleanup-v649-smoke.js',
    'tools/checks/library-reader-settings-v650-smoke.mjs',
    'tools/checks/reader-fullscreen-header-v650-smoke.mjs',
    'tools/checks/metadata-manual-fast-path-v648-smoke.mjs',
    'tools/checks/library-durable-invalidation-v648-smoke.js',
    'tools/checks/library-request-boundary-v648-smoke.js',
    'tools/checks/v648-audit-runtime-fixes-smoke.mjs',
    'tools/checks/library-settings-diagnostics-v647-smoke.mjs',
    'tools/checks/reader-search-modal-v647-smoke.js',
    'tools/checks/library-stability-v646-smoke.js',
    'tools/checks/library-request-resilience-v646-smoke.mjs',
    'tools/checks/library-reader-ui-v645-smoke.js',
    'tools/checks/network-search-mode-v645-smoke.js',
    'tools/checks/deferred-ui-style-recovery-v645-smoke.js',
    'tools/checks/library-mobile-header-v644-smoke.js',
    'tools/checks/library-entry-load-budget-v644-smoke.mjs',
    'tools/checks/owner-library-permission-ui-v643-smoke.js',
    'tools/checks/owner-metadata-locale-settings-v643-smoke.js',
    'tools/checks/metadata-provider-settings-v643-smoke.js',
    'tools/checks/library-cleanup-candidates-v643-smoke.js',
    'tools/checks/library-organization-v643-smoke.js',
    'tools/checks/site-language-packs-v643-smoke.js',
    'tools/checks/metadata-page-locale-v643-smoke.js',
    'tools/checks/metadata-compressed-store-v642-smoke.js',
    'tools/checks/metadata-candidate-maintenance-v642-smoke.js',
    'tools/checks/metadata-storage-maintenance-ui-v642-smoke.js',
    'tools/checks/library-metadata-content-grouping-v642-smoke.js',
    'tools/checks/library-variant-relations-v642-smoke.js',
    'tools/checks/library-variant-preference-v642-smoke.js',
    'tools/checks/library-content-fingerprint-v642-smoke.js',
    'tools/checks/library-content-discovery-v642-smoke.js',
    'tools/checks/library-cleanup-similarity-ui-v642-smoke.js',
    'tools/checks/library-grouping-runtime-wiring-v642-smoke.js',
    'tools/checks/v641-audit-security-durability-smoke.js',
    'tools/checks/v641-metadata-manual-clear-smoke.js',
    'tools/checks/v641-owner-library-extension-smoke.js',
    'tools/checks/v641-packaging-gates-smoke.js',
    'tools/checks/source-size-budget-v641-smoke.js',
    'tools/checks/version-contract-import-order-v641-smoke.js',
    'tools/checks/package-inventory-exclude-v641-smoke.js',
    'tools/checks/metadata-ssn-provider-v640-smoke.js',
    'tools/checks/metadata-ssn-collection-v640-smoke.js',
    'tools/checks/admin-owner-workspace-v640-smoke.js',
    'tools/checks/login-public-assets-v639-smoke.js',
    'tools/checks/metadata-equivalent-group-cover-v639-smoke.js',
    'tools/checks/scroll-to-top-overlay-v639-smoke.js',
    'tools/checks/login-silent-handshake-v638-smoke.js',
    'tools/checks/service-worker-client-state-bounds-v638-smoke.js',
    'tools/checks/metadata-manual-cover-legacy-v638-smoke.js',
    'tools/checks/metadata-equivalent-candidate-groups-v638-smoke.js',
    'tools/checks/scroll-to-top-v638-smoke.js',
    'tools/checks/service-worker-client-state-v637-smoke.js',
    'tools/checks/update-button-idempotency-v637-smoke.js',
    'tools/checks/stale-executable-policy-v637-smoke.js',
    'tools/checks/metadata-manual-cover-v637-smoke.js',
    'tools/checks/service-worker-update-coordination-v636-smoke.js',
    'tools/checks/metadata-cover-lease-durability-v636-smoke.js',
    'tools/checks/service-worker-update-activation-v635-smoke.js',
    'tools/checks/metadata-cover-update-safety-v635-smoke.js',
    'tools/checks/metadata-novelpia-cover-v634-smoke.js',
    'tools/checks/metadata-manual-cover-upload-v634-smoke.js',
    'tools/checks/cdn-worker-stale-assets-v633-smoke.js',
    'tools/checks/service-worker-cloudflare-v632-smoke.js',
    'tools/checks/service-worker-forward-upgrade-v631-smoke.js',
    'tools/checks/library-cleanup-ui-v630-smoke.js',
    'tools/checks/metadata-manual-candidate-delete-v630-smoke.js',
    'tools/checks/ui-build-badge-v629-smoke.js',
    'tools/checks/library-cleanup-real-fixture-v628-smoke.js',
    'tools/checks/library-cleanup-admin-route-v628-smoke.js',
    'tools/checks/smoke-runner-command-timeout-v628-smoke.js',
    'tools/checks/v627-reaudit-fixes-smoke.js',
    'tools/checks/metadata-live-score-competition-v627-smoke.js',
    'tools/checks/fileops-stale-lock-v627-smoke.js',
    'tools/checks/ui-scrollbar-compose-v626-smoke.js',
    'tools/checks/security-reaudit-v625-smoke.js',
    'tools/checks/metadata-playwright-secure-fast-v625-smoke.js',
    'tools/checks/metadata-performance-v625-smoke.js',
    'tools/checks/responsive-pages-v624-smoke.js',
    'tools/checks/metadata-job-poll-selection-v624-smoke.js',
    'tools/checks/metadata-work-filters-v623-smoke.js',
    'tools/checks/metadata-provider-mobile-v622-smoke.js',
    'tools/checks/metadata-mobile-fallback-service-v622-smoke.js',
    'tools/checks/metadata-munpia-current-v622-smoke.js',
    'tools/checks/metadata-score-priority-bulk-apply-v619-smoke.js',
    'tools/checks/metadata-novelpia-adult-playwright-v617-smoke.js',
    'tools/checks/metadata-novelpia-adult-collection-v617-smoke.js',
    'tools/checks/metadata-view-state-v616-smoke.js',
    'tools/checks/ux-disruption-guard-v616-smoke.js',
    'tools/checks/metadata-candidate-dedup-v615-smoke.js',
    'tools/checks/modulepreload-entrypoints-smoke.js',
    'tools/checks/access-bootstrap-v613-smoke.mjs',
    'tools/checks/metadata-restart-resume-v614-smoke.js',
    'tools/checks/metadata-auto-apply-v614-smoke.js',
    'tools/checks/user-scoped-storage-v613-smoke.mjs',
    'tools/checks/progress-user-scope-v613-smoke.mjs',
    'tools/checks/reader-cache-user-scope-v613-smoke.mjs',
    'tools/checks/progress-lifecycle-immediate-v613-smoke.mjs',
    'tools/checks/critical-preload-budget-v613-smoke.js',
    'tools/checks/ui-version-accessibility-v613-smoke.js',
    'tools/checks/smoke-runner-dependency-block-v613-smoke.js',
    'tools/checks/progress-delta-single-acl-v613-smoke.js',
    'tools/checks/api-boundary-v611-smoke.js',
    'tools/checks/progress-delta-v612-smoke.mjs',
    'tools/checks/progress-storage-coalesce-v612-smoke.mjs',
    'tools/checks/library-async-event-guard-v612-smoke.mjs',
    'tools/checks/library-access-snapshot-v612-smoke.mjs',
    'tools/checks/archive-safety-v611-smoke.js',
    'tools/checks/deployment-probe-v611-smoke.js',
    'tools/checks/package-archive-fallback-v610-smoke.js',
    'tools/checks/async-route-v610-smoke.js',
    'tools/checks/shutdown-contract-v610-smoke.js',
    'tools/checks/deployment-state-boot-v610-smoke.js',
    'tools/checks/font-sync-atomic-v610-smoke.js',
    'tools/checks/smoke-runner-orphan-coverage-v609-smoke.js',
    'tools/checks/esm-unused-named-import-v609-smoke.js',
    'tools/checks/cjs-unused-destructured-require-v609-smoke.js',
    'tools/checks/release-verify-lockfile-fallback-v609-smoke.js',
    'tools/checks/session-logout-durability-v606-smoke.js',
    'tools/checks/login-session-durability-v606-smoke.js',
    'tools/checks/content-worker-shutdown-v606-smoke.js',
    'tools/checks/precompressed-http-boundary-v606-smoke.js',
    'tools/checks/metadata-store-idempotency-v606-smoke.js',
    'tools/checks/metadata-cover-access-scope-v606-smoke.js',
    'tools/checks/csrf-multitab-v605-smoke.js',
    'tools/checks/csrf-client-retry-v605-smoke.mjs',
    'tools/checks/fileops-symlink-boundary-v605-smoke.js',
    'tools/checks/fileops-folder-cache-prescan-v605-smoke.js',
    'tools/checks/user-state-access-fastpath-v605-smoke.js',
    'tools/checks/user-state-write-acl-v605-smoke.js',
    'tools/checks/static-cache-versioning-v605-smoke.js',
    'tools/checks/shutdown-docker-contract-v605-smoke.js',
    'tools/checks/account-auth-timing-path-v605-smoke.js',
    'tools/checks/proxy-scheme-trust-v605-smoke.js',
    'tools/checks/legacy-sync-disabled-v605-smoke.js',
    'tools/checks/state-sync-number-validation-v605-smoke.js',
    'tools/checks/build-mismatch-worker-v605-smoke.js',
    'tools/checks/docker-library-mount-mode-v605-smoke.js',
    'tools/checks/json-file-store-durability-v603-smoke.js',
    'tools/checks/sync-state-durable-flush-v603-smoke.js',
    'tools/checks/session-store-retry-shutdown-v603-smoke.js',
    'tools/checks/graceful-shutdown-failure-propagation-v603-smoke.js',
    'tools/checks/user-state-durable-admin-v603-smoke.js',
    'tools/checks/user-state-cache-eviction-v603-smoke.js',
    'tools/checks/content-cache-inflight-invalidation-v603-smoke.js',
    'tools/checks/disk-cache-janitor-async-v603-smoke.js',
    'tools/checks/admin-diagnostics-filesystem-async-v603-smoke.js',
    'tools/checks/metadata-queue-async-durability-v603-smoke.js',
    'tools/checks/metadata-bulk-async-io-v603-smoke.js',
    'tools/checks/metadata-cover-async-v603-smoke.js',
    'tools/checks/account-auth-async-v603-smoke.js',
    'tools/checks/account-request-scrypt-async-v603-smoke.js',
    'tools/checks/account-signup-persistence-rollback-v603-smoke.js',
    'tools/checks/signup-registration-commit-v603-smoke.js',
    'tools/checks/admin-user-delete-state-rollback-v603-smoke.js',
    'tools/checks/audit-log-async-security-v603-smoke.js',
    'tools/checks/security-express-fingerprint-v603-smoke.js',
    'tools/checks/site-language-async-security-v603-smoke.js',
    'tools/checks/font-async-atomic-v603-smoke.js',
    'tools/checks/font-filename-collision-v603-smoke.js',
    'tools/checks/library-tag-browser-v603-smoke.mjs',
    'tools/checks/library-tag-window-navigation-v603-smoke.js',
    'tools/checks/library-user-tag-facet-priority-v603-smoke.js',
    'tools/checks/json-backup-recovery-v604-smoke.js',
    'tools/checks/service-backup-recovery-v604-smoke.js',
    'tools/checks/user-state-api-durability-v604-smoke.js',
    'tools/checks/metadata-playwright-backup-v604-smoke.js',
    'tools/checks/auth-asset-revalidation-v604-smoke.js',
    'tools/checks/metadata-provider-settings-owner-v604-smoke.js',
    'tools/checks/build-mismatch-boundary-v604-smoke.js',
    'tools/checks/recovery-status-async-v604-smoke.js',
    'tools/checks/site-language-backup-only-v604-smoke.js',
    'tools/checks/metadata-provider-profile-privacy-v604-smoke.js',
    'tools/checks/immutable-icon-versioning-v604-smoke.js',
    'tools/checks/session-store-backup-migration-v604-smoke.js',
    'tools/checks/account-signup-backup-heal-v604-smoke.js',
    'tools/checks/build-mismatch-client-v604-smoke.js',
    'tools/checks/service-worker-build-boundary-v604-smoke.js',
    'tools/checks/user-access-snapshot-payload-v604-smoke.mjs',
    'tools/checks/service-backup-heal-v604-smoke.js',
    'tools/checks/metadata-job-isolation-v604-smoke.js',
    'tools/checks/metadata-job-requester-scale-v604-smoke.js',
    'tools/checks/metadata-light-context-v604-smoke.js',
    'tools/checks/initial-load-v600-smoke.js',
    'tools/checks/client-performance-v600-smoke.js',
    'tools/checks/library-quick-switcher-v600-smoke.js',
    'tools/checks/library-user-tags-v600-smoke.js',
    'tools/checks/library-user-tags-api-v600-smoke.js',
    'tools/checks/metadata-pacing-v600-smoke.js',
    'tools/checks/library-tag-facet-v601-smoke.mjs',
    'tools/checks/library-user-tags-contract-v601-smoke.js',
    'tools/checks/read-data-user-tags-v601-smoke.mjs',
    'tools/checks/state-record-key-v601-smoke.js',
    'tools/checks/read-data-record-key-v601-smoke.mjs',
    'tools/checks/shared-partial-write-v602-smoke.mjs',
    'tools/checks/device-state-write-v602-smoke.mjs',
    'tools/checks/user-state-shelf-cache-v602-smoke.js',
    'tools/checks/precompressed-negotiation-v602-smoke.js',
    'tools/checks/service-worker-precache-key-v602-smoke.js',
    'tools/checks/library-tag-pagination-v602-smoke.js',
    'tools/checks/library-facet-request-race-v602-smoke.mjs',
    'tools/checks/library-state-integrity-v602-smoke.js',
    'tools/checks/smoke-runner-dedupe-v589-smoke.js',
    'tools/checks/release-verify-default-deps-v589-smoke.js',
    'tools/checks/disk-cache-janitor-lifecycle-v589-smoke.js',
    'tools/checks/metadata-store-async-persistence-v592-smoke.js',
    'tools/checks/metadata-queue-graceful-stop-v592-smoke.js',
    'tools/checks/fileops-async-serialization-v592-smoke.js',
    'tools/checks/service-worker-cache-key-v592-smoke.js',
    'tools/checks/graceful-shutdown-v592-smoke.js',
    'tools/checks/metadata-playwright-all-providers-v593-smoke.js',
    'tools/checks/metadata-playwright-security-persistence-v593-smoke.js',
    'tools/checks/metadata-permission-button-v593-smoke.js',
    'tools/checks/page-logout-controls-v593-smoke.js',
    'tools/checks/audit-log-async-v593-smoke.js',
    'tools/checks/graceful-shutdown-request-drain-v593-smoke.js',
    'tools/checks/admin-diagnostics-async-v592-smoke.js',
    'tools/checks/architecture-storage-contract-v590-smoke.js',
    'tools/checks/release-output-path-v590-smoke.js',
    'tools/checks/pwa-service-worker-v590-smoke.js',
    'tools/checks/metadata-document-access-v590-smoke.js',
    'tools/checks/precompressed-static-smoke.js',
    'tools/checks/precompressed-static-metadata-cache-smoke.js',
    'tools/checks/precompressed-static-async-io-v591-smoke.js',
    'tools/checks/precompressed-hash-smoke.js',
    'tools/checks/current-version-lint-smoke.js',
    'tools/checks/version-toast-smoke.js',
    'tools/checks/modulepreload-entrypoints-smoke.js',
    'tools/checks/versioned-rebuild-cache-smoke.js',
    'tools/checks/block-manifest-conditional-cache-smoke.js',
    'tools/checks/reader-api-conditional-cache-smoke.js',
    'tools/checks/reader-api-cache-hardening-smoke.js',
    'tools/checks/content-cache-io-diagnostics-smoke.js',
    'tools/checks/content-async-source-io-v591-smoke.js',
    'tools/checks/block-manifest-async-io-v591-smoke.js',
    'tools/checks/content-worker-pool-abort-smoke.js',
    'tools/checks/content-worker-resource-budget-smoke.js',
    'tools/checks/sync-state-lifecycle-v591-smoke.js',
    'tools/checks/sync-state-data-path-v591-smoke.js',
    'tools/checks/session-store-lifecycle-v591-smoke.js',
    'tools/checks/admin-io-diagnostics-table-smoke.js',
    'tools/checks/reader-api-cold-warm-cache-smoke.js',
    'tools/checks/cache-strategy-adjustment-smoke.js',
    'tools/checks/library-stale-while-revalidate-smoke.js',
    'tools/checks/library-async-build-v591-smoke.js',
    'tools/checks/library-route-async-build-v591-smoke.js',
    'tools/checks/library-variant-grouping-smoke.js',
    'tools/checks/library-variant-client-compat-smoke.mjs',
    'tools/checks/library-variant-api-smoke.js',
    'tools/checks/library-episode-sequence-grouping-smoke.js',
    'tools/checks/library-episode-sequence-api-smoke.js',
    'tools/checks/separate-library-reader-pages-smoke.js',
    'tools/checks/library-shelf-api-smoke.js',
    'tools/checks/library-shelf-ui-smoke.js',
    'tools/checks/library-shelf-shared-state-v585-smoke.mjs',
    'tools/checks/library-workspace-v581-smoke.js',
    'tools/checks/library-quick-header-v588-smoke.js',
    'tools/checks/metadata-access-permission-v588-smoke.js',
    'tools/checks/metadata-helper-v585-smoke.js',
    'tools/checks/owner-metadata-settings-v586-smoke.js',
    'tools/checks/owner-metadata-login-modal-v587-smoke.js',
    'tools/checks/metadata-playwright-v585-smoke.js',
    'tools/checks/metadata-pacing-v582-smoke.js',
    'tools/checks/library-navigation-filter-tree-smoke.mjs',
    'tools/checks/metadata-provider-adapters-smoke.js',
    'tools/checks/metadata-store-queue-smoke.js',
    'tools/checks/metadata-queue-persistence-v591-smoke.js',
    'tools/checks/metadata-cover-cache-smoke.js',
    'tools/checks/metadata-collection-pipeline-smoke.js',
    'tools/checks/metadata-bulk-fallback-v578-smoke.js',
    'tools/checks/metadata-live-recovery-v579-smoke.js',
    'tools/checks/full-audit-fixes-v622-smoke.js',
    'tools/checks/metadata-transport-security-smoke.js',
    'tools/checks/metadata-pinned-lookup-v580-smoke.js',
    'tools/checks/metadata-routes-access-smoke.js',
    'tools/checks/metadata-shelf-enrichment-smoke.js',
    'tools/checks/metadata-library-ui-smoke.mjs',
    'tools/checks/library-page-view-mode-v577-smoke.js',
    'tools/checks/library-tree-redesign-v577-smoke.js',
    'tools/checks/metadata-dedicated-page-v577-smoke.js',
    'tools/checks/metadata-theme-bulk-v578-smoke.js',
    'tools/checks/settings-nested-modal-stack-v577-smoke.js',
    'tools/checks/mobile-settings-v585-smoke.js',
    'tools/checks/metadata-docs-smoke.js',
    'tools/checks/library-tree-payload-budget-smoke.js',
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
    'tools/checks/deferred-ui-fragment-smoke.js',
    'tools/checks/deferred-ui-runtime-recovery-smoke.mjs',
    'tools/checks/owner-style-loader-runtime-smoke.mjs',
    'tools/checks/docker-entrypoint-wiring-smoke.js',
    'tools/checks/client-performance-metrics-smoke.js',
    'tools/checks/content-worker-retry-ux-smoke.mjs',
    'tools/checks/library-shelf-dom-budget-smoke.mjs',
    'tools/checks/library-shelf-resource-budget-smoke.mjs',
    'tools/checks/library-catalog-performance-smoke.js',
    'tools/checks/search-adaptive-listener-cleanup-v591-smoke.js',
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
    step('server structure smoke');
    run(process.execPath, ['tools/check_server_structure.js'], tmp, { timeoutMs });
    step('server http smoke');
    run(process.execPath, ['tools/smoke_server_http.js'], tmp, { timeoutMs });
    console.log(WITH_SERVER_PASS);
  }
  console.log('[release-verify] capability-blocked checks=' + blockedCapabilityCount);
  console.log(STEP_LOG_PASS);
  console.log(TIMEOUT_PASS + ' timeoutMs=' + timeoutMs);
  console.log(PASS + ' ' + path.basename(zipPath));
} finally { process.removeListener('SIGINT', handleTermination); process.removeListener('SIGTERM', handleTermination); cleanupTemp(); }
