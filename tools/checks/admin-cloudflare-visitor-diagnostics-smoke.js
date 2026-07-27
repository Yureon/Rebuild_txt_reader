#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const PASS = 'v526-admin-cloudflare-visitor-diagnostics-smoke-pass';

async function runAdminCloudflareVisitorDiagnosticsSmoke(root = path.join(__dirname, '..', '..')) {
  const servicePath = path.join(root, 'server/services/admin-diagnostics-service.js');
  const opsPath = path.join(root, 'public/scripts/admin/ops.js');
  const serviceSource = fs.readFileSync(servicePath, 'utf8');
  const opsSource = fs.readFileSync(opsPath, 'utf8');

  assert.ok(serviceSource.includes('v526-admin-cloudflare-visitor-diagnostics-pass'), 'admin diagnostics cf visitor marker missing');
  assert.ok(serviceSource.includes('cloudflareVisitorHttpsTrusted'), 'admin diagnostics must expose cf visitor trust flag');
  assert.ok(serviceSource.includes('effectiveProtocol'), 'admin diagnostics must expose effective protocol');
  assert.ok(serviceSource.includes('forwarded_proto_cf_visitor'), 'admin diagnostics must avoid false forwarded proto error when cf visitor is trusted');
  assert.ok(opsSource.includes('effective protocol'), 'owner ops card must show effective protocol');
  assert.ok(opsSource.includes('CF-Visitor'), 'owner ops card must show cf visitor state');
  assert.ok(opsSource.includes('data-admin-cf-visitor-diagnostics-pass'), 'owner diagnostics output must carry cf visitor marker');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-cf-diag-'));
  const paths = {
    DATA_DIR: path.join(temp, 'data'),
    ACCOUNTS_PATH: path.join(temp, 'data/accounts.json'),
    SIGNUP_CODES_PATH: path.join(temp, 'data/signup.json'),
    USER_DATA_DIR: path.join(temp, 'data/users'),
    FONT_DIR: path.join(temp, 'data/fonts'),
    SESSION_STORE_PATH: path.join(temp, 'data/sessions.json')
  };
  fs.mkdirSync(path.join(temp, 'library'), { recursive: true });
  const env = {
    NODE_ENV: 'production',
    DEPLOYMENT_MODE: 'cloudflare-tunnel',
    APP_ORIGIN: 'https://reader.skn.kr',
    REQUIRE_STRICT_ORIGIN: true,
    ADMIN_PW: '0123456789abcdef',
    LIBRARY_PATH: path.join(temp, 'library'),
    resolveTrustProxyValue: () => 1
  };
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const { createAdminDiagnosticsService } = require(servicePath);
  const diagnosticsService = createAdminDiagnosticsService({
    paths,
    env,
    sessionStore: { sessionMeta: new Map() },
    accountService: { listUsers: () => [] },
    auditLogService: { getStatus: () => ({ ok:true, writable:true }) },
    libraryService: { getLibraryCached: () => [], getCacheStatus: () => ({ available:true }) },
    contentService: { getCacheStatus: () => ({ available:true }) },
    blockManifestService: { getCacheStatus: () => ({ available:true }) }
  });
  const req = {
    protocol: 'http',
    secure: false,
    get(name) {
      const headers = {
        host: 'reader.skn.kr',
        'x-forwarded-proto': 'http',
        'x-forwarded-scheme': 'http',
        'cf-visitor': '{"scheme":"https"}',
        origin: 'https://reader.skn.kr',
        'sec-fetch-site': 'same-origin'
      };
      return headers[String(name).toLowerCase()] || '';
    }
  };
  const result = await diagnosticsService.buildDiagnostics(req);
  if (previousNodeEnv == null) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;

  assert.strictEqual(result.request.forwardedProto, 'http', 'fixture must retain NPM forwarded proto http');
  assert.strictEqual(result.request.cloudflareVisitorScheme, 'https', 'cf visitor scheme must be reported');
  assert.strictEqual(result.request.cloudflareVisitorHttpsTrusted, true, 'cf visitor must be trusted in cloudflare-tunnel mode');
  assert.strictEqual(result.request.effectiveProtocol, 'https', 'effective protocol must be https');
  assert.strictEqual(result.request.externalOrigin, 'https://reader.skn.kr', 'external origin must use effective https protocol');
  const productionFinding = result.findings.find(item => item.code === 'production_https');
  const forwardedFinding = result.findings.find(item => item.code === 'forwarded_proto_cf_visitor');
  const cfFinding = result.findings.find(item => item.code === 'cloudflare_visitor_scheme');
  assert.ok(productionFinding && productionFinding.grade === 'ok', 'production HTTPS finding must pass with trusted cf visitor');
  assert.ok(forwardedFinding && forwardedFinding.grade === 'ok', 'forwarded proto must be downgraded to cf visitor ok finding');
  assert.ok(cfFinding && cfFinding.grade === 'ok', 'cloudflare visitor finding must pass');
  assert.ok(!result.findings.some(item => item.code === 'forwarded_proto_mismatch'), 'forwarded proto mismatch must not be emitted when cf visitor is trusted');
  assert.strictEqual(result.summary.grade, 'ok', 'diagnostics summary should remain ok for trusted cloudflare tunnel fixture');
  return { pass: PASS, diagnosticsPass: result.request.cloudflareVisitorHttpsTrustPass };
}

if (require.main === module) runAdminCloudflareVisitorDiagnosticsSmoke().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exit(1); });
module.exports = { runAdminCloudflareVisitorDiagnosticsSmoke };
