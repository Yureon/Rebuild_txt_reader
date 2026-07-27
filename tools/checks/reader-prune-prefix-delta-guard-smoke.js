#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const PASS = 'v466-reader-prune-prefix-delta-guard-pass';
const layout = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout.mjs'), 'utf8');
const chunkWindow = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/reader/chunk-window.mjs'), 'utf8');
assert.ok(layout.includes(`READER_PRUNE_PREFIX_DELTA_GUARD_PASS = '${PASS}'`), 'prune prefix delta marker missing');
assert.ok(layout.includes('function tryPruneVirtualRowsIncrementally('), 'incremental prune helper missing');
assert.ok(layout.includes("reason: 'edge prune kept prefix delta without rebuilding rows from loaded chunks'"), 'incremental prune success diagnostic missing');
assert.ok(layout.includes('nextPrefix.push(Math.max(0, (Number(v.prefix[i]) || 0) - topDelta));'), 'prefix delta reuse must subtract top delta from existing prefix');
assert.ok(layout.includes('pruneVirtualMeasureCacheByIds(v, removedIds);'), 'prune must delete only removed measure cache ids');
assert.ok(layout.includes('pruneVirtualRowElementPoolByIds(v, removedIds);'), 'prune must delete only removed DOM pool ids');
const pruneInterceptIndex = layout.indexOf('if (tryPruneVirtualRowsIncrementally(app, mode, focusedChunk, { options })) return;');
const fullRebuildIndex = layout.indexOf('v.rows = decorateRowsWithGlobalBlocks(app, rows);');
assert.ok(pruneInterceptIndex >= 0 && fullRebuildIndex >= 0 && pruneInterceptIndex < fullRebuildIndex, 'prune must be intercepted before full rebuild');
assert.ok(chunkWindow.includes('prunedChunks: plan.removed.slice(), removedBeforeHeight'), 'chunk-window prune must pass removed chunks and before-height');
console.log(JSON.stringify({ pass: PASS }));
