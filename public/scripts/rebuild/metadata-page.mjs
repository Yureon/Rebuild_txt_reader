import { ApiClient } from './core/api.mjs';
import { createState } from './state/app-state.mjs';
import { installImageFallback, stableDeviceId } from './core/utils.mjs';
import { saveLocal, setStorageScope } from './core/storage.mjs';

export const METADATA_PAGE_PASS = 'v643-metadata-locale-collection-pass';
export const METADATA_PAGE_MANUAL_EDIT_PASS = 'v630-metadata-manual-candidate-delete-pass';
export const METADATA_PAGE_BUILD = 'rebuild-v682';
export const METADATA_USER_THEME_BOOTSTRAP_PASS = 'v680-metadata-user-theme-bootstrap-pass';
export const METADATA_MANUAL_PROVIDER_FILTER_PASS = 'v681-metadata-manual-provider-filter-pass';
const MANUAL_METADATA_PROVIDER_ID = 'manual';
const MANUAL_METADATA_PROVIDER_LABEL = '수동 입력';
const FIELD_LABELS = Object.freeze({ title:'제목', author:'작가', synopsis:'소개글', genres:'장르', tags:'태그', publicationStatus:'연재 상태', publicationYear:'출간 연도', sourceLanguage:'언어', cover:'표지' });
const TERMINAL = new Set(['completed','failed','cancelled']);
const FOLDER_DISCLOSURE_STORAGE_KEY = 'txt-reader:metadata-folder-disclosure-open:v1';

let appState = null;
const api = new ApiClient({ deviceId:stableDeviceId() });
const page = {
  api,
  providers:[], jobs:[], queue:{}, works:[], workById:new Map(), nextCursor:'', total:0,
  query:'', metadataStatus:'all', metadataProviderId:'', folderPath:'', folders:[], folderQuery:'', folderNextCursor:'', folderTotal:0, folderLoading:false, selected:null, selectedPayload:null, loadingWorks:false, workSerial:0, workController:null, detailSerial:0, overviewSerial:0, pollTimer:0, jobPollSerial:0, jobPollTimer:0, canEdit:null, browserCapturePairing:null, metadataAvailableForLocale:true, requestedSiteLanguage:'ko',
  mobileDetailOpen:false, mobileHistoryEntry:false, lastFocusedWorkId:'', manualCoverMaxBytes:5 * 1024 * 1024
};

function node(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key,value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') element.className = String(value);
    else if (key === 'text') element.textContent = String(value);
    else if (key === 'dataset') Object.entries(value).forEach(([name,dataValue]) => { element.dataset[name] = String(dataValue); });
    else if (key === 'checked') element.checked = !!value;
    else if (key === 'disabled') element.disabled = !!value;
    else if (key === 'hidden') element.hidden = !!value;
    else if (key in element && !key.startsWith('aria-')) { try { element[key] = value; } catch { element.setAttribute(key,String(value)); } }
    else element.setAttribute(key, String(value));
  }
  const source = Array.isArray(children) ? children : [children];
  for (const child of source) {
    if (child == null || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}


function manualCoverLimitBytes(source = null) {
  const raw = Number(source?.manualCoverMaxBytes ?? page.manualCoverMaxBytes);
  return Number.isFinite(raw) ? Math.max(64 * 1024, Math.min(20 * 1024 * 1024, Math.trunc(raw))) : 5 * 1024 * 1024;
}

function formatByteLimit(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value >= 1024 * 1024) return `${Math.round(value / (1024 * 1024) * 10) / 10}MB`;
  return `${Math.round(value / 1024)}KB`;
}

function autoApplyPercent(providers = page.providers) {
  const provider = (Array.isArray(providers) ? providers : []).find(item => Number.isFinite(Number(item?.autoApplyThreshold))) || providers?.[0];
  const raw = Number(provider?.autoApplyThresholdPercent ?? (Number(provider?.autoApplyThreshold) * 100));
  return Number.isFinite(raw) ? `${Math.round(raw * 10) / 10}%` : '95%';
}

function metadataProviderName(providerId) {
  const id = String(providerId || '');
  if (id === MANUAL_METADATA_PROVIDER_ID) return MANUAL_METADATA_PROVIDER_LABEL;
  return page.providers.find(provider => String(provider?.id || '') === id)?.name || id || '적용됨';
}


function currentWorkFilters() {
  return {
    metadataStatuses:page.metadataStatus === 'all' ? [] : [page.metadataStatus],
    metadataProviderIds:page.metadataProviderId ? [page.metadataProviderId] : [],
    folderPaths:page.folderPath ? [page.folderPath] : []
  };
}

function syncWorkFilterUrl() {
  const url = new URL(location.href);
  if (page.metadataStatus === 'all') url.searchParams.delete('metadataStatus');
  else url.searchParams.set('metadataStatus', page.metadataStatus);
  if (page.metadataProviderId) url.searchParams.set('metadataProvider', page.metadataProviderId);
  else url.searchParams.delete('metadataProvider');
  if (page.folderPath) url.searchParams.set('folder', page.folderPath);
  else url.searchParams.delete('folder');
  history.replaceState(history.state, '', url);
}

function initializeFolderDisclosure() {
  const disclosure = document.getElementById('metadata-work-folder-disclosure');
  if (!disclosure) return;
  let storedOpen = false;
  try { storedOpen = sessionStorage.getItem(FOLDER_DISCLOSURE_STORAGE_KEY) === '1'; } catch {}
  disclosure.open = Boolean(page.folderPath || page.folderQuery || storedOpen);
}

function syncFolderDisclosureSummary() {
  const disclosure = document.getElementById('metadata-work-folder-disclosure');
  const summary = document.getElementById('metadata-work-folder-summary');
  if (!disclosure || !summary) return;
  const active = Boolean(page.folderPath || page.folderQuery);
  const label = page.folderPath
    ? page.folderPath
    : (page.folderQuery ? `검색: ${page.folderQuery}` : '전체 폴더');
  summary.textContent = label;
  summary.title = label;
  disclosure.classList.toggle('has-active-filter', active);
}

function syncWorkFilterControls() {
  const status = document.getElementById('metadata-work-status-filter');
  const provider = document.getElementById('metadata-work-provider-filter');
  const folder = document.getElementById('metadata-work-folder-filter');
  const providerField = provider?.closest('label');
  const clear = document.getElementById('metadata-work-filter-clear');
  if (status) status.value = page.metadataStatus;
  if (!page.metadataAvailableForLocale) page.metadataProviderId = '';
  if (provider) {
    const selectedId = page.metadataProviderId;
    const options = [
      node('option',{ value:'', text:'전체 Provider' }),
      node('option',{ value:MANUAL_METADATA_PROVIDER_ID, text:`${MANUAL_METADATA_PROVIDER_LABEL} (직접 추가)` })
    ];
    const seen = new Set([MANUAL_METADATA_PROVIDER_ID]);
    for (const item of page.providers) {
      const id = String(item?.id || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      options.push(node('option',{ value:id, text:item.name || id }));
    }
    if (selectedId && !seen.has(selectedId)) options.push(node('option',{ value:selectedId, text:selectedId }));
    provider.replaceChildren(...options);
    provider.value = selectedId;
    provider.disabled = page.metadataStatus === 'missing';
  }
  if (providerField) providerField.hidden = false;
  if (folder) {
    const selectedPath = page.folderPath;
    const options = [node('option',{ value:'', text:'전체 폴더' })];
    const seen = new Set();
    for (const item of page.folders) {
      const value = cleanText(item?.value,480);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      const depth = Math.max(0,value.split('/').length - 1);
      const label = `${'　'.repeat(Math.min(depth,8))}${value.split('/').pop()} (${Math.max(0,Number(item?.count)||0).toLocaleString()})`;
      options.push(node('option',{ value, text:label, title:value }));
    }
    if (selectedPath && !seen.has(selectedPath)) options.push(node('option',{ value:selectedPath, text:selectedPath }));
    folder.replaceChildren(...options);
    folder.value = selectedPath;
  }
  const folderQuery = document.getElementById('metadata-work-folder-query');
  const folderMore = document.getElementById('metadata-work-folder-more');
  if (folderQuery && folderQuery.value !== page.folderQuery) folderQuery.value = page.folderQuery;
  if (folderMore) {
    folderMore.hidden = !page.folderNextCursor;
    folderMore.disabled = page.folderLoading;
    folderMore.textContent = page.folderLoading ? '불러오는 중…' : `폴더 더 보기 (${page.folders.length.toLocaleString()} / ${page.folderTotal.toLocaleString()})`;
  }
  syncFolderDisclosureSummary();
  if (clear) clear.hidden = page.metadataStatus === 'all' && !page.metadataProviderId && !page.folderPath && !page.folderQuery;
}

async function loadFolderFilters(options = {}) {
  if (page.folderLoading) return;
  const append = options.append === true;
  page.folderLoading = true;
  syncWorkFilterControls();
  try {
    const payload = await api.novelShelfFilterFolders({
      cursor:append ? page.folderNextCursor : '',
      limit:500,
      query:page.folderQuery,
      selected:page.folderPath
    });
    const incoming = Array.isArray(payload?.items) ? payload.items : [];
    const byValue = new Map((append ? page.folders : []).map(item => [cleanText(item?.value,480), item]).filter(([value]) => value));
    for (const item of incoming) {
      const value = cleanText(item?.value,480);
      if (value) byValue.set(value, item);
    }
    page.folders = Array.from(byValue.values());
    page.folderNextCursor = cleanText(payload?.nextCursor,2000);
    page.folderTotal = Math.max(page.folders.length, Number(payload?.total) || 0);
  } catch {
    if (!append) page.folders = [];
    page.folderNextCursor = '';
    page.folderTotal = page.folders.length;
  } finally {
    page.folderLoading = false;
    syncWorkFilterControls();
  }
}
function cleanText(value, max = 4000) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
}

async function hydrateMetadataPageTheme() {
  let payload = null;
  try { payload = await api.themeBootstrap({ noRedirect:true }); } catch {}
  const sessionKind = String(payload?.sessionKind || '');
  const rawUserId = String(payload?.userId || '');
  const scope = sessionKind === 'owner' ? 'owner' : rawUserId;
  if (scope) {
    setStorageScope(scope);
    try { localStorage.setItem('txt-reader.rebuild.activeThemeScope', scope); } catch {}
  }
  appState = createState({ profile:'library' });
  const incoming = payload?.prefs && typeof payload.prefs === 'object' ? payload.prefs : null;
  if (incoming) {
    appState.prefs = {
      ...appState.prefs,
      ...incoming,
      preprocess:{ ...appState.prefs.preprocess, ...(incoming.preprocess || {}) }
    };
    if (sessionKind === 'user') saveLocal('prefs', appState.prefs);
  }
  document.documentElement.dataset.metadataThemeBootstrap = payload?.pass || METADATA_USER_THEME_BOOTSTRAP_PASS;
  applyPageTheme();
  return payload;
}

function applyPageTheme() {
  const prefs = appState?.prefs || {};
  const boot = globalThis.__TXT_READER_BOOT_THEME__ || {};
  const dark = prefs.themeMode === 'dark' || (prefs.themeMode == null && boot.dark === true);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.body.dataset.theme = dark ? 'dark' : 'light';
  document.body.classList.toggle('light', !dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.style.setProperty('--ui-fs', `${Math.max(12,Math.min(22,Number(prefs.uiFontSize)||15))}px`);
  const colors = prefs.themeColors || boot.colors || {};
  const set = (name,value) => { if (value) { document.documentElement.style.setProperty(name,value); document.body.style.setProperty(name,value); } };
  const bg=colors.bg, surface=colors.surface, text=colors.text, accent=colors.accent;
  set('--bg',bg); set('--surface',surface); set('--text',text); set('--accent',accent);
  set('--reader-bg',colors.readerBg); set('--reader-text',colors.readerText);
  if (bg && text) {
    set('--bg2',`color-mix(in srgb, ${bg} 90%, ${text} 10%)`);
    set('--bg3',`color-mix(in srgb, ${bg} 80%, ${text} 20%)`);
    set('--text2',`color-mix(in srgb, ${text} 74%, ${bg} 26%)`);
    set('--text3',`color-mix(in srgb, ${text} 50%, ${bg} 50%)`);
    set('--border',`color-mix(in srgb, ${text} 15%, transparent)`);
  }
  if (accent) set('--accent2',`color-mix(in srgb, ${accent} 76%, #fff 24%)`);
  if (surface && accent) set('--cat-bg',`color-mix(in srgb, ${surface} 80%, ${accent} 20%)`);
  if (text && accent) set('--cat-text',`color-mix(in srgb, ${text} 84%, ${accent} 16%)`);
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta && bg) themeMeta.setAttribute('content',bg);
}

function toast(message, error = false) {
  const target = document.getElementById('metadata-page-toast');
  if (!target) return;
  target.textContent = cleanText(message,800);
  target.classList.toggle('error', !!error);
  target.hidden = false;
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => { target.hidden = true; }, 3200);
}

function setDetailStatus(message, error = false) {
  const target = document.getElementById('metadata-detail-status');
  if (!target) return;
  target.textContent = cleanText(message,1000);
  target.classList.toggle('error', !!error);
  target.hidden = !message;
}

function metadataCoverVisual(className, url, title, alt = '') {
  const fallback = () => node('div', {
    class:`${className} metadata-work-cover-fallback`,
    text:(String(title || '?').trim().slice(0, 1) || '?'),
    dataset:{ assetFallback:'cover' }
  });
  if (!url) return fallback();
  return installImageFallback(
    node('img', { class:className, src:url, alt, loading:'lazy', decoding:'async' }),
    fallback,
    { label:'metadata-cover', url }
  );
}

function metadataFields(candidate) {
  const data = candidate?.data || {};
  return Object.keys(FIELD_LABELS).filter(field => field === 'cover'
    ? !!(data.coverAssetId && data.coverUrl)
    : Array.isArray(data[field]) ? data[field].length > 0 : data[field] != null && String(data[field]).trim() !== '');
}

function valueText(data, field) {
  if (field === 'cover') return data.coverUrl || '';
  return Array.isArray(data[field]) ? data[field].join(', ') : String(data[field] ?? '');
}

function pageButton(label, action, options = {}) {
  return node('button', { type:'button', class:`metadata-page-button${options.primary ? ' primary' : ''}${options.danger ? ' danger' : ''}`, disabled:options.disabled, dataset:{ metadataAction:action }, text:label });
}

function tagList(data) {
  const tags = [...(data?.genres || []), ...(data?.tags || [])].slice(0,24);
  return tags.length ? node('div', { class:'metadata-detail-tags' }, tags.map(tag => node('span',{ text:`#${tag}` }))) : null;
}

function renderApplied(applied, canEdit) {
  const section = node('section',{ class:'metadata-detail-section' });
  section.append(node('div',{ class:'metadata-detail-section-head' },[
    node('h3',{ text:'현재 적용 정보' }),
    applied && canEdit ? pageButton('적용 정보 제거','remove-applied') : null
  ]));
  if (!applied) {
    section.append(node('p',{ class:'metadata-detail-help', text:'아직 적용된 웹 메타데이터가 없습니다.' }));
    return section;
  }
  const data = applied.data || {};
  section.append(node('div',{ class:'metadata-detail-applied' },[
    metadataCoverVisual('metadata-detail-cover', data.coverUrl, data.title, '적용된 작품 표지'),
    node('div',{ class:'metadata-detail-copy' },[
      node('strong',{ text:data.title || '제목 없음' }),
      data.author ? node('span',{ text:`작가 · ${data.author}` }) : null,
      data.synopsis ? node('p',{ text:data.synopsis }) : null,
      tagList(data),
      node('small',{ text:`${applied.providerId || '-'} · ${applied.updatedAt || applied.createdAt || ''}` })
    ])
  ]));
  return section;
}

function renderCollect(payload) {
  const canEdit = !!payload.canEdit;
  const providers = Array.isArray(payload.providers) ? payload.providers : page.providers;
  const metadataAvailableForLocale = payload.metadataAvailableForLocale !== false && page.metadataAvailableForLocale !== false;
  const section = node('section',{ class:'metadata-detail-section' },[
    node('div',{ class:'metadata-detail-section-head' },[node('h3',{ text:'인터넷에서 수집' }), pageButton('후보 새로고침','refresh-detail')]),
    node('p',{ class:'metadata-detail-help', text:'선택한 공급자를 먼저 조회하고, 실패하거나 후보가 없으면 다른 활성 공급자로 자동 전환합니다. 결과는 후보로 저장한 뒤 선택 적용합니다.' })
  ]);
  if (!metadataAvailableForLocale) {
    section.append(node('div',{ class:'metadata-page-empty metadata-locale-restriction', role:'note' },[
      node('strong',{ text:'한국어 사이트 언어에서만 제공됩니다.' }),
      node('span',{ text:'현재 6개 메타데이터 공급자는 한국어 웹소설 서비스 전용이므로 다른 사이트 언어에서는 표시하거나 실행하지 않습니다.' })
    ]));
    return section;
  }
  if (!canEdit) {
    section.append(node('p',{ class:'metadata-detail-help', text:'현재 계정에는 수집·적용 권한이 없습니다.' }));
    return section;
  }
  section.append(node('div',{ class:'metadata-collect-grid' },[
    node('div',{ class:'metadata-provider-checks' },providers.map(provider => node('label',{},[
      node('input',{ type:'checkbox', value:provider.id, checked:provider.enabled, disabled:!provider.enabled, dataset:{ detailProvider:provider.id } }),
      node('span',{ text:provider.name })
    ]))),
    node('input',{ class:'metadata-official-url', type:'url', inputMode:'url', maxlength:2048, placeholder:'선택 사항: 공식 작품 URL', dataset:{ detailOfficialUrl:'1' } }),
    node('div',{ class:'metadata-inline-buttons' },[
      pageButton('자동 검색','collect-search',{ primary:true }),
      pageButton('공식 URL 수집','collect-url'),
      pageButton('브라우저 캡처 시작','browser-capture')
    ]),
    node('div',{ class:'metadata-browser-capture-guide' },[
      node('strong',{ text:'로그인·성인 작품 또는 JavaScript 사이트' }),
      node('span',{ text:'프로젝트의 extensions/metadata-login-helper 폴더를 브라우저 확장 프로그램으로 로드한 뒤 사용합니다. 로그인 정보나 원본 문서를 전송하지 않고 현재 상세 페이지에서 추출한 제한된 메타데이터만 전달합니다.' }),
      page.browserCapturePairing ? node('small',{ text:`캡처 연결 준비됨 · ${page.browserCapturePairing.expiresAt}` }) : null
    ])
  ]));
  return section;
}

function renderManualEditor(payload) {
  if (!payload.canEdit) return null;
  const coverMaxBytes = manualCoverLimitBytes(payload);
  const data = payload.applied?.data || {};
  const input = (field, label, attrs = {}) => node('label',{ class:'metadata-manual-field' },[
    node('span',{ class:'metadata-manual-field-head' },[
      node('span',{ text:label }),
      node('span',{ class:'metadata-manual-clear-label' },[
        node('input',{ type:'checkbox', dataset:{ manualClearField:field }, 'aria-label':`${label} 기존 값 비우기` }),
        node('span',{ text:'기존 값 비우기' })
      ])
    ]),
    node('input',{ type:'text', maxlength:attrs.maxlength || 300, value:attrs.value ?? data[field] ?? '', placeholder:attrs.placeholder || '', dataset:{ manualField:field } })
  ]);
  return node('details',{ class:'metadata-detail-section metadata-manual-editor', dataset:{ manualMetadataForm:'1' } },[
    node('summary',{ class:'metadata-manual-summary' },[
      node('span',{ class:'metadata-manual-summary-title', text:'직접 입력' }),
      node('span',{ class:'metadata-manual-summary-state', text:'열기' })
    ]),
    node('div',{ class:'metadata-manual-body' },[
      node('p',{ class:'metadata-detail-help', text:'입력한 항목과 선택한 표지만 현재 작품 정보에 덮어씁니다. 비워 둔 항목은 기존 값을 유지합니다.' }),
      node('label',{ class:'metadata-manual-cover-upload' },[
        node('span',{ class:'metadata-manual-field-head' },[node('span',{ text:'표지 이미지 업로드' }),node('span',{ class:'metadata-manual-clear-label' },[node('input',{ type:'checkbox', dataset:{ manualClearField:'cover' }, 'aria-label':'기존 표지 비우기' }),node('span',{ text:'기존 표지 비우기' })])]),
        node('input',{ type:'file', accept:'image/*,.jpg,.jpeg,.jfif,.png,.webp,.gif,.avif,.bmp', dataset:{ manualCoverFile:'1' } }),
        node('small',{ text:`JPEG, PNG, WebP, GIF, AVIF, BMP · 최대 ${formatByteLimit(coverMaxBytes)}` })
      ]),
      node('div',{ class:'metadata-manual-grid' },[
        input('title','제목'),
        input('author','작가',{ maxlength:160 }),
        input('publicationStatus','연재 상태',{ maxlength:80, placeholder:'예: 연재 중, 완결' }),
        input('publicationYear','출간 연도',{ maxlength:4, value:data.publicationYear || '', placeholder:'예: 2026' }),
        input('sourceLanguage','언어',{ maxlength:24, placeholder:'예: ko' }),
        input('genres','장르',{ maxlength:1000, value:(data.genres || []).join(', '), placeholder:'쉼표로 구분' }),
        input('tags','태그',{ maxlength:1600, value:(data.tags || []).join(', '), placeholder:'쉼표로 구분' }),
        node('label',{ class:'metadata-manual-field metadata-manual-synopsis' },[
          node('span',{ class:'metadata-manual-field-head' },[node('span',{ text:'소개글' }),node('span',{ class:'metadata-manual-clear-label' },[node('input',{ type:'checkbox', dataset:{ manualClearField:'synopsis' }, 'aria-label':'소개글 기존 값 비우기' }),node('span',{ text:'기존 값 비우기' })])]),
          node('textarea',{ maxlength:8000, rows:5, value:data.synopsis || '', placeholder:'작품 소개를 입력하세요.', dataset:{ manualField:'synopsis' } })
        ])
      ]),
      node('div',{ class:'metadata-manual-actions' },[
        pageButton('입력 내용과 표지 저장','save-manual',{ primary:true })
      ])
    ])
  ]);
}

function metadataCandidateGroups(payload) {
  const groups = Array.isArray(payload?.candidateGroups) ? payload.candidateGroups.filter(Boolean) : [];
  if (groups.length) return groups;
  return (Array.isArray(payload?.candidates) ? payload.candidates : []).map(candidate => ({
    id:`legacy_${candidate.id}`,
    count:1,
    grouped:false,
    representativeId:candidate.id,
    matchScore:candidate.matchScore,
    data:candidate.data || {},
    providers:[{
      candidateId:candidate.id,
      providerId:candidate.providerId || '',
      providerName:candidate.providerName || candidate.providerId || '',
      matchScore:candidate.matchScore,
      sourceUrl:candidate.sourceUrl || '',
      hasCover:!!(candidate.data?.coverAssetId && candidate.data?.coverUrl)
    }],
    coverVariantCount:candidate.data?.coverUrl ? 1 : 0
  }));
}

function renderCandidateProviders(group) {
  const providers = Array.isArray(group?.providers) ? group.providers : [];
  if (!providers.length) return null;
  return node('div',{ class:'metadata-candidate-provider-list' },providers.map(provider => {
    const label = `${provider.providerName || provider.providerId || '공급자'} · ${Math.round((Number(provider.matchScore)||0)*100)}%`;
    return provider.sourceUrl
      ? node('a',{ class:'metadata-candidate-provider', href:provider.sourceUrl, target:'_blank', rel:'noopener noreferrer', title:'공식 작품 페이지 열기', text:label })
      : node('span',{ class:'metadata-candidate-provider', text:label });
  }));
}

function renderCandidates(payload) {
  const canEdit = !!payload.canEdit;
  const groups = metadataCandidateGroups(payload);
  const candidateCount = Math.max(groups.reduce((total, group) => total + Math.max(1, Number(group.count) || 1), 0), Number(payload.candidateCount) || 0);
  const groupedCount = Math.max(0, candidateCount - groups.length);
  const title = groupedCount
    ? `수집 후보 ${candidateCount}건 · 동일 정보 기준 ${groups.length}묶음 · 중복 ${groupedCount}건 정리`
    : `수집 후보 ${candidateCount}건`;
  const section = node('section',{ class:'metadata-detail-section' },[
    node('div',{ class:'metadata-detail-section-head' },[node('h3',{ text:title })])
  ]);
  if (!groups.length) {
    section.append(node('p',{ class:'metadata-detail-help', text:'수집된 후보가 없습니다.' }));
    return section;
  }
  if (groupedCount) section.append(node('p',{ class:'metadata-detail-help', text:`내용이 같은 후보 ${groupedCount}건을 공급자 출처를 유지한 채 묶었습니다. 묶음 적용은 일치율과 공급자 우선순위가 가장 높은 대표 후보를 사용합니다.` }));
  for (const group of groups) {
    const data = group.data || {};
    const fields = metadataFields(group);
    const representativeId = String(group.representativeId || '');
    const groupId = String(group.id || '');
    const count = Math.max(1, Number(group.count) || 1);
    const card = node('article',{ class:`metadata-candidate-page-card${count > 1 ? ' metadata-candidate-grouped' : ''}`, dataset:{ candidateId:representativeId, candidateGroupId:groupId, candidateGroupCount:String(count) } },[
      node('div',{ class:'metadata-detail-candidate-main' },[
        metadataCoverVisual('metadata-detail-cover', data.coverUrl, data.title, '후보 작품 표지'),
        node('div',{ class:'metadata-detail-copy' },[
          node('div',{ class:'metadata-candidate-title-row' },[
            node('strong',{ text:data.title || '제목 없음' }),
            node('span',{ class:'metadata-candidate-score', text:`일치 ${Math.round((Number(group.matchScore)||0)*100)}%${count > 1 ? ` · 동일 후보 ${count}개` : ''}` })
          ]),
          data.author ? node('span',{ text:data.author }) : null,
          renderCandidateProviders(group),
          Number(group.coverVariantCount) > 1 ? node('small',{ class:'metadata-candidate-cover-variants', text:`표지 ${Number(group.coverVariantCount)}종 · 적용 시 대표 공급자의 표지를 사용합니다.` }) : null,
          data.synopsis ? node('p',{ text:data.synopsis }) : null,
          tagList(data)
        ])
      ]),
      canEdit ? node('div',{ class:'metadata-candidate-fields' },fields.map(field => node('label',{},[
        node('input',{ type:'checkbox', checked:true, value:field, dataset:{ candidateField:field } }),
        node('span',{},[node('strong',{ text:FIELD_LABELS[field] }), valueText(data,field) && !['synopsis','cover'].includes(field) ? node('small',{ text:valueText(data,field).slice(0,150) }) : null])
      ]))) : null,
      canEdit ? node('div',{ class:'metadata-inline-buttons metadata-candidate-actions' },[
        pageButton(count > 1 ? '묶음 선택 항목 적용' : '선택 항목 적용','apply-candidate',{ primary:true, disabled:fields.length < 1 }),
        pageButton(count > 1 ? '묶음 전체 삭제' : '후보 삭제','delete-candidate',{ danger:true })
      ]) : null
    ]);
    section.append(card);
  }
  return section;
}

const metadataMobileQuery = window.matchMedia('(max-width: 760px)');

function isMobileWorkspace() {
  return metadataMobileQuery.matches;
}

function selectedWorkButton() {
  const id = page.lastFocusedWorkId || page.selected?.id || '';
  if (!id) return null;
  return Array.from(document.querySelectorAll('[data-work-id]')).find(button => button.dataset.workId === id) || null;
}

function captureWorkListViewState() {
  const list = document.getElementById('metadata-work-list');
  if (!list) return null;
  const focused = document.activeElement instanceof Element ? document.activeElement.closest('[data-work-id]') : null;
  let listTop = 0;
  try { listTop = Number(list.getBoundingClientRect?.().top) || 0; } catch {}
  let anchorId = '';
  let anchorOffset = 0;
  for (const item of Array.from(list.querySelectorAll('[data-work-id]'))) {
    let rect = null;
    try { rect = item.getBoundingClientRect?.(); } catch {}
    if (!rect || Number(rect.bottom) < listTop + 1) continue;
    anchorId = String(item.dataset.workId || '');
    anchorOffset = Math.round((Number(rect.top) || listTop) - listTop);
    break;
  }
  return {
    scrollTop:Math.max(0,Number(list.scrollTop)||0),
    anchorId,
    anchorOffset,
    focusedId:String(focused?.dataset?.workId || ''),
    capturedAt:Date.now()
  };
}

function restoreWorkListViewState(snapshot, options = {}) {
  if (!snapshot) return;
  requestAnimationFrame(() => {
    const list = document.getElementById('metadata-work-list');
    if (!list) return;
    const anchor = snapshot.anchorId
      ? Array.from(list.querySelectorAll('[data-work-id]')).find(item => String(item.dataset.workId || '') === snapshot.anchorId)
      : null;
    if (anchor) {
      let listTop = 0;
      let anchorTop = 0;
      try {
        listTop = Number(list.getBoundingClientRect?.().top) || 0;
        anchorTop = Number(anchor.getBoundingClientRect?.().top) || listTop;
      } catch {}
      const delta = Math.round(anchorTop - listTop - (Number(snapshot.anchorOffset) || 0));
      if (Math.abs(delta) > 1) list.scrollTop = Math.max(0,(Number(list.scrollTop)||0) + delta);
    } else {
      const maxTop = Math.max(0,(Number(list.scrollHeight)||0) - (Number(list.clientHeight)||0));
      list.scrollTop = Math.min(maxTop,Math.max(0,Number(snapshot.scrollTop)||0));
    }
    if (options.restoreFocus !== false && snapshot.focusedId) {
      const active = document.activeElement;
      const focusLost = !active || active === document.body || !document.contains(active);
      if (focusLost) {
        const replacement = Array.from(list.querySelectorAll('[data-work-id]')).find(item => String(item.dataset.workId || '') === snapshot.focusedId);
        replacement?.focus?.({ preventScroll:true });
      }
    }
  });
}

function captureDetailViewState() {
  const candidate = document.activeElement instanceof Element ? document.activeElement.closest('[data-candidate-id]') : null;
  const body = document.getElementById('metadata-detail-body');
  let bodyTop = 0;
  try { bodyTop = Number(body?.getBoundingClientRect?.().top) || 0; } catch {}
  let anchorId = '';
  let anchorOffset = 0;
  const cards = Array.from(body?.querySelectorAll?.('[data-candidate-id]') || []);
  for (const card of cards) {
    let rect = null;
    try { rect = card.getBoundingClientRect?.(); } catch {}
    if (!rect || Number(rect.bottom) < 0) continue;
    anchorId = String(card.dataset.candidateId || '');
    anchorOffset = Math.round((Number(rect.top) || bodyTop) - bodyTop);
    break;
  }
  return {
    scrollY:Math.max(0,Number(window.scrollY)||0),
    anchorId,
    anchorOffset,
    focusedCandidateId:String(candidate?.dataset?.candidateId || ''),
    focusedAction:String((document.activeElement instanceof Element ? document.activeElement.closest('[data-metadata-action]')?.dataset?.metadataAction : '') || '')
  };
}

function restoreDetailViewState(snapshot) {
  if (!snapshot) return;
  requestAnimationFrame(() => {
    const body = document.getElementById('metadata-detail-body');
    const anchor = snapshot.anchorId
      ? Array.from(body?.querySelectorAll?.('[data-candidate-id]') || []).find(item => String(item.dataset.candidateId || '') === snapshot.anchorId)
      : null;
    if (anchor) {
      let bodyTop = 0;
      let anchorTop = 0;
      try {
        bodyTop = Number(body?.getBoundingClientRect?.().top) || 0;
        anchorTop = Number(anchor.getBoundingClientRect?.().top) || bodyTop;
      } catch {}
      const delta = Math.round(anchorTop - bodyTop - (Number(snapshot.anchorOffset) || 0));
      if (Math.abs(delta) > 1) window.scrollBy({ top:delta, left:0, behavior:'auto' });
    } else if (Math.abs((Number(window.scrollY)||0) - (Number(snapshot.scrollY)||0)) > 1) {
      window.scrollTo({ top:Math.max(0,Number(snapshot.scrollY)||0), left:0, behavior:'auto' });
    }
    if (snapshot.focusedCandidateId && snapshot.focusedAction) {
      const card = Array.from(body?.querySelectorAll?.('[data-candidate-id]') || []).find(item => String(item.dataset.candidateId || '') === snapshot.focusedCandidateId);
      const replacement = card?.querySelector?.(`[data-metadata-action="${snapshot.focusedAction}"]`);
      const active = document.activeElement;
      if (replacement && (!active || active === document.body || !document.contains(active))) replacement.focus({ preventScroll:true });
    }
  });
}

function syncMobileWorkspace(options = {}) {
  const panel = document.getElementById('metadata-page-works');
  const browser = panel?.querySelector('.metadata-work-browser');
  const detail = panel?.querySelector('.metadata-work-detail');
  const mobile = isMobileWorkspace();
  const open = mobile && page.mobileDetailOpen;
  panel?.classList.toggle('metadata-mobile-detail-open', open);
  document.body.classList.toggle('metadata-mobile-detail-open', open);
  if (mobile) {
    browser?.setAttribute('aria-hidden', open ? 'true' : 'false');
    detail?.setAttribute('aria-hidden', open ? 'false' : 'true');
  } else {
    browser?.removeAttribute('aria-hidden');
    detail?.removeAttribute('aria-hidden');
  }
  if (open && options.focusDetail) {
    requestAnimationFrame(() => document.getElementById('metadata-detail-mobile-back')?.focus({ preventScroll:true }));
  }
  if (!open && options.restoreFocus) {
    requestAnimationFrame(() => selectedWorkButton()?.focus({ preventScroll:true }));
  }
}

function removeSelectedWorkFromUrl() {
  const url = new URL(location.href);
  url.searchParams.delete('novelId');
  history.replaceState(null, '', url);
}

function cancelJobPoll() {
  page.jobPollSerial += 1;
  window.clearTimeout(page.jobPollTimer);
  page.jobPollTimer = 0;
}

function waitForJobPoll(delay, serial) {
  if (serial !== page.jobPollSerial) return Promise.resolve(false);
  return new Promise(resolve => {
    page.jobPollTimer = window.setTimeout(() => {
      page.jobPollTimer = 0;
      resolve(serial === page.jobPollSerial);
    }, delay);
  });
}

function clearSelectedWork(options = {}) {
  cancelJobPoll();
  page.selected = null;
  page.selectedPayload = null;
  page.browserCapturePairing = null;
  page.lastFocusedWorkId = '';
  globalThis.__TXT_READER_METADATA_CAPTURE_PAIRING = null;
  document.getElementById('metadata-work-detail-empty')?.removeAttribute('hidden');
  const content = document.getElementById('metadata-work-detail-content');
  if (content) content.hidden = true;
  page.mobileDetailOpen = false;
  page.mobileHistoryEntry = false;
  if (options.updateUrl !== false) removeSelectedWorkFromUrl();
  syncMobileWorkspace({ restoreFocus:false });
}

function closeMobileDetail(options = {}) {
  if (!page.mobileDetailOpen) return;
  if (options.useHistory !== false && page.mobileHistoryEntry) {
    history.back();
    return;
  }
  page.mobileDetailOpen = false;
  page.mobileHistoryEntry = false;
  if (options.updateUrl !== false) removeSelectedWorkFromUrl();
  syncMobileWorkspace({ restoreFocus:options.restoreFocus !== false });
}

function openMobileDetail(options = {}) {
  if (!isMobileWorkspace()) return;
  page.mobileDetailOpen = true;
  syncMobileWorkspace({ focusDetail:options.focusDetail === true });
}

function installWorkListKeyboard() {
  const list = document.getElementById('metadata-work-list');
  if (!list || list.dataset.keyboardBound === 'true') return;
  list.dataset.keyboardBound = 'true';
  list.addEventListener('keydown', event => {
    const options = Array.from(list.querySelectorAll('[data-work-id]'));
    if (!options.length) return;
    const current = event.target.closest('[data-work-id]');
    const index = Math.max(0, options.indexOf(current));
    let next = -1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = Math.min(options.length - 1, index + 1);
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else if (event.key === 'Enter' || event.key === ' ') {
      if (current) { event.preventDefault(); current.click(); }
      return;
    } else return;
    event.preventDefault();
    options[next]?.focus();
  });
}

function installMetadataTabKeyboard() {
  const tabs = Array.from(document.querySelectorAll('[data-metadata-page-tab]'));
  tabs.forEach((tab,index) => {
    const panelName = tab.dataset.metadataPageTab;
    const panel = document.querySelector(`[data-metadata-page-panel="${panelName}"]`);
    if (panel) {
      panel.id ||= `metadata-page-panel-${panelName}`;
      tab.id ||= `metadata-page-tab-${panelName}`;
      tab.setAttribute('aria-controls',panel.id);
      panel.setAttribute('role','tabpanel');
      panel.setAttribute('aria-labelledby',tab.id);
    }
    tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
    tab.addEventListener('keydown',event => {
      const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
      const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : delta ? (index + delta + tabs.length) % tabs.length : -1;
      if (nextIndex < 0) return;
      event.preventDefault();
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    });
  });
}

function renderDetail(payload) {
  const body = document.getElementById('metadata-detail-body');
  if (!body || !page.selected) return;
  document.getElementById('metadata-work-detail-empty').hidden = true;
  document.getElementById('metadata-work-detail-content').hidden = false;
  document.getElementById('metadata-detail-title').textContent = page.selected.title || page.selected.fileName || '작품';
  document.getElementById('metadata-detail-subtitle').textContent = [page.selected.author,page.selected.categoryPath].filter(Boolean).join(' · ') || '웹 메타데이터 후보를 검토합니다.';
  const readerLink = document.getElementById('metadata-detail-reader-link');
  readerLink.href = `/library.html?focusNovelId=${encodeURIComponent(page.selected.id)}&view=shelf`;
  body.replaceChildren(...[renderApplied(payload.applied,!!payload.canEdit),renderManualEditor(payload),renderCollect(payload),renderCandidates(payload)].filter(Boolean));
}

function renderWorkList(options = {}) {
  const list = document.getElementById('metadata-work-list');
  const count = document.getElementById('metadata-work-count');
  const more = document.getElementById('metadata-work-more');
  if (!list) return;
  const viewState = options.viewState === undefined ? captureWorkListViewState() : options.viewState;
  const fragment = document.createDocumentFragment();
  for (const work of page.works) {
    const active = page.selected?.id === work.id;
    const cover = metadataCoverVisual('metadata-work-cover', work.coverUrl, work.title, '');
    fragment.append(node('button',{ type:'button', class:`metadata-work-item${active ? ' active' : ''}`, role:'option', 'aria-selected':active ? 'true' : 'false', tabindex:active || (!page.selected && fragment.childElementCount === 0) ? '0' : '-1', dataset:{ workId:work.id } },[
      cover,
      node('span',{ class:'metadata-work-copy' },[
        node('strong',{ text:work.title || work.fileName || '제목 없음' }),
        node('span',{ text:[work.author,work.categoryPath].filter(Boolean).join(' · ') || (work.isMultiFile ? `${work.episodeCount || 0}화` : '단일 파일') })
      ]),
      node('span',{ class:`metadata-work-state${work.metadata ? ' applied' : ''}`, title:work.metadata?.providerId ? `적용 Provider: ${metadataProviderName(work.metadata.providerId)}` : '', text:work.metadata ? metadataProviderName(work.metadata.providerId) : '미수집' })
    ]));
  }
  if (!page.works.length && !page.loadingWorks) fragment.append(node('div',{ class:'metadata-page-empty', text:'조건에 맞는 작품이 없습니다.' }));
  list.replaceChildren(fragment);
  list.setAttribute('aria-busy',page.loadingWorks ? 'true' : 'false');
  if (count) count.textContent = `${page.works.length.toLocaleString()} / ${page.total.toLocaleString()} 작품`;
  if (more) { more.hidden = !page.nextCursor; more.disabled = page.loadingWorks; }
  restoreWorkListViewState(viewState,{ restoreFocus:options.restoreFocus !== false });
}

async function loadWorks(reset = false, options = {}) {
  if (page.loadingWorks && !reset) return;
  if (reset) page.workController?.abort?.();
  const preserveSelection = options.preserveSelection === true;
  const selectedId = preserveSelection ? String(page.selected?.id || '') : '';
  if (reset && !preserveSelection && page.selected) clearSelectedWork();
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  page.workController = controller;
  page.loadingWorks = true;
  const serial = ++page.workSerial;
  const preserveView = options.preserveView !== false;
  const viewState = preserveView ? captureWorkListViewState() : null;
  const cursor = reset ? '' : page.nextCursor;
  const preserveLoadedCount = reset && options.preserveLoadedCount === true;
  const targetCount = preserveLoadedCount ? Math.max(60,page.works.length) : 60;
  renderWorkList({ viewState, restoreFocus:false });
  try {
    let requestCursor = cursor;
    let payload = null;
    const loaded = [];
    do {
      const remaining = Math.max(12,targetCount - loaded.length);
      payload = await api.novelShelf({
        scope:'all', sort:'title', query:page.query, cursor:requestCursor,
        limit:preserveLoadedCount ? Math.min(100,remaining) : 60,
        focusNovelId:reset && !preserveLoadedCount ? selectedId : '',
        filters:currentWorkFilters()
      }, controller ? { signal:controller.signal } : undefined);
      loaded.push(...(Array.isArray(payload.items) ? payload.items : []));
      requestCursor = String(payload.nextCursor || '');
    } while (preserveLoadedCount && loaded.length < targetCount && requestCursor && serial === page.workSerial);
    if (serial !== page.workSerial) return;
    const incoming = loaded;
    if (reset) {
      page.works = [];
      page.workById = new Map();
    }
    for (const work of incoming) {
      if (!page.workById.has(work.id)) page.works.push(work);
      page.workById.set(work.id,work);
    }
    if (reset && selectedId) {
      const selected = page.workById.get(selectedId) || incoming.find(item => (item.progressAliases || []).includes(selectedId));
      if (selected) page.selected = selected;
      else clearSelectedWork();
    }
    page.nextCursor = requestCursor;
    page.total = Math.max(0,Number(payload.total)||0);
  } catch (error) {
    if (error?.name !== 'AbortError') toast(`작품 목록 불러오기 실패: ${error.message || error}`,true);
  } finally {
    if (serial === page.workSerial) {
      page.loadingWorks=false;
      if (page.workController === controller) page.workController = null;
      renderWorkList({ viewState, restoreFocus:true });
    }
  }
}

function removeWorkFromCurrentWindow(id) {
  const key = String(id || '');
  const before = page.works.length;
  page.works = page.works.filter(item => String(item?.id || '') !== key);
  page.workById.delete(key);
  if (page.works.length !== before) page.total = Math.max(0,page.total - 1);
  clearSelectedWork();
  renderWorkList();
}

async function refreshSelectedWorkSummary(appliedFallback = undefined) {
  if (!page.selected) return null;
  const id = String(page.selected.id || '');
  const current = page.workById.get(id) || page.selected;
  let fresh = null;
  try {
    const payload = await api.novelShelf({ scope:'all', sort:'title', focusNovelId:id, limit:20, filters:currentWorkFilters() });
    fresh = (Array.isArray(payload.items) ? payload.items : []).find(item => String(item.id || '') === id || (item.progressAliases || []).includes(id)) || null;
  } catch {}
  if (String(page.selected?.id || '') !== id) return null;
  if (!fresh) {
    const filterWouldExclude = (page.metadataStatus === 'missing' && appliedFallback) || (page.metadataStatus === 'applied' && appliedFallback === null) || (page.metadataProviderId && String(appliedFallback?.providerId || '') !== page.metadataProviderId);
    if (filterWouldExclude) {
      removeWorkFromCurrentWindow(id);
      return null;
    }
    const data = appliedFallback?.data || {};
    fresh = {
      ...current,
      metadata:appliedFallback === undefined ? current.metadata : appliedFallback,
      title:data.title || current.title,
      author:data.author || current.author,
      coverUrl:data.coverUrl || current.coverUrl
    };
  }
  const index = page.works.findIndex(item => String(item.id || '') === id);
  if (index >= 0) page.works[index] = fresh;
  page.workById.set(id,fresh);
  page.selected = fresh;
  renderWorkList();
  return fresh;
}

async function loadSelectedDetail(quiet = false, options = {}) {
  if (!page.selected) return;
  const selectedId = String(page.selected.id || '');
  const serial = ++page.detailSerial;
  const viewState = options.preserveView === false ? null : captureDetailViewState();
  if (!quiet) setDetailStatus('메타데이터를 불러오는 중…');
  try {
    const payload = await api.novelMetadata(selectedId);
    if (serial !== page.detailSerial || String(page.selected?.id || '') !== selectedId) return;
    page.selectedPayload = payload;
    page.manualCoverMaxBytes = manualCoverLimitBytes(payload);
    page.canEdit = !!payload.canEdit;
    page.metadataAvailableForLocale = payload.metadataAvailableForLocale !== false;
    page.requestedSiteLanguage = cleanText(payload.requestedSiteLanguage || page.requestedSiteLanguage || 'ko',40);
    if (Array.isArray(payload.providers)) { page.providers = payload.providers; syncWorkFilterControls(); }
    renderDetail(payload);
    restoreDetailViewState(viewState);
    setDetailStatus(quiet ? '' : '메타데이터를 불러왔습니다.');
  } catch (error) {
    if (serial === page.detailSerial && String(page.selected?.id || '') === selectedId) setDetailStatus(`불러오기 실패: ${error.message || error}`,true);
  }
}

async function selectWork(id, options = {}) {
  cancelJobPoll();
  const work = page.workById.get(String(id||''));
  if (!work) return;
  const wasMobileOpen = page.mobileDetailOpen;
  page.selected = work;
  page.lastFocusedWorkId = work.id;
  page.selectedPayload = null;
  page.browserCapturePairing = null;
  globalThis.__TXT_READER_METADATA_CAPTURE_PAIRING = null;
  renderWorkList();
  document.getElementById('metadata-work-detail-empty').hidden = true;
  document.getElementById('metadata-work-detail-content').hidden = false;
  document.getElementById('metadata-detail-body').replaceChildren(node('div',{ class:'metadata-page-empty', text:'메타데이터를 불러오는 중…' }));
  const url = new URL(location.href);
  url.searchParams.set('novelId',work.id);
  if (isMobileWorkspace() && options.historyMode !== 'replace' && options.historyMode !== 'none' && !wasMobileOpen) {
    history.pushState({ metadataDetail:true, novelId:work.id },'',url);
    page.mobileHistoryEntry = true;
  } else if (options.historyMode !== 'none') {
    history.replaceState(isMobileWorkspace() ? { metadataDetail:true, novelId:work.id } : null,'',url);
  }
  openMobileDetail();
  await loadSelectedDetail();
  if (isMobileWorkspace()) syncMobileWorkspace({ focusDetail:options.focusDetail !== false });
}

function activeBulkJob(type = 'collect-bulk') {
  return page.jobs.find(job => job.type === type && !TERMINAL.has(job.status)) || null;
}

function activeMetadataOperation() {
  return activeBulkJob('apply-pending-bulk') || activeBulkJob('collect-bulk');
}

function updateSummary() {
  const enabled = page.metadataAvailableForLocale ? page.providers.filter(provider => provider.enabled).length : 0;
  document.getElementById('metadata-summary-providers').textContent = page.metadataAvailableForLocale ? `${enabled}/${page.providers.length}` : '0/0';
  document.getElementById('metadata-summary-queued').textContent = String(page.queue.queued ?? page.jobs.filter(job=>job.status==='queued').length);
  document.getElementById('metadata-summary-running').textContent = String(page.queue.running ?? page.jobs.filter(job=>job.status==='running').length);
  document.getElementById('metadata-summary-failed').textContent = String(page.jobs.filter(job=>job.status==='failed').length);
  const collectBulk = activeBulkJob('collect-bulk');
  const applyBulk = activeBulkJob('apply-pending-bulk');
  const operation = applyBulk || collectBulk;
  const state = document.getElementById('metadata-work-bulk-state');
  if (state) state.textContent = applyBulk
    ? `후보 적용 ${Number(applyBulk.cursor||0).toLocaleString()}/${Number(applyBulk.total||0).toLocaleString()} · 적용 ${Number(applyBulk.appliedCount||0).toLocaleString()} · ${applyBulk.status}`
    : collectBulk
      ? `전체 수집 ${Number(collectBulk.cursor||0).toLocaleString()}/${Number(collectBulk.total||0).toLocaleString()} · 자동 적용 ${Number(collectBulk.autoApplied||0).toLocaleString()} · 검토 대기 ${Number(collectBulk.candidateOnly||collectBulk.pendingCandidates||0).toLocaleString()} · ${collectBulk.status}`
      : '대기 중인 전체 작업 없음';
  for (const id of ['metadata-collect-all-btn','metadata-collect-missing-btn','metadata-apply-pending-btn']) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.disabled = !page.metadataAvailableForLocale || page.canEdit !== true || !!operation;
    button.title = !page.metadataAvailableForLocale ? '한국어 사이트 언어에서만 메타데이터 공급자를 사용할 수 있습니다.' : page.canEdit !== true ? '메타데이터 편집 권한이 필요합니다.' : operation ? '다른 전체 메타데이터 작업이 진행 중입니다.' : '';
  }
  document.getElementById('metadata-bulk-banner')?.classList.toggle('active',!!operation);
}

function renderJobs() {
  const target = document.getElementById('metadata-jobs-list');
  if (!target) return;
  const openFailureIds = new Set(Array.from(target.querySelectorAll('[data-job-id] .metadata-job-failures[open]')).map(details => String(details.closest('[data-job-id]')?.dataset?.jobId || '')).filter(Boolean));
  const focusedJob = document.activeElement instanceof Element ? document.activeElement.closest('[data-job-id]') : null;
  const focusedCancel = document.activeElement instanceof Element ? document.activeElement.closest('[data-cancel-job-id]') : null;
  const focusedJobId = String(focusedJob?.dataset?.jobId || '');
  const focusedCancelId = String(focusedCancel?.dataset?.cancelJobId || '');
  const cards = page.jobs.map(job => {
    const collectBulk = job.type === 'collect-bulk';
    const applyBulk = job.type === 'apply-pending-bulk';
    const bulk = collectBulk || applyBulk;
    const processed = Number(job.cursor)||0;
    const total = Number(job.total)||0;
    const progress = bulk && total ? Math.max(0,Math.min(100,Math.round((processed/total)*100))) : Math.round((Number(job.progress)||0)*100);
    const title = applyBulk ? '미적용 메타데이터 후보 일괄 적용' : collectBulk ? '서재 전체 미수집 작품 수집' : (job.novel?.title || job.type || job.id);
    const stats = applyBulk
      ? `처리 ${processed.toLocaleString()}/${total.toLocaleString()} · 적용 ${Number(job.appliedCount||0).toLocaleString()} · 건너뜀 ${Number(job.skipped||0).toLocaleString()} · 검토 대기 ${Number(job.manualReview||0).toLocaleString()} · 실패 ${Number(job.failed||0).toLocaleString()}`
      : `처리 ${processed.toLocaleString()}/${total.toLocaleString()} · 성공 ${Number(job.succeeded||0).toLocaleString()} · 자동 적용 ${Number(job.autoApplied||0).toLocaleString()} · 검토 대기 ${Number(job.candidateOnly||job.pendingCandidates||0).toLocaleString()} · 실패 ${Number(job.failed||0).toLocaleString()} · 후보 없음 ${Number(job.empty||0).toLocaleString()}`;
    return node('article',{ class:`metadata-job-card${bulk ? ' metadata-job-card-bulk' : ''}`, dataset:{ jobId:job.id } },[
      node('div',{ class:'metadata-job-copy' },[
        node('strong',{ text:title }),
        node('span',{ text:`${job.status} · ${job.message || ''}` }),
        bulk ? node('div',{ class:'metadata-job-progress', role:'progressbar', 'aria-valuemin':'0', 'aria-valuemax':'100', 'aria-valuenow':String(progress) },[
          node('span',{ style:`width:${progress}%` })
        ]) : null,
        bulk ? node('small',{ text:stats }) : job.lastError ? node('small',{ text:job.lastError }) : node('small',{ text:job.updatedAt || job.createdAt || '' }),
        bulk && Array.isArray(job.recentFailures) && job.recentFailures.length ? node('details',{ class:'metadata-job-failures', open:openFailureIds.has(String(job.id || '')) },[
          node('summary',{ text:`최근 실패 ${job.recentFailures.length}건 보기` }),
          node('div',{ class:'metadata-job-failure-list' },job.recentFailures.slice(-20).reverse().map(item => node('div',{ class:'metadata-job-failure-item' },[
            node('strong',{ text:item.title || item.novelId || '작품' }),
            node('span',{ text:item.message || item.code || '수집 실패' }),
            ...(Array.isArray(item.attempts) ? item.attempts.map(attempt => node('small',{ text:`${attempt.providerName || attempt.providerId || '-'} · ${attempt.stage || attempt.status || '-'} · ${attempt.error || attempt.message || attempt.code || ''}` })) : [])
          ])))
        ]) : null
      ]),
      ['queued','running'].includes(job.status) ? node('button',{ type:'button', class:'metadata-page-button', dataset:{ cancelJobId:job.id }, text:'취소' }) : null
    ]);
  });
  target.replaceChildren(...(cards.length ? cards : [node('div',{ class:'metadata-page-empty', text:'수집 작업이 없습니다.' })]));
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active && active !== document.body && document.contains(active)) return;
    if (focusedCancelId) target.querySelector(`[data-cancel-job-id="${focusedCancelId}"]`)?.focus?.({ preventScroll:true });
    else if (focusedJobId) target.querySelector(`[data-job-id="${focusedJobId}"] summary`)?.focus?.({ preventScroll:true });
  });
}

async function refreshOverview() {
  const serial = ++page.overviewSerial;
  const [providersResult,jobsResult] = await Promise.allSettled([
    api.metadataProviders(),
    api.metadataJobs(100)
  ]);
  if (serial !== page.overviewSerial) return;
  if (providersResult.status === 'fulfilled') {
    const providersPayload = providersResult.value;
    page.metadataAvailableForLocale = providersPayload.metadataAvailableForLocale !== false;
    page.requestedSiteLanguage = cleanText(providersPayload.requestedSiteLanguage || page.requestedSiteLanguage || 'ko',40);
    page.providers = page.metadataAvailableForLocale && Array.isArray(providersPayload.providers) ? providersPayload.providers : [];
    page.manualCoverMaxBytes = manualCoverLimitBytes(providersPayload);
    page.queue = providersPayload.queue || {};
    syncWorkFilterControls();
  } else toast(`공급자 상태 불러오기 실패: ${providersResult.reason?.message || providersResult.reason}`,true);
  if (jobsResult.status === 'fulfilled') {
    const jobsPayload = jobsResult.value;
    page.jobs = Array.isArray(jobsPayload.jobs) ? jobsPayload.jobs : [];
    page.queue = jobsPayload.queue || page.queue;
    page.canEdit = true;
  } else if (Number(jobsResult.reason?.status) === 403) page.canEdit = false;
  else toast(`작업 상태 불러오기 실패: ${jobsResult.reason?.message || jobsResult.reason}`,true);
  updateSummary(); renderJobs(); schedulePoll();
}

function schedulePoll() {
  window.clearTimeout(page.pollTimer);
  if (!page.jobs.some(job => !TERMINAL.has(job.status)) || document.hidden) return;
  page.pollTimer = window.setTimeout(() => void refreshOverview(), 3000);
}

function selectedDetailProviders() {
  return Array.from(document.querySelectorAll('[data-detail-provider]:checked')).map(input => input.value).filter(Boolean);
}

async function pollJob(jobId) {
  const selectedId = String(page.selected?.id || '');
  const serial = ++page.jobPollSerial;
  window.clearTimeout(page.jobPollTimer);
  page.jobPollTimer = 0;
  let consecutiveErrors = 0;
  const stillCurrent = () => serial === page.jobPollSerial && String(page.selected?.id || '') === selectedId;
  for (let count=0; count<240; count+=1) {
    if (!stillCurrent()) return;
    try {
      const payload = await api.metadataJob(jobId);
      if (!stillCurrent()) return;
      const job = payload.job;
      if (!job) {
        setDetailStatus('수집 작업을 찾지 못했습니다. 작업 목록을 새로고침해 확인하십시오.',true);
        await refreshOverview();
        return;
      }
      consecutiveErrors = 0;
      setDetailStatus(`${job.message || job.status} · ${Math.round((Number(job.progress)||0)*100)}%${job.lastError ? ` · ${job.lastError}` : ''}`,job.status==='failed');
      if (TERMINAL.has(job.status)) {
        await Promise.all([loadSelectedDetail(true),refreshOverview()]);
        await refreshSelectedWorkSummary(page.selectedPayload?.applied);
        return;
      }
    } catch (error) {
      if (!stillCurrent()) return;
      consecutiveErrors += 1;
      if (Number(error?.status) === 404) {
        setDetailStatus('수집 작업을 찾지 못했습니다. 작업 목록을 새로고침해 확인하십시오.',true);
        await refreshOverview();
        return;
      }
      setDetailStatus(`수집 작업은 등록됐지만 상태 확인이 지연되고 있습니다. ${cleanText(error?.message || error,240)}`,false);
      if (consecutiveErrors >= 8) {
        await refreshOverview();
        if (!stillCurrent()) return;
        setDetailStatus('수집 작업은 계속 실행될 수 있습니다. “수집 작업” 탭에서 상태를 확인하십시오.');
        return;
      }
    }
    if (!await waitForJobPoll(Math.min(5000,1000 * Math.max(1,consecutiveErrors)),serial)) return;
  }
  await refreshOverview();
  if (!stillCurrent()) return;
  setDetailStatus('수집 작업이 4분 이상 진행 중입니다. “수집 작업” 탭에서 계속 확인할 수 있습니다.');
}

function installBrowserCapturePairing(pairing) {
  const workflow = { ...pairing, readerOrigin:location.origin };
  page.browserCapturePairing = workflow;
  globalThis.__TXT_READER_METADATA_CAPTURE_PAIRING = workflow;
  globalThis.__TXT_READER_METADATA_CAPTURE_HELPER_IMPORT = async payload => {
    try {
      const workId = String(payload?.workId || '');
      if (!page.selected || workId !== String(page.selected.id)) throw new Error('현재 선택한 작품과 브라우저 캡처 작업이 일치하지 않습니다.');
      const result = await api.importMetadataBrowserCapture(workId, {
        pairingToken:String(payload?.pairingToken || ''),
        capture:payload?.capture || null
      });
      page.browserCapturePairing = null;
      globalThis.__TXT_READER_METADATA_CAPTURE_PAIRING = null;
      setDetailStatus(`${result.providerName || '공급자'} 브라우저 캡처 후보를 저장했습니다.${(result.warnings || []).length ? ` · ${result.warnings.join(' · ')}` : ''}`);
      await Promise.all([loadSelectedDetail(true),refreshOverview()]);
      await refreshSelectedWorkSummary(result?.applied ?? page.selectedPayload?.applied);
      return { ok:true, providerName:result.providerName || result.providerId || '', candidateId:result.candidate?.id || '', warnings:result.warnings || [] };
    } catch (error) {
      setDetailStatus(`브라우저 캡처 가져오기 실패: ${error.message || error}`,true);
      return { ok:false, error:String(error.message || error) };
    }
  };
}

async function startBrowserCapture() {
  if (!page.metadataAvailableForLocale) return setDetailStatus('한국어 사이트 언어에서만 메타데이터 공급자를 사용할 수 있습니다.',true);
  if (!page.selected) return;
  try {
    setDetailStatus('브라우저 캡처 연결을 만드는 중…');
    const payload = await api.createMetadataBrowserCapturePairing(page.selected.id);
    if (!payload?.pairing) throw new Error('브라우저 캡처 연결 정보를 받지 못했습니다.');
    installBrowserCapturePairing(payload.pairing);
    renderDetail(page.selectedPayload || {});
    setDetailStatus('캡처 연결이 준비되었습니다. Metadata Helper를 열어 “이 작품의 캡처 작업 시작”을 누른 뒤 로그인된 공식 작품 상세 페이지에서 다시 Helper를 여십시오.');
  } catch (error) { setDetailStatus(`브라우저 캡처 시작 실패: ${error.message || error}`,true); }
}

async function handleDetailAction(action, trigger) {
  if (!page.selected || !page.selectedPayload) return;
  if (action === 'refresh-detail') return loadSelectedDetail();
  if (action === 'browser-capture') return startBrowserCapture();
  if (action === 'collect-search' || action === 'collect-url') {
    if (!page.metadataAvailableForLocale) return setDetailStatus('한국어 사이트 언어에서만 메타데이터 공급자를 사용할 수 있습니다.',true);
    const url = action === 'collect-url' ? cleanText(document.querySelector('[data-detail-official-url]')?.value,2048) : '';
    if (action === 'collect-url' && !url) return setDetailStatus('공식 작품 URL을 입력하세요.',true);
    try {
      setDetailStatus('수집 작업을 등록하는 중…');
      const response = await api.collectNovelMetadata(page.selected.id,{ url,providerIds:selectedDetailProviders() });
      await refreshOverview();
      await pollJob(response.job.id);
    } catch (error) { setDetailStatus(`수집 실패: ${error.message || error}`,true); }
    return;
  }
  if (action === 'apply-candidate') {
    const card = trigger.closest('[data-candidate-id]');
    const candidateId = card?.dataset.candidateId || '';
    const candidateGroupId = card?.dataset.candidateGroupId || '';
    const fields = Array.from(card?.querySelectorAll('[data-candidate-field]:checked') || []).map(input=>input.value);
    if (!fields.length) return setDetailStatus('적용할 항목을 선택하세요.',true);
    try {
      const result = await api.applyNovelMetadata(page.selected.id,candidateGroupId ? { candidateGroupId,fields } : { candidateId,fields });
      setDetailStatus('메타데이터를 적용했습니다.');
      await loadSelectedDetail(true);
      await refreshSelectedWorkSummary(result?.applied || null);
    } catch (error) { setDetailStatus(`적용 실패: ${error.message || error}`,true); }
    return;
  }
  if (action === 'delete-candidate') {
    const card = trigger.closest('[data-candidate-id]');
    const candidateId = card?.dataset.candidateId || '';
    const candidateGroupId = card?.dataset.candidateGroupId || '';
    const grouped = Number(card?.dataset.candidateGroupCount || 1) > 1;
    if ((!candidateGroupId && !candidateId) || !window.confirm(grouped ? '내용이 같은 이 후보 묶음을 모두 삭제할까요? 이미 적용된 정보는 유지됩니다.' : '이 수집 후보를 삭제할까요? 이미 적용된 정보는 유지됩니다.')) return;
    try {
      if (candidateGroupId) await api.deleteMetadataCandidateGroup(page.selected.id,candidateGroupId);
      else await api.deleteMetadataCandidate(page.selected.id,candidateId);
      setDetailStatus(grouped ? '동일 메타데이터 후보 묶음을 삭제했습니다.' : '수집 후보를 삭제했습니다.');
      await loadSelectedDetail(true);
      await refreshOverview();
    } catch (error) { setDetailStatus(`후보 삭제 실패: ${error.message || error}`,true); }
    return;
  }
  if (action === 'save-manual') {
    const form = trigger.closest('[data-manual-metadata-form]');
    const coverFile = form?.querySelector('[data-manual-cover-file]')?.files?.[0] || null;
    const values = Object.fromEntries(Array.from(form?.querySelectorAll('[data-manual-field]') || []).map(input => [input.dataset.manualField, cleanText(input.value, input.dataset.manualField === 'synopsis' ? 8000 : 1600)]));
    const clearFields = Array.from(form?.querySelectorAll('[data-manual-clear-field]:checked') || []).map(input => String(input.dataset.manualClearField || '')).filter(Boolean);
    const list = value => String(value || '').split(/[,;\n]/u).map(item => cleanText(item,100)).filter(Boolean);
    const payload = {
      title:values.title, author:values.author, synopsis:values.synopsis,
      publicationStatus:values.publicationStatus,
      publicationYear:values.publicationYear ? Number(values.publicationYear) : null,
      sourceLanguage:values.sourceLanguage,
      genres:list(values.genres), tags:list(values.tags), clearFields
    };
    const coverMaxBytes = manualCoverLimitBytes(page.selectedPayload);
    if (coverFile && coverFile.size > coverMaxBytes) return setDetailStatus(`표지 이미지는 ${formatByteLimit(coverMaxBytes)} 이하여야 합니다.`,true);
    if (!coverFile && !clearFields.length && !Object.entries(payload).some(([key,value]) => key === 'clearFields' ? false : key === 'publicationYear' ? Number.isInteger(value) : Array.isArray(value) ? value.length : !!value)) return setDetailStatus('저장할 메타데이터나 표지 이미지를 하나 이상 입력하세요.',true);
    try {
      if (coverFile) {
        setDetailStatus('표지 이미지를 업로드하는 중…');
        const uploaded = await api.uploadManualNovelCover(page.selected.id,coverFile);
        payload.coverAssetId = uploaded?.cover?.assetId || '';
        if (!payload.coverAssetId) throw new Error('업로드된 표지 정보를 확인할 수 없습니다.');
      }
      const result = await api.saveManualNovelMetadata(page.selected.id,payload);
      setDetailStatus(coverFile ? '직접 입력한 메타데이터와 표지를 저장했습니다.' : '직접 입력한 메타데이터를 저장했습니다.');
      await loadSelectedDetail(true);
      await refreshSelectedWorkSummary(result?.applied || null);
    } catch (error) { setDetailStatus(`직접 입력 저장 실패: ${error.message || error}`,true); }
    return;
  }
  if (action === 'remove-applied') {
    if (!window.confirm('적용된 웹 메타데이터를 제거할까요? TXT 원본은 변경되지 않습니다.')) return;
    try {
      await api.deleteNovelMetadata(page.selected.id);
      setDetailStatus('적용 정보를 제거했습니다.');
      await loadSelectedDetail(true);
      await refreshSelectedWorkSummary(null);
    } catch (error) { setDetailStatus(`제거 실패: ${error.message || error}`,true); }
  }
}

async function collectMissing() {
  if (!page.metadataAvailableForLocale) return toast('한국어 사이트 언어에서만 메타데이터 공급자를 사용할 수 있습니다.',true);
  if (activeMetadataOperation()) return toast('다른 전체 메타데이터 작업이 이미 진행 중입니다.',true);
  const enabledProviders = page.providers.filter(provider=>provider.enabled).map(provider=>provider.id);
  if (!enabledProviders.length) return toast('활성화된 메타데이터 공급자가 없습니다.',true);
  if (!window.confirm('현재 접근 가능한 서재에서 메타데이터가 없는 모든 작품을 수집할까요? 작품 수 제한 없이 하나의 영속 작업으로 순차 처리합니다.')) return;
  const buttons = ['metadata-collect-all-btn','metadata-collect-missing-btn'].map(id=>document.getElementById(id)).filter(Boolean);
  buttons.forEach(button => { button.disabled=true; });
  try {
    const response = await api.collectMissingMetadata({ providerIds:enabledProviders });
    const recovered = Number(response.recoveredApplied)||0;
    const pending = Number(response.pendingCandidates)||0;
    const recoveredText = recovered ? ` 기존 후보 ${recovered.toLocaleString()}건은 자동 적용했습니다.` : '';
    const pendingText = pending ? ` 일치가 불확실한 후보 ${pending.toLocaleString()}건은 수동 검토 대상으로 유지합니다.` : '';
    if (!response.job) toast(`수집할 미수집 작품이 없습니다.${recoveredText}${pendingText}`);
    else toast(`${Number(response.count||0).toLocaleString()}개 작품의 전체 수집 작업을 ${response.reused ? '이어갑니다' : '등록했습니다'}.${recoveredText}${pendingText}`);
    await refreshOverview();
    selectTab('jobs');
  } catch (error) { toast(`전체 수집 실패: ${error.message || error}`,true); }
  finally { updateSummary(); }
}

async function applyPendingCandidates() {
  if (!page.metadataAvailableForLocale) return toast('한국어 사이트 언어에서만 메타데이터 공급자를 사용할 수 있습니다.',true);
  if (activeMetadataOperation()) return toast('다른 전체 메타데이터 작업이 이미 진행 중입니다.',true);
  if (!window.confirm(`현재 접근 가능한 서재에서 적용되지 않은 후보 중 일치율 ${autoApplyPercent()} 이상인 결과를 공급자 우선순위에 따라 일괄 적용할까요? 정확한 제목의 비모호 단일 후보는 안전 예외로 포함될 수 있습니다.`)) return;
  const button = document.getElementById('metadata-apply-pending-btn');
  if (button) button.disabled = true;
  try {
    const response = await api.applyPendingMetadata();
    const manual = Number(response.manualReview)||0;
    const manualText = manual ? ` 기준 미달 또는 불확실 후보 ${manual.toLocaleString()}건은 검토 대기로 유지합니다.` : '';
    if (!response.job) toast(`일괄 적용할 신뢰 후보가 없습니다.${manualText}`);
    else toast(`${Number(response.count||0).toLocaleString()}개 작품의 후보 일괄 적용 작업을 ${response.reused ? '이어갑니다' : '등록했습니다'}.${manualText}`);
    await refreshOverview();
    selectTab('jobs');
  } catch (error) { toast(`후보 일괄 적용 실패: ${error.message || error}`,true); }
  finally { updateSummary(); }
}

function selectTab(name) {
  document.querySelectorAll('[data-metadata-page-tab]').forEach(button => {
    const active = button.dataset.metadataPageTab === name;
    button.classList.toggle('active',active); button.setAttribute('aria-selected',active?'true':'false'); button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('[data-metadata-page-panel]').forEach(panel => {
    const active = panel.dataset.metadataPagePanel === name;
    panel.classList.toggle('active',active); panel.hidden = !active;
  });
}

function installEvents() {
  document.addEventListener('click',event => {
    const tab = event.target.closest('[data-metadata-page-tab]');
    if (tab) return selectTab(tab.dataset.metadataPageTab);
    const work = event.target.closest('[data-work-id]');
    if (work) { page.lastFocusedWorkId = work.dataset.workId; return void selectWork(work.dataset.workId); }
    const action = event.target.closest('[data-metadata-action]');
    if (action) {
      if (action.disabled || action.dataset.metadataPending === '1') return;
      action.dataset.metadataPending = '1';
      action.disabled = true;
      action.setAttribute('aria-busy','true');
      return void Promise.resolve(handleDetailAction(action.dataset.metadataAction,action)).finally(() => {
        if (!action.isConnected) return;
        delete action.dataset.metadataPending;
        action.removeAttribute('aria-busy');
        action.disabled = false;
      });
    }
    const cancel = event.target.closest('[data-cancel-job-id]');
    if (cancel) return void api.cancelMetadataJob(cancel.dataset.cancelJobId).then(refreshOverview).catch(error=>toast(error.message||error,true));
  });
  document.getElementById('metadata-page-logout')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    if (button?.disabled) return;
    button.disabled = true;
    button.textContent = '로그아웃 중…';
    try {
      await api.logout();
      try { localStorage.removeItem('csrf_token'); } catch {}
      location.replace('/login.html');
    } catch (error) {
      button.disabled = false;
      button.textContent = '로그아웃';
      toast(`로그아웃 실패: ${error.message || error}`, true);
    }
  });
  document.getElementById('metadata-detail-mobile-back')?.addEventListener('click',()=>closeMobileDetail({ useHistory:true }));
  document.addEventListener('keydown',event=>{ if (event.key === 'Escape' && page.mobileDetailOpen && isMobileWorkspace()) { event.preventDefault(); closeMobileDetail({ useHistory:true }); } });
  window.addEventListener('popstate',event=>{
    if (!isMobileWorkspace()) return;
    if (event.state?.metadataDetail && event.state?.novelId) {
      page.mobileHistoryEntry = true;
      if (String(page.selected?.id || '') !== String(event.state.novelId)) void selectWork(event.state.novelId,{ historyMode:'none', focusDetail:true });
      else { page.mobileDetailOpen = true; syncMobileWorkspace({ focusDetail:true }); }
      return;
    }
    page.mobileDetailOpen = false;
    page.mobileHistoryEntry = false;
    syncMobileWorkspace({ restoreFocus:true });
  });
  metadataMobileQuery.addEventListener?.('change',()=>syncMobileWorkspace({ restoreFocus:false }));
  let metadataPageRefreshing = false;
  async function refreshMetadataPage() {
    if (metadataPageRefreshing) return;
    const button = document.getElementById('metadata-page-refresh');
    metadataPageRefreshing = true;
    if (button) { button.disabled = true; button.setAttribute('aria-busy','true'); button.textContent = '새로고침 중…'; }
    try {
      const tasks = [refreshOverview(), loadWorks(true,{ preserveView:true, preserveSelection:true, preserveLoadedCount:true })];
      if (page.selected) tasks.push(loadSelectedDetail(true));
      const results = await Promise.allSettled(tasks);
      const failed = results.filter(result => result.status === 'rejected');
      if (failed.length) throw failed[0].reason;
      toast('메타데이터 관리 화면을 새로고침했습니다.');
    } catch (error) {
      toast(`새로고침 실패: ${error?.message || error}`, true);
    } finally {
      metadataPageRefreshing = false;
      if (button) { button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = '새로고침'; }
    }
  }
  document.getElementById('metadata-page-refresh')?.addEventListener('click',()=>void refreshMetadataPage());
  document.getElementById('metadata-apply-pending-btn')?.addEventListener('click',()=>void applyPendingCandidates());
  document.getElementById('metadata-jobs-refresh')?.addEventListener('click',()=>void refreshOverview());
  document.getElementById('metadata-collect-missing-btn')?.addEventListener('click',()=>void collectMissing());
  document.getElementById('metadata-collect-all-btn')?.addEventListener('click',()=>void collectMissing());
  document.getElementById('metadata-work-more')?.addEventListener('click',()=>void loadWorks(false));
  const search = () => { page.query=cleanText(document.getElementById('metadata-work-query')?.value,240); void loadWorks(true,{ preserveView:false, preserveSelection:false }); };
  const applyFilters = () => {
    const status = String(document.getElementById('metadata-work-status-filter')?.value || 'all');
    page.metadataStatus = ['all','applied','missing'].includes(status) ? status : 'all';
    page.metadataProviderId = page.metadataStatus === 'missing' ? '' : cleanText(document.getElementById('metadata-work-provider-filter')?.value,120);
    page.folderPath = cleanText(document.getElementById('metadata-work-folder-filter')?.value,480);
    syncWorkFilterControls();
    syncWorkFilterUrl();
    void loadWorks(true,{ preserveView:false, preserveSelection:false });
  };
  document.getElementById('metadata-work-search-btn')?.addEventListener('click',search);
  document.getElementById('metadata-work-query')?.addEventListener('keydown',event=>{ if(event.key==='Enter') search(); });
  document.getElementById('metadata-work-status-filter')?.addEventListener('change',applyFilters);
  document.getElementById('metadata-work-provider-filter')?.addEventListener('change',applyFilters);
  document.getElementById('metadata-work-folder-filter')?.addEventListener('change',applyFilters);
  const searchFolders = () => {
    page.folderQuery = cleanText(document.getElementById('metadata-work-folder-query')?.value,160);
    page.folderNextCursor = '';
    void loadFolderFilters({ append:false });
  };
  document.getElementById('metadata-work-folder-search')?.addEventListener('click',searchFolders);
  document.getElementById('metadata-work-folder-query')?.addEventListener('keydown',event=>{ if(event.key==='Enter'){ event.preventDefault(); searchFolders(); } });
  document.getElementById('metadata-work-folder-more')?.addEventListener('click',()=>void loadFolderFilters({ append:true }));
  document.getElementById('metadata-work-folder-disclosure')?.addEventListener('toggle',event=>{
    try { sessionStorage.setItem(FOLDER_DISCLOSURE_STORAGE_KEY, event.currentTarget.open ? '1' : '0'); } catch {}
  });
  document.getElementById('metadata-work-filter-clear')?.addEventListener('click',()=>{
    page.metadataStatus='all'; page.metadataProviderId=''; page.folderPath=''; page.folderQuery=''; page.folderNextCursor='';
    syncWorkFilterControls(); syncWorkFilterUrl();
    void Promise.all([
      loadFolderFilters({ append:false }),
      loadWorks(true,{ preserveView:false, preserveSelection:false })
    ]);
  });
  document.addEventListener('visibilitychange',schedulePoll);
}

async function start() {
  await hydrateMetadataPageTheme();
  const initialUrl = new URL(location.href);
  const requestedStatus = String(initialUrl.searchParams.get('metadataStatus') || 'all');
  page.metadataStatus = ['all','applied','missing'].includes(requestedStatus) ? requestedStatus : 'all';
  page.metadataProviderId = page.metadataStatus === 'missing' ? '' : cleanText(initialUrl.searchParams.get('metadataProvider'),120);
  page.folderPath = cleanText(initialUrl.searchParams.get('folder'),480);
  initializeFolderDisclosure();
  document.documentElement.dataset.metadataPagePass = METADATA_PAGE_PASS;
  document.documentElement.dataset.buildVersion = METADATA_PAGE_BUILD;
  document.body.dataset.buildVersion = METADATA_PAGE_BUILD;
  await loadFolderFilters();
  syncWorkFilterControls();
  installEvents();
  installWorkListKeyboard();
  installMetadataTabKeyboard();
  syncMobileWorkspace();
  await Promise.all([refreshOverview(),loadWorks(true,{ preserveView:false, preserveSelection:false })]);
  const requested = new URL(location.href).searchParams.get('novelId') || '';
  if (requested) {
    let work = page.workById.get(requested);
    if (!work) {
      try {
        const focused = await api.novelShelf({ scope:'all',sort:'title',focusNovelId:requested,limit:60,filters:currentWorkFilters() });
        for (const item of focused.items || []) { if (!page.workById.has(item.id)) page.works.push(item); page.workById.set(item.id,item); }
        work = page.workById.get(requested) || (focused.items || []).find(item=>(item.progressAliases||[]).includes(requested));
        renderWorkList();
      } catch {}
    }
    if (work) await selectWork(work.id,{ historyMode:'replace', focusDetail:false });
  }
}

window.addEventListener('pagehide',()=>{
  cancelJobPoll();
  window.clearTimeout(page.pollTimer);
  page.pollTimer = 0;
  page.workController?.abort?.();
});

window.addEventListener('pageshow',event=>{
  if (!event.persisted) return;
  void Promise.all([
    refreshOverview(),
    loadWorks(true,{ preserveView:true, preserveSelection:true, preserveLoadedCount:true }),
    page.selected ? loadSelectedDetail(true) : null
  ]);
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',()=>void start(),{ once:true });
else void start();
