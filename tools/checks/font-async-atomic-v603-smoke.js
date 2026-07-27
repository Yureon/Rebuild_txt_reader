#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFontService } = require('../../server/services/font-service');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v603-font-async-'));
  try {
    const service = createFontService({
      fontDir:path.join(root, 'fonts'),
      fontMetaPath:path.join(root, 'font-library.json'),
      legacyFontDir:path.join(root, 'legacy-fonts'),
      legacyFontMetaPath:path.join(root, 'legacy-font-library.json'),
      userDataDir:path.join(root, 'user-data'),
      now:(() => { let value = 1000; return () => ++value; })()
    });
    const syncMethods = ['readFileSync','writeFileSync','statSync','unlinkSync','renameSync'];
    const originals = Object.fromEntries(syncMethods.map(name => [name, fs[name]]));
    for (const name of syncMethods) fs[name] = () => { throw new Error(`sync I/O used by async font path: ${name}`); };
    try {
      const scope = { ownerId:'reader-1' };
      const body = Buffer.concat([Buffer.from('wOFF'), Buffer.alloc(32)]);
      const results = await Promise.allSettled([
        service.uploadFontAsync({ rawFilename:'sample.woff', rawFamily:'Sample Family', bodyBuffer:body, scope }),
        service.uploadFontAsync({ rawFilename:'sample2.woff', rawFamily:'Sample Family', bodyBuffer:body, scope })
      ]);
      assert.strictEqual(results.filter(item => item.status === 'fulfilled').length, 1, 'same-family concurrent upload must serialize');
      assert.strictEqual(results.filter(item => item.status === 'rejected' && item.reason && item.reason.status === 409).length, 1);
      const list = await service.getFontListResponseAsync(scope);
      assert.strictEqual(list.items.length, 1);
      const file = await service.getFontFileForResponseAsync(list.items[0].filename, scope);
      assert(file.filePath.endsWith(list.items[0].filename));
      await service.deleteFontAsync(list.items[0].filename, scope);
      assert.strictEqual((await service.getFontListResponseAsync(scope)).items.length, 0);
    } finally {
      for (const [name, fn] of Object.entries(originals)) fs[name] = fn;
    }
    console.log(JSON.stringify({ pass:'v603-font-async-atomic-smoke-pass' }));
  } finally {
    await fs.promises.rm(root, { recursive:true, force:true });
  }
}
run().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
