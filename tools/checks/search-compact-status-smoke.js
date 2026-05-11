#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const PASS = 'v366-search-compact-status-smoke-pass';

(async () => {
  const matcherSource = fs.readFileSync('public/scripts/rebuild/features/search/matcher.mjs', 'utf8');
  const statusPanelSource = fs.readFileSync('public/scripts/rebuild/features/search/status-panel.mjs', 'utf8');
  const detailSource = fs.readFileSync('public/scripts/rebuild/features/search/status-detail-rows.mjs', 'utf8');
  assert.ok(statusPanelSource.includes('v366-search-compact-status-pass'), 'status panel must include compact status marker');
  assert.ok(statusPanelSource.includes('const hasActionableIssue'), 'retry bar visibility must be issue-driven');
  assert.ok(!statusPanelSource.includes('const shouldShow = allChunks ||'), 'retry bar must not show solely because full search is checked');
  assert.ok(detailSource.includes('stats?.done && hasActionableIssue'), 'detail rows must not show normal completion noise without issues');
  const { formatSearchProgress } = await import('../../public/scripts/rebuild/features/search/matcher.mjs');
  const text = formatSearchProgress({ mode:'all', totalChunks:100, processedChunks:55, scannedChunks:55, episodeCount:3, currentEpisodeIndex:2 }, 7, false);
  assert.ok(text.includes('검색 중'), 'compact progress must keep state');
  assert.ok(text.includes('처리 55/100'), 'compact progress must keep processed count');
  assert.ok(text.includes('결과 7'), 'compact progress must keep result count');
  assert.ok(text.includes('화 2 / 3'), 'compact progress must keep multi-episode progress');
  assert.ok(!text.includes('표시중 ') && !text.includes('메모리 ') && !text.includes('네트워크 '), 'compact progress must remove source-count clutter');
  console.log(PASS);
})().catch(error => {
  console.error(error && (error.stack || error.message || String(error)));
  process.exit(1);
});
