export const SAFE_TOP_MIN = -12;
export const SAFE_TOP_MAX = 180;
export const SAFE_BOTTOM_MIN = -12;
export const SAFE_BOTTOM_MAX = 240;
export const SAFE_PROFILE_LIMIT = 16;

export const SAFE_POSITION_STYLES = {
  left: { left: 'var(--safe-edge-pad,16px)', right: '', transform: 'none' },
  center: { left: '50%', right: '', transform: 'translateX(-50%)' },
  right: { left: '', right: 'var(--safe-edge-pad,16px)', transform: 'none' },
  'left-inner': { left: 'calc(var(--safe-edge-pad,16px) + var(--safe-inner-offset,84px))', right: '', transform: 'none' },
  'right-inner': { left: '', right: 'calc(var(--safe-edge-pad,16px) + var(--safe-inner-offset,84px))', transform: 'none' },
  auto: { left: '', right: 'calc(var(--safe-edge-pad,16px) + var(--safe-inner-offset,84px))', transform: 'none' }
};

export const SAFE_SLOT_LABELS = { clock: '시계', progress: '독서 진행률', network: '네트워크 상태' };
export const SAFE_POSITION_LABELS = { left: '왼쪽 외곽', center: '가운데', right: '오른쪽 외곽', 'left-inner': '왼쪽 안쪽', 'right-inner': '오른쪽 안쪽', auto: '자동 배치' };
