#!/usr/bin/env node
'use strict';
const { spawn, spawnSync } = require('child_process');

function parseArgs(argv) {
  const split = argv.indexOf('--');
  if (split < 0 || split === argv.length - 1) throw new Error('usage: process-tree-runner --cwd=... --timeout-ms=... -- command args...');
  const options = argv.slice(0, split);
  const command = argv[split + 1];
  const args = argv.slice(split + 2);
  const cwdArg = options.find(value => value.startsWith('--cwd='));
  const timeoutArg = options.find(value => value.startsWith('--timeout-ms='));
  const cwd = cwdArg ? cwdArg.slice('--cwd='.length) : process.cwd();
  const timeoutMs = timeoutArg ? Number(timeoutArg.slice('--timeout-ms='.length)) : 120000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('timeout must be positive');
  return { command, args, cwd, timeoutMs };
}

function killTree(child, signal = 'SIGTERM') {
  if (!child || !child.pid) return;
  if (process.platform === 'win32') {
    const args = ['/pid', String(child.pid), '/t'];
    if (signal === 'SIGKILL') args.push('/f');
    spawnSync('taskkill', args, { stdio:'ignore', windowsHide:true, timeout:5000 });
    return;
  }
  try { process.kill(-child.pid, signal); }
  catch { try { child.kill(signal); } catch {} }
}

function closeChildStreams(child) {
  for (const stream of [child && child.stdout, child && child.stderr, child && child.stdin]) {
    try { stream?.destroy(); } catch {}
  }
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function terminateTree(child) {
  killTree(child, 'SIGTERM');
  await delay(750);
  killTree(child, 'SIGKILL');
  closeChildStreams(child);
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const child = spawn(config.command, config.args, {
    cwd:config.cwd,
    env:process.env,
    stdio:['ignore', 'pipe', 'pipe'],
    windowsHide:true,
    detached:process.platform !== 'win32'
  });
  child.stdout.on('data', chunk => process.stdout.write(chunk));
  child.stderr.on('data', chunk => process.stderr.write(chunk));

  let externalSignal = '';
  const onSignal = signal => {
    externalSignal = signal;
    void terminateTree(child).finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  const exitResult = new Promise((resolve, reject) => {
    child.once('error', reject);
    // Use `exit`, not `close`: descendants can retain inherited pipe handles after
    // the direct child exits. Waiting for `close` would defeat the timeout bound.
    child.once('exit', (code, signal) => resolve({ type:'exit', code, signal }));
  });
  let timedOut = false;
  let timeoutCleanup = null;
  let timer = null;
  const timeoutResult = new Promise(resolve => {
    timer = setTimeout(() => {
      timedOut = true;
      process.stderr.write(`[process-tree-runner] timeout after ${config.timeoutMs}ms\n`);
      timeoutCleanup = terminateTree(child);
      resolve({ type:'timeout', code:124, signal:'SIGKILL' });
    }, config.timeoutMs);
  });

  const status = await Promise.race([exitResult, timeoutResult]);
  if (!timedOut && timer) clearTimeout(timer);
  process.removeListener('SIGINT', onSignal);
  process.removeListener('SIGTERM', onSignal);
  if (externalSignal) return;
  if (timedOut || status.type === 'timeout') {
    await timeoutCleanup;
    process.exit(124);
  }
  closeChildStreams(child);
  if (status.signal) process.exit(128);
  process.exit(Number.isInteger(status.code) ? status.code : 1);
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
