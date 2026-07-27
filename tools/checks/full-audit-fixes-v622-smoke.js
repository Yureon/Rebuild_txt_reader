#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const PASS = 'v622-full-audit-fixes-smoke-pass';

const composeFiles = ['docker-compose.yml','docker-compose.example.yml','docker-compose.cloudflare-tunnel.example.yml'];
for (const rel of composeFiles) {
  const source = read(rel);
  assert(source.includes('METADATA_AUTO_APPLY_THRESHOLD=${METADATA_AUTO_APPLY_THRESHOLD:-0.95}'), rel + ' threshold');
  assert(source.includes('METADATA_PLAYWRIGHT_NO_SANDBOX=${METADATA_PLAYWRIGHT_NO_SANDBOX:-0}'), rel + ' sandbox default');
}
assert(read('docker-compose.yml').includes('${TXT_READER_BIND_ADDRESS:-0.0.0.0}:${PORT:-3000}:3000'));
assert(read('docker-compose.example.yml').includes('${TXT_READER_BIND_ADDRESS:-0.0.0.0}:${PORT:-3000}:3000'));
const tunnel = read('docker-compose.cloudflare-tunnel.example.yml');
assert(tunnel.includes('HOST=0.0.0.0'));
assert(!/^\s+ports:/m.test(tunnel));
assert(tunnel.includes('cloudflare/cloudflared:2026.7.2'));
assert(read('Dockerfile').includes('FROM node:20.20.2-bookworm-slim'));

const sw = read('public/sw.js');
const swRegister = read('public/scripts/service-worker-register.js');
assert(sw.includes("TXT_READER_SKIP_WAITING"));
assert(!/install[\s\S]{0,300}skipWaiting\(/.test(sw), 'install must not activate without approval');
assert(sw.includes('AbortController') && sw.includes('8000'));
assert(swRegister.includes('__TXT_READER_REQUIRE_UPDATE__'));
assert(swRegister.includes('activationAttempt'));
assert(swRegister.includes('scheduleReload'));
assert(swRegister.includes('controllerchange'));
assert(swRegister.includes('v638-service-worker-update-coordination-pass'));
for (const rel of ['server/middleware/cache-policy.js','public/scripts/rebuild/core/feature-fragments.mjs','public/scripts/rebuild/features/search/matcher.mjs']) {
  const source = read(rel);
  assert(!source.includes('location.reload()'), rel + ' must not force mismatch reload');
}

const playwright = read('server/services/metadata-playwright-service.js');
assert(playwright.includes("context.route('**/*'"));
assert(playwright.includes("serviceWorkers:'block'"));
assert(playwright.includes('resolvePublicAddresses'));
assert(playwright.includes('runProfileMaintenance'));
assert(playwright.includes('profileQuotaExceeded'));

const authRoutes = read('server/routes/auth-routes.js');
assert(authRoutes.includes('passwordChangeLimiter'));
assert(authRoutes.includes('passwordChangeIpLimiter'));
assert(authRoutes.includes('auth.password_change.rate_limited'));
const account = read('server/services/account-service.js');
const passwordStart = account.indexOf('async function changePasswordAsync');
const passwordSection = account.slice(passwordStart, passwordStart + 3000);
assert(passwordSection.indexOf('verifyPasswordAsync(currentPassword') < passwordSection.indexOf('verifyPasswordAsync(newPassword'), 'current password must be verified first');

const metadataService = read('server/services/metadata-service.js');
assert(metadataService.includes('autoApplyThresholdPercent'));
assert(!metadataService.includes("reason:'confidence_95'"));
for (const rel of ['public/scripts/admin/metadata.mjs','public/scripts/rebuild/features/library-metadata-runtime.mjs','public/scripts/rebuild/metadata-page.mjs']) {
  const source = read(rel);
  assert(source.includes('autoApplyThresholdPercent'), rel + ' dynamic threshold');
}

const policy = require('../../server/services/network-address-policy');
assert.equal(policy.isPublicAddress('8.8.8.8'), true);
for (const ip of ['::ffff:7f00:1','::7f00:1','ff02::1','fec0::1','127.0.0.1','169.254.1.1']) assert.equal(policy.isPublicAddress(ip), false, ip);

const periodicSync = read('public/scripts/rebuild/features/sync/periodic-device-sync.mjs');
assert(periodicSync.includes('consecutiveFailures'));
assert(periodicSync.includes('nextRetryAt'));
assert(periodicSync.includes('txt-reader:periodic-sync-error'));
assert(read('public/scripts/rebuild/features/sync/periodic-state-push.mjs').includes('Promise.allSettled'));

const coverModule = require('../../server/services/metadata-cover-service');
const avif = Buffer.alloc(32);
avif.writeUInt32BE(32, 0); avif.write('ftyp', 4, 'ascii'); avif.write('mif1', 8, 'ascii'); avif.writeUInt32BE(0, 12); avif.write('avif', 16, 'ascii');
assert.equal(coverModule.detectImage(avif, 'application/octet-stream').ext, 'avif');
const coverSource = read('server/services/metadata-cover-service.js');
for (const token of ['maxCacheBytes','minOrphanAgeMs','maxDeletePerRun','isAssetReferenced','pruneCache','startup','postWritePruneMinIntervalMs']) assert(coverSource.includes(token), token);

const routes = read('server/routes/metadata-routes.js');
assert(routes.includes('classifyMetadataError'));
assert(routes.includes("status:503") && routes.includes("status:429") && routes.includes('Retry-After'));

const transportSource = read('server/services/metadata-transport-service.js');
assert(transportSource.includes('v622-metadata-transport-security-pass'));
assert(read('tools/checks/metadata-transport-security-smoke.js').includes('staticAssertions:true'));
const runner = read('tools/run_smoke_tests.js');
assert(runner.includes('SMOKE_ALLOW_DEPENDENCY_BLOCKS'));
assert(runner.includes('allowDependencyBlocks'));

const fileops = read('server/services/fileops-service.js');
assert(fileops.includes('v627-fileops-stable-path-lock-pass'));
assert(fileops.includes('activeMutations'));
assert(fileops.includes('pathsConflict'));
assert(!fileops.includes('mutationTail'));

assert(read('public/scripts/rebuild/state/app-state.mjs').includes('shortcut-model.mjs'));
assert(!read('public/scripts/rebuild/state/app-state.mjs').includes("settings/shortcuts.mjs"));
assert(fs.existsSync(path.join(root, 'public/scripts/rebuild/features/settings/shortcut-model.mjs')));

const securityDoc = read('docs/security.md');
const diagnosticsDoc = read('docs/production-diagnostics.md');
assert(securityDoc.includes("style-src-attr 'none'"));
assert(!securityDoc.includes("현재 `style-src 'unsafe-inline'`은 유지"));
assert(diagnosticsDoc.includes("style-src-attr 'none'"));

const packager = require('../package_rebuild');
const { CURRENT_REBUILD_VERSION_NUMBER } = require('./current-rebuild-version');
assert.equal(packager.isHistoricalPackageManifest(`package-manifest-v${CURRENT_REBUILD_VERSION_NUMBER - 1}.json`, CURRENT_REBUILD_VERSION_NUMBER), true);
assert.equal(packager.isHistoricalPackageManifest(`package-manifest-v${CURRENT_REBUILD_VERSION_NUMBER}.json`, CURRENT_REBUILD_VERSION_NUMBER), false);
for (const rel of fs.readdirSync(path.join(root, 'public/icon'))) {
  assert(!/\.(?:png|ico)\.(?:br|gz)$/i.test(rel), 'incompressible icon sidecar remains: ' + rel);
}
const precompress = read('tools/generate_precompressed_assets.js');
assert(precompress.includes('STALE_SIDECAR_SOURCE_EXTENSIONS'));
assert(precompress.includes('asset is not eligible for precompression'));

const content = read('server/services/content-service.js');
const contentReturn = content.slice(content.lastIndexOf('  return {'), content.lastIndexOf('module.exports'));
assert(!contentReturn.includes('getCachedFileContent'));
assert(!contentReturn.includes('getCachedFileEntry,'));
assert(!contentReturn.includes('getChunkByLine,'));
assert(read('server/services/block-manifest-service.js').includes('ASYNC_CONTENT_READER_REQUIRED'));

assert(Number(JSON.parse(read('package.json')).version.split('.')[1]) >= 23);
assert(Number(JSON.parse(read('package-lock.json')).version.split('.')[1]) >= 23);
assert.equal(JSON.parse(read('package-lock.json')).packages['node_modules/unpipe'].version, '1.0.0');
const auth = read('server/middleware/auth.js');
assert(!/allowedOrigins\s*[:}]/.test(auth), 'raw allowlist must not be serialized');
assert(auth.includes('configuredOrigins:allowedOrigins.length'));
const font = read('server/services/font-service.js');
assert(font.includes('cleanupWarnings'));
assert(font.includes('FONT_DELETE_ROLLBACK_FAILED'));

console.log(JSON.stringify({ pass:PASS, findings:27 }));
