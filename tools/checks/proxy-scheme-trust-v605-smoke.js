#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) { if (request === 'express') return { Router(){ return {}; } }; return originalLoad.call(this, request, parent, isMain); };
let auth;
try { auth = require('../../server/routes/auth-routes'); } finally { Module._load = originalLoad; }
const previous = process.env.DEPLOYMENT_MODE;
const req = { protocol:'http', secure:false, get(name){ return String(name).toLowerCase() === 'x-forwarded-proto' ? 'https' : ''; } };
try {
  process.env.DEPLOYMENT_MODE = 'direct';
  assert.strictEqual(auth.isRequestSecure(req), false, 'direct mode must not trust a client-supplied X-Forwarded-Proto header');
  process.env.DEPLOYMENT_MODE = 'trusted-proxy';
  assert.strictEqual(auth.isRequestSecure(req), true, 'trusted-proxy mode must accept the forwarded HTTPS scheme');
  const diag = fs.readFileSync('server/services/admin-diagnostics-service.js', 'utf8');
  assert(diag.includes("deploymentMode || 'direct'") && diag.includes('forwardedProtoTrusted'), 'owner diagnostics must use the same proxy trust boundary');
} finally {
  if (previous == null) delete process.env.DEPLOYMENT_MODE;
  else process.env.DEPLOYMENT_MODE = previous;
}
console.log(JSON.stringify({ pass:'v605-proxy-scheme-trust-smoke-pass' }));
