#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PASS = 'v348-library-deep-signature-cache-smoke-pass';

function encodeStableId(value) {
  return 'id-' + Buffer.from(String(value)).toString('hex').slice(0, 12);
}

function getEpisodeCount(library, title) {
  const novel = library.find(item => item && item.title === title);
  return novel && Array.isArray(novel.episodes) ? novel.episodes.length : 0;
}

function runLibraryDeepSignatureCacheSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runLibraryDeepSignatureCacheSmoke requires projectRoot');
  const { createLibraryService } = require(path.join(projectRoot, 'server/services/library-service.js'));
  const { parseNonNegativeInteger } = require(path.join(projectRoot, 'server/config/env.js'));

  assert.strictEqual(parseNonNegativeInteger('0', 2000), 0, 'zero deep signature TTL must be accepted');
  assert.strictEqual(parseNonNegativeInteger('2500', 2000), 2500, 'numeric deep signature TTL must be accepted');
  assert.strictEqual(parseNonNegativeInteger('-1', 2000), 2000, 'negative deep signature TTL must fall back');

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-library-deep-cache-'));
  try {
    const seriesDir = path.join(tempRoot, 'Series');
    fs.mkdirSync(seriesDir, { recursive: true });
    fs.writeFileSync(path.join(seriesDir, '1화.txt'), 'one', 'utf8');
    fs.writeFileSync(path.join(seriesDir, '2화.txt'), 'two', 'utf8');

    const service = createLibraryService({
      libraryPath: tempRoot,
      encodeStableId,
      libraryCacheTtlMs: 15000,
      libraryDeepSignatureCheckTtlMs: 0
    });

    const first = service.getLibraryCached();
    assert.strictEqual(getEpisodeCount(first, 'Series'), 2, 'initial cached library must include two episodes');
    let status = service.getCacheStatus();
    assert.strictEqual(status.libraryCache.buildCount, 1, 'initial getLibraryCached must build once');
    assert.ok(status.libraryCache.directorySignatureCount >= 2, 'library cache must remember traversed directory signatures');
    assert.strictEqual(status.libraryCache.deepSignatureCheckTtlMs, 0, 'service must expose configured deep signature TTL');

    fs.writeFileSync(path.join(seriesDir, '3화.txt'), 'three', 'utf8');
    const forcedMtime = new Date(Date.now() + 5000);
    fs.utimesSync(seriesDir, forcedMtime, forcedMtime);

    const second = service.getLibraryCached();
    assert.strictEqual(getEpisodeCount(second, 'Series'), 3, 'nested episode addition must invalidate library cache inside main TTL');
    status = service.getCacheStatus();
    assert.strictEqual(status.libraryCache.buildCount, 2, 'deep signature change must trigger exactly one rebuild');

    const third = service.getLibraryCached();
    assert.strictEqual(getEpisodeCount(third, 'Series'), 3, 'unchanged nested signatures must keep rebuilt cache');
    status = service.getCacheStatus();
    assert.strictEqual(status.libraryCache.buildCount, 2, 'unchanged deep signatures must not rebuild again');

    return {
      pass: PASS,
      buildCount: status.libraryCache.buildCount,
      directorySignatureCount: status.libraryCache.directorySignatureCount,
      deepSignatureCheckTtlMs: status.libraryCache.deepSignatureCheckTtlMs
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const projectRoot = path.resolve(__dirname, '..', '..');
  console.log(JSON.stringify(runLibraryDeepSignatureCacheSmoke(projectRoot)));
}

module.exports = {
  PASS,
  runLibraryDeepSignatureCacheSmoke
};
