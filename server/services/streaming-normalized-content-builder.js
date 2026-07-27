const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const iconv = require('iconv-lite');
const { decodeTextBuffer } = require('./text-decoder-service');
const {
  NORMALIZED_CONTENT_ENCODING,
  NORMALIZED_CHUNK_HASH_ALGORITHM,
  buildNormalizedCacheDescriptor,
  hashNormalizedChunkBuffer,
  serializeNormalizedCacheMetadata
} = require('./normalized-content-cache');

const STREAMING_NORMALIZED_CONTENT_BUILD_PASS = 'v571-streaming-normalized-content-build-pass';
const DEFAULT_SOURCE_SAMPLE_BYTES = 64 * 1024;
const DEFAULT_SOURCE_READ_HIGH_WATER_MARK = 128 * 1024;
const DEFAULT_OUTPUT_WRITE_CHARS = 256 * 1024;
const DEFAULT_LARGE_LINE_SPOOL_CHARS = 512 * 1024;
const DEFAULT_LINE_SCAN_CHARS = 128 * 1024;

const NOISE_LINE_RE = /(?:https?:\/\/|www\.|open\.kakao|discord|telegram|t\.me|blog\.naver|cafe\.naver|txt\s*공유|무단\s*배포|다운로드\s*링크|후원\s*링크|광고)/i;
const AGGRESSIVE_LINE_RE = /(?:작가\s*후기|공지사항|외부\s*링크|배포\s*안내|감사합니다\s*후원)/i;
const CHAPTER_RE = /^\s*(?:프롤로그|에필로그|외전|후기|제\s*\d+\s*[화장편막]|\[\s*제?\s*\d+.*\]|#\s*\d+)/;
const DIALOGUE_LIKE_RE = /^(?:["“‘「『〈《【\[]|[-—―]\s*)/;
const SENTENCE_END_RE = /[.!?…](?=\s|$|["'”’」』》】])/g;
const PARAGRAPH_SPLIT_RE = /([.!?…]["'”’」』》】]*)\s+(?=[^\n])/g;

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

function createFormatStats() {
  return {
    removedNoiseLines: 0,
    chapterSpacingAdds: 0,
    collapsedBlankRuns: 0,
    splitDenseSentences: 0,
    dialogueBreaks: 0,
    paragraphOptimizations: 0
  };
}

function statSignature(filePath) {
  const st = fs.statSync(filePath);
  return [
    Math.max(0, Number(st.size) || 0),
    Math.floor(Number(st.mtimeMs) || 0),
    Number.isFinite(Number(st.ino)) ? Number(st.ino) : 0,
    Number.isFinite(Number(st.dev)) ? Number(st.dev) : 0
  ].join(':');
}

function removeIfExists(filePath) {
  try { fs.unlinkSync(filePath); }
  catch (error) { if (!error || error.code !== 'ENOENT') throw error; }
}

function atomicReplace(tempPath, finalPath) {
  try { fs.renameSync(tempPath, finalPath); }
  catch (error) {
    if (error && (error.code === 'EEXIST' || error.code === 'EPERM')) {
      removeIfExists(finalPath);
      fs.renameSync(tempPath, finalPath);
      return;
    }
    throw error;
  }
}

function writeJsonFileDurable(filePath, value) {
  const fd = fs.openSync(filePath, 'wx', 0o600);
  let closed = false;
  try {
    fs.writeFileSync(fd, JSON.stringify(value), 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    closed = true;
  } finally {
    if (!closed) try { fs.closeSync(fd); } catch (_) {}
  }
}

async function readExactlyAsync(handle, buffer, position) {
  let offset = 0;
  while (offset < buffer.length) {
    const result = await handle.read(buffer, offset, buffer.length - offset, position + offset);
    const bytesRead = Math.max(0, Number(result && result.bytesRead) || 0);
    if (!bytesRead) break;
    offset += bytesRead;
  }
  return offset;
}

function readExactlySync(fd, buffer, position) {
  let offset = 0;
  while (offset < buffer.length) {
    const bytesRead = fs.readSync(fd, buffer, offset, buffer.length - offset, position + offset);
    if (!bytesRead) break;
    offset += bytesRead;
  }
  return offset;
}

async function readEncodingSample(filePath, maxTextFileBytes, sampleBytes = DEFAULT_SOURCE_SAMPLE_BYTES) {
  const stat = await fs.promises.stat(filePath);
  const size = Math.max(0, Number(stat.size) || 0);
  const limit = Math.max(0, Number(maxTextFileBytes) || 0);
  if (limit && size > limit) {
    const error = new Error('text file is larger than MAX_TEXT_FILE_BYTES');
    error.code = 'TEXT_FILE_TOO_LARGE';
    error.status = 413;
    error.statusCode = 413;
    error.size = size;
    error.maxBytes = limit;
    throw error;
  }
  const length = Math.min(size, Math.max(4096, Number(sampleBytes) || DEFAULT_SOURCE_SAMPLE_BYTES));
  if (!length) return { encoding: 'utf8', sampleBytes: 0, size };
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(length);
    const bytesRead = await readExactlyAsync(handle, buffer, 0);
    const sample = bytesRead === length ? buffer : buffer.subarray(0, bytesRead);
    const detected = decodeTextBuffer(sample);
    return {
      encoding: String(detected && detected.encoding || 'utf8'),
      sampleBytes: bytesRead,
      size,
      heuristic: String(detected && detected.heuristic || (detected && detected.bom ? 'bom' : '')),
      candidatesChecked: Math.max(0, Number(detected && detected.candidatesChecked) || 0)
    };
  } finally {
    await handle.close();
  }
}

class StreamingChunkBounds {
  constructor(chunkSize, chunkBoundaryLookahead, onCommit = null) {
    this.chunkSize = Math.max(1, Number(chunkSize) || 50000);
    this.lookahead = Math.max(this.chunkSize, Number(chunkBoundaryLookahead) || 250000);
    this.pending = '';
    this.start = 0;
    this.bounds = [];
    this.onCommit = typeof onCommit === 'function' ? onCommit : null;
  }

  append(value) {
    if (!value) return;
    this.pending += value;
    const maxDistance = this.chunkSize + this.lookahead;
    while (this.pending.length > maxDistance) this.commitOne(false);
  }

  commitOne(eof) {
    const length = this.pending.length;
    if (!length) return false;
    const target = Math.min(length, this.chunkSize);
    let end = target;
    if (target < length) {
      const maxBoundary = Math.min(length, this.chunkSize + this.lookahead);
      const nextNewline = this.pending.indexOf('\n', target);
      if (nextNewline !== -1 && nextNewline + 1 <= maxBoundary) {
        end = nextNewline + 1;
      } else {
        const previousNewline = this.pending.lastIndexOf('\n', maxBoundary);
        end = previousNewline >= target ? previousNewline + 1 : maxBoundary;
      }
    } else if (!eof) {
      return false;
    }
    if (end <= 0) end = Math.min(length, this.chunkSize);
    if (end > 0 && end < length) {
      const previousCode = this.pending.charCodeAt(end - 1);
      const nextCode = this.pending.charCodeAt(end);
      if (previousCode >= 0xD800 && previousCode <= 0xDBFF && nextCode >= 0xDC00 && nextCode <= 0xDFFF) end += 1;
    }
    const committedText = this.pending.slice(0, end);
    this.bounds.push([this.start, this.start + end]);
    if (this.onCommit) this.onCommit(committedText, this.bounds.length - 1);
    this.start += end;
    this.pending = this.pending.slice(end);
    return true;
  }

  finish() {
    while (this.pending.length) this.commitOne(true);
    if (!this.bounds.length) this.bounds.push([0, 0]);
    return this.bounds;
  }
}

class DurableNormalizedTextWriter {
  constructor(filePath, chunkSize, chunkBoundaryLookahead) {
    this.filePath = filePath;
    this.fd = fs.openSync(filePath, 'wx', 0o600);
    this.closed = false;
    this.hash = crypto.createHash('sha1');
    this.totalChars = 0;
    this.pendingHighSurrogate = '';
    this.pendingWrite = '';
    this.chunkHashes = [];
    this.chunkBounds = new StreamingChunkBounds(chunkSize, chunkBoundaryLookahead, (chunkText) => {
      this.chunkHashes.push(hashNormalizedChunkBuffer(Buffer.from(chunkText, NORMALIZED_CONTENT_ENCODING)));
    });
  }

  write(value) {
    let text = String(value || '');
    if (!text && !this.pendingHighSurrogate) return;
    if (this.pendingHighSurrogate) {
      text = this.pendingHighSurrogate + text;
      this.pendingHighSurrogate = '';
    }
    if (text) {
      const lastCode = text.charCodeAt(text.length - 1);
      if (lastCode >= 0xD800 && lastCode <= 0xDBFF) {
        this.pendingHighSurrogate = text.slice(-1);
        text = text.slice(0, -1);
      }
    }
    if (!text) return;
    this.pendingWrite += text;
    this.flushPendingWrite(false);
  }

  commitPart(part) {
    if (!part) return;
    const buffer = Buffer.from(part, NORMALIZED_CONTENT_ENCODING);
    let written = 0;
    while (written < buffer.length) written += fs.writeSync(this.fd, buffer, written, buffer.length - written, null);
    this.hash.update(part, 'utf8');
    this.totalChars += part.length;
    this.chunkBounds.append(part);
  }

  flushPendingWrite(force) {
    const step = DEFAULT_OUTPUT_WRITE_CHARS;
    while (this.pendingWrite.length >= step || (force && this.pendingWrite.length)) {
      let end = force ? Math.min(this.pendingWrite.length, step) : step;
      if (end < this.pendingWrite.length) {
        const previousCode = this.pendingWrite.charCodeAt(end - 1);
        const nextCode = this.pendingWrite.charCodeAt(end);
        if (previousCode >= 0xD800 && previousCode <= 0xDBFF && nextCode >= 0xDC00 && nextCode <= 0xDFFF) end += 1;
      }
      const part = this.pendingWrite.slice(0, end);
      this.pendingWrite = this.pendingWrite.slice(end);
      this.commitPart(part);
    }
  }

  finish() {
    if (this.pendingHighSurrogate) {
      this.pendingWrite += this.pendingHighSurrogate;
      this.pendingHighSurrogate = '';
    }
    this.flushPendingWrite(true);
    fs.fsyncSync(this.fd);
    fs.closeSync(this.fd);
    this.closed = true;
    const chunkBounds = this.chunkBounds.finish();
    if (!this.chunkHashes.length && chunkBounds.length === 1 && chunkBounds[0][0] === 0 && chunkBounds[0][1] === 0) {
      this.chunkHashes.push(hashNormalizedChunkBuffer(Buffer.alloc(0)));
    }
    return {
      totalChars: this.totalChars,
      totalChunks: chunkBounds.length,
      chunkBounds,
      chunkHashes: this.chunkHashes.slice(),
      chunkHashAlgorithm: NORMALIZED_CHUNK_HASH_ALGORITHM,
      textHash: this.hash.digest('hex')
    };
  }

  abort() {
    if (!this.closed) {
      try { fs.closeSync(this.fd); } catch (_) {}
      this.closed = true;
    }
  }
}

class TrimmedLineOutput {
  constructor(writer) {
    this.writer = writer;
    this.currentLine = '';
    this.hasPendingLine = false;
    this.pendingLine = '';
    this.hasStreamedPendingLine = false;
    this.streamedLineOpen = false;
    this.streamedTrailingWhitespace = '';
    this.pendingEmptyLines = 0;
    this.hasEverLine = false;
  }

  writeText(value) {
    if (value) this.currentLine += value;
  }

  writeNewlines(count) {
    const amount = Math.max(0, Number(count) || 0);
    for (let index = 0; index < amount; index += 1) {
      this.finishCurrentLine();
      this.currentLine = '';
    }
  }

  flushPendingBeforeNextLine() {
    if (this.hasPendingLine) {
      this.writer.write(this.pendingLine);
      this.writer.write('\n'.repeat(Math.min(1, this.pendingEmptyLines) + 1));
    } else if (this.hasStreamedPendingLine) {
      this.writer.write(this.streamedTrailingWhitespace);
      this.writer.write('\n'.repeat(Math.min(1, this.pendingEmptyLines) + 1));
    }
    this.hasPendingLine = false;
    this.pendingLine = '';
    this.hasStreamedPendingLine = false;
    this.streamedLineOpen = false;
    this.streamedTrailingWhitespace = '';
    this.pendingEmptyLines = 0;
  }

  finishCurrentLine() {
    if (this.streamedLineOpen) {
      this.streamedLineOpen = false;
      return;
    }
    let line = this.currentLine.replace(/[ \t]{2,}/g, ' ');
    if (/^\s+$/.test(line)) line = '';
    if (!line) {
      if (this.hasPendingLine || this.hasStreamedPendingLine) this.pendingEmptyLines += 1;
      return;
    }
    const isFirst = !this.hasEverLine;
    if (this.hasPendingLine || this.hasStreamedPendingLine) this.flushPendingBeforeNextLine();
    this.pendingLine = isFirst ? line.trimStart() : line;
    this.pendingEmptyLines = 0;
    this.hasPendingLine = true;
    this.hasEverLine = true;
  }

  writeLargeLine(produce) {
    const isFirst = !this.hasEverLine;
    if (this.hasPendingLine || this.hasStreamedPendingLine) this.flushPendingBeforeNextLine();
    let started = false;
    let whitespace = '';
    let asciiWhitespaceRun = 0;
    let output = '';
    const emit = (value) => {
      const text = String(value || '');
      if (!text) return;
      output += text;
      if (output.length >= 64 * 1024) {
        this.writer.write(output);
        output = '';
      }
    };
    const flushOutput = () => {
      if (!output) return;
      this.writer.write(output);
      output = '';
    };
    const resetWhitespace = () => {
      whitespace = '';
      asciiWhitespaceRun = 0;
    };
    const appendWhitespaceRun = (value) => {
      const parts = String(value || '').match(/[ \t]+|[^ \t]+/g) || [];
      for (const part of parts) {
        const first = part.charAt(0);
        if (first === ' ' || first === '\t') {
          if (asciiWhitespaceRun === 0) {
            if (part.length === 1) {
              whitespace += first;
              asciiWhitespaceRun = 1;
            } else {
              whitespace += ' ';
              asciiWhitespaceRun = 2;
            }
          } else if (asciiWhitespaceRun === 1) {
            whitespace = whitespace.slice(0, -1) + ' ';
            asciiWhitespaceRun = 2;
          }
          continue;
        }
        asciiWhitespaceRun = 0;
        whitespace += part;
      }
    };
    const accept = (value) => {
      const text = String(value || '');
      if (!text) return;
      const whitespacePattern = /\s+/g;
      let offset = 0;
      let match = null;
      const acceptNonWhitespace = (part) => {
        if (!part) return;
        if (!started) {
          if (!isFirst) emit(whitespace);
          resetWhitespace();
          started = true;
        } else if (whitespace) {
          emit(whitespace);
          resetWhitespace();
        }
        emit(part);
      };
      while ((match = whitespacePattern.exec(text))) {
        acceptNonWhitespace(text.slice(offset, match.index));
        appendWhitespaceRun(match[0]);
        offset = match.index + match[0].length;
      }
      acceptNonWhitespace(text.slice(offset));
    };
    produce(accept);
    flushOutput();
    if (!started) return false;
    this.hasStreamedPendingLine = true;
    this.streamedLineOpen = true;
    this.streamedTrailingWhitespace = whitespace;
    this.pendingEmptyLines = 0;
    this.hasEverLine = true;
    return true;
  }

  finish() {
    this.finishCurrentLine();
    if (this.hasPendingLine) this.writer.write(this.pendingLine.trimEnd());
    this.streamedTrailingWhitespace = '';
    return this.writer.finish();
  }
}

class NewlineCollapseStream {
  constructor(postProcessor, collapseBreaks, stats) {
    this.postProcessor = postProcessor;
    this.collapseBreaks = collapseBreaks;
    this.stats = stats;
    this.pendingNewlines = 0;
  }

  write(value) {
    const text = String(value || '');
    if (!text) return;
    let start = 0;
    while (start <= text.length) {
      const newline = text.indexOf('\n', start);
      if (newline < 0) {
        if (start < text.length) {
          this.flushNewlines();
          this.postProcessor.writeText(text.slice(start));
        }
        return;
      }
      if (newline > start) {
        this.flushNewlines();
        this.postProcessor.writeText(text.slice(start, newline));
      }
      this.pendingNewlines += 1;
      start = newline + 1;
      if (start === text.length) return;
    }
  }

  separator() {
    this.pendingNewlines += 1;
  }

  writeLargeLine(produce) {
    this.flushNewlines();
    return this.postProcessor.writeLargeLine(produce);
  }

  flushNewlines() {
    if (!this.pendingNewlines) return;
    let count = this.pendingNewlines;
    if (this.collapseBreaks && count >= 3) {
      count = 2;
      this.stats.collapsedBlankRuns += 1;
    }
    this.postProcessor.writeNewlines(count);
    this.pendingNewlines = 0;
  }

  finish() {
    this.flushNewlines();
    return this.postProcessor.finish();
  }
}


class LargeLineSpool {
  constructor(dir, prefix = 'line') {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.path = pathJoinSafe(dir, `${prefix}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.line.tmp`);
    this.fd = fs.openSync(this.path, 'wx', 0o600);
    this.closed = false;
    this.totalChars = 0;
  }

  append(value) {
    const text = String(value || '');
    if (!text) return;
    const buffer = Buffer.from(text, NORMALIZED_CONTENT_ENCODING);
    let written = 0;
    while (written < buffer.length) written += fs.writeSync(this.fd, buffer, written, buffer.length - written, null);
    this.totalChars += text.length;
  }

  close() {
    if (this.closed) return;
    fs.closeSync(this.fd);
    this.closed = true;
  }

  findLogicalChars() {
    this.close();
    let remaining = this.totalChars;
    const charsPerRead = 64 * 1024;
    const fd = fs.openSync(this.path, 'r');
    try {
      while (remaining > 0) {
        const count = Math.min(charsPerRead, remaining);
        const buffer = Buffer.allocUnsafe(count * 2);
        const bytesRead = readExactlySync(fd, buffer, (remaining - count) * 2);
        const text = buffer.subarray(0, bytesRead).toString(NORMALIZED_CONTENT_ENCODING);
        let index = text.length;
        while (index > 0) {
          const code = text.charCodeAt(index - 1);
          if (code !== 0x20 && code !== 0x00A0) return remaining - (text.length - index);
          index -= 1;
        }
        remaining -= text.length;
      }
      return 0;
    } finally {
      fs.closeSync(fd);
    }
  }

  forEachChunk(totalChars, callback) {
    this.close();
    const fd = fs.openSync(this.path, 'r');
    let offsetChars = 0;
    try {
      while (offsetChars < totalChars) {
        const count = Math.min(DEFAULT_LINE_SCAN_CHARS, totalChars - offsetChars);
        const buffer = Buffer.allocUnsafe(count * 2);
        let offsetBytes = 0;
        while (offsetBytes < buffer.length) {
          const bytesRead = fs.readSync(fd, buffer, offsetBytes, buffer.length - offsetBytes, offsetChars * 2 + offsetBytes);
          if (!bytesRead) throw new Error('large line spool ended unexpectedly');
          offsetBytes += bytesRead;
        }
        callback(buffer.toString(NORMALIZED_CONTENT_ENCODING));
        offsetChars += count;
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  remove() {
    if (!this.closed) {
      try { fs.closeSync(this.fd); } catch (_) {}
      this.closed = true;
    }
    try { fs.unlinkSync(this.path); } catch (error) { if (!error || error.code !== 'ENOENT') throw error; }
  }
}

function pathJoinSafe(dir, fileName) {
  const root = path.resolve(String(dir || ''));
  const candidate = path.resolve(root, String(fileName || ''));
  if (candidate === root || !candidate.startsWith(root + path.sep)) throw new Error('large line spool escaped cache directory');
  return candidate;
}

class StreamingNovelPreprocessor {
  constructor(preprocessOptions, writer, runtimeOptions = {}) {
    this.options = normalizePreprocessOptions(preprocessOptions);
    this.stats = createFormatStats();
    this.postProcessor = new TrimmedLineOutput(writer);
    this.newlineStream = new NewlineCollapseStream(this.postProcessor, this.options.collapseBreaks, this.stats);
    this.hasPreFinalElement = false;
    this.hasParagraphPending = false;
    this.paragraphPending = '';
    this.chapterLineCount = 0;
    this.lastChapterLine = '';
    this.retainedLineCount = 0;
    this.currentDecodedLine = '';
    this.largeLineSpool = null;
    this.largeLineSpoolDir = String(runtimeOptions.largeLineSpoolDir || '');
    this.largeLineSpoolPrefix = String(runtimeOptions.largeLineSpoolPrefix || 'normalized');
    this.largeLineSpoolChars = Math.max(64 * 1024, Number(runtimeOptions.largeLineSpoolChars) || DEFAULT_LARGE_LINE_SPOOL_CHARS);
    this.largeLineStreamingEligible = !this.options.dialogueBreak && !this.options.paragraphOptimize && !!this.largeLineSpoolDir;
    this.pendingCarriageReturn = false;
    this.atDecodedStart = true;
  }

  writeDecoded(value) {
    let text = String(value || '');
    if (!text) return;
    if (this.atDecodedStart) {
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      this.atDecodedStart = false;
    }
    if (this.pendingCarriageReturn) {
      text = '\r' + text;
      this.pendingCarriageReturn = false;
    }
    if (text.endsWith('\r')) {
      text = text.slice(0, -1);
      this.pendingCarriageReturn = true;
    }
    // Preserve the legacy contract: normalize CRLF/CR before removing zero-width characters.
    text = text.replace(/\r\n?/g, '\n');
    text = text.replace(/[\u200B-\u200D\u2060]/g, '').replace(/\t/g, '  ');
    let start = 0;
    for (;;) {
      const newline = text.indexOf('\n', start);
      if (newline < 0) {
        if (start < text.length) this.appendDecodedLinePiece(text.slice(start));
        break;
      }
      if (newline > start) this.appendDecodedLinePiece(text.slice(start, newline));
      this.finishDecodedLine();
      start = newline + 1;
    }
  }

  appendDecodedLinePiece(value) {
    const text = String(value || '');
    if (!text) return;
    if (this.largeLineSpool) {
      this.largeLineSpool.append(text);
      return;
    }
    this.currentDecodedLine += text;
    if (this.largeLineStreamingEligible && this.currentDecodedLine.length >= this.largeLineSpoolChars) {
      this.largeLineSpool = new LargeLineSpool(this.largeLineSpoolDir, this.largeLineSpoolPrefix);
      this.largeLineSpool.append(this.currentDecodedLine);
      this.currentDecodedLine = '';
    }
  }

  finishDecodedLine() {
    if (!this.largeLineSpool) {
      this.acceptDecodedLine(this.currentDecodedLine);
      this.currentDecodedLine = '';
      return;
    }
    const spool = this.largeLineSpool;
    this.largeLineSpool = null;
    try {
      this.acceptLargeDecodedLine(spool);
    } finally {
      spool.remove();
    }
  }

  scanLargeLine(spool, totalChars) {
    let tail = '';
    let noise = false;
    let aggressive = false;
    let nonWhitespace = false;
    let prefix = '';
    let collectingPrefix = false;
    let hasClosingBracket = false;
    spool.forEachChunk(totalChars, (chunk) => {
      const inspect = tail + chunk;
      if (!noise && this.options.removeNoise && NOISE_LINE_RE.test(inspect)) noise = true;
      if (!aggressive && this.options.aggressive && AGGRESSIVE_LINE_RE.test(inspect)) aggressive = true;
      tail = inspect.slice(-64 * 1024);
      if (chunk.includes(']')) hasClosingBracket = true;
      if (!nonWhitespace) {
        const match = /\S/.exec(chunk);
        if (match) {
          nonWhitespace = true;
          collectingPrefix = true;
          prefix += chunk.slice(match.index, match.index + 64 * 1024);
        }
      } else if (collectingPrefix && prefix.length < 64 * 1024) {
        prefix += chunk.slice(0, 64 * 1024 - prefix.length);
      }
      if (prefix.length >= 64 * 1024) collectingPrefix = false;
    });
    const regularChapter = /^(?:프롤로그|에필로그|외전|후기|제\s*\d+\s*[화장편막]|#\s*\d+)/.test(prefix);
    const bracketChapter = /^\[\s*제?\s*\d+/.test(prefix) && hasClosingBracket;
    return { noise, aggressive, nonWhitespace, chapter: regularChapter || bracketChapter };
  }

  acceptLargeDecodedLine(spool) {
    const totalChars = spool.findLogicalChars();
    const scan = this.scanLargeLine(spool, totalChars);
    if (scan.nonWhitespace) {
      if (this.options.removeNoise && scan.noise) {
        this.stats.removedNoiseLines += 1;
        return;
      }
      if (this.options.aggressive && scan.aggressive) {
        this.stats.removedNoiseLines += 1;
        return;
      }
    }
    this.retainedLineCount += 1;
    if (!scan.nonWhitespace) {
      this.emitPreFinalElement('');
      this.chapterLineCount += 1;
      this.lastChapterLine = '';
      return;
    }
    if (this.options.chapterSpacing && scan.chapter && this.chapterLineCount && this.lastChapterLine !== '') {
      this.emitPreFinalElement('');
      this.chapterLineCount += 1;
      this.lastChapterLine = '';
      this.stats.chapterSpacingAdds += 1;
    }
    this.startPreFinalElement();
    this.newlineStream.writeLargeLine((emit) => {
      let previousOne = '';
      let previousTwo = '';
      spool.forEachChunk(totalChars, (chunk) => {
        if (!this.options.splitDense) {
          emit(chunk);
          if (chunk.length) {
            previousTwo = chunk.length > 1 ? chunk.charAt(chunk.length - 2) : previousOne;
            previousOne = chunk.charAt(chunk.length - 1);
          }
          return;
        }
        let output = '';
        for (let index = 0; index < chunk.length; index += 1) {
          const current = chunk.charAt(index);
          const code = chunk.charCodeAt(index);
          const target = (code >= 0xAC00 && code <= 0xD7A3)
            || (code >= 0x41 && code <= 0x5A)
            || code === 0x22 || code === 0x27 || code === 0x28 || code === 0x5B;
          const previousOneCode = previousOne ? previousOne.charCodeAt(0) : 0;
          const denseBoundary = previousOneCode === 0x2E || previousOneCode === 0x21 || previousOneCode === 0x3F || previousOneCode === 0x2026
            || (previousOneCode === 0x2E && (previousTwo === '다' || previousTwo === '요' || previousTwo === '죠' || previousTwo === '니'));
          if (target && denseBoundary) {
            output += ' ';
            this.stats.splitDenseSentences += 1;
          }
          output += current;
          previousTwo = previousOne;
          previousOne = current;
          if (output.length >= 64 * 1024) {
            emit(output);
            output = '';
          }
        }
        if (output) emit(output);
      });
    });
    this.chapterLineCount += 1;
    this.lastChapterLine = '__large_nonempty__';
  }

  acceptDecodedLine(value) {
    let line = String(value || '').replace(/[ \u00A0]+$/, '');
    const trimmed = line.trim();
    if (trimmed) {
      if (this.options.removeNoise && NOISE_LINE_RE.test(trimmed)) {
        this.stats.removedNoiseLines += 1;
        return;
      }
      if (this.options.aggressive && AGGRESSIVE_LINE_RE.test(trimmed)) {
        this.stats.removedNoiseLines += 1;
        return;
      }
    }
    this.retainedLineCount += 1;
    if (this.options.splitDense) {
      line = line.replace(/([.!?…]|[다요죠니다]\.)((?:[가-힣A-Z"'(\[]))/g, (match, a, b) => {
        this.stats.splitDenseSentences += 1;
        return a + ' ' + b;
      });
    }
    if (this.options.dialogueBreak) {
      const dialogueTrimmed = line.trim();
      if (dialogueTrimmed && dialogueTrimmed.length >= 24) {
        line = line
          .replace(/([.!?…]["'”’」』》】]*)\s+(?=(?:["“‘「『〈《【\[]))/g, (match, a) => {
            this.stats.dialogueBreaks += 1;
            return a + '\n';
          })
          .replace(/([.!?…]["'”’」』》】]*)\s+(?=(?:-|—|―)\s*)/g, (match, a) => {
            this.stats.dialogueBreaks += 1;
            return a + '\n';
          });
      }
    }
    const parts = line.split('\n');
    for (const part of parts) this.acceptChapterLine(part);
  }

  acceptChapterLine(line) {
    const value = String(line || '');
    const trimmed = value.trim();
    if (this.options.chapterSpacing && trimmed && CHAPTER_RE.test(trimmed) && this.chapterLineCount && this.lastChapterLine !== '') {
      this.acceptParagraphLine('');
      this.chapterLineCount += 1;
      this.lastChapterLine = '';
      this.stats.chapterSpacingAdds += 1;
    }
    this.acceptParagraphLine(value);
    this.chapterLineCount += 1;
    this.lastChapterLine = value;
  }

  acceptParagraphLine(inputLine) {
    if (!this.options.paragraphOptimize) {
      this.emitPreFinalElement(inputLine);
      return;
    }
    let line = String(inputLine || '');
    const trimmed = line.trim();
    if (!trimmed) {
      this.setParagraphPending('');
      return;
    }
    if (trimmed.length > 120 && this.countSentences(trimmed) >= 3 && !this.isDialogueLike(trimmed)) {
      line = line.replace(PARAGRAPH_SPLIT_RE, (match, a) => {
        this.stats.paragraphOptimizations += 1;
        return a + '\n';
      });
    }
    const previousTrimmed = this.hasParagraphPending ? String(this.paragraphPending || '').trim() : '';
    if (
      previousTrimmed
      && previousTrimmed.length <= 34
      && trimmed.length <= 34
      && !/[.!?…]["'”’」』》】]*$/.test(previousTrimmed)
      && !this.isDialogueLike(previousTrimmed)
      && !this.isDialogueLike(trimmed)
    ) {
      this.paragraphPending = previousTrimmed + ' ' + trimmed;
      this.stats.paragraphOptimizations += 1;
      return;
    }
    this.setParagraphPending(line);
  }

  setParagraphPending(value) {
    if (this.hasParagraphPending) this.emitPreFinalElement(this.paragraphPending);
    this.paragraphPending = String(value || '');
    this.hasParagraphPending = true;
  }

  countSentences(value) {
    SENTENCE_END_RE.lastIndex = 0;
    let count = 0;
    while (SENTENCE_END_RE.exec(value)) count += 1;
    return count;
  }

  isDialogueLike(value) {
    return DIALOGUE_LIKE_RE.test(String(value || '').trim());
  }

  startPreFinalElement() {
    if (this.hasPreFinalElement) this.newlineStream.separator();
    this.hasPreFinalElement = true;
  }

  emitPreFinalElement(value) {
    this.startPreFinalElement();
    this.newlineStream.write(value);
  }

  abort() {
    if (this.largeLineSpool) {
      const spool = this.largeLineSpool;
      this.largeLineSpool = null;
      try { spool.remove(); } catch (_) {}
    }
    this.currentDecodedLine = '';
    this.paragraphPending = '';
    this.hasParagraphPending = false;
  }

  finish() {
    if (this.pendingCarriageReturn) {
      this.finishDecodedLine();
      this.pendingCarriageReturn = false;
      this.acceptDecodedLine('');
    } else {
      this.finishDecodedLine();
    }
    if (!this.retainedLineCount) this.acceptChapterLine('');
    if (this.options.paragraphOptimize && this.hasParagraphPending) {
      this.emitPreFinalElement(this.paragraphPending);
      this.hasParagraphPending = false;
      this.paragraphPending = '';
    }
    const result = this.newlineStream.finish();
    return { ...result, formatStats: this.stats };
  }
}

async function buildStreamingNormalizedContentCache(payload = {}) {
  const filePath = String(payload.filePath || '');
  const started = Date.now();
  const descriptor = buildNormalizedCacheDescriptor({
    rootDir: payload.normalizedContentDir,
    filePath,
    statSig: payload.statSig,
    preprocessSignature: payload.optionKey,
    chunkSize: payload.chunkSize,
    chunkBoundaryLookahead: payload.chunkBoundaryLookahead,
    normalizationVersion: payload.normalizationVersion,
    chunkIndexVersion: payload.chunkIndexVersion
  });
  if (payload.cacheKey && payload.cacheKey !== descriptor.cacheKey) throw new Error('normalized cache key mismatch');
  await fs.promises.mkdir(descriptor.dir, { recursive: true, mode: 0o700 });
  const suffix = `.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const textTmp = descriptor.textPath + suffix;
  const indexTmp = descriptor.indexPath + suffix;
  const metaTmp = descriptor.metaPath + suffix;
  let writer = null;
  let preprocessor = null;
  try {
    const detected = await readEncodingSample(filePath, payload.maxTextFileBytes, payload.sourceSampleBytes);
    const decoder = iconv.getDecoder(detected.encoding || 'utf8');
    writer = new DurableNormalizedTextWriter(textTmp, payload.chunkSize, payload.chunkBoundaryLookahead);
    preprocessor = new StreamingNovelPreprocessor(payload.preprocessOptions || {}, writer, {
      largeLineSpoolDir: descriptor.dir,
      largeLineSpoolPrefix: descriptor.cacheKey,
      largeLineSpoolChars: payload.largeLineSpoolChars
    });
    const readStream = fs.createReadStream(filePath, {
      highWaterMark: Math.max(16 * 1024, Number(payload.sourceReadHighWaterMark) || DEFAULT_SOURCE_READ_HIGH_WATER_MARK)
    });
    for await (const chunk of readStream) {
      const decoded = decoder.write(chunk);
      if (decoded) preprocessor.writeDecoded(decoded);
    }
    const tail = decoder.end();
    if (tail) preprocessor.writeDecoded(tail);
    const built = preprocessor.finish();
    writer = null;
    const metadata = serializeNormalizedCacheMetadata(descriptor, {
      totalChars: built.totalChars,
      totalChunks: built.totalChunks,
      textHash: built.textHash,
      sourceEncoding: detected.encoding,
      formatStats: built.formatStats,
      chunkBounds: built.chunkBounds,
      chunkHashes: built.chunkHashes,
      builderPass: STREAMING_NORMALIZED_CONTENT_BUILD_PASS,
      buildMode: 'streaming'
    });
    metadata.meta.builderPass = STREAMING_NORMALIZED_CONTENT_BUILD_PASS;
    metadata.meta.buildMode = 'streaming';
    metadata.meta.sourceSampleBytes = detected.sampleBytes;
    metadata.index.builderPass = STREAMING_NORMALIZED_CONTENT_BUILD_PASS;
    metadata.index.buildMode = 'streaming';
    metadata.index.sourceSampleBytes = detected.sampleBytes;
    writeJsonFileDurable(indexTmp, metadata.index);
    writeJsonFileDurable(metaTmp, metadata.meta);
    if (statSignature(filePath) !== String(payload.statSig || '')) {
      const error = new Error('source TXT changed while normalized cache was being generated');
      error.code = 'CONTENT_SOURCE_CHANGED';
      error.status = 409;
      throw error;
    }
    atomicReplace(textTmp, descriptor.textPath);
    atomicReplace(indexTmp, descriptor.indexPath);
    atomicReplace(metaTmp, descriptor.metaPath);
    return {
      descriptor,
      sourceEncoding: detected.encoding,
      sourceEncodingHeuristic: detected.heuristic,
      sourceSampleBytes: detected.sampleBytes,
      totalChars: built.totalChars,
      totalChunks: built.totalChunks,
      chunkBounds: built.chunkBounds,
      chunkHashes: built.chunkHashes,
      chunkHashAlgorithm: built.chunkHashAlgorithm,
      textHash: built.textHash,
      formatStats: built.formatStats,
      fileReadMs: Math.max(0, Date.now() - started),
      fileReadCalls: 1,
      builderPass: STREAMING_NORMALIZED_CONTENT_BUILD_PASS
    };
  } catch (error) {
    if (preprocessor) preprocessor.abort();
    if (writer) writer.abort();
    for (const tempPath of [textTmp, indexTmp, metaTmp]) {
      try { removeIfExists(tempPath); } catch (_) {}
    }
    throw error;
  }
}

module.exports = {
  STREAMING_NORMALIZED_CONTENT_BUILD_PASS,
  DEFAULT_SOURCE_SAMPLE_BYTES,
  DEFAULT_SOURCE_READ_HIGH_WATER_MARK,
  DEFAULT_LARGE_LINE_SPOOL_CHARS,
  normalizePreprocessOptions,
  createFormatStats,
  StreamingChunkBounds,
  LargeLineSpool,
  StreamingNovelPreprocessor,
  buildStreamingNormalizedContentCache,
  readEncodingSample
};
