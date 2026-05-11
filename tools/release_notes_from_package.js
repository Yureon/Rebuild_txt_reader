const fs = require('fs');
const path = require('path');

const REBUILD_RELEASE_NOTES_FROM_PACKAGE_PASS = 'v251-rebuild-release-notes-from-package-pass';
const REBUILD_RELEASE_NOTES_HANDOFF_SUMMARY_PASS = 'v252-rebuild-release-notes-handoff-summary-pass';
const REBUILD_RELEASE_NOTES_CHANGED_FILE_GROUPS_PASS = 'v253-rebuild-release-notes-changed-file-groups-pass';
const REBUILD_RELEASE_NOTES_MANIFEST_DIFF_PASS = 'v254-rebuild-release-notes-manifest-diff-pass';
const REBUILD_RELEASE_NOTES_MANIFEST_FILE_DIFF_PASS = 'v255-rebuild-release-notes-manifest-file-diff-pass';
const REBUILD_RELEASE_NOTES_MANIFEST_MODIFIED_FILE_DIFF_PASS = 'v256-rebuild-release-notes-manifest-modified-file-diff-pass';
const REBUILD_RELEASE_NOTES_MANIFEST_DIFF_DOC_PASS = 'v257-rebuild-release-notes-manifest-diff-doc-pass';
const REBUILD_RELEASE_NOTES_ZIP_ENTRY_AUDIT_PASS = 'v275-rebuild-release-notes-zip-entry-audit-pass';
const REBUILD_RELEASE_NOTES_GENERATED_DOCS_AUDIT_PASS = 'v275-rebuild-release-notes-generated-docs-audit-pass';

function normalizePackageManifestInput(input) {
  if (!input) throw new Error('release notes require a package manifest');
  if (typeof input === 'string') return JSON.parse(fs.readFileSync(input, 'utf8'));
  return input;
}

function buildReleaseHandoffSummary(manifest = {}, options = {}) {
  const summary = Array.isArray(options.summary) ? options.summary : [];
  const candidates = Array.isArray(options.candidates) ? options.candidates : [];
  return {
    pass: REBUILD_RELEASE_NOTES_HANDOFF_SUMMARY_PASS,
    version: manifest.version,
    cacheVersion: manifest.cacheVersion,
    package: manifest.fileName,
    docs: manifest.docs || [],
    changedFocus: summary.slice(0, 8),
    nextCandidates: candidates.slice(0, 8),
    changedFileGroups: manifest.changedFileGroups || null
  };
}

function buildReleaseNotesFromPackageManifest(input, options = {}) {
  const manifest = normalizePackageManifestInput(input);
  const summary = Array.isArray(options.summary) ? options.summary : [];
  const candidates = Array.isArray(options.candidates) ? options.candidates : [];
  const handoff = buildReleaseHandoffSummary(manifest, options);
  return [
    `# Rebuild v${manifest.version} release notes`,
    '',
    `- Package: \`${manifest.fileName || ''}\``,
    `- Cache/version marker: \`${manifest.cacheVersion || ''}\``,
    `- Manifest pass: \`${manifest.manifestPass || manifest.pass || ''}\``,
    `- Excludes: ${(manifest.excludes || []).map(item => '`' + item + '`').join(', ') || '-'}`,
    '',
    '## Included docs',
    ...(manifest.docs || []).map(doc => `- ${doc}`),
    '',
    '## Summary',
    ...(summary.length ? summary.map(item => `- ${item}`) : ['- Generated from package manifest.']),
    '',
    '## Next candidates',
    ...(candidates.length ? candidates.map(item => `- ${item}`) : ['- Not specified.']),
    '',
    '## Changed file groups',
    `- Changed file groups pass: \`${manifest.changedFileGroupsPass || REBUILD_RELEASE_NOTES_CHANGED_FILE_GROUPS_PASS}\``,
    ...Object.entries(manifest.changedFileGroups?.groups || {}).map(([group, files]) => `- ${group}: ${files.length}`),
    '',
    '## Manifest diff',
    `- Manifest diff pass: \`${manifest.manifestDiffPass || REBUILD_RELEASE_NOTES_MANIFEST_DIFF_PASS}\``,
    `- Release note diff pass: \`${REBUILD_RELEASE_NOTES_MANIFEST_DIFF_PASS}\``,
    `- Compared with: ${manifest.manifestDiff?.comparedWith || '-'}`,
    `- Version delta: ${manifest.manifestDiff?.versionDelta ?? '-'}`,
    '- File diff scope: changed-file manifest entries only; this is not a full-package deletion/addition list.',
    `- ZIP entry audit pass: \`${manifest.zipEntryAuditPass || REBUILD_RELEASE_NOTES_ZIP_ENTRY_AUDIT_PASS}\``,
    `- Generated docs audit pass: \`${manifest.generatedDocsAuditPass || REBUILD_RELEASE_NOTES_GENERATED_DOCS_AUDIT_PASS}\``,
    ...Object.entries(manifest.manifestDiff?.groupDelta || {}).map(([group, delta]) => `- ${group}: ${delta.before} → ${delta.after} (${delta.delta >= 0 ? '+' : ''}${delta.delta})`),
    `- File diff pass: \`${manifest.manifestDiff?.fileDiffPass || REBUILD_RELEASE_NOTES_MANIFEST_FILE_DIFF_PASS}\``,
    `- Release note file diff pass: \`${REBUILD_RELEASE_NOTES_MANIFEST_FILE_DIFF_PASS}\``,
    `- Added files: ${manifest.manifestDiff?.addedCount ?? 0}`,
    ...((manifest.manifestDiff?.addedFiles || []).slice(0, 12).map(file => `  - added: ${file}`)),
    `- Removed files: ${manifest.manifestDiff?.removedCount ?? 0}`,
    ...((manifest.manifestDiff?.removedFiles || []).slice(0, 12).map(file => `  - removed: ${file}`)),
    `- Modified file diff pass: \`${manifest.manifestDiff?.modifiedFileDiffPass || REBUILD_RELEASE_NOTES_MANIFEST_MODIFIED_FILE_DIFF_PASS}\``,
    `- Release note modified file diff pass: \`${REBUILD_RELEASE_NOTES_MANIFEST_MODIFIED_FILE_DIFF_PASS}\``,
    `- Modified files: ${manifest.manifestDiff?.modifiedCount ?? 0}`,
    ...((manifest.manifestDiff?.modifiedFiles || []).slice(0, 12).map(file => `  - modified: ${file}`)),
    `- Manifest diff doc pass: \`${REBUILD_RELEASE_NOTES_MANIFEST_DIFF_DOC_PASS}\``,
    `- Manifest diff doc: \`docs/package-manifest-diff-v${manifest.version}.md\``,
    '',
    '## Handoff summary',
    `- Handoff pass: \`${handoff.pass}\``,
    `- Changed focus: ${handoff.changedFocus.length ? handoff.changedFocus.join('; ') : '-'}`,
    `- Candidate count: ${handoff.nextCandidates.length}`,
    '',
    `Marker: \`${REBUILD_RELEASE_NOTES_FROM_PACKAGE_PASS}\`.`,
    ''
  ].join('\n');
}

function writeReleaseNotesFromPackageManifest(projectRoot, manifestPath, options = {}) {
  const manifest = normalizePackageManifestInput(manifestPath);
  const outPath = path.resolve(options.outputPath || path.join(projectRoot, `docs/release-notes-v${manifest.version}.md`));
  fs.mkdirSync(path.dirname(outPath), { recursive:true });
  const text = buildReleaseNotesFromPackageManifest(manifest, options);
  fs.writeFileSync(outPath, text);
  return { pass: REBUILD_RELEASE_NOTES_FROM_PACKAGE_PASS, outputPath:outPath, bytes:fs.statSync(outPath).size };
}

if (require.main === module) {
  const manifestPath = process.argv.find(arg => arg.startsWith('--manifest='))?.split('=').slice(1).join('=');
  const out = process.argv.find(arg => arg.startsWith('--out='))?.split('=').slice(1).join('=');
  if (!manifestPath) throw new Error('usage: node tools/release_notes_from_package.js --manifest=package-manifest-v251.json [--out=docs/release-notes-v251.md]');
  console.log(writeReleaseNotesFromPackageManifest(process.cwd(), manifestPath, { outputPath:out }));
}

module.exports = { REBUILD_RELEASE_NOTES_GENERATED_DOCS_AUDIT_PASS, REBUILD_RELEASE_NOTES_ZIP_ENTRY_AUDIT_PASS, REBUILD_RELEASE_NOTES_FROM_PACKAGE_PASS, REBUILD_RELEASE_NOTES_HANDOFF_SUMMARY_PASS, REBUILD_RELEASE_NOTES_CHANGED_FILE_GROUPS_PASS, REBUILD_RELEASE_NOTES_MANIFEST_DIFF_PASS, REBUILD_RELEASE_NOTES_MANIFEST_FILE_DIFF_PASS, REBUILD_RELEASE_NOTES_MANIFEST_MODIFIED_FILE_DIFF_PASS, REBUILD_RELEASE_NOTES_MANIFEST_DIFF_DOC_PASS, normalizePackageManifestInput, buildReleaseHandoffSummary, buildReleaseNotesFromPackageManifest, writeReleaseNotesFromPackageManifest };
