#!/usr/bin/env node
const assert = require('assert');
const iconv = require('iconv-lite');
const { decodeTextBuffer, TEXT_DECODER_EXPANDED_ENCODING_PASS } = require('../../server/services/text-decoder-service');

const PASS = 'v557-expanded-text-decoder-smoke-pass';
const cases = [
  ['utf8', '한국어 日本語 中文 Русский العربية'],
  ['cp949', '한국어 테스트입니다.'],
  ['shift_jis', 'これは日本語のテキストです。'],
  ['gb18030', '这是中文文本。'],
  ['big5', '這是中文繁體文本。'],
  ['windows-1251', 'Это русский текст.'],
  ['windows-1252', 'Café naïve façade résumé — text.'],
  ['tis-620', 'นี่คือข้อความภาษาไทย']
];

for (const [encoding, text] of cases) {
  const decoded = decodeTextBuffer(iconv.encode(text, encoding));
  assert.strictEqual(decoded.pass, TEXT_DECODER_EXPANDED_ENCODING_PASS, encoding + ' pass marker');
  assert.strictEqual(decoded.text, text, encoding + ' should round-trip via auto detection; detected=' + decoded.encoding);
}

const utf16 = decodeTextBuffer(iconv.encode('UTF16 한국어 日本語', 'utf16-le'));
assert.strictEqual(utf16.text, 'UTF16 한국어 日本語', 'utf16-le without BOM should decode by null-pattern heuristic');
assert.match(utf16.encoding, /^utf16-/, 'utf16 heuristic should report utf16 encoding');

process.env.TEXT_FILE_ENCODING = 'cp949';
const forced = decodeTextBuffer(iconv.encode('강제 인코딩 테스트', 'cp949'));
assert.strictEqual(forced.forced, true, 'forced encoding should be marked');
assert.strictEqual(forced.text, '강제 인코딩 테스트', 'forced cp949 should decode');
delete process.env.TEXT_FILE_ENCODING;

console.log(JSON.stringify({ pass: PASS }));
