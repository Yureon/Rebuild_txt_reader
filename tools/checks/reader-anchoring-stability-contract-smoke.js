#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const doc = read('docs/reader-anchoring-stability-contract.md');
const readme = read('docs/README.md');
const baseline = read('docs/reader-search-baseline.md');
const handoff = read('docs/handoff.md');
const smokeDocs = read('docs/smoke-tests.md');
const current = read('tools/checks/current-rebuild-version.js');

for (const token of [
  '기준 버전: rebuild-v488',
  'v487에서 사용자가 실제 체감상 안정 상태로 평가',
  '최적화, 코드 정리, 중복 제거, 성능 개선, 리팩터링을 이유로 아래 reader 좌표계 로직을 건드리지 않는다',
  'server/services/block-manifest-service.js',
  'public/scripts/rebuild/features/reader/virtual-layout.mjs',
  'fileCharIndex / totalManifestChars',
  'chunk.blocks[].charStart',
  'enrichAppendAnchorWithFileChar()',
  'applyAppendFileCharAnchor()',
  'enrichPrependAnchorWithFileChar()',
  'applyPrependFileCharAnchor()',
  'resolveNativeForwardMeasureCommitFreeze()',
  'resolveNativeBackwardMeasureCommitFreeze()',
  'v485-reader-slider-coast-thumb-settle-pass',
  'pendingScrollTarget',
  'row.scrollIntoView()',
  'v488-reader-anchoring-stability-contract-pass'
]) {
  assert.ok(doc.includes(token), `stability contract missing ${token}`);
}

assert.ok(readme.includes('reader-anchoring-stability-contract.md'), 'docs README must link stability contract');
assert.ok(baseline.includes('v488 reader anchoring stability contract'), 'reader baseline must mention v488 stability contract');
assert.ok(handoff.includes('v488 reader 안정화 보호 인수인계'), 'handoff must include v488 reader stability handoff');
assert.ok(smokeDocs.includes('reader-anchoring-stability-contract-smoke.js'), 'smoke docs must mention contract smoke');
assert.ok(current.includes("anchorStability: 'docs/reader-anchoring-stability-contract.md'"), 'current version docs map must include stability contract');

console.log('v488-reader-anchoring-stability-contract-smoke-pass');
