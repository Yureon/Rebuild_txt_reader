#!/usr/bin/env node
const assert = require('assert');
const { buildContentSecurityPolicy, applySecurityHeaders } = require('../../server/middleware/security');

const headers = new Map();
const res = {
  setHeader(name, value) {
    headers.set(String(name).toLowerCase(), String(value));
  }
};
applySecurityHeaders({}, res, () => {});

assert.strictEqual(headers.get('x-content-type-options'), 'nosniff', 'nosniff header is required');
assert.strictEqual(headers.get('x-frame-options'), 'DENY', 'frame denial header is required');
assert.strictEqual(headers.get('origin-agent-cluster'), '?1', 'Origin-Agent-Cluster header is required');
assert.strictEqual(headers.get('x-dns-prefetch-control'), 'off', 'DNS prefetch must be disabled');
assert.strictEqual(headers.get('cross-origin-resource-policy'), 'same-origin', 'CORP must be same-origin');
assert.strictEqual(headers.get('cross-origin-opener-policy'), 'same-origin', 'COOP must be same-origin');
assert.strictEqual(headers.get('x-permitted-cross-domain-policies'), 'none', 'cross-domain policy header is required');

const csp = buildContentSecurityPolicy();
assert.ok(csp.includes("default-src 'self'"), 'CSP default-src self is required');
assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP frame-ancestors none is required');
assert.ok(csp.includes("object-src 'none'"), 'CSP object-src none is required');

console.log(JSON.stringify({ pass: 'v345-security-headers-smoke-pass' }));
