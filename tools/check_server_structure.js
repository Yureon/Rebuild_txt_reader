const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { runServerStateNormalizerSmoke } = require('./checks/server-state-normalizer-smoke.js');
const { runServerServiceBoundarySmoke } = require('./checks/server-service-boundary-smoke.js');
const { runServerContentPreprocessSmoke } = require('./checks/server-content-preprocess-smoke.js');
const { runServerLibraryServiceDirectSmoke } = require('./checks/server-library-service-smoke.js');
const { runServerFontServiceDirectSmoke } = require('./checks/server-font-service-smoke.js');
const { runServerFileopsServiceBoundarySmoke } = require('./checks/server-fileops-service-smoke.js');
const { runServerMiddlewareDirectSmoke } = require('./checks/server-middleware-smoke.js');
const { runServerRouteDirectSmoke } = require('./checks/server-route-smoke.js');
const { runServerDiagnosticsBlockManifestServiceSmoke } = require('./checks/server-diagnostics-block-manifest-service-smoke.js');
const { runServerSmokeFixtureCoverageSmoke } = require('./checks/server-smoke-fixture-coverage-smoke.js');
const { runServerRouteHandlerNegativeSmoke } = require('./checks/server-route-handler-negative-smoke.js');
const { runServerAuthConfigSmoke } = require('./checks/server-auth-config-smoke.js');
const { runSessionCookieHostPrefixSmoke } = require('./checks/session-cookie-host-prefix-smoke.js');
const { runProductionPasswordPolicySmoke } = require('./checks/production-password-policy-smoke.js');
const { runLibraryDeepSignatureCacheSmoke } = require('./checks/library-deep-signature-cache-smoke.js');
const { runPrecompressedStaticSmoke } = require('./checks/precompressed-static-smoke.js');
const { runDocsConsolidationSmoke } = require('./checks/docs-consolidation-smoke.js');
const { runContentCacheRawTextSmoke } = require('./checks/content-cache-rawtext-smoke.js');

const root = path.join(__dirname, '..');
const required = [
  '.dockerignore',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.example.yml',
  'tools/smoke_server_http.js',
  'tools/checks/server-state-normalizer-smoke.js',
  'tools/checks/server-service-boundary-smoke.js',
  'tools/checks/server-content-preprocess-smoke.js',
  'tools/checks/server-library-service-smoke.js',
  'tools/checks/server-font-service-smoke.js',
  'tools/checks/server-fileops-service-smoke.js',
  'tools/checks/server-middleware-smoke.js',
  'tools/checks/server-route-smoke.js',
  'tools/checks/server-smoke-assertions.js',
  'tools/checks/server-smoke-fixtures.js',
  'tools/checks/server-diagnostics-block-manifest-service-smoke.js',
  'tools/checks/server-smoke-fixture-coverage-smoke.js',
  'tools/checks/server-route-handler-negative-smoke.js',
  'tools/checks/server-auth-config-smoke.js',
  'tools/checks/session-cookie-host-prefix-smoke.js',
  'tools/checks/production-password-policy-smoke.js',
  'tools/checks/library-deep-signature-cache-smoke.js',
  'tools/checks/precompressed-static-smoke.js',
  'tools/checks/docs-consolidation-smoke.js',
  'tools/checks/content-cache-rawtext-smoke.js',
  'tools/checks/latest-doc-index-guard.js',
  'server.js',
  'server/bootstrap.js',
  'server/app.js',
  'server/node-launcher.js',
  'server/config/env.js',
  'server/config/paths.js',
  'server/config/runtime-dirs.js',
  'server/config/origins.js',
  'server/middleware/auth.js',
  'server/middleware/cache-policy.js',
  'server/middleware/security.js',
  'server/middleware/precompressed-static.js',
  'server/services/rate-limit.js',
  'server/services/session-store.js',
  'server/services/sync-state-service.js',
  'server/services/state-normalizer.js',
  'server/services/state-device-profile-cap.js',
  'server/services/state-normalizer-sync-policy.js',
  'server/services/state-normalizer-progress.js',
  'server/services/state-normalizer-theme.js',
  'server/services/state-normalizer-core.js',
  'server/services/state-normalizer-lists.js',
  'server/services/state-normalizer-validation.js',
  'server/services/state-normalizer-sync-meta.js',
  'server/services/state-normalizer-merge.js',
  'server/services/state-write-service.js',
  'server/services/sync-policy-service.js',
  'server/services/content-service.js',
  'server/services/streaming-normalized-content-builder.js',
  'server/services/library-service.js',
  'server/services/library-variant-service.js',
  'server/services/metadata-site-adapters.js',
  'server/services/metadata-search-terms.js',
  'server/services/metadata-provider-registry.js',
  'server/services/metadata-transport-service.js',
  'server/services/metadata-playwright-service.js',
  'server/services/metadata-browser-capture-service.js',
  'server/services/metadata-store-service.js',
  'server/services/metadata-cover-service.js',
  'server/services/metadata-queue-service.js',
  'server/services/metadata-service.js',
  'server/services/fileops-service.js',
  'server/services/font-service.js',
  'server/services/recovery-service.js',
  'server/services/block-manifest-service.js',
  'server/repositories/json-file-store.js',
  'server/routes/auth-routes.js',
  'server/routes/state-routes.js',
  'server/routes/novels-routes.js',
  'server/routes/metadata-routes.js',
  'server/routes/fileops-routes.js',
  'server/routes/font-routes.js',
  'server/routes/recovery-routes.js',
  'server/routes/diagnostics-routes.js',
  'server/routes/block-manifest-routes.js',
  'server/routes/user-access-routes.js',
  'server/utils/object.js',
  'server/utils/stable-id.js'
];

for (const rel of required) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing server module: ${rel}`);
  }
  if (!/\.m?js$/.test(rel)) continue;
  const source = fs.readFileSync(full, 'utf8');
  try {
    new vm.Script(source, { filename: rel });
  } catch (error) {
    throw new Error(`Syntax check failed for ${rel}\n${error && error.stack || error}`);
  }
}

const serverJs = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const directBootstrap = serverJs.includes("./server/bootstrap");
const nodeLauncherBootstrap = serverJs.includes("./server/node-launcher");
if (!directBootstrap && !nodeLauncherBootstrap) {
  throw new Error('server.js must remain a bootstrap shim.');
}
if (nodeLauncherBootstrap) {
  const nodeLauncherJs = fs.readFileSync(path.join(root, 'server/node-launcher.js'), 'utf8');
  if (!nodeLauncherJs.includes("require('./bootstrap')")) {
    throw new Error('server/node-launcher.js must delegate to bootstrap.');
  }
}

const appJs = fs.readFileSync(path.join(root, 'server/app.js'), 'utf8');
if (!appJs.includes('module.exports') || !appJs.includes('function start(')) {
  throw new Error('server/app.js must export app/start.');
}

const forbiddenInline = [
  "app.post('/api/login'",
  "app.get('/api/user-state'",
  "app.put('/api/user-state/shared'",
  'function requireCsrf(',
  'function requireSameOrigin(',
  'function checkLoginLimit(',
  'const csrfTokens = new Map()',
  'const sessions = new Map()',
  'function readFileAutoEncoding(',
  'function buildLibrary(',
  "app.get('/api/novels'",
  "app.get('/api/novels/:novelId/content'",
  "app.patch('/api/folders/rename'",
  "app.patch('/api/novels/:novelId/move'",
  "app.patch('/api/episodes/:novelId/:episodeId/move'",
  "app.patch('/api/folders/move'",
  "app.patch('/api/novels/:novelId/episodes/:episodeId/rename'",
  "app.delete('/api/novels/:novelId/episodes/:episodeId'",
  "app.delete('/api/folders'",
  "app.get('/api/fonts'",
  "app.post('/api/fonts/upload'",
  "app.delete('/api/fonts/:filename'",
  "app.get('/api/fonts/file/:filename'",
  "app.get('/api/recovery-status'",
  "app.get('/api/time'",
  "app.get('/api/novels/:novelId/block-manifest'",
  "app.get('/api/novels/:novelId/episodes/:episodeId/block-manifest'",
  'function normalizeUserState(',
  'function validateSharedState(',
  'function mergeSharedState(',
  'function mergeDeviceState(',
  'function getSyncData()',
  'function setSyncData()',
  'function saveSyncData()',
  'function buildSyncPolicySummary(',
  'function evaluateDeviceWrite('
];
for (const token of forbiddenInline) {
  if (appJs.includes(token)) {
    throw new Error(`server/app.js still contains inline implementation: ${token}`);
  }
}

runServerStateNormalizerSmoke(require(path.join(root, 'server/services/state-normalizer.js')));
runServerServiceBoundarySmoke(root);
runServerLibraryServiceDirectSmoke(root);
runServerFontServiceDirectSmoke(root);
runServerFileopsServiceBoundarySmoke(root);
runServerMiddlewareDirectSmoke(root);
runServerRouteDirectSmoke(root);
runServerAuthConfigSmoke(root);
runSessionCookieHostPrefixSmoke();
runProductionPasswordPolicySmoke();
runPrecompressedStaticSmoke(root);
runDocsConsolidationSmoke(root);
runServerSmokeFixtureCoverageSmoke();

(async () => {
  await runServerContentPreprocessSmoke(root);
  await runContentCacheRawTextSmoke(root);
  await runLibraryDeepSignatureCacheSmoke(root);
  await runServerRouteHandlerNegativeSmoke(root);
  await runServerDiagnosticsBlockManifestServiceSmoke(root);

  const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
  for (const token of ['COPY --chown=node:node server ./server', 'COPY --chown=node:node public ./public', 'COPY --chown=node:node site-language-packs ./site-language-packs']) {
    if (!dockerfile.includes(token)) throw new Error(`Dockerfile is missing required copy step: ${token}`);
  }
  if (dockerfile.includes('COPY --chown=node:node tools ./tools')) {
    throw new Error('Dockerfile must keep release and smoke tools outside the production image');
  }
  for (const token of ['HEALTHCHECK --interval=30s', 'npm cache clean --force', 'chown -R node:node /app /library']) {
    if (!dockerfile.includes(token)) throw new Error(`Dockerfile production guard missing: ${token}`);
  }
  if (!/USER\s+(?:node|1000:0)\b/.test(dockerfile)) {
    throw new Error('Dockerfile production guard missing: non-root USER node or USER 1000:0');
  }

  const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
  for (const token of ['build: .', 'PORT=3000', '${LIBRARY_PATH}:/library:${LIBRARY_MOUNT_MODE:-ro}', 'read_only: true', 'cap_drop:', 'no-new-privileges:true']) {
    if (!compose.includes(token)) throw new Error(`docker-compose.yml is missing required runtime/build guard: ${token}`);
  }
  if (compose.includes('npm install')) throw new Error('docker-compose.yml must not run npm install at container start after v530');

  console.log(`Server module structure OK (${required.length} modules checked).`);
  process.exit(0);
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
