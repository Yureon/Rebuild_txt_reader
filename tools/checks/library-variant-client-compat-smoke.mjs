#!/usr/bin/env node
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const model = await import(pathToFileURL(path.join(root, 'public/scripts/rebuild/features/library-model.mjs')).href);
const navigation = await import(pathToFileURL(path.join(root, 'public/scripts/rebuild/features/library-navigation-actions.mjs')).href);
const favorites = await import(pathToFileURL(path.join(root, 'public/scripts/rebuild/features/library-favorites-runtime.mjs')).href);

const novel = { id:'preferred', progressAliases:['preferred','older-copy'], hiddenVariantCount:1 };
const state = {
  progress:{ byNovel:{
    preferred:{ novelId:'preferred', chunk:2, updatedAt:100 },
    'older-copy':{ novelId:'older-copy', chunk:8, updatedAt:200 }
  } },
  favorites:new Set(['older-copy']),
  novelById:new Map([['preferred', novel]])
};
assert.equal(model.findProgressSnapshotForNovel(state, novel).chunk, 8, 'freshest hidden-edition progress must win');
assert.equal(model.isNovelFavoriteForState(state, novel), true, 'hidden-edition favorite must mark representative card');

const app = { profile:'library', state };
const navigationResult = navigation.openNovelFromElementRuntime(app, { dataset:{ novelId:'preferred' } }, {});
assert.equal(navigationResult.navigated, true);
assert.equal(navigationResult.href, '/site.html?novelId=preferred&from=library');

let persistCount = 0;
const removed = favorites.toggleLibraryFavoriteRuntime(app, 'preferred', { persistBookData:() => { persistCount += 1; } });
assert.equal(removed.isFavorite, false);
assert.equal(state.favorites.has('older-copy'), false);
const added = favorites.toggleLibraryFavoriteRuntime(app, 'preferred', { persistBookData:() => { persistCount += 1; } });
assert.equal(added.isFavorite, true);
assert.equal(state.favorites.has('preferred'), true);
assert.equal(persistCount, 2);

console.log(JSON.stringify({ pass:'v574-library-variant-client-compat-smoke-pass' }));
