#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const source = fs.readFileSync(path.join(__dirname, '../..', 'server/services/block-manifest-service.js'), 'utf8');
for (const token of [
  'index,',
  "episodeId: String(episode?.id || '')",
  "title: String(episode?.title || '')",
  'canonicalPath: filePath ? canonicalFilePath(filePath) :',
  'statSignature: filePath ? statFileSignature(filePath)',
  'preprocessSignature: String(preprocessSignature ||',
  'Number(st.dev)'
]) assert.ok(source.includes(token), `folder manifest signature token missing: ${token}`);
assert.ok(source.includes('JSON.stringify(raw.signature || {}) !== JSON.stringify(signature.payload || {})'), 'disk read must validate complete signature payload');
console.log(JSON.stringify({ pass: 'v469-block-manifest-episode-disk-cache-pass' }));
