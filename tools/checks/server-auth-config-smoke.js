const { requireAllMarkers } = require('./check-utils.js');
const { readText } = require('./server-smoke-assertions.js');

const SERVER_AUTH_CONFIG_SMOKE_PASS = 'v313-server-auth-config-smoke-pass';

function runServerAuthConfigSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runServerAuthConfigSmoke requires projectRoot');
  const authRoutes = readText(projectRoot, 'server/routes/auth-routes.js');
  requireAllMarkers(authRoutes, [
    'AUTH_CONFIG_FAIL_CLOSED_PASS',
    'v313-auth-config-fail-closed-pass',
    'function hasConfiguredAdminCredentials()',
    'function timingSafeCredentialEqual(actual, expected)',
    "router.post('/login', requireSameOrigin",
    'login blocked: admin credentials are not configured',
    'return res.status(503).json',
    "crypto.createHash('sha256')",
    'crypto.timingSafeEqual(actualHash, expectedHash)',
    'success: true, csrfToken'
  ], 'server auth config fail-closed smoke');
  return { pass: SERVER_AUTH_CONFIG_SMOKE_PASS };
}

if (require.main === module) console.log(JSON.stringify(runServerAuthConfigSmoke(process.cwd())));

module.exports = {
  SERVER_AUTH_CONFIG_SMOKE_PASS,
  runServerAuthConfigSmoke
};
