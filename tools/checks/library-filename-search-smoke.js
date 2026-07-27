const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..', '..');
const PASS = 'v343-library-filename-search-smoke-pass';

async function main() {
  const shell = fs.readFileSync(path.join(root, 'public/fragments/app-shell.html'), 'utf8');
  const controls = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-install-controls-runtime.mjs'), 'utf8');
  const elements = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/ui/elements.mjs'), 'utf8');
  const model = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-model.mjs'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public/styles/app.css'), 'utf8');

  assert.ok(!shell.includes('파일명으로 검색'), 'filename search toggle label should be removed from sidebar');
  assert.ok(!shell.includes('id="search-filename-toggle"'), 'filename search toggle input should be removed from sidebar');
  assert.ok(!controls.includes('searchFilenameToggle'), 'filename search toggle handler should be removed');
  assert.ok(!elements.includes('search-filename-toggle'), 'filename search toggle element collection should be removed');
  assert.ok(!css.includes('#search-filename-toggle'), 'filename toggle CSS should be removed');
  assert.ok(model.includes('LIBRARY_FILENAME_TOGGLE_REMOVED_PASS'), 'library model should record removed filename toggle pass marker');

  const { pathToFileURL } = require('url');
  const moduleUrl = pathToFileURL(path.join(root, 'public/scripts/rebuild/features/library-model.mjs')).href;
  const { filterLibraryNovels } = await import(moduleUrl + `?t=${Date.now()}`);
  const novels = [
    { title: '표시 제목', categoryPath: '장르>카테고리', fileName: 'novel-hidden-alpha.txt', episodes: [{ title: '회차 제목', fileName: 'episode-hidden-beta.txt' }] },
    { title: '다른 책', categoryPath: '기타', fileName: 'other.txt', episodes: [] }
  ];

  assert.strictEqual(filterLibraryNovels(novels, { query: '표시 제목' }).length, 1, 'unified mode should match title');
  assert.strictEqual(filterLibraryNovels(novels, { query: '카테고리' }).length, 1, 'unified mode should match category');
  assert.strictEqual(filterLibraryNovels(novels, { query: 'novel-hidden-alpha' }).length, 1, 'unified mode should match novel fileName');
  assert.strictEqual(filterLibraryNovels(novels, { query: '회차 제목' }).length, 1, 'unified mode should match episode title');
  assert.strictEqual(filterLibraryNovels(novels, { query: 'episode-hidden-beta' }).length, 1, 'unified mode should match episode fileName');

  console.log(JSON.stringify({ pass: PASS }));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
