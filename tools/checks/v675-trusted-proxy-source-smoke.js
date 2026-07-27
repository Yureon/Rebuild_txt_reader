#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { getClientIp } = require('../../server/services/rate-limit');
const { createTrustedProxyPredicate } = require('../../server/services/trusted-proxy-policy');
const trust = createTrustedProxyPredicate('127.0.0.0/8,172.16.0.0/12,::1/128');
const req = (remoteAddress, headers = {}, ip = remoteAddress) => ({ socket:{ remoteAddress }, headers, ip });
assert.equal(getClientIp(req('203.0.113.10', { 'cf-connecting-ip':'1.2.3.4' }), { deploymentMode:'cloudflare-tunnel', isTrustedProxySource:trust }), '203.0.113.10');
assert.equal(getClientIp(req('172.20.0.5', { 'cf-connecting-ip':'1.2.3.4' }), { deploymentMode:'cloudflare-tunnel', isTrustedProxySource:trust }), '1.2.3.4');
assert.equal(getClientIp(req('198.51.100.9', { 'x-real-ip':'9.9.9.9' }), { deploymentMode:'trusted-proxy', clientIpHeader:'x-real-ip', isTrustedProxySource:trust }), '198.51.100.9');
assert.equal(getClientIp(req('127.0.0.1', { 'x-real-ip':'9.9.9.9' }), { deploymentMode:'trusted-proxy', clientIpHeader:'x-real-ip', isTrustedProxySource:trust }), '9.9.9.9');
console.log(JSON.stringify({ pass:'v675-trusted-proxy-source-smoke-pass', untrustedHeaderIgnored:true, trustedHeaderAccepted:true, cidrs:trust.cidrs }));
