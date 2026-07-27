const fs = require('fs');
const assert = require('assert');

const layout = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');

assert.ok(layout.includes("v484-reader-append-seam-progress-diagnostic-pass"), 'append seam progress diagnostic marker missing');
assert.ok(layout.includes('v.appendSeamProgressDiagnosticPass = READER_APPEND_SEAM_PROGRESS_DIAGNOSTIC_PASS'), 'append seam progress diagnostic must be recorded');
assert.ok(layout.includes('lastAppendSeamProgressDiagnostic'), 'last append seam progress diagnostic payload missing');
assert.ok(layout.includes('fileCharViewportProgressPass: READER_FILE_CHAR_VIEWPORT_PROGRESS_PASS'), 'diagnostic must link file char viewport progress pass');
assert.ok(layout.includes('fileCharDocumentRatio') && layout.includes('fallbackDocumentRatio') && layout.includes('manifestDocumentRatio'), 'diagnostic must compare file char/fallback/manifest ratios');
assert.ok(layout.includes('resolveRecentForwardScrollBufferAppend(v).recent') || layout.includes('isAppendCorrectionGuardWindowActive(v)'), 'diagnostic must be limited to append/seam windows');

console.log('v484-reader-append-seam-progress-diagnostic-smoke-pass');
