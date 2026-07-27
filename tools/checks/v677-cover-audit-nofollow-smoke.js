#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataCoverService } = require('../../server/services/metadata-cover-service');
const { createAuditLogService, TXT_READER_MULTI_AUDIT_LOG_NOFOLLOW_PASS } = require('../../server/services/audit-log-service');

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v677-nofollow-'));
  const coverDir = path.join(temp, 'covers');
  fs.mkdirSync(coverDir, { recursive:true });
  const cover = createMetadataCoverService({
    coverDir,
    transport:{ fetchProvider:async () => { throw new Error('not used'); } },
    pruneIntervalMs:60 * 60 * 1000,
    logger:{ warn(){}, error(){} }
  });
  try {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2dXQAAAAASUVORK5CYII=', 'base64');
    const id = crypto.createHash('sha256').update(png).digest('hex');
    const externalCover = path.join(temp, 'external.png');
    fs.writeFileSync(externalCover, png);
    const linkPath = path.join(coverDir, `${id}.png`);
    let symlinkSupported = true;
    try { fs.symlinkSync(externalCover, linkPath, 'file'); } catch (error) { if (['EPERM','EACCES','ENOTSUP'].includes(error.code)) symlinkSupported = false; else throw error; }
    if (symlinkSupported) {
      assert.equal(await cover.openAssetForRead(id), null, 'cover symlink must not be opened');
      fs.unlinkSync(linkPath);
    }
    fs.writeFileSync(linkPath, png);
    const opened = await cover.openAssetForRead(id);
    assert(opened && opened.pass === 'v677-metadata-cover-nofollow-read-pass');
    await opened.close();

    const auditPath = path.join(temp, 'audit.jsonl');
    const externalAudit = path.join(temp, 'outside-audit.txt');
    fs.writeFileSync(externalAudit, 'sentinel\n');
    if (symlinkSupported) {
      fs.symlinkSync(externalAudit, auditPath, 'file');
      const audit = createAuditLogService({ auditLogPath:auditPath, batchDelayMs:0, fsyncIntervalMs:0, logger:{ error(){} } });
      const queued = audit.appendEvent('test.symlink', { strictDurable:true });
      assert.equal(queued.noFollowPass, TXT_READER_MULTI_AUDIT_LOG_NOFOLLOW_PASS);
      const flushed = await audit.flush();
      assert.equal(flushed.ok, false, 'audit symlink write must fail closed');
      assert.equal(fs.readFileSync(externalAudit, 'utf8'), 'sentinel\n', 'audit symlink target was modified');
      await audit.stop().catch(() => {});
      fs.unlinkSync(auditPath);
    }

    console.log(JSON.stringify({ pass:'v677-cover-audit-nofollow-smoke-pass', symlinkSupported, coverRegularOpened:true, auditTargetUnchanged:true }));
  } finally {
    await cover.stop().catch(() => {});
    fs.rmSync(temp, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
