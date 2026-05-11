const fs = require('fs');
const assert = require('assert');

const progress = fs.readFileSync('public/scripts/rebuild/features/reader/progress.mjs', 'utf8');

assert.ok(progress.includes("v514-reader-nav-terminal-progress-sync-pass"), 'terminal progress sync marker missing');
assert.ok(progress.includes('function resolveNavTerminalProgressAddress'), 'terminal progress helper missing');
assert.ok(progress.includes("mode: 'trusted-terminal-100'"), 'trusted terminal 100 mode missing');
assert.ok(progress.includes("mode: 'pre-terminal-cap'"), 'pre-terminal cap mode missing');
assert.ok(progress.indexOf('const displayAddress = resolveNavTerminalProgressAddress(app, address, rawLocalDocRatio, chunkState);') < progress.indexOf('const sliderProgress = resolveNavSliderProgress(app, displayAddress, localDocRatio);'), 'updateNav must normalize progress before slider');
assert.ok(progress.includes('app.els.navSlider.dataset.readerNavTerminalProgressSyncPass'), 'nav slider dataset marker missing');
assert.ok(progress.includes('displayAddress.documentRatio ?? rawLocalDocumentRatio'), 'snapshot must persist normalized terminal ratio');

console.log('v514-reader-nav-terminal-progress-sync-smoke-pass');
