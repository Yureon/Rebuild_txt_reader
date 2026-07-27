const {
  SERVER_SMOKE_STATE_SAMPLE_FIXTURE_PASS,
  SERVER_SMOKE_SECURITY_NEGATIVE_FIXTURE_PASS,
  SERVER_SMOKE_METHOD_NEGATIVE_FIXTURE_PASS,
  createServerSmokeStateSamples,
  validateServerSmokeStateSamples,
  createServerSmokeSecurityNegativeCases,
  validateServerSmokeSecurityNegativeCases,
  createServerSmokeMethodSpecificWriteNegativeCases,
  validateServerSmokeMethodSpecificWriteNegativeCases
} = require('./server-smoke-fixtures.js');

const SERVER_SMOKE_FIXTURE_COVERAGE_SMOKE_PASS = 'v251-server-smoke-fixture-coverage-smoke-pass';

function runServerSmokeFixtureCoverageSmoke() {
  const samples = createServerSmokeStateSamples();
  const issues = validateServerSmokeStateSamples(samples);
  if (issues.length) throw new Error('server smoke fixture sample issues: ' + issues.join(', '));
  const routeCoverage = new Set(samples.map(sample => sample.route));
  ['/api/user-state/shared', '/api/novels/:novelId/content', '/api/novels/:novelId/block-manifest'].forEach(route => {
    if (!routeCoverage.has(route)) throw new Error('server smoke fixture missing route sample: ' + route);
  });
  const negativeCases = createServerSmokeSecurityNegativeCases();
  const negativeIssues = validateServerSmokeSecurityNegativeCases(negativeCases);
  if (negativeIssues.length) throw new Error('server smoke negative fixture issues: ' + negativeIssues.join(', '));
  const negativeMarkers = new Set(negativeCases.flatMap(item => item.expectedMarkers || []));
  ['auth', 'csrf', 'origin'].forEach(marker => {
    if (!negativeMarkers.has(marker)) throw new Error('server smoke negative fixture missing marker: ' + marker);
  });
  const methodCases = createServerSmokeMethodSpecificWriteNegativeCases();
  const methodIssues = validateServerSmokeMethodSpecificWriteNegativeCases(methodCases);
  if (methodIssues.length) throw new Error('server smoke method negative fixture issues: ' + methodIssues.join(', '));
  const methods = new Set(methodCases.map(item => item.method));
  ['post','patch','delete'].forEach(method => {
    if (!methods.has(method)) throw new Error('server smoke method negative fixture missing method: ' + method);
  });
  return {
    pass: SERVER_SMOKE_FIXTURE_COVERAGE_SMOKE_PASS,
    fixturePass: SERVER_SMOKE_STATE_SAMPLE_FIXTURE_PASS,
    negativeFixturePass: SERVER_SMOKE_SECURITY_NEGATIVE_FIXTURE_PASS,
    methodNegativeFixturePass: SERVER_SMOKE_METHOD_NEGATIVE_FIXTURE_PASS,
    samples: samples.length,
    negativeCases: negativeCases.length,
    methodCases: methodCases.length
  };
}

module.exports = { SERVER_SMOKE_FIXTURE_COVERAGE_SMOKE_PASS, runServerSmokeFixtureCoverageSmoke };
