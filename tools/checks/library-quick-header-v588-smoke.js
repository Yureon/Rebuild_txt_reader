#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');

const runtime = fs.readFileSync('public/scripts/rebuild/features/library-quick-list.mjs', 'utf8');
const css = fs.readFileSync('public/styles/app.css', 'utf8');

assert.ok(runtime.includes("const descriptor = key === 'favorites' ? '고정해 둔 작품' : '마지막으로 읽은 작품'"));
assert.ok(runtime.includes("class:'library-quick-head-copy'"));
assert.ok(runtime.includes("class:'library-quick-head-summary'"));
assert.ok(runtime.includes("class:'library-quick-count'"));
assert.ok(runtime.includes("class:'library-quick-chevron'"));
assert.ok(runtime.includes("class:`library-quick-section library-quick-section-${key}"), 'section-specific styling hooks are required');
assert.ok(runtime.includes('if (collapsed) return section;'), 'collapsed quick sections must render only their header without a hidden-items row');
assert.ok(runtime.includes('createLibraryQuickSwitcher(active, summaries, ui)'), 'v600 tree/explorer quick list must use a single switchable pane');
assert.ok(runtime.includes("text:expanded ? '간단히 보기' : `나머지 ${hiddenCount}개 더보기`"));

assert.ok(css.includes('.library-quick-head-main{'));
assert.ok(/\.library-quick-head-main\{[^}]*min-height:50px/.test(css), 'desktop header must have a 50px minimum touch target');
assert.ok(css.includes('.library-quick-head-summary{'));
assert.ok(css.includes('.library-quick-chevron{'));
assert.ok(css.includes('.library-quick-section-favorites'));
assert.ok(css.includes('body.library-shelf-mode #library-quick-list{display:none!important}'), 'quick headers must stay limited to tree/explorer views');
assert.ok(/@media \(max-width:700px\)\{[^}]*\.library-quick-list\{max-height:38vh/.test(css), 'mobile quick list must retain the revised height budget');

console.log('v588-library-quick-header-smoke-pass');
