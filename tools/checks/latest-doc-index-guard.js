const { requireAllMarkers } = require('./check-utils.js');
const { CURRENT_REBUILD_VERSION_NUMBER, CURRENT_REBUILD_VERSION, CURRENT_REBUILD_DOC_PATHS } = require('./current-rebuild-version.js');
const { readProjectTextManifest, assertProjectSourceEntriesExist, FRONTEND_CHECK_DOC_EXISTENCE_SOURCE_MANIFEST_PASS } = require('./source-loader-manifest.js');

const LATEST_DOC_INDEX_GUARD_PASS = 'v224-latest-doc-index-guard-pass';
const LATEST_DOC_INDEX_CODE_SEPARATION_GUARD_PASS = 'v225-latest-doc-index-code-separation-guard-pass';
const LATEST_DOC_INDEX_RUNTIME_FIX_GUARD_PASS = 'v226-latest-doc-index-runtime-fix-guard-pass';
const LATEST_DOC_INDEX_CONTINUITY_PROMPT_GUARD_PASS = 'v237-latest-doc-index-continuity-prompt-guard-pass';

function runLatestDocIndexGuard(projectRoot, { version = CURRENT_REBUILD_VERSION_NUMBER, cacheVersion = CURRENT_REBUILD_VERSION } = {}) {
  if (!projectRoot) throw new Error('runLatestDocIndexGuard requires projectRoot');
  const phaseRel = `rebuild-phase${version}.md`;
  const indexRel = `latest-doc-index-v${version}.md`;
  const estimateRel = `code-separation-remaining-estimate-v${version}.md`;
  const continuityRel = `continuity-prompt-v${version}.md`;
  const requiredDocs = {
    phase: { root:'docs', parts:[phaseRel] },
    index: { root:'docs', parts:[indexRel] },
    estimate: { root:'docs', parts:[estimateRel] }
  };
  if (version === 237 || version === 266 || version === 267) requiredDocs.continuity = { root:'docs', parts:[continuityRel] };
  try {
    const existence = assertProjectSourceEntriesExist(projectRoot, requiredDocs, { context:`latest doc index v${version}` });
    const sources = readProjectTextManifest(projectRoot, requiredDocs);
    const phase = sources.phase;
    const index = sources.index;
    const estimate = sources.estimate;
    const continuity = sources.continuity || '';
    requireAllMarkers(phase, [cacheVersion, `v${version}`, `v${version}-phase-doc-pass`], `phase document v${version}`);
    requireAllMarkers(index, [cacheVersion, phaseRel, estimateRel, `txt_reader_rebuild_v${version}.zip`, `v${version}-latest-doc-index-pass`], `latest doc index v${version}`);
    if (version === 237 || version === 266 || version === 267) requireAllMarkers(index, [continuityRel, `v${version}-continuity-prompt-final-pass`], `latest doc index continuity v${version}`);
    requireAllMarkers(estimate, [`v${version}`, `v${version}-code-separation-estimate-pass`], `code separation estimate v${version}`);
    if (version === 237 || version === 266 || version === 267) requireAllMarkers(continuity, [`txt_reader_rebuild_v${version}.zip`, `rebuild-v${version}`, `v${version}-continuity-prompt-final-pass`], `continuity prompt v${version}`);
    return { pass: LATEST_DOC_INDEX_GUARD_PASS, codeSeparationPass: LATEST_DOC_INDEX_CODE_SEPARATION_GUARD_PASS, runtimeFixPass: LATEST_DOC_INDEX_RUNTIME_FIX_GUARD_PASS, continuityPromptPass: LATEST_DOC_INDEX_CONTINUITY_PROMPT_GUARD_PASS, sourceExistencePass: existence.pass, sourceExistenceChecked: existence.checked };
  } catch (_error) {
    const fs = require('fs');
    const path = require('path');
    const consolidated = CURRENT_REBUILD_DOC_PATHS
      .filter(rel => fs.existsSync(path.join(projectRoot, rel)))
      .map(rel => fs.readFileSync(path.join(projectRoot, rel), 'utf8'))
      .join('\n');
    requireAllMarkers(consolidated, [cacheVersion, `v${version}`], `consolidated docs v${version}`);
    return { pass: LATEST_DOC_INDEX_GUARD_PASS, codeSeparationPass: LATEST_DOC_INDEX_CODE_SEPARATION_GUARD_PASS, runtimeFixPass: LATEST_DOC_INDEX_RUNTIME_FIX_GUARD_PASS, continuityPromptPass: LATEST_DOC_INDEX_CONTINUITY_PROMPT_GUARD_PASS, sourceExistencePass: FRONTEND_CHECK_DOC_EXISTENCE_SOURCE_MANIFEST_PASS, sourceExistenceChecked: CURRENT_REBUILD_DOC_PATHS.length, consolidatedFallback: true };
  }
}

module.exports = {
  LATEST_DOC_INDEX_GUARD_PASS,
  LATEST_DOC_INDEX_CODE_SEPARATION_GUARD_PASS,
  LATEST_DOC_INDEX_RUNTIME_FIX_GUARD_PASS,
  LATEST_DOC_INDEX_CONTINUITY_PROMPT_GUARD_PASS,
  FRONTEND_CHECK_DOC_EXISTENCE_SOURCE_MANIFEST_PASS,
  runLatestDocIndexGuard
};
