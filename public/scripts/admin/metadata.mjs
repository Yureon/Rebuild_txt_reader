import { ApiClient } from '../rebuild/core/api.mjs';

// OWNER_METADATA_SETTINGS_PASS = 'v587-owner-metadata-settings-pass' — legacy owner metadata contract.
export const OWNER_METADATA_SETTINGS_PASS = 'v643-owner-metadata-locale-settings-pass';

const api = new ApiClient({ deviceId:'owner-console-metadata' });
const state = {
  providers:[],
  login:null,
  loginTimer:0,
  screenshotSerial:0,
  loading:false,
  providerReturnFocus:null,
  storage:null,
  cleanupPlan:null,
  storageLoading:false,
  metadataAvailableForLocale:true,
  requestedSiteLanguage:'ko',
  refreshPending:false,
  activeTab:'basic'
};

function clean(value, max = 1000) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function node(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') element.className = String(value);
    else if (key === 'text') element.textContent = String(value);
    else if (key === 'dataset') Object.entries(value).forEach(([name, item]) => { element.dataset[name] = String(item); });
    else if (key === 'checked') element.checked = !!value;
    else if (key === 'disabled') element.disabled = !!value;
    else if (key in element && !key.startsWith('aria-')) {
      try { element[key] = value; } catch { element.setAttribute(key, String(value)); }
    } else element.setAttribute(key, String(value));
  }
  for (const child of (Array.isArray(children) ? children : [children])) {
    if (child == null || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

function setStatus(message, error = false) {
  const target = document.getElementById('owner-metadata-status');
  if (!target) return;
  target.textContent = clean(message, 1200);
  target.classList.toggle('error', !!error);
}

function formatProviderPacing(provider = {}) {
  const baseMs = Math.max(3000, Number(provider.baseCollectionCooldownMs ?? provider.baseRequestIntervalMs) || 3000);
  const rawRange = Array.isArray(provider.collectionCooldownRangeMs)
    ? provider.collectionCooldownRangeMs
    : Array.isArray(provider.requestDelayRangeMs) ? provider.requestDelayRangeMs : [];
  const minMs = Math.max(4500, Number(rawRange[0]) || Math.round(baseMs * 1.5));
  const maxMs = Math.max(minMs, Math.max(6000, Number(rawRange[1]) || Math.round(baseMs * 2)));
  return `같은 공급자 수집 완료 후 ${(minMs / 1000).toFixed(1)}~${(maxMs / 1000).toFixed(1)}초 · 기준 ${(baseMs / 1000).toFixed(1)}초`;
}

function profileLabel(profile = {}) {
  if (!profile.supported) return 'Playwright 미지원';
  if (!profile.enabled) return 'Playwright 비활성화';
  const status = String(profile.status || 'empty');
  if (status === 'ready') return '로그인됨';
  if (status === 'login_active') return '로그인 진행 중';
  if (status === 'verification_required') return '성인 인증 필요';
  if (status === 'expired') return '재로그인 필요';
  if (status === 'unknown') return '프로필 확인 필요';
  return '미로그인';
}

function autoApplyPercent(provider) {
  const raw = Number(provider?.autoApplyThresholdPercent ?? (Number(provider?.autoApplyThreshold) * 100));
  return Number.isFinite(raw) ? `${Math.round(raw * 10) / 10}%` : '95%';
}

const DEFINITION_SELECTOR_FIELDS = Object.freeze([
  ['searchResult','검색 결과 카드'],['searchTitle','검색 제목'],['searchAuthor','검색 작가'],['searchLink','상세 링크'],['searchId','원격 ID'],['searchCover','검색 표지'],
  ['detailTitle','상세 제목'],['detailAuthor','상세 작가'],['detailSynopsis','소개글'],['detailGenres','장르'],['detailTags','태그'],['detailCover','상세 표지']
]);

function definitionInput(field, label, value = '', options = {}) {
  return node('label', { class:options.wide ? 'wide' : '' }, [
    node('span', { text:label }),
    node('input', {
      type:options.type || 'text',
      value:value || '',
      maxlength:options.maxlength || 2400,
      placeholder:options.placeholder || '',
      autocomplete:'off',
      dataset:options.selector ? { definitionSelector:field } : options.attribute ? { definitionAttribute:field } : { definitionField:field }
    })
  ]);
}

function providerDefinitionEditor(provider) {
  const definition = provider.definition || provider.definitionDefaults || {};
  const selectors = definition.selectors || {};
  const attributes = definition.attributes || {};
  const custom = provider.providerKind === 'custom';
  const mode = custom ? 'selector' : (provider.definition?.mode || definition.mode || 'request');
  const actions = [node('button', { type:'button', class:'primary', dataset:{ ownerMetadataAction:'save-definition' }, text:custom ? 'URL·selector 저장' : 'override 저장' })];
  if (custom) actions.push(node('button', { type:'button', class:'danger', dataset:{ ownerMetadataAction:'delete-provider' }, text:'고급 공급자 삭제' }));
  else actions.push(node('button', { type:'button', dataset:{ ownerMetadataAction:'reset-definition' }, disabled:!provider.definition, text:'내장 기본값 복원' }));
  return node('details', { class:'owner-metadata-definition-editor', open:custom }, [
    node('summary', { text:custom ? '검색 URL·상세 URL·selector 편집' : `URL·selector 직접 수정 ${provider.definition ? `· ${mode === 'selector' ? 'selector parser' : '내장 parser'} override 사용 중` : '· 내장 기본값 사용 중'}` }),
    node('p', { class:'owner-metadata-definition-note', text:custom
      ? '지원 selector: tag, #id, .class, [attr=value], 공백 하위 선택자. 저장 전 서버가 URL·selector 계약을 검증합니다.'
      : 'URL만 변경할 때는 내장 parser 유지 모드를 사용하십시오. HTML 구조까지 바뀌었을 때만 selector parser로 전환하고 필수 selector를 입력하십시오.' }),
    node('div', { class:'owner-metadata-definition-grid compact' }, [
      custom ? null : node('label', {}, [
        node('span', { text:'override 방식' }),
        node('select', { dataset:{ definitionField:'mode' } }, [
          node('option', { value:'request', selected:mode === 'request', text:'내장 parser 유지 · URL만 수정' }),
          node('option', { value:'selector', selected:mode === 'selector', text:'selector parser로 교체' })
        ])
      ]),
      definitionInput('name','표시 이름', definition.name || provider.name, { maxlength:100 }),
      definitionInput('description','설명', definition.description || provider.description || '', { maxlength:500 }),
      definitionInput('searchUrlTemplate','검색 URL 템플릿', definition.searchUrlTemplate || '', { type:'url', wide:true, placeholder:'https://example.com/search?q={query}&limit={limit}' }),
      definitionInput('detailUrlTemplate','상세정보 URL 템플릿', definition.detailUrlTemplate || '', { type:'url', wide:true, placeholder:'https://example.com/novel/{id} 또는 {url}' }),
      definitionInput('coverHosts','표지 CDN host', Array.isArray(definition.coverHosts) ? definition.coverHosts.join(', ') : '', { wide:true, maxlength:1000, placeholder:'img.example.com, cdn.example.com' })
    ]),
    node('div', { class:'owner-metadata-selector-grid' }, DEFINITION_SELECTOR_FIELDS.map(([field,label]) => definitionInput(field,label,selectors[field] || '', { selector:true, maxlength:240 }))),
    node('div', { class:'owner-metadata-definition-grid compact attributes' }, [
      definitionInput('searchLink','상세 링크 속성', attributes.searchLink || 'href', { attribute:true, maxlength:40 }),
      definitionInput('searchId','원격 ID 속성', attributes.searchId || '', { attribute:true, maxlength:40 }),
      definitionInput('searchCover','검색 표지 속성', attributes.searchCover || 'src', { attribute:true, maxlength:40 }),
      definitionInput('detailCover','상세 표지 속성', attributes.detailCover || 'src', { attribute:true, maxlength:40 })
    ]),
    node('div', { class:'owner-metadata-definition-actions' }, actions)
  ]);
}

function providerCard(provider) {
  const profile = provider.browserProfile || {};
  const status = String(profile.status || 'empty');
  const custom = provider.providerKind === 'custom';
  const loginLabel = status === 'ready' ? '다시 로그인' : status === 'login_active' ? '로그인 화면 열기' : status === 'verification_required' ? '성인 인증 계속' : '로그인 시작';
  const actions = [];
  if (provider.browserProfileSupported) {
    actions.push(node('button', { type:'button', class:'primary owner-metadata-login-button', dataset:{ ownerMetadataAction:'login' }, text:loginLabel }));
    if (profile.configured) actions.push(node('button', { type:'button', dataset:{ ownerMetadataAction:'delete-profile' }, text:'프로필 삭제' }));
  }
  actions.push(node('button', { type:'button', dataset:{ ownerMetadataAction:'probe' }, text:'연결 진단' }));
  actions.push(node('button', { type:'button', dataset:{ ownerMetadataAction:'save' }, text:'운영 설정 저장' }));

  return node('article', { class:'owner-metadata-provider-card', dataset:{ ownerMetadataProvider:provider.id, providerKind:provider.providerKind || 'builtin' } }, [
    node('div', { class:'owner-metadata-provider-head' }, [
      node('div', { class:'owner-metadata-provider-title' }, [
        node('label', {}, [node('input', { type:'checkbox', checked:provider.enabled, dataset:{ ownerMetadataEnabled:'1' } }), node('strong', { text:provider.name })]),
        node('span', { class:'owner-metadata-provider-kind', text:custom ? '고급 사용자 정의' : provider.definitionMode === 'selector' ? '기본 공급자 · selector override' : provider.definitionMode === 'request' ? '기본 공급자 · URL override' : '기본 공급자 · 내장 엔진' }),
        node('small', { text:`우선순위 ${provider.priority} · ${formatProviderPacing(provider)}` })
      ]),
      node('span', { class:`owner-metadata-profile-state status-${status}`, text:custom ? '제한 selector' : profileLabel(profile) })
    ]),
    provider.browserProfileSupported ? node('div', { class:'owner-metadata-auth-panel' }, [
      node('div', {}, [node('strong', { text:'서버 Playwright 영구 프로필' }), node('p', { text:status === 'ready' ? '메타데이터 수집이 이 공급자 전용 로그인 프로필을 우선 사용합니다.' : provider.browserVerificationHint || '서버 브라우저 화면에서 직접 로그인하면 로그인·성인 작품 수집에 사용됩니다.' })]),
      profile.updatedAt ? node('small', { text:`마지막 변경 ${profile.updatedAt}` }) : null,
      profile.lastError ? node('small', { class:'error', text:profile.lastError }) : null
    ]) : node('div', { class:'owner-metadata-auth-panel secondary' }, [
      node('strong', { text:custom ? 'HTTPS 공개 페이지 selector 공급자' : '공개 검색 전용 공급자' }),
      node('p', { text:custom ? 'JavaScript 실행 없이 서버가 받은 HTML에서 제한 selector만 평가합니다.' : '이 공급자는 서버 Playwright 로그인 프로필을 지원하지 않습니다.' })
    ]),
    node('div', { class:'owner-metadata-provider-form' }, [
      node('div', { class:'owner-metadata-provider-controls' }, [
        node('label', { class:'checkline owner-metadata-control-tile' }, [node('input', { type:'checkbox', checked:provider.autoApply, dataset:{ ownerMetadataAuto:'1' } }), node('span', { text:`${autoApplyPercent(provider)} 이상 자동 적용` })]),
        node('label', { class:'owner-metadata-priority owner-metadata-control-tile' }, [node('span', { text:'검색 우선순위', title:'숫자가 작을수록 먼저 사용됩니다.' }), node('input', { type:'number', min:1, max:999, value:provider.priority, dataset:{ ownerMetadataPriority:'1' } })]),
        node('label', { class:'owner-metadata-control-tile owner-metadata-number-control' }, [node('span', { text:'자동 적용 기준' }), node('input', { type:'number', min:70, max:100, step:0.1, value:Number(provider.autoApplyThresholdPercent || 95), dataset:{ ownerMetadataThreshold:'1' } })]),
        node('label', { class:'owner-metadata-control-tile owner-metadata-number-control' }, [node('span', { text:'수집 완료 후 쿨타임 기준(초)' }), node('input', { type:'number', min:3, max:60, step:0.1, value:(Math.max(3000, Number(provider.baseCollectionCooldownMs ?? provider.baseRequestIntervalMs) || 3000) / 1000), dataset:{ ownerMetadataInterval:'1' } })]),
        node('label', { class:'owner-metadata-control-tile owner-metadata-number-control' }, [node('span', { text:'검색 결과 수' }), node('input', { type:'number', min:1, max:10, step:1, value:Math.max(1, Math.min(10, Number(provider.searchLimit) || 5)), dataset:{ ownerMetadataSearchLimit:'1' } })])
      ]),
      node('div', { class:'actions owner-metadata-provider-actions' }, actions)
    ]),
    providerDefinitionEditor(provider)
  ]);
}

function captureProviderListView() {
  const list = document.getElementById('owner-metadata-provider-list');
  const active = document.activeElement instanceof Element ? document.activeElement : null;
  const card = active?.closest?.('[data-owner-metadata-provider]') || null;
  const action = active?.closest?.('[data-owner-metadata-action]') || null;
  let listTop = 0;
  try { listTop = Number(list?.getBoundingClientRect?.().top) || 0; } catch {}
  let anchorProviderId = '';
  let anchorOffset = 0;
  for (const item of Array.from(list?.querySelectorAll?.('[data-owner-metadata-provider]') || [])) {
    let rect = null;
    try { rect = item.getBoundingClientRect?.(); } catch {}
    if (!rect || Number(rect.bottom) < 0) continue;
    anchorProviderId = String(item.dataset.ownerMetadataProvider || '');
    anchorOffset = Math.round((Number(rect.top) || listTop) - listTop);
    break;
  }
  return {
    scrollY:Math.max(0,Number(window.scrollY)||0),
    anchorProviderId,
    anchorOffset,
    focusedProviderId:String(card?.dataset?.ownerMetadataProvider || ''),
    focusedAction:String(action?.dataset?.ownerMetadataAction || '')
  };
}

function restoreProviderListView(snapshot, explicitFocus = null) {
  const targetFocus = explicitFocus || snapshot || null;
  requestAnimationFrame(() => {
    const list = document.getElementById('owner-metadata-provider-list');
    if (!list) return;
    const anchor = snapshot?.anchorProviderId
      ? Array.from(list.querySelectorAll('[data-owner-metadata-provider]')).find(item => String(item.dataset.ownerMetadataProvider || '') === snapshot.anchorProviderId)
      : null;
    if (anchor) {
      let listTop = 0;
      let anchorTop = 0;
      try {
        listTop = Number(list.getBoundingClientRect?.().top) || 0;
        anchorTop = Number(anchor.getBoundingClientRect?.().top) || listTop;
      } catch {}
      const delta = Math.round(anchorTop - listTop - (Number(snapshot.anchorOffset)||0));
      if (Math.abs(delta) > 1) window.scrollBy({ top:delta, left:0, behavior:'auto' });
    } else if (snapshot && Math.abs((Number(window.scrollY)||0) - (Number(snapshot.scrollY)||0)) > 1) {
      window.scrollTo({ top:Math.max(0,Number(snapshot.scrollY)||0), left:0, behavior:'auto' });
    }
    const providerId = String(targetFocus?.providerId || targetFocus?.focusedProviderId || '');
    const actionName = String(targetFocus?.action || targetFocus?.focusedAction || '');
    if (!providerId || !actionName) return;
    const card = Array.from(list.querySelectorAll('[data-owner-metadata-provider]')).find(item => String(item.dataset.ownerMetadataProvider || '') === providerId);
    const replacement = card?.querySelector?.(`[data-owner-metadata-action="${actionName}"]`);
    const active = document.activeElement;
    if (replacement && (!active || active === document.body || !document.contains(active))) replacement.focus({ preventScroll:true });
  });
}

function renderProviders(options = {}) {
  const builtinTarget = document.getElementById('owner-metadata-provider-list');
  const customTarget = document.getElementById('owner-metadata-custom-provider-list');
  if (!builtinTarget || !customTarget) return;
  const viewState = options.preserveView === false ? null : captureProviderListView();
  if (!state.metadataAvailableForLocale) {
    const notice = () => node('div', { class:'owner-metadata-locale-notice', role:'status' }, [
      node('strong', { text:'한국어에서만 메타데이터 공급자를 사용할 수 있습니다.' }),
      node('p', { class:'muted', text:'현재 사이트 언어에서는 metadata 공급자를 표시하거나 활성화하지 않습니다.' })
    ]);
    builtinTarget.replaceChildren(notice());
    customTarget.replaceChildren(notice());
    return;
  }
  const builtins = state.providers.filter(provider => provider.providerKind !== 'custom');
  const custom = state.providers.filter(provider => provider.providerKind === 'custom');
  builtinTarget.replaceChildren(...(builtins.length ? builtins.map(providerCard) : [node('p', { class:'muted', text:'사용 가능한 기본 metadata 공급자가 없습니다.' })]));
  customTarget.replaceChildren(...(custom.length ? custom.map(providerCard) : [node('p', { class:'muted', text:'등록된 고급 공급자가 없습니다.' })]));
  restoreProviderListView(viewState, options.returnFocus || null);
}

function setRefreshButtonBusy(busy) {
  const button = document.getElementById('owner-metadata-refresh');
  if (!button) return;
  button.disabled = !!busy;
  button.setAttribute('aria-busy', busy ? 'true' : 'false');
  button.textContent = busy ? '새로고침 중…' : '공급자 새로고침';
}

async function loadProviders(options = {}) {
  if (state.loading) {
    state.refreshPending = true;
    return;
  }
  state.loading = true;
  state.refreshPending = false;
  setRefreshButtonBusy(true);
  setStatus('공급자 설정을 불러오는 중입니다.');
  try {
    const payload = await api.metadataProviders({ noRedirect:true });
    if (payload.canManageBrowserProfiles !== true) throw Object.assign(new Error('owner 세션에서만 metadata 공급자 설정을 관리할 수 있습니다.'), { status:403 });
    state.metadataAvailableForLocale = payload.metadataAvailableForLocale !== false;
    state.requestedSiteLanguage = clean(payload.requestedSiteLanguage || document.documentElement.dataset.siteLanguage || 'ko', 48);
    state.providers = state.metadataAvailableForLocale && Array.isArray(payload.providers) ? payload.providers : [];
    renderProviders(options);
    setStatus(state.metadataAvailableForLocale
      ? `기본 공급자 ${state.providers.filter(item => item.providerKind !== 'custom').length}개 · 고급 공급자 ${state.providers.filter(item => item.providerKind === 'custom').length}개를 새로 불러왔습니다.`
      : '현재 사이트 언어에서는 한국어 metadata 공급자를 비활성화했습니다.');
  } catch (error) {
    setStatus(`metadata 설정을 불러오지 못했습니다: ${error.message || error}`, true);
  } finally {
    state.loading = false;
    setRefreshButtonBusy(false);
    if (state.refreshPending) {
      state.refreshPending = false;
      void loadProviders({ preserveView:true });
    }
  }
}


function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)}GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

function setStorageStatus(message, error = false) {
  const target = document.getElementById('owner-metadata-storage-status');
  if (!target) return;
  target.textContent = clean(message, 1600);
  target.classList.toggle('error', !!error);
}

function metadataCleanupPolicy() {
  return {
    olderThanDays:Math.max(1, Math.min(3650, Number(document.getElementById('owner-metadata-cleanup-days')?.value) || 30)),
    orphanOlderThanDays:Math.max(1, Math.min(3650, Number(document.getElementById('owner-metadata-orphan-days')?.value) || 7)),
    keepPerWork:Math.max(0, Math.min(100, Number(document.getElementById('owner-metadata-keep-work')?.value) || 0)),
    keepPerProvider:Math.max(0, Math.min(20, Number(document.getElementById('owner-metadata-keep-provider')?.value) || 0))
  };
}

function renderStorage(storage = state.storage) {
  if (!storage) return;
  const set = (name, value) => {
    const target = document.querySelector(`[data-metadata-storage-stat="${name}"]`);
    if (target) target.textContent = value;
  };
  set('candidates', Number(storage.candidateCount || 0).toLocaleString('ko-KR'));
  set('applied', Number(storage.appliedCount || 0).toLocaleString('ko-KR'));
  set('logical', formatBytes(storage.logicalBytes));
  set('disk', formatBytes(storage.totalDiskBytes));
  set('ratio', storage.logicalBytes ? `${Math.round((1 - Number(storage.compressionRatio || 0)) * 1000) / 10}% 절감` : '-');
}

function renderCleanupPlan(result) {
  const target = document.getElementById('owner-metadata-cleanup-preview-result');
  const apply = document.getElementById('owner-metadata-cleanup-apply');
  if (!target) return;
  state.cleanupPlan = result || null;
  const count = Math.max(0, Number(result?.removeCount) || 0);
  if (apply) apply.disabled = count < 1;
  if (!result) { target.hidden = true; target.replaceChildren(); return; }
  const items = Array.isArray(result.sample) ? result.sample : [];
  target.hidden = false;
  target.replaceChildren(
    node('strong', { text:`정리 대상 ${count.toLocaleString('ko-KR')}개 · 예상 JSON ${formatBytes(result.estimatedLogicalBytes)}` }),
    node('span', { text:`고아 후보 ${Number(result.reasons?.orphaned || 0).toLocaleString('ko-KR')}개 · 오래된 초과 후보 ${Number(result.reasons?.stale || 0).toLocaleString('ko-KR')}개 · 적용 중인 후보는 제외됩니다.` }),
    items.length ? node('ul', {}, items.slice(0, 12).map(item => node('li', {}, [
      node('code', { text:item.providerId || 'provider' }),
      ` · ${item.reason === 'orphaned' ? '서재에서 사라짐' : '보존 수 초과'} · ${String(item.updatedAt || '').slice(0, 10) || '-'} · ${formatBytes(item.logicalBytes)}`
    ]))) : node('span', { class:'muted', text:'현재 정책으로 정리할 미사용 후보가 없습니다.' })
  );
}

async function loadStorage() {
  if (state.storageLoading) return;
  state.storageLoading = true;
  setStorageStatus('압축 저장소 용량을 계산하는 중입니다.');
  try {
    const payload = await api.metadataStorage({ noRedirect:true });
    state.storage = payload.storage || null;
    renderStorage();
    setStorageStatus(`후보 ${Number(state.storage?.candidateCount || 0).toLocaleString('ko-KR')}개 · 압축 저장소 ${formatBytes(state.storage?.compressedBytes)} · backup ${formatBytes(state.storage?.backupBytes)}`);
  } catch (error) {
    setStorageStatus(`메타데이터 저장소 통계를 불러오지 못했습니다: ${error.message || error}`, true);
  } finally { state.storageLoading = false; }
}

async function previewCleanup() {
  setStorageStatus('미사용 후보 정리 범위를 계산하는 중입니다.');
  try {
    const payload = await api.previewMetadataCandidateCleanup(metadataCleanupPolicy(), { noRedirect:true });
    renderCleanupPlan(payload.result || null);
    setStorageStatus(`미리보기 완료: ${Number(payload.result?.removeCount || 0).toLocaleString('ko-KR')}개 후보가 정리 대상입니다.`);
  } catch (error) {
    renderCleanupPlan(null);
    setStorageStatus(`정리 미리보기 실패: ${error.message || error}`, true);
  }
}

async function applyCleanup() {
  const count = Math.max(0, Number(state.cleanupPlan?.removeCount) || 0);
  if (!count) return;
  if (!window.confirm(`적용 중이 아닌 미사용 메타데이터 후보 ${count.toLocaleString('ko-KR')}개를 삭제하고 저장소를 다시 압축할까요? 이 작업은 후보 수집 기록을 제거하지만 현재 적용된 메타데이터는 유지합니다.`)) return;
  setStorageStatus('미사용 후보를 삭제하고 압축 저장소를 갱신하는 중입니다.');
  try {
    const payload = await api.cleanupMetadataCandidates(metadataCleanupPolicy(), { noRedirect:true });
    renderCleanupPlan(null);
    state.storage = payload.result?.storage || state.storage;
    renderStorage();
    setStorageStatus(`정리 완료: ${Number(payload.result?.removedCount || payload.result?.removeCount || 0).toLocaleString('ko-KR')}개 후보를 삭제했습니다.`);
  } catch (error) {
    setStorageStatus(`후보 정리 실패: ${error.message || error}`, true);
  }
}

async function rewriteCompressedStore() {
  setStorageStatus('메타데이터 저장소를 gzip으로 다시 쓰는 중입니다.');
  try {
    const payload = await api.rewriteMetadataCompressedStore({ noRedirect:true });
    state.storage = payload.storage || state.storage;
    renderStorage();
    setStorageStatus(`압축 저장소 갱신 완료: ${formatBytes(state.storage?.compressedBytes)} (${state.storage?.compressionLevel || 6}단계)`);
  } catch (error) {
    setStorageStatus(`압축 저장소 갱신 실패: ${error.message || error}`, true);
  }
}

function modalElements() {
  return {
    modal:document.getElementById('owner-metadata-login-modal'),
    title:document.getElementById('owner-metadata-login-title'),
    subtitle:document.getElementById('owner-metadata-login-subtitle'),
    status:document.getElementById('owner-metadata-login-status'),
    screen:document.getElementById('owner-metadata-login-screen'),
    url:document.getElementById('owner-metadata-login-url'),
    text:document.getElementById('owner-metadata-login-text'),
    password:document.getElementById('owner-metadata-login-password'),
    body:document.querySelector('[data-owner-metadata-login-body]'),
    footer:document.querySelector('[data-owner-metadata-login-footer]')
  };
}

function setLoginStatus(message, error = false) {
  const target = modalElements().status;
  if (!target) return;
  target.textContent = clean(message, 1000);
  target.classList.toggle('error', !!error);
}

function stopLoginPolling() {
  window.clearTimeout(state.loginTimer);
  state.loginTimer = 0;
}

async function refreshLoginScreen() {
  const current = state.login;
  const elements = modalElements();
  if (!current || !elements.modal || elements.modal.hidden) return;
  try {
    const payload = await api.metadataProviderBrowserLoginSession(current.providerId, current.sessionId, { noRedirect:true });
    state.login = { ...current, ...(payload.session || {}) };
    if (elements.url) elements.url.textContent = payload.session?.currentUrl || '-';
    state.screenshotSerial += 1;
    if (elements.screen) elements.screen.src = api.metadataProviderBrowserScreenshotUrl(current.providerId, current.sessionId, state.screenshotSerial);
    setLoginStatus('화면에서 로그인을 완료한 뒤 “로그인 완료 및 프로필 저장”을 누르십시오.');
  } catch (error) {
    setLoginStatus(`브라우저 화면 갱신 실패: ${error.message || error}`, true);
    return;
  }
  stopLoginPolling();
  state.loginTimer = window.setTimeout(() => void refreshLoginScreen(), 1400);
}

async function openLogin(providerId) {
  const provider = state.providers.find(item => item.id === providerId);
  const elements = modalElements();
  if (!elements.modal) return;
  elements.modal.hidden = false;
  elements.modal.classList.add('open');
  document.body.classList.add('owner-metadata-login-open');
  if (elements.title) elements.title.textContent = `${provider?.name || providerId} 로그인`;
  if (elements.subtitle) elements.subtitle.textContent = '서버의 공급자 전용 Playwright 브라우저 프로필을 직접 조작합니다.';
  if (elements.screen) elements.screen.removeAttribute('src');
  if (elements.url) elements.url.textContent = '-';
  if (elements.body) elements.body.scrollTop = 0;
  setLoginStatus('Playwright 브라우저를 시작하는 중입니다.');
  try {
    const result = await api.startMetadataProviderBrowserLogin(providerId, {}, { noRedirect:true });
    state.login = result.session || null;
    if (!state.login?.sessionId) throw new Error('로그인 세션 ID를 받지 못했습니다.');
    await refreshLoginScreen();
  } catch (error) {
    state.login = null;
    setLoginStatus(`브라우저 시작 실패: ${error.message || error}`, true);
  }
}

async function sendLoginAction(payload) {
  const current = state.login;
  if (!current) return;
  try {
    const result = await api.metadataProviderBrowserLoginAction(current.providerId, { sessionId:current.sessionId, ...payload }, { noRedirect:true });
    state.login = { ...current, ...(result.session || {}) };
    await refreshLoginScreen();
  } catch (error) {
    setLoginStatus(`브라우저 조작 실패: ${error.message || error}`, true);
  }
}

async function closeLogin(cancel = false) {
  const elements = modalElements();
  stopLoginPolling();
  const current = state.login;
  state.login = null;
  if (cancel && current) {
    try { await api.cancelMetadataProviderBrowserLogin(current.providerId, current.sessionId, { noRedirect:true }); } catch {}
  }
  if (elements.modal) {
    elements.modal.hidden = true;
    elements.modal.classList.remove('open');
  }
  document.body.classList.remove('owner-metadata-login-open');
  if (elements.screen) elements.screen.removeAttribute('src');
  if (elements.text) elements.text.value = '';
  if (elements.password) elements.password.value = '';
  const returnFocus = state.providerReturnFocus;
  state.providerReturnFocus = null;
  await loadProviders({ preserveView:true, returnFocus });
}

async function finishLogin() {
  const current = state.login;
  if (!current) return;
  try {
    setLoginStatus('로그인 상태를 확인하고 프로필을 저장하는 중입니다.');
    await api.finishMetadataProviderBrowserLogin(current.providerId, current.sessionId, { noRedirect:true });
    setStatus('Playwright 로그인 프로필을 저장했습니다.');
    await closeLogin(false);
  } catch (error) {
    setLoginStatus(`로그인 완료 확인 실패: ${error.message || error}`, true);
  }
}

function definitionPayloadFrom(root, fallback = {}) {
  const field = name => clean(root?.querySelector?.(`[data-definition-field="${name}"]`)?.value || fallback[name] || '', name.includes('Url') ? 2400 : 500);
  const selectors = {};
  root?.querySelectorAll?.('[data-definition-selector]').forEach(input => { selectors[input.dataset.definitionSelector] = clean(input.value, 240); });
  const attributes = {};
  root?.querySelectorAll?.('[data-definition-attribute]').forEach(input => { attributes[input.dataset.definitionAttribute] = clean(input.value, 40); });
  return {
    mode:field('mode') || 'selector',
    name:field('name'),
    description:field('description'),
    searchUrlTemplate:field('searchUrlTemplate'),
    detailUrlTemplate:field('detailUrlTemplate'),
    coverHosts:field('coverHosts').split(/[\s,]+/u).filter(Boolean),
    selectors,
    attributes
  };
}

function customFormPayload() {
  const form = document.getElementById('owner-metadata-custom-form');
  return {
    id:clean(document.getElementById('owner-metadata-custom-id')?.value, 64),
    name:clean(document.getElementById('owner-metadata-custom-name')?.value, 100),
    description:clean(document.getElementById('owner-metadata-custom-description')?.value, 500),
    searchUrlTemplate:clean(document.getElementById('owner-metadata-custom-search-url')?.value, 2400),
    detailUrlTemplate:clean(document.getElementById('owner-metadata-custom-detail-url')?.value, 2400),
    coverHosts:clean(document.getElementById('owner-metadata-custom-cover-hosts')?.value, 1000).split(/[\s,]+/u).filter(Boolean),
    selectors:Object.fromEntries(Array.from(form?.querySelectorAll?.('[data-definition-selector]') || []).map(input => [input.dataset.definitionSelector, clean(input.value, 240)])),
    attributes:Object.fromEntries(Array.from(form?.querySelectorAll?.('[data-definition-attribute]') || []).map(input => [input.dataset.definitionAttribute, clean(input.value, 40)]))
  };
}

function setCustomStatus(message, error = false) {
  const target = document.getElementById('owner-metadata-custom-status');
  if (!target) return;
  target.textContent = clean(message, 1200);
  target.classList.toggle('error', !!error);
}

function resetCustomForm() {
  const form = document.getElementById('owner-metadata-custom-form');
  form?.reset();
  const defaults = { searchLink:'href', searchCover:'src', detailCover:'src' };
  Object.entries(defaults).forEach(([field,value]) => {
    const input = form?.querySelector?.(`[data-definition-attribute="${field}"]`);
    if (input) input.value = value;
  });
  setCustomStatus('입력 대기');
}

async function createCustomProvider(event) {
  event?.preventDefault?.();
  const payload = customFormPayload();
  setCustomStatus('고급 공급자 정의를 검증하고 저장하는 중입니다.');
  try {
    await api.createCustomMetadataProvider(payload, { noRedirect:true });
    resetCustomForm();
    setCustomStatus('고급 공급자를 추가했습니다.');
    await loadProviders({ preserveView:false });
  } catch (error) {
    setCustomStatus(`고급 공급자 추가 실패: ${error.message || error}`, true);
  }
}

function selectMetadataTab(tabName) {
  const next = ['basic','advanced','cleanup'].includes(String(tabName)) ? String(tabName) : 'basic';
  state.activeTab = next;
  document.querySelectorAll('[data-owner-metadata-tab]').forEach(button => {
    const active = button.dataset.ownerMetadataTab === next;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('[data-owner-metadata-panel]').forEach(panel => {
    const active = panel.dataset.ownerMetadataPanel === next;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
  if (next === 'cleanup' && !state.storage) void loadStorage();
}

async function handleProviderAction(card, action) {
  const providerId = card?.dataset.ownerMetadataProvider || '';
  if (!providerId) return;
  state.providerReturnFocus = { providerId, action:String(action || '') };
  try {
    if (action === 'login') return openLogin(providerId);
    if (action === 'delete-profile') {
      if (!window.confirm('이 공급자의 Playwright 로그인 프로필을 삭제할까요? 저장된 브라우저 세션과 사이트 저장소가 모두 제거됩니다.')) { state.providerReturnFocus = null; return; }
      await api.deleteMetadataProviderBrowserProfile(providerId, { noRedirect:true });
      setStatus('Playwright 로그인 프로필을 삭제했습니다.');
    } else if (action === 'probe') {
      setStatus('공급자 연결과 검색 응답을 진단하는 중입니다.');
      const response = await api.probeMetadataProvider(providerId, { query:'회귀' }, { noRedirect:true });
      const diagnostic = response.diagnostic || {};
      setStatus(`${diagnostic.providerName || providerId} · ${diagnostic.stage || '-'} · ${diagnostic.message || ''}`, !diagnostic.ok);
    } else if (action === 'save') {
      const thresholdPercent = Math.max(70, Math.min(100, Number(card.querySelector('[data-owner-metadata-threshold]')?.value) || 95));
      const intervalSeconds = Math.max(3, Math.min(60, Number(card.querySelector('[data-owner-metadata-interval]')?.value) || 3));
      await api.updateMetadataProvider(providerId, {
        enabled:!!card.querySelector('[data-owner-metadata-enabled]')?.checked,
        autoApply:!!card.querySelector('[data-owner-metadata-auto]')?.checked,
        priority:Math.max(1, Math.min(999, Number(card.querySelector('[data-owner-metadata-priority]')?.value) || 999)),
        autoApplyThreshold:thresholdPercent / 100,
        requestIntervalMs:Math.round(intervalSeconds * 1000),
        searchLimit:Math.max(1, Math.min(10, Math.floor(Number(card.querySelector('[data-owner-metadata-search-limit]')?.value) || 5)))
      }, { noRedirect:true });
      setStatus('공급자 운영 설정을 저장했습니다.');
    } else if (action === 'save-definition') {
      const editor = card.querySelector('.owner-metadata-definition-editor');
      await api.updateMetadataProviderDefinition(providerId, definitionPayloadFrom(editor), { noRedirect:true });
      setStatus(`${providerId} URL·selector 정의를 저장했습니다.`);
    } else if (action === 'reset-definition') {
      if (!window.confirm('이 기본 공급자의 URL·selector override를 제거하고 내장 parser로 복원할까요?')) { state.providerReturnFocus = null; return; }
      await api.deleteMetadataProviderDefinition(providerId, { noRedirect:true });
      setStatus('기본 공급자의 내장 URL·parser를 복원했습니다.');
    } else if (action === 'delete-provider') {
      if (!window.confirm('이 고급 공급자 정의를 삭제할까요? 기존 후보·적용 metadata는 보존되지만 새 수집에서는 사용되지 않습니다.')) { state.providerReturnFocus = null; return; }
      await api.deleteMetadataProviderDefinition(providerId, { noRedirect:true });
      setStatus('고급 공급자를 삭제했습니다.');
    }
    const returnFocus = state.providerReturnFocus;
    state.providerReturnFocus = null;
    await loadProviders({ preserveView:true, returnFocus });
  } catch (error) {
    state.providerReturnFocus = null;
    setStatus(`공급자 작업 실패: ${error.message || error}`, true);
  }
}

function bindEvents() {
  document.getElementById('owner-metadata-refresh')?.addEventListener('click', () => void loadProviders({ preserveView:true }));
  document.querySelectorAll('[data-owner-metadata-tab]').forEach(button => button.addEventListener('click', () => selectMetadataTab(button.dataset.ownerMetadataTab)));
  document.getElementById('owner-metadata-custom-form')?.addEventListener('submit', event => void createCustomProvider(event));
  document.getElementById('owner-metadata-custom-reset')?.addEventListener('click', resetCustomForm);
  document.addEventListener('txt-reader-site-language-changed', () => void loadProviders({ preserveView:false }));
  document.getElementById('owner-metadata-storage-refresh')?.addEventListener('click', () => void loadStorage());
  document.getElementById('owner-metadata-cleanup-preview')?.addEventListener('click', () => void previewCleanup());
  document.getElementById('owner-metadata-cleanup-apply')?.addEventListener('click', () => void applyCleanup());
  document.getElementById('owner-metadata-storage-rewrite')?.addEventListener('click', () => void rewriteCompressedStore());
  document.addEventListener('click', event => {
    const action = event.target.closest('[data-owner-metadata-action]');
    if (action) void handleProviderAction(action.closest('[data-owner-metadata-provider]'), action.dataset.ownerMetadataAction);
  });

  const elements = modalElements();
  document.getElementById('owner-metadata-login-close')?.addEventListener('click', () => void closeLogin(true));
  elements.screen?.addEventListener('click', event => {
    const current = state.login;
    if (!current) return;
    const rect = elements.screen.getBoundingClientRect();
    const width = Number(current.viewport?.width) || 1280;
    const height = Number(current.viewport?.height) || 900;
    const x = Math.round((event.clientX - rect.left) * width / Math.max(1, rect.width));
    const y = Math.round((event.clientY - rect.top) * height / Math.max(1, rect.height));
    void sendLoginAction({ action:'click', x, y });
  });
  document.querySelectorAll('[data-owner-metadata-key]').forEach(button => button.addEventListener('click', () => void sendLoginAction({ action:'key', key:button.dataset.ownerMetadataKey })));
  document.querySelectorAll('[data-owner-metadata-scroll]').forEach(button => button.addEventListener('click', () => void sendLoginAction({ action:'scroll', deltaY:Number(button.dataset.ownerMetadataScroll) || 0 })));
  document.querySelectorAll('[data-owner-metadata-control]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.ownerMetadataControl;
    if (action === 'type') {
      const value = elements.text?.value || '';
      if (value) { elements.text.value = ''; void sendLoginAction({ action:'type', text:value }); }
    } else if (action === 'password') {
      const value = elements.password?.value || '';
      if (value) { elements.password.value = ''; void sendLoginAction({ action:'type', text:value }); }
    } else if (action === 'reload') void sendLoginAction({ action:'reload' });
    else if (action === 'cancel') void closeLogin(true);
    else if (action === 'finish') void finishLogin();
  }));
  elements.text?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const value = elements.text.value;
    elements.text.value = '';
    if (value) void sendLoginAction({ action:'type', text:value });
  });
  elements.password?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const value = elements.password.value;
    elements.password.value = '';
    if (value) void sendLoginAction({ action:'type', text:value });
  });
}

function start() {
  document.documentElement.dataset.ownerMetadataSettingsPass = OWNER_METADATA_SETTINGS_PASS;
  bindEvents();
  selectMetadataTab('basic');
  void loadProviders({ preserveView:false });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
else start();
