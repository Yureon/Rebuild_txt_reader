#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const { createSiteLanguageService, SITE_LANGUAGE_BUNDLE_FALLBACK_PASS } = require('../../server/services/site-language-service');

const PASS = 'v564-site-language-bundle-fallback-smoke-pass';

function writePack(dir, id, name, map) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({ id, name, map }, null, 2), 'utf8');
}

function runSiteLanguageBundleFallbackSmoke() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-site-lang-'));
  const dataDir = path.join(root, 'data');
  const bundleDir = path.join(root, 'bundle');

  writePack(bundleDir, 'es', 'Español', { 설정: 'Ajustes' });
  writePack(bundleDir, 'ja', '日本語 bundled', { 설정: '設定' });
  writePack(dataDir, 'ja', '日本語 custom', { 설정: '個人設定' });

  const service = createSiteLanguageService({
    siteLanguagesDir: dataDir,
    bundledSiteLanguagesDir: bundleDir,
    logger: { warn() {} }
  });

  const languages = service.listPublicLanguages();
  const es = languages.find(lang => lang.id === 'es');
  const ja = languages.find(lang => lang.id === 'ja');
  assert.ok(es, 'bundled language must be listed for public clients');
  assert.strictEqual(es.source, 'bundle', 'bundled language source must be exposed');
  assert.strictEqual(es.bundled, true, 'bundled language marker must be true');
  assert.ok(ja, 'storage override language must be listed');
  assert.strictEqual(ja.name, '日本語 custom', 'storage language must override bundled language with same id');
  assert.strictEqual(ja.source, 'storage', 'storage override source must be exposed');

  const fetchedBundle = service.getLanguage('site:es');
  assert.strictEqual(fetchedBundle.id, 'es', 'getLanguage must resolve bundled site: id');

  let deleteError = null;
  service.deleteLanguage('es', err => { deleteError = err; });
  assert.strictEqual(deleteError && deleteError.statusCode, 403, 'bundled language delete must be read-only');
  assert.strictEqual(SITE_LANGUAGE_BUNDLE_FALLBACK_PASS, 'v564-site-language-bundle-fallback-pass', 'bundle fallback marker mismatch');

  fs.rmSync(root, { recursive: true, force: true });
  return { pass: PASS, languages: languages.length };
}

if (require.main === module) console.log(JSON.stringify(runSiteLanguageBundleFallbackSmoke()));
module.exports = { runSiteLanguageBundleFallbackSmoke };
