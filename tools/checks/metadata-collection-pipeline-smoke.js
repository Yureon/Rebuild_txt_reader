#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');
const { createMetadataCoverService } = require('../../server/services/metadata-cover-service');
const { createMetadataService } = require('../../server/services/metadata-service');

function waitFor(check, timeoutMs = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try { const value = check(); if (value) return resolve(value); } catch (error) { return reject(error); }
      if (Date.now() - start > timeoutMs) return reject(new Error('metadata pipeline timeout'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-pipeline-'));
  try {
    const fixture = rel => fs.readFileSync(path.join(__dirname, '../fixtures/metadata/kakaopage-webnovel-v1/r11', rel), 'utf8');
    const png = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,73,69,78,68]);
    const calls = [];
    const transport = {
      async fetchProvider(_provider, url, options = {}) {
        calls.push({ url, kind:options.kind || 'request', hasCookie:Object.prototype.hasOwnProperty.call(options,'cookie') });
        if (options.signal?.aborted) throw options.signal.reason;
        if (options.kind === 'cover') return { body:png, contentType:'image/png', finalUrl:url };
        if (url.includes('/content/overview')) return { body:fixture('detail-overview.json'), finalUrl:url, contentType:'application/json' };
        if (url.includes('/content/about')) return { body:fixture('detail-about.json'), finalUrl:url, contentType:'application/json' };
        throw new Error(`unexpected URL ${url}`);
      }
    };
    const store = createMetadataStoreService({ storePath:path.join(root,'metadata.json') });
    const cover = createMetadataCoverService({ coverDir:path.join(root,'covers'), transport });
    let virtualNow = 0;
    const service = createMetadataService({
      store, transport, coverService:cover, queuePath:path.join(root,'queue.json'),
      enabled:true, requestIntervalMs:250, now:() => virtualNow, delay:async ms => { virtualNow += ms; }, concurrency:1, maxJobs:32, autoApplyThreshold:0.94, maxAttempts:1, pollMs:20
    });
    const novel = { id:'n1', title:'요리의 신이 강림했다', author:'김촌지', progressAliases:['n1'] };
    const job = await service.collect(novel, { url:'https://page.kakao.com/content/66136165' }, 'owner');
    const finished = await waitFor(() => {
      const current = service.getJob(job.id);
      return current && ['completed','failed'].includes(current.status) ? current : null;
    });
    assert.equal(finished.status, 'completed', finished.lastError);
    const payload = service.getNovelMetadata(novel);
    assert(payload.applied);
    assert.equal(payload.applied.data.title, '요리의 신이 강림했다');
    assert.equal(payload.applied.data.author, '김촌지');
    assert(payload.applied.data.coverUrl.startsWith('/api/metadata/covers/'));
    assert.equal(Object.prototype.hasOwnProperty.call(payload.applied.data, 'coverRemoteUrl'), false, 'remote cover URL must not be exposed');
    assert.equal(payload.candidates.length, 1);
    assert.equal(Object.prototype.hasOwnProperty.call(payload.candidates[0].data, 'rawSha256'), false);
    assert(calls.some(call => call.url.includes('/content/overview')));
    assert(!calls.some(call => call.url.includes('/content/about')), 'fallback-only about request must be skipped after a complete overview response');
    const imageCall = calls.find(call => call.kind === 'cover');
    assert(imageCall);
    assert.equal(imageCall.hasCookie, false, 'metadata collection must not pass manually supplied Cookie headers');
    if (typeof service.stop === 'function') await service.stop();
    console.log(JSON.stringify({ pass:'v576-metadata-collection-pipeline-smoke-pass', calls:calls.length, applied:payload.applied.id }));
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
}
run().catch(error => { console.error(error && error.stack || error); process.exitCode=1; });
