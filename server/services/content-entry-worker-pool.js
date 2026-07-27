const path = require('path');
const { Worker } = require('worker_threads');

const CONTENT_ENTRY_WORKER_POOL_PASS = 'v567-content-entry-worker-pool-pass';
const CONTENT_WORKER_QUEUE_BUDGET_PASS = 'v567-content-worker-queue-budget-pass';
const CONTENT_WORKER_IDLE_UNREF_PASS = 'v567-content-worker-idle-unref-pass';

function createAbortError(message = 'content worker task aborted') {
  const error = new Error(message);
  error.name = 'AbortError';
  error.code = 'CONTENT_WORKER_TASK_ABORTED';
  error.status = 499;
  error.statusCode = 499;
  error.pass = CONTENT_ENTRY_WORKER_POOL_PASS;
  return error;
}

function createQueueFullError(maxQueuedTasks = 0) {
  const error = new Error('content worker queue is full');
  error.name = 'ContentWorkerQueueFullError';
  error.code = 'CONTENT_WORKER_QUEUE_FULL';
  error.status = 503;
  error.statusCode = 503;
  error.retryAfterSeconds = 1;
  error.maxQueuedTasks = Math.max(0, Number(maxQueuedTasks) || 0);
  error.pass = CONTENT_WORKER_QUEUE_BUDGET_PASS;
  return error;
}

function normalizeWorkerCount(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.max(1, Math.min(32, n));
}

function normalizeQueueLimit(value, fallback = 8) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return fallback;
  return Math.max(0, Math.min(1024, n));
}

function createContentEntryWorkerPool(options = {}) {
  // Cold TXT preprocessing duplicates substantial string state between the worker
  // and main thread. Keep automatic concurrency conservative; operators may opt in
  // to a larger pool explicitly after measuring container memory headroom.
  const maxWorkers = normalizeWorkerCount(options.maxWorkers, 1);
  const maxQueuedTasks = normalizeQueueLimit(options.maxQueuedTasks, 8);
  const workerScript = options.workerScript || path.join(__dirname, '..', 'workers', 'content-entry-worker.js');
  const idleWorkerTtlMs = Math.max(1000, Number(options.idleWorkerTtlMs) || 30000);
  const workerResourceLimits = options.workerResourceLimits && typeof options.workerResourceLimits === 'object'
    ? { ...options.workerResourceLimits }
    : undefined;
  const queue = [];
  const idleWorkers = [];
  const workers = new Set();
  const terminatingWorkers = new Map();
  const metrics = {
    createdWorkers: 0,
    completedTasks: 0,
    failedTasks: 0,
    abortedQueuedTasks: 0,
    abortedRunningTasks: 0,
    rejectedQueueFullTasks: 0,
    enqueuedTasks: 0,
    maxQueueDepth: 0,
    idleWorkerTerminates: 0,
    workerTerminationFailures: 0,
    maxTerminatingWorkers: 0
  };
  let nextTaskId = 0;
  let closed = false;
  let closePromise = null;

  function normalizeWorkerError(raw) {
    const error = new Error(raw && raw.message || 'content worker failed');
    error.name = raw && raw.name || 'Error';
    error.code = raw && raw.code || undefined;
    error.status = raw && raw.status || raw && raw.statusCode || undefined;
    error.statusCode = raw && raw.statusCode || raw && raw.status || undefined;
    error.size = raw && raw.size || undefined;
    error.maxBytes = raw && raw.maxBytes || undefined;
    error.pass = raw && raw.pass || CONTENT_ENTRY_WORKER_POOL_PASS;
    if (raw && raw.stack) error.stack = raw.stack;
    return error;
  }

  function cleanupTask(task) {
    if (!task || task.cleaned) return;
    task.cleaned = true;
    if (task.signal && task.onAbort) task.signal.removeEventListener('abort', task.onAbort);
  }

  function rejectTask(task, error) {
    if (!task || task.settled) return;
    task.settled = true;
    cleanupTask(task);
    task.reject(error);
  }

  function resolveTask(task, value) {
    if (!task || task.settled) return;
    task.settled = true;
    cleanupTask(task);
    task.resolve(value);
  }

  function clearIdleTimer(worker) {
    if (worker && worker.idleTimer) {
      clearTimeout(worker.idleTimer);
      worker.idleTimer = null;
    }
  }

  function removeWorkerReferences(worker) {
    if (!worker) return;
    clearIdleTimer(worker);
    workers.delete(worker);
    const idleIndex = idleWorkers.indexOf(worker);
    if (idleIndex >= 0) idleWorkers.splice(idleIndex, 1);
  }

  function terminateWorkerTracked(worker) {
    if (!worker) return Promise.resolve(0);
    const existing = terminatingWorkers.get(worker);
    if (existing) return existing;
    removeWorkerReferences(worker);
    let termination;
    try { termination = Promise.resolve(worker.terminate()); }
    catch (error) { termination = Promise.reject(error); }
    const tracked = termination
      .catch(error => {
        metrics.workerTerminationFailures += 1;
        throw error;
      })
      .finally(() => {
        terminatingWorkers.delete(worker);
        if (!closed) drain();
      });
    terminatingWorkers.set(worker, tracked);
    metrics.maxTerminatingWorkers = Math.max(metrics.maxTerminatingWorkers, terminatingWorkers.size);
    return tracked;
  }

  function scheduleIdleWorkerTerminate(worker) {
    if (!worker || closed || worker.currentTask || worker.idleTimer) return;
    worker.idleTimer = setTimeout(() => {
      worker.idleTimer = null;
      if (closed || worker.currentTask || queue.length) return;
      metrics.idleWorkerTerminates += 1;
      terminateWorkerTracked(worker).catch(() => {});
    }, idleWorkerTtlMs);
    if (typeof worker.idleTimer.unref === 'function') worker.idleTimer.unref();
  }

  function createWorker() {
    const worker = new Worker(workerScript, workerResourceLimits ? { resourceLimits: workerResourceLimits } : undefined);
    if (typeof worker.unref === 'function') worker.unref();
    worker.currentTask = null;
    worker.idleTimer = null;
    workers.add(worker);
    metrics.createdWorkers += 1;

    worker.on('message', (message) => {
      const task = worker.currentTask;
      if (!task || task.id !== (message && message.id)) return;
      worker.currentTask = null;
      if (message && message.ok) {
        metrics.completedTasks += 1;
        resolveTask(task, message.result || {});
      } else {
        metrics.failedTasks += 1;
        rejectTask(task, normalizeWorkerError(message && message.error));
      }
      if (!closed) idleWorkers.push(worker);
      drain();
      if (!closed && !worker.currentTask) {
        if (typeof worker.unref === 'function') worker.unref();
        scheduleIdleWorkerTerminate(worker);
      }
    });

    worker.on('error', (error) => {
      const task = worker.currentTask;
      worker.currentTask = null;
      workers.delete(worker);
      const idleIndex = idleWorkers.indexOf(worker);
      if (idleIndex >= 0) idleWorkers.splice(idleIndex, 1);
      const message = error && error.message || String(error || 'content worker error');
      if (task && !task.settled) {
        metrics.failedTasks += 1;
        rejectTask(task, new Error(message));
      }
      if (!closed) drain();
    });

    worker.on('exit', (code) => {
      const task = worker.currentTask;
      worker.currentTask = null;
      workers.delete(worker);
      const idleIndex = idleWorkers.indexOf(worker);
      if (idleIndex >= 0) idleWorkers.splice(idleIndex, 1);
      if (task && !task.settled) {
        metrics.failedTasks += 1;
        rejectTask(task, createAbortError(code ? `content worker exited with code ${code}` : 'content worker exited'));
      }
      if (!closed) drain();
    });

    return worker;
  }

  function activeWorkerCount() {
    let count = 0;
    for (const worker of workers) if (worker.currentTask) count += 1;
    return count;
  }

  function getWorkerForTask() {
    while (idleWorkers.length) {
      const worker = idleWorkers.pop();
      if (worker && workers.has(worker) && !worker.currentTask) {
        clearIdleTimer(worker);
        return worker;
      }
    }
    if (workers.size + terminatingWorkers.size < maxWorkers) return createWorker();
    return null;
  }

  function startTask(worker, task) {
    if (!worker || !task || task.settled) return;
    clearIdleTimer(worker);
    if (typeof worker.ref === 'function') worker.ref();
    task.started = true;
    task.worker = worker;
    worker.currentTask = task;
    worker.postMessage({ id: task.id, payload: task.payload });
  }

  function drain() {
    if (closed) return;
    while (queue.length) {
      const worker = getWorkerForTask();
      if (!worker) return;
      const task = queue.shift();
      if (!task || task.settled) {
        idleWorkers.push(worker);
        continue;
      }
      startTask(worker, task);
    }
  }

  function abortTask(task) {
    if (!task || task.settled) return;
    if (!task.started) {
      const idx = queue.indexOf(task);
      if (idx >= 0) queue.splice(idx, 1);
      metrics.abortedQueuedTasks += 1;
      rejectTask(task, createAbortError());
      return;
    }
    metrics.abortedRunningTasks += 1;
    const worker = task.worker;
    rejectTask(task, createAbortError());
    if (worker) {
      worker.currentTask = null;
      terminateWorkerTracked(worker).catch(() => {});
    }
    drain();
  }

  function runTask(payload, options = {}) {
    const signal = options.signal || null;
    if (closed) return Promise.reject(new Error('content worker pool is closed'));
    if (signal && signal.aborted) return Promise.reject(createAbortError());
    if (maxQueuedTasks >= 0 && queue.length >= maxQueuedTasks && activeWorkerCount() >= maxWorkers) {
      metrics.rejectedQueueFullTasks += 1;
      return Promise.reject(createQueueFullError(maxQueuedTasks));
    }
    return new Promise((resolve, reject) => {
      const task = {
        id: ++nextTaskId,
        payload,
        resolve,
        reject,
        signal,
        onAbort: null,
        started: false,
        settled: false,
        cleaned: false,
        worker: null
      };
      task.onAbort = () => abortTask(task);
      if (signal && typeof signal.addEventListener === 'function') signal.addEventListener('abort', task.onAbort, { once: true });
      queue.push(task);
      metrics.enqueuedTasks += 1;
      metrics.maxQueueDepth = Math.max(metrics.maxQueueDepth, queue.length);
      drain();
    });
  }

  function close() {
    if (closePromise) return closePromise;
    closed = true;
    while (queue.length) rejectTask(queue.shift(), createAbortError('content worker pool closed'));
    const terminations = Array.from(terminatingWorkers.values());
    for (const worker of Array.from(workers)) {
      const task = worker.currentTask;
      worker.currentTask = null;
      if (task && !task.settled) rejectTask(task, createAbortError('content worker pool closed'));
      terminations.push(terminateWorkerTracked(worker));
    }
    workers.clear();
    idleWorkers.length = 0;
    closePromise = Promise.allSettled(Array.from(new Set(terminations))).then(results => ({
      closed:true,
      workersTerminated:results.length,
      terminationFailures:results.filter(result => result.status === 'rejected').length,
      pass:CONTENT_ENTRY_WORKER_POOL_PASS
    }));
    return closePromise;
  }

  function getStatus() {
    return {
      pass: CONTENT_ENTRY_WORKER_POOL_PASS,
      queueBudgetPass: CONTENT_WORKER_QUEUE_BUDGET_PASS,
      idleUnrefPass: CONTENT_WORKER_IDLE_UNREF_PASS,
      enabled: true,
      maxWorkers,
      maxQueuedTasks,
      workerScript,
      queuedTasks: queue.length,
      activeTasks: activeWorkerCount(),
      workers: workers.size,
      idleWorkers: idleWorkers.length,
      terminatingWorkers: terminatingWorkers.size,
      idleWorkerTtlMs,
      metrics: Object.assign({}, metrics)
    };
  }

  return { pass: CONTENT_ENTRY_WORKER_POOL_PASS, queueBudgetPass: CONTENT_WORKER_QUEUE_BUDGET_PASS, idleUnrefPass: CONTENT_WORKER_IDLE_UNREF_PASS, maxWorkers, maxQueuedTasks, runTask, close, getStatus };
}

module.exports = {
  CONTENT_ENTRY_WORKER_POOL_PASS,
  CONTENT_WORKER_QUEUE_BUDGET_PASS,
  CONTENT_WORKER_IDLE_UNREF_PASS,
  createAbortError,
  createQueueFullError,
  createContentEntryWorkerPool
};
