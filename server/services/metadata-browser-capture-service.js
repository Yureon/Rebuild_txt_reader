const crypto = require('crypto');
const { metadataTitleSimilarity } = require('./metadata-site-adapters');
const { getMetadataProvider, resolveDirectMetadataTarget, isHostAllowed } = require('./metadata-provider-registry');

const METADATA_BROWSER_CAPTURE_PASS = 'v579-metadata-browser-capture-pass';
const PAIRING_TTL_MS = 15 * 60 * 1000;
const PAIRING_MAX = 512;

function clean(value, max = 300) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanList(value, maxItems, maxChars = 80) {
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(value) ? value : []) {
    const text = clean(typeof item === 'object' && item ? item.name : item, maxChars).replace(/^#+/u, '');
    const key = text.toLocaleLowerCase('ko-KR');
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}
function normalizeStatus(value) {
  const text = clean(value, 80);
  if (!text) return null;
  if (/완결|complete|finished/iu.test(text)) return 'completed';
  if (/연재|ongoing|serial/iu.test(text)) return 'ongoing';
  if (/중단|휴재|hiatus|paused/iu.test(text)) return 'hiatus';
  return text;
}
function normalizeYear(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1000 && number <= 2100 ? number : null;
}
function normalizeEvidence(value) {
  const input = value && typeof value === 'object' ? value : {};
  const fieldSources = {};
  for (const [key, source] of Object.entries(input.fieldSources && typeof input.fieldSources === 'object' ? input.fieldSources : {}).slice(0, 16)) {
    const name = clean(key, 40);
    const text = clean(source, 40);
    if (name && text) fieldSources[name] = text;
  }
  return {
    fieldSources,
    jsonLdTypes:cleanList(input.jsonLdTypes, 20, 80),
    documentTitle:clean(input.documentTitle, 500) || null
  };
}
function safeCoverUrl(provider, value, warnings) {
  if (!String(value || '').trim()) return null;
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !isHostAllowed(provider, url.hostname, 'cover')) {
      warnings.push('표지 URL이 공급자 HTTPS 허용 범위를 벗어나 제외되었습니다.');
      return null;
    }
    url.hash = '';
    return url.toString();
  } catch {
    warnings.push('표지 URL 형식이 올바르지 않아 제외되었습니다.');
    return null;
  }
}
function normalizeCapture(input, provider, target, synopsisMax = 8000) {
  const source = input && typeof input === 'object' ? input : {};
  const title = clean(source.title, 300);
  if (!title) throw Object.assign(new Error('브라우저 캡처 결과에 작품명이 없습니다.'), { code:'METADATA_BROWSER_CAPTURE_TITLE_REQUIRED' });
  const warnings = [];
  const coverUrl = safeCoverUrl(provider, source.coverUrl, warnings);
  const capturedAt = (() => {
    const date = new Date(String(source.capturedAt || ''));
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  })();
  const evidence = { ...normalizeEvidence(source.evidence), capturedAt, source:'browser-capture-v1' };
  const extracted = {
    remoteId:target.remoteId,
    sourceUrl:target.canonicalUrl,
    title,
    originalTitle:clean(source.originalTitle, 300) || null,
    author:clean(source.author, 300) || null,
    synopsis:clean(source.synopsis, synopsisMax) || null,
    genres:cleanList(source.genres, 20, 80),
    tags:cleanList(source.tags, 40, 80),
    publicationStatus:normalizeStatus(source.publicationStatus),
    publicationYear:normalizeYear(source.publicationYear),
    sourceLanguage:clean(source.sourceLanguage, 80) || null,
    coverUrl,
    rawSha256:crypto.createHash('sha256').update(JSON.stringify({ providerId:provider.id, target:target.canonicalUrl, title, source, evidence })).digest('hex')
  };
  return { extracted, evidence, warnings };
}

function createMetadataBrowserCaptureService(options = {}) {
  const store = options.store;
  const coverService = options.coverService;
  const describeProviders = options.describeProviders;
  const synopsisMax = Math.max(1000, Math.min(20000, Number(options.synopsisMax) || 8000));
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const pairings = new Map();
  if (!store || !coverService || typeof describeProviders !== 'function') throw new Error('browser capture dependencies are required');

  function cleanup(nowMs = now()) {
    for (const [token, pairing] of pairings) if (pairing.expiresAtMs <= nowMs) pairings.delete(token);
    while (pairings.size >= PAIRING_MAX) {
      const oldest = pairings.keys().next().value;
      if (!oldest) break;
      pairings.delete(oldest);
    }
  }
  function createPairing(novel, actorId) {
    cleanup();
    const providers = describeProviders().filter(item => item.enabled && item.supportsDirect !== false).map(item => {
      const raw = getMetadataProvider(item.id);
      return { id:item.id, name:item.name, hosts:Array.from(new Set(raw && raw.detailHosts || [])) };
    }).filter(item => item.hosts.length);
    if (!providers.length) throw Object.assign(new Error('브라우저 캡처를 지원하는 활성 공급자가 없습니다.'), { code:'METADATA_BROWSER_CAPTURE_PROVIDER_REQUIRED' });
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAtMs = now() + PAIRING_TTL_MS;
    pairings.set(token, { novelId:String(novel && novel.id || ''), actorId:String(actorId || ''), expiresAtMs });
    return {
      workId:String(novel && novel.id || ''),
      workTitle:clean(novel && novel.title, 300),
      token,
      expiresAt:new Date(expiresAtMs).toISOString(),
      expiresInSeconds:Math.floor(PAIRING_TTL_MS / 1000),
      providers,
      pass:METADATA_BROWSER_CAPTURE_PASS
    };
  }
  async function importCapture(novel, actorId, pairingToken, input) {
    const token = String(pairingToken || '').trim();
    if (!/^[A-Za-z0-9_-]{32,160}$/u.test(token)) throw Object.assign(new Error('브라우저 캡처 pairing token 형식이 올바르지 않습니다.'), { code:'METADATA_BROWSER_CAPTURE_TOKEN_INVALID' });
    cleanup();
    const pairing = pairings.get(token);
    if (!pairing || pairing.novelId !== String(novel && novel.id || '') || pairing.actorId !== String(actorId || '')) {
      throw Object.assign(new Error('브라우저 캡처 pairing token이 만료되었거나 현재 작품과 일치하지 않습니다.'), { code:'METADATA_BROWSER_CAPTURE_TOKEN_FORBIDDEN' });
    }
    const pageUrl = clean(input && input.pageUrl, 2048);
    const target = resolveDirectMetadataTarget(pageUrl);
    if (!target) throw Object.assign(new Error('현재 페이지는 지원되는 공식 작품 상세 URL이 아닙니다.'), { code:'METADATA_BROWSER_CAPTURE_URL_UNSUPPORTED' });
    const descriptor = describeProviders().find(item => item.id === target.providerId);
    if (!descriptor || !descriptor.enabled) throw Object.assign(new Error('현재 페이지의 메타데이터 공급자가 비활성화되어 있습니다.'), { code:'METADATA_PROVIDER_DISABLED' });
    const provider = getMetadataProvider(target.providerId);
    const normalized = normalizeCapture(input, provider, target, synopsisMax);
    const score = metadataTitleSimilarity(novel.title, normalized.extracted.title);
    if (score < 0.65) normalized.warnings.push('현재 작품명과 캡처 결과의 일치도가 낮습니다. 적용 전에 반드시 확인하십시오.');
    let candidate = store.saveCandidate(novel, provider, normalized.extracted, {
      direct:true,
      matchScore:score,
      query:'browser-capture-v1'
    });
    let pendingCoverAssetId = '';
    if (normalized.extracted.coverUrl) {
      try {
        const cover = await coverService.cacheRemoteCover(provider, normalized.extracted.coverUrl, {
          referer:target.canonicalUrl
        });
        if (cover) {
          candidate = store.updateCandidateCover(candidate.id, cover);
          if (candidate) pendingCoverAssetId = cover.assetId;
        }
      } catch (error) {
        normalized.warnings.push(`표지 다운로드 실패: ${clean(error && error.message || error, 300)}`);
      }
    }
    await store.flush();
    if (pendingCoverAssetId) {
      try {
        if (typeof coverService.releaseAssetLeaseDurably === 'function') await coverService.releaseAssetLeaseDurably(pendingCoverAssetId);
        else if (typeof coverService.releaseAssetLease === 'function') coverService.releaseAssetLease(pendingCoverAssetId);
      } catch (error) {
        normalized.warnings.push(`표지 보호 상태 정리 실패: ${clean(error && error.message || error, 300)}`);
      }
    }
    pairings.delete(token);
    return { candidate, provider, evidence:normalized.evidence, warnings:normalized.warnings, pass:METADATA_BROWSER_CAPTURE_PASS };
  }
  return { createPairing, importCapture, cleanup, pass:METADATA_BROWSER_CAPTURE_PASS };
}

module.exports = {
  METADATA_BROWSER_CAPTURE_PASS,
  PAIRING_TTL_MS,
  PAIRING_MAX,
  normalizeCapture,
  createMetadataBrowserCaptureService
};
