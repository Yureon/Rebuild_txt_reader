#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const PASS = 'v408-operations-docs-smoke-pass';

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const env = read('.env.example');
for (const token of [
  '기준: rebuild-v564',
  'owner 콘솔 전용 계정',
  'WAN/외부 인터넷에서 origin으로 직접 들어오는 우회 경로가 없어야 합니다',
  'NPM service entry(80/443)와 Node 앱 포트',
  '공유기/방화벽/Proxmox/LXC',
  'NODE_ENV=production',
  'DEPLOYMENT_MODE=direct',
  'DEPLOYMENT_MODE=trusted-proxy',
  'DEPLOYMENT_MODE=cloudflare-tunnel',
  'X-Forwarded-Proto: https',
  'CLIENT_IP_HEADER=CF-Connecting-IP',
  '/healthz'
]) {
  assert.ok(env.includes(token), `.env.example must include ${token}`);
}

const deployment = read('docs/deployment-guide.md');
for (const token of [
  '기준 버전: rebuild-v564',
  'production_https_required',
  '가입코드 기반 회원가입',
  '운영 진단',
  'Cloudflare Tunnel 예시',
  'Cloudflare Tunnel + 내부 NPM 신뢰 경계',
  '관리자 포트만 막는 것으로는 부족하다',
  'NPM service entry',
  '배포 ZIP 제외 원칙'
]) {
  assert.ok(deployment.includes(token), `deployment guide must include ${token}`);
}

const operations = read('docs/operations-checklist.md');
for (const token of [
  'owner 로그인 확인',
  '가입코드 운영',
  '사용자 권한 관리',
  '사용자 state / snapshot',
  '감사 로그',
  'reader 회귀 확인',
  'package-lock.json',
  'NPM `80/443`과 Node 앱 포트도 WAN에서 직접 접근 불가능해야 한다',
  'effective protocol: https'
]) {
  assert.ok(operations.includes(token), `operations checklist must include ${token}`);
}


const proxy = read('docs/proxy-tunnel-setup.md');
for (const token of [
  '외부 WAN에서 NPM 관리자 포트 `81`뿐 아니라 NPM service entry `80/443`과 Node 앱 포트 `3000`에도 직접 접근할 수 없어야 한다',
  '위험한 우회 경로',
  'WAN exposure checklist for Cloudflare Tunnel + NPM',
  'Router port forwarding does not expose NPM `80`, `443`, or `81`'
]) {
  assert.ok(proxy.includes(token), `proxy tunnel setup must include ${token}`);
}

const diagnostics = read('docs/production-diagnostics.md');
for (const token of [
  'production HTTP 로그인 루프',
  'trusted-proxy 모드',
  'Cloudflare Tunnel 모드',
  'NPM `80/443/81`과 Node 앱 포트가 WAN에 직접 노출되면 안 된다',
  'CF-Visitor: {"scheme":"https"}',
  'owner diagnostics API',
  'Origin mismatch',
  'CSP script-src'
]) {
  assert.ok(diagnostics.includes(token), `production diagnostics must include ${token}`);
}

const smoke = read('docs/smoke-tests.md');
for (const token of [
  '기준 버전: rebuild-v564',
  'operations-docs-smoke.js',
  'search-cache-only-no-network-smoke.js',
  'signup-code-atomic-smoke.js',
  'timeout 처리 기준'
]) {
  assert.ok(smoke.includes(token), `smoke docs must include ${token}`);
}

const security = read('docs/security.md');
for (const token of [
  '기준 버전: rebuild-v564',
  '가입코드 hash-only 저장',
  'script-src',
  'style-src',
  'audit log redaction',
  'snapshot retention',
  'NPM service entry `80/443`과 Node 앱 포트도 직접 접근을 차단해야 한다'
]) {
  assert.ok(security.includes(token), `security docs must include ${token}`);
}

console.log(JSON.stringify({ pass: PASS }));
