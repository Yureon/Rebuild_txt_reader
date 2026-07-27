#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chooseEncoding, isNotModified } = require('../../server/middleware/precompressed-static');
const dir = fs.mkdtempSync(path.join(os.tmpdir(),'precompressed-v602-'));
try {
  const file = path.join(dir,'asset.js');
  fs.writeFileSync(file,'source');
  fs.writeFileSync(file+'.br','br');
  fs.writeFileSync(file+'.gz','gzip');
  assert.equal(chooseEncoding('br;q=0.1, gzip;q=1',file).header,'gzip','highest q encoding must win');
  assert.equal(chooseEncoding('gzip;q=0.5, br;q=0.5',file).header,'br','br may win equal-q tie');
  const stat = { mtimeMs:Date.now()-10000 };
  const future = new Date(Date.now()+10000).toUTCString();
  assert.equal(isNotModified({headers:{'if-none-match':'W/"different"','if-modified-since':future}},stat,'W/"current"'),false,'If-None-Match mismatch must override If-Modified-Since');
  assert.equal(isNotModified({headers:{'if-none-match':'*'}},stat,'W/"current"'),true,'If-None-Match wildcard must match existing resource');
  console.log('v602-precompressed-negotiation-smoke-pass');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
