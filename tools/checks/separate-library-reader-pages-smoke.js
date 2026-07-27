#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');
const root = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const libraryHtml = read('public/library.html');
const libraryEntry = read('public/scripts/rebuild/library-page.mjs');
const navigation = read('public/scripts/rebuild/features/library-navigation-actions.mjs');
const main = read('public/scripts/rebuild/main.mjs');
const css = read('public/styles/app.css');
const auth = read('server/routes/auth-routes.js');
const middleware = read('server/middleware/auth.js');
const manifest = JSON.parse(read('public/manifest.json'));
assert.ok(libraryHtml.includes('data-client-profile="library"'));
assert.ok(libraryHtml.includes('scripts/rebuild/library-page.mjs'));
assert.ok(libraryEntry.includes("boot({ profile:'library' })"));
assert.ok(navigation.includes('buildReaderPageUrl'));
assert.ok(navigation.includes("app?.profile !== 'library'"));
assert.ok(navigation.includes("'/mobile.html' : '/site.html'"));
assert.ok(main.includes("if (profile === 'library')"));
assert.ok(main.includes('readReaderTargetFromLocation'));
assert.ok(main.includes('openReaderTarget'));
assert.ok(css.includes('body[data-client-profile="library"] .main'));
assert.ok(css.includes('body[data-client-profile="site"] .sidebar'));
assert.ok(auth.includes('redirectTo = `/library-${BUILD_ID}.html`'));
assert.ok(middleware.includes("'/library.html'"));
assert.strictEqual(manifest.start_url, '/library.html');

async function verifyRuntimeNavigation() {
  const moduleUrl = pathToFileURL(path.join(root, 'public/scripts/rebuild/features/library-navigation-actions.mjs')).href;
  const runtime = await import(`${moduleUrl}?smoke=${Date.now()}`);
  const assigned = [];
  const fakeWindow = {
    location:{ origin:'https://reader.example.test', assign:value => assigned.push(String(value)) },
    localStorage:{ getItem:key => key === 'txt-reader.rebuild.preferredEntry' ? 'site' : '' },
    matchMedia:() => ({ matches:false })
  };
  assert.equal(runtime.buildReaderPageUrl('novel id', 'episode id', { windowObject:fakeWindow }), '/site.html?novelId=novel+id&from=library&episodeId=episode+id');
  const app = { profile:'library', state:{ novelById:new Map([['novel-1', { id:'novel-1', title:'작품' }]]) } };
  const previousWindow = globalThis.window;
  globalThis.window = fakeWindow;
  const opened = runtime.openNovelFromElementRuntime(app, { dataset:{ novelId:'novel-1' } }, { windowObject:fakeWindow });
  assert.equal(opened?.navigated, true);
  assert.equal(opened?.href, '/site.html?novelId=novel-1&from=library');
  assert.deepEqual(assigned, ['/site.html?novelId=novel-1&from=library']);
  globalThis.window = previousWindow;

  fakeWindow.localStorage.getItem = () => '';
  fakeWindow.matchMedia = query => ({ matches:query.includes('max-width') });
  assert.equal(runtime.buildReaderPageUrl('mobile', '', { windowObject:fakeWindow }), '/mobile.html?novelId=mobile&from=library');
}

verifyRuntimeNavigation()
  .then(() => console.log('v574-separate-library-reader-pages-smoke-pass'))
  .catch(error => { console.error(error?.stack || error); process.exitCode = 1; });
