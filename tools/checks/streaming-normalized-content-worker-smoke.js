#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const iconv = require('iconv-lite');
const os = require('os');
const path = require('path');
const { createContentService } = require('../../server/services/content-service');
const { decodeTextBuffer } = require('../../server/services/text-decoder-service');
const { STREAMING_NORMALIZED_CONTENT_BUILD_PASS, StreamingNovelPreprocessor, LargeLineSpool, readEncodingSample } = require('../../server/services/streaming-normalized-content-builder');

const PASS = 'v571-streaming-normalized-content-worker-smoke-pass';

function encodedCases(text) {
  return [
    ['utf8', iconv.encode(text, 'utf8')],
    ['utf8-bom', Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), iconv.encode(text, 'utf8')])],
    ['cp949', iconv.encode(text, 'cp949')],
    ['utf16-le-bom', Buffer.concat([Buffer.from([0xFF, 0xFE]), iconv.encode(text, 'utf16-le')])],
    ['utf16-be-bom', Buffer.concat([Buffer.from([0xFE, 0xFF]), iconv.encode(text, 'utf16-be')])]
  ];
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v571-stream-worker-'));
  const common = {
    chunkIndexDir: path.join(tmp, 'chunk_indexes'),
    chunkPayloadDir: path.join(tmp, 'content_chunks'),
    normalizedContentDir: path.join(tmp, 'normalized_content'),
    diskCacheMinBytes: 0,
    chunkSize: 4093,
    chunkBoundaryLookahead: 12000,
    workerPoolSize: 1,
    workerQueueMax: 4
  };
  const source = ('제 1화\r\n한글 문장입니다.다음 문장입니다.\r\n漢字 日本語 English cafe\r\n').repeat(2200);
  const results = [];

  for (const [name, buffer] of encodedCases(source)) {
    const filePath = path.join(tmp, `${name}.txt`);
    fs.writeFileSync(filePath, buffer);
    const service = createContentService(common);
    const entry = await service.getCachedFileEntryAsync(filePath, {});
    const expectedDecoded = decodeTextBuffer(buffer);
    const expected = service.formatNovelText(expectedDecoded.text, {}).text;
    assert.strictEqual(entry.storage, 'disk');
    assert.strictEqual(entry.text, null, 'disk entry must not retain normalized text');
    assert.strictEqual(entry.sourceEncoding, expectedDecoded.encoding, `${name} encoding mismatch`);
    assert.strictEqual(entry.totalChars, expected.length, `${name} character length mismatch`);
    const rebuilt = fs.readFileSync(entry.normalizedCache.textPath).toString('utf16le');
    assert.strictEqual(rebuilt, expected, `${name} normalized output mismatch`);
    const meta = JSON.parse(fs.readFileSync(entry.normalizedCache.metaPath, 'utf8'));
    assert.strictEqual(meta.builderPass, STREAMING_NORMALIZED_CONTENT_BUILD_PASS);
    assert.strictEqual(meta.buildMode, 'streaming');
    assert.ok(meta.sourceSampleBytes <= 64 * 1024, 'encoding detection sample must stay bounded');
    const status = service.getCacheStatus();
    assert.strictEqual(status.streamingNormalizedContentBuildPass, STREAMING_NORMALIZED_CONTENT_BUILD_PASS);
    assert.strictEqual(status.metrics.normalizedCacheStreamingBuilds, 1);
    assert.strictEqual(status.metrics.contentWorkerTasksStarted, 1);
    service.closeWorkerPool();
    if (name === 'utf8') {
      const legacyMeta = JSON.parse(fs.readFileSync(entry.normalizedCache.metaPath, 'utf8'));
      const legacyIndex = JSON.parse(fs.readFileSync(entry.normalizedCache.indexPath, 'utf8'));
      for (const value of [legacyMeta, legacyIndex]) {
        delete value.builderPass;
        delete value.buildMode;
        delete value.sourceSampleBytes;
      }
      fs.writeFileSync(entry.normalizedCache.metaPath, JSON.stringify(legacyMeta), 'utf8');
      fs.writeFileSync(entry.normalizedCache.indexPath, JSON.stringify(legacyIndex), 'utf8');
      const compatibilityService = createContentService({ ...common, workerThreadsEnabled: false });
      const compatibilityEntry = await compatibilityService.getCachedFileEntryAsync(filePath, {});
      assert.strictEqual(compatibilityEntry.cacheKey, entry.cacheKey, 'v570 metadata without builder fields must remain readable');
      assert.strictEqual(compatibilityService.getCacheStatus().metrics.contentWorkerTasksStarted, 0);
      compatibilityService.closeWorkerPool();
    }
    results.push({ name, encoding: entry.sourceEncoding, chars: entry.totalChars });
  }

  // Legacy order regression: CR normalization must happen before zero-width removal.
  const edgeWriter = { value:'', write(value) { this.value += value; }, finish() { return {}; } };
  const edge = new StreamingNovelPreprocessor({}, edgeWriter);
  edge.writeDecoded('A\r\u200B\nB');
  edge.finish();
  assert.strictEqual(edgeWriter.value, 'A\n\nB', 'streaming normalization must preserve legacy fileChar semantics');

  // Network filesystems may return short positional reads; encoding sampling must fill the requested range.
  const shortReadPath = path.join(tmp, 'short-read-cp949.txt');
  fs.writeFileSync(shortReadPath, Buffer.concat([Buffer.alloc(4096, 0x41), iconv.encode('한글 문장 '.repeat(9000), 'cp949')]));
  const originalOpen = fs.promises.open;
  fs.promises.open = async (...args) => {
    const handle = await originalOpen(...args);
    const originalRead = handle.read.bind(handle);
    handle.read = (buffer, offset, length, position) => originalRead(buffer, offset, Math.min(length, 4096), position);
    return handle;
  };
  try {
    const detected = await readEncodingSample(shortReadPath, 10 * 1024 * 1024);
    assert.strictEqual(detected.sampleBytes, 64 * 1024, 'encoding sampler must continue after short reads');
    assert.strictEqual(detected.encoding, 'cp949');
  } finally {
    fs.promises.open = originalOpen;
  }

  // Long-line trailing-space scan must also tolerate repeated short reads.
  const shortSpoolDir = path.join(tmp, 'short-spool');
  const spool = new LargeLineSpool(shortSpoolDir, 'short-read');
  spool.append('가'.repeat(70000) + ' '.repeat(1000));
  const originalReadSync = fs.readSync;
  fs.readSync = (fd, buffer, offset, length, position) => originalReadSync(fd, buffer, offset, Math.min(length, 4096), position);
  try { assert.strictEqual(spool.findLogicalChars(), 70000); }
  finally { fs.readSync = originalReadSync; spool.remove(); }

  const abortSpoolDir = path.join(tmp, 'abort-spool');
  const abortPreprocessor = new StreamingNovelPreprocessor({}, { write() {}, finish() { return {}; } }, {
    largeLineSpoolDir: abortSpoolDir,
    largeLineSpoolPrefix: 'abort-test',
    largeLineSpoolChars: 64 * 1024
  });
  abortPreprocessor.writeDecoded('가'.repeat(70 * 1024));
  assert.ok(fs.readdirSync(abortSpoolDir).some((name) => name.endsWith('.line.tmp')), 'active long line must use a spool');
  abortPreprocessor.abort();
  assert.deepStrictEqual(fs.readdirSync(abortSpoolDir), [], 'streaming abort must remove active line spool');

  const longFilePath = path.join(tmp, 'long-single-paragraph.txt');
  const longText = ('긴문단😀 문장입니다.다음 문장입니다. ').repeat(150000);
  fs.writeFileSync(longFilePath, longText, 'utf8');
  const longService = createContentService(common);
  const longEntry = await longService.getCachedFileEntryAsync(longFilePath, {});
  assert.strictEqual(longEntry.storage, 'disk');
  assert.strictEqual(longEntry.text, null);
  assert.ok(longEntry.totalChars > 1_000_000);
  assert.ok(longEntry.totalChunks > 1);
  const first = await longService.getChunkByLineAsync(longEntry, 1);
  const last = await longService.getChunkByLineAsync(longEntry, longEntry.totalChunks);
  assert.ok(first.content.length > 0 && last.content.length > 0);
  assert.strictEqual(first.start, 0);
  assert.strictEqual(last.end, longEntry.totalChars);
  longService.closeWorkerPool();

  console.log(JSON.stringify({ pass: PASS, marker: STREAMING_NORMALIZED_CONTENT_BUILD_PASS, results, longChars: longEntry.totalChars }));
}

main().catch((error) => { console.error(error); process.exit(1); });
