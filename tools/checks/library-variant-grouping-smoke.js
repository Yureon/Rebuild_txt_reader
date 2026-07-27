#!/usr/bin/env node
const assert = require('assert');
const {
  LIBRARY_VARIANT_GROUPING_PASS,
  LIBRARY_VARIANT_PRESENTATION_PASS,
  buildLibraryVariantPresentation,
  deriveVariantSignal
} = require('../../server/services/library-variant-service');

function single(id, title, categoryPath = '') {
  return { id, title, singlePath:`${categoryPath ? categoryPath + '/' : ''}${title}.txt`, categoryPath, category:categoryPath ? [categoryPath] : [], isMultiFile:false, episodes:[] };
}

const library = [
  single('smith-main', '만렙 대장장이가 귀환했다 1-200完@아아연하게', '최신'),
  single('smith-copy', '만렙 대장장이가 귀환했다 1-200完@아아연하게-1', '옛날'),
  single('circle-old', '10서클 직전에 환생 1-120', '옛날'),
  single('circle-new', '10서클 직전에 환생 1-191 완 @레드리프', '최신'),
  single('same-a', '제목만 같은 작품', 'A'),
  single('same-b', '제목만 같은 작품', 'B'),
  single('author-a', '동명작 1-100 @작가A', 'A'),
  single('author-b', '동명작 1-200 @작가B', 'B'),
  { id:'episodes', title:'회차 작품', isMultiFile:true, categoryPath:'연재', category:['연재'], episodes:[{ id:'ep1', title:'1화', path:'연재/회차 작품/1.txt' }] }
];

const result = buildLibraryVariantPresentation(library);
assert.strictEqual(result.pass, LIBRARY_VARIANT_PRESENTATION_PASS);
assert.strictEqual(result.groupingPass, LIBRARY_VARIANT_GROUPING_PASS);
assert.strictEqual(result.byAlias.get('smith-copy').id, 'smith-main', 'copy suffix must resolve to canonical member');
assert.strictEqual(result.byAlias.get('circle-old').id, 'circle-new', 'larger range must become preferred edition');
assert.strictEqual(result.byAlias.get('circle-new').hiddenVariantCount, 1);
assert.strictEqual(result.byAlias.get('circle-new').variants.find(item => item.id === 'circle-old').relation, 'superseded');
assert.strictEqual(result.byAlias.get('smith-main').variants.find(item => item.id === 'smith-copy').relation, 'duplicate-copy');
assert.strictEqual(result.byAlias.get('same-a').id, result.byAlias.get('same-b').id, 'exact duplicate titles in separate paths must group');
assert.notStrictEqual(result.byAlias.get('author-a').id, result.byAlias.get('author-b').id, 'conflicting known authors must not group');
assert.strictEqual(result.byAlias.get('episodes').id, 'episodes', 'multi-file novels must remain unchanged');
assert.ok(result.byAlias.get('smith-main').shelfSearchKey.includes('옛날'), 'hidden member paths must remain searchable');
assert.strictEqual(deriveVariantSignal(library[0]).baseTitle, '만렙 대장장이가 귀환했다');
console.log(JSON.stringify({ pass:LIBRARY_VARIANT_GROUPING_PASS, items:result.items.length, hidden:result.hiddenVariantCount }));
