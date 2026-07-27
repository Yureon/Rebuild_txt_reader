#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  READER_CHUNK_LOAD_JOIN_PASS,
  isReaderRequestCurrent,
  resolveReaderChunkLoadJoin
} from '../../public/scripts/rebuild/features/reader/request-guards.mjs';

const currentA = { novel:{ id:'same-novel' }, episode:{ id:'episode-1' } };
const currentB = { novel:{ id:'same-novel' }, episode:{ id:'episode-1' } };
const owner = { sessionId:7, current:currentA, mode:'append', promise:Promise.resolve({ chunk:3 }) };

assert.equal(resolveReaderChunkLoadJoin(owner, { sessionId:7, current:currentA, mode:'append' }).action, 'join');
assert.equal(resolveReaderChunkLoadJoin(owner, { sessionId:7, current:currentA, mode:'prepend' }).action, 'join');
assert.equal(resolveReaderChunkLoadJoin(owner, { sessionId:7, current:currentA, mode:'jump' }).action, 'promote');
assert.equal(resolveReaderChunkLoadJoin(owner, { sessionId:8, current:currentA, mode:'jump' }).action, 'stale');
assert.equal(resolveReaderChunkLoadJoin(owner, { sessionId:7, current:currentB, mode:'jump' }).action, 'stale');
assert.equal(READER_CHUNK_LOAD_JOIN_PASS, 'v608-reader-chunk-load-join-pass');

const controller = new AbortController();
const app = { state:{ readerSessionId:7, current:currentA } };
assert.equal(isReaderRequestCurrent(app, { signal:controller.signal, sessionId:7, current:currentA, data:{} }), true);
controller.abort();
assert.equal(isReaderRequestCurrent(app, { signal:controller.signal, sessionId:7, current:currentA, data:{} }), false);

const readerSource = fs.readFileSync('public/scripts/rebuild/features/reader.mjs', 'utf8');
assert.ok(readerSource.includes("action === 'promote'"), 'foreground jump must promote a joined background chunk load');
assert.ok((readerSource.match(/isReaderRequestCurrent\(app, \{ signal, sessionId, current:c, data:manifest \}\)/g) || []).length >= 2,
  'document and folder manifests must both enforce signal/session/current ownership');
const progressSource = fs.readFileSync('public/scripts/rebuild/features/reader/progress.mjs', 'utf8');
assert.ok(progressSource.includes('progressLifecycleSyncRequest') && progressSource.includes('keepalive'), 'lifecycle progress must use the independent keepalive path');
assert.ok(readerSource.includes('refreshSessionId === app.state.readerSessionId && refreshCurrent === app.state.current'),
  'deferred slider refresh must not update a newer reader context');
assert.ok(readerSource.includes('v.viewportTransitionTimers = delays.map'), 'viewport transition timers must be owned by reader virtual state');

const openStateSource = fs.readFileSync('public/scripts/rebuild/features/reader/open-state.mjs', 'utf8');
assert.ok(openStateSource.includes('clearReaderOpenDeferredTimers(app)'));
assert.ok(openStateSource.includes('virtual.pendingViewportTransitionAnchor = null'));

const apiSource = fs.readFileSync('public/scripts/rebuild/core/api.mjs', 'utf8');
assert.ok(apiSource.includes('if (options.keepalive === true) init.keepalive = true;'));

console.log(JSON.stringify({
  pass:'v608-reader-race-ownership-smoke-pass',
  scenarios:['append-join','prepend-join','jump-promote','session-stale','same-novel-new-current-stale','abort-stale','progress-keepalive','deferred-timer-ownership']
}));
