#!/usr/bin/env node
const fs = require('fs');
function assert(cond, msg){ if(!cond){ console.error('[reader-slider-ratio-anchor-smoke] FAIL:', msg); process.exit(1); } }
const reader = fs.readFileSync('public/scripts/rebuild/features/reader.mjs','utf8');
const intent = fs.readFileSync('public/scripts/rebuild/features/reader/navigation-intent.mjs','utf8');
const layout = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs','utf8');
assert(reader.includes('v464-reader-slider-ratio-scroll-anchor-pass'), 'missing slider anchor marker');
assert(reader.includes("source: 'nav-slider', forceBlockTarget: true, directBlockScroll: true"), 'slider must request block-target direct navigation in v465');
assert(reader.includes('const useBlockTarget = options.forceBlockTarget === true'), 'percent navigation must not default to block target');
assert(intent.includes("source: options.source || ''"), 'navigation intent must carry source');
assert(layout.includes('READER_SLIDER_RATIO_SCROLL_ANCHOR_PASS'), 'virtual layout must record slider marker');
assert(layout.includes('READER_SLIDER_BLOCK_DIRECT_ANCHOR_PASS') && layout.includes('directBlockScrollTarget'), 'v465 direct block slider path missing');
assert(layout.includes("source === 'nav-slider'") && layout.includes('v.pendingScrollTarget = null'), 'slider ratio must use direct scroll without pending row scrollIntoView');
console.log('[reader-slider-ratio-anchor-smoke] OK');
