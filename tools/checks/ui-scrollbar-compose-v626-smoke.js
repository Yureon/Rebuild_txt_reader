#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const metadata = read('public/styles/metadata-page.css');
const admin = read('public/styles/admin-users.css');
const owner = read('public/styles/owner.css');
const compose = read('docker-compose.yml');
const composeExample = read('docker-compose.example.yml');
const tunnel = read('docker-compose.cloudflare-tunnel.example.yml');
const env = read('.env.example');

assert(metadata.includes('v626-metadata-scrollbar-ui-pass'));
assert(metadata.includes('.metadata-work-list{scrollbar-gutter:stable;overscroll-behavior:contain'));
assert(metadata.includes('scrollbar-width:thin'));
assert(metadata.includes('::-webkit-scrollbar-thumb'));
assert(metadata.includes('background-clip:padding-box'));
assert(metadata.includes('--metadata-scrollbar-thumb-hover'));
assert(admin.includes('v626-admin-scrollbar-ui-pass'));
assert(admin.includes(':where(html,body.admin-users-page,.admin-users-page *)'));
assert(owner.includes('v626-owner-scrollbar-ui-pass'));
assert(owner.includes('.devdbg-output'));

for (const [name, text] of [['docker-compose.yml', compose], ['docker-compose.example.yml', composeExample]]) {
  assert(text.includes('${TXT_READER_BIND_ADDRESS:-0.0.0.0}:${PORT:-3000}:3000'), `${name} must support configurable all-interface host publish`);
  assert(!text.includes('"127.0.0.1:${PORT:-3000}:3000"'), `${name} must not hard-code loopback publish`);
}
assert(env.includes('TXT_READER_BIND_ADDRESS=0.0.0.0'));
assert(env.includes('127.0.0.1로 제한'));
assert(env.includes('WAN 직접 접근을 반드시 차단'));
assert(!/^\s*ports:\s*$/m.test(tunnel), 'cloudflared sidecar compose must not publish the app port to the host');
assert(!fs.existsSync(path.join(root, 'public/metadata-audit-fixture.html')), 'audit-only fixture must not ship');

console.log(JSON.stringify({
  pass:'v626-ui-scrollbar-compose-pass',
  metadataScrollbar:true,
  adminScrollbar:true,
  ownerScrollbar:true,
  bindAddress:'0.0.0.0-configurable'
}));
