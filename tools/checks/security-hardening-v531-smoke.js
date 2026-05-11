#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '../..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }

const envJs = read('server/config/env.js');
assert.ok(envJs.includes('OWNER_PASSWORD_MIN_LENGTH'), 'OWNER_PASSWORD_MIN_LENGTH env export missing');
assert.ok(envJs.includes('parseBoundedInteger(process.env.OWNER_PASSWORD_MIN_LENGTH, 14, 10, 128)'), 'owner password minimum must be env-configurable with secure bounds');

const authRoutes = read('server/routes/auth-routes.js');
assert.ok(authRoutes.includes("v531-owner-password-min-length-env-pass"), 'owner password min env marker missing');
assert.ok(authRoutes.includes('PRODUCTION_PASSWORD_MIN_LENGTH = OWNER_PASSWORD_MIN_LENGTH'), 'auth route must use env-configured owner password minimum');

const adminDiagnostics = read('server/services/admin-diagnostics-service.js');
assert.ok(adminDiagnostics.includes('ownerPasswordMinLength'), 'admin diagnostics must surface owner password min length');
assert.ok(adminDiagnostics.includes('OWNER_PASSWORD_MIN_LENGTH를 조정'), 'admin diagnostics remediation must mention env-configurable owner password length');

const utils = read('public/scripts/rebuild/core/utils.mjs');
assert.ok(utils.includes('v531-create-el-safe-html-allowlist-pass'), 'createEl safeHtml marker missing');
assert.ok(utils.includes("key === 'safeHtml'"), 'createEl must support explicit safeHtml only');
assert.ok(utils.includes("key === 'html') throw new Error"), 'createEl html attribute must be disabled');

const publicScripts = fs.readdirSync(path.join(root, 'public/scripts/rebuild/features'), { recursive:true })
  .filter(file => String(file).endsWith('.mjs'))
  .map(file => read(path.join('public/scripts/rebuild/features', file)));
assert.ok(publicScripts.some(src => src.includes('safeHtml:')), 'safeHtml reviewed call sites missing');
assert.ok(!publicScripts.some(src => /createEl\([^\n]*\{[^\n]*html\s*:/.test(src) || /\bhtml\s*:\s*`/.test(src)), 'createEl html call sites should be migrated to safeHtml');

const ops = read('public/scripts/admin/ops.js');
assert.ok(ops.includes('v531-owner-raw-diagnostics-mask-pass'), 'owner raw diagnostics mask marker missing');
assert.ok(ops.includes('maskDiagnosticPayload'), 'owner raw diagnostics should be masked before rendering');
assert.ok(ops.includes('민감값 마스킹'), 'owner raw diagnostics UI should disclose masking');

const envExample = read('.env.example');
assert.ok(envExample.includes('OWNER_PASSWORD_MIN_LENGTH'), '.env.example must document OWNER_PASSWORD_MIN_LENGTH');

console.log(JSON.stringify({ pass: 'v531-security-hardening-smoke-pass' }));
