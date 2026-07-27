#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const routes = fs.readFileSync(path.join(root, 'server/routes/novels-routes.js'), 'utf8');
const tags = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-user-tags.mjs'), 'utf8');
const filters = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-shelf-filters.mjs'), 'utf8');

assert(routes.includes('const built = { total:presentation.items.length, facetBundle:getShelfFacets(taggedItems) };') || routes.includes('dataset = { total:presentation.items.length, facetBundle:getShelfFacets(taggedItems) };'), 'facet cache must retain totals and aggregates only');
assert(!routes.includes('dataset = { presentation, facetBundle:getShelfFacets(taggedItems) };'), 'facet cache must not retain the full presentation array');
assert(routes.includes('total:Math.max(0, Number(dataset.total) || 0)'), 'facet response must use cached total without presentation retention');
assert(filters.includes("import('./library-shelf-facets-runtime.mjs')"), 'facet loading must remain dynamic and outside the initial module graph');
const facetRuntime = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-shelf-facets-runtime.mjs'), 'utf8');
assert(facetRuntime.includes("import('./library-tag-browser.mjs')"), 'full tag pagination must remain dynamic and outside the initial module graph');

assert(tags.includes('let syncCommitted = false;'), 'user-tag save must distinguish pre-commit and post-commit failures');
assert(tags.includes('if (!syncCommitted)'), 'pre-commit failures must restore local tag state');
assert(tags.includes('app.state.userTags = previousDefinitions;'), 'tag definitions must roll back on pre-commit failures');
assert(tags.includes('app.state.novelUserTags = previousAssignments;'), 'tag assignments must roll back on pre-commit failures');
assert(tags.includes('태그는 서버에 저장됐지만 서재 갱신에 실패했습니다'), 'post-commit refresh failures must not falsely roll back server-committed state');

console.log(JSON.stringify({ pass:'v602-library-state-integrity-smoke-pass', facetCache:'aggregate-only', tagSave:'transactional' }));
