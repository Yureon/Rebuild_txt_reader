#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { createMetadataQueueService } = require('../../server/services/metadata-queue-service');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');
const { createFontService } = require('../../server/services/font-service');
const { createSiteLanguageService } = require('../../server/services/site-language-service');

const PASS = 'v604-service-backup-recovery-smoke-pass';
function corruptWithBackup(file, backupValue) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, '{corrupt', { mode:0o600 });
  fs.writeFileSync(`${file}.bak`, JSON.stringify(backupValue, null, 2), { mode:0o600 });
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v604-service-recovery-'));
  try {
    const queuePath = path.join(root, 'queue.json');
    const queuedJob = { id:'mq_backup', key:'backup-key', type:'collect', status:'cancelled', createdAt:'2026-01-01T00:00:00.000Z', updatedAt:'2026-01-01T00:00:00.000Z' };
    corruptWithBackup(queuePath, { schemaVersion:1, jobs:[queuedJob] });
    const queue = createMetadataQueueService({ storePath:queuePath, handler:async()=>({ok:true}) });
    assert.strictEqual(queue.get(queuedJob.id).status, 'cancelled');
    queue.update(queue.get(queuedJob.id), { message:'recovered' });
    await queue.flush();
    assert.strictEqual(JSON.parse(fs.readFileSync(queuePath, 'utf8')).jobs[0].message, 'recovered');
    assert.strictEqual(JSON.parse(fs.readFileSync(`${queuePath}.bak`, 'utf8')).jobs[0].id, queuedJob.id);
    await queue.stop();

    const stableQueuePath = path.join(root, 'stable-queue.json');
    fs.writeFileSync(stableQueuePath, JSON.stringify({ schemaVersion:1, jobs:[{ ...queuedJob, id:'mq_stable', key:'stable-key', dedupeKey:'stable-key' }] }));
    let stableStartupWrites = 0;
    const stableQueue = createMetadataQueueService({
      storePath:stableQueuePath,
      handler:async()=>({ok:true}),
      writeJsonSync() { stableStartupWrites += 1; },
      async writeJsonAsync() { stableStartupWrites += 1; }
    });
    assert.strictEqual(stableStartupWrites, 0, 'unchanged metadata queue must not rewrite the full state file during startup');
    await stableQueue.stop();
    assert.strictEqual(stableStartupWrites, 0);

    const storePath = path.join(root, 'metadata-store.json');
    const compressedStorePath = `${storePath}.gz`;
    fs.writeFileSync(compressedStorePath, Buffer.from('corrupt-gzip'), { mode:0o600 });
    fs.writeFileSync(`${compressedStorePath}.bak`, zlib.gzipSync(Buffer.from(JSON.stringify({
      schemaVersion:1,
      revision:4,
      settings:{ providers:{ 'builtin-joara':{ enabled:false, priority:5, autoApply:false } } },
      candidates:{},
      applied:{}
    }))), { mode:0o600 });
    const store = createMetadataStoreService({ storePath });
    assert.deepStrictEqual(store.getProviderSettings('builtin-joara'), { enabled:false, priority:5, autoApply:false, autoApplyThreshold:null, requestIntervalMs:null, searchLimit:null, pass:'v643-metadata-provider-settings-pass' });
    store.setProviderSettings('builtin-joara', { enabled:true });
    await store.flush();
    assert.strictEqual(JSON.parse(zlib.gunzipSync(fs.readFileSync(compressedStorePath)).toString('utf8')).settings.providers['builtin-joara'].enabled, true);
    assert.strictEqual(JSON.parse(zlib.gunzipSync(fs.readFileSync(`${compressedStorePath}.bak`)).toString('utf8')).settings.providers['builtin-joara'].enabled, false);
    await store.close();

    const fontDir = path.join(root, 'fonts');
    const fontMetaPath = path.join(root, 'font-library.json');
    fs.mkdirSync(fontDir, { recursive:true });
    fs.writeFileSync(path.join(fontDir, 'recovered.woff'), Buffer.concat([Buffer.from('wOFF'), Buffer.alloc(20)]));
    corruptWithBackup(fontMetaPath, [{ filename:'recovered.woff', family:'Recovered', size:24, createdAt:'2026-01-01T00:00:00.000Z' }]);
    const fontService = createFontService({ fontDir, fontMetaPath, legacyFontDir:path.join(root, 'legacy-fonts'), legacyFontMetaPath:path.join(root, 'legacy-fonts.json') });
    const fonts = await fontService.getFontListResponseAsync({ ownerId:'__owner__' });
    assert.strictEqual(fonts.items.length, 1);
    assert.strictEqual(fonts.items[0].family, 'Recovered');

    const languageDir = path.join(root, 'languages');
    const languageFile = path.join(languageDir, 'ko-recovered.json');
    corruptWithBackup(languageFile, {
      id:'ko-recovered', name:'복구 언어', enabled:true, map:{ 'menu.library':'복구 서재' }, createdAt:'2026-01-01T00:00:00.000Z', updatedAt:'2026-01-01T00:00:00.000Z'
    });
    const languageService = createSiteLanguageService({ siteLanguagesDir:languageDir, bundledSiteLanguagesDir:path.join(root, 'bundled'), logger:{warn(){}} });
    assert.strictEqual((await languageService.getLanguageAsync('ko-recovered')).map['menu.library'], '복구 서재');
    await languageService.saveLanguageAsync({ id:'ko-recovered', name:'복구 언어 2', map:{ 'menu.library':'저장된 서재' } });
    assert.strictEqual(JSON.parse(fs.readFileSync(languageFile, 'utf8')).map['menu.library'], '저장된 서재');
    assert.strictEqual(JSON.parse(fs.readFileSync(`${languageFile}.bak`, 'utf8')).map['menu.library'], '복구 서재');
    await languageService.deleteLanguageAsync('ko-recovered');
    assert.strictEqual(fs.existsSync(languageFile), false);
    assert.strictEqual(fs.existsSync(`${languageFile}.bak`), false);

    console.log(JSON.stringify({ pass:PASS }));
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
