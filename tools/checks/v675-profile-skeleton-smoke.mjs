#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=rel=>fs.readFileSync(rel,'utf8');
const library=read('public/library.html'); const site=read('public/site.html'); const mobile=read('public/mobile.html'); const readerShell=read('public/fragments/app-shell.html'); const libraryShell=read('public/fragments/library-shell.html'); const runtime=read('public/scripts/rebuild/core/app-shell.mjs');
assert(library.includes('v675-library-entry-skeleton-pass')); assert(library.includes('library-boot-grid'));
for (const forbidden of ['reader-skeleton-paper','reader-boot-main','reader-load-skeleton']) assert(!library.includes(forbidden),`library entry contains ${forbidden}`);
for (const source of [site,mobile,readerShell]) { assert(source.includes('v675-current-reader-skeleton-pass')); assert(source.includes('reader-skeleton-paper')); assert(source.includes('reader-skeleton-heading')); }
assert(libraryShell.includes('v675-library-entry-skeleton-pass')); assert(!libraryShell.includes('reader-skeleton-paper'));
assert(runtime.includes("document.querySelectorAll('#boot-skeleton .app-skeleton-main"));
console.log(JSON.stringify({pass:'v675-profile-skeleton-smoke-pass',libraryReaderSkeleton:false,currentReaderSkeleton:true,profiles:['library','site','mobile']}));
