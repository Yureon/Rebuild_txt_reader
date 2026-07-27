#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSiteLanguageService, normalizeLanguageMap } = require('../../server/services/site-language-service');

async function run() {
  const unsafe = JSON.parse('{"__proto__":"pollute","constructor":"pollute","safe.key":"안전"}');
  const normalized = normalizeLanguageMap(unsafe);
  assert.strictEqual(Object.prototype.pollute, undefined);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(normalized, '__proto__'), false);
  assert.strictEqual(normalized['safe.key'], '안전');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v603-language-async-'));
  try {
    const service = createSiteLanguageService({ siteLanguagesDir:path.join(root, 'custom'), bundledSiteLanguagesDir:path.join(root, 'bundle'), logger:{ warn() {} } });
    const syncMethods = ['readFileSync','writeFileSync','readdirSync','unlinkSync','renameSync'];
    const originals = Object.fromEntries(syncMethods.map(name => [name, fs[name]]));
    for (const name of syncMethods) fs[name] = () => { throw new Error(`sync I/O used by async language path: ${name}`); };
    try {
      const saved = await service.saveLanguageAsync({ id:'ko-custom', name:'사용자 언어', map:{ 'menu.library':'서재' } });
      assert.strictEqual(saved.language.id, 'ko-custom');
      assert.strictEqual((await service.listPublicLanguagesAsync()).length, 1);
      assert.strictEqual((await service.getLanguageAsync('ko-custom')).map['menu.library'], '서재');
      await service.deleteLanguageAsync('ko-custom');
      assert.strictEqual((await service.listPublicLanguagesAsync()).length, 0);
    } finally {
      for (const [name, fn] of Object.entries(originals)) fs[name] = fn;
    }
    console.log(JSON.stringify({ pass:'v603-site-language-async-security-smoke-pass' }));
  } finally {
    await fs.promises.rm(root, { recursive:true, force:true });
  }
}
run().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
