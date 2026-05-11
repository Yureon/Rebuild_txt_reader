export const SETTINGS_CUSTOM_CSS_UTILS_PASS = 'v215-settings-custom-css-utils-pass';
export const CUSTOM_CSS_SECURITY_PASS = 'v337-custom-css-security-pass';

const BLOCKED_CSS_COMMENT = '/* txt-reader blocked unsafe custom css */';
const ACTIVE_URL_SCHEME_RE = /^(?:javascript|vbscript|file|data:text\/html|data:application\/(?:xhtml\+xml|xml))/i;
const CSS_ESCAPE_RE = /\\([0-9a-fA-F]{1,6}\s?|.)/g;

export const CUSTOM_CSS_SCOPE_LABELS = {
  shared: '공유 CSS를 편집합니다. 모든 기기에 동기화됩니다.',
  device: '기기 CSS를 편집합니다. 이 브라우저/기기에서만 적용됩니다.',
  all: '공유 CSS와 기기 CSS를 합친 보기 전용 미리보기입니다.'
};

export const MAX_CSS_CHARS = 80_000;

function decodeCssEscapes(value) {
  return String(value || '').replace(CSS_ESCAPE_RE, (_match, token) => {
    const hex = String(token || '').trim();
    if (/^[0-9a-fA-F]{1,6}$/.test(hex)) {
      const code = parseInt(hex, 16);
      if (Number.isFinite(code) && code > 0) return String.fromCodePoint(code);
    }
    return String(token || '').slice(0, 1);
  });
}

function sanitizeCssUrlTokens(css, reasons) {
  return String(css || '').replace(/url\(\s*(?:(['"])([\s\S]*?)\1|([^)]*?))\s*\)/gi, (match, _quote, quotedValue, bareValue) => {
    const rawValue = quotedValue == null ? bareValue : quotedValue;
    const decoded = decodeCssEscapes(rawValue).trim().replace(/[\u0000-\u001F\u007F]/g, '');
    const compact = decoded.replace(/\s+/g, '');
    const lower = compact.toLowerCase();
    if (!decoded) return 'url("")';
    if (ACTIVE_URL_SCHEME_RE.test(lower) || lower.startsWith('//')) {
      reasons.add('blocked-url-scheme');
      return BLOCKED_CSS_COMMENT;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(compact)) {
      reasons.add('external-url');
      return BLOCKED_CSS_COMMENT;
    }
    if (/[<>]/.test(decoded)) {
      reasons.add('html-delimiter-in-url');
      return BLOCKED_CSS_COMMENT;
    }
    return match;
  });
}

/**
 * CSS 인젝션 방어: HTML/script/style 탈출, @import, active URL,
 * expression(), legacy active CSS를 서버 sanitizer와 동일한 정책으로 차단합니다.
 */
export function sanitizeCustomCss(value) {
  const reasons = new Set();
  const original = String(value || '');
  let css = original.slice(0, MAX_CSS_CHARS);

  if (/\u0000/.test(css)) reasons.add('nul-byte');
  css = css.replace(/\u0000/g, '');

  css = css.replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, () => {
    reasons.add('html-block');
    return BLOCKED_CSS_COMMENT;
  });

  css = css.replace(/<\/?\s*(?:script|style|iframe|object|embed|link|meta|base|svg|math|img|video|audio|source|form|input|button|textarea|select|option)\b[^>]*>/gi, () => {
    reasons.add('html-tag');
    return BLOCKED_CSS_COMMENT;
  });

  css = css.replace(/<!--|-->/g, () => {
    reasons.add('html-comment');
    return '';
  });

  css = css.replace(/@import\b[^;{}]*(?:;|$)/gi, () => {
    reasons.add('css-import');
    return BLOCKED_CSS_COMMENT;
  });

  css = sanitizeCssUrlTokens(css, reasons);

  css = css.replace(/(?:javascript|vbscript)\s*:/gi, () => {
    reasons.add('active-url-scheme');
    return '';
  });

  css = css.replace(/\bexpression\s*\(/gi, () => {
    reasons.add('css-expression');
    return '/* blocked expression */(';
  });

  css = css.replace(/(?:-moz-binding|behavior)\s*:/gi, () => {
    reasons.add('legacy-active-css');
    return '/* blocked legacy css */:';
  });

  css = css.replace(/[<>]/g, () => {
    reasons.add('html-delimiter');
    return '';
  });

  if (css.length > MAX_CSS_CHARS) css = css.slice(0, MAX_CSS_CHARS);

  return {
    css,
    changed: css !== original,
    blockedReasons: Array.from(reasons).sort(),
    pass: CUSTOM_CSS_SECURITY_PASS
  };
}

export function normalizeCustomCss(value) {
  const raw = String(value || '');
  const clamped = raw.length > MAX_CSS_CHARS ? raw.slice(0, MAX_CSS_CHARS) : raw;
  return sanitizeCustomCss(clamped).css;
}

export function buildCustomCssText({ shared = '', device = '' } = {}) {
  const sharedCss = normalizeCustomCss(shared);
  const deviceCss = normalizeCustomCss(device);
  return [
    sharedCss ? `/* txt-reader shared custom css */\n${sharedCss}` : '',
    deviceCss ? `/* txt-reader device custom css */\n${deviceCss}` : ''
  ].filter(Boolean).join('\n\n');
}

export function buildCustomCssEditorState({ scope = 'shared', shared = '', device = '' } = {}) {
  if (scope === 'all') {
    return {
      value: [shared || '', device || ''].filter(Boolean).join('\n\n/* --- device override --- */\n\n'),
      readOnly: true,
      placeholder: '공유 CSS와 기기 CSS를 합친 미리보기입니다. 편집하려면 공유 또는 기기 탭을 선택하세요.',
      applyText: '보기 전용',
      applyDisabled: true
    };
  }
  if (scope === 'device') {
    return {
      value: device || '',
      readOnly: false,
      placeholder: '이 기기에만 적용할 CSS를 입력하세요.',
      applyText: '적용',
      applyDisabled: false
    };
  }
  return {
    value: shared || '',
    readOnly: false,
    placeholder: '모든 기기에 적용할 CSS를 입력하세요.',
    applyText: '적용',
    applyDisabled: false
  };
}
