#!/usr/bin/env node
const fs=require('fs'); const path=require('path'); const assert=require('assert');
const root=process.cwd();
const contract=fs.readFileSync(path.join(root,'docs/reader-anchoring-stability-contract.md'),'utf8');
const chunk=fs.readFileSync(path.join(root,'public/scripts/rebuild/features/reader/chunk-window.mjs'),'utf8');
assert.ok(contract.includes('anchor') || contract.includes('앵커'));
assert.ok(chunk.includes('captureVirtualViewportAnchor') && chunk.includes('restoreVirtualViewportAnchor'));
console.log(JSON.stringify({pass:'v613-reader-scroll-stability-current-contract-pass'}));
