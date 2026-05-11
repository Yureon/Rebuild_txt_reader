#!/usr/bin/env node
const fs = require('fs');
function assert(cond, msg){ if(!cond){ console.error('[reader-slider-block-direct-anchor-smoke] FAIL:', msg); process.exit(1); } }
const reader = fs.readFileSync('public/scripts/rebuild/features/reader.mjs','utf8');
const layout = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs','utf8');
assert(reader.includes('v465-reader-slider-block-direct-anchor-pass'), 'missing v465 slider direct anchor marker');
assert(reader.includes('forceBlockTarget: true') && reader.includes('directBlockScroll: true'), 'slider must request manifest block target with direct scroll');
assert(reader.includes('directScroll: options.directBlockScroll === true'), 'target address must carry directScroll');
assert(layout.includes('directBlockScrollTarget') && layout.includes("source === 'nav-slider'"), 'virtual layout missing direct block slider branch');
assert(layout.includes('v.pendingScrollTarget = null') && layout.includes('slider manifest block target uses direct scrollTop'), 'direct slider branch must bypass pending row scrollIntoView');
console.log('[reader-slider-block-direct-anchor-smoke] OK');
