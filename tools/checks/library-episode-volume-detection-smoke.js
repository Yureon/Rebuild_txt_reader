#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PASS = 'v371-library-episode-volume-detection-smoke-pass';

function encodeStableId(value) {
  return 'id-' + Buffer.from(String(value)).toString('hex').slice(0, 12);
}

function findNovel(library, title) {
  return library.find(item => item && item.title === title) || null;
}

function runLibraryEpisodeVolumeDetectionSmoke(projectRoot = path.resolve(__dirname, '..', '..')) {
  const { createLibraryService } = require(path.join(projectRoot, 'server/services/library-service.js'));
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-volume-detect-'));
  try {
    const volumeDir = path.join(tempRoot, 'Volume Series');
    fs.mkdirSync(volumeDir, { recursive: true });
    fs.writeFileSync(path.join(volumeDir, '1권 - 시작.txt'), 'volume one', 'utf8');
    fs.writeFileSync(path.join(volumeDir, '제2권 다음.txt'), 'volume two', 'utf8');
    fs.writeFileSync(path.join(volumeDir, 'Vol. 3 finale.txt'), 'volume three', 'utf8');

    const categoryDir = path.join(tempRoot, 'Category Folder');
    fs.mkdirSync(categoryDir, { recursive: true });
    fs.writeFileSync(path.join(categoryDir, '바람의 이름.txt'), 'single one', 'utf8');
    fs.writeFileSync(path.join(categoryDir, '달의 노래.txt'), 'single two', 'utf8');

    const service = createLibraryService({
      libraryPath: tempRoot,
      encodeStableId,
      libraryCacheTtlMs: 0,
      libraryDeepSignatureCheckTtlMs: 0
    });
    const library = service.getLibraryCached();
    const volumeNovel = findNovel(library, 'Volume Series');
    assert.ok(volumeNovel, 'volume-style folder must become a novel');
    assert.strictEqual(volumeNovel.isMultiFile, true, 'volume-style folder must be recognized as multi-file');
    assert.strictEqual(volumeNovel.episodes.length, 3, 'volume-style folder must expose all txt files as episodes');
    assert.ok(volumeNovel.episodes.some(ep => ep.title === '1권 - 시작'), '1권 title must be preserved');
    assert.ok(volumeNovel.episodes.some(ep => ep.title === '제2권 다음'), '제2권 title must be preserved');
    assert.ok(volumeNovel.episodes.some(ep => ep.title === 'Vol. 3 finale'), 'Vol. 3 title must be preserved');

    const categorySingles = library.filter(item => item && item.categoryPath === 'Category Folder');
    assert.strictEqual(categorySingles.length, 2, 'plain category folder with normal file names must stay as folder contents');
    assert.ok(categorySingles.every(item => item.isMultiFile === false), 'plain category files must stay single-file novels');

    return { pass: PASS, volumes: volumeNovel.episodes.length, categorySingles: categorySingles.length };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

module.exports = { PASS, runLibraryEpisodeVolumeDetectionSmoke };
if (require.main === module) {
  try {
    console.log(JSON.stringify(runLibraryEpisodeVolumeDetectionSmoke()));
  } catch (error) {
    console.error(error && error.stack || error);
    process.exit(1);
  }
}
