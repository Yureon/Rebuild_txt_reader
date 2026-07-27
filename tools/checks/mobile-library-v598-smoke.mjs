#!/usr/bin/env node
import assert from 'node:assert/strict';
import { resolveLibraryShelfDomLimit, LIBRARY_SHELF_MOBILE_DOM_LIMIT, LIBRARY_SHELF_DOM_LIMIT, LIBRARY_SHELF_ADAPTIVE_DOM_PASS } from '../../public/scripts/rebuild/features/library-shelf-runtime.mjs';
const originalWindow=globalThis.window, originalDocument=globalThis.document;
globalThis.window={ innerWidth:390, matchMedia:()=>({matches:true}) };
globalThis.document={ body:{ dataset:{ clientProfile:'library' } } };
assert.equal(resolveLibraryShelfDomLimit({libraryShelfDomLimit:480}), LIBRARY_SHELF_MOBILE_DOM_LIMIT);
globalThis.window={ innerWidth:1440, matchMedia:()=>({matches:false}) };
assert.equal(resolveLibraryShelfDomLimit({libraryShelfDomLimit:480}), LIBRARY_SHELF_DOM_LIMIT);
globalThis.window=originalWindow; globalThis.document=originalDocument;
assert.equal(LIBRARY_SHELF_ADAPTIVE_DOM_PASS,'v598-library-shelf-adaptive-dom-pass');
console.log(JSON.stringify({pass:'v598-mobile-library-smoke-pass',mobile:LIBRARY_SHELF_MOBILE_DOM_LIMIT,desktop:LIBRARY_SHELF_DOM_LIMIT}));
