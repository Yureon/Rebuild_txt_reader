const { ALLOW_CLOUDFLARE_INSIGHTS, ALLOW_BLOB_WORKER } = require('../config/env');

const CLOUDFLARE_INSIGHTS_INLINE_HASHES = [
  "'sha256-Mj7/TRLTvuMpz7mIIdCIuPY7e8bj9DfkSfnbSDMn80o='"
];

function buildContentSecurityPolicy(options = {}) {
  const allowCloudflareInsights = Object.prototype.hasOwnProperty.call(options, 'allowCloudflareInsights')
    ? !!options.allowCloudflareInsights
    : !!ALLOW_CLOUDFLARE_INSIGHTS;
  const allowBlobWorker = Object.prototype.hasOwnProperty.call(options, 'allowBlobWorker')
    ? !!options.allowBlobWorker
    : !!ALLOW_BLOB_WORKER;
  const scriptSrc = ["'self'"];
  const workerSrc = ["'self'"];
  const connectSrc = ["'self'"];
  if (allowCloudflareInsights) {
    scriptSrc.push('https://static.cloudflareinsights.com', ...CLOUDFLARE_INSIGHTS_INLINE_HASHES);
    connectSrc.push('https://static.cloudflareinsights.com', 'https://cloudflareinsights.com');
  }
  if (allowBlobWorker) workerSrc.push('blob:');

  return [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' https://fonts.googleapis.com",
    "style-src-elem 'self' https://fonts.googleapis.com",
    "style-src-attr 'none'",
    "font-src 'self' https://fonts.gstatic.com data:",
    "script-src " + scriptSrc.join(' '),
    "script-src-elem " + scriptSrc.join(' '),
    "worker-src " + workerSrc.join(' '),
    "connect-src " + connectSrc.join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join('; ');
}

function applySecurityHeaders(req, res, next) {
  const isProd = process.env.NODE_ENV === 'production';

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Origin-Agent-Cluster', '?1');
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  res.setHeader('Content-Security-Policy', buildContentSecurityPolicy());
  next();
}

module.exports = {
  CLOUDFLARE_INSIGHTS_INLINE_HASHES,
  buildContentSecurityPolicy,
  applySecurityHeaders
};
