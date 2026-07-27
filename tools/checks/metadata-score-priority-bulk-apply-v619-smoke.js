#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');
const { createMetadataService, METADATA_BULK_APPLY_PASS, METADATA_AUTO_APPLY_POLICY_PASS } = require('../../server/services/metadata-service');

const PASS = 'v619-metadata-score-priority-bulk-apply-smoke-pass';

function waitFor(check, timeoutMs = 7000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        const value = check();
        if (value) return resolve(value);
      } catch (error) { return reject(error); }
      if (Date.now() - started > timeoutMs) return reject(new Error('metadata bulk apply timeout'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v619-bulk-apply-'));
  try {
    const store = createMetadataStoreService({ storePath:path.join(root, 'metadata.json') });
    const transport = { async fetchProvider() { throw new Error('network must not be used by bulk apply'); } };
    const coverService = { async cacheRemoteCover() { return null; } };
    const service = createMetadataService({
      store,
      transport,
      coverService,
      queuePath:path.join(root, 'queue.json'),
      bulkDir:path.join(root, 'batches'),
      enabled:true,
      concurrency:1,
      maxJobs:32,
      maxAttempts:1,
      pollMs:20,
      autoApplyThreshold:0.95
    });
    try {
      const priorityNovel = { id:'priority', title:'우선순위 작품', author:'작가', progressAliases:['priority'] };
      const lowPriorityProvider = { id:'builtin-novelpia', name:'노벨피아', adapterKey:'novelpia-webnovel-v1', revision:1 };
      const highPriorityProvider = { id:'builtin-naver-series', name:'네이버 시리즈', adapterKey:'naver-series-webnovel-v1', revision:1 };
      const lowPriorityCandidate = store.saveCandidate(priorityNovel, lowPriorityProvider, {
        title:'우선순위 작품', author:'작가', synopsis:'노벨피아 후보', sourceUrl:'https://novelpia.com/novel/1', remoteId:'1'
      }, { matchScore:0.99 });
      const highPriorityCandidate = store.saveCandidate(priorityNovel, highPriorityProvider, {
        title:'우선순위 작품', author:'작가', synopsis:'네이버 후보', sourceUrl:'https://series.naver.com/novel/detail.series?productNo=2', remoteId:'2'
      }, { matchScore:0.95 });

      const tieNovel = { id:'tie', title:'동점 작품', author:'작가', progressAliases:['tie'] };
      const tieLowPriorityCandidate = store.saveCandidate(tieNovel, lowPriorityProvider, {
        title:'동점 작품', author:'작가', synopsis:'노벨피아 동점 후보', sourceUrl:'https://novelpia.com/novel/4', remoteId:'4'
      }, { matchScore:0.97 });
      const tieHighPriorityCandidate = store.saveCandidate(tieNovel, highPriorityProvider, {
        title:'동점 작품', author:'작가', synopsis:'네이버 동점 후보', sourceUrl:'https://series.naver.com/novel/detail.series?productNo=5', remoteId:'5'
      }, { matchScore:0.97 });

      const belowNovel = { id:'below', title:'기준 미달 작품', author:'작가', progressAliases:['below'] };
      store.saveCandidate(belowNovel, highPriorityProvider, {
        title:'비슷하지만 다른 작품', author:'작가', synopsis:'기준 미달', sourceUrl:'https://series.naver.com/novel/detail.series?productNo=3', remoteId:'3'
      }, { matchScore:0.949 });
      await store.flush();

      const queued = await service.applyPending([priorityNovel, tieNovel, belowNovel], 'owner');
      assert.equal(queued.count, 2, 'only novels with 95% or higher candidates should enter the bulk apply batch');
      assert.equal(queued.manualReview, 1, 'below-threshold candidates must remain manual review');
      assert.equal(queued.pass, METADATA_BULK_APPLY_PASS);
      assert(queued.job && queued.job.id, 'bulk apply must use the persistent queue');

      const finished = await waitFor(() => {
        const current = service.getJob(queued.job.id);
        return current && ['completed','failed'].includes(current.status) ? current : null;
      });
      assert.equal(finished.status, 'completed', finished.lastError);
      assert.equal(finished.result.pass, METADATA_BULK_APPLY_PASS);
      assert.equal(finished.result.appliedCount, 2);
      const applied = service.getNovelMetadata(priorityNovel).applied;
      assert.equal(applied.candidateId, lowPriorityCandidate.id, 'higher match score must win before provider priority');
      assert.notEqual(applied.candidateId, highPriorityCandidate.id, 'lower-score higher-priority provider must not override a stronger match');
      const tieApplied = service.getNovelMetadata(tieNovel).applied;
      assert.equal(tieApplied.candidateId, tieHighPriorityCandidate.id, 'provider priority must break equal-score ties');
      assert.notEqual(tieApplied.candidateId, tieLowPriorityCandidate.id, 'lower-priority provider must lose an equal-score tie');
      assert.equal(service.getNovelMetadata(belowNovel).applied, null, 'below-threshold candidate must not be applied');

      const source = fs.readFileSync(path.join(__dirname, '../../server/services/metadata-service.js'), 'utf8');
      assert(source.includes("const METADATA_AUTO_APPLY_POLICY_PASS = 'v619-metadata-auto-apply-score-priority-pass';"));
      assert(source.includes('return Number(right.matchScore) - Number(left.matchScore)'));
      assert(source.includes('|| leftPriority - rightPriority'));
      assert(source.includes('matchScore >= autoApplyThreshold'));
      assert.equal(METADATA_AUTO_APPLY_POLICY_PASS, 'v619-metadata-auto-apply-score-priority-pass');

      console.log(JSON.stringify({ pass:PASS, appliedProvider:applied.providerId, appliedScore:0.99, manualReview:queued.manualReview }));
    } finally {
      await service.stop();
    }
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
