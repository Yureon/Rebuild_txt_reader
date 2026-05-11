#!/usr/bin/env node
const path = require('path');
const { pathToFileURL } = require('url');

const CUSTOM_CSS_SECURITY_SMOKE_PASS = 'v337-custom-css-security-smoke-pass';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertCssSanitized(label, output) {
  const css = String(output || '');
  assert(!/<\/?\s*(?:script|style)\b/i.test(css), label + ': html style/script tag survived');
  assert(!/[<>]/.test(css), label + ': raw html delimiter survived');
  assert(!/@import\b/i.test(css), label + ': @import survived');
  assert(!/javascript\s*:/i.test(css), label + ': javascript: survived');
  assert(!/vbscript\s*:/i.test(css), label + ': vbscript: survived');
  assert(!/url\(\s*https?:/i.test(css), label + ': external url survived');
  assert(!/expression\s*\(/i.test(css), label + ': expression() survived');
}

async function runCustomCssSecuritySmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const clientUtilsUrl = pathToFileURL(path.join(projectRoot, 'public/scripts/rebuild/features/settings/custom-css-utils.mjs')).href;
  const client = await import(clientUtilsUrl + '?smoke=' + Date.now());
  const server = require(path.join(projectRoot, 'server/services/custom-css-sanitizer.js'));
  const payload = `#reader{color:red}</style><script>alert(1)</script><style>@import url(https://evil.example/a.css);.x{background:url(javascript:alert(1));behavior:url(#x);width:expression(alert(1));}`;

  const clientResult = client.sanitizeCustomCss(payload);
  assert(clientResult && clientResult.pass === client.CUSTOM_CSS_SECURITY_PASS, 'client sanitizer pass marker mismatch');
  assert(clientResult.changed === true, 'client sanitizer did not report changed payload');
  assertCssSanitized('client sanitizer', clientResult.css);
  assert(clientResult.css.includes('#reader{color:red}'), 'client sanitizer removed safe rule');

  const serverResult = server.sanitizeCustomCss(payload);
  assert(serverResult && serverResult.pass === server.CUSTOM_CSS_SECURITY_PASS, 'server sanitizer pass marker mismatch');
  assert(serverResult.changed === true, 'server sanitizer did not report changed payload');
  assertCssSanitized('server sanitizer', serverResult.css);
  assert(serverResult.css.includes('#reader{color:red}'), 'server sanitizer removed safe rule');

  const safeCss = '#reader { color: var(--reader-text); } .reader p { margin: 0 0 1em; }';
  assert(client.normalizeCustomCss(safeCss) === safeCss, 'client sanitizer changed safe css unexpectedly');
  assert(server.normalizeCustomCss(safeCss) === safeCss, 'server sanitizer changed safe css unexpectedly');

  const truncated = client.normalizeCustomCss('a'.repeat(client.MAX_CSS_CHARS + 128));
  assert(truncated.length === client.MAX_CSS_CHARS, 'client sanitizer max length clamp failed');

  return { pass: CUSTOM_CSS_SECURITY_SMOKE_PASS };
}

if (require.main === module) {
  runCustomCssSecuritySmoke().then((result) => {
    console.log(JSON.stringify(result));
  }).catch((error) => {
    console.error(error && error.stack || error);
    process.exit(1);
  });
}

module.exports = {
  CUSTOM_CSS_SECURITY_SMOKE_PASS,
  runCustomCssSecuritySmoke
};
