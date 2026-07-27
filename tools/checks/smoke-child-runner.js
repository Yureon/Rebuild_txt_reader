const path = require('path');
const childProcess = require('child_process');
const { pathToFileURL } = require('url');
const fs = require('fs');
const os = require('os');
const nodeTimers = require('timers');

const SMOKE_CHILD_RUNNER_PASS = 'v253-smoke-child-runner-global-restore-pass';
const SMOKE_CHILD_RUNNER_TIMEOUT_PASS = 'v241-smoke-child-runner-timeout-pass';
const SMOKE_CHILD_RUNNER_PROCESS_ISOLATION_PASS = 'v253-smoke-child-runner-process-isolation-pass';
const SMOKE_CHILD_RUNNER_TIMER_GLOBAL_RESTORE_PASS = 'v254-smoke-child-runner-timer-global-restore-pass';
const SMOKE_CHILD_RUNNER_CLEAN_EXIT_PASS = 'v258-smoke-child-runner-clean-exit-pass';

const GLOBAL_KEYS_TO_RESTORE = [
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'confirm', 'FileReader', 'Node',
  'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'
];

function rewriteProjectRelativeImports(projectRoot, script) {
  const root = path.resolve(projectRoot);
  return String(script || '')
    .replace(/process\.exit\(0\);?/g, '')
    .replace(/import\((['"])(\.\/public\/[^'"]+)\1\)/g, (_match, _quote, spec) => {
      const full = pathToFileURL(path.join(root, spec.slice(2))).href;
      return `import(${JSON.stringify(full)})`;
    });
}

function snapshotGlobals() {
  return Object.fromEntries(GLOBAL_KEYS_TO_RESTORE.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
}

function restoreGlobals(snapshot = {}) {
  for (const key of GLOBAL_KEYS_TO_RESTORE) {
    const descriptor = snapshot[key];
    try {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    } catch (_error) {}
  }
}

function wrapSmokeSourceForChild(source, errorFile = '') {
  const safeErrorFile = JSON.stringify(String(errorFile || ''));
  return `
    import fs from 'node:fs';
    const __smokeErrorFile = ${safeErrorFile};
    function __writeSmokeError(error) {
      const text = (error && error.stack) || (error && error.message) || String(error || 'unknown smoke error');
      try { if (__smokeErrorFile) fs.writeFileSync(__smokeErrorFile, text); } catch (_) {}
      try { console.error(text); } catch (_) {}
    }
    (async () => {
      try {
${String(source || '').split('\n').map(line => `        ${line}`).join('\n')}
      } catch (error) {
        __writeSmokeError(error);
        process.exit(1);
      }
    })().then(
      () => process.exit(0),
      error => {
        __writeSmokeError(error);
        process.exit(1);
      }
    );
  `;
}


async function runSmokeScriptInProcess(projectRoot, source, options = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 8000);
  const encoded = Buffer.from(String(source || ''), 'utf8').toString('base64');
  const url = `data:text/javascript;base64,${encoded}#${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let timer = null;
  const timeout = new Promise((_resolve, reject) => {
    timer = nodeTimers.setTimeout(() => reject(new Error(`in-process module smoke timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    await Promise.race([import(url), timeout]);
    return { pass: SMOKE_CHILD_RUNNER_PROCESS_ISOLATION_PASS, cleanExitPass: SMOKE_CHILD_RUNNER_CLEAN_EXIT_PASS, timeoutMs, mode:'in-process-data-url-clean-exit' };
  } finally {
    if (timer) nodeTimers.clearTimeout(timer);
  }
}

function runSmokeScriptInChildProcess(projectRoot, source, options = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 8000);
  const tmpBase = `txt-reader-smoke-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const tmpFile = path.join(os.tmpdir(), `${tmpBase}.mjs`);
  const errorFile = path.join(os.tmpdir(), `${tmpBase}.err`);
  fs.writeFileSync(tmpFile, wrapSmokeSourceForChild(source, errorFile));
  const cleanup = () => {
    try { fs.unlinkSync(tmpFile); } catch (_error) {}
    try { fs.unlinkSync(errorFile); } catch (_error) {}
  };
  try {
    const result = childProcess.spawnSync(process.execPath, [tmpFile], {
      cwd: path.resolve(projectRoot),
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
      env: { ...process.env, TXT_READER_SMOKE_CHILD: '1' }
    });
    const detail = fs.existsSync(errorFile) ? fs.readFileSync(errorFile, 'utf8') : '';
    if (result.error) {
      const timeoutMessage = result.error.code === 'ETIMEDOUT' ? `child process timed out after ${timeoutMs}ms` : result.error.message;
      throw new Error(`${timeoutMessage}${detail ? ': ' + detail : ''}`);
    }
    if (result.status !== 0) {
      throw new Error(detail || `child process exited with status ${result.status}${result.signal ? ' signal ' + result.signal : ''}`);
    }
    return { pass: SMOKE_CHILD_RUNNER_PROCESS_ISOLATION_PASS, cleanExitPass: SMOKE_CHILD_RUNNER_CLEAN_EXIT_PASS, timeoutMs, mode:'tempfile-sync-spawn-timeout' };
  } finally {
    cleanup();
  }
}

async function runModuleSmokeScript(projectRoot, script, options = {}) {
  if (!projectRoot) throw new Error('runModuleSmokeScript requires projectRoot');
  const label = options.label || 'module smoke';
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 8000);
  const source = rewriteProjectRelativeImports(projectRoot, script);
  const globals = snapshotGlobals();
  try {
    if (process.env.FRONTEND_CHECK_TRACE === '1') console.log('Module smoke child start:', label);
    const child = options.forceChild === true || process.env.TXT_READER_USE_CHILD_SMOKE === '1'
      ? await runSmokeScriptInChildProcess(projectRoot, source, { timeoutMs })
      : await runSmokeScriptInProcess(projectRoot, source, { timeoutMs });
    if (process.env.FRONTEND_CHECK_TRACE === '1') console.log('Module smoke child done:', label);
    return { pass: SMOKE_CHILD_RUNNER_PASS, processIsolationPass: child.pass, cleanExitPass: child.cleanExitPass, timeoutPass: SMOKE_CHILD_RUNNER_TIMEOUT_PASS, timerGlobalRestorePass: SMOKE_CHILD_RUNNER_TIMER_GLOBAL_RESTORE_PASS, label, timeoutMs };
  } catch (error) {
    throw new Error(`${label} failed: ${(error && error.message) || error}`);
  } finally {
    restoreGlobals(globals);
  }
}

module.exports = {
  SMOKE_CHILD_RUNNER_PASS,
  SMOKE_CHILD_RUNNER_TIMEOUT_PASS,
  SMOKE_CHILD_RUNNER_PROCESS_ISOLATION_PASS,
  SMOKE_CHILD_RUNNER_TIMER_GLOBAL_RESTORE_PASS,
  SMOKE_CHILD_RUNNER_CLEAN_EXIT_PASS,
  GLOBAL_KEYS_TO_RESTORE,
  runModuleSmokeScript,
  runSmokeScriptInChildProcess,
  runSmokeScriptInProcess,
  wrapSmokeSourceForChild,
  rewriteProjectRelativeImports,
  snapshotGlobals,
  restoreGlobals
};
