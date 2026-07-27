export const RECOVERY_NAVIGATION_REFACTOR_PASS = 'v168-recovery-navigation-helper-pass';
export const RECOVERY_CENTER_GENERAL_DEV_NAV_PASS = 'v421-recovery-center-general-dev-nav-pass';

function getRecoveryFocusMeta(focus) {
  const map = {
    summary: { title: '복구 센터 · 일반 복구', desc: '일반 복구는 요약, 캐시, 검색만 표시하고 개발자 진단은 분리합니다.' },
    'reader-manual-diagnostics': { title: '복구 센터 · 개발자 진단 · 수동', desc: '개발자 진단 영역에서 PC/모바일 스크롤 체감 기록 도구를 표시합니다.' },
    diagnostics: { title: '복구 센터 · 개발자 진단 · 원본', desc: '개발자 진단 영역에서 Reader/cache/virtual/search 원본 진단을 확인합니다.' },
    'cache-management': { title: '복구 센터 · 캐시 관리', desc: 'IndexedDB reader cache dry-run, 작품별 삭제, 보호 반경을 관리합니다.' },
    'search-coverage': { title: '복구 센터 · 검색 진단', desc: '검색 coverage, cache-only 후보, 누락 chunk 저장/삭제 흐름을 점검합니다.' },
    policy: { title: '복구 센터 · 개발자 진단 · 정책', desc: '서버/클라이언트 복구 정책과 안전 경계를 확인합니다.' }
  };
  return map[String(focus || 'summary')] || map.summary;
}

export function setRecoveryCenterRouteContext(app, focus = 'summary') {
  const route = String(focus || 'summary');
  const meta = getRecoveryFocusMeta(route);
  const title = document.getElementById('recovery-center-title');
  const desc = document.getElementById('recovery-center-desc');
  if (title) title.textContent = meta.title;
  if (desc) desc.textContent = meta.desc;
  const navButtons = Array.from(app?.els?.recoveryCenterModal?.querySelectorAll?.('[data-recovery-jump]') || []);
  navButtons.forEach((btn) => {
    const active = btn.dataset.recoveryJump === route;
    btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current', 'true');
    else btn.removeAttribute('aria-current');
  });
}

export function focusRecoveryTarget(app, options = {}) {
  const focus = String(options?.focus || '');
  if (!focus) return;
  setRecoveryCenterRouteContext(app, focus);
  window.setTimeout(() => {
    const body = app?.els?.recoveryCenterBody || document;
    const selectorMap = {
      summary: '[data-recovery-section="summary"]',
      'reader-manual-diagnostics': '[data-recovery-section="reader-manual-diagnostics"]',
      diagnostics: '[data-recovery-section="diagnostics"]',
      'cache-management': '[data-recovery-section="cache-management"]',
      'search-coverage': '[data-recovery-section="search-coverage"]',
      policy: '[data-recovery-section="policy"]'
    };
    const safeFocus = focus.replace(/[^a-z0-9_-]/gi, '');
    let target = body?.querySelector?.(selectorMap[focus] || '[data-recovery-section="' + safeFocus + '"]');
    if (!target && focus === 'reader-manual-diagnostics') target = app?.els?.recoveryCenterModal?.querySelector?.('[data-recovery-section="reader-manual-diagnostics"]') || null;
    if (!target) return;
    const details = target.closest?.('details');
    if (details && !details.open) details.open = true;
    const navDetails = app?.els?.recoveryCenterModal?.querySelector?.('.recovery-center-nav-more');
    const activeNavButton = Array.from(app?.els?.recoveryCenterModal?.querySelectorAll?.('[data-recovery-jump]') || []).find(btn => btn.dataset.recoveryJump === focus);
    if (navDetails && activeNavButton && navDetails.contains?.(activeNavButton)) navDetails.open = true;
    target.setAttribute?.('tabindex', '-1');
    const behavior = options?.instant ? 'auto' : 'smooth';
    if (body && body !== document && typeof body.scrollTo === 'function' && body.contains?.(target)) {
      const bodyRect = body.getBoundingClientRect?.();
      const targetRect = target.getBoundingClientRect?.();
      const offset = bodyRect && targetRect
        ? Math.max(0, body.scrollTop + targetRect.top - bodyRect.top - 8)
        : Math.max(0, target.offsetTop - 8);
      body.scrollTo({ top: offset, behavior });
    } else {
      target.scrollIntoView?.({ block: 'start', behavior });
    }
    target.focus?.({ preventScroll: true });
    target.classList?.add?.('recovery-section-focus-flash');
    window.setTimeout(() => target.classList?.remove?.('recovery-section-focus-flash'), 1400);
  }, 80);
}

