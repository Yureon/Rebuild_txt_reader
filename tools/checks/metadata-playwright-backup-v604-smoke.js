#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getMetadataProvider } = require('../../server/services/metadata-provider-registry');
const { createMetadataPlaywrightService } = require('../../server/services/metadata-playwright-service');

const PASS = 'v604-metadata-playwright-backup-smoke-pass';
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v604-playwright-state-'));
  try {
    const profilesDir = path.join(root, 'profiles');
    const statePath = path.join(profilesDir, 'profiles.json');
    const providerId = 'builtin-joara';
    fs.mkdirSync(path.join(profilesDir, providerId), { recursive:true });
    fs.writeFileSync(path.join(profilesDir, providerId, 'profile-marker'), '1');
    fs.writeFileSync(statePath, '{broken', { mode:0o600 });
    fs.writeFileSync(`${statePath}.bak`, JSON.stringify({ schemaVersion:1, providers:{ [providerId]:{ providerId, status:'ready', lastVerifiedAt:'2026-01-01T00:00:00.000Z' } } }), { mode:0o600 });
    const service = createMetadataPlaywrightService({
      profilesDir,
      statePath,
      providerResolver:getMetadataProvider,
    resolvePublicAddresses:async hostname => [{ address:'93.184.216.34', family:4, hostname }],
      enabled:false,
      logger:{error(){},warn(){}}
    });
    const description = service.describe(providerId);
    assert.strictEqual(description.configured, true);
    assert.strictEqual(description.status, 'ready');
    await service.flushState();
    assert.strictEqual(JSON.parse(fs.readFileSync(statePath, 'utf8')).providers[providerId].status, 'ready');
    assert.strictEqual(JSON.parse(fs.readFileSync(`${statePath}.bak`, 'utf8')).providers[providerId].status, 'ready');
    const posixModeBlocked = process.platform === 'win32';
    if (!posixModeBlocked) assert.strictEqual(fs.statSync(statePath).mode & 0o777, 0o600);
    await service.stop();
    if (posixModeBlocked) {
      console.log(JSON.stringify({ partialPass:PASS, blockedCapabilities:['posix-mode-bits'] }));
      process.exitCode = 77;
    } else {
      console.log(JSON.stringify({ pass:PASS }));
    }
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
