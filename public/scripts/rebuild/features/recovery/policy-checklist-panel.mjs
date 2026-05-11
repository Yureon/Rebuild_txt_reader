import { createEl } from '../../core/utils.mjs';

export const RECOVERY_POLICY_CHECKLIST_RENDERER_REFACTOR_PASS = 'v166-recovery-policy-checklist-renderer-pass';

export const RECOVERY_CHECKLIST = [
  '1. 새 ZIP 기준으로 npm install --omit=dev 실행',
  '2. npm run smoke:server 실행',
  '3. 로그인 후 설정 > 고급 > 복구 센터 열기',
  '4. 내보내기 JSON 생성 및 가져오기 미리보기 확인',
  '5. 프리패치 정리/캐시 전체 정리 후 리더 재진입 확인',
  '6. 다른 기기 동기화 상태/원격 위치 dock 표시 확인',
  '7. 모바일에서 복구 센터 스크롤/닫기/기타 작업 메뉴 확인'
];

export function renderRecoveryPolicyPanel(serverStatus) {
  const policies = serverStatus?.recoveryPolicies || {
    importPreview: true,
    destructiveClientActionsRequireConfirm: true,
    sharedDeviceRestoreDefault: false,
    cacheClearScope: 'client-indexeddb-only'
  };
  const rows = Object.entries(policies).map(([key, value]) => createEl('div', { class:'recovery-policy-chip' }, [
    createEl('strong', { text:key }),
    createEl('span', { text:String(value) })
  ]));
  return createEl('section', { class:'recovery-section', dataset:{ recoverySection:'policy', recoveryPolicyChecklistRendererPass:RECOVERY_POLICY_CHECKLIST_RENDERER_REFACTOR_PASS } }, [
    createEl('div', { class:'recovery-section-title', text:'복구 정책' }),
    createEl('div', { class:'recovery-section-desc', text:'캐시 정리는 클라이언트 캐시에 한정하고, 서버 상태 원본 복원은 명시 선택과 확인을 요구합니다.' }),
    createEl('div', { class:'recovery-policy-grid' }, rows)
  ]);
}

export function renderRecoveryChecklistPanel(checklist = RECOVERY_CHECKLIST) {
  const items = Array.isArray(checklist) ? checklist : RECOVERY_CHECKLIST;
  return createEl('section', { class:'recovery-section recovery-checklist-panel', dataset:{ recoverySection:'checklist', recoveryPolicyChecklistRendererPass:RECOVERY_POLICY_CHECKLIST_RENDERER_REFACTOR_PASS } }, [
    createEl('div', { class:'recovery-section-title', text:'회귀 체크리스트' }),
    createEl('pre', { text: items.join('\n') })
  ]);
}
