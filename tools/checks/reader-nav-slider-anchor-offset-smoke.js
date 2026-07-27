const fs = require('fs');
const assert = require('assert');

const layout = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');
const runner = fs.readFileSync('tools/run_smoke_tests.js', 'utf8');
const release = fs.readFileSync('docs/release-history.md', 'utf8');

assert.ok(layout.includes("v516-reader-nav-slider-anchor-offset-target-pass"), 'v516 nav slider anchor-offset target marker missing');
assert.ok(layout.includes('const alignOffset = VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX'), 'direct slider target must align to the same viewport anchor used by progress');
assert.ok(layout.includes('targetTop = terminalSliderTarget ? Math.max(0, (Number(v.totalHeight) || rowTop + rowHeight) - viewport) : rowTop + blockOffset - alignOffset'), 'direct block slider target must subtract anchor offset except at terminal bottom');
assert.ok(layout.includes("const ratioAnchorOffset = source === 'nav-slider' ? VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX : 0"), 'ratio fallback slider target must use the same progress anchor offset');
assert.ok(layout.includes('navSliderAnchorOffsetTargetPass: READER_NAV_SLIDER_ANCHOR_OFFSET_TARGET_PASS'), 'slider diagnostics must expose the anchor-offset target pass');
assert.ok(!layout.includes('const alignOffset = Math.min(96, Math.max(24, viewport * 0.18));'), 'legacy 18% viewport slider offset must not remain in direct block slider navigation');
assert.ok(runner.includes('tools/checks/reader-nav-slider-anchor-offset-smoke.js'), 'reader smoke runner must include v516 slider anchor-offset smoke');
assert.ok(release.includes('v516-reader-nav-slider-anchor-offset-target-pass'), 'release history must mention v516 slider anchor-offset marker');

console.log('v516-reader-nav-slider-anchor-offset-smoke-pass');
