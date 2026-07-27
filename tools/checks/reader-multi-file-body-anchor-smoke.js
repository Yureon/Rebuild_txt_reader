#!/usr/bin/env node
const path = require('path');
const { pathToFileURL } = require('url');

const PASS = 'v443-reader-multi-file-body-anchor-smoke-pass';
const BODY_ANCHOR_PASS = 'v443-reader-multi-file-body-anchor-pass';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const mod = await import(pathToFileURL(path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/virtual-scroll-stability.mjs')).href);
  assert(mod.READER_MULTI_FILE_BODY_ANCHOR_PASS === BODY_ANCHOR_PASS, 'body anchor marker mismatch');
  const rows = [
    { id:'1:b:99', type:'body' },
    { id:'2:h', type:'header' },
    { id:'2:b:0', type:'body' }
  ];
  const prefix = [0, 1000, 1076, 1376];
  const reader = { scrollTop:1000 };
  const anchor = mod.captureVirtualScrollAnchor({ reader, rows, prefix, anchorOffsetPx:36 });
  assert(anchor, 'anchor not captured');
  assert(anchor.capturedRowId === '2:h', 'smoke fixture did not capture the episode boundary header first');
  assert(anchor.rowId === '2:b:0', 'boundary header anchor was not remapped to following stable body row');
  assert(anchor.bodyAnchorPass === BODY_ANCHOR_PASS, 'body anchor pass missing');
  assert(anchor.bodyAnchorAdjusted === true, 'body anchor adjustment flag missing');
  assert(anchor.offsetPx < 0, 'adjusted body anchor must preserve the original visual target with a virtual negative offset');
  const applied = mod.applyVirtualScrollAnchor({ reader, rows, prefix, anchor });
  assert(applied && applied.bodyAnchorPass === BODY_ANCHOR_PASS, 'apply result body marker missing');
  assert(applied.applied === false && applied.reason === 'below threshold', 'unchanged layout should not move scrollTop');
  assert(reader.scrollTop === 1000, 'unchanged layout moved scrollTop');
  console.log(JSON.stringify({ pass: PASS, bodyAnchorPass: BODY_ANCHOR_PASS }));
})().catch(error => {
  console.error('[reader-multi-file-body-anchor-smoke] failed:', error && error.stack || error);
  process.exit(1);
});
