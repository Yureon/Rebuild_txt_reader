const SHELL_URLS = Object.freeze({
  library: '/fragments/library-shell.html?v=rebuild-v682',
  site: '/fragments/app-shell.html?v=rebuild-v682',
  mobile: '/fragments/app-shell.html?v=rebuild-v682'
});
export const APP_SHELL_FORCE_CACHE_PASS = 'v457-app-shell-force-cache-smoke-pass';
export const APP_SHELL_PERFORMANCE_PASS = 'v569-app-shell-performance-pass';
export const PROFILE_SHELL_ISOLATION_PASS = 'v668-profile-shell-isolation-pass';
const shellPromises = new Map();

function normalizeShellProfile(profile) {
  return String(profile || '').trim().toLowerCase() === 'library' ? 'library' : 'reader';
}

function shellUrlForProfile(profile) {
  const normalized = String(profile || '').trim().toLowerCase();
  return SHELL_URLS[normalized] || SHELL_URLS.site;
}

export async function mountAppShell(profile) {
  if (document.getElementById('app')) return;
  const normalizedProfile = String(profile || '').trim().toLowerCase() || 'site';
  const shellProfile = normalizeShellProfile(normalizedProfile);
  const shellUrl = shellUrlForProfile(normalizedProfile);
  const startedAt = globalThis.performance?.now?.() ?? Date.now();
  document.body.dataset.clientProfile = normalizedProfile;
  document.body.dataset.shellProfile = shellProfile;
  document.body.classList.add(`reader-${normalizedProfile}`);
  if (!shellPromises.has(shellUrl)) shellPromises.set(shellUrl, fetchShell(shellUrl, shellProfile));
  const html = await shellPromises.get(shellUrl);
  if (shellProfile === 'library') {
    document.querySelectorAll('#boot-skeleton .app-skeleton-main, #boot-skeleton .reader-skeleton-block, #boot-skeleton .reader-skeleton-paper, #loading, #reader').forEach(node => node.remove());
    document.documentElement.dataset.libraryEntrySkeletonPass = 'v675-library-entry-skeleton-pass';
  }
  document.body.insertAdjacentHTML('afterbegin', html);
  const bootSkeleton = document.getElementById('boot-skeleton');
  if (bootSkeleton) bootSkeleton.remove();
  document.documentElement.dataset.profileShellIsolationPass = PROFILE_SHELL_ISOLATION_PASS;
  const endedAt = globalThis.performance?.now?.() ?? Date.now();
  const perf = globalThis.__TXT_READER_PERF__ ||= { version:'rebuild-v682', phases:{}, resources:{}, longTasks:[] };
  perf.resources.appShell = {
    pass:APP_SHELL_PERFORMANCE_PASS,
    isolationPass:PROFILE_SHELL_ISOLATION_PASS,
    profile:shellProfile,
    durationMs:Math.max(0, endedAt - startedAt),
    bytes:new Blob([html]).size,
    href:shellUrl
  };
}

async function fetchShell(shellUrl, shellProfile) {
  const res = await fetch(shellUrl, {
    credentials: 'same-origin',
    cache: 'force-cache',
    headers: { 'Accept': 'text/html' }
  });
  if (!res.ok) throw new Error(`앱 셸 로드 실패: ${res.status}`);
  const html = await res.text();
  if (!html.includes('id="app"')) throw new Error('앱 셸이 올바르지 않습니다.');
  if (shellProfile === 'library') {
    if (!html.includes('data-library-shell-isolation-pass="v668-library-shell-isolation-pass"')) {
      throw new Error('서재 셸 버전이 올바르지 않습니다.');
    }
    if (/\bid="(?:main|loading|reader|toolbar|chunk-jumper-panel)"/.test(html) || html.includes('reader-load-skeleton')) {
      throw new Error('서재 셸에 Reader 전용 DOM이 포함되어 있습니다.');
    }
  } else if (!html.includes('id="main"') || !html.includes('id="reader"')) {
    throw new Error('Reader 셸이 올바르지 않습니다.');
  }
  return html;
}
