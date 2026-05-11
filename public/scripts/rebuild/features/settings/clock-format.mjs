export function formatClockForPrefs(prefs = {}, now = new Date()) {
  const p = prefs || {};
  const hour12 = !!p.clockHour12;
  const showAmPm = !!p.clockAmPm;
  try {
    if (p.timezone === 'custom') return formatOffsetClock(now, Number(p.timezoneOffset) || 0, hour12, showAmPm);
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: p.timezone || 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12
    });
    let text = formatter.format(now).replace(/\s+/g, ' ').trim();
    if (!showAmPm && hour12) text = text.replace(/^(오전|오후)\s*/, '');
    return text;
  } catch {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}


function formatOffsetClock(now, offsetMinutes, hour12, showAmPm) {
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  const shifted = new Date(utc + offsetMinutes * 60_000);
  let hours = shifted.getHours();
  const minutes = String(shifted.getMinutes()).padStart(2, '0');
  if (!hour12) return `${String(hours).padStart(2, '0')}:${minutes}`;
  const isPm = hours >= 12;
  hours = hours % 12 || 12;
  const prefix = showAmPm ? `${isPm ? '오후' : '오전'} ` : '';
  return `${prefix}${hours}:${minutes}`;
}

