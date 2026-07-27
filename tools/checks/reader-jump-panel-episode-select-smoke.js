#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const jump = read('public/scripts/rebuild/features/reader/jump-panel.mjs');
const reader = read('public/scripts/rebuild/features/reader.mjs');
const runner = read('tools/run_smoke_tests.js');

const PASS = 'v362-reader-jump-panel-episode-select-smoke-pass';

assert.ok(jump.includes('goEpisode'), 'jump panel must accept a goEpisode handler');
assert.ok(jump.includes('episode-jump-select'), 'jump panel must create an episode select');
assert.ok(jump.includes('formatEpisodeJumpTitle'), 'jump panel must format episode titles');
assert.ok(jump.includes('/^\\d+$/.test(title)'), 'numeric-only episode titles must receive 화 suffix');
assert.ok(!jump.includes('text:`${index + 1}. ${title}`'), 'episode dropdown labels must not be numbered by index');
assert.ok(jump.includes("await goEpisode(selectedEpisodeId, { ratio: 0, align:'start', source:'episode-select-change' })"), 'episode select change must navigate immediately');
assert.ok(jump.includes('syncEpisodeSelect(app, episodeSelect)'), 'jump panel must populate episode select on open');
assert.ok(jump.includes('getSelectedEpisodeId(app, episodeSelect)'), 'jump panel must read selected episode id');
assert.ok(jump.includes('episodeChanged || episodeDirty'), 'episode changes must route through episode navigation');
assert.ok(jump.includes('globalBlockIndex: Math.max(0, blockValue - 1)'), 'selected episode block jumps must pass a target block');
assert.ok(jump.includes('선택한 화 기준'), 'target-episode input hint must be present');
assert.ok(reader.includes("READER_JUMP_PANEL_EPISODE_SELECT_PASS = 'v362-reader-jump-panel-episode-select-pass'"), 'reader must expose v362 jump episode marker');
assert.ok(reader.includes('goEpisode: (episodeId, options = {}) => goEpisode(app, episodeId, options)'), 'reader API must expose goEpisode');
assert.ok(reader.includes('async function goEpisode(app, episodeId, options = {})'), 'reader must implement goEpisode');
assert.ok(reader.includes('openNovel(app, c.novel, {'), 'goEpisode must use openNovel for cross-episode jumps');
assert.ok(reader.includes('episodeId: targetEpisode.id'), 'goEpisode must pass target episode id');
assert.ok(reader.includes('globalBlockIndex: options.globalBlockIndex'), 'goEpisode must support block target within selected episode');
assert.ok(reader.includes('v.lastJumpPanelEpisodeSelect'), 'goEpisode must record diagnostics for the selected episode jump');
assert.ok(runner.includes("nodeCmd('tools/checks/reader-jump-panel-episode-select-smoke.js')"), 'reader smoke runner must include v362 jump panel smoke');

console.log(PASS);
