'use strict';

const crypto = require('crypto');

const LIBRARY_FINGERPRINT_SKETCH_PASS = 'v642-library-fingerprint-sketch-pass';
const DEFAULT_SKETCH_SIZE = 48;

function buildSketch(text, size = DEFAULT_SKETCH_SIZE) {
  const value = String(text || '').toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]+/gu, '');
  if (!value) return '';
  const hashes = [];
  const seen = new Set();
  const width = value.length < 64 ? 2 : 4;
  for (let index = 0; index <= value.length - width; index += 1) {
    const gram = value.slice(index, index + width);
    if (seen.has(gram)) continue;
    seen.add(gram);
    const digest = crypto.createHash('sha1').update(gram).digest();
    hashes.push(digest.readUInt32BE(0));
  }
  hashes.sort((a, b) => a - b);
  const selected = hashes.slice(0, Math.max(8, Number(size) || DEFAULT_SKETCH_SIZE));
  const buffer = Buffer.allocUnsafe(selected.length * 4);
  selected.forEach((entry, index) => buffer.writeUInt32BE(entry >>> 0, index * 4));
  return buffer.toString('base64');
}

function decodeSketch(value) {
  try {
    const buffer = Buffer.from(String(value || ''), 'base64');
    const out = [];
    for (let index = 0; index + 3 < buffer.length; index += 4) out.push(buffer.readUInt32BE(index));
    return out;
  } catch (_error) {
    return [];
  }
}

function sketchSimilarity(left, right) {
  const a = decodeSketch(left);
  const b = decodeSketch(right);
  if (!a.length || !b.length) return null;
  let ai = 0;
  let bi = 0;
  let intersection = 0;
  while (ai < a.length && bi < b.length) {
    if (a[ai] === b[bi]) { intersection += 1; ai += 1; bi += 1; }
    else if (a[ai] < b[bi]) ai += 1;
    else bi += 1;
  }
  return intersection / Math.max(1, Math.min(a.length, b.length));
}

module.exports = {
  LIBRARY_FINGERPRINT_SKETCH_PASS,
  DEFAULT_SKETCH_SIZE,
  buildSketch,
  decodeSketch,
  sketchSimilarity
};
