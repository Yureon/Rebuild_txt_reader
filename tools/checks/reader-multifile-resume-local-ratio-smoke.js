const fs = require('fs');
const assert = require('assert');
const progress = fs.readFileSync('public/scripts/rebuild/features/reader/progress.mjs', 'utf8');
assert.ok(progress.includes('episodeDocumentRatio: localDocumentRatio'), 'snapshot must keep episode-local document ratio');
assert.ok(progress.includes('documentRatio: c.episode ? overallDocumentRatio : localDocumentRatio'), 'snapshot must keep folder-level document ratio for multi-file');
assert.ok(progress.includes('documentRatio: snap.episodeDocumentRatio ?? snap.documentRatio'), 'readMeta must store episode-local resume ratio');
assert.ok(progress.includes('fallbackRatio: snap.ratio'), 'positions must retain fallback chunk ratio');
console.log('v455-reader-multifile-resume-local-ratio-smoke-pass');
