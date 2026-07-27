'use strict';
(function initMetadataUrlPolicy(globalScope) {
  const AUTH_HOSTS = Object.freeze({
    'builtin-naver-series': Object.freeze(['nid.naver.com']),
    'builtin-kakaopage': Object.freeze(['accounts.kakao.com', 'kauth.kakao.com'])
  });

  function normalizeHttpsUrl(value, base = undefined) {
    try {
      const url = new URL(String(value || ''), base);
      if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
      url.hash = '';
      return url;
    } catch { return null; }
  }

  function canonicalDetailTarget(providerId, value) {
    const url = normalizeHttpsUrl(value);
    if (!url) return null;
    const host = url.hostname.toLowerCase();
    let remoteId = '';
    if (providerId === 'builtin-naver-series' && host === 'series.naver.com' && url.pathname === '/novel/detail.series') {
      remoteId = url.searchParams.get('productNo') || '';
      return /^\d{3,}$/u.test(remoteId) ? `https://series.naver.com/novel/detail.series?productNo=${remoteId}` : null;
    }
    if (providerId === 'builtin-kakaopage' && host === 'page.kakao.com') {
      remoteId = url.pathname.match(/^\/content\/(\d{3,})\/?$/u)?.[1] || '';
      return remoteId ? `https://page.kakao.com/content/${remoteId}` : null;
    }
    if (providerId === 'builtin-novelpia' && (host === 'novelpia.com' || host === 'www.novelpia.com')) {
      remoteId = url.pathname.match(/^\/novel\/(\d{3,})\/?$/u)?.[1] || '';
      return remoteId ? `https://novelpia.com/novel/${remoteId}` : null;
    }
    if (providerId === 'builtin-munpia') {
      if (host === 'novel.munpia.com') remoteId = url.pathname.match(/^\/(\d{3,})\/?$/u)?.[1] || '';
      else if (['www.munpia.com','munpia.com','m.munpia.com','mm.munpia.com'].includes(host)) remoteId = url.pathname.match(/^\/novel\/detail\/(\d{3,})\/?$/u)?.[1] || '';
      return remoteId ? `https://www.munpia.com/novel/detail/${remoteId}` : null;
    }
    if (providerId === 'builtin-joara' && (host === 'joara.com' || host === 'www.joara.com')) {
      remoteId = url.pathname.match(/^\/book\/(\d{3,})\/?$/u)?.[1] || '';
      return remoteId ? `https://www.joara.com/book/${remoteId}` : null;
    }
    if (providerId === 'builtin-ssn' && (host === 'ssn.so' || host === 'www.ssn.so')) {
      remoteId = url.pathname.match(/^\/series\/(\d{3,})\/?$/u)?.[1] || '';
      return remoteId && !url.search ? `https://ssn.so/series/${remoteId}/` : null;
    }
    return null;
  }

  function repeatedlyDecode(value, passes = 6) {
    let current = String(value || '');
    for (let index = 0; index < passes; index += 1) {
      let decoded = current;
      try { decoded = decodeURIComponent(current); } catch {}
      if (decoded === current) break;
      current = decoded;
    }
    return current;
  }

  function recoverTargetFromAuthUrl(value) {
    const decoded = repeatedlyDecode(value, 6);
    const naverMatch = decoded.match(/https:\/\/series\.naver\.com\/novel\/detail\.series\?[^\s"'<>]*?productNo=(\d{3,})/iu);
    if (naverMatch) return { providerId:'builtin-naver-series', targetUrl:`https://series.naver.com/novel/detail.series?productNo=${naverMatch[1]}` };
    const kakaoMatch = decoded.match(/https:\/\/page\.kakao\.com\/content\/(\d{3,})\/?/iu);
    if (kakaoMatch) return { providerId:'builtin-kakaopage', targetUrl:`https://page.kakao.com/content/${kakaoMatch[1]}` };
    return null;
  }

  function isAuthHost(providerId, hostname) {
    return (AUTH_HOSTS[providerId] || []).includes(String(hostname || '').toLowerCase());
  }

  globalScope.TxtReaderMetadataUrlPolicy = Object.freeze({
    PASS:'v641-extension-shared-url-policy-pass',
    AUTH_HOSTS,
    normalizeHttpsUrl,
    canonicalDetailTarget,
    repeatedlyDecode,
    recoverTargetFromAuthUrl,
    isAuthHost
  });
})(typeof self !== 'undefined' ? self : globalThis);
