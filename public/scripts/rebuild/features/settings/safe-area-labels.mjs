export const SAFE_AREA_LABELS_PASS = 'v217-safe-area-labels-pass';

import { SAFE_POSITION_LABELS, SAFE_SLOT_LABELS } from './safe-area-constants.mjs';

export function formatSafeSlotLabel(slotName = '', position = 'auto') {
  const slotLabel = SAFE_SLOT_LABELS[slotName] || '상단 표시';
  const positionLabel = SAFE_POSITION_LABELS[position] || SAFE_POSITION_LABELS.auto;
  return `${slotLabel} · safe-area ${positionLabel} 슬롯`;
}

export function formatSafePositionOptionLabel(position = 'auto') {
  return SAFE_POSITION_LABELS[position] || SAFE_POSITION_LABELS.auto;
}
