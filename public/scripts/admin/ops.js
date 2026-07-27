(function(global){
  'use strict';
  var PASS = 'v417-admin-users-ops-split-pass';
  var PREFLIGHT_PASS = 'v417-admin-preflight-check-pass';
  var HISTORY_PASS = 'v417-admin-diagnostics-history-pass';
  var CARD_PASS = 'v417-admin-ops-card-details-pass';
  var DETAIL_TABLE_PASS = 'v416-admin-ops-detail-table-pass';
  var FILTER_PASS = 'v417-admin-diagnostics-filter-pass';
  var IO_DIAGNOSTICS_TABLE_PASS = 'v437-admin-io-diagnostics-table-pass';
  var CACHE_METRICS_THRESHOLD_PASS = 'v442-cache-metrics-threshold-diagnostics-pass';
  var CF_VISITOR_DIAGNOSTICS_PASS = 'v526-admin-cloudflare-visitor-diagnostics-pass';
  var CF_TUNNEL_EXPOSURE_PASS = 'v528-cloudflare-tunnel-exposure-diagnostics-pass';
  var RAW_DIAGNOSTICS_MASK_PASS = 'v531-owner-raw-diagnostics-mask-pass';
  var STORAGE_KEY = 'admin_diagnostics_history_v2';
  var lastDiagnostics = null;
  var lastExtra = null;
  function esc(v){ return global.AdminUsersCore && global.AdminUsersCore.esc ? global.AdminUsersCore.esc(v) : String(v == null ? '' : v); }
  function $(id){ return document.getElementById(id); }
  function gradeLabel(g){ return g === 'error' ? '오류' : g === 'warn' ? '경고' : '정상'; }
  function loadHistory(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(_e) { return []; } }
  function saveHistory(item){ var next = loadHistory(); next.unshift(item); next = next.slice(0, 10); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch(_e) {} return next; }
  function renderHistory(){
    var box = $('admin-diagnostics-history');
    if (!box) return;
    var history = loadHistory();
    box.dataset.adminDiagnosticsHistoryPass = HISTORY_PASS;
    box.innerHTML = history.length ? history.map(function(item){
      return '<div class="diagnostics-history-item grade-' + esc(item.grade || 'ok') + '"><strong>' + esc(gradeLabel(item.grade)) + '</strong><span>' + esc(item.ts || '') + '</span><code>' + esc(item.mode || '') + '</code><span>' + esc(item.message || '') + '</span></div>';
    }).join('') : '<p class="muted small">아직 저장된 진단 이력이 없습니다.</p>';
  }
  function buildRuntimeCardTuples(d, extra){
    var runtime = d.runtime || {};
    var request = d.request || {};
    var cards = [
      ['NODE_ENV', runtime.nodeEnv || '-', 'process 환경'],
      ['DEPLOYMENT_MODE', runtime.deploymentMode || '-', 'direct / proxy / tunnel'],
      ['APP_ORIGIN', runtime.appOrigin || '-', '허용 origin'],
      ['effective protocol', request.effectiveProtocol || request.protocol || request.forwardedProto || '-', 'Secure cookie 판정 기준'],
      ['X-Forwarded-Proto', request.forwardedProto || '-', 'proxy 전달 scheme'],
      ['CF-Visitor', request.cloudflareVisitorScheme ? request.cloudflareVisitorScheme + (request.cloudflareVisitorHttpsTrusted ? ' · trusted' : ' · untrusted') : '-', 'cloudflare-tunnel HTTPS 보조 판정'],
      ['WAN exposure', d.exposure && d.exposure.directWanExposure ? d.exposure.directWanExposure.status : '-', '서버 단독 확정 불가']
    ];
    if (extra) {
      cards.push(['/healthz', extra.healthz && extra.healthz.ok ? 'ok' : 'fail', '서버 상태']);
      cards.push(['/api/time', extra.timeApi && extra.timeApi.ok !== false ? 'ok' : 'fail', 'API 응답']);
      cards.push(['elapsed', String(extra.elapsedMs || 0) + 'ms', '점검 소요 시간']);
    }
    return cards;
  }
  function renderMiniCards(d, extra){
    return buildRuntimeCardTuples(d, extra).map(function(card){
      return '<article class="ops-mini-card"><span>' + esc(card[0]) + '</span><strong>' + esc(card[1]) + '</strong><small>' + esc(card[2]) + '</small></article>';
    }).join('');
  }
  function renderSummaryTable(d, extra){
    var summary = d.summary || {};
    var rows = [
      ['등급', gradeLabel(summary.grade || 'ok'), summary.message || '운영 진단 완료'],
      ['오류', String(summary.errorCount || 0), 'error finding 수'],
      ['경고', String(summary.warnCount || 0), 'warn finding 수'],
      ['pass', d.pass || '-', 'diagnostics route marker']
    ];
    if (extra) {
      rows.push(['preflight', extra.preflightPass || '-', '배포 전 점검 marker']);
      rows.push(['/healthz', extra.healthz && extra.healthz.ok ? 'ok' : 'fail', 'HTTP 상태 ' + esc(extra.healthz && extra.healthz.status || '')]);
      rows.push(['/api/time', extra.timeApi && extra.timeApi.ok !== false ? 'ok' : 'fail', extra.timeApi && extra.timeApi.ts || '']);
      rows.push(['elapsed', String(extra.elapsedMs || 0) + 'ms', '배포 전 점검 소요 시간']);
    }
    return '<section class="diagnostics-card diagnostics-summary-table" data-admin-cf-visitor-diagnostics-pass="' + CF_VISITOR_DIAGNOSTICS_PASS + '" data-admin-ops-detail-table-pass="' + DETAIL_TABLE_PASS + '"><h3>요약</h3><table><thead><tr><th>항목</th><th>값</th><th>설명</th></tr></thead><tbody>' + rows.map(function(row){ return '<tr><th>' + esc(row[0]) + '</th><td>' + esc(row[1]) + '</td><td>' + esc(row[2]) + '</td></tr>'; }).join('') + '</tbody></table></section>';
  }
  function problemOnlyEnabled(){ var el = $('admin-diagnostics-problem-only'); return !!(el && el.checked); }
  function isProblem(item){ var grade = item && (item.grade || item.status); return grade === 'warn' || grade === 'error'; }
  function maybeFilter(items){ items = items || []; return problemOnlyEnabled() ? items.filter(isProblem) : items; }
  function renderChecklistTable(checklist){
    var rows = checklist.map(function(item){ return '<tr class="grade-' + esc(item.grade || item.status || 'ok') + '"><td>' + esc(gradeLabel(item.grade || item.status || 'ok')) + '</td><td><code>' + esc(item.code || '') + '</code></td><td>' + esc(item.title || item.code || '') + '</td><td>' + esc(item.status || '') + '</td><td>' + esc(item.action || '') + '</td></tr>'; }).join('');
    return '<section class="diagnostics-card diagnostics-checklist"><h3>체크리스트</h3><div class="diagnostics-table-wrap"><table><thead><tr><th>등급</th><th>코드</th><th>항목</th><th>상태</th><th>조치</th></tr></thead><tbody>' + (rows || '<tr class="grade-ok"><td>정상</td><td>-</td><td>표시할 체크 항목이 없습니다.</td><td>ok</td><td>-</td></tr>') + '</tbody></table></div></section>';
  }
  function renderFindingTable(f){
    var rows = [
      ['등급', gradeLabel(f.grade || 'ok')],
      ['코드', f.code || ''],
      ['상세', f.detail || ''],
      ['조치', f.fix || f.action || '', 'diagnostics-fix'],
      ['문서', f.docsRef || '']
    ];
    return '<table><tbody>' + rows.map(function(row){ return '<tr><th>' + esc(row[0]) + '</th><td class="' + esc(row[2] || '') + '">' + esc(row[1]) + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  function isPlainObject(v){ return !!(v && typeof v === 'object' && !Array.isArray(v)); }
  function formatDiagnosticValue(v){
    if (v == null || v === '') return '-';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '-';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v); } catch(_e) { return String(v); }
  }
  function pushIoDiagnosticRows(rows, scope, payload, prefix){
    if (!isPlainObject(payload)) {
      rows.push([scope, prefix || 'status', 'unavailable', 'status 객체 없음']);
      return;
    }
    var keys = Object.keys(payload).sort();
    if (!keys.length) rows.push([scope, prefix || 'status', 'empty', '표시할 진단값 없음']);
    keys.forEach(function(key){
      var value = payload[key];
      var label = prefix ? prefix + '.' + key : key;
      if (isPlainObject(value)) {
        pushIoDiagnosticRows(rows, scope, value, label);
      } else if (Array.isArray(value)) {
        rows.push([scope, label, value.length ? JSON.stringify(value) : '[]', 'array']);
      } else {
        rows.push([scope, label, formatDiagnosticValue(value), typeof value]);
      }
    });
  }
  function metricAt(root, path){
    return path.split('.').reduce(function(acc, key){ return acc && acc[key] != null ? acc[key] : null; }, root || {});
  }
  function formatRatio(n, d){
    n = Number(n || 0); d = Number(d || 0);
    if (!Number.isFinite(n)) n = 0;
    if (!Number.isFinite(d) || d <= 0) return String(n) + ' / 0';
    return String(n) + ' / ' + String(d) + ' (' + String(Math.round((n / d) * 1000) / 1000) + ')';
  }
  function buildCacheThresholdRows(ioDiagnostics, criteria){
    var content = ioDiagnostics && ioDiagnostics.content || {};
    var library = ioDiagnostics && ioDiagnostics.library || {};
    var blockManifest = ioDiagnostics && ioDiagnostics.blockManifest || {};
    var definitions = [
      ['contentInflightWarn', 'content', 'fileCacheInflightEntries', metricAt(content, 'fileCacheInflightEntries'), '초과 시 경고'],
      ['contentChunkIndexPendingWarn', 'content', 'chunkIndexPending', metricAt(content, 'chunkIndexPending'), '초과 시 경고'],
      ['contentLastFileReadMsWarn', 'content', 'lastFileReadMs', metricAt(content, 'metrics.lastFileReadMs'), 'ms 초과 시 경고'],
      ['contentFileCacheBytesRatioWarn', 'content', 'fileCacheBytesRatio', formatRatio(metricAt(content, 'fileCacheBytes'), metricAt(content, 'fileCacheLimits.maxBytes')), '사용률 기준'],
      ['contentMissToHitWarnRatio', 'content', 'fileCacheMissToHitRatio', formatRatio(metricAt(content, 'metrics.fileCacheMisses'), metricAt(content, 'metrics.fileCacheHits')), 'miss / hit 기준'],
      ['libraryMissToHitWarnRatio', 'library', 'libraryCacheMissToHitRatio', formatRatio(metricAt(library, 'metrics.libraryCacheMisses'), metricAt(library, 'metrics.libraryCacheHits')), 'miss / hit 기준'],
      ['manifestCacheFullWarnRatio', 'blockManifest', 'manifestCacheEntryRatio', formatRatio(metricAt(blockManifest, 'manifestCacheEntries'), metricAt(blockManifest, 'manifestCacheMax')), '사용률 기준'],
      ['manifestMissToHitWarnRatio', 'blockManifest', 'manifestCacheMissToHitRatio', formatRatio(metricAt(blockManifest, 'metrics.manifestCacheMisses'), metricAt(blockManifest, 'metrics.manifestCacheHits')), 'miss / hit 기준']
    ];
    return definitions.filter(function(item){ return criteria && Object.prototype.hasOwnProperty.call(criteria, item[0]); }).map(function(item){
      return '<tr class="grade-ok cache-threshold-config-row" data-cache-threshold-config-row="v495-cache-threshold-card-layout-pass"><th>' + esc(item[1]) + '</th><td><code>' + esc(item[2]) + '</code></td><td>' + esc(formatDiagnosticValue(item[3])) + '</td><td>' + esc(formatDiagnosticValue(criteria[item[0]])) + '</td><td>' + esc(item[4]) + '</td><td>기준값 표시</td></tr>';
    }).join('');
  }
  function renderCacheMetricWarnings(ioDiagnostics) {
    var thresholds = ioDiagnostics && ioDiagnostics.thresholds;
    if (!isPlainObject(thresholds)) return '';
    var warnings = Array.isArray(thresholds.warnings) ? thresholds.warnings : [];
    var criteria = isPlainObject(thresholds.thresholds) ? thresholds.thresholds : {};
    var summary = '<p class="muted small">marker: <code>' + esc(thresholds.marker || CACHE_METRICS_THRESHOLD_PASS) + '</code> · warn ' + esc(thresholds.warnCount || 0) + ' / error ' + esc(thresholds.errorCount || 0) + '</p>';
    var warningRows = warnings.map(function(item){
      return '<tr class="grade-' + esc(item.grade || 'warn') + '"><th>' + esc(item.scope || '') + '</th><td><code>' + esc(item.metric || item.code || '') + '</code></td><td>' + esc(formatDiagnosticValue(item.value)) + '</td><td>' + esc(formatDiagnosticValue(item.threshold)) + '</td><td>' + esc(item.message || '') + '</td><td>' + esc(item.action || '') + '</td></tr>';
    }).join('');
    var criteriaRows = buildCacheThresholdRows(ioDiagnostics, criteria);
    var rows = warningRows + criteriaRows || '<tr class="grade-ok"><th>summary</th><td><code>cacheThresholds</code></td><td>ok</td><td>-</td><td>운영 경고 기준을 초과한 cache metric이 없습니다.</td><td>추가 조치 없음</td></tr>';
    return '<section class="diagnostics-card diagnostics-cache-thresholds" data-cache-metrics-threshold-pass="' + CACHE_METRICS_THRESHOLD_PASS + '" data-cache-threshold-layout-pass="v495-cache-threshold-card-layout-pass"><h3>Cache metric thresholds</h3>' + summary + '<div class="diagnostics-table-wrap"><table><thead><tr><th>scope</th><th>metric</th><th>값</th><th>기준</th><th>판단</th><th>조치</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }
  function renderIoDiagnosticsTable(ioDiagnostics){
    if (!isPlainObject(ioDiagnostics)) return '';
    var rows = [];
    if (ioDiagnostics.marker) rows.push(['summary', 'marker', ioDiagnostics.marker, 'diagnostics marker']);
    pushIoDiagnosticRows(rows, 'library', ioDiagnostics.library, '');
    pushIoDiagnosticRows(rows, 'content', ioDiagnostics.content, '');
    pushIoDiagnosticRows(rows, 'blockManifest', ioDiagnostics.blockManifest, '');
    var body = rows.map(function(row){
      return '<tr><th>' + esc(row[0]) + '</th><td><code>' + esc(row[1]) + '</code></td><td>' + esc(row[2]) + '</td><td>' + esc(row[3]) + '</td></tr>';
    }).join('');
    return '<section class="diagnostics-card diagnostics-io-table" data-admin-io-diagnostics-table-pass="' + IO_DIAGNOSTICS_TABLE_PASS + '"><h3>I/O cache diagnostics</h3><p class="muted small">library/content/block-manifest cache 상태와 counter를 원본 JSON에서 분리해 표시합니다.</p><div class="diagnostics-table-wrap"><table><thead><tr><th>scope</th><th>항목</th><th>값</th><th>설명</th></tr></thead><tbody>' + body + '</tbody></table></div></section>';
  }

  function renderTunnelExposureDiagnostics(d){
    var exposure = d && d.exposure;
    if (!isPlainObject(exposure)) return '';
    var direct = exposure.directWanExposure || {};
    var headers = exposure.cloudflareHeaders || {};
    var checklist = Array.isArray(exposure.checklist) ? exposure.checklist : [];
    var headerRows = Object.keys(headers).map(function(key){ return '<tr><th>' + esc(key) + '</th><td>' + esc(headers[key] ? 'present' : 'missing') + '</td><td>Cloudflare 경유 요청 판단 보조 header</td></tr>'; }).join('');
    var checklistRows = checklist.map(function(item){ return '<tr><th><code>' + esc(item.code || '') + '</code></th><td>' + esc(item.title || '') + '</td><td>' + esc(item.required ? '필수 확인' : '참고') + '</td></tr>'; }).join('');
    return '<section class="diagnostics-card diagnostics-cf-tunnel-exposure" data-cf-tunnel-exposure-pass="' + CF_TUNNEL_EXPOSURE_PASS + '"><h3>Cloudflare Tunnel 노출 진단</h3><p class="muted small">현재 요청의 Cloudflare header는 자동 확인할 수 있지만, 공유기/WAN에서 NPM·Node 포트가 직접 열려 있는지는 서버 단독으로 확정할 수 없습니다.</p><div class="diagnostics-table-wrap"><table><thead><tr><th>항목</th><th>값</th><th>설명</th></tr></thead><tbody><tr><th>currentRequestLooksCloudflare</th><td>' + esc(exposure.currentRequestLooksCloudflare ? 'yes' : 'no') + '</td><td>CF header 조합 기준</td></tr><tr><th>presentHeaders</th><td>' + esc((exposure.presentHeaders || []).join(', ') || '-') + '</td><td>감지된 Cloudflare header</td></tr><tr><th>directWanExposure</th><td>' + esc(direct.status || 'unknown-server-side') + '</td><td>' + esc(direct.reason || '') + '</td></tr><tr><th>safeExternalEntry</th><td>' + esc(direct.safeExternalEntry || '') + '</td><td>권장 외부 진입점</td></tr><tr><th>CLIENT_IP_HEADER</th><td>' + esc(exposure.clientIpHeader || '-') + '</td><td>' + esc(exposure.clientIpHeaderPresent ? '현재 요청에서 수신됨' : '현재 요청에서 확인되지 않음') + '</td></tr>' + headerRows + '</tbody></table></div><div class="diagnostics-table-wrap"><table><thead><tr><th>체크 코드</th><th>운영자가 확인할 항목</th><th>상태</th></tr></thead><tbody>' + (checklistRows || '<tr><td>-</td><td>표시할 항목 없음</td><td>-</td></tr>') + '</tbody></table></div></section>';
  }

  function renderFindings(findings){
    if (!findings.length) return '<section class="diagnostics-card diagnostics-findings"><h3>조치 항목</h3><p class="muted small">표시할 warn/error 항목이 없습니다.</p></section>';
    return '<section class="diagnostics-card diagnostics-findings"><h3>조치 항목</h3>' + findings.map(function(f){
      return '<article class="diagnostics-finding grade-' + esc(f.grade || 'ok') + '"><div class="diagnostics-finding-head"><strong>' + esc(gradeLabel(f.grade)) + ' · ' + esc(f.title || f.code) + '</strong><code>' + esc(f.code || '') + '</code></div><div class="diagnostics-table-wrap diagnostics-finding-table">' + renderFindingTable(f) + '</div></article>';
    }).join('') + '</section>';
  }
  function isSensitiveDiagnosticKey(key){ return /password|pw|token|secret|cookie|csrf/i.test(String(key || '')); }
  function maskIpLikeValue(value){
    var raw = String(value == null ? '' : value);
    return raw.replace(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g, '$1.$2.x.x');
  }
  function maskPathLikeValue(value){
    var raw = String(value == null ? '' : value);
    if (!raw) return raw;
    var normalized = raw.replace(/\\/g, '/');
    var parts = normalized.split('/').filter(Boolean);
    if (parts.length <= 2) return normalized;
    return '/…/' + parts.slice(-2).join('/');
  }
  function maskOriginLikeValue(value){
    var raw = String(value == null ? '' : value);
    return raw.split(',').map(function(item){
      item = item.trim();
      if (!item) return item;
      try { var u = new URL(item); return u.protocol + '//' + u.hostname.replace(/^(.{2}).+(.{2})$/, '$1…$2') + (u.port ? ':' + u.port : ''); } catch(_e) { return item.length > 12 ? item.slice(0, 4) + '…' + item.slice(-4) : item; }
    }).join(',');
  }
  function maskDiagnosticPayload(value, key, depth){
    if (depth > 8) return '[depth-limited]';
    if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 80).map(function(item){ return maskDiagnosticPayload(item, key, depth + 1); });
    if (typeof value === 'object') {
      var out = {};
      Object.keys(value).forEach(function(childKey){ out[childKey] = maskDiagnosticPayload(value[childKey], childKey, depth + 1); });
      return out;
    }
    var text = String(value);
    if (isSensitiveDiagnosticKey(key)) return text ? '[masked]' : '';
    if (/ip/i.test(String(key || ''))) return maskIpLikeValue(text);
    if (/path|dir|store|library/i.test(String(key || ''))) return maskPathLikeValue(text);
    if (/origin|host|url/i.test(String(key || ''))) return maskOriginLikeValue(text);
    return maskIpLikeValue(text);
  }
  function renderDetailBlock(label, payload){
    var masked = maskDiagnosticPayload(payload || {}, '', 0);
    return '<details class="diagnostics-detail diagnostics-detail-masked" data-admin-raw-diagnostics-mask-pass="' + RAW_DIAGNOSTICS_MASK_PASS + '"><summary>' + esc(label) + ' · 민감값 마스킹</summary><p class="muted small">토큰, 쿠키, CSRF, 비밀번호, IP, 경로, origin/host 일부는 화면 공유 안전성을 위해 마스킹됩니다.</p><pre>' + esc(JSON.stringify(masked || {}, null, 2)) + '</pre></details>';
  }
  function renderAdminDiagnostics(d, extra, options){
    options = options || {};
    d = d || {};
    lastDiagnostics = d;
    lastExtra = extra || null;
    var summary = d.summary || {};
    var findings = maybeFilter(Array.isArray(d.findings) ? d.findings : []);
    var checklist = maybeFilter(Array.isArray(d.checklist) ? d.checklist : []);
    var grade = summary.grade || 'ok';
    var summaryEl = $('admin-diagnostics-summary');
    if (summaryEl) {
      summaryEl.className = 'diagnostics-summary small grade-' + grade;
      summaryEl.textContent = gradeLabel(grade) + ' · ' + (summary.message || '운영 진단 완료') + ' · 오류 ' + (summary.errorCount || 0) + ' / 경고 ' + (summary.warnCount || 0) + (problemOnlyEnabled() ? ' · warn/error 필터 적용' : '');
    }
    var out = $('admin-diagnostics-output');
    if (out) {
      out.dataset.adminDiagnosticsFilterPass = FILTER_PASS;
      out.innerHTML = '<div class="diagnostics-grade grade-' + esc(grade) + '">' + esc(gradeLabel(grade)) + '</div><div class="ops-mini-grid" data-admin-ops-card-pass="' + CARD_PASS + '">' + renderMiniCards(d, extra) + '</div>' + renderSummaryTable(d, extra) + renderChecklistTable(checklist) + renderTunnelExposureDiagnostics(d) + renderFindings(findings) + renderCacheMetricWarnings(d.ioDiagnostics) + renderIoDiagnosticsTable(d.ioDiagnostics) + renderDetailBlock('진단 원본 JSON', d) + (extra ? renderDetailBlock('배포 전 점검 원본 JSON', extra) : '');
    }
    if (!options.skipHistory) saveHistory({ ts:new Date().toISOString(), grade:grade, mode:extra ? 'preflight' : 'diagnostics', message:summary.message || '' });
    renderHistory();
  }
  function bindDiagnosticsFilter(){
    var el = $('admin-diagnostics-problem-only');
    if (!el) return;
    el.dataset.adminDiagnosticsFilterPass = FILTER_PASS;
    el.onchange = function(){ if (lastDiagnostics) renderAdminDiagnostics(lastDiagnostics, lastExtra, { skipHistory:true }); };
  }
  function runDeploymentPreflight(fetchJson){
    var started = Date.now();
    return Promise.allSettled([
      fetch('/healthz', { credentials:'same-origin' }).then(function(r){ return { ok:r.ok, status:r.status }; }),
      fetchJson('/api/time'),
      fetchJson('/api/admin/diagnostics')
    ]).then(function(results){
      var health = results[0].status === 'fulfilled' ? results[0].value : { ok:false, error:String(results[0].reason || 'failed') };
      var time = results[1].status === 'fulfilled' ? results[1].value : { ok:false, error:String(results[1].reason || 'failed') };
      var diag = results[2].status === 'fulfilled' ? results[2].value : { ok:false, summary:{ grade:'error', message:String(results[2].reason || 'diagnostics failed') }, findings:[], checklist:[] };
      var extra = { preflightPass:PREFLIGHT_PASS, elapsedMs:Date.now() - started, healthz:health, timeApi:time && time.ts ? { ok:true, ts:time.ts } : time };
      renderAdminDiagnostics(diag, extra);
      return { diagnostics:diag, preflight:extra };
    });
  }
  global.AdminUsersOps = { PASS:PASS, PREFLIGHT_PASS:PREFLIGHT_PASS, HISTORY_PASS:HISTORY_PASS, CARD_PASS:CARD_PASS, DETAIL_TABLE_PASS:DETAIL_TABLE_PASS, FILTER_PASS:FILTER_PASS, IO_DIAGNOSTICS_TABLE_PASS:IO_DIAGNOSTICS_TABLE_PASS, CF_VISITOR_DIAGNOSTICS_PASS:CF_VISITOR_DIAGNOSTICS_PASS, CF_TUNNEL_EXPOSURE_PASS:CF_TUNNEL_EXPOSURE_PASS, RAW_DIAGNOSTICS_MASK_PASS:RAW_DIAGNOSTICS_MASK_PASS, gradeLabel:gradeLabel, renderAdminDiagnostics:renderAdminDiagnostics, runDeploymentPreflight:runDeploymentPreflight, renderHistory:renderHistory, bindDiagnosticsFilter:bindDiagnosticsFilter };
})(window);
