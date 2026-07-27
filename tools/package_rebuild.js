const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const { parseRebuildDocScaffoldArgs, writeRebuildDocs } = require('./rebuild_doc_scaffold.js');
const { normalizeArchiveEntryName, detectArchiveFormat, inspectArchiveBeforeExtract } = require('./archive-safety.js');

const REBUILD_PACKAGE_SCRIPT_PASS = 'v251-rebuild-package-script-pass';
const REBUILD_PACKAGE_ZIP_GUARD_PASS = 'v251-rebuild-package-zip-guard-pass';
const REBUILD_PACKAGE_MANIFEST_PASS = 'v251-rebuild-package-manifest-pass';
const REBUILD_PACKAGE_RELEASE_NOTE_PASS = 'v251-rebuild-package-release-note-pass';
const REBUILD_PACKAGE_HANDOFF_SUMMARY_PASS = 'v252-rebuild-package-handoff-summary-pass';
const REBUILD_PACKAGE_CHANGED_FILE_GROUPS_PASS = 'v253-rebuild-package-changed-file-groups-pass';
const REBUILD_PACKAGE_MANIFEST_DIFF_PASS = 'v254-rebuild-package-manifest-diff-pass';
const REBUILD_PACKAGE_MANIFEST_FILE_DIFF_PASS = 'v255-rebuild-package-manifest-file-diff-pass';
const REBUILD_PACKAGE_MANIFEST_MODIFIED_FILE_DIFF_PASS = 'v256-rebuild-package-manifest-modified-file-diff-pass';
const REBUILD_PACKAGE_CSS_OWNERSHIP_REPORT_PLAN_PASS = 'v256-rebuild-package-css-ownership-report-plan-pass';
const REBUILD_PACKAGE_MANIFEST_DIFF_DOC_PASS = 'v257-rebuild-package-manifest-diff-doc-pass';
const REBUILD_PACKAGE_ZIP_ENTRY_AUDIT_PASS = 'v279-rebuild-package-zip-entry-audit-pass';
const REBUILD_PACKAGE_CHANGED_FILE_EXISTS_AUDIT_PASS = 'v279-rebuild-package-changed-file-exists-audit-pass';
const REBUILD_PACKAGE_GENERATED_DOCS_AUDIT_PASS = 'v279-rebuild-package-generated-docs-audit-pass';
const PACKAGE_LOCK_REGULAR_FILE_PASS = 'v532-package-lock-regular-file-pass';
const STALE_RELEASE_ARTIFACT_GATE_PASS = 'v661-stale-release-artifact-gate-pass';
const DEFAULT_PACKAGE_EXCLUDES = ['node_modules', 'dist', '.cache', '.git', 'data', 'normalized_content', 'sync_data.json', 'sync_data.json.bak', 'test_novels', '.npm-cache', 'pnpm-lock.yaml', 'docs/archive', '*.zip'];
const DEFAULT_PACKAGE_MANIFEST_DIR = path.join('docs', 'package-manifests');

function isHistoricalPackageManifest(relPath = '', currentVersion = 0) {
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\.\//, '');
  const match = rel.match(/^(?:docs\/package-manifests\/)?package-manifest-v(\d+)\.json$/);
  return Boolean(match && Number(match[1]) !== Number(currentVersion));
}

function collectHistoricalPackageManifestPaths(projectRoot, currentVersion = 0) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(projectRoot, full).replace(/\\/g, '/');
      if (entry.isDirectory()) { walk(full); continue; }
      if (entry.isFile() && isHistoricalPackageManifest(rel, currentVersion)) out.push(rel);
    }
  };
  walk(projectRoot);
  return out.sort();
}


function releaseArtifactVersion(relPath = '') {
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (rel.includes('/')) return 0;
  const patterns = [
    /^txt_reader_v(\d+)_(?:change_report|validation|session_handoff_prompt|full_project_audit|deep_bug_audit|predeploy[^.]*)\.(?:md|json|log)$/u,
    /^v(\d+)_(?:final_independent_verification|release_artifact_sha256|[^.]*validation_report|[^.]*code_inspection_report|[^.]*audit_report|[^.]*browser[^.]*results|[^.]*parallel_results)\.(?:md|json|txt|log)$/u,
    /^dependency-inventory-v(\d+)\.json$/u,
    /^package-manifest-diff-v(\d+)\.md$/u,
    /^package-manifest-v(\d+)\.json$/u
  ];
  for (const pattern of patterns) {
    const match = rel.match(pattern);
    if (match) return Number(match[1]) || 0;
  }
  return 0;
}

function isHistoricalReleaseArtifact(relPath = '', currentVersion = 0) {
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\.\//, '');
  const version = releaseArtifactVersion(rel);
  if (version) return version !== Number(currentVersion);
  return /^(?:v\d+_[^/]*\.log|txt_reader_v\d+[^/]*\.log)$/u.test(rel);
}

function collectHistoricalReleaseArtifactPaths(projectRoot, currentVersion = 0) {
  return fs.readdirSync(projectRoot, { withFileTypes:true })
    .filter(entry => entry.isFile() && isHistoricalReleaseArtifact(entry.name, currentVersion))
    .map(entry => entry.name)
    .sort();
}

function assertNoHistoricalReleaseArtifacts(projectRoot, currentVersion = 0) {
  const stale = collectHistoricalReleaseArtifactPaths(projectRoot, currentVersion);
  if (stale.length) {
    const error = new Error(`stale release artifacts must be removed before packaging: ${stale.join(', ')}`);
    error.code = 'STALE_RELEASE_ARTIFACTS';
    error.pass = STALE_RELEASE_ARTIFACT_GATE_PASS;
    error.paths = stale;
    throw error;
  }
  return { ok:true, pass:STALE_RELEASE_ARTIFACT_GATE_PASS, currentVersion:Number(currentVersion), stale:[] };
}


function classifyChangedFileGroup(filePath = '') {
  const rel = String(filePath || '').replace(/^\.\//, '');
  if (rel.startsWith('public/scripts/rebuild/features/recovery/')) return 'frontend:recovery';
  if (rel.startsWith('public/scripts/rebuild/features/reader/')) return 'frontend:reader';
  if (rel.startsWith('public/scripts/rebuild/features/search/')) return 'frontend:search';
  if (rel.startsWith('public/scripts/rebuild/features/settings/')) return 'frontend:settings';
  if (rel === 'public/site.html' || rel === 'public/mobile.html' || rel === 'public/index.html') return 'frontend:entrypoints';
  if (rel === 'public/manifest.json' || rel.startsWith('public/icon/') || rel === 'public/browserconfig.xml') return 'frontend:pwa';
  if (rel === 'Dockerfile' || rel === '.dockerignore' || rel.startsWith('docker-compose')) return 'infra:docker';
  if (rel.startsWith('public/scripts/rebuild/')) return 'frontend:runtime';
  if (rel.startsWith('public/styles/') || rel.startsWith('public/fragments/')) return 'frontend:shell-css';
  if (rel.startsWith('server/')) return 'server';
  if (rel.startsWith('tools/checks/server-') || rel === 'tools/check_server_structure.js') return 'tools:server-checks';
  if (rel.startsWith('tools/checks/') || rel.startsWith('tools/check_')) return 'tools:frontend-checks';
  if (rel.startsWith('tools/fixtures/')) return 'tools:fixtures';
  if (rel.startsWith('tools/')) return 'tools:packaging';
  if (rel.startsWith('docs/')) return 'docs';
  if (/^package-manifest-v\d+\.json$/.test(rel)) return 'manifest';
  return 'other';
}

function getPackageManifestRelPath(version) {
  return path.join(DEFAULT_PACKAGE_MANIFEST_DIR, `package-manifest-v${Number(version)}.json`).replace(/\\/g, '/');
}

function buildChangedFileGroups(changedFiles = []) {
  const files = Array.from(new Set((Array.isArray(changedFiles) ? changedFiles : []).map(file => String(file || '').trim()).filter(Boolean))).sort();
  const groups = {};
  for (const file of files) {
    const group = classifyChangedFileGroup(file);
    if (!groups[group]) groups[group] = [];
    groups[group].push(file);
  }
  return { pass: REBUILD_PACKAGE_CHANGED_FILE_GROUPS_PASS, total: files.length, groups };
}

function buildPackageManifestDiffSummary(currentManifest = {}, previousManifest = null) {
  const previous = previousManifest && typeof previousManifest === 'object' ? previousManifest : null;
  const currentInventory = Array.isArray(currentManifest.files) ? currentManifest.files : null;
  const previousInventory = Array.isArray(previous?.files) ? previous.files : null;
  if (currentInventory && previousInventory) {
    const before = new Map(previousInventory.map(file => [String(file.path || ''), file]));
    const after = new Map(currentInventory.map(file => [String(file.path || ''), file]));
    const addedFiles = Array.from(after.keys()).filter(file => file && !before.has(file)).sort();
    const removedFiles = Array.from(before.keys()).filter(file => file && !after.has(file)).sort();
    const modifiedFiles = Array.from(after.keys()).filter((file) => {
      if (!file || !before.has(file)) return false;
      const left = before.get(file) || {};
      const right = after.get(file) || {};
      return Number(left.bytes || 0) !== Number(right.bytes || 0) || String(left.sha256 || '') !== String(right.sha256 || '');
    }).sort();
    const changed = [...addedFiles, ...modifiedFiles];
    const grouped = buildChangedFileGroups(changed).groups;
    const groupCounts = Object.fromEntries(Object.entries(grouped).map(([group, files]) => [group, files.length]));
    const modifiedFileGroups = buildChangedFileGroups(modifiedFiles).groups;
    return {
      pass: `v${Number(currentManifest.version || 0)}-actual-file-diff-pass`,
      comparedWith: previous?.version || null,
      versionDelta: previous?.version ? Number(currentManifest.version || 0) - Number(previous.version || 0) : null,
      docDelta: Number((currentManifest.docs || []).length) - Number((previous?.docs || []).length || 0),
      groupCounts,
      fileDiffPass: REBUILD_PACKAGE_MANIFEST_FILE_DIFF_PASS,
      addedFiles,
      removedFiles,
      modifiedFileDiffPass: REBUILD_PACKAGE_MANIFEST_MODIFIED_FILE_DIFF_PASS,
      modifiedFiles,
      modifiedFileGroups,
      addedCount: addedFiles.length,
      removedCount: removedFiles.length,
      modifiedCount: modifiedFiles.length,
      previousFileName: previous?.fileName || ''
    };
  }
  const previousGroups = previous?.changedFileGroups?.groups || {};
  const currentGroups = currentManifest.changedFileGroups?.groups || {};
  const groupKeys = Array.from(new Set([...Object.keys(previousGroups), ...Object.keys(currentGroups)])).sort();
  const previousFiles = new Set(Object.values(previousGroups).flat().map(String));
  const currentFiles = new Set(Object.values(currentGroups).flat().map(String));
  const addedFiles = Array.from(currentFiles).filter(file => !previousFiles.has(file)).sort();
  const removedFiles = Array.from(previousFiles).filter(file => !currentFiles.has(file)).sort();
  const modifiedFiles = Array.from(currentFiles).filter(file => previousFiles.has(file)).sort();
  const modifiedFileGroups = Object.fromEntries(groupKeys.map((key) => {
    const before = new Set(Array.isArray(previousGroups[key]) ? previousGroups[key] : []);
    const after = Array.isArray(currentGroups[key]) ? currentGroups[key] : [];
    return [key, after.filter(file => before.has(file)).sort()];
  }).filter(([, files]) => files.length));
  const groupDelta = Object.fromEntries(groupKeys.map((key) => {
    const before = Array.isArray(previousGroups[key]) ? previousGroups[key].length : 0;
    const after = Array.isArray(currentGroups[key]) ? currentGroups[key].length : 0;
    return [key, { before, after, delta: after - before }];
  }));
  return {
    pass: REBUILD_PACKAGE_MANIFEST_DIFF_PASS,
    comparedWith: previous?.version || null,
    versionDelta: previous?.version ? Number(currentManifest.version || 0) - Number(previous.version || 0) : null,
    docDelta: Number((currentManifest.docs || []).length) - Number((previous?.docs || []).length || 0),
    groupDelta,
    fileDiffPass: REBUILD_PACKAGE_MANIFEST_FILE_DIFF_PASS,
    addedFiles,
    removedFiles,
    modifiedFileDiffPass: REBUILD_PACKAGE_MANIFEST_MODIFIED_FILE_DIFF_PASS,
    modifiedFiles,
    modifiedFileGroups,
    addedCount: addedFiles.length,
    removedCount: removedFiles.length,
    modifiedCount: modifiedFiles.length,
    previousFileName: previous?.fileName || ''
  };
}

function parseChangedFilesArgs(argv = []) {
  const out = [];
  for (const arg of argv) {
    if (arg.startsWith('--changed-file=')) out.push(arg.split('=').slice(1).join('='));
    if (arg.startsWith('--changed-files=')) out.push(...arg.split('=').slice(1).join('=').split(/[|,]/));
  }
  return out.map(item => item.trim()).filter(Boolean);
}

function assertChangedFileEntriesExist(projectRoot, changedFiles = [], options = {}) {
  const files = Array.from(new Set((Array.isArray(changedFiles) ? changedFiles : [])
    .map(file => String(file || '').trim()).filter(Boolean)
    .map(file => normalizeArchiveEntryName(file).replace(/\/$/, '')).filter(Boolean))).sort();
  if (options.dryRun) return { pass: REBUILD_PACKAGE_CHANGED_FILE_EXISTS_AUDIT_PASS, checked: files.length, missing: 0, skipped: true };
  const missing = files.filter(file => !fs.existsSync(path.join(projectRoot, file)));
  if (missing.length) throw new Error('changed-file entries missing before packaging: ' + missing.join(', '));
  return { pass: REBUILD_PACKAGE_CHANGED_FILE_EXISTS_AUDIT_PASS, checked: files.length, missing: 0, skipped: false };
}

function collectGeneratedDocRequiredEntries(manifest = {}) {
  return Array.from(new Set([
    ...(Array.isArray(manifest.docs) ? manifest.docs : []),
    manifest.releaseNotes || '',
    manifest.manifestPath || (manifest.version ? getPackageManifestRelPath(manifest.version) : '')
  ].map(item => String(item || '').trim()).filter(Boolean)
    .map(item => normalizeArchiveEntryName(item).replace(/\/$/, '')).filter(Boolean))).sort();
}

function assertGeneratedDocsAudit(projectRoot, manifest = {}, options = {}) {
  const entries = collectGeneratedDocRequiredEntries(manifest);
  if (options.dryRun) return { pass: REBUILD_PACKAGE_GENERATED_DOCS_AUDIT_PASS, checked: entries.length, missing: [], skipped: true };
  const missing = entries.filter(entry => !fs.existsSync(path.join(projectRoot, entry)));
  if (missing.length) throw new Error('generated docs audit missing entries: ' + missing.join(', '));
  return { pass: REBUILD_PACKAGE_GENERATED_DOCS_AUDIT_PASS, checked: entries.length, missing: [], skipped: false };
}

function buildPackageManifest(options = {}) {
  const version = Number(options.version);
  if (!Number.isInteger(version)) throw new Error('package_rebuild requires --version=N');
  const cacheVersion = options.cacheVersion || `rebuild-v${version}`;
  const fileName = options.fileName || `txt_reader_v${version}.zip`;
  const changedFiles = Array.isArray(options.changedFiles) ? options.changedFiles : [];
  const changedFileGroups = buildChangedFileGroups(changedFiles);
  const consolidatedRelease = options.consolidatedRelease === true;
  const defaultDocs = [
    `docs/rebuild-phase${version}.md`,
    `docs/latest-doc-index-v${version}.md`,
    `docs/code-separation-remaining-estimate-v${version}.md`,
    `docs/worklist-v${version}.md`,
    `docs/css-app-shell-ownership-report-v${version}.md`,
    `docs/package-manifest-diff-v${version}.md`
  ];
  const manifestPath = String(options.manifestPath || (consolidatedRelease ? `package-manifest-v${version}.json` : getPackageManifestRelPath(version))).replace(/\\/g, '/');
  const releaseNotes = String(options.releaseNotes || (consolidatedRelease ? `txt_reader_v${version}_change_report.md` : `docs/release-notes-v${version}.md`)).replace(/\\/g, '/');
  const manifestDiffDoc = String(options.manifestDiffDoc || (consolidatedRelease ? `package-manifest-diff-v${version}.md` : `docs/package-manifest-diff-v${version}.md`)).replace(/\\/g, '/');
  const manifest = {
    pass: REBUILD_PACKAGE_SCRIPT_PASS,
    manifestPass: REBUILD_PACKAGE_MANIFEST_PASS,
    zipGuardPass: REBUILD_PACKAGE_ZIP_GUARD_PASS,
    version,
    cacheVersion,
    fileName,
    docs: Array.from(new Set([
      ...(consolidatedRelease ? [] : defaultDocs),
      ...(Array.isArray(options.extraDocs) ? options.extraDocs : [])
    ].map(file => String(file || '').trim()).filter(Boolean))),
    releaseNotes,
    manifestPath,
    manifestDiffDoc,
    consolidatedRelease,
    handoffSummaryPass: REBUILD_PACKAGE_HANDOFF_SUMMARY_PASS,
    changedFileGroupsPass: REBUILD_PACKAGE_CHANGED_FILE_GROUPS_PASS,
    changedFileGroups,
    excludes: DEFAULT_PACKAGE_EXCLUDES.slice(),
    createdAt: new Date(0).toISOString(),
    zipEntryAuditPass: REBUILD_PACKAGE_ZIP_ENTRY_AUDIT_PASS,
    generatedDocsAuditPass: REBUILD_PACKAGE_GENERATED_DOCS_AUDIT_PASS
  };
  manifest.manifestDiffPass = REBUILD_PACKAGE_MANIFEST_DIFF_PASS;
  manifest.manifestDiff = buildPackageManifestDiffSummary(manifest, options.previousManifest || null);
  Object.defineProperty(manifest, '_previousManifest', { value: options.previousManifest || null, enumerable: false });
  return manifest;
}

function parsePackageRebuildArgs(argv = process.argv.slice(2)) {
  const parsed = parseRebuildDocScaffoldArgs(argv);
  const zipArg = argv.find(arg => arg === '--zip' || arg.startsWith('--zip='));
  const outputArg = argv.find(arg => arg.startsWith('--output=') || arg.startsWith('--zip-out='));
  const manifestArg = argv.find(arg => arg.startsWith('--manifest=') || arg.startsWith('--package-manifest='));
  const releaseNoteArg = argv.find(arg => arg.startsWith('--release-notes=') || arg.startsWith('--release-note='));
  const previousManifestArg = argv.find(arg => arg.startsWith('--previous-manifest='));
  const manifestDiffArg = argv.find(arg => arg.startsWith('--manifest-diff=') || arg.startsWith('--manifest-diff-doc='));
  return {
    ...parsed,
    scaffoldDocs: argv.includes('--scaffold-docs') || argv.includes('--write-docs'),
    dryRun: parsed.dryRun || argv.includes('--dry-run'),
    zip: !!zipArg,
    outputPath: outputArg ? outputArg.split('=').slice(1).join('=') : '',
    manifestPath: manifestArg ? manifestArg.split('=').slice(1).join('=') : '',
    writeManifest: argv.includes('--write-manifest') || !!manifestArg,
    writeReleaseNotes: argv.includes('--write-release-notes') || argv.includes('--release-notes') || !!releaseNoteArg,
    releaseNotesPath: releaseNoteArg ? releaseNoteArg.split('=').slice(1).join('=') : '',
    projectRoot: parsed.projectRoot || parsed.outDir,
    changedFiles: parseChangedFilesArgs(argv),
    previousManifestPath: previousManifestArg ? previousManifestArg.split('=').slice(1).join('=') : '',
    consolidatedRelease: argv.includes('--consolidated-release'),
    writeCssOwnershipReport: argv.includes('--write-css-app-shell-report') || argv.includes('--write-css-ownership-report'),
    writeManifestDiffDoc: argv.includes('--write-manifest-diff-doc') || argv.includes('--write-diff-summary') || !!manifestDiffArg,
    manifestDiffPath: manifestDiffArg ? manifestDiffArg.split('=').slice(1).join('=') : ''
  };
}

function buildZipExcludeArgs(excludes = DEFAULT_PACKAGE_EXCLUDES) {
  const patterns = [];
  for (const item of excludes) {
    const clean = String(item || '').replace(/^\/+|\/+$/g, '');
    if (!clean) continue;
    patterns.push(clean, clean + '/*', '*/' + clean, '*/' + clean + '/*');
  }
  return patterns.flatMap(pattern => ['-x', pattern]);
}

function assertPackageExcludeGuard(manifest = {}) {
  const excludes = new Set((manifest.excludes || []).map(String));
  for (const required of DEFAULT_PACKAGE_EXCLUDES) {
    if (!excludes.has(required)) throw new Error('package exclude guard missing: ' + required);
  }
  return { pass: REBUILD_PACKAGE_ZIP_GUARD_PASS, excludes: Array.from(excludes) };
}

function assertPackageLockRegularFile(projectRoot) {
  const target = path.join(projectRoot, 'package-lock.json');
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('package-lock.json must be a regular file, not a symlink');
  }
  return { pass: PACKAGE_LOCK_REGULAR_FILE_PASS, file: 'package-lock.json', regular: true, symlink: false, bytes: stat.size };
}

function commandAvailable(command, args = ['--version']) {
  const result = childProcess.spawnSync(command, args, { encoding:'utf8', stdio:'pipe' });
  return !result.error && result.status === 0;
}

function requireZipInspectionTools() {
  if (!commandAvailable('unzip', ['-v'])) throw new Error('unzip is required to inspect release ZIP files');
}

function listZipEntries(zipPath) {
  requireZipInspectionTools();
  if (detectArchiveFormat(zipPath) !== 'zip') throw new Error('release archive is not a ZIP file: ' + zipPath);
  return childProcess.spawnSync('unzip', ['-Z1', zipPath], { encoding:'utf8' });
}

function assertZipIntegrity(zipPath) {
  if (!zipPath || !fs.existsSync(zipPath)) throw new Error('zip integrity check missing zip: ' + zipPath);
  requireZipInspectionTools();
  if (detectArchiveFormat(zipPath) !== 'zip') throw new Error('zip integrity check rejected non-ZIP archive: ' + zipPath);
  const result = childProcess.spawnSync('unzip', ['-tq', zipPath], { encoding:'utf8' });
  if (result.status !== 0) throw new Error('zip integrity check failed: ' + (result.stderr || result.stdout || result.error?.message || 'unknown error'));
  return { pass: REBUILD_PACKAGE_ZIP_GUARD_PASS, zipPath:path.resolve(zipPath), ok:true, format:'zip' };
}

function collectZipRequiredEntries(manifest = {}) {
  const changedFiles = Object.values(manifest.changedFileGroups?.groups || {}).flat();
  return Array.from(new Set([
    ...(Array.isArray(manifest.docs) ? manifest.docs : []),
    manifest.releaseNotes || '',
    manifest.manifestPath || (manifest.version ? getPackageManifestRelPath(manifest.version) : ''),
    ...changedFiles
  ].map(item => String(item || '').trim()).filter(Boolean)
    .map(item => normalizeArchiveEntryName(item).replace(/\/$/, '')).filter(Boolean))).sort();
}

function assertZipEntryAudit(zipPath, manifest = {}) {
  if (!zipPath || !fs.existsSync(zipPath)) throw new Error('zip entry audit missing zip: ' + zipPath);
  const safety = inspectArchiveBeforeExtract(zipPath, { expectedFormat:'zip' });
  const entries = new Set(safety.entries.map(item => item.replace(/\/$/, '')));
  const requiredEntries = collectZipRequiredEntries(manifest);
  const missingEntries = requiredEntries.filter(entry => !entries.has(entry));
  if (missingEntries.length) throw new Error('zip entry audit missing entries: ' + missingEntries.join(', '));
  return { pass:REBUILD_PACKAGE_ZIP_ENTRY_AUDIT_PASS, zipPath:path.resolve(zipPath), checked:requiredEntries.length, missing:0, safety };
}

function isPackageInventoryExcluded(relPath = '', entryName = '', excludes = DEFAULT_PACKAGE_EXCLUDES) {
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\.\//, '');
  const segments = rel.split('/').filter(Boolean);
  for (const item of excludes || []) {
    const clean = String(item || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!clean || clean.includes('*')) continue;
    if (clean.includes('/')) {
      if (rel === clean || rel.startsWith(clean + '/')) return true;
    } else if (segments.includes(clean) || String(entryName || '') === clean) return true;
  }
  return false;
}

function collectPackageFileInventory(projectRoot, manifest = {}) {
  const manifestRel = normalizeArchiveEntryName(String(manifest.manifestPath || '').replace(/\\/g, '/')).replace(/\/$/, '');
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(projectRoot, full).replace(/\\/g, '/');
      if (isPackageInventoryExcluded(rel, entry.name, manifest.excludes || DEFAULT_PACKAGE_EXCLUDES) || rel === manifestRel || /\.zip$/i.test(entry.name) || isHistoricalPackageManifest(rel, manifest.version) || isHistoricalReleaseArtifact(rel, manifest.version)) continue;
      if (entry.isSymbolicLink()) throw new Error('release inventory does not allow symlinks: ' + rel);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.isFile()) continue;
      const body = fs.readFileSync(full);
      files.push({ path:rel, bytes:body.length, sha256:crypto.createHash('sha256').update(body).digest('hex') });
    }
  }
  walk(projectRoot);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function writePackageManifestFile(projectRoot, manifest = {}, options = {}) {
  const target = path.resolve(options.outputPath || path.join(projectRoot, manifest.manifestPath || getPackageManifestRelPath(manifest.version)));
  fs.mkdirSync(path.dirname(target), { recursive:true });
  const payload = { ...manifest, pass: REBUILD_PACKAGE_MANIFEST_PASS, writtenAt: new Date(0).toISOString() };
  payload.files = collectPackageFileInventory(projectRoot, payload);
  payload.manifestDiff = buildPackageManifestDiffSummary(payload, manifest._previousManifest || null);
  fs.writeFileSync(target, JSON.stringify(payload, null, 2) + '\n');
  return { pass: REBUILD_PACKAGE_MANIFEST_PASS, outputPath:target, bytes:fs.statSync(target).size };
}

function buildPackageManifestDiffMarkdown(manifest = {}, options = {}) {
  const diff = manifest.manifestDiff || {};
  const version = Number(manifest.version || options.version || 0);
  const lines = [
    '# Package manifest diff v' + version,
    '',
    '- Diff doc pass: `' + REBUILD_PACKAGE_MANIFEST_DIFF_DOC_PASS + '`',
    '- Compared with: ' + (diff.comparedWith || '-'),
    '- Version delta: ' + (diff.versionDelta ?? '-'),
    '- File diff scope: full package inventory comparison by path, byte size, and SHA-256; generated current manifest is excluded from self-reference.',
    '- ZIP entry audit: `' + (manifest.zipEntryAuditPass || REBUILD_PACKAGE_ZIP_ENTRY_AUDIT_PASS) + '` validates manifest docs, release notes, package manifest, and changed-file entries in the full ZIP.',
    '- Generated docs audit: `' + (manifest.generatedDocsAuditPass || REBUILD_PACKAGE_GENERATED_DOCS_AUDIT_PASS) + '` validates generated docs/manifest existence before final packaging.',
    '- Added files: ' + (diff.addedCount ?? 0),
    '- Removed files: ' + (diff.removedCount ?? 0),
    '- Modified files: ' + (diff.modifiedCount ?? 0),
    '',
    diff.groupCounts ? '## Changed file groups' : '## Group delta',
    ...(diff.groupCounts
      ? Object.entries(diff.groupCounts).map(([group, count]) => '- ' + group + ': ' + count)
      : Object.entries(diff.groupDelta || {}).map(([group, delta]) => '- ' + group + ': ' + delta.before + ' → ' + delta.after + ' (' + (delta.delta >= 0 ? '+' : '') + delta.delta + ')')),
    '',
    '## Added files',
    ...((diff.addedFiles || []).map(file => '- ' + file)),
    '',
    '## Removed files',
    ...((diff.removedFiles || []).map(file => '- ' + file)),
    '',
    '## Modified files',
    ...((diff.modifiedFiles || []).map(file => '- ' + file)),
    '',
    '<!-- ' + REBUILD_PACKAGE_MANIFEST_DIFF_DOC_PASS + ' -->',
    ''
  ];
  return lines.join('\n');
}

function writePackageManifestDiffMarkdown(projectRoot, manifest = {}, options = {}) {
  const target = path.resolve(options.outputPath || path.join(projectRoot, 'docs', `package-manifest-diff-v${manifest.version}.md`));
  fs.mkdirSync(path.dirname(target), { recursive:true });
  fs.writeFileSync(target, buildPackageManifestDiffMarkdown(manifest, options));
  return { pass: REBUILD_PACKAGE_MANIFEST_DIFF_DOC_PASS, outputPath:target, bytes:fs.statSync(target).size };
}

function createRebuildZip(projectRoot, outputPath, manifest = {}) {
  if (!projectRoot) throw new Error('createRebuildZip requires projectRoot');
  const target = path.resolve(outputPath || path.join(projectRoot, manifest.fileName || 'txt_reader_rebuild.zip'));
  assertPackageExcludeGuard(manifest);
  const staleReleaseArtifactAudit = assertNoHistoricalReleaseArtifacts(projectRoot, manifest.version);
  const lockAudit = assertPackageLockRegularFile(projectRoot);
  fs.mkdirSync(path.dirname(target), { recursive:true });
  if (fs.existsSync(target)) fs.rmSync(target);
  if (!commandAvailable('zip', ['-v'])) throw new Error('zip command is required to create a release ZIP; TAR fallback is not permitted');
  const historicalManifestExcludes = collectHistoricalPackageManifestPaths(projectRoot, manifest.version).flatMap(rel => ['-x', rel]);
  const historicalReleaseExcludes = collectHistoricalReleaseArtifactPaths(projectRoot, manifest.version).flatMap(rel => ['-x', rel]);
  const args = ['-qr', target, '.', ...buildZipExcludeArgs(manifest.excludes), ...historicalManifestExcludes, ...historicalReleaseExcludes];
  const result = childProcess.spawnSync('zip', args, { cwd:projectRoot, encoding:'utf8' });
  if (result.status !== 0) throw new Error('zip failed: ' + (result.stderr || result.stdout || result.error?.message || 'unknown error'));
  return { pass: REBUILD_PACKAGE_ZIP_GUARD_PASS, outputPath: target, bytes: fs.statSync(target).size, excludes: manifest.excludes, packageLockAudit: lockAudit, staleReleaseArtifactAudit, integrity: assertZipIntegrity(target), entryAudit: assertZipEntryAudit(target, manifest) };
}

function loadPreviousPackageManifest(projectRoot, version, previousManifestPath = '') {
  const target = previousManifestPath ? path.resolve(projectRoot, previousManifestPath) : null;
  const candidates = target ? [target] : [
    path.join(projectRoot, getPackageManifestRelPath(Number(version) - 1)),
    path.join(projectRoot, `package-manifest-v${Number(version) - 1}.json`)
  ];
  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) return null;
  try { return JSON.parse(fs.readFileSync(found, 'utf8')); } catch { return null; }
}

function getPackageManifestOutputPath(projectRoot, version) {
  return path.join(projectRoot, getPackageManifestRelPath(version));
}

function runPackageRebuild(argv = process.argv.slice(2), cwd = process.cwd()) {
  const options = parsePackageRebuildArgs(argv);
  const projectRoot = path.resolve(options.projectRoot || cwd);
  const previousManifest = loadPreviousPackageManifest(projectRoot, options.version, options.previousManifestPath);
  const manifest = buildPackageManifest({
    version: options.version,
    cacheVersion: options.cacheVersion,
    changedFiles: options.changedFiles,
    previousManifest,
    extraDocs: options.docs,
    consolidatedRelease: options.consolidatedRelease,
    manifestPath: options.manifestPath,
    releaseNotes: options.releaseNotesPath,
    manifestDiffDoc: options.manifestDiffPath
  });
  const staleReleaseArtifactAudit = assertNoHistoricalReleaseArtifacts(projectRoot, manifest.version);
  let docs = null;
  if (options.scaffoldDocs) {
    docs = writeRebuildDocs(projectRoot, {
      version: options.version,
      cacheVersion: options.cacheVersion,
      summary: options.summary,
      docs: options.docs,
      candidates: options.candidates,
      progress: options.progress,
      dryRun: options.dryRun
    });
  }
  const excludeGuard = assertPackageExcludeGuard(manifest);
  const zipPlan = options.zip ? { enabled:true, outputPath:path.resolve(options.outputPath || path.join(projectRoot, manifest.fileName)), excludeArgs:buildZipExcludeArgs(manifest.excludes) } : { enabled:false };
  const manifestPlan = options.writeManifest ? { enabled:true, outputPath:path.resolve(options.manifestPath || path.join(projectRoot, manifest.manifestPath || getPackageManifestRelPath(manifest.version))) } : { enabled:false };
  let writtenManifest = null;
  const releaseNotePlan = options.writeReleaseNotes ? { enabled:true, outputPath:path.resolve(options.releaseNotesPath || path.join(projectRoot, manifest.releaseNotes || `docs/release-notes-v${manifest.version}.md`)) } : { enabled:false };
  const writtenReleaseNotes = options.writeReleaseNotes && !options.dryRun ? require('./release_notes_from_package.js').writeReleaseNotesFromPackageManifest(projectRoot, manifest, { outputPath:releaseNotePlan.outputPath, summary:options.summary, candidates:options.candidates }) : null;
  const cssOwnershipReportPlan = options.writeCssOwnershipReport ? {
    pass: REBUILD_PACKAGE_CSS_OWNERSHIP_REPORT_PLAN_PASS,
    enabled: true,
    outputPath: path.join(projectRoot, 'docs', `css-app-shell-ownership-report-v${manifest.version}.md`)
  } : { pass: REBUILD_PACKAGE_CSS_OWNERSHIP_REPORT_PLAN_PASS, enabled:false };
  const writtenCssOwnershipReport = options.writeCssOwnershipReport && !options.dryRun
    ? require('./checks/css-app-shell-ownership-report.js').writeCssAppShellOwnershipMarkdownReport(projectRoot, cssOwnershipReportPlan.outputPath, { version: manifest.version })
    : null;
  const manifestDiffDocPlan = options.writeManifestDiffDoc ? {
    pass: REBUILD_PACKAGE_MANIFEST_DIFF_DOC_PASS,
    enabled: true,
    outputPath: path.resolve(options.manifestDiffPath || path.join(projectRoot, manifest.manifestDiffDoc || `docs/package-manifest-diff-v${manifest.version}.md`))
  } : { pass: REBUILD_PACKAGE_MANIFEST_DIFF_DOC_PASS, enabled:false };
  let writtenManifestDiffDoc = null;
  if (options.writeManifestDiffDoc && !options.dryRun) {
    fs.mkdirSync(path.dirname(manifestDiffDocPlan.outputPath), { recursive:true });
    if (!fs.existsSync(manifestDiffDocPlan.outputPath)) fs.writeFileSync(manifestDiffDocPlan.outputPath, '');
    const preview = { ...manifest, files:collectPackageFileInventory(projectRoot, manifest) };
    manifest.manifestDiff = buildPackageManifestDiffSummary(preview, previousManifest);
    writtenManifestDiffDoc = writePackageManifestDiffMarkdown(projectRoot, manifest, { outputPath:manifestDiffDocPlan.outputPath });
  }
  if (options.writeManifest && !options.dryRun) writtenManifest = writePackageManifestFile(projectRoot, manifest, { outputPath:manifestPlan.outputPath });
  const changedFileExistsAudit = assertChangedFileEntriesExist(projectRoot, options.changedFiles, { dryRun: options.dryRun });
  const generatedDocsAudit = assertGeneratedDocsAudit(projectRoot, manifest, { dryRun: options.dryRun });
  const zipResult = options.zip && !options.dryRun ? createRebuildZip(projectRoot, zipPlan.outputPath, manifest) : null;
  const handoffSummary = require('./release_notes_from_package.js').buildReleaseHandoffSummary(manifest, { summary:options.summary, candidates:options.candidates });
  return { ...manifest, handoffSummary, staleReleaseArtifactAudit, dryRun: !!options.dryRun, scaffoldDocs: !!options.scaffoldDocs, writtenDocs: docs, excludeGuard, changedFileExistsAudit, generatedDocsAudit, zipPlan, manifestPlan, writtenManifest, releaseNotePlan, writtenReleaseNotes, cssOwnershipReportPlan, writtenCssOwnershipReport, manifestDiffDocPlan, writtenManifestDiffDoc, zipResult };
}

if (require.main === module) console.log(JSON.stringify(runPackageRebuild(), null, 2));

module.exports = { STALE_RELEASE_ARTIFACT_GATE_PASS, releaseArtifactVersion, assertNoHistoricalReleaseArtifacts, isPackageInventoryExcluded, collectPackageFileInventory, isHistoricalReleaseArtifact, collectHistoricalReleaseArtifactPaths, isHistoricalPackageManifest, collectHistoricalPackageManifestPaths, PACKAGE_LOCK_REGULAR_FILE_PASS, assertPackageLockRegularFile, REBUILD_PACKAGE_GENERATED_DOCS_AUDIT_PASS, REBUILD_PACKAGE_CHANGED_FILE_EXISTS_AUDIT_PASS, REBUILD_PACKAGE_ZIP_ENTRY_AUDIT_PASS, REBUILD_PACKAGE_SCRIPT_PASS, REBUILD_PACKAGE_HANDOFF_SUMMARY_PASS, REBUILD_PACKAGE_CHANGED_FILE_GROUPS_PASS, REBUILD_PACKAGE_MANIFEST_DIFF_PASS, REBUILD_PACKAGE_MANIFEST_FILE_DIFF_PASS, REBUILD_PACKAGE_MANIFEST_MODIFIED_FILE_DIFF_PASS, REBUILD_PACKAGE_CSS_OWNERSHIP_REPORT_PLAN_PASS, REBUILD_PACKAGE_MANIFEST_DIFF_DOC_PASS, REBUILD_PACKAGE_ZIP_GUARD_PASS, REBUILD_PACKAGE_MANIFEST_PASS, REBUILD_PACKAGE_RELEASE_NOTE_PASS, DEFAULT_PACKAGE_EXCLUDES, DEFAULT_PACKAGE_MANIFEST_DIR, getPackageManifestRelPath, getPackageManifestOutputPath, classifyChangedFileGroup, buildChangedFileGroups, buildPackageManifestDiffSummary, parseChangedFilesArgs, buildPackageManifest, parsePackageRebuildArgs, buildZipExcludeArgs, assertPackageExcludeGuard, assertChangedFileEntriesExist, collectGeneratedDocRequiredEntries, assertGeneratedDocsAudit, assertZipIntegrity, collectZipRequiredEntries, assertZipEntryAudit, writePackageManifestFile, buildPackageManifestDiffMarkdown, writePackageManifestDiffMarkdown, createRebuildZip, runPackageRebuild };
