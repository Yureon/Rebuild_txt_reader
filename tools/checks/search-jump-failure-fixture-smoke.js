const fs = require('fs');
const path = require('path');
const { runModuleSmokeScript } = require('./smoke-child-runner.js');

const SEARCH_JUMP_FAILURE_FIXTURE_SMOKE_PASS = 'v251-search-jump-failure-fixture-smoke-pass';
const SEARCH_JUMP_FAILURE_FIXTURE_DATA_PASS = 'v252-search-jump-failure-fixture-data-pass';
const SEARCH_LIVE_DOM_FIXTURE_BRIDGE_PASS = 'v252-search-live-dom-retry-fixture-bridge-pass';
const SEARCH_LIVE_DOM_DIAGNOSTICS_SNAPSHOT_SMOKE_PASS = 'v251-search-live-dom-diagnostics-snapshot-smoke-pass';

function loadSearchJumpFailureFixtures(projectRoot) {
  const fixturePath = path.join(projectRoot, 'tools', 'fixtures', 'search-jump-failure-fixtures.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  if (fixture.pass !== SEARCH_JUMP_FAILURE_FIXTURE_DATA_PASS) throw new Error('unexpected search jump fixture pass: ' + fixture.pass);
  if (!Array.isArray(fixture.cases) || fixture.cases.length < 10) throw new Error('search jump fixture needs at least ten cases');
  return fixture;
}

async function runSearchJumpFailureFixtureSmoke(projectRoot) {
  const fixture = loadSearchJumpFailureFixtures(projectRoot);
  const script = `
    const fixture = ${JSON.stringify(fixture)};
    const { validateLastSearchJumpRetry, buildSearchJumpMessage } = await import('./public/scripts/rebuild/features/search/jump-status.mjs');
    const { buildSearchLiveDomRetryDiagnosticsSnapshot, attachSearchLiveDomSnapshotToFailure, buildSearchJumpFailureFixtureBridge, SEARCH_LIVE_DOM_DIAGNOSTICS_SNAPSHOT_PASS } = await import('./public/scripts/rebuild/features/search/live-dom-diagnostics-snapshot.mjs');
    for (const item of fixture.cases) {
      const app = {
        state: {
          current: { novel:{ id:item.app.novelId }, episode:{ id:item.app.episodeId } },
          search: { query:item.app.query, runId:item.app.runId, results:Array.from({ length:item.app.resultCount }, (_, index) => ({ index })) }
        }
      };
      const result = validateLastSearchJumpRetry(app, item.failure, '${SEARCH_JUMP_FAILURE_FIXTURE_SMOKE_PASS}');
      if (item.expectedOk && !result.ok) throw new Error(item.name + ' expected ok but got ' + result.reason);
      if (!item.expectedOk && result.reason !== item.expectedReason) throw new Error(item.name + ' expected ' + item.expectedReason + ' but got ' + result.reason);
      if (item.expectedRetryMode && item.failure.retryMode !== item.expectedRetryMode) throw new Error(item.name + ' expected retryMode ' + item.expectedRetryMode);
      if (item.expectedLiveRowAvailable && !item.failure.liveRowAvailable) throw new Error(item.name + ' expected live row availability sample');
      if (item.expectedHighlightedMatch && !item.failure.highlightedMatch) throw new Error(item.name + ' expected highlighted match sample');
      if (item.expectedRetryCount != null && Number(item.failure.retryCount) !== Number(item.expectedRetryCount)) throw new Error(item.name + ' retryCount fixture mismatch');
      if (item.expectedLiveDomSnapshot) {
        const fakeRow = { dataset:{ chunk:String(item.failure.chunk), resultIndex:String(item.failure.index) } };
        const fakeDoc = { querySelector(selector) { return String(selector).includes('data-chunk') ? fakeRow : (String(selector).includes('search-hit') ? { dataset:{ active:'1' } } : null); } };
        const snapshot = buildSearchLiveDomRetryDiagnosticsSnapshot(app, item.failure, { document:fakeDoc });
        if (snapshot.pass !== SEARCH_LIVE_DOM_DIAGNOSTICS_SNAPSHOT_PASS || !snapshot.liveRowAvailable || !snapshot.highlightedMatch) throw new Error(item.name + ' expected live DOM diagnostics snapshot');
        const attached = attachSearchLiveDomSnapshotToFailure(item.failure, snapshot);
        if (!attached.liveRowAvailable || !attached.highlightedMatch || !attached.liveDomDiagnosticsPass) throw new Error(item.name + ' did not attach live DOM snapshot');
        const bridge = buildSearchJumpFailureFixtureBridge(item.failure, snapshot);
        if (bridge.pass !== '${SEARCH_LIVE_DOM_FIXTURE_BRIDGE_PASS}' || bridge.retryCount !== Number(item.failure.retryCount || 0)) throw new Error(item.name + ' did not build fixture bridge snapshot');
      }
      const message = buildSearchJumpMessage(item.failure, item.expectedOk ? 'done' : 'failed');
      if (!message.includes('chunk')) throw new Error(item.name + ' did not produce chunk message');
    }
  `;
  await runModuleSmokeScript(projectRoot, script, { label:'search jump failure fixture smoke', timeoutMs:8000 });
  return { pass: SEARCH_JUMP_FAILURE_FIXTURE_SMOKE_PASS, fixturePass: SEARCH_JUMP_FAILURE_FIXTURE_DATA_PASS, liveDomSnapshotPass: SEARCH_LIVE_DOM_DIAGNOSTICS_SNAPSHOT_SMOKE_PASS, fixtureBridgePass: SEARCH_LIVE_DOM_FIXTURE_BRIDGE_PASS, cases: fixture.cases.length };
}

module.exports = { SEARCH_JUMP_FAILURE_FIXTURE_SMOKE_PASS, SEARCH_JUMP_FAILURE_FIXTURE_DATA_PASS, SEARCH_LIVE_DOM_DIAGNOSTICS_SNAPSHOT_SMOKE_PASS, loadSearchJumpFailureFixtures, runSearchJumpFailureFixtureSmoke };
