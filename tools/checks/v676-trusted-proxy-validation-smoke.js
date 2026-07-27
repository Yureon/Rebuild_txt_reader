#!/usr/bin/env node
'use strict';
const assert=require('assert');
const net=require('net');
const {getClientIp,firstHeaderIp}=require('../../server/services/rate-limit');
const {createTrustedProxyPredicate,DEFAULT_TRUSTED_PROXY_CIDRS}=require('../../server/services/trusted-proxy-policy');
assert.deepEqual(DEFAULT_TRUSTED_PROXY_CIDRS,['127.0.0.0/8','::1/128']);
const trust=createTrustedProxyPredicate('127.0.0.0/8,172.16.0.0/12,::1/128');
const req=(remoteAddress,headers={},ip=remoteAddress)=>({socket:{remoteAddress},headers,ip});
assert.equal(firstHeaderIp('not-an-ip, 9.9.9.9'),'9.9.9.9');
assert.equal(firstHeaderIp('bad,also-bad'),'');
assert.equal(getClientIp(req('172.20.0.5',{'cf-connecting-ip':'not-an-ip'}),{deploymentMode:'cloudflare-tunnel',isTrustedProxySource:trust}),'172.20.0.5');
assert.equal(getClientIp(req('172.20.0.5',{'cf-connecting-ip':'::ffff:1.2.3.4'}),{deploymentMode:'cloudflare-tunnel',isTrustedProxySource:trust}),'1.2.3.4');
assert.equal(getClientIp(req('203.0.113.4',{'cf-connecting-ip':'1.2.3.4'}),{deploymentMode:'cloudflare-tunnel',isTrustedProxySource:trust}),'203.0.113.4');
for(const value of ['127.0.0.1','::1']) assert(trust(value));
for(const value of ['not-an-ip','203.0.113.1']) assert(!trust(value));
assert.equal(net.isIP(getClientIp(req('127.0.0.1',{'x-real-ip':'bad, 8.8.8.8'}),{deploymentMode:'trusted-proxy',clientIpHeader:'x-real-ip',isTrustedProxySource:trust})),4);
console.log(JSON.stringify({pass:'v676-trusted-proxy-validation-smoke-pass',invalidHeaderRejected:true,defaultLoopbackOnly:true}));
