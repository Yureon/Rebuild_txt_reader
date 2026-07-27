#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const { createLibraryService, LIBRARY_EPISODE_SEQUENCE_GROUPING_PASS } = require('../../server/services/library-service');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-episode-grouping-'));
const write = rel => {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive:true });
  fs.writeFileSync(full, rel, 'utf8');
};
[
  '판타지/연재작 1화.txt',
  '판타지/연재작 2화 제목.txt',
  '판타지/숫자작 001.txt',
  '판타지/숫자작 002.txt',
  '판타지/숫자작 003.txt',
  '판타지/완결작 1-100완.txt',
  '판타지/완결작 1-200완.txt',
  '판타지/단독.txt',
  '회차폴더/1.txt',
  '회차폴더/2.txt'
].forEach(write);

const service = createLibraryService({
  libraryPath:root,
  encodeStableId:value => crypto.createHash('sha1').update(String(value)).digest('hex')
});
try {
  const library = service.buildLibrary();
  const prefix = library.find(item => item.title === '연재작');
  assert.ok(prefix && prefix.isMultiFile && prefix.isVirtualEpisodeGroup);
  assert.equal(prefix.episodeGroupingKind, 'filename-prefix');
  assert.equal(prefix.episodeGroupingPass, LIBRARY_EPISODE_SEQUENCE_GROUPING_PASS);
  assert.deepEqual(prefix.episodes.map(item => item.title), ['연재작 1화', '연재작 2화 제목']);

  const numeric = library.find(item => item.title === '숫자작');
  assert.ok(numeric && numeric.isMultiFile && numeric.isVirtualEpisodeGroup);
  assert.equal(numeric.episodeGroupingKind, 'numeric-suffix');
  assert.equal(numeric.episodes.length, 3);

  const completeFiles = library.filter(item => item.title.startsWith('완결작 '));
  assert.equal(completeFiles.length, 2, 'whole-book ranges must not become episode sequences');
  assert.ok(completeFiles.every(item => !item.isMultiFile));

  const folder = library.find(item => item.title === '회차폴더');
  assert.ok(folder && folder.isMultiFile && !folder.isVirtualEpisodeGroup, 'existing bare-episode folder grouping must remain');

  assert.throws(() => service.getNovelStorageInfo(prefix), error => error && error.code === 'VIRTUAL_EPISODE_GROUP_MUTATION_UNSUPPORTED');
  assert.equal(service.getEpisodeStorageInfo(prefix, prefix.episodes[0].id).type, 'file');
  console.log(JSON.stringify({ pass:LIBRARY_EPISODE_SEQUENCE_GROUPING_PASS, novels:library.length }));
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
