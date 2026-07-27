#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '../..');
const transportSource = fs.readFileSync(path.join(root, 'server/services/metadata-transport-service.js'), 'utf8');
const policySource = fs.readFileSync(path.join(root, 'server/services/network-address-policy.js'), 'utf8');
assert(transportSource.includes("v622-metadata-transport-security-pass"), 'current transport marker must be checked before optional runtime dependencies load');
assert(transportSource.includes("require('./network-address-policy')"), 'transport must use shared address policy');
assert(policySource.includes('ff00::') && policySource.includes('fec0::'), 'IPv6 multicast and site-local CIDRs must be explicit');

const { isPublicAddress } = require('../../server/services/network-address-policy');
assert.equal(isPublicAddress('8.8.8.8'), true);
for (const ip of [
  '127.0.0.1','10.0.0.1','192.168.1.1','169.254.1.1','::1','fc00::1','2001:db8::1',
  '::ffff:7f00:1','::7f00:1','ff02::1','fec0::1'
]) assert.equal(isPublicAddress(ip), false, ip);

let iconv;
try { iconv = require('iconv-lite'); }
catch (error) {
  console.log(JSON.stringify({ partialPass:'v622-metadata-transport-security-smoke-pass', staticAssertions:true, blockedDependency:'iconv-lite' }));
  process.exit(77);
}
const {
  createMetadataTransportService,
  validateUrlForProvider,
  decodeResponseBody
} = require('../../server/services/metadata-transport-service');
const { getMetadataProvider } = require('../../server/services/metadata-provider-registry');

const naver = getMetadataProvider('builtin-naver-series');
const kakao = getMetadataProvider('builtin-kakaopage');
const munpia = getMetadataProvider('builtin-munpia');
assert(naver && kakao && munpia);
assert.equal(validateUrlForProvider(naver, 'https://series.naver.com/novel/detail.series?productNo=1').hostname, 'series.naver.com');
assert.equal(validateUrlForProvider(munpia, 'https://novel.munpia.com/900002').pathname, '/900002');
assert.equal(validateUrlForProvider(munpia, 'https://www.munpia.com/search?query=test').pathname, '/search');
assert.equal(validateUrlForProvider(munpia, 'https://www.munpia.com/novel/detail/900002').pathname, '/novel/detail/900002');
assert.equal(validateUrlForProvider(kakao, 'https://page-images.kakaoentcdn.com/download/resource?kid=x', 'cover').hostname, 'page-images.kakaoentcdn.com');
for (const bad of [
  'http://series.naver.com/novel/detail.series?productNo=1',
  'https://user:pass@series.naver.com/novel/detail.series?productNo=1',
  'https://series.naver.com:444/novel/detail.series?productNo=1',
  'https://series.naver.com/admin',
  'https://127.0.0.1/novel/detail.series?productNo=1'
]) assert.throws(() => validateUrlForProvider(naver, bad));

const korean = '문피아 작품 소개입니다.';
const cp949 = iconv.encode(korean, 'cp949');
assert.equal(decodeResponseBody(cp949, 'text/html; charset=euc-kr'), korean);
assert.equal(decodeResponseBody(Buffer.from(korean, 'utf8'), 'application/json; charset=utf-8'), korean);
assert.equal(decodeResponseBody(cp949, 'text/html').includes('문피아'), true, 'charset heuristic must preserve Korean CP949 text');

const service = createMetadataTransportService({ timeoutMs:1000, maxBytes:64*1024, maxImageBytes:64*1024 });
assert.equal(service.pass, 'v622-metadata-transport-security-pass');
console.log(JSON.stringify({ pass:'v622-metadata-transport-security-smoke-pass', decoded:korean.length }));
