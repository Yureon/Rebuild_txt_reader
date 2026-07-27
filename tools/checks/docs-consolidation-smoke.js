#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
function runDocsConsolidationSmoke(projectRoot = path.resolve(__dirname, '..', '..')) {
  const docsRoot = path.join(projectRoot, 'docs');
  const required = ['README.md','deployment-guide.md','security.md','performance-cache.md','reader-search-baseline.md','smoke-tests.md','handoff.md','api-contract.md','release-history.md'];
  for (const rel of required) assert.ok(fs.existsSync(path.join(docsRoot, rel)), `missing consolidated doc: ${rel}`);
  const files = fs.readdirSync(docsRoot, { withFileTypes: true }).filter(d => d.isFile()).map(d => d.name);
  const forbiddenVersioned = files.filter(name => /(?:rebuild-phase\d+|latest-doc-index-v\d+|worklist-v\d+|deployment-guide-v\d+|release-notes-v\d+|package-manifest-diff-v\d+|code-separation-remaining-estimate-v\d+|css-app-shell-ownership-report-v\d+)\.md$/.test(name));
  assert.deepStrictEqual(forbiddenVersioned, [], `versioned docs should be consolidated: ${forbiddenVersioned.join(', ')}`);
  assert.ok(!fs.existsSync(path.join(docsRoot, 'package-manifests')), 'package-manifests directory should not be carried in docs consolidation package');
  const smoke = fs.readFileSync(path.join(docsRoot, 'smoke-tests.md'), 'utf8');
  assert.ok(smoke.includes('문서 파일의 존재 여부와 독립'), 'smoke policy must mention doc independence');
  const release = fs.readFileSync(path.join(docsRoot, 'release-history.md'), 'utf8');
  for (const marker of ['rebuild-v380', 'rebuild-v379', 'rebuild-v378', 'rebuild-v377', 'rebuild-v376', 'rebuild-v375', 'rebuild-v374', 'rebuild-v373', 'rebuild-v372', 'rebuild-v371', 'rebuild-v370', 'rebuild-v369', 'rebuild-v368', 'rebuild-v367', 'rebuild-v365', 'rebuild-v364', 'rebuild-v363', 'rebuild-v362', 'rebuild-v361', 'rebuild-v360', 'rebuild-v359', 'rebuild-v358', 'rebuild-v352', 'v349-search-remote-pill-compaction-pass', 'v348-library-deep-signature-cache-smoke-pass', 'v352-content-cache-rawtext-smoke-pass', 'v355-reader-multi-episode-append-anchor-smoke-pass', 'v356-reader-episode-boundary-mode-smoke-pass', 'v357-reader-episode-boundary-scroll-beyond-smoke-pass', 'v358-reader-scroll-buffer-patch-anchor-smoke-pass', 'v359-reader-bottom-ratio-boundary-lock-smoke-pass', 'v360-reader-episode-bottom-anchor-smoke-pass', 'v366-search-compact-status-smoke-pass', 'v369-settings-connectivity-smoke-pass', 'v368-settings-connectivity-smoke-pass', 'v369-multi-file-progress-recent-smoke-pass', 'v369-library-readonly-mutation-error-smoke-pass', 'v365-search-continue-during-navigation-smoke-pass', 'v363-search-multi-episode-full-scan-smoke-pass', 'v362-reader-jump-panel-episode-select-smoke-pass', 'v361-reader-jump-panel-episode-select-smoke-pass', 'Rebuild Phase 145']) assert.ok(release.includes(marker), `release history must preserve marker: ${marker}`);
  return { pass: 'v380-docs-consolidation-smoke-pass', docs: files.length };
}
module.exports = { runDocsConsolidationSmoke };
if (require.main === module) console.log(JSON.stringify(runDocsConsolidationSmoke()));
