#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { automaticLibraryTagFacetMinCount, automaticLibraryTagFacetPolicy, effectiveLibraryTagFacetMinCount } from '../../public/scripts/rebuild/features/library-shelf-filters.mjs';
import { normalizeLibraryTagFacetMinCount } from '../../public/scripts/rebuild/state/app-state.mjs';

const shell = fs.readFileSync('public/fragments/app-shell.html', 'utf8');
const css = fs.readFileSync('public/styles/app.css', 'utf8');
const filters = fs.readFileSync('public/scripts/rebuild/features/library-shelf-filters.mjs', 'utf8');
const routes = fs.readFileSync('server/routes/novels-routes.js', 'utf8');

for (const id of ['library-tag-min-count','library-tag-threshold-note','library-filter-tag-options']) {
  assert(shell.includes(`id="${id}"`), `missing tag facet control: ${id}`);
}
assert(css.includes('scrollbar-width:thin'), 'library filter scrollbar must use thin themed scrollbars');
assert(css.includes('.library-filter-panel::-webkit-scrollbar'), 'webkit filter scrollbar styling missing');
assert(css.includes('.library-filter-options-scroll::-webkit-scrollbar-thumb'), 'nested filter scrollbar thumb styling missing');
assert(filters.includes('v601-library-tag-facet-threshold-pass'), 'tag threshold runtime marker missing');
assert(filters.includes('userDefinitions.has(key)'), 'user-defined tags must bypass rare-tag suppression');
assert(filters.includes('selectedKeys.has(key)'), 'selected tags must remain visible below threshold');
assert(routes.includes('total:presentation.items.length'), 'facet API total count missing');
assert(routes.includes('userTags:(Array.isArray(shared.userTags)'), 'facet API user-tag definitions missing');
assert(routes.includes('tagDistribution:facetBundle.tagDistribution'), 'facet API full tag-distribution summary missing');
assert(routes.includes('const derived = deriveShelfFacets(item);'), 'facet aggregation must derive metadata once per item');
assert(!routes.includes('item => deriveShelfFacets(item)'), 'facet aggregation must not repeat derivation for each facet dimension');

const makeFacets = (counts = []) => counts.map((count, index) => ({ value:`tag-${index}`, count }));
const small = makeFacets(new Array(20).fill(1));
const sparse = makeFacets([...new Array(20).fill(10), ...new Array(80).fill(1)]);
const dense = makeFacets(Array.from({length:100}, (_, index) => Math.max(1, 30 - Math.floor(index / 4))));
const veryLarge = makeFacets([...new Array(80).fill(20), ...new Array(420).fill(1)]);


const cappedPreview = makeFacets(new Array(10).fill(20));
const fullDistribution = { distinct:1000, totalUsage:2900, histogram:[{count:20,tags:100},{count:1,tags:900}] };
assert.equal(automaticLibraryTagFacetPolicy(cappedPreview).tagTotal, 10, 'preview-only fallback should use available facet rows');
assert.equal(automaticLibraryTagFacetPolicy(cappedPreview, fullDistribution).tagTotal, 1000, 'automatic threshold must use the full server-side tag distribution');
assert.equal(automaticLibraryTagFacetMinCount(cappedPreview, fullDistribution), 2, 'full long-tail distribution must suppress one-off tags even when the payload contains only popular previews');

assert.equal(automaticLibraryTagFacetMinCount(small), 1, 'small tag sets should remain fully visible');
assert.equal(automaticLibraryTagFacetMinCount(sparse), 2, 'long-tail tag sets should hide one-off tags');
assert(automaticLibraryTagFacetMinCount(dense) > automaticLibraryTagFacetMinCount(sparse), 'automatic threshold must react to the usage distribution, not a fixed novel-count bucket');
assert.equal(automaticLibraryTagFacetPolicy(veryLarge).tagTotal, 500);
assert(automaticLibraryTagFacetPolicy(veryLarge).targetVisible <= 240, 'large tag sets should use a bounded visible target');
assert.equal(normalizeLibraryTagFacetMinCount('auto'), 'auto');
assert.equal(normalizeLibraryTagFacetMinCount('0'), '1');
assert.equal(normalizeLibraryTagFacetMinCount('999'), 'auto');
assert.equal(normalizeLibraryTagFacetMinCount('bad'), 'auto');
assert.equal(effectiveLibraryTagFacetMinCount({ libraryTagFacetMinCount:'auto', libraryShelfFacets:{ tags:sparse } }), 2);
assert.equal(effectiveLibraryTagFacetMinCount({ libraryTagFacetMinCount:'5', libraryShelfFacets:{ tags:sparse } }), 5);

console.log(JSON.stringify({ pass:'v601-library-tag-facet-smoke-pass', sparse:automaticLibraryTagFacetMinCount(sparse), dense:automaticLibraryTagFacetMinCount(dense) }));
