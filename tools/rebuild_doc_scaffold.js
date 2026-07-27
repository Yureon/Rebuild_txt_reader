#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const REBUILD_DOC_SCAFFOLD_PASS = 'v248-rebuild-doc-scaffold-pass';

function buildRebuildPhaseDoc({ version, cacheVersion, summary = [] } = {}) {
  if (!Number.isInteger(Number(version))) throw new Error('version is required');
  const lines = [
    `# Rebuild phase ${version}`,
    '',
    `- Cache/version marker: \`${cacheVersion || `rebuild-v${version}`}\`.`,
    '- Scope: maintenance, modularization, guard/smoke coverage, and diagnostics scaffolding.',
    ...summary.map(item => `- ${item}`)
  ];
  lines.push('', `<!-- v${version}-phase-doc-pass -->`);
  return lines.join('\n') + '\n';
}

function buildLatestDocIndex({ version, cacheVersion, docs = [] } = {}) {
  if (!Number.isInteger(Number(version))) throw new Error('version is required');
  const base = [
    `# Latest document index v${version}`,
    '',
    `- Current cache/version marker: \`${cacheVersion || `rebuild-v${version}`}\`.`,
    `- Phase note: \`docs/rebuild-phase${version}.md\`.`,
    `- Remaining estimate: \`docs/code-separation-remaining-estimate-v${version}.md\`.`,
    `- Package: \`txt_reader_v${version}.zip\`.`
  ];
  const continuityMarker = docs.some(item => String(item || '').includes(`continuity-prompt-v${version}.md`)) ? [`<!-- v${version}-continuity-prompt-final-pass -->`] : [];
  return base.concat(docs.map(item => `- ${item}`), ['', ...continuityMarker, `<!-- v${version}-latest-doc-index-pass -->`]).join('\n') + '\n';
}
function buildCodeSeparationRemainingEstimateDoc({ version, cacheVersion, progress = '94~97%', candidates = [] } = {}) {
  if (!Number.isInteger(Number(version))) throw new Error('version is required');
  const lines = [
    `# Code separation remaining estimate v${version}`,
    '',
    `- Cache/version marker: \`${cacheVersion || `rebuild-v${version}`}\`.`,
    `- Estimated maintenance/refactor completion: ${progress}.`,
    '- Scope: code separation, maintainability, guard/smoke coverage, and diagnostics hardening.',
    '- Remaining work is mostly low-risk renderer/helper extraction, fixture expansion, and release-flow documentation hygiene.'
  ];
  if (candidates.length) {
    lines.push('', '## Next candidates');
    lines.push(...candidates.map((item, index) => `${index + 1}. ${item}`));
  }
  lines.push('', `<!-- v${version}-code-separation-estimate-pass -->`);
  return lines.join('\n') + '\n';
}

function parseCsvList(value = '') {
  return String(value || '').split('|').map(item => item.trim()).filter(Boolean);
}

function parseRebuildDocScaffoldArgs(argv = []) {
  const options = { summary: [], docs: [], candidates: [], dryRun: false };
  for (const arg of argv) {
    if (arg === '--dry-run') { options.dryRun = true; continue; }
    if (arg.startsWith('--version=')) { options.version = Number(arg.split('=').slice(1).join('=')); continue; }
    if (arg.startsWith('--cache=')) { options.cacheVersion = arg.split('=').slice(1).join('='); continue; }
    if (arg.startsWith('--progress=')) { options.progress = arg.split('=').slice(1).join('='); continue; }
    if (arg.startsWith('--summary=')) { options.summary.push(...parseCsvList(arg.split('=').slice(1).join('='))); continue; }
    if (arg.startsWith('--doc=')) { options.docs.push(...parseCsvList(arg.split('=').slice(1).join('='))); continue; }
    if (arg.startsWith('--candidate=')) { options.candidates.push(...parseCsvList(arg.split('=').slice(1).join('='))); continue; }
    if (arg.startsWith('--out=')) { options.projectRoot = path.resolve(arg.split('=').slice(1).join('=')); continue; }
  }
  return options;
}

function writeRebuildDocs(projectRoot, options = {}) {
  const version = Number(options.version);
  if (!Number.isInteger(version)) throw new Error('version is required');
  const cacheVersion = options.cacheVersion || `rebuild-v${version}`;
  const docsRoot = path.join(projectRoot, 'docs');
  const files = {
    [`rebuild-phase${version}.md`]: buildRebuildPhaseDoc({ version, cacheVersion, summary: options.summary || [] }),
    [`latest-doc-index-v${version}.md`]: buildLatestDocIndex({ version, cacheVersion, docs: options.docs || [] }),
    [`code-separation-remaining-estimate-v${version}.md`]: buildCodeSeparationRemainingEstimateDoc({ version, cacheVersion, progress: options.progress, candidates: options.candidates || [] })
  };
  if (!options.dryRun) {
    fs.mkdirSync(docsRoot, { recursive: true });
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(docsRoot, name), body);
  }
  return { pass: REBUILD_DOC_SCAFFOLD_PASS, version, dryRun: !!options.dryRun, files: Object.keys(files) };
}

if (require.main === module) {
  const options = parseRebuildDocScaffoldArgs(process.argv.slice(2));
  const version = Number(options.version);
  if (!Number.isInteger(version)) throw new Error('usage: node tools/rebuild_doc_scaffold.js --version=<vxxx> [--cache=rebuild-vxxx] [--summary=a|b] [--candidate=a] [--progress=96~98%] [--dry-run] [--out=/project]');
  const result = writeRebuildDocs(options.projectRoot || path.join(__dirname, '..'), options);
  console.log(JSON.stringify(result));
}

module.exports = {
  REBUILD_DOC_SCAFFOLD_PASS,
  buildRebuildPhaseDoc,
  buildLatestDocIndex,
  buildCodeSeparationRemainingEstimateDoc,
  parseRebuildDocScaffoldArgs,
  writeRebuildDocs
};
