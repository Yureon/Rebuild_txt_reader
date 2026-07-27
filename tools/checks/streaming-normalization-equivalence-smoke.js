#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createContentService } = require('../../server/services/content-service');
const {
  STREAMING_NORMALIZED_CONTENT_BUILD_PASS,
  StreamingChunkBounds,
  StreamingNovelPreprocessor
} = require('../../server/services/streaming-normalized-content-builder');

const PASS = 'v571-streaming-normalization-equivalence-smoke-pass';

class CollectingWriter {
  constructor() { this.text = ''; }
  write(value) { this.text += String(value || ''); }
  finish() {
    return {
      text: this.text,
      totalChars: this.text.length,
      totalChunks: 1,
      chunkBounds: [[0, this.text.length]],
      textHash: ''
    };
  }
}

function streamFormat(text, options, chunkPattern = [1, 3, 7, 31, 127], runtimeOptions = {}) {
  const writer = new CollectingWriter();
  const preprocessor = new StreamingNovelPreprocessor(options, writer, runtimeOptions);
  let offset = 0;
  let index = 0;
  while (offset < text.length) {
    const size = chunkPattern[index % chunkPattern.length];
    preprocessor.writeDecoded(text.slice(offset, offset + size));
    offset += size;
    index += 1;
  }
  const result = preprocessor.finish();
  return { text: result.text, stats: result.formatStats };
}

function makeOptions(mask) {
  return {
    removeNoise: !!(mask & 1),
    chapterSpacing: !!(mask & 2),
    collapseBreaks: !!(mask & 4),
    splitDense: !!(mask & 8),
    dialogueBreak: !!(mask & 16),
    paragraphOptimize: !!(mask & 32),
    aggressive: !!(mask & 64)
  };
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v571-stream-eq-'));
  const service = createContentService({
    chunkIndexDir: path.join(tmp, 'chunk_indexes'),
    workerThreadsEnabled: false,
    chunkSize: 97,
    chunkBoundaryLookahead: 251
  });
  const fixtures = [
    '',
    '\uFEFF',
    '\r\n\r첫 줄\r둘째 줄\n',
    [
      'https://example.com 광고 링크',
      '제 1화',
      '문장이 너무 붙어 있습니다.다음 문장입니다.',
      '', '', '  ',
      '“대사입니다.” 이어지는 설명입니다.'
    ].join('\n'),
    '짧은 줄\n다음 줄\n프롤로그\n내용',
    '“대사입니다.”   “다음 대사입니다.”   - 설명입니다.',
    '가'.repeat(180) + '다. 나. 라. 마.\n짧은줄\n이어짐',
    '  앞 공백\u00A0\n중간\t\t공백   \n끝  ',
    '😀𠮷'.repeat(512) + '\n' + '\u200B제로폭'.repeat(10),
    '\n\n\n앞\n\n \n\n뒤\n\n\n'
  ];

  let cases = 0;
  for (const fixture of fixtures) {
    for (let mask = 0; mask < 128; mask += 1) {
      const options = makeOptions(mask);
      const expected = service.formatNovelText(fixture, options);
      const actual = streamFormat(fixture, options);
      assert.strictEqual(actual.text, expected.text, `stream output mismatch for mask ${mask}`);
      assert.deepStrictEqual(actual.stats, expected.stats, `stream stats mismatch for mask ${mask}`);
      cases += 1;
    }
  }

  const largeFixture = '앞줄\n' + '제 777화 ' + ('긴문장입니다.다음문장입니다😀 '.repeat(30000)) + '   \n뒷줄';
  for (let mask = 0; mask < 128; mask += 1) {
    if (mask & 16 || mask & 32) continue;
    const options = makeOptions(mask);
    const expected = service.formatNovelText(largeFixture, options);
    const actual = streamFormat(largeFixture, options, [4093, 65537, 17], {
      largeLineSpoolDir: path.join(tmp, 'large-line-spool'),
      largeLineSpoolPrefix: `case-${mask}`,
      largeLineSpoolChars: 128 * 1024
    });
    assert.strictEqual(actual.text, expected.text, `large-line stream output mismatch for mask ${mask}`);
    assert.deepStrictEqual(actual.stats, expected.stats, `large-line stream stats mismatch for mask ${mask}`);
    cases += 1;
  }

  const largeNoiseFixture = '앞줄\n' + ('무의미한본문 '.repeat(70000)) + ' https://example.com 광고 링크' + '\n뒷줄';
  for (const options of [makeOptions(1), makeOptions(65), makeOptions(0)]) {
    const expected = service.formatNovelText(largeNoiseFixture, options);
    const actual = streamFormat(largeNoiseFixture, options, [8191, 131071], {
      largeLineSpoolDir: path.join(tmp, 'large-noise-spool'),
      largeLineSpoolPrefix: `noise-${cases}`,
      largeLineSpoolChars: 128 * 1024
    });
    assert.strictEqual(actual.text, expected.text, 'large noise-line stream output mismatch');
    assert.deepStrictEqual(actual.stats, expected.stats, 'large noise-line stream stats mismatch');
    cases += 1;
  }

  for (let seed = 1; seed <= 80; seed += 1) {
    const random = seededRandom(seed);
    let text = '';
    const length = 300 + Math.floor(random() * 3000);
    for (let index = 0; index < length; index += 1) {
      const value = random();
      text += value < 0.025 ? '\n' : value < 0.035 ? '😀' : String.fromCharCode(0xAC00 + Math.floor(random() * 11172));
    }
    const chunkSize = 1 + Math.floor(random() * 180);
    const lookahead = chunkSize + Math.floor(random() * 360);
    const expected = service.buildChunkBounds(text);
    const streaming = new StreamingChunkBounds(97, 251);
    let offset = 0;
    while (offset < text.length) {
      const size = 1 + Math.floor(random() * 111);
      streaming.append(text.slice(offset, offset + size));
      offset += size;
    }
    const fixedExpectedService = createContentService({
      chunkIndexDir: path.join(tmp, `bounds-${seed}`),
      workerThreadsEnabled: false,
      chunkSize: 97,
      chunkBoundaryLookahead: 251
    });
    assert.deepStrictEqual(streaming.finish(), fixedExpectedService.buildChunkBounds(text));
    fixedExpectedService.closeWorkerPool();
    assert.ok(Array.isArray(expected));
  }

  service.closeWorkerPool();
  console.log(JSON.stringify({ pass: PASS, marker: STREAMING_NORMALIZED_CONTENT_BUILD_PASS, cases }));
}

try { main(); }
catch (error) { console.error(error); process.exit(1); }
