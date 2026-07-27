const fs = require('fs');
const path = require('path');
const { CURRENT_REBUILD_VERSION } = require('./current-rebuild-version.js');

const PWA_MANIFEST_SMOKE_PASS = 'v261-pwa-manifest-smoke-pass';
const PWA_MANIFEST_ID_SCOPE_PASS = 'v261-pwa-manifest-id-scope-pass';
const PWA_MANIFEST_ICON_PURPOSE_PASS = 'v261-pwa-manifest-icon-purpose-pass';
const PWA_MANIFEST_CACHE_BUST_LINK_PASS = 'v276-pwa-manifest-cache-bust-link-current-version-pass';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function runPwaManifestSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runPwaManifestSmoke requires projectRoot');
  const manifestPath = path.join(projectRoot, 'public', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  requireCondition(manifest.id === '/', 'PWA manifest id must be stable at /.');
  requireCondition(manifest.scope === '/', 'PWA manifest scope must remain /.');
  requireCondition(manifest.start_url === '/library.html', 'PWA manifest start_url must open /library.html.');
  requireCondition(manifest.display === 'standalone', 'PWA manifest display must remain standalone.');
  requireCondition(Array.isArray(manifest.display_override) && manifest.display_override.includes('standalone'), 'PWA manifest display_override must include standalone.');
  requireCondition(manifest.lang === 'ko-KR', 'PWA manifest lang must remain ko-KR.');
  requireCondition(manifest.theme_color === '#000000' && manifest.background_color === '#000000', 'PWA theme/background colors must match current entrypoint theme-color.');
  requireCondition(!('orientation' in manifest), 'PWA manifest must not lock orientation unless a runtime bug requires it.');
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const iconKeys = new Set(icons.map(icon => `${String(icon.src || '').split('?')[0]}|${icon.sizes}|${icon.purpose || ''}`));
  [
    '/icon/icon-192.png|192x192|any',
    '/icon/icon-512.png|512x512|any',
    '/icon/maskable-192.png|192x192|maskable',
    '/icon/maskable-512.png|512x512|maskable'
  ].forEach(key => requireCondition(iconKeys.has(key), 'PWA manifest missing icon: ' + key));
  icons.forEach((icon) => {
    const src = String(icon.src || '').split('?')[0].replace(/^\/+/, '');
    requireCondition(fs.existsSync(path.join(projectRoot, 'public', src)), 'PWA icon file missing: ' + icon.src);
  });
  requireCondition(Array.isArray(manifest.shortcuts) && manifest.shortcuts.some(item => item.url === '/library.html'), 'PWA manifest must keep a library launch shortcut.');
  const expectedManifestLink = `/manifest.json?v=${CURRENT_REBUILD_VERSION}`;
  const entrypoints = ['library.html', 'site.html', 'mobile.html', 'index.html'];
  entrypoints.forEach((entry) => {
    const html = fs.readFileSync(path.join(projectRoot, 'public', entry), 'utf8');
    requireCondition(html.includes(expectedManifestLink), `${entry} must use cache-busted ${CURRENT_REBUILD_VERSION} manifest link.`);
    requireCondition(html.includes('<meta name="theme-color" content="#000000">'), entry + ' must keep theme-color aligned with manifest.');
  });
  return {
    pass: PWA_MANIFEST_SMOKE_PASS,
    idScopePass: PWA_MANIFEST_ID_SCOPE_PASS,
    iconPurposePass: PWA_MANIFEST_ICON_PURPOSE_PASS,
    cacheBustLinkPass: PWA_MANIFEST_CACHE_BUST_LINK_PASS,
    iconCount: icons.length,
    shortcutCount: manifest.shortcuts.length
  };
}

module.exports = {
  PWA_MANIFEST_SMOKE_PASS,
  PWA_MANIFEST_ID_SCOPE_PASS,
  PWA_MANIFEST_ICON_PURPOSE_PASS,
  PWA_MANIFEST_CACHE_BUST_LINK_PASS,
  runPwaManifestSmoke
};
