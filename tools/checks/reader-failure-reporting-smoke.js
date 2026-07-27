const fs = require('fs');
const path = require('path');

const READER_FAILURE_REPORTING_SMOKE_PASS = 'v247-reader-failure-reporting-smoke-pass';

function runReaderFailureReportingSmoke(projectRoot) {
  const source = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/reader/failure-reporting.mjs'), 'utf8');
  ['v247-reader-failure-reporting-pass', 'buildReaderChunkFailureReport', 'buildReaderManifestFailureReport', 'rememberReaderFailureReport'].forEach(marker => {
    if (!source.includes(marker)) throw new Error('reader failure reporting marker missing: ' + marker);
  });
  const readerSource = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/reader.mjs'), 'utf8');
  ['buildReaderManifestFailureReport', 'rememberReaderFailureReport'].forEach(marker => {
    if (!readerSource.includes(marker)) throw new Error('reader failure reporting not wired: ' + marker);
  });
  return { pass: READER_FAILURE_REPORTING_SMOKE_PASS };
}

module.exports = { READER_FAILURE_REPORTING_SMOKE_PASS, runReaderFailureReportingSmoke };
