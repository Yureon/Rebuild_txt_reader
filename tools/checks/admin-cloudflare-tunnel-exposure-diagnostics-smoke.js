#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const PASS = 'v528-cloudflare-tunnel-exposure-diagnostics-smoke-pass';

async function runAdminCloudflareTunnelExposureDiagnosticsSmoke(root = path.join(__dirname, '..', '..')) {
  const servicePath = path.join(root, 'server/services/admin-diagnostics-service.js');
  const opsPath = path.join(root, 'public/scripts/admin/ops.js');
  const serviceSource = fs.readFileSync(servicePath, 'utf8');
  const opsSource = fs.readFileSync(opsPath, 'utf8');

  assert.ok(serviceSource.includes('v528-cloudflare-tunnel-exposure-diagnostics-pass'), 'server diagnostics exposure marker missing');
  assert.ok(serviceSource.includes('buildCloudflareTunnelExposureDiagnostics'), 'server diagnostics must build cloudflare tunnel exposure object');
  assert.ok(serviceSource.includes('unknown-server-side'), 'server diagnostics must state WAN exposure cannot be proven internally');
  assert.ok(serviceSource.includes('cloudflare_tunnel_exposure_assumption'), 'server diagnostics must emit exposure assumption finding');
  assert.ok(opsSource.includes('data-cf-tunnel-exposure-pass'), 'owner UI must render tunnel exposure diagnostics card');
  assert.ok(opsSource.includes('WAN exposure'), 'owner UI must summarize WAN exposure status');
  assert.ok(opsSource.includes('NPM·Node 포트가 직접 열려 있는지는 서버 단독으로 확정할 수 없습니다'), 'owner UI must explain server-side WAN uncertainty');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-cf-exposure-'));
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
  const previousClientIpHeader = process.env.CLIENT_IP_HEADER;
  process.env.NODE_ENV = 'production';
  process.env.CLIENT_IP_HEADER = 'CF-Connecting-IP';
  delete require.cache[require.resolve(servicePath)];
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
        'cf-connecting-ip': '221.151.39.108',
        'cf-ray': '9f97013f1f95867d-LAX',
        'cdn-loop': 'cloudflare; loops=1',
        'cf-ipcountry': 'KR',
        origin: 'https://reader.skn.kr',
        'sec-fetch-site': 'same-origin'
      };
      return headers[String(name).toLowerCase()] || '';
    }
  };
  const result = await diagnosticsService.buildDiagnostics(req);
  if (previousNodeEnv == null) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousClientIpHeader == null) delete process.env.CLIENT_IP_HEADER;
  else process.env.CLIENT_IP_HEADER = previousClientIpHeader;

  assert.ok(result.exposure, 'diagnostics must include exposure object');
  assert.strictEqual(result.exposure.pass, 'v528-cloudflare-tunnel-exposure-diagnostics-pass', 'exposure marker mismatch');
  assert.strictEqual(result.exposure.currentRequestLooksCloudflare, true, 'Cloudflare header set should be detected');
  assert.strictEqual(result.exposure.directWanExposure.status, 'unknown-server-side', 'WAN exposure must not be falsely declared safe');
  assert.strictEqual(result.exposure.directWanExposure.automaticVerification, false, 'WAN exposure must require external/operator verification');
  assert.ok(result.exposure.presentHeaders.includes('cfVisitor'), 'cfVisitor presence must be recorded');
  assert.ok(result.exposure.presentHeaders.includes('cfConnectingIp'), 'cfConnectingIp presence must be recorded');
  assert.strictEqual(result.exposure.clientIpHeader, 'CF-Connecting-IP', 'client ip header name must be reported');
  assert.strictEqual(result.exposure.clientIpHeaderPresent, true, 'client ip header value must be detected');
  assert.ok(result.exposure.checklist.some(item => item.code === 'wan_block_npm_80'), 'WAN NPM 80 checklist missing');
  assert.ok(result.exposure.checklist.some(item => item.code === 'wan_block_node_app'), 'WAN Node app checklist missing');
  const finding = result.findings.find(item => item.code === 'cloudflare_tunnel_exposure_assumption');
  assert.ok(finding && finding.grade === 'ok', 'trusted Cloudflare request should emit ok exposure assumption finding');
  assert.ok(finding.fix.includes('NPM 80/443/81'), 'finding must instruct operator to verify blocked WAN ports');
  return { pass: PASS, diagnosticsPass: result.exposure.pass };
}

if (require.main === module) runAdminCloudflareTunnelExposureDiagnosticsSmoke().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exit(1); });
module.exports = { runAdminCloudflareTunnelExposureDiagnosticsSmoke };
