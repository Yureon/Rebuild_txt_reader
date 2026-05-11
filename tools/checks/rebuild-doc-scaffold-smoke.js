const { buildRebuildPhaseDoc, buildLatestDocIndex, buildCodeSeparationRemainingEstimateDoc, parseRebuildDocScaffoldArgs, writeRebuildDocs } = require('../rebuild_doc_scaffold.js');

const REBUILD_DOC_SCAFFOLD_SMOKE_PASS = 'v251-rebuild-doc-scaffold-smoke-pass';

function runRebuildDocScaffoldSmoke() {
  const parsed = parseRebuildDocScaffoldArgs(['--version=256', '--cache=rebuild-v256', '--summary=row renderers|retry helpers', '--doc=latest index', '--candidate=fixture coverage', '--progress=94~97%', '--dry-run']);
  if (parsed.version !== 256 || parsed.summary.length !== 2 || parsed.docs.length !== 1 || parsed.candidates.length !== 1 || !parsed.dryRun) throw new Error('doc scaffold cli parse failed');
  const phase = buildRebuildPhaseDoc({ version: 256, cacheVersion: 'rebuild-v256', summary: parsed.summary });
  const index = buildLatestDocIndex({ version: 256, cacheVersion: 'rebuild-v256', docs: parsed.docs });
  const estimate = buildCodeSeparationRemainingEstimateDoc({ version: 256, cacheVersion: 'rebuild-v256', progress: parsed.progress, candidates: parsed.candidates });
  ['# Rebuild phase 256', 'rebuild-v256', 'row renderers'].forEach(marker => {
    if (!phase.includes(marker)) throw new Error('phase scaffold missing marker: ' + marker);
  });
  ['Latest document index v256', 'code-separation-remaining-estimate-v256.md', 'latest index'].forEach(marker => {
    if (!index.includes(marker)) throw new Error('index scaffold missing marker: ' + marker);
  });
  ['Code separation remaining estimate v256', '94~97%', 'fixture coverage'].forEach(marker => {
    if (!estimate.includes(marker)) throw new Error('estimate scaffold missing marker: ' + marker);
  });
  const dryRun = writeRebuildDocs(process.cwd(), { ...parsed, dryRun: true });
  if (!dryRun.dryRun || dryRun.files.length !== 3) throw new Error('doc scaffold dry-run result invalid');
  return { pass: REBUILD_DOC_SCAFFOLD_SMOKE_PASS, files: dryRun.files.length };
}

module.exports = { REBUILD_DOC_SCAFFOLD_SMOKE_PASS, runRebuildDocScaffoldSmoke };
