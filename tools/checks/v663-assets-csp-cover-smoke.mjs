#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const publicRoot = path.join(root, 'public');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const walk = dir => fs.readdirSync(dir, { withFileTypes:true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});
const relPublic = full => path.relative(publicRoot, full).replace(/\\/g, '/');
const virtualPublicAssets = new Map([
  ['service-worker-register.js', 'scripts/service-worker-register.js'],
  ['favicon.ico', 'icon/favicon.ico'],
  ['apple-touch-icon.png', 'icon/apple-icon-180x180.png'],
  ['apple-touch-icon-precomposed.png', 'icon/apple-icon-180x180.png']
]);
const existsPublic = rel => {
  const normalized = String(rel || '').replace(/^\/+/, '');
  if (/^sw-rebuild-v\d+\.js$/.test(normalized)) return fs.existsSync(path.join(publicRoot, 'sw.js'));
  const mapped = virtualPublicAssets.get(normalized) || normalized;
  return fs.existsSync(path.join(publicRoot, mapped));
};
const require = createRequire(import.meta.url);
const { buildContentSecurityPolicy, CLOUDFLARE_INSIGHTS_INLINE_HASHES } = require('../../server/middleware/security.js');

// CSP: strict by default, Cloudflare telemetry is explicit opt-in and never enables unsafe-inline.
const defaultCsp = buildContentSecurityPolicy({ allowCloudflareInsights:false });
const insightsCsp = buildContentSecurityPolicy({ allowCloudflareInsights:true });
assert(!defaultCsp.includes('static.cloudflareinsights.com'));
assert(insightsCsp.includes('https://static.cloudflareinsights.com'));
assert(insightsCsp.includes('https://cloudflareinsights.com'));
for (const hash of CLOUDFLARE_INSIGHTS_INLINE_HASHES) assert(insightsCsp.includes(hash));
assert(!/script-src[^;]*'unsafe-inline'/.test(insightsCsp));
assert(!/style-src[^;]*'unsafe-inline'/.test(insightsCsp));

// Shipped pages do not contain the Cloudflare-injected beacon or any executable inline block.
const libraryLines = read('public/library.html').split(/\r?\n/);
assert(!String(libraryLines[57] || '').includes('<script'), 'library.html line 58 must not contain project inline script');

// Custom fonts must avoid CSP-blocked <style> text insertion.
const fonts = read('public/scripts/rebuild/features/settings/fonts.mjs');
assert(!fonts.includes("document.createElement('style')"));
assert(!fonts.includes('style.textContent'));
assert(fonts.includes('new FontFace('));
assert(fonts.includes('document.fonts.add(face)'));
assert(fonts.includes('new CSSStyleSheet()'));
assert(fonts.includes("parsed.pathname.startsWith('/api/fonts/file/')"));

// Runtime binary assets are streamed without application redirects and expose diagnostic headers.
const metadataRoutes = read('server/routes/metadata-routes.js');
const coverStart = metadataRoutes.indexOf("router.get('/metadata/covers/:assetId'");
const coverRoute = metadataRoutes.slice(coverStart, metadataRoutes.indexOf('\n\n  return router;', coverStart));
assert(coverStart >= 0);
assert(coverRoute.includes('coverService.openAssetForRead') && coverRoute.includes('opened.handle.createReadStream'));
assert(/X-Txt-Reader-Asset', 'metadata-cover-v677-nofollow'/.test(coverRoute));
assert(coverRoute.includes("res.setHeader('Content-Length'"));
assert(!coverRoute.includes('res.redirect'));
assert(!coverRoute.includes('res.sendFile(asset.filePath)'));

const fontRoutes = read('server/routes/font-routes.js');
const fontStart = fontRoutes.indexOf("router.get('/fonts/file/:filename'");
const fontRoute = fontRoutes.slice(fontStart, fontRoutes.indexOf('\n  });\n  return router;', fontStart) + 6);
assert(fontStart >= 0);
assert(fontRoute.includes('fontFile.handle?.createReadStream') && fontRoute.includes('autoClose:false'));
assert(/X-Txt-Reader-Asset', 'user-font-v\d+'/.test(fontRoute));
assert(fontRoute.includes("res.setHeader('Content-Length'"));
assert(!fontRoute.includes('res.redirect'));
assert(!fontRoute.includes('res.sendFile(fontFile.filePath)'));

for (const rel of [
  'public/scripts/rebuild/core/utils.mjs',
  'public/scripts/rebuild/features/library-shelf-runtime.mjs',
  'public/scripts/rebuild/features/library-metadata-runtime.mjs',
  'public/scripts/rebuild/metadata-page.mjs'
]) {
  const source = read(rel);
  assert(source.includes('installImageFallback'), `${rel} missing image fallback wiring`);
}

const allPublicFiles = walk(publicRoot);
const htmlFiles = allPublicFiles.filter(file => file.endsWith('.html'));
const cssFiles = allPublicFiles.filter(file => file.endsWith('.css'));
const moduleFiles = allPublicFiles.filter(file => /\.(?:mjs|js)$/.test(file));
let localRefs = 0;
let externalRefs = 0;
for (const full of htmlFiles) {
  const rel = `public/${relPublic(full)}`;
  const source = fs.readFileSync(full, 'utf8');
  assert(!/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(source), `${rel} contains inline script`);
  assert(!/<style\b[^>]*>[\s\S]*?\S[\s\S]*?<\/style>/i.test(source), `${rel} contains inline style block`);
  assert(!/static\.cloudflareinsights\.com/i.test(source), `${rel} must not ship a Cloudflare-injected beacon`);
  const dir = path.posix.dirname(relPublic(full));
  for (const match of source.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
    let url = match[1].trim();
    if (!url || /^(?:data:|blob:|mailto:|#)/i.test(url)) continue;
    if (/^https?:/i.test(url)) { externalRefs += 1; continue; }
    url = url.split(/[?#]/)[0];
    if (!url || url === '/') continue;
    const target = url.startsWith('/') ? url.slice(1) : path.posix.normalize(path.posix.join(dir, url));
    assert(existsPublic(target), `${rel} references missing public asset ${url}`);
    localRefs += 1;
  }
}

let cssRefs = 0;
for (const full of cssFiles) {
  const rel = `public/${relPublic(full)}`;
  const source = fs.readFileSync(full, 'utf8');
  const dir = path.posix.dirname(relPublic(full));
  for (const match of source.matchAll(/(?:url\(|@import\s+)(?:["']?)([^)"';\s]+)(?:["']?\)?)/gi)) {
    let url = match[1].trim();
    if (!url || /^(?:https?:|data:|blob:|#)/i.test(url)) continue;
    url = url.split(/[?#]/)[0];
    const target = url.startsWith('/') ? url.slice(1) : path.posix.normalize(path.posix.join(dir, url));
    assert(existsPublic(target), `${rel} references missing asset ${url}`);
    cssRefs += 1;
  }
}

// Resolve static and literal dynamic ESM imports across the full public tree.
let moduleImports = 0;
for (const full of moduleFiles) {
  const source = fs.readFileSync(full, 'utf8');
  const baseDir = path.dirname(full);
  const specs = [];
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)["']([^"']+)["']/g)) specs.push(match[1]);
  for (const match of source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) specs.push(match[1]);
  for (const spec of specs) {
    if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
    const clean = spec.split(/[?#]/)[0];
    const target = clean.startsWith('/') ? path.join(publicRoot, clean.replace(/^\/+/, '')) : path.resolve(baseDir, clean);
    assert(target === publicRoot || target.startsWith(publicRoot + path.sep), `${relPublic(full)} import escapes public root: ${spec}`);
    assert(fs.existsSync(target), `${relPublic(full)} imports missing module ${spec}`);
    moduleImports += 1;
  }
}

const manifest = JSON.parse(read('public/manifest.json'));
for (const icon of manifest.icons || []) {
  const target = String(icon.src || '').split(/[?#]/)[0];
  assert(existsPublic(target), `manifest icon missing: ${target}`);
  const stat = fs.statSync(path.join(publicRoot, target.replace(/^\/+/, '')));
  assert(stat.size > 0, `manifest icon empty: ${target}`);
}

const sw = read('public/sw.js');
let swRefs = 0;
for (const match of sw.matchAll(/["'`]\/?([^"'`?]+\.(?:html|css|png|json))(?:\?[^"'`]*)?["'`]/g)) {
  const target = match[1];
  if (target.startsWith('__txt_reader_')) continue;
  assert(existsPublic(target), `service worker references missing asset ${target}`);
  swRefs += 1;
}

assert(read('server/services/metadata-cover-service.js').includes('`/api/metadata/covers/${assetId}`'));
assert(read('server/services/metadata-store-service.js').includes('`/api/metadata/covers/${rawCoverAssetId}`'));
assert(read('.env.example').includes('ALLOW_CLOUDFLARE_INSIGHTS=0'));
assert(read('docs/proxy-tunnel-setup.md').includes('| Force SSL | OFF |'));

console.log(JSON.stringify({
  pass:'v663-assets-csp-cover-smoke-pass',
  publicFiles:allPublicFiles.length,
  htmlFiles:htmlFiles.length,
  cssFiles:cssFiles.length,
  moduleFiles:moduleFiles.length,
  localRefs,
  externalRefs,
  cssRefs,
  moduleImports,
  manifestIcons:(manifest.icons || []).length,
  swRefs
}));
