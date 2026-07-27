export const SYNC_FORMATTERS_REFACTOR_PASS = 'v177-sync-formatters-pass';

export function formatDeviceName(device, fallback = '이름 없는 기기') {
  return String(device?.name || fallback || '이름 없는 기기').trim().slice(0, 60) || '이름 없는 기기';
}

export function shortDeviceId(id) {
  const text = String(id || '').trim();
  if (text.length <= 12) return text || '-';
  return `${text.slice(0, 6)}…${text.slice(-4)}`;
}

export function formatRelativeTime(ts) {
  const value = Number(ts) || 0;
  if (!value) return '-';
  const diff = Math.max(0, Date.now() - value);
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return new Date(value).toLocaleString();
}
