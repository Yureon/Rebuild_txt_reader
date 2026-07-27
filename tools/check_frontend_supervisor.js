#!/usr/bin/env node
const path = require('path');
const childProcess = require('child_process');
const timers = require('timers');

const FRONTEND_CHECK_SUPERVISOR_CLEAN_EXIT_PASS = 'v258-frontend-check-supervisor-clean-exit-pass';

function run() {
  const projectRoot = path.join(__dirname, '..');
  const timeoutMs = Math.max(5000, Number(process.env.FRONTEND_CHECK_SUPERVISOR_TIMEOUT_MS) || 60000);
  const child = childProcess.spawn(process.execPath, [path.join(__dirname, 'check_rebuild_frontend.js'), ...process.argv.slice(2).filter(arg => arg !== '--quiet-ok')], {
    cwd: projectRoot,
    env: { ...process.env, FRONTEND_CHECK_WORKER:'1', FRONTEND_CHECK_NO_FORCE_EXIT:'1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  let output = '';
  let errorOutput = '';
  let settled = false;
  let sawOk = false;
  let killRequested = false;
  const finish = (code) => {
    if (settled) return;
    settled = true;
    timers.clearTimeout(timer);
    process.exit(code);
  };
  const maybeDone = () => {
    if (sawOk || !output.includes('Rebuild frontend module manifest OK')) return;
    sawOk = true;
    const line = output.split(/\r?\n/).find(item => item.includes('Rebuild frontend module manifest OK')) || 'Rebuild frontend module manifest OK';
    try { if (!killRequested) { killRequested = true; child.kill('SIGKILL'); } } catch (_error) {}
    process.stdout.write(line + '\n');
    finish(0);
  };
  child.stdout.on('data', chunk => { output += String(chunk || ''); maybeDone(); });
  child.stderr.on('data', chunk => { errorOutput += String(chunk || ''); if (process.env.FRONTEND_CHECK_TRACE === '1') process.stderr.write(chunk); });
  child.on('error', error => { console.error(error && error.stack || error); finish(1); });
  child.on('close', code => {
    if (settled) return;
    if (sawOk || output.includes('Rebuild frontend module manifest OK')) return finish(0);
    if (output) process.stdout.write(output);
    if (errorOutput) process.stderr.write(errorOutput);
    finish(Number(code) || 1);
  });
  const timer = timers.setTimeout(() => {
    if (output) process.stdout.write(output);
    if (errorOutput) process.stderr.write(errorOutput);
    console.error('Frontend check supervisor timeout after ' + timeoutMs + 'ms');
    if (!killRequested) { try { child.kill('SIGKILL'); } catch (_error) {} }
    finish(1);
  }, timeoutMs);
}

if (require.main === module) run();

module.exports = { FRONTEND_CHECK_SUPERVISOR_CLEAN_EXIT_PASS, run };
