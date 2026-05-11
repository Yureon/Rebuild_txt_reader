const CUSTOM_CSS_SECURITY_PASS = 'v337-custom-css-security-pass';
const MAX_CUSTOM_CSS_CHARS = 80 * 1024;
const BLOCKED_CSS_COMMENT = '/* txt-reader blocked unsafe custom css */';
const ACTIVE_URL_SCHEME_RE = /^(?:javascript|vbscript|file|data:text\/html|data:application\/(?:xhtml\+xml|xml))/i;
const CSS_ESCAPE_RE = /\\([0-9a-fA-F]{1,6}\s?|.)/g;

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

function sanitizeCustomCss(value) {
  const reasons = new Set();
  let css = String(value || '').slice(0, MAX_CUSTOM_CSS_CHARS);

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

  if (css.length > MAX_CUSTOM_CSS_CHARS) css = css.slice(0, MAX_CUSTOM_CSS_CHARS);

  return {
    css,
    changed: css !== String(value || ''),
    blockedReasons: Array.from(reasons).sort(),
    pass: CUSTOM_CSS_SECURITY_PASS
  };
}

function normalizeCustomCss(value) {
  return sanitizeCustomCss(value).css;
}

module.exports = {
  CUSTOM_CSS_SECURITY_PASS,
  MAX_CUSTOM_CSS_CHARS,
  sanitizeCustomCss,
  normalizeCustomCss
};
