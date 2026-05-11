const fs = require('fs');
const assert = require('assert');

const reader = fs.readFileSync('public/scripts/rebuild/features/reader.mjs', 'utf8');
const runner = fs.readFileSync('tools/run_smoke_tests.js', 'utf8');

assert.ok(reader.includes("v515-reader-nav-slider-release-commit-pass"), 'release commit marker missing');
assert.ok(reader.includes('function rememberNavSliderPendingCommit'), 'pending slider commit helper missing');
assert.ok(reader.includes('function commitNavSliderRelease'), 'release commit helper missing');
assert.ok(reader.includes('async function commitNavSliderPosition'), 'slider commit coordinator missing');
assert.ok(reader.includes("on(app.els.navSlider, 'pointerup', () => commitNavSliderRelease(app, 'pointerup'))"), 'pointerup must commit pending slider input');
assert.ok(reader.includes("on(app.els.navSlider, 'touchend', () => commitNavSliderRelease(app, 'touchend'), { passive:true })"), 'touchend must commit pending slider input');
assert.ok(reader.includes("on(app.els.navSlider, 'change', ev =>"), 'change handler missing');
assert.ok(reader.includes('commitNavSliderPosition(app, (Number(ev.target.value) || 0) / 1000, \'change\')'), 'change handler must use commit coordinator');
assert.ok(!reader.includes("on(app.els.navSlider, 'pointerup', () => markNavSliderSeeking(app, false))"), 'pointerup must not only clear seeking state');
assert.ok(reader.includes('async function goSliderPosition(app, ratio = 0, meta = {})'), 'goSliderPosition must accept commit metadata');
assert.ok(reader.includes('releaseCommitPass: READER_NAV_SLIDER_RELEASE_COMMIT_PASS'), 'slider diagnostics must expose release commit pass');
assert.ok(runner.includes('tools/checks/reader-nav-slider-release-commit-smoke.js'), 'reader smoke runner must include release commit smoke');

console.log('v515-reader-nav-slider-release-commit-smoke-pass');
