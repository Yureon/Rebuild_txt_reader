#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(rel) { return fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8'); }

function run() {
  const source = read('server/routes/novels-routes.js');
  assert.ok(source.includes('User-defined tags are a direct user contract'), 'user tag facet priority contract missing');
  const userIndex = source.indexOf('appendFilterTags(novel && novel.userTags, 20)');
  const metadataIndex = source.indexOf('appendFilterTags(novel && novel.tags, 40)');
  const genreIndex = source.indexOf('appendFilterTags(novel && novel.genres, 24)');
  assert.ok(userIndex >= 0 && metadataIndex > userIndex && genreIndex > metadataIndex, 'user tags must be aggregated before metadata and genre tags');
  assert.ok(!source.includes("filter(Boolean).slice(0, 48)"), 'legacy 48-tag aggregate cap must not displace user tags');
  console.log(JSON.stringify({ pass:'v603-library-user-tag-facet-priority-pass' }));
}

if (require.main === module) {
  try { run(); } catch (error) { console.error(error.stack || error); process.exitCode = 1; }
}
module.exports = { run };
