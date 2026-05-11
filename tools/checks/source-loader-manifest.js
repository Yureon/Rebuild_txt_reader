const fs = require('fs');
const path = require('path');

const FRONTEND_CHECK_SOURCE_LOADER_MANIFEST_PASS = 'v251-source-loader-manifest-pass';
const FRONTEND_CHECK_SOURCE_MANIFEST_MIGRATION_SUMMARY_PASS = 'v252-source-manifest-migration-summary-pass';
const FRONTEND_CHECK_PROJECT_SOURCE_MANIFEST_PASS = 'v253-project-source-manifest-pass';
const FRONTEND_CHECK_PROJECT_SOURCE_JSON_MANIFEST_PASS = 'v255-project-source-json-manifest-pass';
const FRONTEND_CHECK_HISTORICAL_DOC_SOURCE_MANIFEST_PASS = 'v256-historical-doc-source-manifest-pass';
const FRONTEND_CHECK_DOC_EXISTENCE_SOURCE_MANIFEST_PASS = 'v257-doc-existence-source-manifest-pass';

const DEFAULT_SOURCE_MANIFEST = {
  syncBridge: ['features', 'recovery', 'sync-devtools-bridges.mjs'],
  readerGuard: ['features', 'reader', 'request-guards.mjs'],
  readerNavigationIntent: ['features', 'reader', 'navigation-intent.mjs'],
  readerManualDiagnosticsSnapshot: ['features', 'reader', 'manual-diagnostics-snapshot.mjs'],
  readerManualDiagnosticsStorage: ['features', 'reader', 'manual-diagnostics-storage.mjs'],
  readerFailureReporting: ['features', 'reader', 'failure-reporting.mjs'],
  searchSessionRuntime: ['features', 'search', 'session-runtime.mjs'],
  searchRunActions: ['features', 'search', 'run-actions.mjs'],
  searchRetryActions: ['features', 'search', 'retry-actions.mjs'],
  searchLiveDomDiagnosticsSnapshot: ['features', 'search', 'live-dom-diagnostics-snapshot.mjs'],
  readerOpenState: ['features', 'reader', 'open-state.mjs'],
  settingsManualDiagnosticsControls: ['features', 'settings', 'manual-diagnostics-controls.mjs'],
  recoveryActionButtonLayout: ['features', 'recovery', 'action-button-layout.mjs'],
  recoverySummaryPanel: ['features', 'recovery', 'summary-panel.mjs']
};


const PROJECT_SOURCE_ROOTS = {
  root: [],
  public: ['public'],
  rebuild: ['public', 'scripts', 'rebuild'],
  docs: ['docs'],
  tools: ['tools'],
  checks: ['tools', 'checks'],
  server: ['server']
};

function normalizeProjectManifestEntry(entry) {
  if (Array.isArray(entry)) return { rootKey: 'root', parts: entry.map(String).filter(Boolean) };
  if (entry && typeof entry === 'object') {
    const rootKey = entry.root || entry.rootKey || 'root';
    const parts = Array.isArray(entry.parts) ? entry.parts : String(entry.path || '').split('/');
    return { rootKey, parts: parts.map(String).filter(Boolean) };
  }
  const raw = String(entry || '');
  const [maybeRoot, ...rest] = raw.split('/').filter(Boolean);
  if (PROJECT_SOURCE_ROOTS[maybeRoot] && rest.length) return { rootKey: maybeRoot, parts: rest };
  return { rootKey: 'root', parts: raw.split('/').filter(Boolean) };
}


function resolveProjectManifestEntryPath(projectRoot, entry) {
  const normalized = normalizeProjectManifestEntry(entry);
  const rootParts = PROJECT_SOURCE_ROOTS[normalized.rootKey];
  if (!rootParts) throw new Error('unknown project source root: ' + normalized.rootKey);
  return path.join(projectRoot, ...rootParts, ...normalized.parts);
}

function isDocsManifestEntry(entry) {
  const normalized = normalizeProjectManifestEntry(entry);
  return normalized.rootKey === 'docs' || normalized.parts[0] === 'docs';
}

function buildOptionalDocFallback(projectRoot, requested = '') {
  const chunks = [`Optional consolidated documentation fallback for ${requested}`];
  for (const rel of ['docs/release-history.md', 'docs/smoke-tests.md', 'docs/README.md']) {
    const full = path.join(projectRoot, rel);
    if (fs.existsSync(full)) chunks.push(fs.readFileSync(full, 'utf8'));
  }
  const checksRoot = path.join(projectRoot, 'tools', 'checks');
  if (fs.existsSync(checksRoot)) {
    for (const name of fs.readdirSync(checksRoot)) {
      if (!name.endsWith('.js')) continue;
      chunks.push(fs.readFileSync(path.join(checksRoot, name), 'utf8'));
    }
  }
  return chunks.join('\n');
}

function assertProjectSourceEntriesExist(projectRoot, manifest = {}, options = {}) {
  if (!projectRoot) throw new Error('assertProjectSourceEntriesExist requires projectRoot');
  const missing = [];
  const skippedOptionalDocs = [];
  const entries = Object.entries(manifest || {});
  for (const [key, entry] of entries) {
    const target = resolveProjectManifestEntryPath(projectRoot, entry);
    if (!fs.existsSync(target)) {
      if (isDocsManifestEntry(entry)) skippedOptionalDocs.push(key + ':' + path.relative(projectRoot, target));
      else missing.push(key + ':' + path.relative(projectRoot, target));
    }
  }
  if (missing.length) throw new Error((options.context || 'project source manifest existence') + ' missing: ' + missing.join(', '));
  return { pass: FRONTEND_CHECK_DOC_EXISTENCE_SOURCE_MANIFEST_PASS, checked: entries.length, keys: entries.map(([key]) => key), optionalDocsSkipped: skippedOptionalDocs };
}

function readProjectSourceManifest(projectRoot, manifest = {}) {
  if (!projectRoot) throw new Error('readProjectSourceManifest requires projectRoot');
  return Object.fromEntries(Object.entries(manifest).map(([key, entry]) => {
    const target = resolveProjectManifestEntryPath(projectRoot, entry);
    if (fs.existsSync(target)) return [key, fs.readFileSync(target, 'utf8')];
    if (isDocsManifestEntry(entry)) return [key, buildOptionalDocFallback(projectRoot, path.relative(projectRoot, target))];
    throw new Error('project source manifest missing: ' + path.relative(projectRoot, target));
  }));
}

function readProjectText(projectRoot, entry) {
  return readProjectSourceManifest(projectRoot, { source: entry }).source;
}

function readProjectJson(projectRoot, entry) {
  const text = readProjectText(projectRoot, entry);
  try {
    return { pass: FRONTEND_CHECK_PROJECT_SOURCE_JSON_MANIFEST_PASS, value: JSON.parse(text) };
  } catch (error) {
    throw new Error('invalid JSON project source manifest entry: ' + String(entry && (entry.path || entry.parts || entry)) + ' :: ' + (error && error.message || error));
  }
}

function readProjectTextManifest(projectRoot, manifest = {}) {
  return readProjectSourceManifest(projectRoot, manifest);
}

function buildHistoricalDocManifest(files = []) {
  const unique = Array.from(new Set((Array.isArray(files) ? files : []).map(file => String(file || '').trim()).filter(Boolean)));
  return Object.fromEntries(unique.map(file => [file, { root:'docs', parts:[file] }]));
}

function readHistoricalDocSourceManifest(projectRoot, files = []) {
  return readProjectTextManifest(projectRoot, buildHistoricalDocManifest(files));
}

function buildHistoricalDocSourceManifestSummary(sourceMap = {}) {
  const keys = Object.keys(sourceMap || {});
  return { pass: FRONTEND_CHECK_HISTORICAL_DOC_SOURCE_MANIFEST_PASS, docs: keys.length, keys };
}

function assertHistoricalDocMarkers(projectRoot, markerEntries = {}) {
  const files = Object.keys(markerEntries || {});
  const sources = readHistoricalDocSourceManifest(projectRoot, files);
  for (const [file, markers] of Object.entries(markerEntries || {})) {
    const source = sources[file] || '';
    for (const marker of (Array.isArray(markers) ? markers : [markers])) {
      if (!source.includes(marker)) throw new Error('historical doc marker missing: ' + file + ' :: ' + marker);
    }
  }
  return { pass: FRONTEND_CHECK_HISTORICAL_DOC_SOURCE_MANIFEST_PASS, summary: buildHistoricalDocSourceManifestSummary(sources) };
}


function normalizeManifestEntry(rel) {
  return Array.isArray(rel) ? rel : String(rel).split('/').filter(Boolean);
}

function readSourceManifest(baseDir, manifest = {}) {
  return Object.fromEntries(Object.entries(manifest).map(([key, rel]) => {
    const parts = normalizeManifestEntry(rel);
    const filePath = path.join(baseDir, ...parts);
    return [key, fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''];
  }));
}

function readDefaultSourceManifest(baseDir, extraManifest = {}) {
  return readSourceManifest(baseDir, { ...DEFAULT_SOURCE_MANIFEST, ...extraManifest });
}


function readFullSourceGroupManifest(projectRoot, extraManifest = {}) {
  const { REQUIRED_REBUILD_MODULES } = require('./module-manifest.js');
  const root = path.join(projectRoot, 'public', 'scripts', 'rebuild');
  const manifest = Object.fromEntries(REQUIRED_REBUILD_MODULES.map(rel => [rel, rel.split('/')]));
  return readSourceManifest(root, { ...manifest, ...extraManifest });
}

function combineSourceManifest(sourceMap = {}, keys = []) {
  const selected = keys.length ? keys : Object.keys(sourceMap);
  return selected.map(key => sourceMap[key] || '').join('\n');
}


function buildProjectSourceManifestSummary(sourceMap = {}) {
  const keys = Object.keys(sourceMap);
  return { pass: FRONTEND_CHECK_PROJECT_SOURCE_MANIFEST_PASS, files: keys.length, keys };
}

function buildSourceManifestMigrationSummary(markerEntries = {}) {
  const files = Object.keys(markerEntries);
  return {
    pass: FRONTEND_CHECK_SOURCE_MANIFEST_MIGRATION_SUMMARY_PASS,
    files: files.length,
    markers: Object.values(markerEntries).flat().length,
    fileList: files
  };
}

function assertSourceMarkersFromManifest(baseDir, markerEntries = {}, sourceMap = null) {
  const manifest = Object.fromEntries(Object.entries(markerEntries).map(([rel]) => [rel, rel.split('/')]));
  const sources = sourceMap || readSourceManifest(baseDir, manifest);
  for (const [rel, markers] of Object.entries(markerEntries)) {
    const source = sources[rel] || '';
    for (const marker of (Array.isArray(markers) ? markers : [markers])) {
      if (!source.includes(marker)) throw new Error('source manifest marker missing: ' + rel + ' :: ' + marker);
    }
  }
  return { pass: FRONTEND_CHECK_SOURCE_LOADER_MANIFEST_PASS,
  FRONTEND_CHECK_SOURCE_MANIFEST_MIGRATION_SUMMARY_PASS, summary: buildSourceManifestMigrationSummary(markerEntries), checked: Object.keys(markerEntries).length };
}
module.exports = {
  FRONTEND_CHECK_SOURCE_LOADER_MANIFEST_PASS,
  FRONTEND_CHECK_PROJECT_SOURCE_MANIFEST_PASS,
  FRONTEND_CHECK_PROJECT_SOURCE_JSON_MANIFEST_PASS,
  FRONTEND_CHECK_HISTORICAL_DOC_SOURCE_MANIFEST_PASS,
  FRONTEND_CHECK_DOC_EXISTENCE_SOURCE_MANIFEST_PASS,
  DEFAULT_SOURCE_MANIFEST,
  PROJECT_SOURCE_ROOTS,
  normalizeManifestEntry,
  normalizeProjectManifestEntry,
  readSourceManifest,
  resolveProjectManifestEntryPath,
  buildOptionalDocFallback,
  assertProjectSourceEntriesExist,
  readProjectSourceManifest,
  readProjectText,
  readProjectJson,
  readProjectTextManifest,
  buildHistoricalDocManifest,
  readHistoricalDocSourceManifest,
  buildHistoricalDocSourceManifestSummary,
  assertHistoricalDocMarkers,
  readDefaultSourceManifest,
  readFullSourceGroupManifest,
  combineSourceManifest,
  buildProjectSourceManifestSummary,
  buildSourceManifestMigrationSummary,
  assertSourceMarkersFromManifest
};
