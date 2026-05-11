#!/usr/bin/env node
const assert = require('assert');
const { TXT_READER_MULTI_ADMIN_LIBRARY_TREE_PASS, buildAdminLibraryTreeFromNovels, getNovelFolderPath } = require('../../server/services/admin-library-tree-service');
function runAdminLibraryTreeSmoke() {
  const novels = [ { title: 'root', isMultiFile: false, singlePath: 'root.txt' }, { title: 'A', isMultiFile: false, singlePath: '판타지/작가A/작품1.txt' }, { title: 'B', isMultiFile: false, singlePath: '판타지/작가B/작품2.txt' }, { title: 'M', isMultiFile: true, episodes: [{ path: '무협/시리즈/1화.txt' }, { path: '무협/시리즈/2화.txt' }] } ];
  assert.strictEqual(getNovelFolderPath(novels[1]), '판타지/작가A');
  assert.strictEqual(getNovelFolderPath(novels[3]), '무협/시리즈');
  const tree = buildAdminLibraryTreeFromNovels(novels);
  assert.strictEqual(tree.pass, TXT_READER_MULTI_ADMIN_LIBRARY_TREE_PASS);
  assert.strictEqual(tree.rootFileCount, 1);
  const paths = tree.flattened.map(n => n.path);
  assert.ok(paths.includes('판타지/작가A'));
  assert.ok(paths.includes('판타지/작가B'));
  assert.ok(paths.includes('무협/시리즈'));
  return { pass: TXT_READER_MULTI_ADMIN_LIBRARY_TREE_PASS };
}
if (require.main === module) console.log(JSON.stringify(runAdminLibraryTreeSmoke()));
module.exports = { runAdminLibraryTreeSmoke };
