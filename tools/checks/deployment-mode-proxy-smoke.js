#!/usr/bin/env node
const assert = require('assert');
const { getClientIp } = require('../../server/services/rate-limit');
const { normalizeDeploymentMode, resolveTrustProxyValue } = require('../../server/config/env');

const PASS = 'v342-deployment-mode-proxy-smoke-pass';

assert.strictEqual(normalizeDeploymentMode('direct'), 'direct');
assert.strictEqual(normalizeDeploymentMode('trusted-proxy'), 'trusted-proxy');
assert.strictEqual(normalizeDeploymentMode('cloudflare-tunnel'), 'cloudflare-tunnel');
assert.strictEqual(normalizeDeploymentMode('unknown'), 'direct');
assert.strictEqual(resolveTrustProxyValue('direct'), false, 'direct mode should not trust proxy by default');
assert.strictEqual(resolveTrustProxyValue('trusted-proxy'), 1, 'trusted-proxy should trust one proxy hop by default');
assert.strictEqual(resolveTrustProxyValue('cloudflare-tunnel'), 1, 'cloudflare-tunnel should trust one proxy hop by default');

const req = {
  ip: '198.51.100.7',
  headers: {
    'x-forwarded-for': '203.0.113.10, 10.0.0.2',
    'cf-connecting-ip': '203.0.113.20',
    'x-real-ip': '203.0.113.30'
  },
  socket: { remoteAddress: '10.0.0.5' }
};

assert.strictEqual(getClientIp(req, { deploymentMode: 'direct' }), '10.0.0.5', 'direct mode must ignore forwarding headers');
assert.strictEqual(getClientIp(req, { deploymentMode: 'trusted-proxy' }), '198.51.100.7', 'trusted-proxy should use Express req.ip');
assert.strictEqual(getClientIp(req, { deploymentMode: 'trusted-proxy', clientIpHeader: 'x-real-ip' }), '203.0.113.30', 'trusted-proxy may use explicit CLIENT_IP_HEADER');
assert.strictEqual(getClientIp(req, { deploymentMode: 'cloudflare-tunnel' }), '203.0.113.20', 'cloudflare-tunnel should prefer CF-Connecting-IP');

console.log(JSON.stringify({ pass: PASS }));
