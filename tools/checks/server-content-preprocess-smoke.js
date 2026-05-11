const SERVER_CONTENT_PREPROCESS_SMOKE_PASS = 'v212-server-content-preprocess-smoke-pass';

function loadContentModuleWithIconvFallback(projectRoot) {
  const path = require('path');
  const Module = require('module');
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'iconv-lite') return { decode: (buf) => Buffer.from(buf).toString('utf8') };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return require(path.join(projectRoot, 'server/services/content-service.js'));
  } finally {
    Module._load = originalLoad;
  }
}

function runServerContentPreprocessSmoke(projectRoot) {
  const contentModule = loadContentModuleWithIconvFallback(projectRoot);
  if (!contentModule || typeof contentModule.createContentService !== 'function') {
    throw new Error('content-service must export createContentService');
  }
  const service = contentModule.createContentService({ chunkIndexDir: require('path').join(projectRoot, '.tmp-check-chunks'), chunkSize: 64, fileCacheMax: 4, fileCacheMaxBytes: 1024 * 1024 });
  const parsed = service.parsePreprocessOptionsFromQuery({
    preRemoveNoise: '1',
    preChapterSpacing: 'true',
    preCollapseBreaks: '1',
    preSplitDense: '1',
    preDialogueBreak: '1',
    preParagraphOptimize: '1',
    preAggressive: '0'
  });
  const serialized = service.serializePreprocessOptions(parsed);
  ['rn1','cs1','cb1','sd1','db1','po1','ag0'].forEach((token) => {
    if (!serialized.includes(token)) throw new Error('Missing preprocess serialization token: ' + token);
  });

  const formatted = service.formatNovelText([
    'https://example.com 광고 링크',
    '제 1화',
    '문장이 너무 붙어 있습니다.다음 문장입니다.',
    '',
    '“대사입니다.”',
    '이어지는 설명입니다.'
  ].join('\n'), parsed);
  if (!formatted || typeof formatted.text !== 'string' || !formatted.stats) {
    throw new Error('formatNovelText must return { text, stats }');
  }
  if (formatted.text.includes('https://example.com')) throw new Error('removeNoise preprocessing did not remove URL noise line');
  if (!/제 1화/.test(formatted.text)) throw new Error('chapter line must be preserved after preprocessing');
  if (!Object.prototype.hasOwnProperty.call(formatted.stats, 'removedNoiseLines') || !Object.prototype.hasOwnProperty.call(formatted.stats, 'paragraphOptimizations')) {
    throw new Error('formatNovelText stats must include preprocess counters');
  }

  const bounds = service.buildChunkBounds('가'.repeat(80) + '\n' + '나'.repeat(80));
  if (!Array.isArray(bounds) || bounds.length < 2) throw new Error('buildChunkBounds should split long text with test chunk size');
  const entry = { text: 'abcdef\nghijkl', chunkBounds: [[0, 7], [7, 13]] };
  const chunk = service.getChunkByLine(entry, 2);
  if (!chunk || chunk.content !== 'ghijkl' || chunk.start !== 7 || chunk.end !== 13) {
    throw new Error('getChunkByLine must preserve chunk metadata and content');
  }

  return { pass: SERVER_CONTENT_PREPROCESS_SMOKE_PASS };
}

module.exports = {
  SERVER_CONTENT_PREPROCESS_SMOKE_PASS,
  runServerContentPreprocessSmoke
};
