const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v349-search-remote-pill-compaction-smoke-pass';

function runSearchRemotePillCompactionSmoke(root = path.join(__dirname, '..', '..')) {
  const searchPath = path.join(root, 'public/scripts/rebuild/features/search.mjs');
  const announcementPath = path.join(root, 'public/scripts/rebuild/features/search/announcement-formatters.mjs');
  const search = fs.readFileSync(searchPath, 'utf8');
  const announcement = fs.readFileSync(announcementPath, 'utf8');
  assert.ok(search.includes("SEARCH_REMOTE_PILL_COMPACTION_PASS = 'v349-search-remote-pill-compaction-pass'"), 'pass marker');
  assert.ok(search.includes("moveResult(app, -1, { source:'remote' })"), 'remote prev tagged');
  assert.ok(search.includes("moveResult(app, 1, { source:'remote' })"), 'remote next tagged');
  assert.ok(search.includes('jumpToResult(app, next, { suppressPill: remoteNavigation })'), 'jump suppress option');
  assert.ok(search.includes('remoteNavigation ? 900 : 1800'), 'remote compact duration');
  assert.ok(announcement.includes('!deps.suppressPill'), 'announcement suppresses transient pill');
  assert.ok(announcement.includes('nsearchStatus'), 'panel text preserved');
  return { pass: PASS };
}

if (require.main === module) {
  console.log(JSON.stringify(runSearchRemotePillCompactionSmoke(path.join(__dirname, '..', '..'))));
}

module.exports = { runSearchRemotePillCompactionSmoke };
