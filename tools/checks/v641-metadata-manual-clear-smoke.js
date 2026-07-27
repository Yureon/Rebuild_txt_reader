#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v641-metadata-manual-'));
  const store = createMetadataStoreService({ storePath:path.join(tmp,'metadata.json') });
  const novel = { id:'n1', title:'작품', author:'원작가', progressAliases:['n1'] };
  await store.saveManualMetadataDurably(novel, { author:'수정 작가', synopsis:'소개', tags:['태그'], fields:['author','synopsis','tags'] });
  let applied = store.getAppliedForNovel(novel);
  assert.equal(applied.data.author, '수정 작가');
  assert.equal(applied.data.synopsis, '소개');
  assert.deepEqual(applied.data.tags, ['태그']);

  assert.throws(() => store.saveManualMetadata(novel, { fields:['nonexistent'] }), err => err && err.code === 'METADATA_FIELDS_INVALID');
  assert.throws(() => store.saveManualMetadata(novel, { fields:['author'] }), err => err && err.code === 'METADATA_FIELDS_INVALID');
  assert.throws(() => store.saveManualMetadata(novel, { author:'다른 작가', fields:['author'], clearFields:['author'] }), err => err && err.code === 'METADATA_FIELDS_INVALID');

  await store.saveManualMetadataDurably(novel, { clearFields:['author','synopsis','tags'] });
  applied = store.getAppliedForNovel(novel);
  assert.equal(applied.data.author, null);
  assert.equal(applied.data.synopsis, null);
  assert.deepEqual(applied.data.tags, []);
  assert(!applied.fields.includes('author'));
  assert(!applied.fields.includes('synopsis'));
  assert(!applied.fields.includes('tags'));
  await store.close();
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log(JSON.stringify({ pass:'v641-metadata-manual-clear-pass', validated:['unknown-fields','missing-values','conflicts','explicit-clear'] }));
})().catch(error => { console.error(error); process.exit(1); });
