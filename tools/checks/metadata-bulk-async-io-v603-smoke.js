#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
function read(rel) { return fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8'); }
function run() {
  const source = read('server/services/metadata-service.js');
  assert.ok(source.includes('async function removeBulkBatch'), 'bulk batch deletion must be asynchronous');
  assert.ok(source.includes('await durableRemoveAsync(bulkFilePath(batchId)'), 'bulk batch deletion must use durable asynchronous filesystem API');
  assert.ok(source.includes('await fs.promises.access(filePath, fs.constants.R_OK)'), 'bulk batch processing must avoid request-path existsSync');
  const processStart = source.indexOf('async function processBulkJob');
  const processEnd = source.indexOf('async function probeProvider', processStart);
  const processSource = source.slice(processStart, processEnd);
  assert.ok(!processSource.includes('fs.existsSync('), 'bulk job request path must not use existsSync');
  assert.ok(!processSource.includes('fs.rmSync('), 'bulk job request path must not use rmSync');
  console.log(JSON.stringify({ pass:'v603-metadata-bulk-async-io-pass' }));
}
if (require.main === module) { try { run(); } catch (error) { console.error(error.stack || error); process.exitCode=1; } }
module.exports={run};
