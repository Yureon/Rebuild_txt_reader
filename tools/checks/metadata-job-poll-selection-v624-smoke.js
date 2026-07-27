#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'public/scripts/rebuild/metadata-page.mjs'), 'utf8');
assert(source.includes('jobPollSerial:0, jobPollTimer:0'));
assert(source.includes('function cancelJobPoll()'));
assert(source.includes('function waitForJobPoll(delay, serial)'));
assert(source.includes("const selectedId = String(page.selected?.id || '')"));
assert(source.includes("const stillCurrent = () => serial === page.jobPollSerial && String(page.selected?.id || '') === selectedId"));
assert(source.includes('if (!await waitForJobPoll('));
assert(source.includes("window.addEventListener('pagehide',()=>{"));
const clearBody = source.slice(source.indexOf('function clearSelectedWork'), source.indexOf('function closeMobileDetail'));
assert(clearBody.includes('cancelJobPoll();'));
const selectBody = source.slice(source.indexOf('async function selectWork'), source.indexOf('function activeBulkJob'));
assert(selectBody.includes('cancelJobPoll();'));
console.log(JSON.stringify({ pass:'v624-metadata-job-poll-selection-pass' }));
