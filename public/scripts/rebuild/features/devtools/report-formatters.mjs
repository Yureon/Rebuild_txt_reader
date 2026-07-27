export const DEVTOOLS_REPORT_FORMATTERS_SPLIT_PASS = 'v195-devtools-report-formatters-split-pass';

export function pushHeader(lines, title) {
  lines.push(`## ${title}`);
}

export function appendSection(lines, title, rows) {
  lines.push('');
  lines.push(`### ${title}`);
  const safeRows = Array.isArray(rows) && rows.length ? rows : [row('-', '-', '표시할 데이터가 없습니다.')];
  safeRows.forEach(item => {
    lines.push(`- ${item.name}: ${item.value}`);
    lines.push(`  # ${item.comment}`);
  });
}

export function row(name, value, comment) {
  return { name, value: String(value ?? '-'), comment };
}

export function bool(value) { return value ? '켜짐/true' : '꺼짐/false'; }
export function number(value) { return Number.isFinite(Number(value)) ? String(Math.round(Number(value))) : '-'; }

export function formatTime(value) {
  try { return new Date(value).toLocaleString(); } catch { return String(value); }
}

export function mask(value) {
  const text = String(value || '');
  if (text.length <= 8) return text || '-';
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

export function summarizeObject(value) {
  if (!value || typeof value !== 'object') return '-';
  const keys = Object.keys(value);
  if (!keys.length) return '빈 객체';
  return keys.slice(0, 6).map(key => `${key}=${shortValue(value[key])}`).join(', ') + (keys.length > 6 ? ' …' : '');
}

export function shortValue(value) {
  if (value == null) return '-';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : '-';
  if (typeof value === 'string') return value.length > 28 ? `${value.slice(0, 25)}…` : value;
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'object') return `object(${Object.keys(value).length})`;
  return String(value);
}

export function summarizeConnection() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return '지원 안 함';
  return [`type=${connection.effectiveType || '-'}`, `downlink=${connection.downlink || '-'}`, `rtt=${connection.rtt || '-'}`].join(', ');
}

export function buildErrorRows(errors = []) {
  const list = Array.isArray(errors) ? errors.slice(-8) : [];
  if (!list.length) return [row('recentErrors', '0', '최근 오류가 없습니다.')];
  return list.map((item, index) => row(`error${index + 1}`, `${item.area || 'unknown'} · ${item.message || item.error || String(item)}`, '최근 오류 기록입니다. 마지막 8개만 표시합니다.'));
}
