#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIBRARY_METADATA_RUNTIME_PASS } from '../../public/scripts/rebuild/features/library-metadata-runtime.mjs';
import { libraryShelfFilterSignature } from '../../public/scripts/rebuild/features/library-shelf-filters.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const runtime = read('public/scripts/rebuild/features/library-metadata-runtime.mjs');
const api = read('public/scripts/rebuild/core/api.mjs');
const shell = read('public/fragments/app-shell.html');
const bridge = read('public/scripts/rebuild/features/library-action-orchestrator-bridge.mjs');
const shelf = read('public/scripts/rebuild/features/library-shelf-runtime.mjs');
const styles = read('public/styles/app.css');

assert.equal(LIBRARY_METADATA_RUNTIME_PASS, 'v578-library-metadata-runtime-bulk-pass');
assert(!runtime.includes('.innerHTML') && !runtime.includes('insertAdjacentHTML'), 'metadata UI must not inject untrusted HTML');
assert(runtime.includes("tabindex:'-1'"));
assert(runtime.includes('Cookie 직접 입력 기능은 제거되었습니다.'));
assert(runtime.includes('Playwright 영구 프로필') && runtime.includes('Metadata Helper 확장 프로그램'));
assert(runtime.includes('작품 수 제한 없이 하나의 영속 작업') && !runtime.includes('1~500') && !runtime.includes('Math.min(500'));
assert(runtime.includes("rel:'noopener noreferrer'"));
assert(api.includes('collectNovelMetadata') && api.includes('applyNovelMetadata') && api.includes('startMetadataProviderBrowserLogin'));
assert(!api.includes('saveMetadataProviderAuth') && !api.includes('/auth`'));
assert(shell.includes('id="list-action-metadata"'));
assert(shell.includes('id="library-filter-tag-options"'));
assert(bridge.includes("import('./library-metadata-runtime.mjs')"));
assert(shelf.includes('library-shelf-card-tags') && shelf.includes('library-shelf-metadata-source'));
assert(styles.includes('.library-metadata-overlay') && styles.includes('.metadata-candidate'));
assert.match(libraryShelfFilterSignature({ tags:['성장'], authors:['작가'] }), /tags:성장/);

console.log(JSON.stringify({ pass:'v578-metadata-library-ui-smoke-pass', methods:9 }));
