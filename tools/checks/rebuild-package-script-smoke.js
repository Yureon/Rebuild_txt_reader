const REBUILD_PACKAGE_SCRIPT_SMOKE_PASS = 'v276-rebuild-package-script-smoke-current-version-pass';
const { CURRENT_REBUILD_PACKAGE, CURRENT_REBUILD_MANIFEST, CURRENT_REBUILD_RELEASE_NOTES, CURRENT_REBUILD_MANIFEST_DIFF, CURRENT_REBUILD_DOCS, CURRENT_REBUILD_SMOKE_CHANGED_FILES, buildCurrentRebuildPackageDryRunArgs } = require('./current-rebuild-version.js');

function normalizePathForSmoke(filePath = '') {
  return String(filePath || '').replace(/\\/g, '/');
}

function runRebuildPackageScriptSmoke(projectRoot) {
  const { REBUILD_PACKAGE_SCRIPT_PASS, REBUILD_PACKAGE_MANIFEST_PASS, REBUILD_PACKAGE_RELEASE_NOTE_PASS, REBUILD_PACKAGE_CHANGED_FILE_GROUPS_PASS, REBUILD_PACKAGE_MANIFEST_DIFF_PASS, REBUILD_PACKAGE_MANIFEST_FILE_DIFF_PASS, REBUILD_PACKAGE_MANIFEST_MODIFIED_FILE_DIFF_PASS, REBUILD_PACKAGE_CSS_OWNERSHIP_REPORT_PLAN_PASS, REBUILD_PACKAGE_MANIFEST_DIFF_DOC_PASS, REBUILD_PACKAGE_ZIP_ENTRY_AUDIT_PASS, REBUILD_PACKAGE_CHANGED_FILE_EXISTS_AUDIT_PASS, REBUILD_PACKAGE_GENERATED_DOCS_AUDIT_PASS, buildZipExcludeArgs, assertPackageExcludeGuard, classifyChangedFileGroup, runPackageRebuild } = require('../package_rebuild.js');
  const result = runPackageRebuild(buildCurrentRebuildPackageDryRunArgs(), projectRoot);
  if (result.pass !== REBUILD_PACKAGE_SCRIPT_PASS) throw new Error('package rebuild pass marker mismatch');
  if (result.fileName !== CURRENT_REBUILD_PACKAGE) throw new Error('package rebuild filename mismatch');
  if (result.scaffoldDocs || result.writtenDocs !== null) throw new Error('consolidated release must not generate versioned scaffold docs');
  if (!result.consolidatedRelease || !result.docs.includes(CURRENT_REBUILD_DOCS.storageArchitecture) || !result.docs.includes(CURRENT_REBUILD_DOCS.pwaOffline)) throw new Error('consolidated release docs missing');
  if (!result.excludeGuard?.pass || !String(result.excludeGuard.pass).includes('zip-guard')) throw new Error('package smoke missing exclude guard');
  if (!result.zipPlan?.enabled || !result.zipPlan.outputPath.endsWith(CURRENT_REBUILD_PACKAGE)) throw new Error('package smoke missing dry-run zip plan');
  const zipArgs = buildZipExcludeArgs(result.excludes);
  ['node_modules/*','*/node_modules/*','.git/*','*/.git/*'].forEach(pattern => {
    if (!zipArgs.includes(pattern)) throw new Error('package smoke missing zip exclude pattern: ' + pattern);
  });
  assertPackageExcludeGuard(result);
  if (!result.manifestPlan?.enabled || !normalizePathForSmoke(result.manifestPlan.outputPath).endsWith(CURRENT_REBUILD_MANIFEST)) throw new Error('package smoke missing manifest plan');
  if (result.manifestPass !== REBUILD_PACKAGE_MANIFEST_PASS) throw new Error('package manifest pass marker mismatch');
  if (result.zipEntryAuditPass !== REBUILD_PACKAGE_ZIP_ENTRY_AUDIT_PASS) throw new Error('package zip entry audit pass marker mismatch');
  if (result.changedFileGroupsPass !== REBUILD_PACKAGE_CHANGED_FILE_GROUPS_PASS) throw new Error('package changed-file groups pass marker mismatch');
  const expectedChangedFiles = Array.from(new Set(CURRENT_REBUILD_SMOKE_CHANGED_FILES));
  const groupedChangedFiles = Object.values(result.changedFileGroups?.groups || {}).flat();
  const groupedChangedFileSet = new Set(groupedChangedFiles);
  for (const file of expectedChangedFiles) {
    if (!groupedChangedFileSet.has(file)) throw new Error('package changed-file groups missing current file: ' + file);
  }
  const expectedGroups = new Set(expectedChangedFiles.map(classifyChangedFileGroup));
  for (const group of expectedGroups) {
    if (!result.changedFileGroups?.groups?.[group]) throw new Error('package changed-file groups missing expected group: ' + group);
  }
  if (result.changedFileExistsAudit?.pass !== REBUILD_PACKAGE_CHANGED_FILE_EXISTS_AUDIT_PASS || result.changedFileExistsAudit?.checked !== expectedChangedFiles.length) throw new Error('package changed-file existence audit mismatch');
  if (result.generatedDocsAudit?.pass !== REBUILD_PACKAGE_GENERATED_DOCS_AUDIT_PASS || result.generatedDocsAudit?.missing?.length) throw new Error('package generated docs audit mismatch');
  if (result.manifestDiffPass !== REBUILD_PACKAGE_MANIFEST_DIFF_PASS || result.manifestDiff?.pass !== REBUILD_PACKAGE_MANIFEST_DIFF_PASS) throw new Error('package manifest diff pass marker mismatch');
  if (result.manifestDiff?.fileDiffPass !== REBUILD_PACKAGE_MANIFEST_FILE_DIFF_PASS || !Array.isArray(result.manifestDiff?.addedFiles)) throw new Error('package manifest file diff marker mismatch');
  if (result.manifestDiff?.modifiedFileDiffPass !== REBUILD_PACKAGE_MANIFEST_MODIFIED_FILE_DIFF_PASS || !Array.isArray(result.manifestDiff?.modifiedFiles)) throw new Error('package manifest modified file diff marker mismatch');
  if (result.cssOwnershipReportPlan?.pass !== REBUILD_PACKAGE_CSS_OWNERSHIP_REPORT_PLAN_PASS || result.cssOwnershipReportPlan.enabled) throw new Error('consolidated release must not generate versioned CSS ownership docs');
  if (result.manifestDiffDocPlan?.pass !== REBUILD_PACKAGE_MANIFEST_DIFF_DOC_PASS || !result.manifestDiffDocPlan.enabled || !normalizePathForSmoke(result.manifestDiffDocPlan.outputPath).endsWith(CURRENT_REBUILD_MANIFEST_DIFF)) throw new Error('package manifest diff doc plan mismatch');
  if (!result.releaseNotePlan?.enabled || !result.releaseNotePlan.outputPath.endsWith(CURRENT_REBUILD_RELEASE_NOTES)) throw new Error('package smoke missing release note plan');
  if (REBUILD_PACKAGE_RELEASE_NOTE_PASS !== 'v251-rebuild-package-release-note-pass') throw new Error('package release note pass marker mismatch');
  return { pass: REBUILD_PACKAGE_SCRIPT_SMOKE_PASS, packagePass: REBUILD_PACKAGE_SCRIPT_PASS, manifestPass: REBUILD_PACKAGE_MANIFEST_PASS, releaseNotePass: REBUILD_PACKAGE_RELEASE_NOTE_PASS, zipGuardPass: result.excludeGuard.pass, changedFileGroupsPass: result.changedFileGroupsPass, changedFileExistsAuditPass: result.changedFileExistsAudit.pass, generatedDocsAuditPass: result.generatedDocsAudit.pass, manifestDiffPass: result.manifestDiffPass, manifestFileDiffPass: result.manifestDiff.fileDiffPass, manifestModifiedFileDiffPass: result.manifestDiff.modifiedFileDiffPass, cssOwnershipReportPlanPass: result.cssOwnershipReportPlan.pass, manifestDiffDocPass: result.manifestDiffDocPlan.pass, zipEntryAuditPass: result.zipEntryAuditPass };
}

module.exports = { REBUILD_PACKAGE_SCRIPT_SMOKE_PASS, runRebuildPackageScriptSmoke };
