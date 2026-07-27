#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v391-login-session-diagnostics-smoke-pass';
const CF_VISITOR_PASS = 'v525-cloudflare-visitor-https-trust-smoke-pass';

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function runLoginSessionDiagnosticsSmoke(root = path.join(__dirname, '..', '..')) {
  const auth = read(root, 'server/routes/auth-routes.js');
  const login = read(root, 'public/login.html') + '\n' + read(root, 'public/scripts/login.js');
  assert.ok(auth.includes('v391-login-production-https-diagnostic-pass'), 'server diagnostic marker missing');
  assert.ok(auth.includes('v391-login-session-verify-pass'), 'server session verify marker missing');
  assert.ok(auth.includes('production_https_required'), 'production HTTPS error code missing');
  assert.ok(auth.includes('isProductionRuntime() && !isRequestSecure(req)'), 'production insecure request guard missing');
  assert.ok(auth.includes('x-forwarded-proto'), 'forwarded proto diagnostic missing');
  assert.ok(auth.includes('v525-cloudflare-visitor-https-trust-pass'), 'cloudflare visitor HTTPS trust marker missing');
  assert.ok(auth.includes('getCloudflareVisitorScheme'), 'cloudflare visitor parser missing');
  assert.ok(auth.includes("deploymentMode() === 'cloudflare-tunnel'"), 'cf visitor trust must be limited to cloudflare-tunnel mode');
  assert.ok(login.includes('v391-login-session-verify-client-pass'), 'client verify marker missing');
  assert.ok(login.includes("fetch('/api/csrf'"), 'client session verification fetch missing');
  assert.ok(login.includes('formatDetail'), 'client structured error formatter missing');
  assert.ok(login.includes('production'), 'client production diagnostic text missing');
  const previousMode = process.env.DEPLOYMENT_MODE;
  process.env.DEPLOYMENT_MODE = 'cloudflare-tunnel';
  const Module = require('module');
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) { if (request === 'express') return { Router(){ return {}; } }; return originalLoad.call(this, request, parent, isMain); };
  let authRoutes;
  try { authRoutes = require(path.join(root, 'server/routes/auth-routes.js')); } finally { Module._load = originalLoad; }
  const cfReq = { protocol:'http', secure:false, get:(name) => ({ 'x-forwarded-proto':'http', 'cf-visitor':'{\"scheme\":\"https\"}' }[String(name).toLowerCase()] || '') };
  assert.strictEqual(authRoutes.getForwardedProto(cfReq), 'http', 'fixture must keep forwarded proto as http');
  assert.strictEqual(authRoutes.getCloudflareVisitorScheme(cfReq), 'https', 'cf visitor scheme must parse https');
  assert.strictEqual(authRoutes.isRequestSecure(cfReq), true, 'cloudflare-tunnel cf-visitor https must satisfy production secure request guard');
  process.env.DEPLOYMENT_MODE = 'trusted-proxy';
  assert.strictEqual(authRoutes.isRequestSecure(cfReq), false, 'cf-visitor must not be trusted outside cloudflare-tunnel mode');
  const forwardedHttpsReq = { protocol:'http', secure:false, get:(name) => String(name).toLowerCase() === 'x-forwarded-proto' ? 'https' : '' };
  assert.strictEqual(authRoutes.isRequestSecure(forwardedHttpsReq), true, 'trusted-proxy mode must accept forwarded HTTPS');
  process.env.DEPLOYMENT_MODE = 'direct';
  assert.strictEqual(authRoutes.isRequestSecure(forwardedHttpsReq), false, 'direct mode must ignore client-supplied forwarded HTTPS');
  if (previousMode == null) delete process.env.DEPLOYMENT_MODE;
  else process.env.DEPLOYMENT_MODE = previousMode;
  return { pass: PASS, cfVisitorTrustPass: CF_VISITOR_PASS };
}

if (require.main === module) console.log(JSON.stringify(runLoginSessionDiagnosticsSmoke()));
module.exports = { runLoginSessionDiagnosticsSmoke };
