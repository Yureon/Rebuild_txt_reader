const SHELL_URL = '/fragments/app-shell.html?v=rebuild-v564';
export const APP_SHELL_FORCE_CACHE_PASS = 'v457-app-shell-force-cache-smoke-pass';
let shellPromise = null;

export async function mountAppShell(profile) {
  if (document.getElementById('app')) return;
  if (!shellPromise) shellPromise = fetchShell();
  const html = await shellPromise;
  document.body.insertAdjacentHTML('afterbegin', html);
  const bootSkeleton = document.getElementById('boot-skeleton');
  if (bootSkeleton) bootSkeleton.remove();
  document.body.dataset.clientProfile = profile;
  document.body.classList.add(`reader-${profile}`);
}

async function fetchShell() {
  const res = await fetch(SHELL_URL, {
    credentials: 'same-origin',
    cache: 'force-cache',
    headers: { 'Accept': 'text/html' }
  });
  if (!res.ok) throw new Error(`앱 셸 로드 실패: ${res.status}`);
  const html = await res.text();
  if (!html.includes('id="app"')) throw new Error('앱 셸이 올바르지 않습니다.');
  return html;
}
