const fs = require('fs');
const path = require('path');

const RECOVERY_SEARCH_FIXTURE_COVERAGE_SMOKE_PASS = 'v251-recovery-search-fixture-coverage-smoke-pass';
const RECOVERY_SEARCH_FIXTURE_DATA_PASS = 'v251-recovery-search-fixture-data-pass';

function loadRecoverySearchFixtureCases(projectRoot) {
  const fixturePath = path.join(projectRoot, 'tools', 'fixtures', 'recovery-search-fixture-coverage.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  if (fixture.pass !== RECOVERY_SEARCH_FIXTURE_DATA_PASS) throw new Error('unexpected recovery/search fixture pass: ' + fixture.pass);
  if (!Array.isArray(fixture.cases) || !fixture.cases.length) throw new Error('recovery/search fixture has no cases');
  if (!Array.isArray(fixture.stateSamples) || fixture.stateSamples.length < 2) throw new Error('recovery/search fixture has too few state samples');
  return fixture;
}

function validateRecoverySearchStateSamples(samples = []) {
  const issues = [];
  for (const item of samples) {
    const serialized = JSON.stringify(item).toLowerCase();
    for (const marker of item.expectedMarkers || []) {
      if (!serialized.includes(String(marker).toLowerCase())) issues.push(`${item.name || 'sample'}:${marker}`);
    }
  }
  return issues;
}

function runRecoverySearchFixtureCoverageSmoke(projectRoot) {
  const missing = [];
  const fixture = loadRecoverySearchFixtureCases(projectRoot);
  for (const item of fixture.cases) {
    const rel = item.rel;
    const full = path.join(projectRoot, rel);
    if (!fs.existsSync(full)) {
      missing.push(`${item.name || rel}:missing`);
      continue;
    }
    const source = fs.readFileSync(full, 'utf8');
    for (const marker of item.markers || []) {
      if (!source.includes(marker)) missing.push(`${item.name || rel}:${marker}`);
    }
  }
  missing.push(...validateRecoverySearchStateSamples(fixture.stateSamples));
  if (missing.length) throw new Error('recovery/search fixture coverage markers missing: ' + missing.join(', '));
  return {
    pass: RECOVERY_SEARCH_FIXTURE_COVERAGE_SMOKE_PASS,
    fixturePass: RECOVERY_SEARCH_FIXTURE_DATA_PASS,
    fixtures: fixture.cases.length,
    stateSamples: fixture.stateSamples.length,
    coverage: fixture.cases.map(item => item.name)
  };
}

module.exports = { RECOVERY_SEARCH_FIXTURE_COVERAGE_SMOKE_PASS, RECOVERY_SEARCH_FIXTURE_DATA_PASS, loadRecoverySearchFixtureCases, validateRecoverySearchStateSamples, runRecoverySearchFixtureCoverageSmoke };
