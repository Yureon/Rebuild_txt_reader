const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { deriveMetadataSearchCandidates, deriveMetadataSearchQueryVariants } = require('./metadata-search-terms');
const { metadataTitleSimilarity } = require('./metadata-site-adapters');
const { getMetadataProvider: getBuiltinMetadataProvider, listMetadataProviders: listBuiltinMetadataProviders, resolveDirectMetadataTarget } = require('./metadata-provider-registry');
const { createConfigurableProvider, createBuiltinRequestOverrideProvider, normalizeDefinition, CONFIGURABLE_PROVIDER_PASS } = require('./metadata-configurable-provider');
const { createMetadataQueueService } = require('./metadata-queue-service');
const { createMetadataBrowserCaptureService } = require('./metadata-browser-capture-service');
const { durableRenameAsync, durableRemoveAsync, durableRemoveSync, fsyncDirectorySync } = require('../repositories/json-file-store');

const METADATA_COLLECTION_PASS = 'v579-metadata-live-recovery-pass';
const BULK_JOB_TYPE = 'collect-bulk';
const METADATA_BULK_RESTART_RESUME_PASS = 'v614-metadata-bulk-restart-resume-pass';
const METADATA_BULK_COLLECTED_SKIP_PASS = 'v614-metadata-bulk-collected-skip-pass';
const METADATA_AUTO_APPLY_RECOVERY_PASS = 'v614-metadata-auto-apply-recovery-pass';
const METADATA_SCORE_FIRST_LIVE_COMPETITION_PASS = 'v627-metadata-score-first-live-competition-pass';
const METADATA_ABORT_SAFE_PACING_PASS = 'v627-metadata-abort-safe-pacing-pass';
const METADATA_PROVIDER_COMPLETION_COOLDOWN_PASS = 'v669-metadata-provider-completion-cooldown-pass';
const METADATA_LOW_CPU_COLLECTION_PASS = 'v672-metadata-low-cpu-collection-pass';
const METADATA_AUTO_APPLY_POLICY_PASS = 'v619-metadata-auto-apply-score-priority-pass';
const METADATA_BULK_APPLY_PASS = 'v619-metadata-bulk-apply-pass';
const METADATA_EQUIVALENT_GROUP_PASS = 'v638-metadata-equivalent-group-pass';
const APPLY_PENDING_JOB_TYPE = 'apply-pending-bulk';
const BULK_BATCH_RE = /^mb_[a-f0-9]{24}$/;
const REQUEST_DELAY_MIN_MULTIPLIER = 1.5;
const REQUEST_DELAY_MAX_MULTIPLIER = 2;

function abortError(signal) {
  return signal && signal.reason || Object.assign(new Error('metadata job cancelled'), { code:'METADATA_JOB_CANCELLED' });
}
function sleep(ms, signal = null) {
  const delay = Math.max(0, Number(ms) || 0);
  if (!delay) {
    if (signal && signal.aborted) return Promise.reject(abortError(signal));
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(abortError(signal));
    const timer = setTimeout(done, delay);
    timer.unref?.();
    function done() {
      if (signal) signal.removeEventListener('abort', cancelled);
      resolve();
    }
    function cancelled() {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', cancelled);
      reject(abortError(signal));
    }
    if (signal) signal.addEventListener('abort', cancelled, { once:true });
  });
}
function clean(value, max = 300) { return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function snapshotNovel(novel) {
  return {
    id:String(novel && novel.id || ''),
    title:clean(novel && novel.title, 300),
    author:clean(novel && novel.author, 160),
    categoryPath:clean(novel && novel.categoryPath, 600),
    sourceKey:clean(novel && (novel.singlePath || novel.categoryPath || novel.fileName || ''), 1200),
    progressAliases:Array.from(new Set([novel && novel.id, ...(Array.isArray(novel && novel.progressAliases) ? novel.progressAliases : [])].map(String).filter(Boolean))).slice(0,256)
  };
}
function publicMetadataData(data = {}) {
  const { coverRemoteUrl, rawSha256, coverMime, ...safe } = data || {};
  return safe;
}
function publicMetadataSourceUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch (_) { return ''; }
}
function publicCandidate(candidate) {
  if (!candidate) return null;
  return { ...candidate, sourceUrl:publicMetadataSourceUrl(candidate.sourceUrl), data:publicMetadataData(candidate.data) };
}
function publicApplied(applied) {
  if (!applied) return null;
  return {
    ...applied,
    sourceUrl:publicMetadataSourceUrl(applied.sourceUrl),
    coverSourceUrl:publicMetadataSourceUrl(applied.coverSourceUrl),
    data:publicMetadataData(applied.data)
  };
}
function candidateFields(candidate) {
  const data = candidate && candidate.data || {};
  const out = [];
  if (data.title) out.push('title');
  if (data.author) out.push('author');
  if (data.synopsis) out.push('synopsis');
  if (Array.isArray(data.genres) && data.genres.length) out.push('genres');
  if (Array.isArray(data.tags) && data.tags.length) out.push('tags');
  if (data.publicationStatus) out.push('publicationStatus');
  if (data.publicationYear) out.push('publicationYear');
  if (data.sourceLanguage) out.push('sourceLanguage');
  if (data.coverAssetId && data.coverUrl) out.push('cover');
  return out;
}
function computeRandomRequestDelayMs(baseMs, randomValue = Math.random()) {
  const base = Math.max(1, Number(baseMs) || 1);
  const unit = Math.max(0, Math.min(0.999999, Number(randomValue) || 0));
  const multiplier = REQUEST_DELAY_MIN_MULTIPLIER + ((REQUEST_DELAY_MAX_MULTIPLIER - REQUEST_DELAY_MIN_MULTIPLIER) * unit);
  return Math.max(1, Math.round(base * multiplier));
}

function createProviderCompletionCooldownCoordinator(options = {}) {
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const delay = typeof options.delay === 'function' ? options.delay : sleep;
  const cooldownMsForProvider = typeof options.cooldownMsForProvider === 'function'
    ? options.cooldownMsForProvider
    : () => 0;
  const nextAllowedAtByProvider = new Map();
  const tailByProvider = new Map();

  async function run(providerId, signal, operation, onWait = null) {
    if (typeof operation !== 'function') throw new TypeError('metadata provider cooldown operation is required');
    const key = clean(providerId, 120) || 'unknown-provider';
    const previous = tailByProvider.get(key) || Promise.resolve();
    let releaseGate;
    const gate = new Promise(resolve => { releaseGate = resolve; });
    const tail = previous.catch(() => {}).then(() => gate);
    tailByProvider.set(key, tail);
    let collectionStarted = false;
    try {
      await previous.catch(() => {});
      if (signal?.aborted) throw abortError(signal);
      const currentNow = Math.max(0, Number(now()) || 0);
      const notBefore = Math.max(0, Number(nextAllowedAtByProvider.get(key)) || 0);
      const waitMs = Math.max(0, notBefore - currentNow);
      if (waitMs > 0) {
        try { onWait?.(waitMs); } catch {}
        await delay(waitMs, signal);
      }
      if (signal?.aborted) throw abortError(signal);
      collectionStarted = true;
      return await operation();
    } finally {
      if (collectionStarted) {
        const completedAt = Math.max(0, Number(now()) || 0);
        const cooldownMs = Math.max(0, Number(cooldownMsForProvider(key)) || 0);
        nextAllowedAtByProvider.set(key, completedAt + cooldownMs);
      }
      releaseGate();
      if (tailByProvider.get(key) === tail) {
        tail.finally(() => {
          if (tailByProvider.get(key) === tail) tailByProvider.delete(key);
        });
      }
    }
  }

  function status(providerId) {
    const key = clean(providerId, 120) || 'unknown-provider';
    const currentNow = Math.max(0, Number(now()) || 0);
    const nextAllowedAt = Math.max(0, Number(nextAllowedAtByProvider.get(key)) || 0);
    return {
      providerId:key,
      nextAllowedAt,
      remainingMs:Math.max(0, nextAllowedAt - currentNow),
      queued:tailByProvider.has(key),
      pass:METADATA_PROVIDER_COMPLETION_COOLDOWN_PASS
    };
  }

  return { run, status, pass:METADATA_PROVIDER_COMPLETION_COOLDOWN_PASS };
}


function classifyProviderFailure(error, stage = 'request') {
  const code = clean(error && (error.code || error.cause && error.cause.code), 120) || 'METADATA_PROVIDER_ERROR';
  const message = clean(error && error.message || error, 500) || '알 수 없는 공급자 오류';
  let category = stage;
  if (/^(?:EAI_AGAIN|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|METADATA_DNS_)/u.test(code) || /DNS|name resolution|getaddrinfo/iu.test(message)) category = 'dns';
  else if (code === 'METADATA_TIMEOUT' || /timed?\s*out|timeout/iu.test(message)) category = 'timeout';
  else if (code === 'METADATA_HTTP_ERROR') category = 'http';
  else if (code === 'METADATA_BROWSER_CAPTURE_REQUIRED') category = 'browser_capture_required';
  else if (code === 'METADATA_PLAYWRIGHT_LOGIN_REQUIRED') category = 'login_required';
  else if (code === 'METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED') category = 'age_verification_required';
  else if (/PARSE|DETAIL_EMPTY|SEARCH_EMPTY/u.test(code)) category = code.includes('DETAIL') ? 'detail_parse' : 'search_parse';
  else if (/URL|HOST|PATH|SSRF/u.test(code)) category = 'security_contract';
  return {
    code,
    stage:category,
    statusCode:Number(error && error.statusCode) || null,
    message
  };
}
function looksLikeJavascriptShell(body) {
  const html = String(body || '');
  return /you need to enable javascript|<div[^>]+id=["'](?:root|app)["'][^>]*>\s*<\/div>|__NEXT_DATA__|webpackJsonp/iu.test(html)
    && !/<meta[^>]+(?:property|name)=["'](?:og:title|description)["'][^>]+content=/iu.test(html);
}

function normalizeProviderIds(value) {
  return Array.from(new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))).slice(0,10);
}
function safeBulkBatchId(value) {
  const id = String(value || '');
  if (!BULK_BATCH_RE.test(id)) throw Object.assign(new Error('metadata bulk batch id is invalid'), { code:'METADATA_BULK_BATCH_INVALID' });
  return id;
}

function createMetadataService(options = {}) {
  const store = options.store;
  const transport = options.transport;
  const coverService = options.coverService;
  const logger = options.logger || console;
  const playwrightService = options.playwrightService || null;
  const queuePath = options.queuePath;
  const bulkDir = path.resolve(String(options.bulkDir || path.join(path.dirname(queuePath || '.'), 'metadata-batches')));
  const enabled = options.enabled !== false;
  const requestIntervalMs = Math.max(3000, Math.min(60000, Number(options.requestIntervalMs) || 3000));
  const searchLimit = Math.max(1, Math.min(10, Number(options.searchLimit) || 5));
  const autoApplyThreshold = Math.max(0.7, Math.min(1, Number(options.autoApplyThreshold) || 0.95));
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const delay = typeof options.delay === 'function' ? options.delay : sleep;
  const requestCacheByContext = new WeakMap();

  if (!store || !transport || !coverService || !queuePath) throw new Error('metadata service dependencies are required');
  fs.mkdirSync(bulkDir, { recursive:true, mode:0o700 });
  try { fs.chmodSync(bulkDir, 0o700); } catch {}

  const builtinProviderIds = new Set(listBuiltinMetadataProviders().map(provider => String(provider.id || '')).filter(Boolean));

  function providerDefinition(providerId) {
    return typeof store.getProviderDefinition === 'function' ? store.getProviderDefinition(providerId) : null;
  }

  function runtimeProvider(providerId) {
    const id = String(providerId || '');
    const base = getBuiltinMetadataProvider(id);
    const definition = providerDefinition(id);
    if (base) {
      if (definition) {
        try { return definition.mode === 'selector' ? createConfigurableProvider(definition, base) : createBuiltinRequestOverrideProvider(definition, base); }
        catch (error) { logger?.warn?.(`metadata builtin provider override ignored (${id}):`, error && error.message || error); }
      }
      return { ...base, providerKind:'builtin', definitionMode:'builtin', definition:null };
    }
    if (!definition || definition.kind !== 'custom') return null;
    try { return createConfigurableProvider(definition); }
    catch (error) {
      logger?.warn?.(`metadata custom provider ignored (${id}):`, error && error.message || error);
      return null;
    }
  }

  function listRuntimeProviders() {
    const result = [];
    for (const descriptor of listBuiltinMetadataProviders()) {
      const provider = runtimeProvider(descriptor.id);
      if (provider) result.push(provider);
    }
    const definitions = typeof store.listProviderDefinitions === 'function' ? store.listProviderDefinitions() : [];
    for (const definition of definitions) {
      if (!definition || definition.kind !== 'custom' || builtinProviderIds.has(String(definition.id || ''))) continue;
      const provider = runtimeProvider(definition.id);
      if (provider) result.push(provider);
    }
    return result;
  }

  function resolveRuntimeDirectMetadataTarget(value) {
    const builtinTarget = resolveDirectMetadataTarget(String(value || ''));
    if (builtinTarget) {
      const provider = runtimeProvider(builtinTarget.providerId);
      return provider ? { ...builtinTarget, provider } : null;
    }
    let parsed;
    try { parsed = new URL(String(value || '')); } catch { return null; }
    if (parsed.protocol !== 'https:') return null;
    for (const provider of listRuntimeProviders()) {
      if (provider.providerKind !== 'custom' && provider.definitionMode !== 'selector') continue;
      const hosts = Array.from(new Set([...(provider.searchHosts || []), ...(provider.detailHosts || [])]));
      if (!hosts.includes(parsed.hostname.toLowerCase())) continue;
      const allowed = (provider.allowedPathPrefixes || []).some(prefix => parsed.pathname.startsWith(prefix));
      if (!allowed) continue;
      const remoteId = parsed.searchParams.get('id') || parsed.searchParams.get('productNo') || parsed.pathname.split('/').filter(Boolean).reverse().find(part => /\d/u.test(part)) || crypto.createHash('sha256').update(parsed.href).digest('hex').slice(0,20);
      return { providerId:provider.id, provider, canonicalUrl:parsed.href, remoteId:String(remoteId), adapterKey:provider.adapterKey };
    }
    return null;
  }

  function templateFromRequestUrl(value, tokenValue, tokenName) {
    const url = String(value || '');
    if (!url) return '';
    const encoded = encodeURIComponent(String(tokenValue || ''));
    return url.includes(encoded) ? url.replace(encoded, `{${tokenName}}`) : url.includes(String(tokenValue || '')) ? url.replace(String(tokenValue || ''), `{${tokenName}}`) : url;
  }

  function builtinDefinitionDefaults(provider) {
    if (!provider || provider.providerKind === 'custom' || !provider.adapter) return null;
    const queryMarker = '__TXT_READER_QUERY__';
    const idMarker = '987654321';
    let searchUrlTemplate = '';
    let detailUrlTemplate = '';
    try {
      const requests = provider.adapter.buildSearchRequests
        ? provider.adapter.buildSearchRequests({ title:queryMarker, author:'' }, 5)
        : provider.adapter.buildSearchRequest ? [provider.adapter.buildSearchRequest({ title:queryMarker, author:'' }, 5)] : [];
      searchUrlTemplate = templateFromRequestUrl(requests && requests[0] && requests[0].url, queryMarker, 'query');
    } catch {}
    try {
      const host = String((provider.detailHosts || [])[0] || (provider.searchHosts || [])[0] || 'example.invalid');
      const sourceUrl = `https://${host}/novel/detail/${idMarker}`;
      const requests = provider.adapter.buildDetailRequests ? provider.adapter.buildDetailRequests(sourceUrl, idMarker) : [];
      detailUrlTemplate = templateFromRequestUrl(requests && requests[0] && requests[0].url, idMarker, 'id');
    } catch {}
    return {
      schemaVersion:1,
      kind:'builtin',
      id:provider.id,
      name:provider.name,
      mode:'request',
      description:provider.description || '',
      searchUrlTemplate,
      detailUrlTemplate,
      selectors:{},
      attributes:{ searchLink:'href', searchId:'', searchCover:'src', detailCover:'src' },
      coverHosts:Array.from(new Set(provider.coverHosts || [])),
      revision:Number(provider.revision) || 1,
      readonlyDefaults:true
    };
  }

  function effectiveProviderSettings(providerId) {
    const settings = store.getProviderSettings(providerId) || {};
    return {
      ...settings,
      autoApplyThreshold:settings.autoApplyThreshold == null ? autoApplyThreshold : Math.max(0.7, Math.min(1, Number(settings.autoApplyThreshold) || autoApplyThreshold)),
      requestIntervalMs:settings.requestIntervalMs == null ? requestIntervalMs : Math.max(3000, Math.min(60000, Number(settings.requestIntervalMs) || requestIntervalMs)),
      searchLimit:settings.searchLimit == null ? searchLimit : Math.max(1, Math.min(10, Math.floor(Number(settings.searchLimit) || searchLimit)))
    };
  }

  function providerDescriptor(provider) {
    const settings = effectiveProviderSettings(provider.id);
    const configuredPriority = settings.priority == null || settings.priority === '' ? Number.NaN : Number(settings.priority);
    return {
      id:provider.id,
      name:provider.name,
      adapterKey:provider.adapterKey,
      revision:provider.revision,
      description:provider.description,
      priority:Number.isFinite(configuredPriority) ? configuredPriority : provider.priority,
      enabled:enabled && settings.enabled !== false,
      autoApply:settings.autoApply !== false,
      autoApplyThreshold:settings.autoApplyThreshold,
      autoApplyThresholdPercent:Math.round(settings.autoApplyThreshold * 1000) / 10,
      supportsSearch:provider.supportsSearch !== false,
      supportsDirect:provider.supportsDirect !== false,
      browserCaptureRecommended:!!provider.browserCaptureRecommended,
      browserVerificationHint:clean(provider.browserVerificationHint, 500),
      loginUrl:provider.loginUrl,
      browserProfileSupported:!!provider.browserProfileSupported,
      extensionCaptureSupported:provider.providerKind !== 'custom',
      providerKind:provider.providerKind || 'builtin',
      definitionMode:provider.definitionMode || 'builtin',
      definition:provider.definition || null,
      definitionDefaults:builtinDefinitionDefaults(provider),
      canEditDefinition:true,
      canDelete:provider.providerKind === 'custom',
      definitionPass:provider.definition ? CONFIGURABLE_PROVIDER_PASS : null,
      baseCollectionCooldownMs:settings.requestIntervalMs,
      collectionCooldownRangeMs:[
        Math.round(settings.requestIntervalMs * REQUEST_DELAY_MIN_MULTIPLIER),
        Math.round(settings.requestIntervalMs * REQUEST_DELAY_MAX_MULTIPLIER)
      ],
      // Compatibility aliases for older admin clients. requestIntervalMs now means
      // the same-provider cooldown that begins after one work collection finishes.
      baseRequestIntervalMs:settings.requestIntervalMs,
      searchLimit:settings.searchLimit,
      requestDelayRangeMs:[
        Math.round(settings.requestIntervalMs * REQUEST_DELAY_MIN_MULTIPLIER),
        Math.round(settings.requestIntervalMs * REQUEST_DELAY_MAX_MULTIPLIER)
      ],
      browserProfile:provider.browserProfileSupported && playwrightService ? playwrightService.describe(provider.id) : { supported:false, status:'unsupported', configured:false }
    };
  }

  function listProviders() {
    return listRuntimeProviders().map(providerDescriptor).sort((a,b) => a.priority - b.priority || a.name.localeCompare(b.name, 'ko'));
  }
  function buildCandidateGroups(novel, candidatesInput = null) {
    const candidates = Array.isArray(candidatesInput) ? candidatesInput : store.listCandidatesForNovel(novel, 100);
    const providerMap = new Map(listProviders().map(provider => [String(provider.id || ''), provider]));
    const groups = new Map();
    for (const candidate of candidates) {
      if (!candidate || !candidate.id) continue;
      const fingerprint = typeof store.metadataEquivalenceFingerprint === 'function'
        ? store.metadataEquivalenceFingerprint(candidate.data || {})
        : crypto.createHash('sha256').update(JSON.stringify(publicMetadataData(candidate.data || {}))).digest('hex');
      const groupId = `mg_${fingerprint}`;
      const members = groups.get(groupId) || [];
      members.push(candidate);
      groups.set(groupId, members);
    }
    return Array.from(groups.entries()).map(([groupId, members]) => {
      const sorted = members.slice().sort((left,right) => {
        const leftProvider = providerMap.get(String(left.providerId || '')) || {};
        const rightProvider = providerMap.get(String(right.providerId || '')) || {};
        const leftPriorityValue = Number(leftProvider.priority);
        const leftPriority = Number.isFinite(leftPriorityValue) ? leftPriorityValue : 999;
        const rightPriorityValue = Number(rightProvider.priority);
        const rightPriority = Number.isFinite(rightPriorityValue) ? rightPriorityValue : 999;
        const leftCover = Number(!!(left.data && left.data.coverAssetId && left.data.coverUrl));
        const rightCover = Number(!!(right.data && right.data.coverAssetId && right.data.coverUrl));
        return Number(right.matchScore || 0) - Number(left.matchScore || 0)
          || leftPriority - rightPriority
          || rightCover - leftCover
          || String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''))
          || String(right.id || '').localeCompare(String(left.id || ''));
      });
      const representative = sorted[0];
      const coverRepresentative = sorted.find(candidate => candidate.data && candidate.data.coverAssetId && candidate.data.coverUrl) || representative;
      const providers = sorted.map(candidate => {
        const descriptor = providerMap.get(String(candidate.providerId || '')) || {};
        return {
          candidateId:String(candidate.id || ''),
          providerId:String(candidate.providerId || ''),
          providerName:String(candidate.providerName || descriptor.name || candidate.providerId || ''),
          priority:Number.isFinite(Number(descriptor.priority)) ? Number(descriptor.priority) : 999,
          matchScore:Math.max(0, Math.min(1, Number(candidate.matchScore) || 0)),
          sourceUrl:publicMetadataSourceUrl(candidate.sourceUrl),
          hasCover:!!(candidate.data && candidate.data.coverAssetId && candidate.data.coverUrl)
        };
      });
      const coverVariants = new Set(sorted.map(candidate => String(candidate.data && (candidate.data.coverAssetId || candidate.data.coverUrl || candidate.data.coverRemoteUrl) || '')).filter(Boolean));
      return {
        id:groupId,
        pass:METADATA_EQUIVALENT_GROUP_PASS,
        count:sorted.length,
        grouped:sorted.length > 1,
        representativeId:String(representative.id || ''),
        coverRepresentativeId:String(coverRepresentative && coverRepresentative.id || ''),
        matchScore:Math.max(...sorted.map(candidate => Math.max(0, Math.min(1, Number(candidate.matchScore) || 0)))),
        data:publicMetadataData({
          ...(representative.data || {}),
          ...(coverRepresentative && coverRepresentative.data && coverRepresentative.data.coverAssetId && coverRepresentative.data.coverUrl ? {
            coverAssetId:coverRepresentative.data.coverAssetId,
            coverUrl:coverRepresentative.data.coverUrl
          } : {})
        }),
        providers,
        sourceCount:new Set(providers.map(provider => provider.sourceUrl).filter(Boolean)).size,
        coverVariantCount:coverVariants.size,
        updatedAt:sorted.map(candidate => String(candidate.updatedAt || candidate.createdAt || '')).sort().reverse()[0] || '',
        _candidateIds:sorted.map(candidate => String(candidate.id || '')),
        _representative:representative,
        _coverRepresentative:coverRepresentative
      };
    }).sort((left,right) => Number(right.matchScore || 0) - Number(left.matchScore || 0)
      || Number(right.count || 0) - Number(left.count || 0)
      || String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))
      || String(left.id || '').localeCompare(String(right.id || '')));
  }

  function publicCandidateGroup(group) {
    if (!group) return null;
    const { _candidateIds, _representative, _coverRepresentative, ...safe } = group;
    return safe;
  }

  function findCandidateGroup(novel, groupId) {
    const id = String(groupId || '');
    const group = buildCandidateGroups(novel).find(item => item.id === id) || null;
    if (!group) throw Object.assign(new Error('metadata candidate group not found'), { code:'METADATA_CANDIDATE_GROUP_NOT_FOUND' });
    return group;
  }

  function getEnabledProvider(providerId) {
    const provider = runtimeProvider(providerId);
    if (!provider) throw Object.assign(new Error('metadata provider not found'), { code:'METADATA_PROVIDER_NOT_FOUND' });
    const desc = providerDescriptor(provider);
    if (!desc.enabled) throw Object.assign(new Error(`${desc.name} provider가 비활성화되어 있습니다.`), { code:'METADATA_PROVIDER_DISABLED' });
    return { ...provider, ...desc };
  }

  function autoApplyAssessment(novel, candidate, candidates = []) {
    if (!candidate || !candidate.id) return { eligible:false, reason:'candidate_missing' };
    const rawProvider = runtimeProvider(candidate.providerId);
    if (!rawProvider) return { eligible:false, reason:'provider_missing', candidate };
    const provider = providerDescriptor(rawProvider);
    if (!provider.enabled || provider.autoApply === false) return { eligible:false, reason:'provider_auto_apply_disabled', candidate, provider };
    const fields = candidateFields(candidate);
    if (!fields.length) return { eligible:false, reason:'fields_missing', candidate, provider, fields };

    const titleScore = metadataTitleSimilarity(novel && novel.title, candidate.data && candidate.data.title);
    const expectedAuthor = clean(novel && novel.author, 300);
    const candidateAuthor = clean(candidate.data && candidate.data.author, 300);
    const authorScore = expectedAuthor && candidateAuthor ? metadataTitleSimilarity(expectedAuthor, candidateAuthor) : 1;
    const matchScore = Math.max(0, Math.min(1, Number(candidate.matchScore) || 0));
    const exactTitle = titleScore >= 0.999;
    const providerThreshold = Math.max(0.7, Math.min(1, Number(provider.autoApplyThreshold) || autoApplyThreshold));
    // Legacy eligibility contract: matchScore >= autoApplyThreshold; v643 applies the provider-specific threshold.
    const strongThresholdMatch = matchScore >= providerThreshold;
    const exactTitleCandidates = (Array.isArray(candidates) ? candidates : [])
      .filter(item => item && item.id && metadataTitleSimilarity(novel && novel.title, item.data && item.data.title) >= 0.999);
    const exactTitleIsUnique = exactTitleCandidates.length <= 1;
    const exactTitleAuthorCompatible = !expectedAuthor || !candidateAuthor || authorScore >= 0.55;
    const exactTitleUnambiguous = exactTitle && (exactTitleAuthorCompatible || exactTitleIsUnique);
    const eligible = strongThresholdMatch || exactTitleUnambiguous;
    return {
      eligible,
      reason:strongThresholdMatch ? `confidence_${Math.round(providerThreshold * 1000) / 10}` : exactTitleUnambiguous ? 'exact_title' : 'manual_review',
      candidate,
      provider,
      fields,
      titleScore,
      authorScore,
      matchScore,
      threshold:providerThreshold,
      exactTitleIsUnique,
      pass:METADATA_AUTO_APPLY_POLICY_PASS
    };
  }

  function selectAutoApplyCandidate(novel, candidates = []) {
    const assessments = (Array.isArray(candidates) ? candidates : [])
      .map(candidate => autoApplyAssessment(novel, candidate, candidates))
      .filter(item => item.eligible)
      .sort((left, right) => {
        const leftPriorityValue = Number(left.provider && left.provider.priority);
        const leftPriority = Number.isFinite(leftPriorityValue) ? leftPriorityValue : 999;
        const rightPriorityValue = Number(right.provider && right.provider.priority);
        const rightPriority = Number.isFinite(rightPriorityValue) ? rightPriorityValue : 999;
        return Number(right.matchScore) - Number(left.matchScore)
          || leftPriority - rightPriority
          || Number(right.titleScore) - Number(left.titleScore)
          || Number(right.authorScore) - Number(left.authorScore)
          || String(right.candidate && right.candidate.updatedAt || '').localeCompare(String(left.candidate && left.candidate.updatedAt || ''));
      });
    return assessments[0] || null;
  }

  async function autoApplyBestCandidate(novel, candidates = [], options = {}) {
    if (store.getAppliedForNovel(novel)) return { applied:store.getAppliedForNovel(novel), reused:true, assessment:null };
    const assessment = selectAutoApplyCandidate(novel, candidates);
    if (!assessment) return null;
    const applied = store.applyCandidate(novel, assessment.candidate.id, assessment.fields);
    if (options.flush === true) await store.flush();
    return { applied, candidate:assessment.candidate, assessment, reused:false, pass:METADATA_AUTO_APPLY_RECOVERY_PASS };
  }
  const browserCapture = createMetadataBrowserCaptureService({
    store,
    coverService,
    describeProviders:listProviders,
    synopsisMax:8000
  });

  function randomRequestDelayMs(providerId) {
    const settings = effectiveProviderSettings(providerId);
    return computeRandomRequestDelayMs(settings.requestIntervalMs, random());
  }
  const providerCompletionCooldown = createProviderCompletionCooldownCoordinator({
    now,
    delay,
    cooldownMsForProvider:randomRequestDelayMs
  });
  function runProviderCollection(provider, context, operation) {
    return providerCompletionCooldown.run(
      provider && provider.id,
      context && context.signal || null,
      operation,
      waitMs => context && typeof context.update === 'function' && context.update({
        message:`${provider.name} 이전 작품 수집 완료 후 쿨타임 ${(waitMs / 1000).toFixed(1)}초 대기 중`
      })
    );
  }
  function throwIfContextAborted(context, fallbackError = null) {
    const signal = context && context.signal;
    if (!signal || !signal.aborted) return;
    throw signal.reason || fallbackError || Object.assign(new Error('metadata request aborted'), { code:'ABORT_ERR' });
  }

  function providerRequestCacheKey(provider, request, kind) {
    const method = String(request && request.method || 'GET').toUpperCase();
    if (!['GET','HEAD'].includes(method)) return '';
    return [
      provider && provider.id || '', method, kind || 'request', request && request.url || '',
      request && request.requestProfile || provider && provider.adapter && provider.adapter.requestProfile || 'default',
      request && request.deviceProfile === 'mobile' ? 'mobile' : 'desktop',
      request && request.variant || '', request && request.referer || '',
      request && request.requiresBrowserProfile === true ? 'auth' : 'public',
      request && (request.renderRequired === true || /rendered/iu.test(String(request.variant || ''))) ? 'render' : 'direct'
    ].join('\u001f');
  }

  function contextRequestCache(context) {
    if (!context || (typeof context !== 'object' && typeof context !== 'function')) return null;
    let cache = requestCacheByContext.get(context);
    if (!cache) {
      cache = new Map();
      requestCacheByContext.set(context, cache);
    }
    return cache;
  }

  async function providerFetch(provider, request, kind = 'request', context = null) {
    throwIfContextAborted(context);
    const cache = contextRequestCache(context);
    const cacheKey = providerRequestCacheKey(provider, request, kind);
    if (cache && cacheKey && cache.has(cacheKey)) return cache.get(cacheKey);

    const operation = (async () => {
      throwIfContextAborted(context);
      const variant = request.variant || '';
      const requestOptions = {
        kind,
        method:request.method || 'GET',
        profile:request.requestProfile || provider.adapter.requestProfile || 'default',
        referer:request.referer || '',
        deviceProfile:request.deviceProfile === 'mobile' ? 'mobile' : 'desktop',
        variant,
        renderRequired:request.renderRequired === true || /rendered/iu.test(String(variant)),
        browserSameOriginRequired:request.browserSameOriginRequired === true,
        signal:context && context.signal || null
      };
      const browserReady = !!(playwrightService && provider.browserProfileSupported && playwrightService.canFetch(provider.id));
      const browserRequired = request.requiresBrowserProfile === true || requestOptions.renderRequired || requestOptions.browserSameOriginRequired;
      const browserFatalCodes = new Set([
        'METADATA_PLAYWRIGHT_LOGIN_REQUIRED',
        'METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED',
        'METADATA_PROVIDER_ACCESS_BLOCKED',
        'METADATA_MUNPIA_ACCESS_BLOCKED'
      ]);
      if (browserReady && browserRequired) {
        try {
          return await playwrightService.fetchProvider(provider, request.url, requestOptions);
        } catch (browserError) {
          if (context && context.signal && context.signal.aborted) throw browserError;
          if (browserFatalCodes.has(String(browserError && browserError.code || ''))) throw browserError;
          try {
            return await transport.fetchProvider(provider, request.url, requestOptions);
          } catch (transportError) {
            transportError.playwrightError = { code:String(browserError && browserError.code || ''), message:clean(browserError && browserError.message || browserError, 500) };
            throw transportError;
          }
        }
      }
      try {
        // Public/static requests use the lightweight HTTP transport even when a
        // saved browser profile exists. Playwright is reserved for authenticated,
        // rendered, or transport-failure fallback paths.
        return await transport.fetchProvider(provider, request.url, requestOptions);
      } catch (transportError) {
        if (browserReady) {
          try { return await playwrightService.fetchProvider(provider, request.url, requestOptions); }
          catch (browserError) {
            if (context && context.signal && context.signal.aborted) throw browserError;
            if (browserFatalCodes.has(String(browserError && browserError.code || ''))) throw browserError;
            transportError.playwrightError = { code:String(browserError && browserError.code || ''), message:clean(browserError && browserError.message || browserError, 500) };
          }
        }
        if (provider.browserProfileSupported && ['METADATA_HOST_BLOCKED','METADATA_PATH_BLOCKED'].includes(String(transportError && transportError.code || ''))) {
          throw Object.assign(new Error(`${provider.name} 로그인 또는 연령 인증이 필요합니다. Playwright 프로필 로그인이나 Metadata Helper를 사용하십시오.`), { code:'METADATA_PLAYWRIGHT_LOGIN_REQUIRED', cause:transportError });
        }
        throw transportError;
      }
    })();
    if (cache && cacheKey) cache.set(cacheKey, operation);
    try {
      return await operation;
    } catch (error) {
      if (cache && cacheKey && cache.get(cacheKey) === operation) cache.delete(cacheKey);
      throw error;
    }
  }

  async function extractDetail(provider, sourceUrl, remoteId, inlineMetadata, context) {
    if (inlineMetadata) return inlineMetadata;
    const requests = provider.adapter.buildDetailRequests
      ? provider.adapter.buildDetailRequests(sourceUrl, remoteId)
      : [{ url:sourceUrl, responseType:'html', requestProfile:provider.adapter.requestProfile || 'default' }];
    if (!requests.length) return null;
    const documents = [];
    let deferredError = null;
    for (const request of requests.slice(0,4)) {
      context.assertNotCancelled();
      if (request && request.fallbackOnly === true && documents.length) {
        const shouldFetchFallback = typeof provider.adapter.shouldFetchDetailFallback === 'function'
          ? provider.adapter.shouldFetchDetailFallback(documents, sourceUrl, remoteId, 8000)
          : false;
        if (!shouldFetchFallback) continue;
      }
      try {
        const response = await providerFetch(provider, request, 'request', context);
        documents.push({ requestUrl:request.url, finalUrl:response.finalUrl, responseType:request.responseType || 'html', body:response.body });
      } catch (error) {
        throwIfContextAborted(context, error);
        const code = String(error && error.code || '');
        if (['METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED','METADATA_PLAYWRIGHT_LOGIN_REQUIRED','METADATA_PROVIDER_ACCESS_BLOCKED','METADATA_MUNPIA_ACCESS_BLOCKED'].includes(code)) throw error;
        if (!request || request.optional !== true) {
          if (!documents.length) throw error;
        }
        deferredError = error;
      }
    }
    if (!documents.length && deferredError) throw deferredError;
    if (provider.adapter.parseDetailDocuments) return provider.adapter.parseDetailDocuments(documents, sourceUrl, remoteId, 8000);
    const first = documents[0];
    if (!first || !provider.adapter.isDetailUrl(first.finalUrl)) throw Object.assign(new Error('provider 상세 URL이 작품 상세 형식과 일치하지 않습니다.'), { code:'METADATA_DETAIL_URL_INVALID' });
    return provider.adapter.parseDetail(first.body, first.finalUrl, 8000);
  }

  async function cacheCandidateCover(provider, candidate, context) {
    const remoteUrl = candidate && candidate.data && candidate.data.coverRemoteUrl;
    if (!remoteUrl) return candidate;
    try {
      context.assertNotCancelled();
      const cover = await coverService.cacheRemoteCover(provider, remoteUrl, {
        referer:candidate.sourceUrl,
        signal:context && context.signal || null
      });
      if (!cover) return candidate;
      const updated = store.updateCandidateCover(candidate.id, cover);
      if (updated) {
        await store.flush();
        try {
          if (typeof coverService.releaseAssetLeaseDurably === 'function') await coverService.releaseAssetLeaseDurably(cover.assetId);
          else if (typeof coverService.releaseAssetLease === 'function') coverService.releaseAssetLease(cover.assetId);
        } catch (leaseError) {
          logger?.warn?.('metadata cover lease release failed after durable candidate update:', leaseError?.message || leaseError);
        }
      }
      return updated || candidate;
    } catch (error) {
      candidate.coverError = clean(error && error.message || error, 500);
      return candidate;
    }
  }

  function detailMetadataScore(data) {
    if (!data || typeof data !== 'object') return 0;
    return Number(Boolean(data.title)) * 3 + Number(Boolean(data.author)) * 2 + Number(Boolean(data.synopsis)) * 4
      + Math.min(3, Array.isArray(data.genres) ? data.genres.length : 0)
      + Math.min(3, Array.isArray(data.tags) ? data.tags.length : 0)
      + Number(Boolean(data.publicationStatus)) + Number(Boolean(data.publicationYear))
      + Number(Boolean(data.coverUrl || data.coverRemoteUrl)) * 2;
  }

  function detailMetadataSufficient(data) {
    return detailMetadataScore(data) >= 9 && Boolean(data && data.title) && Boolean(data && (data.synopsis || data.author));
  }

  function shouldCollectAlternativeDetail(job, ranked, firstExtracted, provider = null) {
    if (!Array.isArray(ranked) || ranked.length < 2) return false;
    const top = ranked[0];
    const second = ranked[1];
    const topScore = Math.max(0, Math.min(1, Number(top && top.matchScore) || 0));
    const secondScore = Math.max(0, Math.min(1, Number(second && second.matchScore) || 0));
    const titleScore = metadataTitleSimilarity(job && job.novel && job.novel.title, top && (top.title || top.inlineMetadata && top.inlineMetadata.title));
    const providerThreshold = Math.max(0.7, Math.min(1, Number(provider && provider.autoApplyThreshold) || autoApplyThreshold));
    const strongUniqueTop = topScore >= providerThreshold && titleScore >= 0.985 && (topScore - secondScore) >= 0.08;
    return !strongUniqueTop || !detailMetadataSufficient(firstExtracted);
  }

  async function collectDirect(job, context) {
    const target = resolveRuntimeDirectMetadataTarget(job.targetUrl);
    if (!target) throw Object.assign(new Error('지원되는 공식 작품 상세 URL이 아닙니다.'), { code:'METADATA_DIRECT_URL_UNSUPPORTED' });
    const provider = getEnabledProvider(target.providerId);
    return runProviderCollection(provider, context, async () => {
      context.update({ progress:0.15, message:`${provider.name} 상세 정보 요청 중` });
      const extracted = await extractDetail(provider, target.canonicalUrl, target.remoteId, null, context);
      if (!extracted) throw Object.assign(new Error('작품 상세 페이지에서 메타데이터를 추출하지 못했습니다.'), { code:'METADATA_DETAIL_EMPTY' });
      let candidate = store.saveCandidate(job.novel, provider, extracted, { jobId:job.id, direct:true, matchScore:1, query:target.canonicalUrl });
      candidate = await cacheCandidateCover(provider, candidate, context);
      const fields = candidateFields(candidate);
      if (fields.length) store.applyCandidate(job.novel, candidate.id, fields);
      return { candidates:[candidate.id], applied:candidate.id, providerId:provider.id, direct:true };
    });
  }

  async function collectProviderSearch(job, provider, context) {
    const providerSearchLimit = Math.max(1, Math.min(10, Number(provider.searchLimit) || searchLimit));
    const searchCandidates = deriveMetadataSearchCandidates(job.novel.title, job.novel.sourceKey, job.novel.author || null, 'single');
    const expected = searchCandidates[0] || { title:job.novel.title, author:job.novel.author || null };
    const queries = [];
    for (const term of searchCandidates.slice(0,3)) {
      for (const title of deriveMetadataSearchQueryVariants(term.title)) {
        const key = title.toLocaleLowerCase('ko-KR');
        if (!queries.some(item => item.title.toLocaleLowerCase('ko-KR') === key)) queries.push({ title, author:term.author || expected.author || null });
      }
    }
    if (!queries.length) queries.push(expected);
    const found = new Map();
    const queryAttempts = [];
    let deferredProviderError = null;
    for (const terms of queries.slice(0,4)) {
      context.assertNotCancelled();
      const browserProfileReady = !!(playwrightService && provider.browserProfileSupported && playwrightService.canFetch(provider.id));
      const requests = provider.adapter.buildSearchRequests
        ? provider.adapter.buildSearchRequests(terms, providerSearchLimit)
        : [provider.adapter.buildSearchRequest
          ? provider.adapter.buildSearchRequest(terms, providerSearchLimit)
          : { url:provider.adapter.buildSearchUrl(terms, providerSearchLimit), method:'GET', responseType:'html', requestProfile:provider.adapter.requestProfile || 'default' }];
      let deferredRequestError = null;
      let attemptedRequest = false;
      let foundForTerms = 0;
      for (const request of (Array.isArray(requests) ? requests : []).slice(0,4)) {
        context.assertNotCancelled();
        const variant = clean(request && request.variant, 80) || 'default';
        if (request && request.fallbackOnly === true && foundForTerms > 0) {
          queryAttempts.push({ query:terms.title, variant, status:'skipped', reason:'primary_variant_succeeded', candidates:0 });
          continue;
        }
        if (request && request.requiresBrowserProfile && !browserProfileReady) {
          queryAttempts.push({ query:terms.title, variant, status:'skipped', reason:'browser_profile_required', candidates:0 });
          continue;
        }
        attemptedRequest = true;
        let response;
        try {
          response = await providerFetch(provider, request, 'request', context);
        } catch (error) {
          throwIfContextAborted(context, error);
          error.metadataStage = 'search_transport';
          queryAttempts.push({ query:terms.title, variant, status:'failed', code:clean(error && error.code, 100), candidates:0 });
          if (['METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED','METADATA_PLAYWRIGHT_LOGIN_REQUIRED','METADATA_PROVIDER_ACCESS_BLOCKED','METADATA_MUNPIA_ACCESS_BLOCKED'].includes(String(error && error.code || ''))) throw error;
          if (!request || request.optional !== true) throw error;
          if (!deferredRequestError || ['METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED','METADATA_PLAYWRIGHT_LOGIN_REQUIRED','METADATA_PROVIDER_ACCESS_BLOCKED','METADATA_MUNPIA_ACCESS_BLOCKED'].includes(String(error && error.code || ''))) deferredRequestError = error;
          if (!deferredProviderError || ['METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED','METADATA_PLAYWRIGHT_LOGIN_REQUIRED','METADATA_PROVIDER_ACCESS_BLOCKED','METADATA_MUNPIA_ACCESS_BLOCKED'].includes(String(error && error.code || ''))) deferredProviderError = error;
          continue;
        }
        let parsed;
        try {
          parsed = provider.adapter.parseSearchResults(response.body, response.finalUrl, expected, providerSearchLimit);
        } catch (error) {
          throwIfContextAborted(context, error);
          error.metadataStage = 'search_parse';
          queryAttempts.push({ query:terms.title, variant, finalUrl:response.finalUrl, status:'failed', code:clean(error && error.code, 100), candidates:0 });
          if (['METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED','METADATA_PLAYWRIGHT_LOGIN_REQUIRED','METADATA_PROVIDER_ACCESS_BLOCKED','METADATA_MUNPIA_ACCESS_BLOCKED'].includes(String(error && error.code || ''))) throw error;
          if (!request || request.optional !== true) throw error;
          if (!deferredRequestError || ['METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED','METADATA_PLAYWRIGHT_LOGIN_REQUIRED','METADATA_PROVIDER_ACCESS_BLOCKED','METADATA_MUNPIA_ACCESS_BLOCKED'].includes(String(error && error.code || ''))) deferredRequestError = error;
          if (!deferredProviderError || ['METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED','METADATA_PLAYWRIGHT_LOGIN_REQUIRED','METADATA_PROVIDER_ACCESS_BLOCKED','METADATA_MUNPIA_ACCESS_BLOCKED'].includes(String(error && error.code || ''))) deferredProviderError = error;
          continue;
        }
        queryAttempts.push({ query:terms.title, variant, finalUrl:response.finalUrl, status:'ok', candidates:Array.isArray(parsed) ? parsed.length : 0 });
        if ((!parsed || !parsed.length) && provider.id === 'builtin-joara' && looksLikeJavascriptShell(response.body)) {
          const error = Object.assign(new Error('조아라 검색 페이지가 JavaScript 앱 셸만 반환했습니다. 로그인된 브라우저에서 Metadata Helper 캡처를 사용하십시오.'), {
            code:'METADATA_BROWSER_CAPTURE_REQUIRED', metadataStage:'search_parse'
          });
          throw error;
        }
        const parsedItems = Array.isArray(parsed) ? parsed : [];
        foundForTerms += parsedItems.length;
        for (const item of parsedItems) {
          const current = found.get(item.sourceUrl);
          if (!current || Number(item.matchScore) > Number(current.matchScore)) found.set(item.sourceUrl, { ...item, query:terms.title });
        }
        const top = [...found.values()].sort((a,b) => Number(b.matchScore) - Number(a.matchScore))[0];
        if (top && Number(top.matchScore) >= 0.9) break;
      }
      if (!attemptedRequest && deferredRequestError) throw deferredRequestError;
      const top = [...found.values()].sort((a,b) => Number(b.matchScore) - Number(a.matchScore))[0];
      if (top && Number(top.matchScore) >= 0.9) break;
      if (!top && deferredRequestError && queries.length <= 1) throw deferredRequestError;
    }
    if (!found.size && deferredProviderError) throw deferredProviderError;
    const ranked = [...found.values()].sort((a,b) => Number(b.matchScore) - Number(a.matchScore)).slice(0,3);
    const detailPlan = ranked.slice(0,2);
    const saved = [];
    let firstExtracted = null;
    for (let index = 0; index < detailPlan.length; index += 1) {
      const item = detailPlan[index];
      if (index > 0 && !shouldCollectAlternativeDetail(job, ranked, firstExtracted, provider)) {
        queryAttempts.push({ query:item.query, variant:'detail', status:'skipped', reason:'strong_unique_primary_detail', candidates:0 });
        break;
      }
      context.assertNotCancelled();
      let extracted;
      try { extracted = await extractDetail(provider, item.sourceUrl, item.remoteId, item.inlineMetadata || null, context); }
      catch (error) {
        error.metadataStage = error.metadataStage || 'detail_transport';
        if (!item.inlineMetadata) throw error;
        extracted = item.inlineMetadata;
      }
      if (!extracted) {
        if (provider.id === 'builtin-joara') {
          throw Object.assign(new Error('조아라 상세 정보는 현재 서버 HTML 응답에서 확인할 수 없습니다. Metadata Helper 브라우저 캡처가 필요합니다.'), {
            code:'METADATA_BROWSER_CAPTURE_REQUIRED', metadataStage:'detail_parse'
          });
        }
        continue;
      }
      if (index === 0) firstExtracted = extracted;
      let candidate = store.saveCandidate(job.novel, provider, extracted, { jobId:job.id, matchScore:item.matchScore, query:item.query });
      if (index === 0) candidate = await cacheCandidateCover(provider, candidate, context);
      saved.push(candidate);
    }
    return { saved, queryAttempts };
  }

  function resolveProviderPlan(job) {
    const enabledDescriptors = listProviders().filter(item => item.enabled && item.supportsSearch !== false);
    const requested = normalizeProviderIds(job.providerIds);
    const requestedOrder = new Map(requested.map((id,index) => [id,index]));
    const availableById = new Map(enabledDescriptors.map(item => [item.id,item]));
    const ids = [];
    const planningFailures = [];
    for (const id of requested) {
      if (availableById.has(id)) ids.push(id);
      else planningFailures.push({ providerId:id, error:'공급자가 없거나 비활성화되어 다음 공급자로 전환했습니다.' });
    }
    for (const descriptor of enabledDescriptors) if (!ids.includes(descriptor.id)) ids.push(descriptor.id);
    const providers = ids.map(id => {
      const raw = runtimeProvider(id);
      const desc = raw && providerDescriptor(raw);
      return raw && desc && desc.enabled ? { ...raw, ...desc, requestedPriority:requestedOrder.has(id), requestedOrder:Number(requestedOrder.get(id)) } : null;
    }).filter(Boolean).sort((left, right) =>
      (Number.isFinite(Number(left.priority)) ? Number(left.priority) : 999) - (Number.isFinite(Number(right.priority)) ? Number(right.priority) : 999)
      || (Number.isFinite(left.requestedOrder) ? left.requestedOrder : 999) - (Number.isFinite(right.requestedOrder) ? right.requestedOrder : 999)
      || String(left.name || left.id).localeCompare(String(right.name || right.id), 'ko')
    );
    return { providers, planningFailures, requested };
  }

  async function processSearchJob(job, context) {
    const plan = resolveProviderPlan(job);
    const providers = plan.providers;
    if (!providers.length) throw Object.assign(new Error('활성화된 메타데이터 공급자가 없습니다.'), { code:'METADATA_PROVIDER_REQUIRED' });
    const allCandidates = [];
    const attempts = [...plan.planningFailures.map(item => ({ ...item, status:'skipped' }))];
    for (let index = 0; index < providers.length; index += 1) {
      const provider = providers[index];
      const fallbackLabel = index > 0 ? ' · fallback' : '';
      context.update({ progress:Math.min(0.85, index / Math.max(1, providers.length)), message:`${provider.name} 검색 중 (${index + 1}/${providers.length})${fallbackLabel}` });
      try {
        const collected = await runProviderCollection(provider, context, () => collectProviderSearch(job, provider, context));
        const saved = collected.saved || [];
        allCandidates.push(...saved);
        attempts.push({ providerId:provider.id, providerName:provider.name, status:saved.length ? 'candidate' : 'empty', stage:saved.length ? 'detail' : 'search_empty', candidates:saved.length, queries:collected.queryAttempts || [] });
        // Do not auto-apply a merely eligible candidate before lower-priority
        // providers have had a chance to return a higher score. A perfect 1.0
        // candidate from the current priority-ordered provider cannot be beaten;
        // equal-score ties are already resolved in favour of the earlier provider.
        const currentBest = selectAutoApplyCandidate(job.novel, allCandidates.filter(item => item && item.id));
        if (currentBest && Number(currentBest.matchScore) >= 1) break;
      } catch (error) {
        const cancellationCode = String(error && error.code || context.signal?.reason?.code || '');
        if (context.signal?.aborted || cancellationCode === 'METADATA_JOB_CANCELLED' || cancellationCode === 'METADATA_QUEUE_STOPPED') {
          throw context.signal?.reason || error;
        }
        const detail = classifyProviderFailure(error, error && error.metadataStage || 'request');
        const failure = { providerId:provider.id, providerName:provider.name, error:detail.message, code:detail.code, stage:detail.stage, statusCode:detail.statusCode, status:'failed' };
        attempts.push(failure);
        allCandidates.push(failure);
      }
    }
    const real = allCandidates.filter(item => item && item.id);
    const finalAutoApplied = real.length ? await autoApplyBestCandidate(job.novel, real) : null;
    if (finalAutoApplied && finalAutoApplied.candidate) {
      return {
        candidates:real.map(item => item.id),
        applied:finalAutoApplied.candidate.id,
        providerId:finalAutoApplied.candidate.providerId || '',
        autoApplied:true,
        autoApplyReason:finalAutoApplied.assessment && finalAutoApplied.assessment.reason || 'strong_match',
        autoApplyPass:METADATA_AUTO_APPLY_POLICY_PASS,
        liveCompetitionPass:METADATA_SCORE_FIRST_LIVE_COMPETITION_PASS,
        attempts,
        fallbackUsed:attempts.length > 1
      };
    }
    const failures = attempts.filter(item => item && item.status === 'failed');
    if (!real.length && failures.length >= providers.length) {
      const error = new Error(failures.map(item => `${item.providerId}: ${item.error}`).join(' | ').slice(0, 1000));
      error.code = 'METADATA_ALL_PROVIDERS_FAILED';
      error.attempts = attempts;
      throw error;
    }
    return { candidates:real.map(item => item.id), applied:null, autoApplied:false, failures, attempts, fallbackUsed:attempts.length > 1, liveCompetitionPass:METADATA_SCORE_FIRST_LIVE_COMPETITION_PASS };
  }

  function bulkFilePath(batchId) {
    return path.join(bulkDir, `${safeBulkBatchId(batchId)}.jsonl`);
  }
  async function writeBulkBatch(novels) {
    const batchId = `mb_${crypto.randomBytes(12).toString('hex')}`;
    const finalPath = bulkFilePath(batchId);
    const tempPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
    let handle = null;
    let count = 0;
    let recoveredApplied = 0;
    let pendingCandidates = 0;
    let chunk = '';
    try {
      handle = await fs.promises.open(tempPath, 'wx', 0o600);
      for (const novel of Array.isArray(novels) ? novels : []) {
        if (store.getAppliedForNovel(novel)) continue;
        const retainedCandidates = store.listCandidatesForNovel(novel, 30);
        if (retainedCandidates.length) {
          const recovered = await autoApplyBestCandidate(novel, retainedCandidates);
          if (recovered && recovered.candidate) {
            recoveredApplied += 1;
            if (recoveredApplied % 50 === 0) await store.flush();
            continue;
          }
          // Candidate data is already durable. Keep it for manual review instead of
          // spending provider requests to collect the same work again.
          pendingCandidates += 1;
          continue;
        }
        chunk += `${JSON.stringify(snapshotNovel(novel))}
`;
        count += 1;
        if (Buffer.byteLength(chunk, 'utf8') >= 256 * 1024) {
          await handle.writeFile(chunk, 'utf8');
          chunk = '';
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      if (chunk) await handle.writeFile(chunk, 'utf8');
      if (recoveredApplied) await store.flush();
      await handle.sync();
      await handle.close();
      handle = null;
      if (!count) {
        await durableRemoveAsync(tempPath, { force:true });
        return { batchId:'', count:0, recoveredApplied, pendingCandidates };
      }
      await durableRenameAsync(tempPath, finalPath);
      try { await fs.promises.chmod(finalPath, 0o600); } catch {}
      return { batchId, count, recoveredApplied, pendingCandidates };
    } catch (error) {
      try { await handle?.close(); } catch {}
      try { await durableRemoveAsync(tempPath, { force:true }); } catch {}
      throw error;
    }
  }
  async function writePendingApplyBatch(novels) {
    const batchId = `mb_${crypto.randomBytes(12).toString('hex')}`;
    const finalPath = bulkFilePath(batchId);
    const tempPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
    let handle = null;
    let count = 0;
    let manualReview = 0;
    let chunk = '';
    try {
      handle = await fs.promises.open(tempPath, 'wx', 0o600);
      for (const novel of Array.isArray(novels) ? novels : []) {
        if (store.getAppliedForNovel(novel)) continue;
        const retainedCandidates = store.listCandidatesForNovel(novel, 30);
        if (!retainedCandidates.length) continue;
        const assessment = selectAutoApplyCandidate(novel, retainedCandidates);
        if (!assessment) {
          manualReview += 1;
          continue;
        }
        chunk += `${JSON.stringify(snapshotNovel(novel))}
`;
        count += 1;
        if (Buffer.byteLength(chunk, 'utf8') >= 256 * 1024) {
          await handle.writeFile(chunk, 'utf8');
          chunk = '';
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      if (chunk) await handle.writeFile(chunk, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      if (!count) {
        await durableRemoveAsync(tempPath, { force:true });
        return { batchId:'', count:0, manualReview };
      }
      await durableRenameAsync(tempPath, finalPath);
      try { await fs.promises.chmod(finalPath, 0o600); } catch {}
      return { batchId, count, manualReview };
    } catch (error) {
      try { await handle?.close(); } catch {}
      try { await durableRemoveAsync(tempPath, { force:true }); } catch {}
      throw error;
    }
  }

  async function* readBulkBatch(batchId, startOffset = 0) {
    const filePath = bulkFilePath(batchId);
    const start = Math.max(0, Number(startOffset) || 0);
    const input = fs.createReadStream(filePath, { start, encoding:'utf8' });
    const lines = readline.createInterface({ input, crlfDelay:Infinity });
    let offset = start;
    try {
      for await (const line of lines) {
        const nextOffset = offset + Buffer.byteLength(line, 'utf8') + 1;
        if (line.trim()) yield { novel:JSON.parse(line), nextOffset };
        offset = nextOffset;
      }
    } finally {
      lines.close();
      input.destroy();
    }
  }
  async function removeBulkBatch(batchId) {
    if (!batchId) return false;
    try {
      return await durableRemoveAsync(bulkFilePath(batchId), { force:true });
    } catch {
      return false;
    }
  }

  async function processBulkJob(job, context) {
    const batchId = safeBulkBatchId(job.batchId);
    const filePath = bulkFilePath(batchId);
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      throw Object.assign(new Error('일괄 수집 배치 파일을 찾을 수 없습니다.'), { code:'METADATA_BULK_BATCH_NOT_FOUND' });
    }
    const total = Math.max(0, Number(job.total) || 0);
    let cursor = Math.max(0, Number(job.cursor) || 0);
    let batchOffset = Math.max(0, Number(job.batchOffset) || 0);
    let succeeded = Math.max(0, Number(job.succeeded) || 0);
    let failed = Math.max(0, Number(job.failed) || 0);
    let empty = Math.max(0, Number(job.empty) || 0);
    let skipped = Math.max(0, Number(job.skipped) || 0);
    let autoApplied = Math.max(0, Number(job.autoApplied) || 0);
    let candidateOnly = Math.max(0, Number(job.candidateOnly) || 0);
    let recoveredApplied = Math.max(0, Number(job.recoveredApplied) || 0);
    let recentFailures = Array.isArray(job.recentFailures) ? job.recentFailures.slice(-50) : [];
    let lastCheckpointAt = 0;
    let sinceCheckpoint = 0;
    try {
      for await (const entry of readBulkBatch(batchId, batchOffset)) {
        context.assertNotCancelled();
        const novel = entry.novel;
        let providerMessage = '';
        const itemContext = {
          signal:context.signal,
          assertNotCancelled:context.assertNotCancelled,
          update:patch => { providerMessage = clean(patch && patch.message, 300); }
        };
        try {
          if (store.getAppliedForNovel(novel)) skipped += 1;
          else {
            const retainedCandidates = store.listCandidatesForNovel(novel, 30);
            const recovered = retainedCandidates.length ? await autoApplyBestCandidate(novel, retainedCandidates) : null;
            if (recovered && recovered.candidate) {
              succeeded += 1;
              autoApplied += 1;
              recoveredApplied += 1;
            } else if (retainedCandidates.length) {
              candidateOnly += 1;
              skipped += 1;
            } else {
              const result = await processSearchJob({ ...job, type:'collect', mode:'search', novel }, itemContext);
              if (result.applied) {
                succeeded += 1;
                if (result.autoApplied) autoApplied += 1;
              } else if ((result.candidates || []).length) {
                succeeded += 1;
                candidateOnly += 1;
              } else empty += 1;
            }
          }
        } catch (error) {
          if (context.signal && context.signal.aborted || error && error.code === 'METADATA_JOB_CANCELLED') throw error;
          failed += 1;
          const attempts = Array.isArray(error && error.attempts) ? error.attempts : [];
          recentFailures.push({
            novelId:String(novel && novel.id || ''),
            title:clean(novel && novel.title, 200),
            code:clean(error && error.code, 120) || 'METADATA_ITEM_FAILED',
            message:clean(error && error.message || error, 500),
            attempts:attempts.slice(-10)
          });
          if (recentFailures.length > 50) recentFailures = recentFailures.slice(-50);
        }
        cursor += 1;
        batchOffset = entry.nextOffset;
        sinceCheckpoint += 1;
        const now = Date.now();
        if (sinceCheckpoint >= 10 || now - lastCheckpointAt >= 5000 || cursor >= total) {
          // Persist candidate/applied metadata before advancing the durable queue cursor.
          // On restart, an uncommitted cursor is replayed instead of exposing a completed
          // queue checkpoint whose metadata records were not yet written.
          await store.flush();
          context.update({
            progress:total ? Math.min(0.99, cursor / total) : 1,
            message:`전체 수집 ${cursor.toLocaleString()}/${total.toLocaleString()} · 성공 ${succeeded.toLocaleString()} · 실패 ${failed.toLocaleString()}${providerMessage ? ` · ${providerMessage}` : ''}`,
            cursor,
            batchOffset,
            succeeded,
            failed,
            empty,
            skipped,
            autoApplied,
            candidateOnly,
            recoveredApplied,
            currentNovelId:String(novel && novel.id || ''),
            currentTitle:clean(novel && novel.title, 200),
            recentFailures
          });
          sinceCheckpoint = 0;
          lastCheckpointAt = now;
        }
      }
      await removeBulkBatch(batchId);
      return { bulk:true, total, processed:cursor, succeeded, failed, empty, skipped, autoApplied, candidateOnly, recoveredApplied, recentFailures, restartResumePass:METADATA_BULK_RESTART_RESUME_PASS, collectedSkipPass:METADATA_BULK_COLLECTED_SKIP_PASS, autoApplyPass:METADATA_AUTO_APPLY_RECOVERY_PASS };
    } catch (error) {
      const code = String(error && error.code || context.signal?.reason?.code || '');
      // User cancellation discards the remaining batch. A server restart keeps the
      // durable batch and cursor so the same job resumes after the next boot.
      if (job.cancelRequested || code === 'METADATA_JOB_CANCELLED') await removeBulkBatch(batchId);
      throw error;
    }
  }

  async function processPendingApplyJob(job, context) {
    const batchId = safeBulkBatchId(job.batchId);
    const filePath = bulkFilePath(batchId);
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      throw Object.assign(new Error('일괄 적용 배치 파일을 찾을 수 없습니다.'), { code:'METADATA_BULK_BATCH_NOT_FOUND' });
    }
    const total = Math.max(0, Number(job.total) || 0);
    let cursor = Math.max(0, Number(job.cursor) || 0);
    let batchOffset = Math.max(0, Number(job.batchOffset) || 0);
    let appliedCount = Math.max(0, Number(job.appliedCount) || 0);
    let skipped = Math.max(0, Number(job.skipped) || 0);
    let failed = Math.max(0, Number(job.failed) || 0);
    let manualReview = Math.max(0, Number(job.manualReview) || 0);
    let recentFailures = Array.isArray(job.recentFailures) ? job.recentFailures.slice(-50) : [];
    let lastCheckpointAt = 0;
    let sinceCheckpoint = 0;
    try {
      for await (const entry of readBulkBatch(batchId, batchOffset)) {
        context.assertNotCancelled();
        const novel = entry.novel;
        try {
          if (store.getAppliedForNovel(novel)) skipped += 1;
          else {
            const candidates = store.listCandidatesForNovel(novel, 30);
            const assessment = selectAutoApplyCandidate(novel, candidates);
            if (!assessment) {
              manualReview += 1;
              skipped += 1;
            } else {
              store.applyCandidate(novel, assessment.candidate.id, assessment.fields);
              appliedCount += 1;
            }
          }
        } catch (error) {
          if (context.signal && context.signal.aborted || error && error.code === 'METADATA_JOB_CANCELLED') throw error;
          failed += 1;
          recentFailures.push({
            novelId:String(novel && novel.id || ''),
            title:clean(novel && novel.title, 200),
            code:clean(error && error.code, 120) || 'METADATA_BULK_APPLY_FAILED',
            message:clean(error && error.message || error, 500)
          });
          if (recentFailures.length > 50) recentFailures = recentFailures.slice(-50);
        }
        cursor += 1;
        batchOffset = entry.nextOffset;
        sinceCheckpoint += 1;
        const now = Date.now();
        if (sinceCheckpoint >= 25 || now - lastCheckpointAt >= 3000 || cursor >= total) {
          await store.flush();
          context.update({
            progress:total ? Math.min(0.99, cursor / total) : 1,
            message:`후보 일괄 적용 ${cursor.toLocaleString()}/${total.toLocaleString()} · 적용 ${appliedCount.toLocaleString()} · 실패 ${failed.toLocaleString()}`,
            cursor,
            batchOffset,
            appliedCount,
            skipped,
            failed,
            manualReview,
            currentNovelId:String(novel && novel.id || ''),
            currentTitle:clean(novel && novel.title, 200),
            recentFailures
          });
          sinceCheckpoint = 0;
          lastCheckpointAt = now;
        }
      }
      await removeBulkBatch(batchId);
      return { bulkApply:true, total, processed:cursor, appliedCount, skipped, failed, manualReview, recentFailures, pass:METADATA_BULK_APPLY_PASS };
    } catch (error) {
      const code = String(error && error.code || context.signal?.reason?.code || '');
      if (job.cancelRequested || code === 'METADATA_JOB_CANCELLED') await removeBulkBatch(batchId);
      throw error;
    }
  }

  async function probeProvider(providerId, query = '회귀') {
    const provider = getEnabledProvider(providerId);
    const providerSearchLimit = Math.min(3, Math.max(1, Number(provider.searchLimit) || searchLimit));
    const terms = { title:clean(query, 160) || '회귀', author:null };
    const request = provider.adapter.buildSearchRequest
      ? provider.adapter.buildSearchRequest(terms, providerSearchLimit)
      : { url:provider.adapter.buildSearchUrl(terms, providerSearchLimit), method:'GET', responseType:'html', requestProfile:provider.adapter.requestProfile || 'default' };
    const startedAt = Date.now();
    try {
      const response = await runProviderCollection(provider, { signal:null, update:null }, () => providerFetch(provider, request, 'request', { signal:null }));
      let parsed = [];
      try { parsed = provider.adapter.parseSearchResults(response.body, response.finalUrl, terms, providerSearchLimit) || []; }
      catch (error) {
        error.metadataStage = 'search_parse';
        throw error;
      }
      const shell = provider.id === 'builtin-joara' && looksLikeJavascriptShell(response.body);
      return {
        ok:!shell,
        providerId:provider.id,
        providerName:provider.name,
        stage:shell ? 'browser_capture_required' : parsed.length ? 'candidate' : 'search_empty',
        code:shell ? 'METADATA_BROWSER_CAPTURE_REQUIRED' : '',
        message:shell ? 'JavaScript 앱 셸만 반환되어 Metadata Helper 브라우저 캡처가 필요합니다.' : parsed.length ? `${parsed.length}개 후보를 파싱했습니다.` : '응답은 성공했지만 후보를 찾지 못했습니다.',
        candidates:parsed.slice(0,3).map(item => ({ title:clean(item.title,200), author:clean(item.author,120), sourceUrl:clean(item.sourceUrl,600) })),
        finalUrl:response.finalUrl,
        contentType:response.contentType,
        durationMs:Date.now() - startedAt
      };
    } catch (error) {
      const failure = classifyProviderFailure(error, error && error.metadataStage || 'search_transport');
      return { ok:false, providerId:provider.id, providerName:provider.name, ...failure, durationMs:Date.now() - startedAt };
    }
  }

  async function processJob(job, context) {
    if (!enabled) throw Object.assign(new Error('METADATA_FETCH_ENABLED=0 상태입니다.'), { code:'METADATA_FETCH_DISABLED' });
    try {
      if (job.type === BULK_JOB_TYPE) return await processBulkJob(job, context);
      if (job.type === APPLY_PENDING_JOB_TYPE) return await processPendingApplyJob(job, context);
      if (job.mode === 'direct') return await collectDirect(job, context);
      return await processSearchJob(job, context);
    } finally {
      await store.flush();
    }
  }

  const queue = createMetadataQueueService({
    storePath:queuePath,
    concurrency:options.concurrency,
    maxJobs:options.maxJobs,
    pollMs:options.pollMs,
    maxAttempts:options.maxAttempts,
    handler:processJob
  });

  function reconcileBulkBatchesOnStartup() {
    const activeJobs = queue.all().filter(job => [BULK_JOB_TYPE, APPLY_PENDING_JOB_TYPE].includes(job.type) && ['queued','running'].includes(job.status) && BULK_BATCH_RE.test(String(job.batchId || '')));
    const active = new Set(activeJobs.map(job => String(job.batchId)));
    let entries = [];
    try { entries = fs.readdirSync(bulkDir, { withFileTypes:true }); } catch { entries = []; }
    const nowMs = Date.now();
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(bulkDir, entry.name);
      if (/^mb_[a-f0-9]{24}\.jsonl$/.test(entry.name)) {
        const batchId = entry.name.slice(0,-6);
        if (!active.has(batchId)) {
          try { durableRemoveSync(fullPath, { force:true }); } catch {}
        }
        continue;
      }
      if (/^mb_[a-f0-9]{24}\.jsonl\.\d+\.\d+\.tmp$/.test(entry.name)) {
        try {
          const stat = fs.statSync(fullPath);
          if (nowMs - stat.mtimeMs > 5 * 60 * 1000) durableRemoveSync(fullPath, { force:true });
        } catch {}
      }
    }
    for (const job of activeJobs) {
      if (fs.existsSync(bulkFilePath(job.batchId))) continue;
      queue.update(job, {
        status:'failed',
        message:'재시작 복구 실패: 일괄 배치 파일 없음',
        finishedAt:new Date().toISOString(),
        lastError:'METADATA_BULK_BATCH_NOT_FOUND',
        result:{ code:'METADATA_BULK_BATCH_NOT_FOUND', restartReconciled:true }
      });
    }
    try { fsyncDirectorySync(bulkDir); } catch {}
  }
  reconcileBulkBatchesOnStartup();
  queue.start();

  function buildCollectJobInput(novel, input = {}, requestedBy = '') {
    if (!enabled) throw Object.assign(new Error('metadata fetch is disabled'), { code:'METADATA_FETCH_DISABLED' });
    const mode = input.url ? 'direct' : 'search';
    if (mode === 'direct' && !resolveRuntimeDirectMetadataTarget(input.url)) throw Object.assign(new Error('지원되는 공식 작품 상세 URL이 아닙니다.'), { code:'METADATA_DIRECT_URL_UNSUPPORTED' });
    return {
      type:'collect',
      mode,
      novel:snapshotNovel(novel),
      targetUrl:mode === 'direct' ? String(input.url).trim().slice(0,2048) : '',
      providerIds:normalizeProviderIds(input.providerIds),
      fallbackProviders:mode === 'search',
      requestedBy:String(requestedBy || '')
    };
  }

  async function collect(novel, input = {}, requestedBy = '') {
    const job = typeof queue.enqueueDurable === 'function'
      ? await queue.enqueueDurable(buildCollectJobInput(novel, input, requestedBy), { deferSchedule:false })
      : queue.enqueue(buildCollectJobInput(novel, input, requestedBy), { deferSchedule:true });
    if (typeof queue.enqueueDurable !== 'function') { await queue.flush(); queue.wake(); }
    return job;
  }

  async function collectMissing(novels, input = {}, requestedBy = '') {
    if (!enabled) throw Object.assign(new Error('metadata fetch is disabled'), { code:'METADATA_FETCH_DISABLED' });
    const providerIds = normalizeProviderIds(input.providerIds);
    const dedupeInput = { type:BULK_JOB_TYPE, mode:'search', bulkScope:'missing-all', providerIds };
    const active = queue.findActive(dedupeInput);
    if (active) return { count:Number(active.total) || 0, job:active, reused:true };
    const batch = await writeBulkBatch(novels);
    if (!batch.count) return { count:0, job:null, reused:false, recoveredApplied:batch.recoveredApplied || 0, pendingCandidates:batch.pendingCandidates || 0, autoApplyPass:METADATA_AUTO_APPLY_RECOVERY_PASS };
    const jobInput = {
      ...dedupeInput,
      batchId:batch.batchId,
      total:batch.count,
      cursor:0,
      batchOffset:0,
      succeeded:0,
      failed:0,
      empty:0,
      skipped:0,
      autoApplied:0,
      candidateOnly:0,
      recoveredApplied:0,
      pendingCandidates:Number(batch.pendingCandidates) || 0,
      requestedBy:String(requestedBy || '')
    };
    const job = typeof queue.enqueueDurable === 'function'
      ? await queue.enqueueDurable(jobInput, { deferSchedule:false })
      : queue.enqueue(jobInput, { deferSchedule:true });
    if (typeof queue.enqueueDurable !== 'function') { await queue.flush(); queue.wake(); }
    if (job.batchId !== batch.batchId) await removeBulkBatch(batch.batchId);
    return { count:Number(job.total) || batch.count, job, reused:job.batchId !== batch.batchId, recoveredApplied:batch.recoveredApplied || 0, pendingCandidates:batch.pendingCandidates || 0, autoApplyPass:METADATA_AUTO_APPLY_RECOVERY_PASS };
  }

  async function applyPending(novels, requestedBy = '') {
    const dedupeInput = { type:APPLY_PENDING_JOB_TYPE, mode:'apply', bulkScope:'pending-candidates' };
    const active = queue.findActive(dedupeInput);
    if (active) return { count:Number(active.total) || 0, job:active, reused:true, manualReview:Number(active.manualReview) || 0, pass:METADATA_BULK_APPLY_PASS };
    const batch = await writePendingApplyBatch(novels);
    if (!batch.count) return { count:0, job:null, reused:false, manualReview:batch.manualReview || 0, pass:METADATA_BULK_APPLY_PASS };
    const jobInput = {
      ...dedupeInput,
      batchId:batch.batchId,
      total:batch.count,
      cursor:0,
      batchOffset:0,
      appliedCount:0,
      skipped:0,
      failed:0,
      manualReview:Number(batch.manualReview) || 0,
      requestedBy:String(requestedBy || '')
    };
    const job = typeof queue.enqueueDurable === 'function'
      ? await queue.enqueueDurable(jobInput, { deferSchedule:false })
      : queue.enqueue(jobInput, { deferSchedule:true });
    if (typeof queue.enqueueDurable !== 'function') { await queue.flush(); queue.wake(); }
    if (job.batchId !== batch.batchId) await removeBulkBatch(batch.batchId);
    return { count:Number(job.total) || batch.count, job, reused:job.batchId !== batch.batchId, manualReview:Number(batch.manualReview) || 0, pass:METADATA_BULK_APPLY_PASS };
  }

  function getNovelMetadata(novel) {
    const rawCandidates = store.listCandidatesForNovel(novel, 100);
    const candidateGroups = buildCandidateGroups(novel, rawCandidates);
    return {
      applied:publicApplied(store.getAppliedForNovel(novel)),
      candidates:rawCandidates.slice(0,30).map(publicCandidate),
      candidateGroups:candidateGroups.map(publicCandidateGroup),
      candidateCount:rawCandidates.length,
      candidateGroupCount:candidateGroups.length,
      groupedCandidateCount:candidateGroups.reduce((total, group) => total + Math.max(0, Number(group.count || 0) - 1), 0),
      providers:listProviders(),
      fields:store.fields,
      enabled,
      pass:METADATA_COLLECTION_PASS,
      candidateGroupPass:METADATA_EQUIVALENT_GROUP_PASS
    };
  }

  function requesterIdsForJob(job = {}) {
    return Array.from(new Set([...(Array.isArray(job.requesters) ? job.requesters : []), job.requestedBy].map(value => String(value || '').trim()).filter(Boolean)));
  }

  async function cancelJob(jobId) {
    const job = queue.cancel(jobId);
    if (!job) return null;
    await queue.flush();
    if ([BULK_JOB_TYPE, APPLY_PENDING_JOB_TYPE].includes(job.type) && job.status === 'cancelled') await removeBulkBatch(job.batchId);
    return job;
  }

  return {
    collect,
    collectMissing,
    applyPending,
    getNovelMetadata,
    applyCandidate:async (novel,candidateId,fields) => {
      const applied = typeof store.applyCandidateDurably === 'function'
        ? await store.applyCandidateDurably(novel,candidateId,fields)
        : (store.applyCandidate(novel,candidateId,fields), await store.flush(), store.getAppliedForNovel(novel));
      return publicApplied(applied);
    },
    applyCandidateGroup:async (novel,groupId,fields) => {
      const group = findCandidateGroup(novel,groupId);
      const coverRepresentativeId = String(group.coverRepresentativeId || group.representativeId || '');
      const applied = typeof store.applyCandidateGroupDurably === 'function'
        ? await store.applyCandidateGroupDurably(novel,group.representativeId,coverRepresentativeId,fields)
        : typeof store.applyCandidateDurably === 'function'
          ? await store.applyCandidateDurably(novel,group.representativeId,fields)
          : (store.applyCandidate(novel,group.representativeId,fields), await store.flush(), store.getAppliedForNovel(novel));
      return { applied:publicApplied(applied), group:publicCandidateGroup(group) };
    },
    removeCandidate:async (novel,candidateId) => {
      const removed = typeof store.removeCandidateDurably === 'function'
        ? await store.removeCandidateDurably(novel,candidateId)
        : (store.removeCandidate(novel,candidateId), await store.flush(), true);
      return publicCandidate(removed);
    },
    removeCandidateGroup:async (novel,groupId) => {
      const group = findCandidateGroup(novel,groupId);
      const removed = typeof store.removeCandidateGroupDurably === 'function'
        ? await store.removeCandidateGroupDurably(novel,group._candidateIds)
        : await Promise.all(group._candidateIds.map(candidateId => store.removeCandidateDurably(novel,candidateId)));
      return { group:publicCandidateGroup(group), removedCount:Array.isArray(removed) ? removed.length : group._candidateIds.length, pass:METADATA_EQUIVALENT_GROUP_PASS };
    },
    saveManualMetadata:async (novel,input) => {
      if (typeof store.saveManualMetadataDurably === 'function') await store.saveManualMetadataDurably(novel,input);
      else { store.saveManualMetadata(novel,input); await store.flush(); }
      return publicApplied(store.getAppliedForNovel(novel));
    },
    getAppliedRecord:novel => publicApplied(store.getAppliedForNovel(novel)),
    removeApplied:async novel => typeof store.removeAppliedDurably === 'function'
      ? store.removeAppliedDurably(novel)
      : (store.removeApplied(novel), await store.flush()),
    enrichNovel:novel => store.enrichNovel(novel),
    getRevision:() => store.getRevision(),
    getPresentationRevision:() => typeof store.getAppliedRevision === 'function' ? store.getAppliedRevision() : store.getRevision(),
    listProviders,
    setProviderSettings:async (providerId,patch) => {
      if (!runtimeProvider(providerId)) throw Object.assign(new Error('metadata provider not found'), { code:'METADATA_PROVIDER_NOT_FOUND' });
      return typeof store.setProviderSettingsDurably === 'function'
        ? store.setProviderSettingsDurably(providerId,patch)
        : (store.setProviderSettings(providerId,patch), await store.flush(), store.getProviderSettings(providerId));
    },
    saveProviderDefinition:async (providerId,input = {}) => {
      const id = String(providerId || input.id || '');
      const base = getBuiltinMetadataProvider(id);
      const kind = base ? 'builtin' : 'custom';
      const previous = providerDefinition(base ? id : (id.startsWith('custom-') ? id : `custom-${id}`));
      const normalized = normalizeDefinition({ ...input, id, kind, revision:Math.min(9999, Math.max(1, Number(previous?.revision) || 0) + 1), updatedAt:new Date().toISOString() }, { kind, id, name:input.name || base?.name });
      const savedId = normalized.id;
      if (typeof store.setProviderDefinitionDurably === 'function') await store.setProviderDefinitionDurably(savedId, normalized);
      else { store.setProviderDefinition(savedId, normalized); await store.flush(); }
      if (!base && typeof store.setProviderSettingsDurably === 'function') await store.setProviderSettingsDurably(savedId, { enabled:input.enabled !== false, priority:input.priority || 100 });
      return providerDescriptor(runtimeProvider(savedId));
    },
    resetProviderDefinition:async providerId => {
      const id = String(providerId || '');
      if (!getBuiltinMetadataProvider(id)) throw Object.assign(new Error('기본 공급자만 초기화할 수 있습니다.'), { code:'METADATA_PROVIDER_DEFINITION_RESET_INVALID' });
      if (typeof store.removeProviderDefinitionDurably === 'function') await store.removeProviderDefinitionDurably(id);
      else { store.removeProviderDefinition(id); await store.flush(); }
      return providerDescriptor(runtimeProvider(id));
    },
    removeCustomProvider:async providerId => {
      const id = String(providerId || '');
      const current = runtimeProvider(id);
      if (!current || current.providerKind !== 'custom') throw Object.assign(new Error('사용자 정의 공급자를 찾지 못했습니다.'), { code:'METADATA_PROVIDER_NOT_FOUND' });
      if (typeof store.removeProviderDefinitionDurably === 'function') await store.removeProviderDefinitionDurably(id);
      else { store.removeProviderDefinition(id); await store.flush(); }
      return true;
    },
    probeProvider,
    listJobs:limit => queue.list(limit),
    listJobsForRequester:(requestedBy,limit = 100) => {
      const actor = String(requestedBy || '').trim();
      return queue.all()
        .filter(job => requesterIdsForJob(job).includes(actor))
        .sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, Math.max(1, Math.min(500, Number(limit) || 100)));
    },
    getJob:jobId => queue.get(jobId),
    cancelJob,
    createBrowserCapturePairing:(novel,actorId) => browserCapture.createPairing(novel,actorId),
    importBrowserCapture:async (novel,actorId,token,capture) => {
      const result = await browserCapture.importCapture(novel,actorId,token,capture);
      const appliedResult = await autoApplyBestCandidate(novel, [result.candidate], { flush:true });
      return {
        ...result,
        candidate:publicCandidate(result.candidate),
        applied:publicApplied(appliedResult && appliedResult.applied),
        autoApplied:!!(appliedResult && appliedResult.candidate),
        autoApplyReason:appliedResult && appliedResult.assessment && appliedResult.assessment.reason || null,
        autoApplyPass:METADATA_AUTO_APPLY_POLICY_PASS
      };
    },
    queueStatus:() => ({ ...queue.status(), store:store.getPersistenceStatus() }),
    metadataStorageStats:() => typeof store.getStorageStats === 'function' ? store.getStorageStats() : null,
    planMetadataCandidateCleanup:(policy = {}, context = {}) => typeof store.buildCandidateCleanupPlanAsync === 'function'
      ? store.buildCandidateCleanupPlanAsync({ ...policy, dryRun:true }, context)
      : (typeof store.buildCandidateCleanupPlan === 'function' ? Promise.resolve(store.buildCandidateCleanupPlan({ ...policy, dryRun:true }, context)) : Promise.resolve(null)),
    cleanupMetadataCandidates:(policy = {}, context = {}) => typeof store.cleanupCandidatesDurably === 'function'
      ? store.cleanupCandidatesDurably({ ...policy, dryRun:false }, context)
      : Promise.reject(Object.assign(new Error('metadata candidate maintenance is unavailable'), { code:'METADATA_MAINTENANCE_UNAVAILABLE' })),
    rewriteMetadataCompressedStore:() => typeof store.rewriteCompressedDurably === 'function'
      ? store.rewriteCompressedDurably()
      : Promise.reject(Object.assign(new Error('metadata compression is unavailable'), { code:'METADATA_MAINTENANCE_UNAVAILABLE' })),
    stop:async () => {
      await queue.stop();
      await store.close();
    },
    hasCoverAsset:assetId => store.hasCoverAsset(assetId),
    canAccessCover:(assetId,novels) => store.canAccessCover(assetId, novels),
    createCoverAccessScope:novels => store.createCoverAccessScope(novels),
    canAccessCoverWithScope:(assetId,scope) => store.canAccessCoverWithScope(assetId, scope),
    collectionCooldownRangeMs:[Math.round(requestIntervalMs * REQUEST_DELAY_MIN_MULTIPLIER), Math.round(requestIntervalMs * REQUEST_DELAY_MAX_MULTIPLIER)],
    requestDelayRangeMs:[Math.round(requestIntervalMs * REQUEST_DELAY_MIN_MULTIPLIER), Math.round(requestIntervalMs * REQUEST_DELAY_MAX_MULTIPLIER)],
    providerCooldownStatus:providerId => providerCompletionCooldown.status(providerId),
    providerCooldownPass:METADATA_PROVIDER_COMPLETION_COOLDOWN_PASS,
    lowCpuCollectionPass:METADATA_LOW_CPU_COLLECTION_PASS,
    enabled,
    pass:METADATA_COLLECTION_PASS
  };
}

module.exports = {
  METADATA_COLLECTION_PASS,
  BULK_JOB_TYPE,
  APPLY_PENDING_JOB_TYPE,
  METADATA_BULK_APPLY_PASS,
  METADATA_BULK_RESTART_RESUME_PASS,
  METADATA_BULK_COLLECTED_SKIP_PASS,
  METADATA_AUTO_APPLY_RECOVERY_PASS,
  METADATA_SCORE_FIRST_LIVE_COMPETITION_PASS,
  METADATA_ABORT_SAFE_PACING_PASS,
  METADATA_PROVIDER_COMPLETION_COOLDOWN_PASS,
  METADATA_LOW_CPU_COLLECTION_PASS,
  METADATA_AUTO_APPLY_POLICY_PASS,
  REQUEST_DELAY_MIN_MULTIPLIER,
  REQUEST_DELAY_MAX_MULTIPLIER,
  computeRandomRequestDelayMs,
  createProviderCompletionCooldownCoordinator,
  createMetadataService,
  snapshotNovel,
  candidateFields,
  METADATA_EQUIVALENT_GROUP_PASS,
  publicCandidate,
  publicApplied,
  classifyProviderFailure,
  looksLikeJavascriptShell
};
