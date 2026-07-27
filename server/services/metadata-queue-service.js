const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadJsonWithBackup, atomicWriteJsonSync, atomicWriteJsonAsync } = require('../repositories/json-file-store');

const METADATA_QUEUE_PASS = 'v578-metadata-queue-bulk-pass';
const METADATA_QUEUE_PERSISTENCE_COALESCING_PASS = 'v591-metadata-queue-persistence-coalescing-pass';
const METADATA_QUEUE_GRACEFUL_STOP_PASS = 'v592-metadata-queue-graceful-stop-pass';
const METADATA_QUEUE_RESTART_RESUME_PASS = 'v614-metadata-queue-restart-resume-pass';
const METADATA_QUEUE_DURABLE_ENQUEUE_PASS = 'v661-metadata-queue-durable-enqueue-pass';
const METADATA_QUEUE_TRANSACTIONAL_ENQUEUE_PASS = 'v671-metadata-queue-transactional-enqueue-pass';
const METADATA_QUEUE_ASYNC_CHECKPOINT_PASS = 'v671-metadata-queue-async-checkpoint-pass';
const METADATA_QUEUE_STOPPED_CODE = 'METADATA_QUEUE_STOPPED';
const DEFAULT_PROGRESS_PERSIST_DELAY_MS = 300;
const PROGRESS_ONLY_PATCH_KEYS = new Set([
  'progress', 'message', 'cursor', 'processed', 'total',
  'succeeded', 'failed', 'empty', 'skipped', 'autoApplied', 'candidateOnly', 'recoveredApplied', 'pendingCandidates', 'appliedCount', 'manualReview',
  'currentNovelId', 'currentTitle', 'currentProviderId', 'lastProviderId',
  'lastProcessedAt', 'estimatedRemainingMs'
]);



function stableJobKey(input = {}) {
  const providers = Array.isArray(input.providerIds) ? input.providerIds.map(String).sort() : [];
  return JSON.stringify({
    type:String(input.type || ''),
    mode:String(input.mode || ''),
    novelId:String(input.novel && input.novel.id || ''),
    targetUrl:String(input.targetUrl || ''),
    providerIds:providers
  });
}

function isProgressOnlyPatch(patch = {}) {
  const keys = Object.keys(patch || {});
  return keys.length > 0 && keys.every((key) => PROGRESS_ONLY_PATCH_KEYS.has(key));
}

function requesterIds(input = {}) {
  const values = [...(Array.isArray(input.requesters) ? input.requesters : []), input.requestedBy];
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}

function addJobRequesters(job, input = {}) {
  const before = requesterIds(job);
  const after = Array.from(new Set([...before, ...requesterIds(input)]));
  if (before.length === after.length && before.every((value, index) => value === after[index])) return false;
  job.requesters = after;
  if (!job.requestedBy && after.length) job.requestedBy = after[0];
  job.updatedAt = new Date().toISOString();
  return true;
}

function createMetadataQueueService(options = {}) {
  const storePath = options.storePath;
  const concurrency = Math.max(1, Math.min(4, Number(options.concurrency) || 1));
  const maxJobs = Math.max(10, Math.min(200000, Number(options.maxJobs) || 2000));
  const pollMs = Math.max(250, Math.min(10000, Number(options.pollMs) || 750));
  const maxAttempts = Math.max(1, Math.min(5, Number(options.maxAttempts) || 2));
  const progressPersistDelayMs = Math.max(50, Math.min(5000, Number(options.progressPersistDelayMs) || DEFAULT_PROGRESS_PERSIST_DELAY_MS));
  const handler = options.handler;
  const logger = options.logger || console;
  const writeJsonSync = typeof options.writeJsonSync === 'function' ? options.writeJsonSync : atomicWriteJsonSync;
  const writeJsonAsync = typeof options.writeJsonAsync === 'function' ? options.writeJsonAsync : atomicWriteJsonAsync;
  let state = { schemaVersion:1, jobs:[] };
  let timer = null;
  let persistTimer = null;
  let persistDirty = false;
  let stopped = false;
  let started = false;
  let active = 0;
  const controllers = new Map();
  const activeRuns = new Set();
  let stopPromise = null;
  let persistChain = Promise.resolve();
  let checkpointPromise = null;
  let pendingWrites = 0;
  let lastPersistenceError = null;
  const persistenceMetrics = {
    writes: 0,
    immediateWrites: 0,
    delayedWrites: 0,
    progressUpdates: 0,
    coalescedProgressUpdates: 0,
    coalescedCheckpointUpdates: 0,
    lastWriteAt: 0
  };

  function cloneJson(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function snapshotState(source = state) {
    return {
      schemaVersion:1,
      jobs:(Array.isArray(source.jobs) ? source.jobs : []).map(job => ({
        ...job,
        requesters:Array.isArray(job.requesters) ? job.requesters.slice() : [],
        providerIds:Array.isArray(job.providerIds) ? job.providerIds.slice() : job.providerIds,
        novel:job.novel && typeof job.novel === 'object' ? cloneJson(job.novel) : job.novel,
        result:job.result && typeof job.result === 'object' ? cloneJson(job.result) : job.result
      }))
    };
  }

  function yieldToEventLoop() {
    return new Promise(resolve => setImmediate(resolve));
  }

  function reportPersistenceError(error) {
    lastPersistenceError = error || null;
    if (logger && typeof logger.error === 'function') logger.error('metadata queue persistence failed:', error && error.message || error);
  }

  function persistNow(reason = 'immediate', force = true) {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = null;
    if (force) persistDirty = true;
    if (!persistDirty) return checkpointPromise || persistChain;
    if (checkpointPromise) {
      persistenceMetrics.coalescedCheckpointUpdates += 1;
      return checkpointPromise;
    }
    pendingWrites += 1;
    const next = persistChain
      .catch(() => {})
      .then(async () => {
        // One bounded checkpoint loop absorbs all state transitions that occur
        // while a prior snapshot/write is in flight. This avoids one O(n)
        // clone and one full queue rewrite per start/progress/finish transition.
        do {
          persistDirty = false;
          await yieldToEventLoop();
          const snapshot = snapshotState(state);
          await writeJsonAsync(storePath, snapshot);
          persistenceMetrics.writes += 1;
          if (reason === 'progress') persistenceMetrics.delayedWrites += 1;
          else persistenceMetrics.immediateWrites += 1;
          persistenceMetrics.lastWriteAt = Date.now();
        } while (persistDirty);
      })
      .then(() => {
        lastPersistenceError = null;
        return true;
      })
      .catch((error) => {
        persistDirty = true;
        reportPersistenceError(error);
        throw error;
      })
      .finally(() => {
        checkpointPromise = null;
        pendingWrites = Math.max(0, pendingWrites - 1);
      });
    checkpointPromise = next;
    persistChain = next;
    return next;
  }

  function persistInBackground(reason = 'immediate', force = true) {
    persistNow(reason, force).catch(() => {});
  }

  function persistSoon() {
    persistDirty = true;
    persistenceMetrics.progressUpdates += 1;
    if (stopped) {
      persistInBackground('progress', true);
      return true;
    }
    if (persistTimer) {
      persistenceMetrics.coalescedProgressUpdates += 1;
      return false;
    }
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistInBackground('progress', false);
    }, progressPersistDelayMs);
    persistTimer.unref?.();
    return true;
  }

  async function flush() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = null;
    while (persistDirty || pendingWrites > 0) {
      if (persistDirty) persistNow('flush', true).catch(() => {});
      await persistChain;
    }
    if (lastPersistenceError) throw lastPersistenceError;
    return true;
  }

  function compact() {
    if (state.jobs.length <= maxJobs) return false;
    const activeJobs = state.jobs.filter(job => ['queued','running'].includes(job.status));
    const finished = state.jobs.filter(job => !['queued','running'].includes(job.status))
      .sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, Math.max(0, maxJobs - activeJobs.length));
    state.jobs = [...activeJobs, ...finished].sort((a,b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    return true;
  }

  function load() {
    const loaded = loadJsonWithBackup(storePath, null);
    const parsed = loaded && loaded.ok ? loaded.data : null;
    if (parsed && parsed.schemaVersion === 1 && Array.isArray(parsed.jobs)) state = parsed;
    let changed = !!(loaded && loaded.source === 'backup');
    for (const job of state.jobs) {
      if (job.status === 'running') {
        job.status = 'queued';
        job.cancelRequested = false;
        job.updatedAt = new Date().toISOString();
        job.lastError = '';
        job.message = '서버 재시작 후 재개 대기';
        changed = true;
      }
      const dedupeKey = String(job.dedupeKey || stableJobKey(job));
      if (job.dedupeKey !== dedupeKey) {
        job.dedupeKey = dedupeKey;
        changed = true;
      }
    }
    if (compact()) changed = true;
    if (changed || !loaded.ok) {
      writeJsonSync(storePath, state);
      persistenceMetrics.writes += 1;
      persistenceMetrics.immediateWrites += 1;
      persistenceMetrics.lastWriteAt = Date.now();
    }
  }

  function createJob(input, dedupeKey, now) {
    return {
      id:`mj_${crypto.randomBytes(12).toString('hex')}`,
      status:'queued',
      progress:0,
      message:'대기 중',
      attempts:0,
      cancelRequested:false,
      createdAt:now,
      updatedAt:now,
      startedAt:null,
      finishedAt:null,
      lastError:'',
      result:null,
      ...input,
      requesters:requesterIds(input),
      dedupeKey
    };
  }

  function planEnqueue(inputs = [], sourceState = state) {
    const list = Array.isArray(inputs) ? inputs : [];
    if (!list.length) return { nextState:sourceState, results:[], changed:false };
    if (list.length > maxJobs) throw Object.assign(new Error('metadata enqueue batch exceeds queue capacity'), { code:'METADATA_QUEUE_BATCH_TOO_LARGE' });

    const activeByKey = new Map();
    for (const job of sourceState.jobs) {
      if (!['queued','running'].includes(job.status) || job.cancelRequested) continue;
      const key = String(job.dedupeKey || stableJobKey(job));
      if (!activeByKey.has(key)) activeByKey.set(key, job);
    }
    const uniqueNewKeys = [];
    const seenNew = new Set();
    for (const input of list) {
      const key = stableJobKey(input);
      if (activeByKey.has(key) || seenNew.has(key)) continue;
      seenNew.add(key);
      uniqueNewKeys.push(key);
    }
    if (activeByKey.size + uniqueNewKeys.length > maxJobs) throw Object.assign(new Error('metadata queue is full'), { code:'METADATA_QUEUE_FULL' });

    const now = new Date().toISOString();
    const jobs = sourceState.jobs.slice();
    const byId = new Map(jobs.map((job, index) => [String(job.id), { job, index }]));
    const createdByKey = new Map();
    const results = [];
    let changed = false;
    for (const input of list) {
      const dedupeKey = stableJobKey(input);
      let job = activeByKey.get(dedupeKey) || createdByKey.get(dedupeKey);
      if (!job) {
        job = createJob(input, dedupeKey, now);
        jobs.push(job);
        createdByKey.set(dedupeKey, job);
        activeByKey.set(dedupeKey, job);
        changed = true;
      } else {
        const requesters = Array.from(new Set([...requesterIds(job), ...requesterIds(input)]));
        const before = requesterIds(job);
        if (before.length !== requesters.length || before.some((value, index) => value !== requesters[index])) {
          const current = byId.get(String(job.id));
          const replacement = { ...job, requesters, requestedBy:job.requestedBy || requesters[0] || '', updatedAt:now };
          if (current) jobs[current.index] = replacement;
          activeByKey.set(dedupeKey, replacement);
          job = replacement;
          changed = true;
        }
      }
      results.push(job);
    }
    const nextState = changed ? { schemaVersion:1, jobs } : sourceState;
    if (changed && nextState.jobs.length > maxJobs) {
      const activeJobs = nextState.jobs.filter(job => ['queued','running'].includes(job.status));
      const finished = nextState.jobs.filter(job => !['queued','running'].includes(job.status))
        .sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        .slice(0, Math.max(0, maxJobs - activeJobs.length));
      nextState.jobs = [...activeJobs, ...finished].sort((a,b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      const retained = new Map(nextState.jobs.map(job => [String(job.id), job]));
      for (let index = 0; index < results.length; index += 1) results[index] = retained.get(String(results[index].id)) || results[index];
    }
    return { nextState, results, changed };
  }

  function enqueueMany(inputs = [], enqueueOptions = {}) {
    const plan = planEnqueue(inputs, state);
    if (!plan.changed) return plan.results;
    state = plan.nextState;
    persistInBackground('enqueue', true);
    if (enqueueOptions.deferSchedule !== true) schedule(0);
    return plan.results;
  }

  function enqueue(input = {}, enqueueOptions = {}) {
    return enqueueMany([input], enqueueOptions)[0];
  }

  async function enqueueManyDurable(inputs = [], enqueueOptions = {}) {
    const list = Array.isArray(inputs) ? inputs : [];
    if (!list.length) return [];
    pendingWrites += 1;
    let committedResults = [];
    const next = persistChain
      .catch(() => {})
      .then(async () => {
        const plan = planEnqueue(list, state);
        if (!plan.changed) {
          committedResults = plan.results;
          return;
        }
        await yieldToEventLoop();
        const snapshot = snapshotState(plan.nextState);
        await writeJsonAsync(storePath, snapshot);
        // Publish only after the durable primary commit succeeds. Any later
        // checkpoint in persistChain observes the newly committed jobs.
        state = plan.nextState;
        committedResults = plan.results.map(job => get(job.id) || job);
        lastPersistenceError = null;
        persistenceMetrics.writes += 1;
        persistenceMetrics.immediateWrites += 1;
        persistenceMetrics.lastWriteAt = Date.now();
      })
      .catch((error) => {
        reportPersistenceError(error);
        error.code = error.code || 'METADATA_QUEUE_PERSIST_FAILED';
        error.statusCode = Number(error.statusCode) || 503;
        error.retryAfterSeconds = Number(error.retryAfterSeconds) || 5;
        error.pass = METADATA_QUEUE_DURABLE_ENQUEUE_PASS;
        throw error;
      })
      .finally(() => { pendingWrites = Math.max(0, pendingWrites - 1); });
    persistChain = next;
    await next;
    if (enqueueOptions.deferSchedule !== true && committedResults.length) schedule(0);
    return committedResults;
  }

  async function enqueueDurable(input = {}, enqueueOptions = {}) {
    const jobs = await enqueueManyDurable([input], enqueueOptions);
    return jobs[0];
  }

  function list(limit = 100) {
    return state.jobs.slice().sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, Math.max(1, Math.min(500, Number(limit) || 100)));
  }

  function get(jobId) { return state.jobs.find(job => job.id === String(jobId || '')) || null; }
  function all() { return state.jobs.slice(); }

  function findActive(input = {}) {
    const key = stableJobKey(input);
    return state.jobs.find(job => ['queued','running'].includes(job.status) && !job.cancelRequested && String(job.dedupeKey || stableJobKey(job)) === key) || null;
  }

  function update(job, patch = {}) {
    const current = get(job && job.id) || job;
    if (!current) return null;
    Object.assign(current, patch, { updatedAt:new Date().toISOString() });
    if (isProgressOnlyPatch(patch)) persistSoon();
    else persistInBackground('update', true);
    return current;
  }

  function cancel(jobId) {
    const job = get(jobId);
    if (!job) return null;
    if (job.status === 'queued') update(job, { status:'cancelled', cancelRequested:true, message:'취소됨', finishedAt:new Date().toISOString() });
    else if (job.status === 'running') {
      update(job, { cancelRequested:true, message:'취소 요청됨' });
      const reason = Object.assign(new Error('metadata job cancelled'), { code:'METADATA_JOB_CANCELLED' });
      controllers.get(job.id)?.abort(reason);
    }
    return job;
  }

  function assertNotCancelled(job) {
    if (job.cancelRequested) throw Object.assign(new Error('metadata job cancelled'), { code:'METADATA_JOB_CANCELLED' });
  }

  async function run(job) {
    active += 1;
    const controller = new AbortController();
    controllers.set(job.id, controller);
    update(job, { status:'running', attempts:(Number(job.attempts)||0)+1, startedAt:job.startedAt || new Date().toISOString(), message:'수집 중' });
    try {
      assertNotCancelled(job);
      const result = await handler(job, { update:patch => update(job, patch), assertNotCancelled:() => assertNotCancelled(job), signal:controller.signal });
      assertNotCancelled(job);
      update(job, { status:'completed', progress:1, message:'완료', result:result || null, finishedAt:new Date().toISOString(), lastError:'' });
    } catch (error) {
      const code = String(error && error.code || controller.signal?.reason?.code || '');
      if (code === METADATA_QUEUE_STOPPED_CODE) update(job, {
        status:'queued',
        attempts:Math.max(0, (Number(job.attempts)||0) - 1),
        cancelRequested:false,
        message:'서버 재시작 후 재개 대기',
        finishedAt:null,
        lastError:''
      });
      else if (job.cancelRequested || code === 'METADATA_JOB_CANCELLED') update(job, { status:'cancelled', message:'취소됨', finishedAt:new Date().toISOString(), lastError:'' });
      else if ((Number(job.attempts)||0) < maxAttempts) update(job, { status:'queued', message:'재시도 대기', lastError:String(error && error.message || error).slice(0,1000) });
      else update(job, { status:'failed', message:'실패', finishedAt:new Date().toISOString(), lastError:String(error && error.message || error).slice(0,1000) });
    } finally {
      controllers.delete(job.id);
      active -= 1;
      schedule(pollMs);
    }
  }

  function tick() {
    timer = null;
    if (stopped) return;
    while (active < concurrency) {
      const job = state.jobs.find(item => item.status === 'queued' && !item.cancelRequested);
      if (!job) break;
      const task = run(job);
      activeRuns.add(task);
      task.finally(() => activeRuns.delete(task)).catch(() => {});
    }
  }

  function schedule(delay = pollMs) {
    if (!started || stopped || timer) return;
    timer = setTimeout(tick, Math.max(0, delay));
    timer.unref?.();
  }

  function wake() {
    schedule(0);
  }

  function start() {
    stopped = false;
    started = true;
    schedule(0);
  }

  function stop() {
    if (stopPromise) return stopPromise;
    stopped = true;
    started = false;
    if (timer) clearTimeout(timer);
    timer = null;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = null;
    for (const controller of controllers.values()) controller.abort(Object.assign(new Error('metadata queue stopped for restart'), { code:METADATA_QUEUE_STOPPED_CODE }));
    stopPromise = Promise.allSettled(Array.from(activeRuns)).then(async () => {
      controllers.clear();
      await flush();
      return { stopped:true, active:activeRuns.size, pass:METADATA_QUEUE_GRACEFUL_STOP_PASS };
    });
    return stopPromise;
  }

  function status() {
    const bulk = state.jobs.filter(job => job.type === 'collect-bulk' && ['queued','running'].includes(job.status) && !job.cancelRequested);
    return {
      pass:METADATA_QUEUE_PASS,
      persistencePass:METADATA_QUEUE_PERSISTENCE_COALESCING_PASS,
      active,
      queued:state.jobs.filter(job => job.status === 'queued').length,
      running:state.jobs.filter(job => job.status === 'running').length,
      total:state.jobs.length,
      maxJobs,
      concurrency,
      stopped,
      started,
      gracefulStopPass:METADATA_QUEUE_GRACEFUL_STOP_PASS,
      restartResumePass:METADATA_QUEUE_RESTART_RESUME_PASS,
      activeRuns:activeRuns.size,
      transactionalEnqueuePass:METADATA_QUEUE_TRANSACTIONAL_ENQUEUE_PASS,
      asyncCheckpointPass:METADATA_QUEUE_ASYNC_CHECKPOINT_PASS,
      persistence:{
        pending:!!persistTimer || pendingWrites > 0,
        pendingWrites,
        dirty:!!persistDirty,
        delayMs:progressPersistDelayMs,
        lastError:lastPersistenceError ? String(lastPersistenceError.message || lastPersistenceError) : '',
        ...persistenceMetrics
      },
      bulkActive:bulk.length,
      bulkJobs:bulk.map(job => ({
        id:job.id,
        status:job.status,
        total:Number(job.total)||0,
        cursor:Number(job.cursor)||0,
        succeeded:Number(job.succeeded)||0,
        failed:Number(job.failed)||0,
        empty:Number(job.empty)||0,
        skipped:Number(job.skipped)||0,
        autoApplied:Number(job.autoApplied)||0,
        candidateOnly:Number(job.candidateOnly)||0,
        recoveredApplied:Number(job.recoveredApplied)||0,
        pendingCandidates:Number(job.pendingCandidates)||0
      }))
    };
  }

  load();
  return {
    enqueue,
    enqueueMany,
    enqueueDurable,
    enqueueManyDurable,
    list,
    get,
    all,
    findActive,
    cancel,
    update,
    wake,
    start,
    stop,
    status,
    flush,
    pass:METADATA_QUEUE_PASS,
    persistencePass:METADATA_QUEUE_PERSISTENCE_COALESCING_PASS,
    gracefulStopPass:METADATA_QUEUE_GRACEFUL_STOP_PASS,
    restartResumePass:METADATA_QUEUE_RESTART_RESUME_PASS,
    durableEnqueuePass:METADATA_QUEUE_DURABLE_ENQUEUE_PASS,
    transactionalEnqueuePass:METADATA_QUEUE_TRANSACTIONAL_ENQUEUE_PASS,
    asyncCheckpointPass:METADATA_QUEUE_ASYNC_CHECKPOINT_PASS
  };
}

module.exports = {
  METADATA_QUEUE_PASS,
  METADATA_QUEUE_PERSISTENCE_COALESCING_PASS,
  METADATA_QUEUE_GRACEFUL_STOP_PASS,
  METADATA_QUEUE_RESTART_RESUME_PASS,
  METADATA_QUEUE_DURABLE_ENQUEUE_PASS,
  METADATA_QUEUE_TRANSACTIONAL_ENQUEUE_PASS,
  METADATA_QUEUE_ASYNC_CHECKPOINT_PASS,
  createMetadataQueueService,
  stableJobKey,
  isProgressOnlyPatch
};
