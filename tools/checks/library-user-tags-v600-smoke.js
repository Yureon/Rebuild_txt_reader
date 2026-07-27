#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const { sanitizeUserTagList, sanitizeNovelUserTags } = require('../../server/services/state-normalizer-lists');
const { normalizeUserState, mergeSharedState, validateSharedState } = require('../../server/services/state-normalizer');

const read = file => fs.readFileSync(file, 'utf8');
const shell = read('public/fragments/app-shell.html');
const moduleSource = read('public/scripts/rebuild/features/library-user-tags.mjs');
const stateSource = read('public/scripts/rebuild/state/app-state.mjs');
const hydrationSource = read('public/scripts/rebuild/features/sync/server-state-hydration.mjs');
const syncSource = read('public/scripts/rebuild/features/bookmarks/model.mjs');
const routesSource = read('server/routes/novels-routes.js');
const css = read('public/styles/app.css');

for (const id of ['library-user-tags-btn','list-action-tags','user-tag-overlay','user-tag-input','user-tag-add','user-tag-list','user-tag-save']) {
  assert(shell.includes(`id="${id}"`), `missing user tag UI: ${id}`);
}
assert(moduleSource.includes("v600-library-user-tags-pass"), 'user tag runtime pass marker missing');
assert(moduleSource.includes("import('./bookmarks/model.mjs')"), 'user tag server sync must remain dynamic');
assert(stateSource.includes('userTags: normalizeUserTagList') && stateSource.includes('novelUserTags: normalizeNovelUserTags'), 'client user-tag state missing');
assert(hydrationSource.includes('normalized.shared.userTags') && hydrationSource.includes('normalized.shared.novelUserTags'), 'server hydration missing');
assert(syncSource.includes('userTags: normalizeUserTagList') && syncSource.includes('novelUserTags: normalizeNovelUserTags'), 'shared sync payload missing user tags');
assert(routesSource.includes('withUserTags') && routesSource.includes('novelUserTags') && routesSource.includes('userTags'), 'library route user-tag decoration missing');
assert(routesSource.includes("kind === 'tree' || kind === 'facets'") && routesSource.includes('LIBRARY_STATE_REVISION_SPLIT_PASS'), 'shelf cache key must split catalog/tag state from favorites and recents');
assert(routesSource.includes('favorites:shared.favorites, recents:shared.recents, userTags:shared.userTags, novelUserTags:shared.novelUserTags'), 'all-scope shelf revision must include user tags');
assert(css.includes('.user-tag-dialog') && css.includes('.user-tag-row'), 'user tag styles missing');

const tags = sanitizeUserTagList([' #판타지 ', '판타지', '완결', '  긴   태그  ', '', '#'.repeat(3)]);
assert.deepStrictEqual(tags, ['판타지','완결','긴 태그']);
const assignments = sanitizeNovelUserTags({ novelA:['판타지','없는태그','판타지'], novelB:['완결'] }, tags);
assert.deepStrictEqual(assignments, { novelA:['판타지'], novelB:['완결'] });

const normalized = normalizeUserState({ shared:{ userTags:['#판타지','완결'], novelUserTags:{ novelA:['판타지','없는태그'] } } });
assert.deepStrictEqual(normalized.shared.userTags, ['판타지','완결']);
assert.deepStrictEqual(normalized.shared.novelUserTags, { novelA:['판타지'] });

const merged = mergeSharedState(normalized.shared, { userTags:['완결'], novelUserTags:{ novelA:['판타지','완결'], novelB:['완결'] } });
assert.deepStrictEqual(merged.userTags, ['완결']);
assert.deepStrictEqual(merged.novelUserTags, { novelA:['완결'], novelB:['완결'] });
assert.strictEqual(validateSharedState({ userTags:new Array(101).fill('x') }).ok, false, 'tag definition limit must be enforced');
assert.strictEqual(validateSharedState({ novelUserTags:{ novelA:new Array(21).fill('x') } }).ok, false, 'per-novel tag limit must be enforced');

console.log(JSON.stringify({ pass:'v600-library-user-tags-smoke-pass', tags, assignments }));
