#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');
const { createMetadataCoverService } = require('../../server/services/metadata-cover-service');
const {
  createMetadataService,
  METADATA_AUTO_APPLY_POLICY_PASS,
  METADATA_AUTO_APPLY_RECOVERY_PASS
} = require('../../server/services/metadata-service');

const PASS = 'v614-metadata-auto-apply-smoke-pass';

function waitFor(check, timeoutMs = 7000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        const value = check();
        if (value) return resolve(value);
      } catch (error) { return reject(error); }
      if (Date.now() - started > timeoutMs) return reject(new Error('metadata auto apply timeout'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-metadata-auto-v614-'));
  try {
    const fixtureRoot = path.join(__dirname, '../fixtures/metadata/kakaopage-webnovel-v1/r11');
    const fixture = name => fs.readFileSync(path.join(fixtureRoot, name), 'utf8');
    const png = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,73,69,78,68]);
    const transport = {
      async fetchProvider(_provider, url, options = {}) {
        if (options.kind === 'cover') return { body:png, contentType:'image/png', finalUrl:url };
        if (url.includes('/search/series')) return { body:fixture('search-primary.json'), contentType:'application/json', finalUrl:url };
        if (url.includes('/content/overview')) return { body:fixture('detail-overview.json'), contentType:'application/json', finalUrl:url };
        if (url.includes('/content/about')) return { body:fixture('detail-about.json'), contentType:'application/json', finalUrl:url };
        throw new Error(`unexpected URL ${url}`);
      }
    };
    const store = createMetadataStoreService({ storePath:path.join(root, 'metadata.json') });
    const cover = createMetadataCoverService({ coverDir:path.join(root, 'covers'), transport });
    let virtualNow = 0;
    const service = createMetadataService({
      store,
      transport,
      coverService:cover,
      queuePath:path.join(root, 'queue.json'),
      bulkDir:path.join(root, 'batches'),
      enabled:true,
      requestIntervalMs:3000,
      now:() => virtualNow,
      delay:async ms => { virtualNow += ms; },
      random:() => 0,
      concurrency:1,
      maxJobs:32,
      maxAttempts:1,
      pollMs:20,
      autoApplyThreshold:0.94
    });
    try {
      // Exact official title with a local author label mismatch used to score 0.9 and
      // remain candidate-only even though the result was unambiguous.
      const novel = { id:'auto-search', title:'요리의 신이 강림했다', author:'로컬 표기 작가', progressAliases:['auto-search'] };
      const job = await service.collect(novel, { providerIds:['builtin-kakaopage'] }, 'owner');
      const finished = await waitFor(() => {
        const current = service.getJob(job.id);
        return current && ['completed','failed'].includes(current.status) ? current : null;
      });
      assert.equal(finished.status, 'completed', finished.lastError);
      assert.equal(finished.result.autoApplied, true);
      assert.equal(finished.result.autoApplyReason, 'exact_title');
      assert.equal(finished.result.autoApplyPass, METADATA_AUTO_APPLY_POLICY_PASS);
      assert.equal(service.getNovelMetadata(novel).applied?.data?.title, novel.title);

      // Metadata Helper capture is an official detail-page capture and should follow
      // the same provider auto-apply policy instead of always stopping at candidate.
      const captureNovel = { id:'auto-capture', title:'내가 키운 S급들', author:'로컬 작가명', progressAliases:['auto-capture'] };
      const pairing = service.createBrowserCapturePairing(captureNovel, 'owner');
      const capture = await service.importBrowserCapture(captureNovel, 'owner', pairing.token, {
        pageUrl:'https://series.naver.com/novel/detail.series?productNo=3777351',
        title:captureNovel.title,
        author:'근서',
        synopsis:'공식 상세 페이지에서 수집한 소개',
        genres:['판타지'],
        tags:['성장'],
        publicationStatus:'완결',
        sourceLanguage:'ko'
      });
      assert.equal(capture.autoApplied, true);
      assert.equal(capture.autoApplyPass, METADATA_AUTO_APPLY_POLICY_PASS);
      assert.equal(capture.applied?.data?.title, captureNovel.title);

      // A retained exact-title candidate should be applied before a new network batch
      // is generated, preserving collected work across deployment restarts.
      const retainedNovel = { id:'retained', title:'보존 후보 작품', author:'로컬 작가', progressAliases:['retained'] };
      store.saveCandidate(retainedNovel, { id:'builtin-kakaopage', name:'카카오페이지', adapterKey:'kakaopage-webnovel-v1', adapter:{ revision:11 } }, {
        title:retainedNovel.title,
        author:'공식 작가',
        sourceUrl:'https://page.kakao.com/content/999',
        remoteId:'999'
      }, { matchScore:0.9 });
      await store.flush();
      const recovered = await service.collectMissing([retainedNovel], { providerIds:['builtin-kakaopage'] }, 'owner');
      assert.equal(recovered.count, 0);
      assert.equal(recovered.recoveredApplied, 1);
      assert.equal(recovered.autoApplyPass, METADATA_AUTO_APPLY_RECOVERY_PASS);
      assert.equal(service.getNovelMetadata(retainedNovel).applied?.data?.title, retainedNovel.title);

      console.log(JSON.stringify({
        pass:PASS,
        searchReason:finished.result.autoApplyReason,
        browserCaptureApplied:capture.autoApplied,
        recoveredApplied:recovered.recoveredApplied
      }));
    } finally {
      await service.stop();
    }
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
}

run().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
