#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('public/scripts/rebuild/features/library-quick-list.mjs','utf8');
const css = fs.readFileSync('public/styles/app.css','utf8');
assert(source.includes("action === 'section-select'"), 'quick-list tab action missing');
assert(source.includes('createLibraryQuickSwitcher(active, summaries, ui)'), 'single switcher renderer missing');
assert(source.includes("role:'tablist'"), 'quick-list tablist role missing');
assert(source.includes("'aria-selected':selected ? 'true' : 'false'"), 'quick-list selected state missing');
assert(source.includes('createLibraryQuickSection(active'), 'only active quick section should render');
assert(css.includes('.library-quick-switcher-tabs') && css.includes('grid-template-columns:repeat(2'), 'compact quick-list tabs missing');
assert(css.includes('.library-quick-switcher-tab.active'), 'active quick-list tab style missing');
console.log(JSON.stringify({ pass:'v600-library-quick-switcher-smoke-pass' }));
