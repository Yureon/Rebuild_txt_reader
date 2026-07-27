#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { URL } = require('url');
const { CURRENT_REBUILD_VERSION_NUMBER, CURRENT_REBUILD_VERSION } = require('./checks/current-rebuild-version');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.SMOKE_PORT || 33000 + Math.floor(Math.random() * 1000));
const BASE = 'http://127.0.0.1:' + PORT;
const OWNER_LOGIN_ID = 'smoke-owner';
const OWNER_LOGIN_PW = 'smoke-owner-pass';
const READER_LOGIN_ID = ('smoke-reader-' + process.pid).slice(0, 31);
const READER_LOGIN_PW = 'reader-pass';
const SCOPED_READER_LOGIN_ID = ('smoke-scope-' + process.pid).slice(0, 31);
const TEST_LIBRARY_PATH = path.join(ROOT, 'test_novels');
const FILEOPS_PREFIX = '__smoke_fileops_' + process.pid + '_' + Date.now();
const FILEOPS_ROOT = path.join(TEST_LIBRARY_PATH, FILEOPS_PREFIX);

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function request(url, options) {
  options = options || {};
  const parsed = new URL(url);
  const body = options.body == null
    ? null
    : Buffer.isBuffer(options.body)
      ? options.body
      : Buffer.from(String(options.body));
  const headers = Object.assign({}, options.headers || {});
  if (body && headers['content-length'] == null && headers['Content-Length'] == null) {
    headers['content-length'] = String(body.length);
  }

  return new Promise(function(resolve, reject) {
    const req = http.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: headers
    }, function(res) {
      const chunks = [];
      res.on('data', function(chunk) { chunks.push(chunk); });
      res.on('end', function() {
        const buffer = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          headers: res.headers,
          text: buffer.toString('utf8'),
          body: buffer
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(Number(options.timeoutMs) || 8000, function() {
      req.destroy(new Error('request timeout'));
    });
    if (body) req.write(body);
    req.end();
  });
}

function writeTextFixture(relPath, text) {
  const filePath = path.join(FILEOPS_ROOT, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
}

function cleanupFileopsFixtures() {
  try {
    if (fs.existsSync(FILEOPS_ROOT)) fs.rmSync(FILEOPS_ROOT, { recursive: true, force: true });
  } catch (error) {}
}

function createFileopsFixtures() {
  cleanupFileopsFixtures();
  fs.mkdirSync(FILEOPS_ROOT, { recursive: true });
  writeTextFixture('single.txt', 'fileops single fixture\n');
  writeTextFixture('chunked.txt', 'A'.repeat(50020) + '\n' + 'B'.repeat(2000) + '\n');
  writeTextFixture('rename_single.txt', 'fileops rename single fixture\n');
  writeTextFixture('delete_single.txt', 'fileops delete single fixture\n');
  writeTextFixture('rename_series/001.txt', 'fileops rename series one\n');
  writeTextFixture('rename_series/002.txt', 'fileops rename series two\n');
  writeTextFixture('delete_series/001.txt', 'fileops delete series one\n');
  writeTextFixture('delete_series/002.txt', 'fileops delete series two\n');
  writeTextFixture('series/001.txt', 'fileops episode one\n');
  writeTextFixture('series/002.txt', 'fileops episode two\n');
  writeTextFixture('episode_move/001.txt', 'fileops move one\n');
  writeTextFixture('episode_move/002.txt', 'fileops move two\n');
  writeTextFixture('folder_rename/note.txt', 'fileops folder rename fixture\n');
  writeTextFixture('folder_move/note.txt', 'fileops folder move fixture\n');
  writeTextFixture('folder_guard/child/note.txt', 'fileops folder guard fixture\n');
}


async function waitForServer(child, timeoutMs) {
  timeoutMs = timeoutMs || 8000;
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode != null) throw new Error('server exited early with code ' + child.exitCode);
    try {
      const res = await request(BASE + '/login.html', { method: 'GET', timeoutMs: 1500 });
      if (res.status >= 200 && res.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(120);
  }
  const message = lastError && lastError.message ? lastError.message : 'timeout';
  throw new Error('server did not become ready: ' + message);
}

function cookieFromLogin(res) {
  const setCookieHeader = res.headers['set-cookie'];
  const setCookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : (setCookieHeader || '');
  const cookie = String(setCookie).split(';')[0];
  if (!/^session_token=/.test(cookie)) throw new Error('login did not return session_token cookie');
  return cookie;
}

function parseJsonBody(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return text; }
}

function roundTimingMs(ms) {
  return Math.round(Number(ms) * 1000) / 1000;
}

async function timedJsonFetch(label, url, options) {
  const started = process.hrtime.bigint();
  const result = await jsonFetch(url, options);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(Number.isFinite(elapsedMs) && elapsedMs >= 0, label + ' elapsed time must be finite');
  return Object.assign({ elapsedMs: elapsedMs }, result);
}

function compareColdWarmTiming(label, coldMs, warmMs) {
  assert.ok(Number.isFinite(coldMs) && coldMs >= 0, label + ' cold timing must be finite');
  assert.ok(Number.isFinite(warmMs) && warmMs >= 0, label + ' warm timing must be finite');
  const maxWarmMs = Math.max(250, coldMs * 30 + 50);
  assert.ok(warmMs <= maxWarmMs, label + ' warm request is unexpectedly slow: cold=' + coldMs + 'ms warm=' + warmMs + 'ms');
  return {
    coldMs: roundTimingMs(coldMs),
    warmMs: roundTimingMs(warmMs),
    ratio: coldMs > 0 ? roundTimingMs(warmMs / coldMs) : null
  };
}

async function jsonFetch(url, options) {
  options = options || {};
  const res = await request(url, options);
  const body = parseJsonBody(res.text);
  if (!res.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error((options.method || 'GET') + ' ' + url + ' failed ' + res.status + ': ' + detail);
  }
  return { res: res, body: body };
}

async function rawFetch(url, options) {
  options = options || {};
  const res = await request(url, options);
  if (!res.ok) throw new Error((options.method || 'GET') + ' ' + url + ' failed ' + res.status + ': ' + res.body.toString('utf8'));
  return { res: res, body: res.body };
}

async function loadNovels(cookie) {
  const novels = await jsonFetch(BASE + '/api/novels', { headers: { cookie: cookie } });
  assert.ok(Array.isArray(novels.body), 'novels array');
  return novels.body;
}

function findNovelByTitle(novels, title, categoryPath) {
  return (Array.isArray(novels) ? novels : []).find(function(novel) {
    return novel && novel.title === title && (!categoryPath || novel.categoryPath === categoryPath);
  });
}

function findEpisodeByTitle(novel, title) {
  const episodes = novel && Array.isArray(novel.episodes) ? novel.episodes : [];
  return episodes.find(function(episode) { return episode && episode.title === title; });
}

async function waitForCatalogNovel(cookie, predicate, label, timeoutMs) {
  const deadline = Date.now() + (Number(timeoutMs) || 5000);
  let novels = [];
  while (Date.now() < deadline) {
    novels = await loadNovels(cookie);
    const novel = novels.find(predicate);
    if (novel) return { novels: novels, novel: novel };
    await sleep(50);
  }
  assert.fail(label + ' did not appear after the asynchronous catalog refresh');
}

async function runFileopsSmoke(readerCookie, ownerAuthJsonHeaders) {
  const rootCategory = FILEOPS_PREFIX;
  const fileopsHeaders = function(action) {
    return Object.assign({}, ownerAuthJsonHeaders, { 'x-confirm-action': action });
  };
  const renameHeaders = fileopsHeaders('fileops-rename');
  const moveHeaders = fileopsHeaders('fileops-move');
  const deleteHeaders = fileopsHeaders('fileops-delete');
  const deleteBody = function(extra) {
    return JSON.stringify(Object.assign({ confirmText: 'DELETE' }, extra || {}));
  };
  let novels = await loadNovels(readerCookie);

  const single = findNovelByTitle(novels, 'single', rootCategory);
  assert.ok(single && single.id, 'fileops single fixture novel');
  const moveNovel = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(single.id) + '/move', {
    method: 'PATCH',
    headers: moveHeaders,
    body: JSON.stringify({ targetCategoryPath: rootCategory + ' > moved_novels' })
  });
  assert.strictEqual(moveNovel.body.success, true, 'fileops move novel success');

  novels = await loadNovels(readerCookie);
  const renameSingle = findNovelByTitle(novels, 'rename_single', rootCategory);
  assert.ok(renameSingle && renameSingle.id, 'fileops rename single novel target');
  const renameNovel = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(renameSingle.id) + '/rename', {
    method: 'PATCH',
    headers: renameHeaders,
    body: JSON.stringify({ title: 'renamed_single' })
  });
  assert.strictEqual(renameNovel.body.success, true, 'fileops rename novel success');

  const renamedSingleRefresh = await waitForCatalogNovel(
    readerCookie,
    function(novel) { return novel && novel.title === 'renamed_single' && novel.categoryPath === rootCategory; },
    'fileops renamed single fixture'
  );
  novels = renamedSingleRefresh.novels;
  const renamedSingle = renamedSingleRefresh.novel;
  assert.ok(renamedSingle && renamedSingle.id, 'fileops renamed single fixture exists');
  const deleteSingle = findNovelByTitle(novels, 'delete_single', rootCategory);
  assert.ok(deleteSingle && deleteSingle.id, 'fileops delete single novel target');
  const deleteNovel = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(deleteSingle.id), {
    method: 'DELETE',
    headers: deleteHeaders,
    body: deleteBody()
  });
  assert.strictEqual(deleteNovel.body.success, true, 'fileops delete novel success');

  novels = await loadNovels(readerCookie);
  const renameSeriesNovel = findNovelByTitle(novels, 'rename_series', rootCategory);
  assert.ok(renameSeriesNovel && renameSeriesNovel.id, 'fileops rename series novel target');
  const renameFolderNovel = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(renameSeriesNovel.id) + '/rename', {
    method: 'PATCH',
    headers: renameHeaders,
    body: JSON.stringify({ title: 'renamed_series' })
  });
  assert.strictEqual(renameFolderNovel.body.success, true, 'fileops rename multifile novel success');

  novels = await loadNovels(readerCookie);
  const deleteSeriesNovel = findNovelByTitle(novels, 'delete_series', rootCategory);
  assert.ok(deleteSeriesNovel && deleteSeriesNovel.id, 'fileops delete series novel target');
  const deleteFolderNovel = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(deleteSeriesNovel.id), {
    method: 'DELETE',
    headers: deleteHeaders,
    body: deleteBody()
  });
  assert.strictEqual(deleteFolderNovel.body.success, true, 'fileops delete multifile novel success');

  novels = await loadNovels(readerCookie);
  const series = findNovelByTitle(novels, 'series', rootCategory);
  assert.ok(series && series.id, 'fileops series fixture novel');
  const firstEpisode = findEpisodeByTitle(series, '001');
  assert.ok(firstEpisode && firstEpisode.id, 'fileops rename episode target');
  const renameEpisode = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(series.id) + '/episodes/' + encodeURIComponent(firstEpisode.id) + '/rename', {
    method: 'PATCH',
    headers: renameHeaders,
    body: JSON.stringify({ title: '003' })
  });
  assert.strictEqual(renameEpisode.body.success, true, 'fileops rename episode success');

  const renamedEpisodeRefresh = await waitForCatalogNovel(
    readerCookie,
    function(novel) { return novel && novel.title === 'series' && novel.categoryPath === rootCategory && findEpisodeByTitle(novel, '003'); },
    'fileops renamed episode fixture'
  );
  novels = renamedEpisodeRefresh.novels;
  const renamedSeries = renamedEpisodeRefresh.novel;
  assert.ok(renamedSeries && renamedSeries.id, 'fileops series after rename');
  const renamedEpisode = findEpisodeByTitle(renamedSeries, '003');
  assert.ok(renamedEpisode && renamedEpisode.id, 'fileops delete episode target');
  const deleteEpisode = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(renamedSeries.id) + '/episodes/' + encodeURIComponent(renamedEpisode.id), {
    method: 'DELETE',
    headers: deleteHeaders,
    body: deleteBody()
  });
  assert.strictEqual(deleteEpisode.body.success, true, 'fileops delete episode success');

  novels = await loadNovels(readerCookie);
  const episodeMoveNovel = findNovelByTitle(novels, 'episode_move', rootCategory);
  assert.ok(episodeMoveNovel && episodeMoveNovel.id, 'fileops move episode fixture novel');
  const movingEpisode = findEpisodeByTitle(episodeMoveNovel, '001');
  assert.ok(movingEpisode && movingEpisode.id, 'fileops move episode target');
  const moveEpisode = await jsonFetch(BASE + '/api/episodes/' + encodeURIComponent(episodeMoveNovel.id) + '/' + encodeURIComponent(movingEpisode.id) + '/move', {
    method: 'PATCH',
    headers: moveHeaders,
    body: JSON.stringify({ targetCategoryPath: rootCategory + ' > moved_episodes' })
  });
  assert.strictEqual(moveEpisode.body.success, true, 'fileops move episode success');

  const renameFolder = await jsonFetch(BASE + '/api/folders/rename', {
    method: 'PATCH',
    headers: renameHeaders,
    body: JSON.stringify({ categoryPath: rootCategory + ' > folder_rename', newName: 'folder_renamed' })
  });
  assert.strictEqual(renameFolder.body.success, true, 'fileops rename folder success');

  const invalidNestedMove = await request(BASE + '/api/folders/move', {
    method: 'PATCH',
    headers: moveHeaders,
    body: JSON.stringify({ categoryPath: rootCategory + ' > folder_guard', targetCategoryPath: rootCategory + ' > folder_guard > child' })
  });
  assert.ok(invalidNestedMove.status >= 400, 'fileops reject folder move into descendant');

  const moveFolder = await jsonFetch(BASE + '/api/folders/move', {
    method: 'PATCH',
    headers: moveHeaders,
    body: JSON.stringify({ categoryPath: rootCategory + ' > folder_move', targetCategoryPath: rootCategory + ' > moved_folders' })
  });
  assert.strictEqual(moveFolder.body.success, true, 'fileops move folder success');

  const deleteFolder = await jsonFetch(BASE + '/api/folders', {
    method: 'DELETE',
    headers: deleteHeaders,
    body: deleteBody({ categoryPath: rootCategory + ' > moved_folders > folder_move' })
  });
  assert.strictEqual(deleteFolder.body.success, true, 'fileops delete folder success');

  return true;
}

async function main() {
  createFileopsFixtures();
  const isolatedDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-smoke-data-'));

  const env = Object.assign({}, process.env, {
    PORT: String(PORT),
    LIBRARY_PATH: TEST_LIBRARY_PATH,
    LOGINID: OWNER_LOGIN_ID,
    LOGINPW: OWNER_LOGIN_PW,
    NODE_ENV: 'test',
    APP_ORIGIN: '',
    TXT_READER_DATA_DIR: isolatedDataDir
  });

  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  let uploadedFont = '';
  let cleanupCookie = '';
  let cleanupCsrf = '';

  child.stdout.on('data', function(chunk) { stdout += chunk.toString(); });
  child.stderr.on('data', function(chunk) { stderr += chunk.toString(); });

  try {
    await waitForServer(child);

    const publicLoginHtml = await request(BASE + '/login.html', { headers: { 'accept-encoding': 'identity' } });
    assert.strictEqual(publicLoginHtml.status, 200, 'public login html status');
    assert.ok(String(publicLoginHtml.headers['cache-control'] || '').includes('no-store'), 'login html must remain no-store');
    assert.ok(publicLoginHtml.text.includes('rel="manifest" href="/manifest.json?v=' + CURRENT_REBUILD_VERSION + '"'), 'login html must advertise manifest before auth');
    assert.ok(publicLoginHtml.text.includes('rel="apple-touch-icon" sizes="180x180" href="/icon/apple-icon-180x180.png?v=' + CURRENT_REBUILD_VERSION + '"'), 'login html must advertise versioned apple touch icon before auth');
    assert.ok(publicLoginHtml.text.includes('rel="icon" type="image/png" sizes="32x32" href="/icon/favicon-32x32.png?v=' + CURRENT_REBUILD_VERSION + '"'), 'login html must advertise versioned 32px favicon before auth');
    assert.ok(publicLoginHtml.text.includes('rel="icon" type="image/png" sizes="16x16" href="/icon/favicon-16x16.png?v=' + CURRENT_REBUILD_VERSION + '"'), 'login html must advertise versioned 16px favicon before auth');

    const publicServiceWorker = await request(BASE + '/sw.js?v=' + CURRENT_REBUILD_VERSION, { headers: { 'accept-encoding': 'identity' } });
    assert.strictEqual(publicServiceWorker.status, 200, 'service worker must pass before auth');
    assert.ok(String(publicServiceWorker.headers['cache-control'] || '').includes('no-store'), 'service worker must remain no-store');
    assert.strictEqual(publicServiceWorker.headers['service-worker-allowed'], '/', 'service worker root scope header');
    assert.ok(publicServiceWorker.text.includes("CACHE_PREFIX = 'txt-reader-static-'"), 'service worker cache version source');
    const buildUniqueServiceWorker = await request(BASE + '/sw-' + CURRENT_REBUILD_VERSION + '.js', { headers: { 'accept-encoding': 'identity' } });
    assert.strictEqual(buildUniqueServiceWorker.status, 200, 'build-unique service worker must pass before auth');
    assert.ok(String(buildUniqueServiceWorker.headers['cache-control'] || '').includes('no-store'), 'build-unique service worker must remain no-store');
    assert.strictEqual(buildUniqueServiceWorker.headers['service-worker-allowed'], '/', 'build-unique service worker root scope header');
    assert.ok(buildUniqueServiceWorker.text.includes("const BUILD = '" + CURRENT_REBUILD_VERSION + "'"), 'build-unique service worker content must match its path');
    const publicOffline = await request(BASE + '/offline.html', { headers: { 'accept-encoding': 'identity' } });
    assert.strictEqual(publicOffline.status, 200, 'offline fallback must pass before auth');
    assert.ok(String(publicOffline.headers['cache-control'] || '').includes('no-store'), 'offline fallback must remain no-store');
    assert.ok(publicOffline.text.includes('v590-service-worker-offline-shell-pass'), 'offline fallback marker');
    const publicServiceWorkerRegister = await request(BASE + '/scripts/service-worker-register.js?v=' + CURRENT_REBUILD_VERSION, { headers: { 'accept-encoding': 'identity' } });
    assert.strictEqual(publicServiceWorkerRegister.status, 200, 'service worker registration script must pass before auth');

    const publicManifest = await request(BASE + '/manifest.json?v=' + CURRENT_REBUILD_VERSION, { headers: { 'accept-encoding': 'identity' } });
    assert.strictEqual(publicManifest.status, 200, 'manifest must pass before auth');
    assert.ok(String(publicManifest.headers['content-type'] || '').includes('application/json'), 'manifest content type');
    assert.ok(publicManifest.text.includes('/icon/icon-192.png'), 'manifest must include 192 icon');

    const loginIcon192 = await request(BASE + '/icon/icon-192.png', { headers: { 'accept-encoding': 'identity' } });
    assert.strictEqual(loginIcon192.status, 200, 'login logo icon must pass before auth');
    assert.ok(String(loginIcon192.headers['content-type'] || '').includes('image/png'), 'login logo icon content type');

    const favicon32 = await request(BASE + '/icon/favicon-32x32.png', { headers: { 'accept-encoding': 'identity' } });
    assert.strictEqual(favicon32.status, 200, 'login 32px favicon must pass before auth');
    assert.ok(String(favicon32.headers['content-type'] || '').includes('image/png'), 'login 32px favicon content type');

    const faviconAlias = await request(BASE + '/favicon.ico', { headers: { 'accept-encoding': 'identity' } });
    assert.strictEqual(faviconAlias.status, 200, 'root favicon alias must pass before auth');
    assert.strictEqual(faviconAlias.headers['x-public-icon-alias'], 'v524-public-icon-alias-before-auth-pass', 'root favicon alias marker');
    assert.ok(String(faviconAlias.headers['cache-control'] || '').includes('must-revalidate'), 'queryless root favicon alias must revalidate');
    assert.ok(!String(faviconAlias.headers['cache-control'] || '').includes('immutable'), 'queryless root favicon alias must not be immutable');
    assert.ok(faviconAlias.body.length > 0, 'root favicon alias body');
    const appleTouchAlias = await request(BASE + '/apple-touch-icon.png', { headers: { 'accept-encoding': 'identity' } });
    assert.strictEqual(appleTouchAlias.status, 200, 'root apple touch icon alias must pass before auth');
    assert.strictEqual(appleTouchAlias.headers['x-public-icon-alias'], 'v524-public-icon-alias-before-auth-pass', 'apple touch alias marker');
    assert.ok(String(appleTouchAlias.headers['content-type'] || '').includes('image/png'), 'apple touch alias content-type');
    assert.ok(appleTouchAlias.body.length > 0, 'apple touch alias body');

    const ownerLogin = await request(BASE + '/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: OWNER_LOGIN_ID, pw: OWNER_LOGIN_PW })
    });
    assert.strictEqual(ownerLogin.status, 200, 'owner login status');
    const ownerCookie = cookieFromLogin(ownerLogin);
    const ownerLoginBody = parseJsonBody(ownerLogin.text);
    assert.ok(ownerLoginBody && ownerLoginBody.csrfToken && ownerLoginBody.sessionKind === 'owner', 'owner login csrf token');
    const ownerCsrf = await jsonFetch(BASE + '/api/csrf', { headers: { cookie: ownerCookie } });
    const ownerHeaders = { cookie: ownerCookie, 'content-type': 'application/json', 'x-csrf-token': ownerCsrf.body.csrfToken };
    const ownerMetadataDocument = await request(BASE + '/metadata.html', { headers: { cookie: ownerCookie, 'accept-encoding': 'identity' } });
    assert.strictEqual(ownerMetadataDocument.status, 200, 'owner metadata document status');
    assert.ok(ownerMetadataDocument.text.includes('>v' + CURRENT_REBUILD_VERSION_NUMBER + '</span>'), 'owner metadata document current build badge');
    const ownerStateDenied = await request(BASE + '/api/user-state', { headers: { cookie: ownerCookie } });
    assert.strictEqual(ownerStateDenied.status, 403, 'owner session cannot use reader user-state API');
    const ownerLibraryEntry = await request(BASE + '/library.html', { headers: { cookie: ownerCookie }, timeoutMs: 2000 });
    assert.strictEqual(ownerLibraryEntry.status, 302, 'owner library entry redirect status');
    assert.strictEqual(ownerLibraryEntry.headers.location, '/admin/users.html', 'owner library entry redirects to owner console');
    assert.strictEqual(ownerLibraryEntry.headers['x-owner-entry-redirect'], 'v441-owner-session-entry-redirect-pass', 'owner library entry redirect marker');
    const ownerSiteEntry = await request(BASE + '/site.html', { headers: { cookie: ownerCookie }, timeoutMs: 2000 });
    assert.strictEqual(ownerSiteEntry.status, 302, 'owner site entry redirect status');
    assert.strictEqual(ownerSiteEntry.headers.location, '/admin/users.html', 'owner site entry redirects to owner console');
    assert.strictEqual(ownerSiteEntry.headers['x-owner-entry-redirect'], 'v441-owner-session-entry-redirect-pass', 'owner site entry redirect marker');
    const ownerMobileEntry = await request(BASE + '/mobile.html', { headers: { cookie: ownerCookie }, timeoutMs: 2000 });
    assert.strictEqual(ownerMobileEntry.status, 302, 'owner mobile entry redirect status');
    assert.strictEqual(ownerMobileEntry.headers.location, '/admin/users.html', 'owner mobile entry redirects to owner console');
    const ownerIndexEntry = await request(BASE + '/', { headers: { cookie: ownerCookie }, timeoutMs: 2000 });
    assert.strictEqual(ownerIndexEntry.status, 302, 'owner index entry redirect status');
    assert.strictEqual(ownerIndexEntry.headers.location, '/admin/users.html', 'owner index redirects to owner console');
    const createdReader = await jsonFetch(BASE + '/api/admin/users', {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ username: READER_LOGIN_ID, password: READER_LOGIN_PW, libraryAccess: { mode: 'all', folders: [] } })
    });
    assert.ok(createdReader.body && createdReader.body.user && createdReader.body.user.id === READER_LOGIN_ID, 'owner created reader user');
    const ownerPreview = await jsonFetch(BASE + '/api/admin/users/' + encodeURIComponent(READER_LOGIN_ID) + '/library-preview', { headers: { cookie: ownerCookie } });
    assert.strictEqual(ownerPreview.body.pass, 'v389-admin-library-preview-pass', 'owner library preview marker');
    assert.ok(Number(ownerPreview.body.accessibleNovelCount) >= 1, 'owner preview shows accessible novels');
    const createdScopedReader = await jsonFetch(BASE + '/api/admin/users', {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ username: SCOPED_READER_LOGIN_ID, password: READER_LOGIN_PW, libraryAccess: { mode: 'folders', folders: [FILEOPS_PREFIX] } })
    });
    assert.ok(createdScopedReader.body && createdScopedReader.body.user && createdScopedReader.body.user.id === SCOPED_READER_LOGIN_ID, 'owner created scoped reader user');

    const login = await request(BASE + '/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: READER_LOGIN_ID, pw: READER_LOGIN_PW })
    });
    assert.strictEqual(login.status, 200, 'reader login status');
    const cookie = cookieFromLogin(login);
    cleanupCookie = cookie;
    const loginBody = parseJsonBody(login.text);
    assert.ok(loginBody && loginBody.csrfToken && loginBody.sessionKind === 'user', 'reader login csrf token');

    const csrf = await jsonFetch(BASE + '/api/csrf', { headers: { cookie: cookie } });
    assert.ok(csrf.body.csrfToken, 'csrf endpoint token');
    const csrfToken = csrf.body.csrfToken;
    cleanupCsrf = csrfToken;
    const authJsonHeaders = { cookie: cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken };
    const deniedMetadataDocument = await request(BASE + '/metadata.html', { headers: { cookie: cookie, 'accept-encoding': 'identity' } });
    assert.strictEqual(deniedMetadataDocument.status, 303, 'metadata-disabled reader document redirect status');
    assert.strictEqual(deniedMetadataDocument.headers.location, '/library.html?notice=metadata_access_required', 'metadata-disabled reader returns to the library with a permission notice');
    const readerLibraryEntry = await request(BASE + '/library.html', { headers: { cookie: cookie, 'accept-encoding': 'identity' } });
    assert.strictEqual(readerLibraryEntry.status, 200, 'reader library entry status');
    assert.ok(String(readerLibraryEntry.headers['cache-control'] || '').includes('no-store'), 'reader library html must remain no-store');
    const readerSiteEntry = await request(BASE + '/site.html', { headers: { cookie: cookie, 'accept-encoding': 'identity' } });
    assert.strictEqual(readerSiteEntry.status, 200, 'reader site entry status');
    assert.ok(String(readerSiteEntry.headers['cache-control'] || '').includes('no-store'), 'reader site html must remain no-store');
    const readerMobileEntry = await request(BASE + '/mobile.html', { headers: { cookie: cookie, 'accept-encoding': 'identity' } });
    assert.strictEqual(readerMobileEntry.status, 200, 'reader mobile entry status');
    assert.ok(String(readerMobileEntry.headers['cache-control'] || '').includes('no-store'), 'reader mobile html must remain no-store');
    const versionedRebuildAsset = await request(BASE + '/scripts/rebuild/main.mjs?v=' + CURRENT_REBUILD_VERSION, { headers: { cookie: cookie, 'accept-encoding': 'identity' } });
    assert.strictEqual(versionedRebuildAsset.status, 200, 'versioned rebuild asset status');
    assert.strictEqual(versionedRebuildAsset.headers['cache-control'], 'public, max-age=31536000, immutable', 'versioned rebuild asset cache policy');
    assert.strictEqual(versionedRebuildAsset.headers['x-versioned-rebuild-asset'], 'v434-versioned-rebuild-asset-cache-pass', 'versioned rebuild asset marker');
    const unversionedRebuildAsset = await request(BASE + '/scripts/rebuild/main.mjs', { headers: { cookie: cookie, 'accept-encoding': 'identity' } });
    assert.strictEqual(unversionedRebuildAsset.status, 200, 'unversioned rebuild asset status');
    assert.strictEqual(unversionedRebuildAsset.headers['cache-control'], 'public, max-age=0, must-revalidate', 'unversioned rebuild asset must remain revalidated');
    assert.notStrictEqual(unversionedRebuildAsset.headers['cache-control'], versionedRebuildAsset.headers['cache-control'], 'versioned and queryless rebuild asset cache policies must differ');
    const compressedModulepreload = await request(BASE + '/scripts/rebuild/main.mjs', { headers: { cookie: cookie, 'accept-encoding': 'br, gzip' } });
    assert.strictEqual(compressedModulepreload.status, 200, 'compressed modulepreload asset status');
    assert.strictEqual(compressedModulepreload.headers['cache-control'], 'public, max-age=0, must-revalidate', 'compressed queryless modulepreload must remain revalidated');
    assert.ok(String(compressedModulepreload.headers.vary || '').toLowerCase().split(',').map(function(v){ return v.trim(); }).includes('accept-encoding'), 'compressed modulepreload varies by Accept-Encoding');
    const modulepreloadCachePolicyBoundary = 'v441-modulepreload-cache-policy-boundary-pass';
    const novelsConditional = await jsonFetch(BASE + '/api/novels', { headers: { cookie: cookie } });
    const initialNovelList = novelsConditional.body;
    assert.ok(initialNovelList.length >= 1, 'ACL user can see at least one allowed novel');
    assert.ok(/^W\/"[a-f0-9]{64}"$/.test(String(novelsConditional.res.headers.etag || '')), 'novels weak etag present');
    assert.strictEqual(novelsConditional.res.headers['cache-control'], 'private, max-age=0, must-revalidate', 'novels conditional cache policy');
    assert.strictEqual(novelsConditional.res.headers['x-novels-conditional-cache'], 'v434-novels-conditional-cache-pass', 'novels conditional cache marker');
    assert.strictEqual(novelsConditional.res.headers['x-novels-api-performance'], 'v453-library-catalog-performance-pass', 'novels API performance marker');
    assert.strictEqual(novelsConditional.res.headers['x-novels-api-payload-budget'], 'v453-novels-api-payload-budget-pass', 'novels API payload budget marker');
    assert.ok(Number(novelsConditional.res.headers['x-novels-api-serialized-bytes'] || 0) > 0, 'novels API serialized bytes header');
    assert.ok(['hit', 'miss'].includes(String(novelsConditional.res.headers['x-novels-api-response-cache'] || '')), 'novels API response cache header');
    assert.ok(String(novelsConditional.res.headers.vary || '').toLowerCase().split(',').map(function(v){ return v.trim(); }).includes('cookie'), 'novels varies by cookie');
    const novels304 = await request(BASE + '/api/novels', { headers: { cookie: cookie, 'if-none-match': novelsConditional.res.headers.etag } });
    assert.strictEqual(novels304.status, 304, 'novels conditional request returns 304');

    const scopedLogin = await request(BASE + '/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: SCOPED_READER_LOGIN_ID, pw: READER_LOGIN_PW })
    });
    assert.strictEqual(scopedLogin.status, 200, 'scoped reader login status');
    const scopedCookie = cookieFromLogin(scopedLogin);
    const scopedNovels = await jsonFetch(BASE + '/api/novels', { headers: { cookie: scopedCookie } });
    assert.ok(/^W\/"[a-f0-9]{64}"$/.test(String(scopedNovels.res.headers.etag || '')), 'scoped novels weak etag present');
    assert.notStrictEqual(scopedNovels.res.headers.etag, novelsConditional.res.headers.etag, 'novels etag differs across user/access scope');
    const scopedWithReaderEtag = await request(BASE + '/api/novels', { headers: { cookie: scopedCookie, 'if-none-match': novelsConditional.res.headers.etag } });
    assert.strictEqual(scopedWithReaderEtag.status, 200, 'foreign scoped novels etag must not return 304');
    const accessSnapshot = await jsonFetch(BASE + '/api/user-access/snapshot', { headers: { cookie: cookie } });
    assert.strictEqual(accessSnapshot.body.pass, 'v491-user-access-folder-mutation-snapshot-pass', 'user access snapshot marker');
    assert.ok(accessSnapshot.body.folderMutationAccess && Array.isArray(accessSnapshot.body.folderMutationAccess.moveFolders) && Array.isArray(accessSnapshot.body.folderMutationAccess.deleteFolders), 'user access snapshot includes folder mutation access');
    assert.strictEqual(accessSnapshot.body.accessibleNovelCount, initialNovelList.length, 'access snapshot count matches visible novels');
    const smokeNovelId = initialNovelList[0].id;

    const time = await jsonFetch(BASE + '/api/time', { headers: { cookie: cookie } });
    assert.ok(Number.isFinite(Number(time.body.ts)), 'time timestamp');

    const state = await jsonFetch(BASE + '/api/user-state', { headers: { cookie: cookie } });
    assert.ok(state.body.shared, 'user-state shared');
    assert.ok(state.body.device, 'user-state device');

    const customCssShared = 'body { --smoke-custom-css: 1; }';
    const smokeShortcuts = { searchOpen: 'Ctrl+F', readerNext: 'ArrowRight', settingsOpen: ',' };
    const smokePreprocessPreset = {
      id: 'smoke-preset',
      name: 'Smoke Preset',
      builtIn: false,
      options: { removeNoise: true, chapterSpacing: true, collapseBreaks: false, splitDense: true, dialogueBreak: false, paragraphOptimize: true, aggressive: false },
      updatedAt: Date.now()
    };
    const smokePreprocessMask = { removeNoise: true, chapterSpacing: false, collapseBreaks: true, splitDense: true, dialogueBreak: false, paragraphOptimize: true, aggressive: false };
    const smokeThemeColors = { bg: '#101820', surface: '#18222c', text: '#f0f0e8', accent: '#8aa6a3', readerBg: '#0f151a', readerText: '#e7e2d8' };
    const smokeTheme = { id: 'smoke-theme', name: 'Smoke Theme', colors: smokeThemeColors, updatedAt: Date.now() };
    const smokeSharedFont = 'var(--font-nanum-g)';
    const smokeSafeProfile = { id: 'smoke-safe-profile', name: 'Smoke Safe Area', contextKey: 'Chrome|browser-fullscreen|mobile', contextLabel: '브라우저 전체화면 · Chrome', uaKey: 'Chrome', displayMode: 'browser-fullscreen', isBrowserFullscreen: true, isStandalone: false, safeViewportAutoFit: false, safeTopInsetExtra: 33, safeBottomInsetExtra: 44, updatedAt: Date.now() };
    const smokeDeviceFont = 'var(--font-coding)';
    const smokeReadProgress = { lastRead: { novelId: smokeNovelId, episodeId: null, chunk: 1, totalChunks: 3, ratio: 0.25, documentRatio: 0.25, globalBlockIndex: 2, ts: Date.now(), sourceDeviceId: 'smoke-device' }, byNovel: { [smokeNovelId]: { novelId: smokeNovelId, episodeId: null, chunk: 1, totalChunks: 3, ratio: 0.25, documentRatio: 0.25, globalBlockIndex: 2, ts: Date.now(), sourceDeviceId: 'smoke-device' } }, positions: { 'pos-smoke-novel-single': { globalBlockIndex: 2, documentRatio: 0.25, fallbackChunk: 1, fallbackRatio: 0.25 } }, readMeta: { 'smoke-novel-single': { novelId: smokeNovelId, episodeId: null, chunk: 1, totalChunks: 3, ratio: 0.25, documentRatio: 0.25, globalBlockIndex: 2, ts: Date.now(), sourceDeviceId: 'smoke-device' } } };
    const smokeBookmark = { id: 'smoke-bookmark', novelId: smokeNovelId, title: 'Smoke Novel', chunk: 1, totalChunks: 3, ratio: 0.25, documentRatio: 0.25, globalBlockIndex: 2, note: 'smoke note', ts: Date.now() };
    const smokeRecent = { id: 'smoke-recent', novelId: smokeNovelId, title: 'Smoke Novel', label: 'Smoke Novel', ts: Date.now() };
    const sharedCss = await jsonFetch(BASE + '/api/user-state/shared', {
      method: 'PUT',
      headers: authJsonHeaders,
      body: JSON.stringify({
        viewerPrefs: {
          customCssShared: customCssShared,
          shortcuts: smokeShortcuts,
          serverCommNotify: true,
          serverCommNotifyInterval: 9,
          safeRemainingShow: true,
          safeViewportAutoFit: true,
          safeTopInsetExtra: 7,
          safeBottomInsetExtra: 11,
          safeViewportProfileId: smokeSafeProfile.id,
          safeViewportProfiles: [smokeSafeProfile],
          preprocess: smokePreprocessPreset.options,
          preprocessPresetId: smokePreprocessPreset.id,
          preprocessPresetApplyKeys: smokePreprocessMask,
          preprocessPresets: [smokePreprocessPreset],
          themeColors: smokeThemeColors,
          themePresetId: smokeTheme.id,
          themeCustomThemes: [smokeTheme],
          fontFamily: smokeSharedFont,
          fontFamilyShared: smokeSharedFont
        },
        progress: smokeReadProgress,
        bookmarks: [smokeBookmark],
        recents: [smokeRecent],
        favorites: [smokeNovelId],
        updatedAt: Date.now(),
        syncVersion: 1
      })
    });
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.customCssShared, customCssShared, 'shared custom css preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.shortcuts.searchOpen, 'Ctrl+F', 'shared shortcut preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.serverCommNotifyInterval, 9, 'server comm interval preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.safeViewportAutoFit, true, 'safe viewport auto fit preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.safeTopInsetExtra, 7, 'safe top inset extra preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.safeBottomInsetExtra, 11, 'safe bottom inset extra preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.safeViewportProfileId, smokeSafeProfile.id, 'safe viewport profile id preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.safeViewportProfiles[0].safeBottomInsetExtra, 44, 'safe viewport profile preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.preprocess.removeNoise, true, 'preprocess option preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.preprocessPresetId, 'smoke-preset', 'preprocess preset id preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.preprocessPresetApplyKeys.chapterSpacing, false, 'preprocess partial mask preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.preprocessPresets[0].name, 'Smoke Preset', 'preprocess preset preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.themeColors.readerBg, smokeThemeColors.readerBg, 'theme colors preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.themePresetId, smokeTheme.id, 'theme preset id preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.themeCustomThemes[0].name, 'Smoke Theme', 'custom theme preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.fontFamily, smokeSharedFont, 'shared font family preserved');
    assert.strictEqual(sharedCss.body.shared.viewerPrefs.fontFamilyShared, smokeSharedFont, 'shared font family alias preserved');
assert.strictEqual(sharedCss.body.shared.progress.lastRead.novelId, smokeNovelId, 'read progress preserved');
    assert.strictEqual(sharedCss.body.shared.bookmarks[0].note, 'smoke note', 'bookmark note preserved');
    assert.strictEqual(sharedCss.body.shared.recents[0].novelId, smokeNovelId, 'recent item preserved');
    assert.strictEqual(sharedCss.body.shared.favorites[0], smokeNovelId, 'favorite item preserved');

    const customCssDevice = 'body { --smoke-device-css: 1; }';
    const device = await jsonFetch(BASE + '/api/user-state/device', {
      method: 'PUT',
      headers: authJsonHeaders,
      body: JSON.stringify({ deviceId: 'smoke-device', deviceName: 'Smoke Device', prefs: { customCssDevice: customCssDevice, fontFamilyDevice: smokeDeviceFont }, collapsedFolders: [], updatedAt: Date.now(), syncVersion: 1 })
    });
    assert.ok(device.body.device, 'put device body');
    assert.strictEqual(device.body.device.prefs.customCssDevice, customCssDevice, 'device custom css preserved');
    assert.strictEqual(device.body.device.prefs.fontFamilyDevice, smokeDeviceFont, 'device font family preserved');

    const smokeOtherDevice = 'smoke-other-device';
    const syncPolicySave = await jsonFetch(BASE + '/api/user-state/shared', {
      method: 'PUT',
      headers: authJsonHeaders,
      body: JSON.stringify({
        syncPolicy: {
          preferredDeviceId: 'smoke-device',
          devices: [
            { id: 'smoke-device', name: 'Smoke Device', lastSeenAt: Date.now() },
            { id: smokeOtherDevice, name: 'Smoke Other Device', lastSeenAt: Date.now() - 1000 }
          ],
          share: { otherDeviceAlert: true, otherDeviceConnectToast: true, progress: true }
        },
        updatedAt: Date.now() + 1,
        syncVersion: 2
      })
    });
    assert.strictEqual(syncPolicySave.body.syncPolicySummary.preferredDeviceId, 'smoke-device', 'preferred device preserved');
    assert.ok(syncPolicySave.body.syncPolicySummary.devices.some(function(item) { return item.id === 'smoke-device' && item.name === 'Smoke Device'; }), 'device registry name preserved');

    const remotePreferredProgress = { lastRead: { novelId: smokeNovelId, episodeId: null, chunk: 2, totalChunks: 3, ratio: 0.5, documentRatio: 0.5, globalBlockIndex: 4, ts: Date.now(), sourceDeviceId: 'smoke-device', sourceDeviceName: 'Smoke Device', sourceSavedAt: Date.now() }, byNovel: {}, positions: {}, readMeta: {} };
    const preferredProgress = await jsonFetch(BASE + '/api/user-state/progress', {
      method: 'PUT',
      headers: authJsonHeaders,
      body: JSON.stringify({ progress: remotePreferredProgress, updatedAt: Date.now() + 2, syncVersion: 3 })
    });
    assert.strictEqual(preferredProgress.body.syncPolicySummary.progressAuthority.isFromPreferredDevice, true, 'preferred progress authority detected');

    const currentView = await jsonFetch(BASE + '/api/user-state', { headers: { cookie: cookie, 'x-device-id': smokeOtherDevice } });
    assert.strictEqual(currentView.body.syncPolicySummary.progressAuthority.shouldOfferRemoteResume, true, 'remote preferred position offered to other device');

    const nonPreferredProgress = { lastRead: { novelId: smokeNovelId, episodeId: null, chunk: 1, totalChunks: 3, ratio: 0.1, documentRatio: 0.1, globalBlockIndex: 1, ts: Date.now(), sourceDeviceId: smokeOtherDevice, sourceDeviceName: 'Smoke Other Device', sourceSavedAt: Date.now() }, byNovel: {}, positions: {}, readMeta: {} };
    const blockedProgressVersion = Number(preferredProgress.body.sharedVersion || 0) + 1;
    const blockedProgress = await jsonFetch(BASE + '/api/user-state/progress', {
      method: 'PUT',
      headers: authJsonHeaders,
      body: JSON.stringify({ progress: nonPreferredProgress, updatedAt: Date.now() + 3, syncVersion: blockedProgressVersion })
    });
    assert.strictEqual(blockedProgress.body.syncPolicySummary.progressAuthority.blockedByPreferredDevice, true, 'non-preferred progress blocked by preferred policy');
    assert.strictEqual(blockedProgress.body.syncPolicySummary.progressAuthority.shouldOfferRemoteResume, false, 'non-preferred progress does not create remote offer');

    const exportedReaderState = await jsonFetch(BASE + '/api/admin/users/' + encodeURIComponent(READER_LOGIN_ID) + '/state/export', { headers: { cookie: ownerCookie } });
    assert.strictEqual(exportedReaderState.body.pass, 'v392-txt-reader-multi-user-state-admin-management-pass', 'owner user-state export marker');
    assert.ok(exportedReaderState.body.state && exportedReaderState.body.state.shared, 'owner user-state export body');
    const readerStateExportDenied = await request(BASE + '/api/admin/users/' + encodeURIComponent(READER_LOGIN_ID) + '/state/export', { headers: { cookie: cookie } });
    assert.strictEqual(readerStateExportDenied.status, 403, 'reader session cannot export admin user state');

    const novelList = initialNovelList;
    assert.ok(novelList.length >= 1, 'test library has at least one novel');
    const first = novelList.find(function(novel) { return !novel.isMultiFile && novel.title === 'test'; }) || novelList.find(function(novel) { return !novel.isMultiFile; }) || novelList[0];
    assert.ok(first.id, 'first novel id');

    const content = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(first.id) + '/content?chunk=1', { headers: { cookie: cookie } });
    assert.ok(typeof content.body.content === 'string', 'content text');
    assert.ok(Number(content.body.currentChunk) >= 1, 'content currentChunk');
    assert.ok(Number(content.body.totalChunks) >= 1, 'content totalChunks');
    assert.ok(/^W\/"[a-f0-9]{64}"$/.test(String(content.res.headers.etag || '')), 'content weak etag present');
    assert.strictEqual(content.res.headers['cache-control'], 'private, max-age=0, must-revalidate', 'content conditional cache policy');
    assert.strictEqual(content.res.headers['x-content-chunk-conditional-cache'], 'v434-content-chunk-conditional-cache-pass', 'content conditional cache marker');
    assert.ok(String(content.res.headers.vary || '').toLowerCase().split(',').map(function(v){ return v.trim(); }).includes('cookie'), 'content varies by cookie');
    const content304 = await request(BASE + '/api/novels/' + encodeURIComponent(first.id) + '/content?chunk=1', { headers: { cookie: cookie, 'if-none-match': content.res.headers.etag } });
    assert.strictEqual(content304.status, 304, 'content conditional request returns 304');
    const preRevokeManifest = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(first.id) + '/block-manifest', { headers: { cookie: cookie } });
    assert.ok(/^W\/"[a-f0-9]{64}"$/.test(String(preRevokeManifest.res.headers.etag || '')), 'pre-revoke manifest weak etag present');

    const revokedAccess = await jsonFetch(BASE + '/api/admin/users/' + encodeURIComponent(READER_LOGIN_ID), {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ libraryAccess: { mode: 'none', folders: [] } })
    });
    assert.strictEqual(revokedAccess.body.ok, true, 'owner revoked reader library access');
    const revokedNovelsWithOldEtag = await jsonFetch(BASE + '/api/novels', { headers: { cookie: cookie, 'if-none-match': novelsConditional.res.headers.etag } });
    assert.strictEqual(revokedNovelsWithOldEtag.res.status, 200, 'ACL-changed novels request with old etag must not return 304');
    assert.notStrictEqual(revokedNovelsWithOldEtag.res.headers.etag, novelsConditional.res.headers.etag, 'ACL-changed novels etag must change');
    assert.strictEqual(revokedNovelsWithOldEtag.res.headers['cache-control'], 'private, max-age=0, must-revalidate', 'ACL-changed novels cache policy remains private');
    assert.ok(!/public|immutable/i.test(String(revokedNovelsWithOldEtag.res.headers['cache-control'] || '')), '/api/novels must not use public immutable cache');
    const revokedContentWithOldEtag = await request(BASE + '/api/novels/' + encodeURIComponent(first.id) + '/content?chunk=1', { headers: { cookie: cookie, 'if-none-match': content.res.headers.etag } });
    assert.notStrictEqual(revokedContentWithOldEtag.status, 304, 'ACL-changed content request with old etag must not return 304');
    const revokedManifestWithOldEtag = await request(BASE + '/api/novels/' + encodeURIComponent(first.id) + '/block-manifest', { headers: { cookie: cookie, 'if-none-match': preRevokeManifest.res.headers.etag } });
    assert.notStrictEqual(revokedManifestWithOldEtag.status, 304, 'ACL-changed block manifest request with old etag must not return 304');
    const cacheInvalidationContract = 'v442-cache-invalidation-contract-smoke-pass';
    const restoredAccess = await jsonFetch(BASE + '/api/admin/users/' + encodeURIComponent(READER_LOGIN_ID), {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ libraryAccess: { mode: 'all', folders: [] } })
    });
    assert.strictEqual(restoredAccess.body.ok, true, 'owner restored reader library access');

    const chunkedNovel = findNovelByTitle(novelList, 'chunked', FILEOPS_PREFIX);
    assert.ok(chunkedNovel && chunkedNovel.id, 'chunked fixture novel exists');
    const coldWarmContentPath = '/api/novels/' + encodeURIComponent(chunkedNovel.id) + '/content?chunk=2';
    const coldWarmContent = await timedJsonFetch('content cold request', BASE + coldWarmContentPath, { headers: { cookie: cookie } });
    const warmContent = await timedJsonFetch('content warm request', BASE + coldWarmContentPath, { headers: { cookie: cookie } });
    assert.strictEqual(warmContent.res.status, 200, 'content warm request status');
    assert.strictEqual(warmContent.res.headers.etag, coldWarmContent.res.headers.etag, 'content warm etag remains stable');
    assert.strictEqual(warmContent.body.content, coldWarmContent.body.content, 'content warm body remains stable');
    const coldWarmContentTiming = compareColdWarmTiming('content chunk', coldWarmContent.elapsedMs, warmContent.elapsedMs);

    const coldWarmManifestPath = '/api/novels/' + encodeURIComponent(chunkedNovel.id) + '/block-manifest';
    const coldWarmManifest = await timedJsonFetch('block manifest cold request', BASE + coldWarmManifestPath, { headers: { cookie: cookie } });
    const warmManifest = await timedJsonFetch('block manifest warm request', BASE + coldWarmManifestPath, { headers: { cookie: cookie } });
    assert.strictEqual(warmManifest.res.status, 200, 'block manifest warm request status');
    assert.strictEqual(warmManifest.res.headers.etag, coldWarmManifest.res.headers.etag, 'block manifest warm etag remains stable');
    assert.deepStrictEqual(warmManifest.body.chunks, coldWarmManifest.body.chunks, 'block manifest warm chunks remain stable');
    const coldWarmManifestTiming = compareColdWarmTiming('block manifest', coldWarmManifest.elapsedMs, warmManifest.elapsedMs);
    const readerApiColdWarmCache = {
      marker: 'v438-reader-api-cold-warm-cache-smoke-pass',
      content: coldWarmContentTiming,
      blockManifest: coldWarmManifestTiming
    };

    const chunkedOne = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(chunkedNovel.id) + '/content?chunk=1', { headers: { cookie: cookie } });
    const chunkedTwo = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(chunkedNovel.id) + '/content?chunk=2', { headers: { cookie: cookie } });
    assert.ok(Number(chunkedOne.body.totalChunks) >= 2, 'chunked fixture has multiple chunks');
    assert.notStrictEqual(chunkedOne.res.headers.etag, chunkedTwo.res.headers.etag, 'content etag differs by chunk index');

    const manifest = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(first.id) + '/block-manifest', { headers: { cookie: cookie } });
    assert.ok(Array.isArray(manifest.body.chunks), 'manifest chunks array');
    assert.ok(Number(manifest.body.totalBlocks) >= 1, 'manifest totalBlocks');
    assert.ok(/^W\/"[a-f0-9]{64}"$/.test(String(manifest.res.headers.etag || '')), 'manifest weak etag present');
    assert.strictEqual(manifest.res.headers['cache-control'], 'private, max-age=0, must-revalidate', 'manifest conditional cache policy');
    assert.strictEqual(manifest.res.headers['x-block-manifest-conditional-cache'], 'v434-block-manifest-conditional-cache-pass', 'manifest conditional cache marker');
    assert.ok(String(manifest.res.headers.vary || '').toLowerCase().split(',').map(function(v){ return v.trim(); }).includes('cookie'), 'manifest varies by cookie');
    const manifest304 = await request(BASE + '/api/novels/' + encodeURIComponent(first.id) + '/block-manifest', { headers: { cookie: cookie, 'if-none-match': manifest.res.headers.etag } });
    assert.strictEqual(manifest304.status, 304, 'manifest conditional request returns 304');

    const episodeNovel = novelList.find(function(novel) { return novel.title === 'series' && novel.isMultiFile && Array.isArray(novel.episodes) && novel.episodes.length; })
      || novelList.find(function(novel) { return novel.isMultiFile && Array.isArray(novel.episodes) && novel.episodes.length; });
    assert.ok(episodeNovel, 'episode fixture novel exists');
    const episode = episodeNovel.episodes[0];
    const episodeContent = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(episodeNovel.id) + '/episodes/' + encodeURIComponent(episode.id) + '?chunk=1', { headers: { cookie: cookie } });
    assert.ok(typeof episodeContent.body.content === 'string' && episodeContent.body.content.length > 0, 'episode content text');
    assert.ok(/^W\/"[a-f0-9]{64}"$/.test(String(episodeContent.res.headers.etag || '')), 'episode content weak etag present');
    const episodeContent304 = await request(BASE + '/api/novels/' + encodeURIComponent(episodeNovel.id) + '/episodes/' + encodeURIComponent(episode.id) + '?chunk=1', { headers: { cookie: cookie, 'if-none-match': episodeContent.res.headers.etag } });
    assert.strictEqual(episodeContent304.status, 304, 'episode content conditional request returns 304');
    if ((episodeNovel.episodes || []).length > 1) {
      const nextEpisode = episodeNovel.episodes[1];
      const nextEpisodeContent = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(episodeNovel.id) + '/episodes/' + encodeURIComponent(nextEpisode.id) + '?chunk=1', { headers: { cookie: cookie } });
      assert.notStrictEqual(nextEpisodeContent.res.headers.etag, episodeContent.res.headers.etag, 'episode content etag differs by episode id');
    }
    const episodeManifest = await jsonFetch(BASE + '/api/novels/' + encodeURIComponent(episodeNovel.id) + '/episodes/' + encodeURIComponent(episode.id) + '/block-manifest', { headers: { cookie: cookie } });
    assert.ok(Number(episodeManifest.body.totalBlocks) >= 1, 'episode manifest totalBlocks');
    assert.ok(/^W\/"[a-f0-9]{64}"$/.test(String(episodeManifest.res.headers.etag || '')), 'episode manifest weak etag present');
    const episodeManifest304 = await request(BASE + '/api/novels/' + encodeURIComponent(episodeNovel.id) + '/episodes/' + encodeURIComponent(episode.id) + '/block-manifest', { headers: { cookie: cookie, 'if-none-match': episodeManifest.res.headers.etag } });
    assert.strictEqual(episodeManifest304.status, 304, 'episode manifest conditional request returns 304');

    const readerRecoveryDenied = await request(BASE + '/api/recovery-status', { headers: { cookie: cookie } });
    assert.strictEqual(readerRecoveryDenied.status, 403, 'reader session cannot use owner recovery API');
    const recovery = await jsonFetch(BASE + '/api/recovery-status', { headers: { cookie: ownerCookie } });
    assert.ok(recovery.body.syncData, 'recovery syncData');
    assert.ok(recovery.body.libraryCache, 'recovery library cache');
    assert.ok(recovery.body.recoveryPolicies && recovery.body.recoveryPolicies.scopedImport, 'recovery scoped import policy');

    const fontListBefore = await jsonFetch(BASE + '/api/fonts', { headers: { cookie: cookie } });
    assert.ok(Array.isArray(fontListBefore.body.items), 'font list items');
    assert.strictEqual(fontListBefore.body.pass, 'v426-user-font-library-scope-pass', 'font list must be scoped');
    assert.strictEqual(fontListBefore.body.scope && fontListBefore.body.scope.userScoped, true, 'reader font list must be user scoped');
    const readerFontUpload = await jsonFetch(BASE + '/api/fonts/upload', {
      method: 'POST',
      headers: {
        cookie: cookie,
        'content-type': 'application/octet-stream',
        'x-csrf-token': csrfToken,
        'x-font-filename': 'reader-owned.woff',
        'x-font-family': 'Reader Owned Font ' + Date.now()
      },
      body: Buffer.from('wOFFreader-owned')
    });
    assert.strictEqual(readerFontUpload.body.success, true, 'reader session can upload own scoped font');
    assert.strictEqual(readerFontUpload.body.scope && readerFontUpload.body.scope.userScoped, true, 'reader uploaded font must be user scoped');
    const readerFontFile = await rawFetch(BASE + '/api/fonts/file/' + encodeURIComponent(readerFontUpload.body.filename), { headers: { cookie: cookie } });
    assert.ok(readerFontFile.body.length >= 4, 'reader downloaded own font body');
    const ownerCannotReadReaderFont = await request(BASE + '/api/fonts/file/' + encodeURIComponent(readerFontUpload.body.filename), { headers: { cookie: ownerCookie } });
    assert.strictEqual(ownerCannotReadReaderFont.status, 404, 'owner font scope cannot read reader scoped font file');
    const readerFontDelete = await jsonFetch(BASE + '/api/fonts/' + encodeURIComponent(readerFontUpload.body.filename), {
      method: 'DELETE',
      headers: { cookie: cookie, 'x-csrf-token': csrfToken }
    });
    assert.strictEqual(readerFontDelete.body.success, true, 'reader session can delete own scoped font');
    const fontUpload = await jsonFetch(BASE + '/api/fonts/upload', {
      method: 'POST',
      headers: {
        cookie: ownerCookie,
        'content-type': 'application/octet-stream',
        'x-csrf-token': ownerCsrf.body.csrfToken,
        'x-font-filename': 'smoke.woff',
        'x-font-family': 'Smoke Font ' + Date.now()
      },
      body: Buffer.from('wOFFsmoke-font-fixture')
    });
    cleanupCookie = ownerCookie;
    cleanupCsrf = ownerCsrf.body.csrfToken;
    assert.strictEqual(fontUpload.body.success, true, 'owner font upload success');
    uploadedFont = fontUpload.body.filename;
    assert.ok(uploadedFont && uploadedFont.endsWith('.woff'), 'uploaded font filename');
    const fontFile = await rawFetch(BASE + '/api/fonts/file/' + encodeURIComponent(uploadedFont), { headers: { cookie: ownerCookie } });
    assert.ok(fontFile.body.length >= 4, 'downloaded owner font body');
    const readerCannotDeleteOwnerFont = await request(BASE + '/api/fonts/' + encodeURIComponent(uploadedFont), {
      method: 'DELETE',
      headers: { cookie: cookie, 'x-csrf-token': csrfToken }
    });
    assert.strictEqual(readerCannotDeleteOwnerFont.status, 200, 'reader delete only affects own scope even for owner filename');
    const fontDelete = await jsonFetch(BASE + '/api/fonts/' + encodeURIComponent(uploadedFont), {
      method: 'DELETE',
      headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf.body.csrfToken }
    });
    uploadedFont = '';
    assert.strictEqual(fontDelete.body.success, true, 'owner font delete success');

    const readerFileopsDenied = await request(BASE + '/api/novels/' + encodeURIComponent(first.id) + '/rename', {
      method: 'PATCH',
      headers: Object.assign({}, authJsonHeaders, { 'x-confirm-action': 'fileops-rename' }),
      body: JSON.stringify({ title: 'reader-denied' })
    });
    assert.strictEqual(readerFileopsDenied.status, 403, 'reader session cannot use owner fileops mutation API');
    const fileops = await runFileopsSmoke(cookie, ownerHeaders);
    const resetWithoutConfirm = await request(BASE + '/api/admin/users/' + encodeURIComponent(READER_LOGIN_ID) + '/state/reset', {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ confirmText: 'WRONG' })
    });
    assert.strictEqual(resetWithoutConfirm.status, 400, 'user-state reset requires explicit RESET confirm');
    const resetReaderState = await jsonFetch(BASE + '/api/admin/users/' + encodeURIComponent(READER_LOGIN_ID) + '/state/reset', {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ confirmText: 'RESET' })
    });
    assert.strictEqual(resetReaderState.body.pass, 'v392-txt-reader-multi-user-state-admin-management-pass', 'owner user-state reset marker');

    const searchSource = fs.readFileSync(path.join(ROOT, 'public', 'scripts', 'rebuild', 'features', 'search.mjs'), 'utf8');
    const searchSplitDir = path.join(ROOT, 'public', 'scripts', 'rebuild', 'features', 'search');
    const searchSplitSource = fs.readdirSync(searchSplitDir)
      .filter(function(name) { return name.endsWith('.mjs'); })
      .map(function(name) { return fs.readFileSync(path.join(searchSplitDir, name), 'utf8'); })
      .join('\n');
    const searchCombinedSource = searchSource + '\n' + searchSplitSource;
    const searchMatcherSource = fs.readFileSync(path.join(searchSplitDir, 'matcher.mjs'), 'utf8');
    const domActionsSource = fs.readFileSync(path.join(ROOT, 'public', 'scripts', 'rebuild', 'features', 'reader', 'dom-actions.mjs'), 'utf8');
    const searchResultsSource = fs.readFileSync(path.join(ROOT, 'public', 'scripts', 'rebuild', 'features', 'search', 'results-view.mjs'), 'utf8');
    const syncDevtoolsSource = fs.readFileSync(path.join(ROOT, 'public', 'scripts', 'rebuild', 'features', 'sync-devtools.mjs'), 'utf8');
    const recoveryDir = path.join(ROOT, 'public', 'scripts', 'rebuild', 'features', 'recovery');
    const recoverySource = fs.existsSync(recoveryDir)
      ? fs.readdirSync(recoveryDir)
        .filter(function(name) { return name.endsWith('.mjs'); })
        .map(function(name) { return fs.readFileSync(path.join(recoveryDir, name), 'utf8'); })
        .join('\n')
      : '';
    const recoveryCombinedSource = syncDevtoolsSource + '\n' + recoverySource;
    const shellSource = [
      fs.readFileSync(path.join(ROOT, 'public', 'fragments', 'app-shell.html'), 'utf8'),
      fs.readFileSync(path.join(ROOT, 'public', 'fragments', 'deferred-ui.html'), 'utf8')
    ].join('\n');
    assert.ok(shellSource.indexOf('search-nav-remote') >= 0, 'search remote shell exists');
    assert.ok(searchCombinedSource.indexOf('searchRemotePosition') >= 0, 'search remote drag position persistence exists');
    assert.ok(searchSource.indexOf('ev.target === app.els.nsearchOverlay') >= 0 && searchSource.indexOf("reason:'search-modal-overlay'") >= 0, 'search overlay close handler exists');
    assert.ok(searchResultsSource.indexOf('activateClickedResult') >= 0, 'search result immediate activation handler exists');
    assert.ok(searchMatcherSource.indexOf('skippedOfflineChunks') >= 0, 'search offline skipped chunk accounting exists');
    assert.ok(searchMatcherSource.indexOf('reader-cache') >= 0 && searchMatcherSource.indexOf('networkChunks') >= 0, 'search source accounting exists');
    assert.ok(searchCombinedSource.indexOf('sourceLabel') >= 0, 'search source labels exist');
    assert.ok(shellSource.indexOf('nsearch-retrybar') >= 0, 'search retry bar shell exists');
    assert.ok(searchSource.indexOf('retrySearchChunks') >= 0, 'search retry handler exists');
    assert.ok(searchSource.indexOf('refreshSearchCoveragePreview') >= 0, 'search coverage preview handler exists');
    assert.ok(searchMatcherSource.indexOf('searchSelectedChunks') >= 0, 'search selected chunk retry exists');
    assert.ok(searchMatcherSource.indexOf('buildSearchCoveragePreview') >= 0, 'search coverage preview scanner exists');
    assert.ok(shellSource.indexOf('nsearch-filterbar') >= 0 && searchCombinedSource.indexOf('searchResultMatchesFilter') >= 0, 'search source filters exist');
    assert.ok(shellSource.indexOf('nsearch-chunk-details') >= 0 && searchCombinedSource.indexOf('updateSearchChunkDetails') >= 0, 'search failed chunk details exist');
    assert.ok(shellSource.indexOf('nsearch-mode-toggle') >= 0 && shellSource.indexOf('전체검색') >= 0 && searchMatcherSource.indexOf('cache-only') >= 0, 'search cache-first toggle mode exists');
    assert.ok(searchCombinedSource.indexOf('nsearch-chunk-retry-btn') >= 0 && searchCombinedSource.indexOf('handleSearchRetrybarClick') >= 0, 'search chunk-level retry buttons exist');
    assert.ok(recoveryCombinedSource.indexOf('캐시된 범위만 검색') >= 0, 'recovery cache-only search launcher exists');
    assert.ok(recoveryCombinedSource.indexOf('현재 주변 저장') >= 0 && recoveryCombinedSource.indexOf('검색 누락 저장') >= 0, 'recovery offline cache action launchers exist');
    assert.ok(recoveryCombinedSource.indexOf('prepareOfflineChunks') >= 0 && domActionsSource.indexOf('prepareOfflineChunks') >= 0, 'offline selected chunk preparation exists');
    assert.ok(recoveryCombinedSource.indexOf('renderRecoverySearchPanel') >= 0 && recoveryCombinedSource.indexOf('검색/오프라인 진단') >= 0, 'recovery search diagnostics exist');
    const readDataSource = fs.readFileSync(path.join(ROOT, 'public', 'scripts', 'rebuild', 'features', 'bookmarks', 'read-data-modal.mjs'), 'utf8');
    assert.ok(shellSource.indexOf('rdm-import-preview') >= 0, 'read data import preview shell exists');
    assert.ok(readDataSource.indexOf('buildReadDataImportPreview') >= 0 && readDataSource.indexOf('applyReadDataImportPreview') >= 0, 'read data import preview/apply handlers exist');
    assert.ok(readDataSource.indexOf('READ_DATA_IMPORT_POLICIES') >= 0 && readDataSource.indexOf('txt-reader-read-data-rollback-v1') >= 0, 'read data import policies and rollback exist');
    assert.ok(readDataSource.indexOf('restoreReadDataRollback') >= 0 && readDataSource.indexOf('loadReadDataRollbackSnapshot') >= 0, 'read data rollback restore exists');
    assert.ok(readDataSource.indexOf('openReadDataImportDetail') >= 0 && readDataSource.indexOf('rdm-detail-overlay') >= 0, 'read data import detail modal exists');
    assert.ok(readDataSource.indexOf('preview.overrides') >= 0 && readDataSource.indexOf('resolveImportChoice') >= 0, 'read data item-level conflict overrides exist');

    const librarySource = fs.readFileSync(path.join(ROOT, 'public', 'scripts', 'rebuild', 'features', 'library.mjs'), 'utf8');
    const featuresDir = path.join(ROOT, 'public', 'scripts', 'rebuild', 'features');
    const librarySplitSource = fs.readdirSync(featuresDir)
      .filter(function(name) { return /^library.*\.mjs$/.test(name); })
      .map(function(name) { return fs.readFileSync(path.join(featuresDir, name), 'utf8'); })
      .join('\n');
    const libraryCombinedSource = librarySource + '\n' + librarySplitSource;
    assert.ok(libraryCombinedSource.indexOf('handleLibraryDragStart') >= 0, 'library drag start handler exists');
    assert.ok(libraryCombinedSource.indexOf('handleLibraryDrop') >= 0, 'library drop handler exists');
    assert.ok(libraryCombinedSource.indexOf('moveDraggedLibraryItem') >= 0, 'library drag move handler exists');
    assert.ok(libraryCombinedSource.indexOf('library-root-dropzone') >= 0, 'library root dropzone exists');
    assert.ok(libraryCombinedSource.indexOf('scheduleLibraryHoverOpen') >= 0, 'library drag hover open exists');
    assert.ok(libraryCombinedSource.indexOf('validateLibraryMoveTarget') >= 0, 'library drag conflict validation exists');
    assert.ok(libraryCombinedSource.indexOf('describeLibraryMutationError') >= 0, 'library mutation error mapping exists');
    assert.ok(libraryCombinedSource.indexOf('formatNovelMeta') >= 0 && libraryCombinedSource.indexOf('독서율') >= 0, 'library novel meta hides raw file path');
    assert.ok(libraryCombinedSource.indexOf('chooseLibraryMoveTarget') >= 0 && libraryCombinedSource.indexOf('library-move-picker') >= 0, 'library move target picker exists');
    assert.ok(libraryCombinedSource.indexOf('supportsNativeLibraryDnd') >= 0 && libraryCombinedSource.indexOf('nativeDnd') >= 0, 'mobile native DnD fallback gate exists');
    assert.ok(libraryCombinedSource.indexOf('getLibraryDndHoverOpenMs') >= 0, 'library hover open delay preference exists');
    assert.ok(libraryCombinedSource.indexOf('closeSidebarAfterLibraryOpen') >= 0, 'mobile library closes after item open');
    assert.ok(shellSource.indexOf('소설 목록 닫기') >= 0, 'mobile library close button is labelled');
    const styleSource = [
      fs.readFileSync(path.join(ROOT, 'public', 'styles', 'app.css'), 'utf8'),
      fs.readFileSync(path.join(ROOT, 'public', 'styles', 'deferred-ui.css'), 'utf8')
    ].join('\n');
    assert.ok(styleSource.indexOf('mobile-library-overlay') >= 0, 'mobile library overlay css exists');
    assert.ok(styleSource.indexOf('library-move-picker-overlay') >= 0, 'library move picker css exists');
    assert.ok(styleSource.indexOf('#search-nav-remote:not(.has-custom-pos)') >= 0, 'search remocon default avoids bottom bar');
    assert.ok(shellSource.indexOf('open-safe-area-settings-btn') < 0, 'removed general safe-area shortcut stays absent');
    assert.ok(styleSource.indexOf('--safe-browser-top-extra') >= 0 && styleSource.indexOf('browser-fullscreen-fit::before') >= 0, 'browser fullscreen punch-hole matte css exists');
    const shellLoaderSource = fs.readFileSync(path.join(ROOT, 'public', 'scripts', 'rebuild', 'core', 'app-shell.mjs'), 'utf8');
    assert.ok(/app-shell\.html\?v=rebuild-v\d+/.test(shellLoaderSource) && shellLoaderSource.indexOf("cache: 'force-cache'") >= 0 && shellLoaderSource.indexOf("cache: 'no-cache'") < 0, 'app shell cache buster uses immutable browser cache');
    assert.ok(shellSource.indexOf('safe-viewport-template-btns') >= 0, 'safe-area recommendation template controls exist');
    assert.ok(shellSource.indexOf('safe-profile-advanced') >= 0 && shellSource.indexOf('<details class="safe-profile-box safe-profile-advanced"') >= 0, 'safe-area user presets are collapsed by default');
    const safeControlsSource = fs.readFileSync(path.join(ROOT, 'public', 'scripts', 'rebuild', 'features', 'settings', 'controls.mjs'), 'utf8');
    assert.ok(safeControlsSource.indexOf('applySafeTemplate') >= 0 && safeControlsSource.indexOf('getEffectiveSafeViewportPrefs') >= 0, 'safe-area profile template/reentry controls exist');

    console.log(JSON.stringify({
      ok: true,
      port: PORT,
      novels: novelList.length,
      firstNovel: first.title || first.fileName || first.id,
      episodeNovel: episodeNovel.title || episodeNovel.id,
      contentChars: content.body.content.length,
      manifestBlocks: manifest.body.totalBlocks,
      episodeManifestBlocks: episodeManifest.body.totalBlocks,
      recovery: true,
      recoveryPolicies: true,
      fontApi: true,
      customCss: true,
      shortcuts: true,
      serverCommPrefs: false,
      safeAreaPrefs: true,
      safeAreaProfiles: true,
      preprocessPresets: true,
      themeCustomThemes: true,
      readDataState: true,
      fontPrefs: true,
      deviceManager: true,
      fileopsFrontend: true,
      searchUx: true,
      searchOfflineCache: true,
      searchRetryChunks: true,
      libraryDnd: true,
      libraryDndConflicts: true,
      mobileLibraryDrawer: true,
      libraryMetaSummary: true,
      safeAreaMobileControls: true,
      appShellCacheBuster: true,
      versionedRebuildAssetCache: true,
      modulepreloadCachePolicyBoundary: modulepreloadCachePolicyBoundary,
      ownerSessionEntryRedirect: 'v441-owner-session-entry-redirect-smoke-pass',
      novelsConditionalCache: true,
      contentChunkConditionalCache: true,
      readerApiCacheHardening: 'v436-reader-api-cache-hardening-smoke-pass',
      readerApiColdWarmCache: readerApiColdWarmCache,
      cacheInvalidationContract: cacheInvalidationContract,
      blockManifestConditionalCache: true,
      searchRemoteDefaultSafe: true,
      safeAreaTemplates: true,
      safeAreaAdvancedCollapsed: true,
      searchSourceFilters: true,
      recoverySearchDiagnostics: true,
      readDataImportPreview: true,
      readDataRollbackRestore: true,
      readDataConflictDetails: true,
      mobileMovePicker: true,
      mobileDndFallback: true,
      libraryDndHoverDelayPrefs: true,
      searchCacheOnlyMode: true,
      searchChunkRetryButtons: true,
      recoveryOfflineActions: true,
      offlineSelectedChunks: true,
      fileops: fileops
    }, null, 2));
  } catch (error) {
    console.error('[smoke] failed:', error && error.stack || error);
    if (stdout) console.error('[smoke] server stdout:\n' + stdout.trim());
    if (stderr) console.error('[smoke] server stderr:\n' + stderr.trim());
    process.exitCode = 1;
  } finally {
    if (uploadedFont && cleanupCookie && cleanupCsrf) {
      try {
        await jsonFetch(BASE + '/api/fonts/' + encodeURIComponent(uploadedFont), {
          method: 'DELETE',
          headers: { cookie: cleanupCookie, 'x-csrf-token': cleanupCsrf }
        });
      } catch (e) {}
    }
    cleanupFileopsFixtures();
    try { fs.rmSync(isolatedDataDir, { recursive:true, force:true }); } catch (_) {}
    child.kill('SIGTERM');
    await sleep(250);
    if (child.exitCode == null) child.kill('SIGKILL');
  }
}

main();
