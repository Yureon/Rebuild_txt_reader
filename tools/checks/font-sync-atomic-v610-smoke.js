#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFontService } = require('../../server/services/font-service');

const ttfProbe = Buffer.from([0x00, 0x01, 0x00, 0x00, 0x01]);

function makeService(root, metaPath) {
  return createFontService({
    fontDir:path.join(root, 'fonts'),
    fontMetaPath:metaPath,
    legacyFontDir:path.join(root, 'legacy-fonts'),
    legacyFontMetaPath:path.join(root, 'legacy-font-library.json'),
    userDataDir:path.join(root, 'users'),
    logger:{ warn() {}, error() {} }
  });
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-font-sync-'));
try {
  const brokenRoot = path.join(root, 'broken-upload');
  const brokenMeta = path.join(brokenRoot, 'font-library.json');
  fs.mkdirSync(brokenMeta, { recursive:true });
  const brokenService = makeService(brokenRoot, brokenMeta);
  assert.throws(() => brokenService.uploadFont({ rawFilename:'probe.ttf', rawFamily:'Probe', bodyBuffer:ttfProbe }));
  assert.deepStrictEqual(fs.readdirSync(path.join(brokenRoot, 'fonts')), [], 'failed sync upload left an orphan file');

  const deleteRoot = path.join(root, 'delete-rollback');
  const deleteMeta = path.join(deleteRoot, 'font-library.json');
  const deleteService = makeService(deleteRoot, deleteMeta);
  const uploaded = deleteService.uploadFont({ rawFilename:'probe.ttf', rawFamily:'Probe', bodyBuffer:ttfProbe });
  const fontPath = path.join(deleteRoot, 'fonts', uploaded.filename);
  fs.renameSync(deleteMeta, `${deleteMeta}.saved`);
  fs.mkdirSync(deleteMeta);
  assert.throws(() => deleteService.deleteFont(uploaded.filename));
  assert.ok(fs.existsSync(fontPath), 'failed sync delete did not restore the staged font');

  console.log(JSON.stringify({ pass:'v610-font-sync-atomic-pass' }));
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
