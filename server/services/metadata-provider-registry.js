const {
  getMetadataSiteAdapter,
  listMetadataSiteAdapters,
  resolveMetadataSiteDirectTarget
} = require('./metadata-site-adapters');

const METADATA_PROVIDER_REGISTRY_PASS = 'v622-metadata-provider-security-pass';

const PROVIDERS = Object.freeze([
  {
    id:'builtin-ssn',
    adapterKey:'ssn-series-v1',
    name:'소설넷',
    priority:5,
    searchHosts:['ssn.so', 'www.ssn.so'],
    detailHosts:['ssn.so', 'www.ssn.so'],
    allowedPathPrefixes:['/series/'],
    coverHosts:['ssn.so', 'www.ssn.so', 'cdn1.munpia.com'],
    browserProfileSupported:false,
    supportsSearch:true,
    supportsDirect:true
  },
  {
    id:'builtin-naver-series',
    adapterKey:'naver-series-webnovel-v1',
    name:'네이버 시리즈',
    priority:10,
    searchHosts:['series.naver.com', 'm.series.naver.com'],
    detailHosts:['series.naver.com', 'm.series.naver.com'],
    allowedPathPrefixes:['/search/search.series', '/search/web/search.series', '/novel/detail.series'],
    coverHosts:['comicthumb-phinf.pstatic.net', 'bookthumb-phinf.pstatic.net', 'ssl.pstatic.net', 'phinf.pstatic.net'],
    browserProfileSupported:true,
    browserAuthHosts:['nid.naver.com'],
    browserResourceHostSuffixes:['naver.com','pstatic.net'],
    browserLoginPathPrefixes:['/nidlogin.login'],
    browserHomeUrl:'https://series.naver.com/',
    browserLoginUrl:'https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fseries.naver.com%2F',
    browserReadySelector:'a[href*="detail.series?productNo="], .lst_list, meta[property="og:title"]',
    loginUrl:'https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fseries.naver.com%2F',
    supportsSearch:true,
    supportsDirect:true
  },
  {
    id:'builtin-kakaopage',
    adapterKey:'kakaopage-webnovel-v1',
    name:'카카오페이지',
    priority:20,
    searchHosts:['bff-page.kakao.com'],
    detailHosts:['page.kakao.com', 'bff-page.kakao.com'],
    allowedPathPrefixes:['/api/gateway/api/v2/search/series', '/api/gateway/api/v1/content/', '/content/', '/search'],
    coverHosts:['page.kakao.com', 'dn-img-page.kakao.com', 'page-images.kakaoentcdn.com', 'k.kakaocdn.net', 't1.kakaocdn.net', 'kr-a.kakaopagecdn.com'],
    browserProfileSupported:true,
    browserAuthHosts:['accounts.kakao.com', 'kauth.kakao.com'],
    browserResourceHostSuffixes:['kakao.com','kakaocdn.net','kakaoentcdn.com','kakaopagecdn.com'],
    browserLoginPathPrefixes:['/relay/login'],
    browserHomeUrl:'https://page.kakao.com/',
    browserLoginUrl:'https://page.kakao.com/',
    browserReadySelector:'a[href^="/content/"], a[href*="/content/"], meta[property="og:title"]',
    loginUrl:'https://page.kakao.com/',
    supportsSearch:true,
    supportsDirect:true
  },
  {
    id:'builtin-novelpia',
    adapterKey:'novelpia-webnovel-v1',
    name:'노벨피아',
    priority:30,
    searchHosts:['novelpia.com', 'www.novelpia.com'],
    detailHosts:['novelpia.com', 'www.novelpia.com'],
    allowedPathPrefixes:['/proc/novel', '/novel/', '/search'],
    coverHosts:['images.novelpia.com', 'image.novelpia.com', 'novelpia.com', 'www.novelpia.com'],
    browserProfileSupported:true,
    browserAuthHosts:[],
    browserResourceHostSuffixes:['novelpia.com'],
    browserLoginPathPrefixes:['/page/login', '/myaccount/signin', '/login.html'],
    browserHomeUrl:'https://novelpia.com/',
    browserLoginUrl:'https://novelpia.com/page/login',
    browserReadySelector:'a[href^="/novel/"], a[href*="/novel/"], [class*="novel-title"], meta[property="og:title"]',
    browserVerificationHint:'로그인 후 노벨피아의 19세 작품 페이지를 직접 열고 본인·연령 인증과 성인 모드 ON을 완료하십시오. 실제 표지가 보이는 상태에서 프로필 저장을 누르십시오.',
    loginUrl:'https://novelpia.com/page/login',
    supportsSearch:true,
    supportsDirect:true
  },
  {
    id:'builtin-munpia',
    adapterKey:'munpia-webnovel-v1',
    name:'문피아',
    priority:40,
    searchHosts:['www.munpia.com', 'munpia.com', 'm.munpia.com', 'mm.munpia.com', 'novel.munpia.com'],
    detailHosts:['novel.munpia.com', 'www.munpia.com', 'm.munpia.com', 'mm.munpia.com'],
    allowedPathPrefixes:['/search', '/page/hd.platinum/view/search/', '/novel/detail/'],
    allowedPathPatterns:['^/\\d{3,}(?:/|$)'],
    coverHosts:['cdn1.munpia.com', 'cdn2.munpia.com', 'image.munpia.com', 'novel.munpia.com', 'www.munpia.com'],
    browserProfileSupported:true,
    browserAuthHosts:['nssl.munpia.com'],
    browserResourceHostSuffixes:['munpia.com'],
    browserLoginPathPrefixes:['/login', '/mobileLogin'],
    browserHomeUrl:'https://www.munpia.com/',
    browserLoginUrl:'https://nssl.munpia.com/login',
    browserReadySelector:'a[href*="/novel/detail/"], a[href^="https://novel.munpia.com/"], [class*="search-result"], [class*="novel-card"], meta[property="og:title"]',
    loginUrl:'https://nssl.munpia.com/login',
    supportsSearch:true,
    supportsDirect:true
  },
  {
    id:'builtin-joara',
    adapterKey:'joara-search-card-v1',
    name:'조아라',
    priority:50,
    searchHosts:['www.joara.com', 'joara.com'],
    detailHosts:['www.joara.com', 'joara.com'],
    allowedPathPrefixes:['/search', '/book/'],
    coverHosts:['cf-image.joara.com', 'www.joara.com', 'joara.com'],
    browserProfileSupported:true,
    browserAuthHosts:[],
    browserResourceHostSuffixes:['joara.com'],
    browserLoginPathPrefixes:['/login'],
    browserHomeUrl:'https://www.joara.com/',
    browserLoginUrl:'https://www.joara.com/login',
    browserReadySelector:'a[href^="/book/"], a[href*="/book/"], meta[property="og:title"]',
    loginUrl:'https://www.joara.com/login',
    supportsSearch:true,
    supportsDirect:true
  }
]);

const BY_ID = new Map(PROVIDERS.map(provider => [provider.id, Object.freeze({ ...provider })]));
const BY_ADAPTER = new Map(PROVIDERS.map(provider => [provider.adapterKey, Object.freeze({ ...provider })]));

function getMetadataProvider(providerId) {
  const provider = BY_ID.get(String(providerId || ''));
  if (!provider) return null;
  const adapter = getMetadataSiteAdapter(provider.adapterKey);
  return adapter ? { ...provider, adapter } : null;
}

function listMetadataProviders() {
  return PROVIDERS.map(provider => {
    const descriptor = listMetadataSiteAdapters().find(item => item.key === provider.adapterKey) || null;
    return {
      ...provider,
      revision:descriptor && descriptor.revision || 1,
      description:descriptor && descriptor.description || '',
      browserCaptureRecommended:provider.id === 'builtin-joara',
      pass:METADATA_PROVIDER_REGISTRY_PASS
    };
  });
}

function resolveDirectMetadataTarget(value) {
  const target = resolveMetadataSiteDirectTarget(String(value || ''));
  if (!target) return null;
  const provider = BY_ADAPTER.get(target.adapterKey);
  if (!provider) return null;
  return { ...target, providerId:provider.id, provider:getMetadataProvider(provider.id) };
}

function isHostAllowed(provider, hostname, kind = 'request') {
  const host = String(hostname || '').toLowerCase();
  if (!provider || !host) return false;
  const values = kind === 'cover'
    ? provider.coverHosts
    : Array.from(new Set([...(provider.searchHosts || []), ...(provider.detailHosts || [])]));
  return values.some(value => {
    const expected = String(value || '').toLowerCase();
    return host === expected || (expected.startsWith('.') && host.endsWith(expected));
  });
}

function isPathAllowed(provider, pathname) {
  const value = String(pathname || '/');
  if (!provider) return false;
  if ((provider.allowedPathPrefixes || []).some(prefix => value.startsWith(prefix))) return true;
  return (provider.allowedPathPatterns || []).some(pattern => {
    try { return new RegExp(pattern, 'u').test(value); } catch { return false; }
  });
}


module.exports = {
  METADATA_PROVIDER_REGISTRY_PASS,
  getMetadataProvider,
  listMetadataProviders,
  resolveDirectMetadataTarget,
  isHostAllowed,
  isPathAllowed
};
