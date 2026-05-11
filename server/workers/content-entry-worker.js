const fs = require('fs');
const crypto = require('crypto');
const { decodeTextBuffer } = require('../services/text-decoder-service');

const MAX_TEXT_FILE_BYTES_PASS = 'v530-max-text-file-bytes-pass';
const CONTENT_ENTRY_WORKER_PASS = 'v541-content-entry-worker-pass';

function sha1(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}

function createTextFileTooLargeError(filePath, size, maxBytes) {
  const err = new Error('text file is larger than MAX_TEXT_FILE_BYTES');
  err.code = 'TEXT_FILE_TOO_LARGE';
  err.status = 413;
  err.statusCode = 413;
  err.filePath = filePath;
  err.size = Number(size) || 0;
  err.maxBytes = Number(maxBytes) || 0;
  err.pass = MAX_TEXT_FILE_BYTES_PASS;
  return err;
}

function assertTextFileSizeAllowed(filePath, maxTextFileBytes) {
  const limit = Math.max(0, Number(maxTextFileBytes) || 0);
  if (!limit) return null;
  const stat = fs.statSync(filePath);
  const size = Math.max(0, Number(stat && stat.size) || 0);
  if (size > limit) throw createTextFileTooLargeError(filePath, size, limit);
  return { size, maxBytes: limit, pass: MAX_TEXT_FILE_BYTES_PASS };
}

function readFileAutoEncoding(filePath, maxTextFileBytes) {
  assertTextFileSizeAllowed(filePath, maxTextFileBytes);
  const started = Date.now();
  const raw = fs.readFileSync(filePath);
  const decoded = decodeTextBuffer(raw);
  return { text: decoded.text, encoding: decoded.encoding, fileReadMs: Math.max(0, Date.now() - started), fileReadCalls: 1 };
}

function normalizePreprocessOptions(input) {
  const src = input && typeof input === 'object' ? input : {};
  return {
    removeNoise: src.removeNoise !== false,
    chapterSpacing: src.chapterSpacing !== false,
    collapseBreaks: src.collapseBreaks !== false,
    splitDense: src.splitDense !== false,
    dialogueBreak: src.dialogueBreak === true,
    paragraphOptimize: src.paragraphOptimize === true,
    aggressive: src.aggressive === true
  };
}

function formatNovelText(text, preprocessOptions) {
  const opts = normalizePreprocessOptions(preprocessOptions);
  let out = String(text || '');
  const stats = {
    removedNoiseLines: 0,
    chapterSpacingAdds: 0,
    collapsedBlankRuns: 0,
    splitDenseSentences: 0,
    dialogueBreaks: 0,
    paragraphOptimizations: 0
  };

  out = out.replace(/^\uFEFF/, '');
  out = out.replace(/\r\n?/g, '\n');
  out = out.replace(/[\u200B-\u200D\u2060]/g, '');
  out = out.replace(/\t/g, '  ');
  out = out.replace(/[ \u00A0]+$/gm, '');

  let lines = out.split('\n');
  if (opts.removeNoise || opts.aggressive) {
    const noiseLineRe = /(?:https?:\/\/|www\.|open\.kakao|discord|telegram|t\.me|blog\.naver|cafe\.naver|txt\s*공유|무단\s*배포|다운로드\s*링크|후원\s*링크|광고)/i;
    const aggressiveRe = /(?:작가\s*후기|공지사항|외부\s*링크|배포\s*안내|감사합니다\s*후원)/i;
    lines = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (opts.removeNoise && noiseLineRe.test(trimmed)) {
        stats.removedNoiseLines += 1;
        return false;
      }
      if (opts.aggressive && aggressiveRe.test(trimmed)) {
        stats.removedNoiseLines += 1;
        return false;
      }
      return true;
    });
  }

  out = lines.join('\n');

  if (opts.splitDense) {
    out = out.replace(/([.!?…]|[다요죠니다]\.)((?:[가-힣A-Z"'(\[]))/g, (m, a, b) => {
      stats.splitDenseSentences += 1;
      return a + ' ' + b;
    });
  }

  if (opts.dialogueBreak) {
    out = out.split('\n').map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 24) return line;
      return line
        .replace(/([.!?…]["'”’」』》】]*)\s+(?=(?:["“‘「『〈《【\[]))/g, (m, a) => {
          stats.dialogueBreaks += 1;
          return a + '\n';
        })
        .replace(/([.!?…]["'”’」』》】]*)\s+(?=(?:-|—|―)\s*)/g, (m, a) => {
          stats.dialogueBreaks += 1;
          return a + '\n';
        });
    }).join('\n');
  }

  if (opts.chapterSpacing) {
    const chapterRe = /^\s*(?:프롤로그|에필로그|외전|후기|제\s*\d+\s*[화장편막]|\[\s*제?\s*\d+.*\]|#\s*\d+)/;
    const chapterLines = out.split('\n');
    const next = [];
    chapterLines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && chapterRe.test(trimmed) && next.length && next[next.length - 1] !== '') {
        next.push('');
        stats.chapterSpacingAdds += 1;
      }
      next.push(line);
    });
    out = next.join('\n');
  }

  if (opts.paragraphOptimize) {
    const sourceLines = out.split('\n');
    const optimized = [];
    const dialogueLike = (txt) => /^(?:["“‘「『〈《【\[]|[-—―]\s*)/.test(txt.trim());
    const sentenceCount = (txt) => (txt.match(/[.!?…](?=\s|$|["'”’」』》】])/g) || []).length;

    for (let i = 0; i < sourceLines.length; i++) {
      let line = sourceLines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        optimized.push('');
        continue;
      }

      if (trimmed.length > 120 && sentenceCount(trimmed) >= 3 && !dialogueLike(trimmed)) {
        line = line.replace(/([.!?…]["'”’」』》】]*)\s+(?=[^\n])/g, (m, a) => {
          stats.paragraphOptimizations += 1;
          return a + '\n';
        });
      }

      const prev = optimized.length ? optimized[optimized.length - 1] : '';
      const prevTrim = String(prev || '').trim();
      if (
        prevTrim &&
        prevTrim.length <= 34 &&
        trimmed.length <= 34 &&
        !/[.!?…]["'”’」』》】]*$/.test(prevTrim) &&
        !dialogueLike(prevTrim) &&
        !dialogueLike(trimmed)
      ) {
        optimized[optimized.length - 1] = prevTrim + ' ' + trimmed;
        stats.paragraphOptimizations += 1;
      } else {
        optimized.push(line);
      }
    }

    out = optimized.join('\n');
  }

  if (opts.collapseBreaks) {
    out = out.replace(/\n{3,}/g, () => {
      stats.collapsedBlankRuns += 1;
      return '\n\n';
    });
  }

  out = out.replace(/[ \t]{2,}/g, ' ');
  out = out.replace(/^\s+$/gm, '');
  return { text: out.trim(), stats };
}

function buildChunkBounds(text, chunkSize, chunkBoundaryLookahead) {
  const source = String(text || '');
  const bounds = [];
  let pos = 0;
  const length = source.length;
  const safeChunkSize = Math.max(1, Number(chunkSize) || 50000);
  const lookahead = Math.max(safeChunkSize, Number(chunkBoundaryLookahead) || 250000);

  while (pos < length) {
    const target = Math.min(length, pos + safeChunkSize);
    let end = target;
    if (target < length) {
      const maxBoundary = Math.min(length, target + lookahead);
      const nextNewline = source.indexOf('\n', target);
      if (nextNewline !== -1 && nextNewline + 1 <= maxBoundary) {
        end = nextNewline + 1;
      } else {
        const previousNewline = source.lastIndexOf('\n', maxBoundary);
        end = previousNewline >= target ? previousNewline + 1 : maxBoundary;
      }
    }
    if (end <= pos) end = Math.min(length, pos + safeChunkSize);
    bounds.push([pos, end]);
    pos = end;
  }

  if (!bounds.length) bounds.push([0, 0]);
  return bounds;
}

function estimateFileCacheEntryBytes(text, chunkBounds) {
  try {
    return Buffer.byteLength(String(text || ''), 'utf8') + Buffer.byteLength(JSON.stringify(chunkBounds || []), 'utf8');
  } catch (e) {
    return Buffer.byteLength(String(text || ''), 'utf8');
  }
}

function serializeError(error) {
  return {
    name: error && error.name || 'Error',
    message: error && error.message || String(error || 'content worker failed'),
    code: error && error.code || undefined,
    status: error && error.status || undefined,
    statusCode: error && error.statusCode || undefined,
    size: error && error.size || undefined,
    maxBytes: error && error.maxBytes || undefined,
    pass: error && error.pass || CONTENT_ENTRY_WORKER_PASS,
    stack: error && error.stack || undefined
  };
}

async function run(payload = {}) {
  const filePath = String(payload.filePath || '');
  const read = readFileAutoEncoding(filePath, payload.maxTextFileBytes);
  const formatted = formatNovelText(read.text, payload.preprocessOptions || {});
  const text = formatted.text;
  const chunkBounds = Array.isArray(payload.chunkBounds) && payload.chunkBounds.length
    ? payload.chunkBounds
    : buildChunkBounds(text, payload.chunkSize, payload.chunkBoundaryLookahead);
  return {
    pass: CONTENT_ENTRY_WORKER_PASS,
    text,
    textHash: sha1(text),
    chunkBounds,
    statSig: String(payload.statSig || ''),
    formatStats: formatted.stats || {},
    bytes: estimateFileCacheEntryBytes(text, chunkBounds),
    fileReadMs: read.fileReadMs,
    fileReadCalls: read.fileReadCalls || 1
  };
}

const { parentPort } = require('worker_threads');
parentPort.on('message', async (message) => {
  const id = message && message.id;
  try {
    const result = await run(message && message.payload || {});
    parentPort.postMessage({ id, ok: true, result });
  } catch (error) {
    parentPort.postMessage({ id, ok: false, error: serializeError(error) });
  }
});
