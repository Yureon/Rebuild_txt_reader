const fs = require('fs');
const path = require('path');

const TXT_READER_MULTI_ADMIN_DIAGNOSTICS_PASS = 'v411-admin-diagnostics-grade-pass';
const TXT_READER_MULTI_ADMIN_DIAGNOSTICS_REMEDIATION_PASS = 'v411-admin-diagnostics-remediation-pass';
const TXT_READER_MULTI_IO_DIAGNOSTICS_CACHE_STATUS_PASS = 'v436-io-diagnostics-cache-status-pass';
const TXT_READER_MULTI_CACHE_METRICS_THRESHOLD_PASS = 'v442-cache-metrics-threshold-diagnostics-pass';
const TXT_READER_MULTI_ADMIN_CF_VISITOR_DIAGNOSTICS_PASS = 'v526-admin-cloudflare-visitor-diagnostics-pass';
const TXT_READER_MULTI_CF_TUNNEL_EXPOSURE_DIAGNOSTICS_PASS = 'v528-cloudflare-tunnel-exposure-diagnostics-pass';
const TXT_READER_MULTI_OWNER_PASSWORD_MIN_LENGTH_ENV_PASS = 'v531-owner-password-min-length-env-pass';
const TXT_READER_MULTI_DISK_CACHE_AUTO_PRUNE_DIAGNOSTICS_PASS = 'v538-disk-cache-auto-prune-diagnostics-pass';

function accessStatus(targetPath, mode) {
  const out = { path: targetPath, exists: fs.existsSync(targetPath), ok: false, error: '' };
  try {
    fs.accessSync(targetPath, mode);
    out.ok = true;
  } catch (error) {
    out.error = error && error.message || String(error);
  }
  return out;
}

function directoryWritableStatus(dirPath) {
  try { fs.mkdirSync(dirPath, { recursive: true }); } catch (error) {}
  return accessStatus(dirPath, fs.constants.R_OK | fs.constants.W_OK);
}

function fileParentWritableStatus(filePath) {
  if (!filePath) return { path: '', exists: false, ok: false, error: 'path unavailable' };
  return directoryWritableStatus(path.dirname(filePath));
}

function countSessions(sessionStore) {
  const out = { total: 0, owner: 0, user: 0 };
  if (!sessionStore || !sessionStore.sessionMeta || typeof sessionStore.sessionMeta.values !== 'function') return out;
  for (const meta of sessionStore.sessionMeta.values()) {
    out.total += 1;
    if (meta && meta.kind === 'owner') out.owner += 1;
    if (meta && meta.kind === 'user') out.user += 1;
  }
  return out;
}

function firstForwardedProto(req) {
  const raw = String(req && req.get && req.get('x-forwarded-proto') || '').trim().toLowerCase();
  return raw.split(',')[0].trim();
}

function firstForwardedScheme(req) {
  const raw = String(req && req.get && req.get('x-forwarded-scheme') || '').trim().toLowerCase();
  return raw.split(',')[0].trim();
}

function getCloudflareVisitorScheme(req) {
  const raw = String(req && req.get && req.get('cf-visitor') || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return String(parsed && parsed.scheme || '').trim().toLowerCase();
  } catch (error) {
    return '';
  }
}

function isCloudflareTunnelMode(mode) {
  return String(mode || '').trim().toLowerCase() === 'cloudflare-tunnel';
}

function isCloudflareVisitorHttpsTrusted(req, mode) {
  return isCloudflareTunnelMode(mode) && getCloudflareVisitorScheme(req) === 'https';
}


function hasHeader(req, name) {
  return !!String(req && req.get && req.get(name) || '').trim();
}

function firstHeaderToken(req, name) {
  const raw = String(req && req.get && req.get(name) || '').trim();
  return raw.split(',')[0].trim();
}

function buildCloudflareTunnelExposureDiagnostics(req, runtime, request) {
  const mode = String(runtime && runtime.deploymentMode || '').trim().toLowerCase();
  const cloudflareHeaders = {
    cfVisitor: hasHeader(req, 'cf-visitor'),
    cfConnectingIp: hasHeader(req, 'cf-connecting-ip'),
    cfRay: hasHeader(req, 'cf-ray'),
    cdnLoop: String(req && req.get && req.get('cdn-loop') || '').toLowerCase().includes('cloudflare'),
    cfIpCountry: hasHeader(req, 'cf-ipcountry')
  };
  const presentHeaders = Object.keys(cloudflareHeaders).filter(key => cloudflareHeaders[key]);
  const cloudflareHeaderScore = presentHeaders.length;
  const currentRequestLooksCloudflare = cloudflareHeaderScore >= 2 || !!(request && request.cloudflareVisitorHttpsTrusted);
  const clientIpHeader = String(process.env.CLIENT_IP_HEADER || '').trim();
  const clientIpHeaderValue = clientIpHeader && req && req.get ? String(req.get(clientIpHeader) || '').trim() : '';
  const directWanExposure = {
    status: 'unknown-server-side',
    automaticVerification: false,
    reason: '서버 내부 요청만으로는 공유기/WAN 포트포워딩 또는 NPM/Node 직접 노출 여부를 확정할 수 없습니다.',
    requiredExternalBlocks: ['NPM 80', 'NPM 443', 'NPM 81', 'Node app port'],
    safeExternalEntry: 'Cloudflare Tunnel public hostname only'
  };
  const checklist = [
    { code: 'wan_block_npm_80', title: 'WAN -> NPM 80 직접 접근 차단', required: true },
    { code: 'wan_block_npm_443', title: 'WAN -> NPM 443 직접 접근 차단', required: true },
    { code: 'wan_block_npm_81', title: 'WAN -> NPM 관리자 81 직접 접근 차단', required: true },
    { code: 'wan_block_node_app', title: 'WAN -> Node 앱 포트 직접 접근 차단', required: true },
    { code: 'cloudflare_tunnel_only_entry', title: '외부 진입점은 Cloudflare Tunnel public hostname만 사용', required: true }
  ];
  return {
    pass: TXT_READER_MULTI_CF_TUNNEL_EXPOSURE_DIAGNOSTICS_PASS,
    mode,
    currentRequestLooksCloudflare,
    cloudflareHeaders,
    presentHeaders,
    cloudflareHeaderScore,
    clientIpHeader,
    clientIpHeaderPresent: !!clientIpHeaderValue,
    clientIpHeaderValue: clientIpHeaderValue ? firstHeaderToken(req, clientIpHeader) : '',
    directWanExposure,
    checklist
  };
}

function firstOrigin(value) {
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean)[0] || '';
}

function normalizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.includes('://') ? raw : `http://${raw}`);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch (error) {
    return raw.replace(/\/$/, '').toLowerCase();
  }
}

function requestExternalOrigin(req, protoOverride = '') {
  const host = String(req && req.get && req.get('host') || '').trim();
  const forwarded = firstForwardedProto(req);
  const proto = protoOverride || forwarded || String(req && req.protocol || '').trim() || 'http';
  return host ? `${proto}://${host}` : '';
}

function pushFinding(findings, grade, code, title, detail, fix, docsRef) {
  findings.push({ grade, code, title, detail, fix, docsRef: docsRef || '', remediationPass: TXT_READER_MULTI_ADMIN_DIAGNOSTICS_REMEDIATION_PASS });
}

function severityRank(grade) {
  if (grade === 'error') return 3;
  if (grade === 'warn') return 2;
  return 1;
}

function summarizeFindings(findings) {
  const errorCount = findings.filter(item => item.grade === 'error').length;
  const warnCount = findings.filter(item => item.grade === 'warn').length;
  const okCount = findings.filter(item => item.grade === 'ok').length;
  const grade = errorCount ? 'error' : warnCount ? 'warn' : 'ok';
  return {
    grade,
    ok: grade !== 'error',
    okCount,
    warnCount,
    errorCount,
    total: findings.length,
    message: grade === 'ok'
      ? '운영 진단 통과'
      : grade === 'warn'
        ? '운영 전 확인이 필요한 경고가 있습니다.'
        : '운영 전 수정해야 하는 오류가 있습니다.'
  };
}


function safeCacheStatus(service) {
  if (!service || typeof service.getCacheStatus !== 'function') return { available: false };
  try {
    const status = service.getCacheStatus();
    return status && typeof status === 'object' ? status : { available: false };
  } catch (error) {
    return { available: false, error: error && error.message || String(error) };
  }
}

function safeDiskCacheJanitorStatus(service) {
  if (!service || typeof service.getStatus !== 'function') return { available: false };
  try {
    const status = service.getStatus();
    return status && typeof status === 'object'
      ? Object.assign({ diagnosticsPass: TXT_READER_MULTI_DISK_CACHE_AUTO_PRUNE_DIAGNOSTICS_PASS }, status)
      : { available: false };
  } catch (error) {
    return { available: false, diagnosticsPass: TXT_READER_MULTI_DISK_CACHE_AUTO_PRUNE_DIAGNOSTICS_PASS, error: error && error.message || String(error) };
  }
}


function numericMetric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pushCacheMetricWarning(warnings, grade, scope, metric, value, threshold, message, action) {
  warnings.push({
    grade,
    code: `cache_${scope}_${metric}`.replace(/[^a-zA-Z0-9_]+/g, '_').toLowerCase(),
    scope,
    metric,
    value,
    threshold,
    message,
    action,
    marker: TXT_READER_MULTI_CACHE_METRICS_THRESHOLD_PASS
  });
}

function buildCacheMetricThresholds(ioDiagnostics) {
  const warnings = [];
  const library = ioDiagnostics && ioDiagnostics.library || {};
  const content = ioDiagnostics && ioDiagnostics.content || {};
  const blockManifest = ioDiagnostics && ioDiagnostics.blockManifest || {};
  const libraryMetrics = library.metrics || {};
  const contentMetrics = content.metrics || {};
  const blockMetrics = blockManifest.metrics || {};

  const contentInflight = numericMetric(content.fileCacheInflightEntries);
  if (contentInflight > 20) {
    pushCacheMetricWarning(warnings, 'warn', 'content', 'fileCacheInflightEntries', contentInflight, 20, 'content cache inflight load가 많이 쌓여 있습니다.', '동시 reader/search 요청이 급증했는지 확인하고, 지속되면 file I/O 병목을 점검하세요.');
  }

  const contentPending = numericMetric(content.chunkIndexPending);
  if (contentPending > 25) {
    pushCacheMetricWarning(warnings, 'warn', 'content', 'chunkIndexPending', contentPending, 25, 'chunk index pending write가 많이 쌓여 있습니다.', '디스크 쓰기 지연 또는 대량 cold read가 있는지 확인하세요.');
  }

  const lastFileReadMs = numericMetric(contentMetrics.lastFileReadMs);
  if (lastFileReadMs > 250) {
    pushCacheMetricWarning(warnings, 'warn', 'content', 'lastFileReadMs', lastFileReadMs, 250, '최근 파일 읽기 시간이 높습니다.', '라이브러리 저장소, SMB/NFS mount, 디스크 I/O 지연을 확인하세요.');
  }

  const fileCacheBytes = numericMetric(content.fileCacheBytes);
  const fileCacheMaxBytes = numericMetric(content.fileCacheLimits && content.fileCacheLimits.maxBytes);
  if (fileCacheMaxBytes > 0 && fileCacheBytes / fileCacheMaxBytes >= 0.9) {
    pushCacheMetricWarning(warnings, 'warn', 'content', 'fileCacheBytes', fileCacheBytes, Math.round(fileCacheMaxBytes * 0.9), 'content file cache 사용량이 한도에 가깝습니다.', 'cache eviction이 잦은지 확인하고 실제 사용량 기반으로 한도 조정을 검토하세요.');
  }

  const fileHits = numericMetric(contentMetrics.fileCacheHits);
  const fileMisses = numericMetric(contentMetrics.fileCacheMisses);
  if (fileHits + fileMisses >= 20 && fileMisses > fileHits * 4) {
    pushCacheMetricWarning(warnings, 'warn', 'content', 'fileCacheMisses', fileMisses, `hits=${fileHits}`, 'content file cache miss 비율이 높습니다.', '요청이 서로 다른 파일/전처리 옵션에 분산되는지 또는 cache 한도가 낮은지 확인하세요.');
  }

  const libraryHits = numericMetric(libraryMetrics.libraryCacheHits);
  const libraryMisses = numericMetric(libraryMetrics.libraryCacheMisses);
  if (libraryHits + libraryMisses >= 20 && libraryMisses > libraryHits * 2) {
    pushCacheMetricWarning(warnings, 'warn', 'library', 'libraryCacheMisses', libraryMisses, `hits=${libraryHits}`, 'library cache miss 비율이 높습니다.', '라이브러리 변경/권한 변경이 잦은지 또는 deep signature TTL이 운영 패턴과 맞지 않는지 확인하세요.');
  }

  const manifestEntries = numericMetric(blockManifest.manifestCacheEntries);
  const manifestMax = numericMetric(blockManifest.manifestCacheMax);
  if (manifestMax > 0 && manifestEntries >= manifestMax) {
    pushCacheMetricWarning(warnings, 'warn', 'blockManifest', 'manifestCacheEntries', manifestEntries, manifestMax, 'block-manifest cache가 한도에 도달했습니다.', 'manifestCacheEvictions 증가 추이를 보고 한도 조정을 검토하세요.');
  }

  const manifestHits = numericMetric(blockMetrics.manifestCacheHits);
  const manifestMisses = numericMetric(blockMetrics.manifestCacheMisses);
  if (manifestHits + manifestMisses >= 20 && manifestMisses > manifestHits * 4) {
    pushCacheMetricWarning(warnings, 'warn', 'blockManifest', 'manifestCacheMisses', manifestMisses, `hits=${manifestHits}`, 'block-manifest cache miss 비율이 높습니다.', '전처리 옵션 분산 또는 cache 한도 부족 여부를 확인하세요.');
  }

  return {
    marker: TXT_READER_MULTI_CACHE_METRICS_THRESHOLD_PASS,
    ok: warnings.length === 0,
    warnCount: warnings.filter(item => item.grade === 'warn').length,
    errorCount: warnings.filter(item => item.grade === 'error').length,
    thresholds: {
      contentInflightWarn: 20,
      contentChunkIndexPendingWarn: 25,
      contentLastFileReadMsWarn: 250,
      contentFileCacheBytesRatioWarn: 0.9,
      contentMissToHitWarnRatio: 4,
      libraryMissToHitWarnRatio: 2,
      manifestCacheFullWarnRatio: 1,
      manifestMissToHitWarnRatio: 4
    },
    warnings
  };
}

function buildChecklist(findings) {
  return findings
    .slice()
    .sort((a, b) => severityRank(b.grade) - severityRank(a.grade) || String(a.code).localeCompare(String(b.code)))
    .map(item => ({
      code: item.code,
      grade: item.grade,
      title: item.title,
      status: item.grade === 'ok' ? '완료' : item.grade === 'warn' ? '확인 필요' : '수정 필요',
      action: item.grade === 'ok' ? '추가 조치 없음' : item.fix,
      docsRef: item.docsRef || ''
    }));
}

function createAdminDiagnosticsService(options = {}) {
  const { paths, env, sessionStore, accountService, auditLogService, libraryService, contentService, blockManifestService, diskCacheJanitorService } = options;
  if (!paths || !env) throw new Error('createAdminDiagnosticsService requires paths/env');

  function buildDiagnostics(req) {
    const libraryPath = env.LIBRARY_PATH || '';
    let libraryNovelCount = null;
    let libraryError = '';
    if (libraryService && typeof libraryService.getLibraryCached === 'function') {
      try {
        const library = libraryService.getLibraryCached();
        libraryNovelCount = Array.isArray(library) ? library.length : null;
      } catch (error) {
        libraryError = error && error.message || String(error);
      }
    }

    const runtime = {
      nodeEnv: String(process.env.NODE_ENV || ''),
      deploymentMode: String(env.DEPLOYMENT_MODE || ''),
      appOrigin: String(env.APP_ORIGIN || ''),
      requireStrictOrigin: !!env.REQUIRE_STRICT_ORIGIN,
      trustProxy: env.resolveTrustProxyValue ? env.resolveTrustProxyValue(env.DEPLOYMENT_MODE) : undefined,
      host: String(env.HOST || ''),
      port: String(env.PORT || ''),
      libraryPath: String(libraryPath || ''),
      ownerPasswordMinLength: Number(env.OWNER_PASSWORD_MIN_LENGTH || 14),
      userPasswordMinLength: Number(env.USER_PASSWORD_MIN_LENGTH || 8),
      ownerPasswordMinLengthPass: TXT_READER_MULTI_OWNER_PASSWORD_MIN_LENGTH_ENV_PASS
    };
    const forwardedProto = firstForwardedProto(req);
    const forwardedScheme = firstForwardedScheme(req);
    const cloudflareVisitorScheme = getCloudflareVisitorScheme(req);
    const cloudflareVisitorHttpsTrusted = isCloudflareVisitorHttpsTrusted(req, runtime.deploymentMode);
    const requestProtocol = String(req && req.protocol || '');
    const requestSecure = !!(req && req.secure);
    const effectiveSecure = requestSecure || requestProtocol.toLowerCase() === 'https' || forwardedProto === 'https' || cloudflareVisitorHttpsTrusted;
    const effectiveProtocol = effectiveSecure ? 'https' : (forwardedProto || forwardedScheme || requestProtocol || 'http');
    const request = {
      protocol: requestProtocol,
      secure: requestSecure,
      host: String(req && req.get && req.get('host') || ''),
      origin: String(req && req.get && req.get('origin') || ''),
      externalOrigin: requestExternalOrigin(req, effectiveProtocol),
      forwardedProto,
      forwardedScheme,
      cloudflareVisitorScheme,
      cloudflareVisitorHttpsTrusted,
      cloudflareVisitorHttpsTrustPass: TXT_READER_MULTI_ADMIN_CF_VISITOR_DIAGNOSTICS_PASS,
      effectiveSecure,
      effectiveProtocol,
      fetchSite: String(req && req.get && req.get('sec-fetch-site') || '')
    };
    const exposure = buildCloudflareTunnelExposureDiagnostics(req, runtime, request);
    const storage = {
      dataDir: directoryWritableStatus(paths.DATA_DIR),
      accountsStore: fileParentWritableStatus(paths.ACCOUNTS_PATH),
      signupCodesStore: paths.SIGNUP_CODES_PATH ? fileParentWritableStatus(paths.SIGNUP_CODES_PATH) : { ok:false, error:'signup code path unavailable' },
      userDataDir: directoryWritableStatus(paths.USER_DATA_DIR),
      fontDir: directoryWritableStatus(paths.FONT_DIR),
      sessionStore: fileParentWritableStatus(paths.SESSION_STORE_PATH),
      auditLog: auditLogService && typeof auditLogService.getStatus === 'function'
        ? auditLogService.getStatus()
        : { ok: false, error: 'audit log service unavailable' },
      libraryPath: accessStatus(libraryPath, fs.constants.R_OK)
    };

    const findings = [];
    const nodeEnv = runtime.nodeEnv.toLowerCase();
    const mode = runtime.deploymentMode;
    const forwarded = request.forwardedProto;
    const externalOrigin = normalizeOrigin(request.externalOrigin);
    const configuredOrigin = normalizeOrigin(firstOrigin(runtime.appOrigin));
    const ownerPassword = String(env.ADMIN_PW || process.env.LOGINPW || process.env.LoginPW || '').trim();

    if (nodeEnv === 'production' && !request.effectiveSecure) {
      pushFinding(findings, 'error', 'production_https', 'production HTTPS 미감지', 'NODE_ENV=production인데 현재 요청이 HTTPS로 인식되지 않습니다.', 'HTTPS reverse proxy/tunnel에서 접속하고 X-Forwarded-Proto: https를 전달하세요. Cloudflare Tunnel+NPM 조합이면 CF-Visitor scheme도 확인하세요.', 'docs/deployment-guide.md#production-session-cookie');
    } else {
      const detail = request.cloudflareVisitorHttpsTrusted
        ? 'CF-Visitor scheme=https를 cloudflare-tunnel 모드에서 신뢰해 production cookie 정책과 충돌하지 않습니다.'
        : '현재 요청 보안 컨텍스트가 production cookie 정책과 충돌하지 않습니다.';
      pushFinding(findings, 'ok', 'production_https', 'HTTPS/production 조합', detail, '', 'docs/deployment-guide.md');
    }

    if ((mode === 'trusted-proxy' || mode === 'cloudflare-tunnel') && !forwarded) {
      pushFinding(findings, 'warn', 'forwarded_proto_missing', 'proxy header 누락', `${mode} 모드이지만 X-Forwarded-Proto가 비어 있습니다.`, 'NPM/Cloudflare/Nginx에서 X-Forwarded-Proto를 원본 요청 scheme으로 전달하세요.', 'docs/proxy-tunnel-setup.md');
    } else if (mode === 'cloudflare-tunnel' && forwarded !== 'https' && nodeEnv === 'production' && request.cloudflareVisitorHttpsTrusted) {
      pushFinding(findings, 'ok', 'forwarded_proto_cf_visitor', 'proxy scheme 보조 판정', `X-Forwarded-Proto=${forwarded || '(empty)'}이지만 CF-Visitor scheme=https를 신뢰했습니다.`, 'NPM이 X-Forwarded-Proto를 http로 덮어쓰는 경우입니다. origin 직접 노출 차단을 유지하세요.', 'docs/proxy-tunnel-setup.md#cloudflare-tunnel--npm에서-x-forwarded-proto가-http로-보일-때');
    } else if ((mode === 'trusted-proxy' || mode === 'cloudflare-tunnel') && forwarded !== 'https' && nodeEnv === 'production') {
      pushFinding(findings, 'error', 'forwarded_proto_mismatch', 'proxy scheme 불일치', `production ${mode} 모드에서 X-Forwarded-Proto=${forwarded || '(empty)'}.`, '외부 접속은 HTTPS로 고정하고 proxy header가 https로 전달되는지 확인하세요.', 'docs/proxy-tunnel-setup.md');
    } else {
      pushFinding(findings, 'ok', 'forwarded_proto', 'proxy scheme header', forwarded ? `X-Forwarded-Proto=${forwarded}` : 'direct 모드 또는 내부망 요청으로 판단됩니다.', '', 'docs/proxy-tunnel-setup.md');
    }

    if (mode === 'cloudflare-tunnel') {
      const cfDetail = request.cloudflareVisitorScheme
        ? `CF-Visitor scheme=${request.cloudflareVisitorScheme}, trusted=${request.cloudflareVisitorHttpsTrusted}`
        : 'CF-Visitor header가 없습니다.';
      pushFinding(findings, request.cloudflareVisitorHttpsTrusted ? 'ok' : 'warn', 'cloudflare_visitor_scheme', 'Cloudflare visitor scheme', cfDetail, request.cloudflareVisitorHttpsTrusted ? '' : 'Cloudflare Tunnel 경유 요청인지와 CF-Visitor header 전달 여부를 확인하세요.', 'docs/proxy-tunnel-setup.md#cloudflare-tunnel--npm에서-x-forwarded-proto가-http로-보일-때');
    }

    if (mode === 'cloudflare-tunnel') {
      const exposureDetail = exposure.currentRequestLooksCloudflare
        ? `현재 요청은 Cloudflare 계열 header(${exposure.presentHeaders.join(', ') || 'none'})를 포함합니다. 단, WAN 직접 노출 여부는 서버 단독으로 확정할 수 없습니다.`
        : 'cloudflare-tunnel 모드인데 현재 요청에서 Cloudflare 계열 header가 충분히 보이지 않습니다.';
      const exposureFix = exposure.currentRequestLooksCloudflare
        ? '공유기/방화벽에서 NPM 80/443/81과 Node 앱 포트가 WAN에 직접 노출되지 않는지 별도로 확인하세요.'
        : 'Cloudflare Tunnel public hostname으로 접속했는지, NPM/Node 직접 접근 경로가 아닌지 확인하세요.';
      pushFinding(findings, exposure.currentRequestLooksCloudflare ? 'ok' : 'warn', 'cloudflare_tunnel_exposure_assumption', 'Cloudflare Tunnel 노출 전제', exposureDetail, exposureFix, 'docs/proxy-tunnel-setup.md#cloudflare-tunnel-신뢰-전제');
      if (exposure.clientIpHeader && !exposure.clientIpHeaderPresent) {
        pushFinding(findings, 'warn', 'client_ip_header_missing', 'CLIENT_IP_HEADER 미수신', `CLIENT_IP_HEADER=${exposure.clientIpHeader}이지만 현재 요청에 해당 header 값이 없습니다.`, 'NPM/Cloudflare가 원 방문자 IP header를 Node까지 전달하는지 확인하세요.', 'docs/proxy-tunnel-setup.md#cloudflare-tunnel-신뢰-전제');
      }
    }

    if (configuredOrigin && externalOrigin && configuredOrigin !== externalOrigin) {
      pushFinding(findings, 'warn', 'app_origin_mismatch', 'APP_ORIGIN 불일치 가능성', `APP_ORIGIN 첫 항목(${configuredOrigin})과 현재 요청 origin(${externalOrigin})이 다릅니다.`, '브라우저 주소창 origin을 APP_ORIGIN/URL에 쉼표 구분으로 추가하세요.', 'docs/deployment-guide.md#origin-설정');
    } else if (!configuredOrigin) {
      const originGrade = nodeEnv === 'production' && runtime.requireStrictOrigin ? 'error' : 'warn';
      const originDetail = originGrade === 'error'
        ? 'production strict origin mode blocks unsafe API requests until APP_ORIGIN or URL is configured.'
        : '허용 origin이 비어 있어 development Host fallback에 의존합니다.';
      pushFinding(findings, originGrade, 'app_origin_empty', 'APP_ORIGIN 미설정', originDetail, '외부망 운영 전 APP_ORIGIN 또는 URL에 실제 접속 origin을 설정하세요.', 'docs/deployment-guide.md#origin-설정');
    } else {
      pushFinding(findings, 'ok', 'app_origin', 'APP_ORIGIN', `Configured origin: ${configuredOrigin}`, '', 'docs/deployment-guide.md#origin-설정');
    }

    const ownerPasswordMinLength = Math.max(10, Number(runtime.ownerPasswordMinLength || env.OWNER_PASSWORD_MIN_LENGTH || 14));
    if (nodeEnv === 'production' && ownerPassword.length < ownerPasswordMinLength) {
      pushFinding(findings, 'error', 'owner_password_policy', 'owner 비밀번호 길이 부족', `production owner LOGINPW가 공백 제거 기준 ${ownerPasswordMinLength}글자 미만입니다.`, `LOGINPW를 ${ownerPasswordMinLength}글자 이상으로 바꾸거나 OWNER_PASSWORD_MIN_LENGTH를 조정하고 서버를 재시작하세요.`, 'docs/security.md');
    } else {
      pushFinding(findings, 'ok', 'owner_password_policy', 'owner 비밀번호 정책', `현재 owner 비밀번호 정책이 배포 모드와 충돌하지 않습니다. minimum=${ownerPasswordMinLength}`, '', 'docs/security.md');
    }

    const writableTargets = [storage.dataDir, storage.accountsStore, storage.signupCodesStore, storage.userDataDir, storage.fontDir, storage.sessionStore];
    const badWritable = writableTargets.filter(item => !item || !item.ok);
    if (badWritable.length || !storage.auditLog?.writable) {
      pushFinding(findings, 'error', 'storage_writable', '저장소 쓰기 권한 문제', `쓰기 불가 저장소 ${badWritable.length}개, audit writable=${!!storage.auditLog?.writable}.`, 'data volume 소유권과 컨테이너 mount 권한을 확인하세요.', 'docs/operations-checklist.md#10-배포-zip-확인');
    } else {
      pushFinding(findings, 'ok', 'storage_writable', '저장소 쓰기 권한', 'data/accounts/user/font/session/audit 저장소가 쓰기 가능으로 확인되었습니다.', '', 'docs/operations-checklist.md');
    }

    if (!storage.libraryPath.ok || libraryError) {
      pushFinding(findings, 'error', 'library_readable', '라이브러리 읽기/스캔 문제', storage.libraryPath.error || libraryError || 'library unavailable', 'LIBRARY_PATH가 실제 TXT 라이브러리 경로를 가리키고 컨테이너에서 읽을 수 있는지 확인하세요.', 'docs/deployment-guide.md#필수-환경변수');
    } else {
      pushFinding(findings, 'ok', 'library_readable', '라이브러리 읽기', `cached novels: ${libraryNovelCount == null ? 'unknown' : libraryNovelCount}`, '', 'docs/deployment-guide.md#필수-환경변수');
    }

    const summary = summarizeFindings(findings);

    return {
      ok: summary.ok,
      pass: TXT_READER_MULTI_ADMIN_DIAGNOSTICS_PASS,
      diagnosticsGradePass: TXT_READER_MULTI_ADMIN_DIAGNOSTICS_PASS,
      remediationPass: TXT_READER_MULTI_ADMIN_DIAGNOSTICS_REMEDIATION_PASS,
      summary,
      findings,
      checklist: buildChecklist(findings),
      runtime,
      request,
      exposure,
      storage,
      accounts: {
        userCount: accountService && typeof accountService.listUsers === 'function' ? accountService.listUsers().length : null
      },
      sessions: countSessions(sessionStore),
      library: {
        cachedNovelCount: libraryNovelCount,
        error: libraryError
      },
      ioDiagnostics: (() => {
        const ioDiagnostics = {
          marker: TXT_READER_MULTI_IO_DIAGNOSTICS_CACHE_STATUS_PASS,
          library: safeCacheStatus(libraryService),
          content: safeCacheStatus(contentService),
          blockManifest: safeCacheStatus(blockManifestService),
          diskCacheJanitor: safeDiskCacheJanitorStatus(diskCacheJanitorService)
        };
        ioDiagnostics.thresholds = buildCacheMetricThresholds(ioDiagnostics);
        return ioDiagnostics;
      })()
    };
  }

  return { buildDiagnostics };
}

module.exports = {
  TXT_READER_MULTI_ADMIN_DIAGNOSTICS_PASS,
  TXT_READER_MULTI_ADMIN_DIAGNOSTICS_REMEDIATION_PASS,
  TXT_READER_MULTI_IO_DIAGNOSTICS_CACHE_STATUS_PASS,
  TXT_READER_MULTI_CACHE_METRICS_THRESHOLD_PASS,
  TXT_READER_MULTI_ADMIN_CF_VISITOR_DIAGNOSTICS_PASS,
  TXT_READER_MULTI_CF_TUNNEL_EXPOSURE_DIAGNOSTICS_PASS,
  TXT_READER_MULTI_DISK_CACHE_AUTO_PRUNE_DIAGNOSTICS_PASS,
  createAdminDiagnosticsService,
  getCloudflareVisitorScheme,
  isCloudflareVisitorHttpsTrusted,
  buildCloudflareTunnelExposureDiagnostics
};
