const iconv = require('iconv-lite');
let jschardet = null;
try { jschardet = require('jschardet'); } catch (_) { jschardet = null; }

const TEXT_DECODER_EXPANDED_ENCODING_PASS = 'v557-expanded-text-decoder-pass';

const BOM_ENCODINGS = [
  { bytes: [0xEF, 0xBB, 0xBF], encoding: 'utf8', offset: 3 },
  { bytes: [0xFF, 0xFE, 0x00, 0x00], encoding: 'utf32-le', offset: 4 },
  { bytes: [0x00, 0x00, 0xFE, 0xFF], encoding: 'utf32-be', offset: 4 },
  { bytes: [0xFF, 0xFE], encoding: 'utf16-le', offset: 2 },
  { bytes: [0xFE, 0xFF], encoding: 'utf16-be', offset: 2 }
];

const DEFAULT_TEXT_ENCODING_CANDIDATES = [
  // Korean
  'cp949', 'euc-kr',
  // Japanese
  'shift_jis', 'cp932', 'euc-jp', 'iso-2022-jp',
  // Simplified / Traditional Chinese
  'gb18030', 'gbk', 'gb2312', 'big5',
  // Western / Cyrillic / European single-byte encodings
  'windows-1252', 'iso-8859-1', 'windows-1251', 'koi8-r', 'windows-1250', 'iso-8859-2',
  'windows-1253', 'windows-1254', 'windows-1257',
  // Arabic / Hebrew / Thai / Vietnamese
  'windows-1256', 'windows-1255', 'windows-1258', 'tis-620'
];

function hasBom(buffer, bytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buffer[i] !== bytes[i]) return false;
  }
  return true;
}

function normalizeEncodingName(value) {
  return String(value || '').trim().toLowerCase().replace(/_/g, '-');
}

function mapDetectedEncodingName(value) {
  const enc = normalizeEncodingName(value);
  if (!enc) return '';
  const aliases = {
    'utf-8': 'utf8',
    'unicode-1-1-utf-8': 'utf8',
    'euc-kr': 'cp949',
    'ks-c-5601': 'cp949',
    'ks-c-5601-1987': 'cp949',
    'shift-jis': 'shift_jis',
    'shift-jisx0213': 'shift_jis',
    'sjis': 'shift_jis',
    'gb2312': 'gb18030',
    'gb-2312': 'gb18030',
    'gbk': 'gb18030',
    'big5-hkscs': 'big5',
    'iso-8859-1': 'windows-1252',
    'ibm866': 'cp866'
  };
  return aliases[enc] || enc;
}

function detectEncodingWithJschardet(buffer, options = {}) {
  if (!jschardet || !Buffer.isBuffer(buffer) || !buffer.length) return null;
  try {
    const detected = jschardet.detect(buffer);
    const confidence = Math.max(0, Number(detected && detected.confidence) || 0);
    const minConfidence = Math.max(0, Math.min(1, Number(options.chardetMinConfidence || process.env.TEXT_FILE_CHARDET_MIN_CONFIDENCE || 0.6)));
    const encoding = mapDetectedEncodingName(detected && detected.encoding || '');
    if (confidence >= minConfidence && encoding && isEncodingSupported(encoding)) {
      return { encoding, confidence, rawEncoding: detected.encoding || '' };
    }
  } catch (_) {}
  return null;
}

function isEncodingSupported(encoding) {
  try {
    return !!iconv.encodingExists(encoding);
  } catch (_) {
    return false;
  }
}

function parseEncodingList(value) {
  return String(value || '')
    .split(/[\s,|;]+/)
    .map(normalizeEncodingName)
    .filter(Boolean)
    .filter(isEncodingSupported);
}

function getForcedEncoding(options = {}) {
  const raw = options.forceEncoding || process.env.TEXT_FILE_ENCODING || process.env.TXT_READER_TEXT_ENCODING || process.env.CONTENT_TEXT_ENCODING || '';
  const normalized = normalizeEncodingName(raw);
  return normalized && isEncodingSupported(normalized) ? normalized : '';
}

function getCandidateEncodings(options = {}) {
  const configured = Array.isArray(options.candidateEncodings)
    ? options.candidateEncodings.map(normalizeEncodingName).filter(Boolean)
    : parseEncodingList(options.candidateEncodings || process.env.TEXT_FILE_ENCODING_CANDIDATES || process.env.TXT_READER_TEXT_ENCODING_CANDIDATES || '');
  const source = configured.length ? configured : DEFAULT_TEXT_ENCODING_CANDIDATES;
  const out = [];
  const seen = new Set();
  for (const candidate of source) {
    const encoding = normalizeEncodingName(candidate);
    if (!encoding || seen.has(encoding) || !isEncodingSupported(encoding)) continue;
    seen.add(encoding);
    out.push(encoding);
  }
  return out;
}

function replacementCount(text) {
  return (String(text || '').match(/\uFFFD/g) || []).length;
}

function countControlChars(text) {
  const value = String(text || '');
  let count = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 0x09 || code === 0x0A || code === 0x0D) continue;
    if ((code >= 0x00 && code < 0x20) || code === 0x7F) count += 1;
  }
  return count;
}

function countNullChars(text) {
  return (String(text || '').match(/\u0000/g) || []).length;
}

function countScriptChars(text) {
  const value = String(text || '');
  let count = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.codePointAt(i);
    if (code > 0xFFFF) i += 1;
    if (
      // Hangul, CJK, Kana
      (code >= 0xAC00 && code <= 0xD7AF) ||
      (code >= 0x1100 && code <= 0x11FF) ||
      (code >= 0x3040 && code <= 0x30FF) ||
      (code >= 0x31F0 && code <= 0x31FF) ||
      (code >= 0x3400 && code <= 0x4DBF) ||
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0xF900 && code <= 0xFAFF) ||
      // Cyrillic, Greek, Hebrew, Arabic, Thai, Vietnamese combining-friendly Latin ext.
      (code >= 0x0400 && code <= 0x052F) ||
      (code >= 0x0370 && code <= 0x03FF) ||
      (code >= 0x0590 && code <= 0x05FF) ||
      (code >= 0x0600 && code <= 0x06FF) ||
      (code >= 0x0E00 && code <= 0x0E7F) ||
      (code >= 0x0100 && code <= 0x024F)
    ) {
      count += 1;
    }
  }
  return count;
}


function scriptBreakdown(text) {
  const value = String(text || '');
  const out = { hangul:0, kana:0, cjk:0, cyrillic:0, greek:0, hebrew:0, arabic:0, thai:0, latinExt:0, privateUse:0 };
  for (let i = 0; i < value.length; i += 1) {
    const code = value.codePointAt(i);
    if (code > 0xFFFF) i += 1;
    if ((code >= 0xAC00 && code <= 0xD7AF) || (code >= 0x1100 && code <= 0x11FF)) out.hangul += 1;
    else if ((code >= 0x3040 && code <= 0x30FF) || (code >= 0x31F0 && code <= 0x31FF)) out.kana += 1;
    else if ((code >= 0x3400 && code <= 0x4DBF) || (code >= 0x4E00 && code <= 0x9FFF) || (code >= 0xF900 && code <= 0xFAFF)) out.cjk += 1;
    else if (code >= 0x0400 && code <= 0x052F) out.cyrillic += 1;
    else if (code >= 0x0370 && code <= 0x03FF) out.greek += 1;
    else if (code >= 0x0590 && code <= 0x05FF) out.hebrew += 1;
    else if (code >= 0x0600 && code <= 0x06FF) out.arabic += 1;
    else if (code >= 0x0E00 && code <= 0x0E7F) out.thai += 1;
    else if (code >= 0x0100 && code <= 0x024F) out.latinExt += 1;
    else if ((code >= 0xE000 && code <= 0xF8FF) || (code >= 0xF0000 && code <= 0xFFFFD) || (code >= 0x100000 && code <= 0x10FFFD)) out.privateUse += 1;
  }
  return out;
}

function countMixedScriptWordPenalty(text) {
  const words = String(text || '').match(/[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u052F\u0590-\u05FF\u0600-\u06FF\u0E00-\u0E7F]+/g) || [];
  let penalty = 0;
  for (const word of words) {
    const hasAsciiLatin = /[A-Za-z]/.test(word);
    const hasLatinExt = /[\u00C0-\u024F]/.test(word);
    const hasCyrillic = /[\u0400-\u052F]/.test(word);
    const hasGreek = /[\u0370-\u03FF]/.test(word);
    const hasHebrewArabicThai = /[\u0590-\u05FF\u0600-\u06FF\u0E00-\u0E7F]/.test(word);
    if (hasAsciiLatin && (hasCyrillic || hasGreek || hasHebrewArabicThai)) penalty += 1;
    if (hasLatinExt && (hasCyrillic || hasGreek || hasHebrewArabicThai)) penalty += 1;
  }
  return penalty;
}

function encodingScriptBonus(breakdown, encoding, length) {
  const enc = normalizeEncodingName(encoding);
  const ratio = (count) => Math.min(0.85, count / Math.max(1, length));
  if (enc === 'cp949' || enc === 'euc-kr') return ratio(breakdown.hangul) * 30;
  if (enc === 'shift-jis' || enc === 'cp932' || enc === 'euc-jp' || enc === 'iso-2022-jp') return ratio(breakdown.kana) * 36 + ratio(breakdown.cjk) * 6;
  if (enc === 'gb18030' || enc === 'gbk' || enc === 'gb2312' || enc === 'big5') return ratio(breakdown.cjk) * 18 - ratio(breakdown.privateUse) * 80;
  if (enc === 'windows-1251' || enc === 'koi8-r') return ratio(breakdown.cyrillic) * 26;
  if (enc === 'windows-1253') return ratio(breakdown.greek) * 26;
  if (enc === 'windows-1255') return ratio(breakdown.hebrew) * 26;
  if (enc === 'windows-1256') return ratio(breakdown.arabic) * 26;
  if (enc === 'tis-620') return ratio(breakdown.thai) * 24;
  if (enc === 'windows-1252' || enc === 'iso-8859-1' || enc === 'windows-1250' || enc === 'iso-8859-2' || enc === 'windows-1254' || enc === 'windows-1257' || enc === 'windows-1258') return ratio(breakdown.latinExt) * 22;
  return 0;
}

function countReadableAscii(text) {
  const value = String(text || '');
  let count = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 0x09 || code === 0x0A || code === 0x0D || (code >= 0x20 && code <= 0x7E)) count += 1;
  }
  return count;
}

function countMojibakeHints(text) {
  const value = String(text || '');
  const matches = value.match(/(?:Ã.|Â.|â[\u0080-\u00BF]|¤|¿|½|¾|�)/g);
  return matches ? matches.length : 0;
}

function scoreDecodedText(text, encoding = '') {
  const value = String(text || '');
  const length = Math.max(1, value.length);
  const replacements = replacementCount(value);
  const controls = countControlChars(value);
  const nulls = countNullChars(value);
  const scripts = countScriptChars(value);
  const ascii = countReadableAscii(value);
  const mojibake = countMojibakeHints(value);
  const breakdown = scriptBreakdown(value);
  const mixedWords = countMixedScriptWordPenalty(value);
  let score = 0;
  score += Math.min(0.65, ascii / length) * 15;
  score += Math.min(0.85, scripts / length) * 48;
  score += encodingScriptBonus(breakdown, encoding, length);
  score -= (replacements / length) * 900;
  score -= (controls / length) * 350;
  score -= (nulls / length) * 900;
  score -= Math.min(0.35, mojibake / length) * 120;
  score -= Math.min(0.4, breakdown.privateUse / length) * 150;
  score -= Math.min(8, mixedWords) * 8;

  // Prefer the less lossy superset aliases when scores are effectively tied.
  const enc = normalizeEncodingName(encoding);
  if (enc === 'utf8' || enc === 'utf-8') score += 2;
  if (enc === 'gb18030') score += 0.9;
  if (enc === 'cp949') score += 0.6;
  if (enc === 'cp932') score += 0.5;
  if (enc === 'windows-1252') score += 0.4;
  return { score, length, replacements, controls, nulls, scripts, ascii, mojibake, mixedWords, breakdown, encoding: enc };
}

function decodeWithEncoding(buffer, encoding, offset = 0) {
  const source = offset > 0 ? buffer.slice(offset) : buffer;
  return iconv.decode(source, encoding);
}

function tryDecode(buffer, encoding, offset = 0) {
  try {
    const text = decodeWithEncoding(buffer, encoding, offset);
    return { encoding: normalizeEncodingName(encoding), text, score: scoreDecodedText(text, encoding) };
  } catch (error) {
    return { encoding: normalizeEncodingName(encoding), text: '', score: { score: -Infinity }, error };
  }
}

function isLikelyUtf16WithoutBom(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return '';
  const len = Math.min(buffer.length, 4096);
  let evenNulls = 0;
  let oddNulls = 0;
  let pairs = 0;
  for (let i = 0; i + 1 < len; i += 2) {
    if (buffer[i] === 0x00) evenNulls += 1;
    if (buffer[i + 1] === 0x00) oddNulls += 1;
    pairs += 1;
  }
  if (!pairs) return '';
  const evenRatio = evenNulls / pairs;
  const oddRatio = oddNulls / pairs;
  if (oddRatio > 0.35 && evenRatio < 0.08) return 'utf16-le';
  if (evenRatio > 0.35 && oddRatio < 0.08) return 'utf16-be';
  return '';
}

function decodeTextBuffer(buffer, options = {}) {
  const raw = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  const forced = getForcedEncoding(options);
  if (forced) {
    return {
      pass: TEXT_DECODER_EXPANDED_ENCODING_PASS,
      encoding: forced,
      forced: true,
      text: decodeWithEncoding(raw, forced),
      candidatesChecked: 1
    };
  }

  for (const bom of BOM_ENCODINGS) {
    if (!hasBom(raw, bom.bytes) || !isEncodingSupported(bom.encoding)) continue;
    return {
      pass: TEXT_DECODER_EXPANDED_ENCODING_PASS,
      encoding: bom.encoding,
      bom: true,
      text: decodeWithEncoding(raw, bom.encoding, bom.offset),
      candidatesChecked: 1
    };
  }

  const utf16Guess = isLikelyUtf16WithoutBom(raw);
  if (utf16Guess && isEncodingSupported(utf16Guess)) {
    const decoded = tryDecode(raw, utf16Guess);
    if (decoded.score && decoded.score.nulls / Math.max(1, decoded.score.length) < 0.03) {
      return {
        pass: TEXT_DECODER_EXPANDED_ENCODING_PASS,
        encoding: utf16Guess,
        heuristic: 'utf16-null-pattern',
        text: decoded.text,
        score: decoded.score.score,
        candidatesChecked: 1
      };
    }
  }

  const sampleSize = Math.min(raw.length, Math.max(4096, Number(options.sampleSize) || 65536));
  const sample = raw.slice(0, sampleSize);
  const fullUtf8 = tryDecode(raw, 'utf8');
  const sampleUtf8 = tryDecode(sample, 'utf8');
  const utf8ReplacementRatio = sampleUtf8.score.replacements / Math.max(1, sampleUtf8.score.length);
  const utf8ControlRatio = sampleUtf8.score.controls / Math.max(1, sampleUtf8.score.length);
  if (utf8ReplacementRatio <= 0.002 && utf8ControlRatio <= 0.01 && sampleUtf8.score.nulls === 0) {
    return {
      pass: TEXT_DECODER_EXPANDED_ENCODING_PASS,
      encoding: 'utf8',
      heuristic: 'valid-utf8-first',
      text: fullUtf8.text,
      score: sampleUtf8.score.score,
      candidatesChecked: 1
    };
  }

  const chardet = detectEncodingWithJschardet(sample, options);
  if (chardet) {
    const decoded = tryDecode(raw, chardet.encoding);
    if (!decoded.error) {
      return {
        pass: TEXT_DECODER_EXPANDED_ENCODING_PASS,
        encoding: chardet.encoding,
        detectedEncoding: chardet.rawEncoding,
        confidence: chardet.confidence,
        heuristic: 'jschardet',
        text: decoded.text,
        score: decoded.score.score,
        candidatesChecked: 1
      };
    }
  }

  const candidates = getCandidateEncodings(options);
  let best = sampleUtf8;
  let checked = 1;
  for (const encoding of candidates) {
    const decoded = tryDecode(sample, encoding);
    checked += 1;
    if (!decoded || decoded.error) continue;
    if (!best || decoded.score.score > best.score.score + 8) best = decoded;
  }

  const bestEncoding = best && best.encoding ? best.encoding : 'utf8';
  const finalDecode = bestEncoding === 'utf8' ? fullUtf8 : tryDecode(raw, bestEncoding);
  return {
    pass: TEXT_DECODER_EXPANDED_ENCODING_PASS,
    encoding: bestEncoding,
    heuristic: 'scored-candidates',
    text: finalDecode.text,
    score: best && best.score ? best.score.score : undefined,
    candidatesChecked: checked
  };
}

module.exports = {
  TEXT_DECODER_EXPANDED_ENCODING_PASS,
  DEFAULT_TEXT_ENCODING_CANDIDATES,
  decodeTextBuffer,
  getCandidateEncodings,
  scoreDecodedText,
  isEncodingSupported,
  detectEncodingWithJschardet
};
