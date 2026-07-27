import { CURRENT_BUILD_ID } from '../../version.mjs';
import { downloadTextFile } from '../../core/utils.mjs';
import { toast } from '../ui.mjs';

export const RECOVERY_EXPORT_UTILS_VERSION = CURRENT_BUILD_ID;
export const RECOVERY_EXPORT_UTILS_EXTRACTION_PASS = 'v161-recovery-export-utils-extraction-pass';

export function buildRecoveryExportFilename(label = 'recovery-json', ext = 'json') {
  const safe = String(label || 'recovery-json')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'recovery-json';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `txt-reader-${safe}-${stamp}.${ext || 'json'}`;
}

export function stringifyRecoveryJsonPayload(payload, spacing = 2) {
  return JSON.stringify(payload ?? null, null, spacing);
}

export function downloadRecoveryJsonFile(filename = 'txt-reader-rebuild-recovery.json', payload = null) {
  downloadTextFile(filename, stringifyRecoveryJsonPayload(payload), 'application/json');
}

export async function copyRecoveryTextWithFallback(app, text, options = {}) {
  const value = String(text ?? '');
  const mime = options.mime || 'application/json';
  const fallbackFilename = options.fallbackFilename || buildRecoveryExportFilename(options.label || 'recovery-json', mime === 'text/plain' ? 'txt' : 'json');
  let lastError = null;

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return { mode:'clipboard', fallback:false };
    } catch (error) {
      lastError = error;
    }
  }

  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    area.style.top = '0';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, area.value.length);
    const copied = document.execCommand && document.execCommand('copy');
    area.remove();
    if (copied) return { mode:'legacy-clipboard', fallback:false };
  } catch (error) {
    lastError = error;
  }

  try {
    downloadTextFile(fallbackFilename, value, mime);
    toast(app, 'info', 'JSON 파일로 저장', '브라우저 클립보드 권한이 없어 JSON을 파일로 저장했습니다. HTTP/IP 접속에서는 이 fallback이 정상 동작입니다.');
    return { mode:'download', fallback:true, error:lastError?.message || String(lastError || '') };
  } catch (downloadError) {
    const reason = downloadError?.message || lastError?.message || String(downloadError || lastError || 'clipboard unavailable');
    throw new Error(reason);
  }
}

export async function exportRecoveryJsonPayload(app, payload, options = {}) {
  return copyRecoveryTextWithFallback(app, stringifyRecoveryJsonPayload(payload), {
    label: options.label || 'recovery-json',
    fallbackFilename: options.fallbackFilename || buildRecoveryExportFilename(options.label || 'recovery-json', 'json'),
    mime: 'application/json'
  });
}
