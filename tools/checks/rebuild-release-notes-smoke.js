const REBUILD_RELEASE_NOTES_SMOKE_PASS = 'v276-rebuild-release-notes-smoke-current-version-pass';
const { CURRENT_REBUILD_VERSION_NUMBER, CURRENT_REBUILD_VERSION, CURRENT_REBUILD_PACKAGE, CURRENT_REBUILD_MANIFEST_DIFF, CURRENT_REBUILD_SMOKE_CHANGED_FILES } = require('./current-rebuild-version.js');

function runRebuildReleaseNotesSmoke(projectRoot) {
  const { REBUILD_RELEASE_NOTES_FROM_PACKAGE_PASS, REBUILD_RELEASE_NOTES_MANIFEST_DIFF_PASS, REBUILD_RELEASE_NOTES_MANIFEST_FILE_DIFF_PASS, REBUILD_RELEASE_NOTES_MANIFEST_MODIFIED_FILE_DIFF_PASS, REBUILD_RELEASE_NOTES_MANIFEST_DIFF_DOC_PASS, buildReleaseNotesFromPackageManifest } = require('../release_notes_from_package.js');
  const { REBUILD_PACKAGE_ZIP_ENTRY_AUDIT_PASS, REBUILD_PACKAGE_GENERATED_DOCS_AUDIT_PASS, classifyChangedFileGroup, buildPackageManifest } = require('../package_rebuild.js');
  const previousManifest = buildPackageManifest({ version:253, cacheVersion:'rebuild-v253', changedFiles:['docs/rebuild-phase253.md'] });
  const manifest = buildPackageManifest({ version:CURRENT_REBUILD_VERSION_NUMBER, cacheVersion:CURRENT_REBUILD_VERSION, changedFiles:CURRENT_REBUILD_SMOKE_CHANGED_FILES, previousManifest, consolidatedRelease:true, manifestPath:`package-manifest-v${CURRENT_REBUILD_VERSION_NUMBER}.json`, releaseNotes:`txt_reader_v${CURRENT_REBUILD_VERSION_NUMBER}_change_report.md`, manifestDiffDoc:CURRENT_REBUILD_MANIFEST_DIFF });
  const text = buildReleaseNotesFromPackageManifest(manifest, { summary:['action rows','diagnostics import/export'], candidates:['browser verification'] });
  const expectedGroups = Array.from(new Set(CURRENT_REBUILD_SMOKE_CHANGED_FILES.map(classifyChangedFileGroup))).sort();
  [`Rebuild v${CURRENT_REBUILD_VERSION_NUMBER} release notes`,CURRENT_REBUILD_PACKAGE,CURRENT_REBUILD_VERSION,'action rows','browser verification',...expectedGroups,'v253-rebuild-package-changed-file-groups-pass','Manifest diff','v254-rebuild-package-manifest-diff-pass',REBUILD_RELEASE_NOTES_MANIFEST_DIFF_PASS,REBUILD_RELEASE_NOTES_MANIFEST_FILE_DIFF_PASS,'Added files','Removed files','Modified files',REBUILD_RELEASE_NOTES_MANIFEST_MODIFIED_FILE_DIFF_PASS,REBUILD_RELEASE_NOTES_MANIFEST_DIFF_DOC_PASS,CURRENT_REBUILD_MANIFEST_DIFF,REBUILD_PACKAGE_ZIP_ENTRY_AUDIT_PASS,REBUILD_PACKAGE_GENERATED_DOCS_AUDIT_PASS,REBUILD_RELEASE_NOTES_FROM_PACKAGE_PASS].forEach(marker => {
    if (!text.includes(marker)) throw new Error('release note smoke missing marker: ' + marker);
  });
  return { pass: REBUILD_RELEASE_NOTES_SMOKE_PASS, releaseNotePass: REBUILD_RELEASE_NOTES_FROM_PACKAGE_PASS };
}

module.exports = { REBUILD_RELEASE_NOTES_SMOKE_PASS, runRebuildReleaseNotesSmoke };
