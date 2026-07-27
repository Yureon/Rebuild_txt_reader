#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { createContentService } = require('../../server/services/content-service');
const { createBlockManifestService } = require('../../server/services/block-manifest-service');

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v570-manifest-'));
  const libraryPath = path.join(tmp, 'library');
  fs.mkdirSync(libraryPath, { recursive: true });
  const relPath = 'book.txt';
  const filePath = path.join(libraryPath, relPath);
  const raw = ('문단 하나😀 ' + '가'.repeat(1000) + '\n\n문단 둘 ' + '나'.repeat(900) + '\n').repeat(200);
  fs.writeFileSync(filePath, raw, 'utf8');
  const novel = { id: 'novel-1', title: '책', isMultiFile: false, singlePath: relPath, episodes: [] };
  const libraryService = {
    getLibraryCached() { return [novel]; },
    safeJoinUnderLibrary(value) {
      const resolved = path.resolve(libraryPath, value);
      assert.ok(resolved.startsWith(path.resolve(libraryPath) + path.sep));
      return resolved;
    }
  };
  const contentService = createContentService({
    chunkIndexDir: path.join(tmp, 'idx'),
    chunkPayloadDir: path.join(tmp, 'chunks'),
    normalizedContentDir: path.join(tmp, 'normalized'),
    diskCacheMinBytes: 0,
    chunkSize: 5000,
    chunkBoundaryLookahead: 10000,
    workerPoolSize: 1
  });
  const expected = contentService.formatNovelText(raw, {}).text;
  const manifestService = createBlockManifestService({ libraryPath, libraryService, contentService, manifestDiskCacheDir: path.join(tmp, 'manifests') });
  const result = await manifestService.getSingleManifest(novel.id, {});
  assert.equal(result.status, 200);
  const manifest = result.body;
  assert.equal(manifest.totalChars, expected.length, 'fileChar total must remain UTF-16 code-unit length');
  assert.equal(manifest.chunks[0].charStart, 0);
  assert.equal(manifest.chunks[manifest.chunks.length - 1].charEnd, expected.length);
  for (let i = 1; i < manifest.chunks.length; i += 1) assert.equal(manifest.chunks[i - 1].charEnd, manifest.chunks[i].charStart);
  for (const chunk of manifest.chunks) {
    for (const block of chunk.blocks) {
      assert.equal(block.charStart, chunk.charStart + block.localCharStart);
      assert.equal(block.charEnd, chunk.charStart + block.localCharEnd);
      assert.ok(block.charStart >= chunk.charStart && block.charEnd <= chunk.charEnd);
    }
  }
  contentService.closeWorkerPool();
  console.log(JSON.stringify({ pass: 'v570-block-manifest-range-locator-smoke-pass', totalChunks: manifest.totalChunks, totalBlocks: manifest.totalBlocks }));
}

main().catch((error) => { console.error(error); process.exit(1); });
