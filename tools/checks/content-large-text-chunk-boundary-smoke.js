const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createContentService, CONTENT_LARGE_TEXT_CHUNK_BOUNDARY_PASS } = require('../../server/services/content-service.js');
assert.strictEqual(CONTENT_LARGE_TEXT_CHUNK_BOUNDARY_PASS, 'v456-content-large-text-chunk-boundary-pass');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-large-chunk-'));
try {
  const service = createContentService({ chunkIndexDir: tmp, chunkSize: 50000, chunkBoundaryLookahead: 250000 });
  const denseBounds = service.buildChunkBounds('가'.repeat(1100000));
  assert(denseBounds.length > 3, 'large no-newline text should not collapse into one huge chunk');
  assert(Math.max(...denseBounds.map(([a, b]) => b - a)) <= 300000, 'large no-newline chunk should be bounded');
  const newlineBounds = service.buildChunkBounds('가'.repeat(50000) + '나'.repeat(30000) + '\n' + '다'.repeat(1000));
  assert.strictEqual(newlineBounds[0][1], 80001, 'newline within the bounded lookahead should be preferred');
  const status = service.getCacheStatus();
  assert.strictEqual(status.largeTextChunkBoundaryPass, CONTENT_LARGE_TEXT_CHUNK_BOUNDARY_PASS);
  assert.strictEqual(status.fileCacheLimits.chunkBoundaryLookahead, 250000);
  console.log('v456-content-large-text-chunk-boundary-smoke-pass');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
