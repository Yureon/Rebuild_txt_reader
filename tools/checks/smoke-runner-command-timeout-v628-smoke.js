#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { commandTimeoutMs, classifyBlockedDependency, runCommand } = require('../run_smoke_tests');

function run() {
  const previous = process.env.SMOKE_COMMAND_TIMEOUT_MS;
  try {
    process.env.SMOKE_COMMAND_TIMEOUT_MS = '10';
    assert.equal(commandTimeoutMs(), 1000, 'configured timeout must have a safe one-second floor');
    const startedAt = Date.now();
    const result = runCommand({
      command:process.execPath,
      args:['-e', 'setTimeout(() => {}, 5000)'],
      label:'v628 intentional timeout fixture'
    }, 1, 1);
    assert.equal(result.ok, false);
    assert.equal(result.timedOut, true, 'timed-out commands must be reported explicitly');
    assert.ok(Date.now() - startedAt < 4000, 'runner must terminate the hung child promptly');
    const blocked = runCommand({
      command:process.execPath,
      args:['-e', "console.log(JSON.stringify({ blocked:'v628 capability fixture', reason:'not available' })); process.exit(77)"],
      label:'v628 explicit capability block fixture'
    }, 1, 1);
    assert.equal(blocked.blocked, true, 'status 77 with a blocked payload must remain an environment block');
    assert.equal(classifyBlockedDependency('ordinary failure').blocked, false);
    assert.deepEqual(
      classifyBlockedDependency("browserType.launch: executable doesn't exist"),
      { blocked:true, dependency:'playwright-browser' },
      'playwright-chromium must classify a missing browser binary as an environment block'
    );
    process.env.SMOKE_COMMAND_TIMEOUT_MS = String(60 * 60 * 1000);
    assert.equal(commandTimeoutMs(), 15 * 60 * 1000, 'configured timeout must have a fifteen-minute ceiling');
  } finally {
    if (previous === undefined) delete process.env.SMOKE_COMMAND_TIMEOUT_MS;
    else process.env.SMOKE_COMMAND_TIMEOUT_MS = previous;
  }
  console.log(JSON.stringify({ pass:'v628-smoke-runner-command-timeout-pass' }));
}

run();
