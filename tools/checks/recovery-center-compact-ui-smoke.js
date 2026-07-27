#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const PASS = 'v421-recovery-center-general-dev-split-smoke-pass';
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function inc(body, text, label){ if (!body.includes(text)) throw new Error(`${label} missing ${text}`); }
function exc(body, text, label){ if (body.includes(text)) throw new Error(`${label} must not include ${text}`); }
const shell = read('public/fragments/app-shell.html') + '\n' + read('public/fragments/deferred-ui.html');
inc(shell, 'v421-recovery-center-general-dev-nav-pass', 'app-shell'); inc(shell, 'v421-recovery-center-dev-diagnostics-nav-pass', 'app-shell'); inc(shell, '일반 복구는 요약·캐시·검색만 표시', 'app-shell');
for (const section of ['summary','cache-management','search-coverage','diagnostics','reader-manual-diagnostics','policy']) inc(shell, `data-recovery-jump="${section}"`, 'app-shell');
for (const banned of ['data-recovery-jump="library-virtual"','data-recovery-jump="checklist"','>목록 점검</button>']) exc(shell, banned, 'app-shell');
const runtime = read('public/scripts/rebuild/features/recovery/runtime.mjs'); inc(runtime, 'v421-recovery-center-general-dev-split-pass', 'runtime'); inc(runtime, '개발자 진단', 'runtime'); exc(runtime, '목록 점검', 'runtime');
const orchestration = read('public/scripts/rebuild/features/recovery/orchestration.mjs'); inc(orchestration, 'v421-recovery-center-general-dev-orchestration-pass', 'orchestration'); inc(orchestration, "new Set(['reader-manual-diagnostics', 'diagnostics', 'policy'])", 'orchestration'); exc(orchestration, 'renderRecoveryLibraryDiagnosticsPanel', 'orchestration'); exc(orchestration, 'buildRecoveryLibraryContext', 'orchestration'); exc(orchestration, "'checklist'", 'orchestration');
const navigation = read('public/scripts/rebuild/features/recovery/navigation.mjs'); inc(navigation, 'v421-recovery-center-general-dev-nav-pass', 'navigation'); inc(navigation, '일반 복구는 요약, 캐시, 검색만 표시', 'navigation'); exc(navigation, "'library-virtual'", 'navigation'); exc(navigation, 'checklist:', 'navigation');
const sync = read('public/scripts/rebuild/features/sync-devtools.mjs'); inc(sync, "focus: 'diagnostics'", 'sync-devtools'); exc(sync, "focus: 'library-virtual'", 'sync-devtools');
const css = read('public/styles/app.css') + '\n' + read('public/styles/deferred-ui.css') + '\n' + read('public/styles/owner.css'); inc(css, 'v421 Recovery Center general/dev split surface', 'css');
console.log(PASS);
module.exports = { PASS };
