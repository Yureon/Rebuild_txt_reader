const pairingSummary = document.querySelector('#pairing-summary');
const importButton = document.querySelector('#import-button');
const actionStack = document.querySelector('#action-stack');
const resetButton = document.querySelector('#reset-button');
const statusEl = document.querySelector('#status');
const stageBadge = document.querySelector('#stage-badge');
const shortcutKey = document.querySelector('#shortcut-key');
const flowSteps = [...document.querySelectorAll('[data-flow-step]')];
let autoActionStarted = false;
const guideEl = document.querySelector('#guide');
const CAPTURE_STORAGE_KEY = 'txtReaderMetadataCaptureWorkflowV1';
const NAVIGATION_SCHEMA_VERSION = 1;
const URL_POLICY = globalThis.TxtReaderMetadataUrlPolicy;
if (!URL_POLICY) throw new Error('metadata URL policy failed to load');
const { normalizeHttpsUrl, canonicalDetailTarget, repeatedlyDecode, recoverTargetFromAuthUrl, isAuthHost } = URL_POLICY;

let currentAction = null;

async function refreshShortcutLabel() {
  if (!shortcutKey || !chrome.commands?.getAll) return;
  try {
    const commands = await chrome.commands.getAll();
    const command = commands.find(item => item.name === '_execute_action');
    shortcutKey.textContent = command?.shortcut || '확장 프로그램 단축키 설정';
  } catch {}
}

const SUMMARY_LABELS = Object.freeze({
  work:'작품', provider:'공급자', page:'현재 사이트', candidate:'일치 후보', match:'제목 일치', author:'작가', access:'접근 상태', stage:'진행 단계', target:'복귀 작품', expires:'만료 시각', providers:'지원 공급자'
});

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', error);
}

function setFlowStage(stage) {
  const order = ['pair','capture','import'];
  const index = Math.max(0, order.indexOf(stage));
  flowSteps.forEach((node, nodeIndex) => {
    node.classList.toggle('active', nodeIndex === index);
    node.classList.toggle('done', nodeIndex < index);
    node.setAttribute('aria-current', nodeIndex === index ? 'step' : 'false');
  });
  if (stageBadge) stageBadge.textContent = stage === 'pair' ? '1/3' : stage === 'capture' ? '2/3' : '3/3';
}

function renderSummary(rows = []) {
  pairingSummary.replaceChildren();
  for (const [label, value] of rows) {
    const wrapper = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = SUMMARY_LABELS[label] || label;
    dd.textContent = value;
    dd.title = String(value || '');
    wrapper.append(dt, dd);
    pairingSummary.append(wrapper);
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('활성 탭을 찾을 수 없습니다.');
  return tab;
}

async function readPageContext(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      const capture = window.__TXT_READER_METADATA_CAPTURE_PAIRING;
      return {
        capture: capture ? {
          workId: String(capture.workId || ''), workTitle: String(capture.workTitle || ''),
          token: String(capture.token || ''), expiresAt: String(capture.expiresAt || ''),
          readerOrigin: String(capture.readerOrigin || location.origin),
          providers: Array.isArray(capture.providers) ? capture.providers.map((provider) => ({
            id: String(provider?.id || ''), name: String(provider?.name || ''),
            hosts: Array.isArray(provider?.hosts) ? provider.hosts.map(String) : []
          })) : []
        } : null,
        hasCaptureImporter: typeof window.__TXT_READER_METADATA_CAPTURE_HELPER_IMPORT === 'function',
        href: location.href,
        origin: location.origin,
        hostname: location.hostname,
        canonicalUrl: document.querySelector('link[rel="canonical"]')?.href || null,
        ogUrl: document.querySelector('meta[property="og:url"]')?.content || null
      };
    }
  });
  return result?.result || null;
}


function validCaptureWorkflow(value) {
  return value && typeof value === 'object' && value.pairing?.token && value.pairing?.workId
    && Date.parse(value.pairing.expiresAt) > Date.now();
}

async function readCaptureWorkflow() {
  const stored = await chrome.storage.local.get(CAPTURE_STORAGE_KEY);
  const value = stored?.[CAPTURE_STORAGE_KEY] || null;
  if (!validCaptureWorkflow(value)) {
    if (value) await chrome.storage.local.remove(CAPTURE_STORAGE_KEY);
    return null;
  }
  return value;
}

async function writeCaptureWorkflow(value) {
  await chrome.storage.local.set({ [CAPTURE_STORAGE_KEY]: value });
}

async function clearCaptureWorkflow() {
  await chrome.storage.local.remove(CAPTURE_STORAGE_KEY);
}

function providerForHost(pairing, hostname) {
  const host = String(hostname || '').toLowerCase();
  return (pairing.providers || []).find((provider) => (provider.hosts || []).some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) || null;
}

function providerForId(pairing, providerId) {
  return (pairing?.providers || []).find((provider) => provider?.id === providerId) || null;
}

function createNavigation(provider, targetUrl, targetTitle, tabId, phase = 'opening-detail') {
  return {
    schemaVersion: NAVIGATION_SCHEMA_VERSION,
    providerId: provider.id,
    providerName: provider.name,
    targetUrl,
    targetTitle: targetTitle || '',
    tabId,
    phase,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    restoreCount: 0
  };
}

async function detectKakaoAgeGate(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN',
    func: () => {
      const text = String(document.body?.innerText || '');
      const detected = text.includes('서비스 이용을 위해 연령 확인이 필요')
        && text.includes('로그인 후 이용해 주세요');
      if (!detected) return { detected:false, hasLoginButton:false };
      const hasLoginButton = [...document.querySelectorAll('button')].some((button) => {
        if (String(button.textContent || '').trim() !== '로그인') return false;
        const scopeText = String(button.parentElement?.parentElement?.innerText || button.parentElement?.innerText || '');
        return scopeText.includes('연령 확인') && scopeText.includes('로그인 후 이용');
      });
      return { detected:true, hasLoginButton };
    }
  });
  return result?.result || { detected:false, hasLoginButton:false };
}

async function continueKakaoAgeGate(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN',
    func: () => {
      const text = String(document.body?.innerText || '');
      if (!text.includes('서비스 이용을 위해 연령 확인이 필요') || !text.includes('로그인 후 이용해 주세요')) {
        return { ok:false, error:'카카오페이지 연령 확인 안내를 찾지 못했습니다.' };
      }
      const loginButton = [...document.querySelectorAll('button')].find((button) => {
        if (String(button.textContent || '').trim() !== '로그인') return false;
        const scopeText = String(button.parentElement?.parentElement?.innerText || button.parentElement?.innerText || '');
        return scopeText.includes('연령 확인') && scopeText.includes('로그인 후 이용');
      });
      if (!loginButton) return { ok:false, error:'연령 확인 안내의 로그인 버튼을 찾지 못했습니다.' };
      loginButton.click();
      return { ok:true };
    }
  });
  const response = result?.result;
  if (!response?.ok) throw new Error(response?.error || '카카오 로그인 화면으로 이동하지 못했습니다.');
  return response;
}

function resolveCaptureDetailTarget(provider, context) {
  const candidates = [context?.canonicalUrl, context?.ogUrl, context?.href].filter(Boolean);
  for (const value of candidates) {
    const normalized = normalizeHttpsUrl(value, context?.href);
    const target = normalized ? canonicalDetailTarget(provider?.id, normalized.href) : null;
    if (target) return target;
  }
  return null;
}

function normalizeCandidateTitle(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/\[[^\]]*\]|\([^)]*\)/gu, ' ')
    .replace(/(?:19\s*(?:세|금)|완전판|단행본|이용권|외전|완결|완)/gu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function candidateSimilarity(left, right) {
  const a = normalizeCandidateTitle(left);
  const b = normalizeCandidateTitle(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) * 0.96;
  const aTokens = new Set(a.split(' ').filter(Boolean));
  const bTokens = new Set(b.split(' ').filter(Boolean));
  const intersection = [...aTokens].filter(token => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size || 1;
  return intersection / union;
}

async function findRenderedSearchCandidates(tabId, provider, workTitle) {
  if (provider?.id !== 'builtin-kakaopage' && provider?.id !== 'builtin-naver-series') return [];
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', args: [{ workTitle, providerId:provider.id }],
    func: ({ workTitle, providerId }) => {
      const clean = (value, limit = 300) => String(value || '').replace(/\s+/gu, ' ').trim().slice(0, limit);
      const normalize = (value) => clean(value, 300).normalize('NFKC').toLocaleLowerCase('ko-KR')
        .replace(/\[[^\]]*\]|\([^)]*\)/gu, ' ')
        .replace(/(?:19\s*(?:세|금)|완전판|단행본|이용권|외전|완결|완)/gu, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
      const similarity = (left, right) => {
        const a = normalize(left); const b = normalize(right);
        if (!a || !b) return 0;
        if (a === b) return 1;
        if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) * 0.96;
        const aa = new Set(a.split(' ').filter(Boolean)); const bb = new Set(b.split(' ').filter(Boolean));
        const hit = [...aa].filter(token => bb.has(token)).length;
        return hit / (new Set([...aa, ...bb]).size || 1);
      };
      const output = new Map();
      if (providerId === 'builtin-kakaopage') {
        for (const anchor of document.querySelectorAll('a[href*="/content/"]')) {
          const url = new URL(anchor.href, location.href);
          const remoteId = url.pathname.match(/^\/content\/(\d{3,})\/?$/u)?.[1] || '';
          if (!remoteId || url.hostname !== 'page.kakao.com') continue;
          const aria = clean(anchor.querySelector('[aria-label]')?.getAttribute('aria-label') || anchor.getAttribute('aria-label') || '', 1000);
          const ariaParts = aria.split(',').map(value => clean(value, 300)).filter(Boolean);
          const title = ariaParts[0] === '작품' ? clean(ariaParts[1], 300) : clean(anchor.querySelector('.font-medium2 span, .font-medium2, [class*="title"]')?.textContent || anchor.textContent, 300);
          const author = clean((ariaParts.find(value => /^작가\s+/u.test(value)) || '').replace(/^작가\s+/u, ''), 120);
          if (!title) continue;
          const candidate = { remoteId, url:`https://page.kakao.com/content/${remoteId}`, title, author, ageRestricted:/19\s*세/u.test(aria), coverAvailable:true, score:similarity(workTitle, title) };
          const previous = output.get(remoteId);
          if (!previous || candidate.score > previous.score) output.set(remoteId, candidate);
        }
      }
      if (providerId === 'builtin-naver-series' && location.hostname === 'series.naver.com') {
        for (const anchor of document.querySelectorAll('a[href*="/novel/detail.series"][href*="productNo="]')) {
          const url = new URL(anchor.href, location.href);
          const remoteId = url.searchParams.get('productNo') || '';
          if (!/^\d{3,}$/u.test(remoteId) || url.hostname !== 'series.naver.com' || url.pathname !== '/novel/detail.series') continue;
          const item = anchor.closest('li') || anchor.parentElement;
          const titleAnchor = item?.querySelector('h3 a[href*="/novel/detail.series"][href*="productNo="]') || anchor;
          const title = clean(titleAnchor?.textContent || anchor.querySelector('img[alt]')?.getAttribute('alt') || '', 300).replace(/\s*\(총[^)]*\)\s*$/u, '');
          const author = clean(item?.querySelector('.author')?.textContent || '', 120);
          const coverSource = clean(item?.querySelector('img')?.getAttribute('src') || '', 1000);
          if (!title) continue;
          const candidate = {
            remoteId,
            url:`https://series.naver.com/novel/detail.series?productNo=${remoteId}`,
            title,
            author,
            ageRestricted:!!item?.querySelector('.ico.n19'),
            coverAvailable:!/(?:19over_book|noimg_book)/iu.test(coverSource),
            score:similarity(workTitle, title)
          };
          const previous = output.get(remoteId);
          if (!previous || candidate.score > previous.score) output.set(remoteId, candidate);
        }
      }
      return [...output.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ko')).slice(0, 8);
    }
  });
  return Array.isArray(injection?.result) ? injection.result.map((candidate) => ({
    ...candidate,
    score:Number.isFinite(Number(candidate?.score)) ? Number(candidate.score) : candidateSimilarity(workTitle, candidate?.title)
  })).sort((a, b) => b.score - a.score) : [];
}

async function extractCurrentPageMetadata(tabId, provider, pageUrl) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', args: [{ providerId: provider.id, pageUrl }],
    func: ({ providerId, pageUrl }) => {
      const clean = (value, limit = 20000) => String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, limit);
      const unique = (values, limit = 40) => {
        const result = [];
        const seen = new Set();
        for (const value of values || []) {
          const text = clean(typeof value === 'object' ? value?.name : value, 80).replace(/^#+/u, '');
          const key = text.toLocaleLowerCase('ko-KR');
          if (!text || seen.has(key)) continue;
          seen.add(key);
          result.push(text);
          if (result.length >= limit) break;
        }
        return result;
      };
      const list = (value, limit = 40) => unique(Array.isArray(value) ? value : (typeof value === 'string' ? value.split(/[,#|]/u) : []), limit);
      const meta = (selector) => clean(document.querySelector(selector)?.getAttribute('content') || '', 20000);
      const text = (selector, limit = 20000) => clean(document.querySelector(selector)?.textContent || '', limit);
      const absolute = (value) => {
        try {
          const url = new URL(String(value || ''), location.href);
          return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') ? url.href : '';
        } catch { return ''; }
      };
      const fieldSources = {};
      const graph = [];
      for (const script of [...document.querySelectorAll('script[type="application/ld+json"]')].slice(0, 20)) {
        try {
          const parsed = JSON.parse(script.textContent || 'null');
          const nodes = Array.isArray(parsed) ? parsed : [parsed];
          for (const node of nodes) {
            if (node && typeof node === 'object') {
              graph.push(node);
              if (Array.isArray(node['@graph'])) graph.push(...node['@graph'].filter((item) => item && typeof item === 'object'));
            }
          }
        } catch {}
      }
      const types = (node) => list(node?.['@type'], 10).map((item) => item.toLowerCase());
      const preferred = graph.find((node) => types(node).some((type) => ['book', 'novel', 'creativework', 'product'].includes(type))) || null;
      const pick = (field, entries, limit = 2000) => {
        for (const [source, value] of entries) {
          const result = clean(value, limit);
          if (result) { fieldSources[field] = source; return result; }
        }
        return '';
      };
      const authorValue = preferred?.author;
      const jsonLdAuthor = Array.isArray(authorValue)
        ? authorValue.map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean).join(', ')
        : (typeof authorValue === 'object' ? authorValue?.name : authorValue);
      let title = pick('title', [
        ['json-ld', preferred?.name || preferred?.headline],
        ['og:title', meta('meta[property="og:title"]')],
        ['twitter:title', meta('meta[name="twitter:title"]')],
        ['h1', text('h1', 2000)],
        ['document:title', document.title]
      ]);
      let author = pick('author', [['json-ld', jsonLdAuthor], ['meta:author', meta('meta[name="author"]')]]);
      let synopsis = pick('synopsis', [
        ['json-ld', preferred?.description],
        ['og:description', meta('meta[property="og:description"]')],
        ['meta:description', meta('meta[name="description"]')]
      ], 20000);
      const imageValue = preferred?.image;
      let coverUrl = pick('cover', [
        ['json-ld', typeof imageValue === 'string' ? imageValue : (Array.isArray(imageValue) ? imageValue[0] : imageValue?.url)],
        ['og:image', meta('meta[property="og:image"]')],
        ['twitter:image', meta('meta[name="twitter:image"]')]
      ]);
      let genres = list(preferred?.genre, 20);
      let tags = list(preferred?.keywords || meta('meta[name="keywords"]'), 40);
      let publicationStatus = '';

      if (providerId === 'builtin-kakaopage') {
        title = pick('title', [['og:title', meta('meta[property="og:title"]')], ['twitter:title', meta('meta[name="twitter:title"]')], ['detail:title', text('span.font-large3-bold', 300)]]) || title;
        author = pick('author', [['meta:author', meta('meta[name="author"]')], ['detail:author', text('.rounded-t-12pxr span.font-small2.mb-6pxr', 300)]]) || author;
        synopsis = pick('synopsis', [['og:description', meta('meta[property="og:description"]')], ['meta:description', meta('meta[name="description"]')]], 20000) || synopsis;
        coverUrl = pick('cover', [['og:image', meta('meta[property="og:image"]')], ['twitter:image', meta('meta[name="twitter:image"]')]]) || coverUrl;
        const root = document.querySelector('span.font-large3-bold')?.closest('.rounded-t-12pxr');
        const detailTokens = root ? [...root.querySelectorAll('.line-clamp-1 .break-all.align-middle')].map((node) => clean(node.textContent, 80)) : [];
        genres = unique(detailTokens.filter((value) => value && value !== '웹소설' && !/^\d/u.test(value)), 20);
        const status = root ? [...root.querySelectorAll('span')].map((node) => clean(node.textContent, 80)).find((value) => /^(?:완결|연재|연재중|휴재)$/u.test(value)) : '';
        publicationStatus = status || '';
        tags = unique([
          ...tags.filter((value) => value !== title && value !== author),
          ...genres,
          ...(title.includes('19세') || root?.querySelector('img[alt*="19세"]') ? ['19세'] : []),
          ...(publicationStatus ? [publicationStatus] : [])
        ], 40);
      } else if (providerId === 'builtin-naver-series') {
        title = pick('title', [['og:title', meta('meta[property="og:title"]')], ['document:title', document.title]]) || title;
        const infoItems = [...document.querySelectorAll('ul.end_info li.info_lst > ul > li')];
        const authorItem = infoItems.find((item) => clean(item.querySelector('span')?.textContent, 40) === '글');
        author = pick('author', [['detail:author', authorItem?.querySelector('a')?.textContent]]) || author;
        genres = unique([...document.querySelectorAll('ul.end_info a[href*="categoryProductList.series"]')].map((node) => clean(node.textContent, 80)), 20);
        const infoText = clean(document.querySelector('ul.end_info')?.textContent, 1000);
        publicationStatus = /완결/u.test(infoText) ? '완결' : (/연재/u.test(infoText) ? '연재' : '');
        const description = meta('meta[property="og:description"]') || meta('meta[name="description"]');
        const storyMarker = description.indexOf('줄거리:');
        const prefix = storyMarker >= 0 ? description.slice(0, storyMarker) : '';
        synopsis = pick('synopsis', [['og:description:story', storyMarker >= 0 ? description.slice(storyMarker + 4) : description]], 20000) || synopsis;
        const descriptionTags = [...prefix.matchAll(/#([^,]+)/gu)].map((match) => clean(match[1], 80)).filter((value) => value && value !== 'NOVEL');
        tags = unique([
          ...descriptionTags,
          ...genres,
          ...(/청소년\s*이용불가/u.test(infoText) ? ['19세'] : []),
          ...(publicationStatus ? [publicationStatus] : [])
        ], 40);
        coverUrl = pick('cover', [['og:image', meta('meta[property="og:image"]')]]) || coverUrl;
      } else if (providerId === 'builtin-novelpia') {
        title = pick('title', [['detail:title', text('.epnew-novel-title', 300)], ['og:title', meta('meta[property="og:title"]')]]) || title;
        author = pick('author', [['detail:author', text('.epnew-writer a.writer-name', 300)]]) || author;
        synopsis = pick('synopsis', [['detail:synopsis', text('.epnew-novel-info .info-graybox .synopsis', 20000)], ['og:description', meta('meta[property="og:description"]')]], 20000) || synopsis;
        const detailTags = [...document.querySelectorAll('.epnew-novel-info .epnew-tag .writer-tag .tag')].map((node) => clean(node.textContent, 80));
        const adult = Boolean(document.querySelector('.epnew-writer .b_19'));
        tags = unique([...detailTags, ...(adult ? ['19세'] : [])], 40);
        const serializationLine = [...document.querySelectorAll('.epnew-novel-info .ep-info-line')]
          .find((node) => clean(node.querySelector('.category-title')?.textContent, 40) === '연재');
        publicationStatus = serializationLine ? '연재' : '';
        coverUrl = pick('cover', [
          ['detail:cover', document.querySelector('.epnew-cover-box a.venobox[href]')?.href],
          ['detail:cover-image', document.querySelector('.epnew-cover-box img.cover_img')?.src]
        ]) || coverUrl;
      } else if (providerId === 'builtin-ssn') {
        const stripSsnSuffix = (value) => clean(value, 300).replace(/\s*[-|·:]\s*(?:소설넷|웹소설.*)$/iu, '').replace(/\s+완결\s*$/u, '').trim();
        title = pick('title', [
          ['detail:title', stripSsnSuffix(text('h1', 300))],
          ['og:title', stripSsnSuffix(meta('meta[property="og:title"]'))],
          ['document:title', stripSsnSuffix(document.title)]
        ]) || title;
        const authorNode = document.querySelector('a[href*="/profile/author/"][href*="/series"], a[href*="/series/author/"]');
        author = pick('author', [['detail:author', authorNode?.textContent], ['meta:author', meta('meta[name="author"]')]]) || author;
        genres = unique([...document.querySelectorAll('a[href*="/series/genre/"]')].map((node) => clean(node.textContent, 80)), 20);
        tags = unique([...document.querySelectorAll('a[href*="/series/tag/"]')].map((node) => clean(node.textContent, 80).replace(/^#+/u, '')), 40);
        const bodyText = clean(document.body?.innerText || '', 40000);
        publicationStatus = /완결/u.test(bodyText.slice(0, 4000)) ? '완결' : (/연재/u.test(bodyText.slice(0, 4000)) ? '연재' : '');
        synopsis = pick('synopsis', [
          ['og:description', meta('meta[property="og:description"]')],
          ['meta:description', meta('meta[name="description"]')],
          ['detail:synopsis', text('[class*="synopsis"], [class*="description"], [class*="summary"]', 20000)]
        ], 20000) || synopsis;
        coverUrl = pick('cover', [['og:image', meta('meta[property="og:image"]')], ['twitter:image', meta('meta[name="twitter:image"]')]]) || coverUrl;
      } else if (providerId === 'builtin-joara') {
        const stripJoaraSuffix = (value) => clean(value, 300).replace(/\s*[-|·:]\s*조아라.*$/iu, '').trim();
        const titleNode = document.querySelector('.book-info .title, .sub-header .sub-title');
        title = pick('title', [
          ['detail:title', stripJoaraSuffix(titleNode?.textContent || '')],
          ['og:title', stripJoaraSuffix(meta('meta[property="og:title"]'))],
          ['document:title', stripJoaraSuffix(document.title)]
        ]) || title;
        author = pick('author', [
          ['detail:author', document.querySelector('.book-info .nickname .name button, .book-info .nickname button')?.textContent],
          ['search:author', document.querySelector('.searchResult .nickname')?.textContent]
        ]) || author;
        synopsis = pick('synopsis', [
          ['detail:synopsis', text('.book-summary p, .book-summary', 20000)],
          ['search:synopsis', text('.searchResult .introduce', 20000)],
          ['og:description', meta('meta[property="og:description"]')],
          ['meta:description', meta('meta[name="description"]')]
        ], 20000) || synopsis;
        const sortItems = [...document.querySelectorAll('.book-info .sort .items span, .searchResult .caption .info span')]
          .map((node) => clean(node.textContent, 80)).filter(Boolean);
        genres = unique(sortItems.filter((value) => !/무료|노블|프리|\d+\s*화|완결|연재/iu.test(value)), 20);
        const keywordTags = [...document.querySelectorAll('.keyword a, .keyword-list button, [data-keyword]')]
          .map((node) => clean(node.getAttribute('data-keyword') || node.textContent, 80)).filter(Boolean);
        const adult = Boolean(document.querySelector('.book-info .icon-adult .badge-19, .searchResult .i-adult .badge-19-sm, .badge-19, .badge-19-sm'));
        const statusText = sortItems.join(' ');
        publicationStatus = /완결/u.test(statusText) ? '완결' : (/연재/u.test(statusText) ? '연재' : '');
        tags = unique([
          ...keywordTags,
          ...sortItems.filter((value) => !genres.includes(value) && !/\d+\s*화/iu.test(value)),
          ...(adult ? ['19세'] : []),
          ...(publicationStatus ? [publicationStatus] : [])
        ], 40);
        const coverNode = document.querySelector('.book-thumb-img source[srcset], .book-thumb-img img[src], .book-thumb-bg .bg-img, .searchResult .bookImg source[srcset], .searchResult .bookImg img[src]');
        const background = coverNode?.getAttribute('style')?.match(/url\(["']?([^"')]+)["']?\)/iu)?.[1];
        coverUrl = pick('cover', [
          ['detail:cover', background || coverNode?.getAttribute('srcset')?.split(/\s+/u)[0] || coverNode?.getAttribute('src')]
        ]) || coverUrl;
      }

      coverUrl = absolute(coverUrl) || null;
      const published = clean(preferred?.datePublished, 80);
      const publicationYear = /^\d{4}/u.test(published) ? Number(published.slice(0, 4)) : null;
      if (publicationYear) fieldSources.publicationYear = 'json-ld';
      const sourceLanguage = clean(preferred?.inLanguage, 80) || null;
      if (sourceLanguage) fieldSources.sourceLanguage = 'json-ld';
      if (publicationStatus) fieldSources.publicationStatus = fieldSources.publicationStatus || 'detail:status';
      return {
        pageUrl, title, author: author || null, synopsis: synopsis || null,
        genres: unique(genres, 20), tags: unique(tags, 40), publicationStatus: publicationStatus || null,
        publicationYear, sourceLanguage, coverUrl,
        capturedAt: new Date().toISOString(),
        evidence: {
          fieldSources,
          jsonLdTypes: unique(graph.flatMap((node) => list(node?.['@type'], 10)), 20),
          documentTitle: clean(document.title, 500) || null
        }
      };
    }
  });
  const capture = injection?.result;
  if (!capture?.pageUrl || !capture?.title) throw new Error('현재 페이지에서 작품명과 작품 URL을 추출하지 못했습니다. 공식 작품 상세 페이지인지 확인하십시오.');
  return capture;
}

async function sendCaptureToPage(tabId, workflow) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', args: [{ pairingToken: workflow.pairing.token, workId: workflow.pairing.workId, capture: workflow.capture }],
    func: async (payload) => {
      const importer = window.__TXT_READER_METADATA_CAPTURE_HELPER_IMPORT;
      if (typeof importer !== 'function') return { ok: false, error: 'TXT Reader 작품 상세 페이지의 브라우저 캡처 import handler를 찾을 수 없습니다.' };
      try { return await importer(payload); }
      catch (error) { return { ok: false, error: error?.message || String(error) }; }
    }
  });
  const result = injection?.result;
  if (!result?.ok) throw new Error(result?.error || '브라우저 캡처 후보를 TXT Reader에 저장하지 못했습니다.');
  return result;
}

async function captureAndImportCurrent(tab, provider, detailTarget, workflow) {
  const capture = await extractCurrentPageMetadata(tab.id, provider, detailTarget);
  const nextWorkflow = { ...workflow, navigation:null, capture, providerId:provider.id, providerName:provider.name, capturedAt:new Date().toISOString() };
  await writeCaptureWorkflow(nextWorkflow);
  const readerTabId = Number(nextWorkflow.readerTabId || 0);
  if (readerTabId > 0) {
    try {
      const result = await sendCaptureToPage(readerTabId, nextWorkflow);
      await clearCaptureWorkflow();
      try { await chrome.tabs.update(readerTabId, { active:true }); } catch {}
      setFlowStage('import');
      setStatus(`${result.providerName || provider.name} 후보를 TXT Reader에 자동으로 저장했습니다.`);
      return { imported:true, result };
    } catch (error) {
      setStatus(`캡처는 완료했습니다. 자동 가져오기는 실패해 결과를 보관했습니다: ${error?.message || error}`, true);
    }
  }
  return { imported:false, capture };
}

function syncActionStackVisibility() {
  if (!actionStack) return;
  const hasVisibleAction = !importButton.hidden || !resetButton.classList.contains('hidden');
  actionStack.hidden = !hasVisibleAction;
}

function setAction(label, action) {
  const normalizedLabel = typeof label === 'string' ? label.trim() : '';
  importButton.textContent = normalizedLabel;
  importButton.hidden = !normalizedLabel;
  importButton.disabled = !action;
  currentAction = action || null;
  syncActionStackVisibility();
}

function showResetAction(show) {
  resetButton.classList.toggle('hidden', !show);
  syncActionStackVisibility();
}

async function refresh() {
  setAction(null, null);
  setFlowStage('pair');
  showResetAction(false);
  renderSummary();
  try {
    const tab = await activeTab();
    const context = await readPageContext(tab.id);
    let workflow = await readCaptureWorkflow();
    if (context?.capture?.workId && context.hasCaptureImporter) {
      if (Date.parse(context.capture.expiresAt) <= Date.now()) throw new Error('브라우저 캡처 pairing token이 만료되었습니다.');
      setFlowStage(workflow?.capture ? 'import' : 'pair');
      guideEl.textContent = '현재 작품과 provider 상세 페이지를 연결합니다. Cookie나 원본 HTML은 TXT Reader로 전송하지 않습니다.';
      renderSummary([['work', context.capture.workTitle], ['expires', context.capture.expiresAt], ['providers', context.capture.providers.map((item) => item.name).join(', ')]]);
      if (workflow?.capture && workflow.pairing?.token === context.capture.token) {
        setAction('캡처 결과를 TXT Reader로 가져오기', async () => {
          const result = await sendCaptureToPage(tab.id, workflow);
          await clearCaptureWorkflow();
          setStatus(`${result.providerName || 'provider'} 후보를 저장했습니다. TXT Reader에서 필드를 확인한 뒤 적용하십시오.`);
          await refresh();
        });
        showResetAction(true);
        setStatus('provider 페이지에서 캡처한 결과가 준비되었습니다.');
      } else {
        const startWorkflow = async () => {
          await writeCaptureWorkflow({ pairing:context.capture, capture:null, readerTabId:tab.id, startedAt:new Date().toISOString() });
          setFlowStage('capture');
          setStatus('작품 연결을 저장했습니다. provider 작품 상세 페이지를 연 뒤 확장 아이콘을 한 번 누르면 캡처와 가져오기가 자동 처리됩니다.');
        };
        setAction('작품 연결 다시 저장', startWorkflow);
        if (workflow) showResetAction(true);
        if (!autoActionStarted) { autoActionStarted = true; await startWorkflow(); }
      }
      return;
    }
    if (workflow) {
      let navigation = workflow.navigation || null;
      const recovered = recoverTargetFromAuthUrl(context?.href || '');
      if ((!navigation || navigation.tabId !== tab.id) && recovered) {
        const recoveredProvider = providerForId(workflow.pairing, recovered.providerId);
        if (recoveredProvider) {
          navigation = createNavigation(recoveredProvider, recovered.targetUrl, workflow.pairing.workTitle, tab.id, 'login');
          navigation.seenLoginAt = new Date().toISOString();
          navigation.recoveredFromAuthUrl = true;
          workflow = { ...workflow, navigation };
          await writeCaptureWorkflow(workflow);
        }
      }
      if (navigation && (!navigation.tabId || navigation.tabId === tab.id)
        && isAuthHost(navigation.providerId, context?.hostname || '')) {
        const authProvider = providerForId(workflow.pairing, navigation.providerId);
        showResetAction(true);
        guideEl.textContent = '로그인을 완료하면 원래 성인 작품 상세 페이지로 자동 복귀합니다. 자동 복귀하지 않을 때 아래 버튼을 사용하십시오.';
        renderSummary([
          ['work', workflow.pairing.workTitle],
          ['provider', authProvider?.name || navigation.providerName || navigation.providerId],
          ['stage', '로그인 진행 중'],
          ['target', navigation.targetTitle || workflow.pairing.workTitle],
          ['page', context?.hostname || '알 수 없음']
        ]);
        setAction('로그인 완료 후 작품 페이지로 돌아가기', async () => {
          await chrome.tabs.update(tab.id, { url:navigation.targetUrl });
          setStatus('저장된 작품 상세 페이지로 이동했습니다. 로그인이 완료되지 않았다면 로그인 화면이 다시 나타납니다.');
        });
        setStatus('현재 로그인 화면입니다. 계정 정보를 입력해 로그인을 완료하십시오. 확장 프로그램은 비밀번호나 로그인 폼 값을 읽지 않습니다.');
        return;
      }
      setFlowStage(workflow.capture ? 'import' : 'capture');
      const provider = providerForHost(workflow.pairing, context?.hostname || '');
      const detailTarget = provider ? resolveCaptureDetailTarget(provider, context) : null;
      showResetAction(true);
      guideEl.textContent = '로그인된 공식 작품 상세 페이지에서 정규화된 메타데이터만 캡처합니다.';
      renderSummary([['work', workflow.pairing.workTitle], ['provider', provider?.name || '지원되지 않는 host'], ['page', context?.hostname || '알 수 없음']]);
      if (!provider) {
        setAction(null, null);
        setStatus('현재 탭은 이 캡처 작업에서 지원하는 provider 페이지가 아닙니다.', true);
      } else if (!detailTarget) {
        const renderedCandidates = await findRenderedSearchCandidates(tab.id, provider, workflow.pairing.workTitle);
        const best = renderedCandidates[0] || null;
        if (best && best.score >= 0.42) {
          guideEl.textContent = '현재 브라우저가 렌더링한 검색 결과에서 작품 후보를 찾았습니다. Cookie나 원본 HTML은 전송하지 않고 공식 상세 페이지로만 이동합니다.';
          renderSummary([
            ['work', workflow.pairing.workTitle],
            ['provider', provider.name],
            ['candidate', best.title],
            ['match', `${Math.round(best.score * 100)}%`],
            ['author', best.author || '-'],
            ['access', best.ageRestricted ? `19세 제한 · ${best.coverAvailable ? '실제 표지 표시' : '표지 제한 상태'}` : '일반 작품']
          ]);
          setAction('일치 후보 상세 페이지 열기', async () => {
            const navigation = createNavigation(provider, best.url, best.title, tab.id);
            await writeCaptureWorkflow({ ...workflow, navigation });
            await chrome.tabs.update(tab.id, { url:best.url });
            setStatus(`${best.title} 상세 페이지로 이동했습니다. 로그인이 필요하면 Helper가 원래 상세 주소를 유지하고 로그인 완료 후 복귀시킵니다.`);
          });
          setStatus(`검색 결과에서 ${renderedCandidates.length}개 후보를 확인했습니다. 가장 가까운 후보를 상세 페이지에서 검증하십시오.`);
        } else {
          setAction(null, null);
          setStatus('현재 탭은 검색 결과 또는 홈 화면입니다. 일치하는 작품 후보를 찾지 못했습니다. 검색어를 조정한 뒤 다시 실행하십시오.', true);
        }
      } else {
        const kakaoGate = provider.id === 'builtin-kakaopage'
          ? await detectKakaoAgeGate(tab.id)
          : { detected:false, hasLoginButton:false };
        if (kakaoGate.detected) {
          const gateNavigation = navigation && navigation.targetUrl === detailTarget
            ? navigation
            : createNavigation(provider, detailTarget, workflow.pairing.workTitle, tab.id, 'age-gate');
          workflow = { ...workflow, navigation:{ ...gateNavigation, phase:'age-gate', gateDetectedAt:new Date().toISOString(), updatedAt:new Date().toISOString() } };
          await writeCaptureWorkflow(workflow);
          guideEl.textContent = '카카오페이지가 성인 작품 상세 정보 대신 연령 확인 안내를 표시했습니다. 로그인 단계를 거친 뒤 같은 작품으로 자동 복귀합니다.';
          renderSummary([
            ['work', workflow.pairing.workTitle],
            ['provider', provider.name],
            ['stage', '연령 확인 로그인 필요'],
            ['target', workflow.navigation.targetTitle || workflow.pairing.workTitle],
            ['page', context?.hostname || '알 수 없음']
          ]);
          setAction(kakaoGate.hasLoginButton ? '카카오 로그인 계속' : null, kakaoGate.hasLoginButton ? async () => {
            await writeCaptureWorkflow({ ...workflow, navigation:{ ...workflow.navigation, phase:'age-gate-continued', gateContinuedAt:new Date().toISOString(), updatedAt:new Date().toISOString() } });
            await continueKakaoAgeGate(tab.id);
            setStatus('카카오계정 로그인 화면으로 이동합니다. 로그인 후 원래 작품 상세 페이지로 자동 복귀합니다.');
          } : null);
          setStatus(kakaoGate.hasLoginButton
            ? '연령 확인 안내를 감지했습니다. 로그인 계속 버튼을 누르십시오.'
            : '연령 확인 안내는 감지했지만 로그인 버튼을 찾지 못했습니다. 페이지의 로그인 버튼을 직접 누르십시오.', !kakaoGate.hasLoginButton);
        } else {
          const runCapture = async () => {
            const outcome = await captureAndImportCurrent(tab, provider, detailTarget, workflow);
            if (!outcome.imported) await refresh();
          };
          setAction('캡처 후 TXT Reader로 자동 가져오기', runCapture);
          setStatus(workflow.capture ? '기존 캡처를 새 결과로 교체할 수 있습니다.' : '작품 상세 페이지를 확인했습니다. 캡처와 가져오기를 자동으로 시작합니다.');
          if (!workflow.capture && !autoActionStarted) { autoActionStarted = true; await runCapture(); }
        }
      }
      return;
    }
    guideEl.textContent = 'TXT Reader의 작품 상세 화면에서 브라우저 캡처 시작을 누른 뒤 이 창을 다시 여십시오.';
    setAction(null, null);
    setStatus('캡처 연결을 기다리고 있습니다. 연결되면 다음 단계가 자동으로 표시됩니다.');
  } catch (error) {
    setAction(null, null);
    setStatus(error?.message || String(error), true);
  }
}

importButton.addEventListener('click', async () => {
  if (!currentAction) return;
  importButton.disabled = true;
  setStatus('처리 중…');
  try { await currentAction(); }
  catch (error) { setStatus(error?.message || String(error), true); importButton.disabled = false; }
});

resetButton.addEventListener('click', async () => {
  await clearCaptureWorkflow();
  setStatus('브라우저 캡처 작업을 취소했습니다.');
  await refresh();
});

void Promise.all([refreshShortcutLabel(), refresh()]);
