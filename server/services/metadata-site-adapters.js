"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataTitleSimilarity = metadataTitleSimilarity;
exports.metadataCandidateMatchScore = metadataCandidateMatchScore;
exports.resolveMetadataSiteDirectTarget = resolveMetadataSiteDirectTarget;
exports.getMetadataSiteAdapter = getMetadataSiteAdapter;
exports.listMetadataSiteAdapters = listMetadataSiteAdapters;
exports.getMetadataSiteAdapterDescriptor = getMetadataSiteAdapterDescriptor;
const node_crypto_1 = require("node:crypto");
const METADATA_ADAPTER_CPU_GUARD_PASS = 'v672-metadata-adapter-cpu-guard-pass';
const NORMALIZE_CACHE_MAX = 2048;
const JSON_DOCUMENT_MAX_COUNT = 32;
const JSON_DOCUMENT_MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const normalizeCache = new Map();
const NAMED_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…'
};
function decodeHtmlEntities(value) {
    return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_match, entity) => {
        if (entity.startsWith('#x') || entity.startsWith('#X')) {
            const code = Number.parseInt(entity.slice(2), 16);
            return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
        }
        if (entity.startsWith('#')) {
            const code = Number.parseInt(entity.slice(1), 10);
            return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
        }
        return NAMED_ENTITIES[entity.toLowerCase()] ?? '';
    });
}
function cleanText(value, maximum = 5000) {
    if (typeof value !== 'string')
        return '';
    return decodeHtmlEntities(value)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maximum);
}
function normalizeMatchText(value) {
    const source = typeof value === 'string' ? value : String(value == null ? '' : value);
    if (source.length <= 1000 && normalizeCache.has(source)) {
        const cached = normalizeCache.get(source);
        normalizeCache.delete(source);
        normalizeCache.set(source, cached);
        return cached;
    }
    const normalized = source.normalize('NFKC').toLocaleLowerCase('ko-KR')
        .replace(/\.(?:txt|text)$/i, '')
        .replace(/[\[({<][^\])}>]{0,40}(?:완결|연재|웹소설|단행본|합본|개정판|19세|완전판|이용권|독점|선공개)[^\])}>]{0,40}[\])}>]/gi, ' ')
        .replace(/(?:^|\s)(?:완결|연재중?|웹소설|단행본|합본|외전|본편|개정판)(?:\s|$)/gi, ' ')
        .replace(/\b\d{1,5}\s*[-~–]\s*\d{1,5}\s*(?:화|편|권)/gi, ' ')
        .replace(/\b\d{1,5}\s*(?:화|편|권)/gi, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .trim();
    if (source.length <= 1000) {
        normalizeCache.set(source, normalized);
        while (normalizeCache.size > NORMALIZE_CACHE_MAX) normalizeCache.delete(normalizeCache.keys().next().value);
    }
    return normalized;
}
function bigramsNormalized(normalized) {
    if (normalized.length < 2)
        return normalized ? [normalized] : [];
    const output = new Array(Math.max(0, normalized.length - 1));
    for (let index = 0; index < normalized.length - 1; index += 1)
        output[index] = normalized.slice(index, index + 2);
    return output;
}
function diceSimilarityNormalized(left, right) {
    const a = bigramsNormalized(left);
    const b = bigramsNormalized(right);
    if (!a.length || !b.length)
        return 0;
    const counts = new Map();
    for (const item of a)
        counts.set(item, (counts.get(item) ?? 0) + 1);
    let intersection = 0;
    for (const item of b) {
        const count = counts.get(item) ?? 0;
        if (count <= 0)
            continue;
        counts.set(item, count - 1);
        intersection += 1;
    }
    return (2 * intersection) / (a.length + b.length);
}
function metadataTitleSimilarity(left, right) {
    const a = normalizeMatchText(left);
    const b = normalizeMatchText(right);
    if (!a || !b)
        return 0;
    if (a === b)
        return 1;
    const longer = Math.max(a.length, b.length);
    const shorter = Math.min(a.length, b.length);
    const containment = a.includes(b) || b.includes(a);
    const containmentScore = containment ? Math.max(0.76, Math.min(0.96, shorter / longer)) : 0;
    return Math.max(containmentScore, diceSimilarityNormalized(a, b));
}
function metadataCandidateMatchScore(expectedTitle, expectedAuthor, candidateTitle, candidateAuthor) {
    const titleScore = metadataTitleSimilarity(expectedTitle, candidateTitle);
    let score = titleScore * 0.9;
    if (expectedAuthor && candidateAuthor)
        score += metadataTitleSimilarity(expectedAuthor, candidateAuthor) * 0.1;
    else
        score += 0.05;
    return Math.max(0, Math.min(1, Math.round(score * 1000) / 1000));
}
function parseAttributes(source) {
    const attributes = {};
    for (const match of source.matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
        const key = (match[1] ?? '').toLowerCase();
        if (!key)
            continue;
        attributes[key] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '');
    }
    return attributes;
}
function metaMap(html) {
    const result = new Map();
    for (const match of html.matchAll(/<meta\b([^>]*)>/gi)) {
        const attributes = parseAttributes(match[1] ?? '');
        const key = (attributes.property ?? attributes.name ?? '').toLowerCase();
        const content = attributes.content ?? '';
        if (key && content && !result.has(key))
            result.set(key, content);
    }
    return result;
}
function jsonDocuments(html) {
    const documents = [];
    let parsedBytes = 0;
    const trimmed = html.trim();
    if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length <= JSON_DOCUMENT_MAX_TOTAL_BYTES) {
        try {
            documents.push(JSON.parse(trimmed));
            parsedBytes += Buffer.byteLength(trimmed, 'utf8');
        }
        catch { /* handled by caller when JSON is required */ }
    }
    if (documents.length >= JSON_DOCUMENT_MAX_COUNT || parsedBytes >= JSON_DOCUMENT_MAX_TOTAL_BYTES) return documents;
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (documents.length >= JSON_DOCUMENT_MAX_COUNT || parsedBytes >= JSON_DOCUMENT_MAX_TOTAL_BYTES) break;
        const attributes = parseAttributes(match[1] ?? '');
        const raw = (match[2] ?? '').trim();
        if (!raw || raw.length > 4 * 1024 * 1024)
            continue;
        const type = (attributes.type ?? '').toLowerCase();
        const likelyJson = type.includes('json') || attributes.id === '__NEXT_DATA__' || raw.startsWith('{') || raw.startsWith('[');
        if (!likelyJson)
            continue;
        const bytes = Buffer.byteLength(raw, 'utf8');
        if (parsedBytes + bytes > JSON_DOCUMENT_MAX_TOTAL_BYTES) break;
        try {
            documents.push(JSON.parse(raw));
            parsedBytes += bytes;
        }
        catch { /* ignored: unrelated inline script */ }
    }
    return documents;
}
function objectRecords(value, maximum = 20_000) {
    const limit = Math.max(1, Math.min(100_000, Number(maximum) || 20_000));
    const queueLimit = Math.max(limit, Math.min(400_000, limit * 4));
    const output = [];
    const queue = [value];
    let cursor = 0;
    const seen = new Set();
    while (cursor < queue.length && output.length < limit) {
        const current = queue[cursor++];
        if (!current || typeof current !== 'object')
            continue;
        if (seen.has(current))
            continue;
        seen.add(current);
        if (Array.isArray(current)) {
            for (let index = 0; index < current.length && queue.length < queueLimit; index += 1)
                queue.push(current[index]);
            continue;
        }
        const record = current;
        output.push(record);
        for (const key of Object.keys(record)) {
            if (queue.length >= queueLimit) break;
            queue.push(record[key]);
        }
    }
    return output;
}
function firstString(record, keys, maximum = 5000) {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string') {
            const text = cleanText(value, maximum);
            if (text)
                return text;
        }
        if (typeof value === 'number' && Number.isFinite(value))
            return String(value);
        if (Array.isArray(value)) {
            const joined = value.map((item) => {
                if (typeof item === 'string')
                    return cleanText(item, maximum);
                if (item && typeof item === 'object')
                    return firstString(item, ['name', 'title', 'label'], maximum);
                return '';
            }).filter(Boolean).join(', ');
            if (joined)
                return joined.slice(0, maximum);
        }
        if (value && typeof value === 'object') {
            const nested = firstString(value, ['name', 'title', 'label', 'text', 'value'], maximum);
            if (nested)
                return nested;
        }
    }
    return '';
}
function textList(value, maximumItems = 30) {
    const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,|>#/]/) : value ? [value] : [];
    const output = [];
    const seen = new Set();
    for (const item of items) {
        let text = '';
        if (typeof item === 'string')
            text = cleanText(item, 100);
        else if (item && typeof item === 'object')
            text = firstString(item, ['name', 'title', 'label', 'text'], 100);
        const normalized = text.replace(/^#/, '').trim();
        const key = normalized.toLocaleLowerCase('ko-KR');
        if (!normalized || seen.has(key))
            continue;
        seen.add(key);
        output.push(normalized);
        if (output.length >= maximumItems)
            break;
    }
    return output;
}
function firstList(record, keys) {
    for (const key of keys) {
        const list = textList(record[key]);
        if (list.length)
            return list;
    }
    return [];
}
function statusFrom(...values) {
    const text = values.map((value) => cleanText(typeof value === 'string' ? value : JSON.stringify(value ?? ''), 500)).join(' ').toLocaleLowerCase('ko-KR');
    if (/완결|\b(?:completed?|finished|ended)\b/.test(text))
        return 'completed';
    if (/휴재|hiatus|paused/.test(text))
        return 'hiatus';
    if (/연재|ongoing|serializing|serial/.test(text))
        return 'ongoing';
    return null;
}
function providerDocumentGate(html, providerName, options = {}) {
    const text = cleanText(String(html || ''), 60000);
    if (/captcha|recaptcha|cf-chl-|cloudflare\s*(?:ray|challenge)|자동화된\s*요청|비정상적인\s*접근|접근(?:이|을)?\s*제한|요청이\s*차단|잠시\s*후\s*다시\s*(?:시도|이용)/iu.test(text)) {
        throw Object.assign(new Error(`${providerName}가 자동화 요청 또는 접근을 제한했습니다.`), { code:options.blockCode || 'METADATA_PROVIDER_ACCESS_BLOCKED' });
    }
    if (/(?:성인|연령|본인)\s*(?:인증|확인).*?(?:필요|완료|진행|요구)|19세\s*이상.*?(?:이용|열람)|서비스 이용을 위해 연령 확인이 필요/iu.test(text)) {
        throw Object.assign(new Error(`${providerName} 성인·본인 인증이 필요합니다.`), { code:'METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED' });
    }
    if (/로그인\s*(?:후|이)\s*(?:이용|필요)|로그인이\s*필요|회원\s*로그인|nidlogin/iu.test(text) && !/property=["']og:title["']/iu.test(String(html || ''))) {
        throw Object.assign(new Error(`${providerName} 로그인이 필요합니다.`), { code:'METADATA_PLAYWRIGHT_LOGIN_REQUIRED' });
    }
}
function detailMetadataScore(item) {
    if (!item || typeof item !== 'object') return 0;
    return Number(Boolean(item.title)) * 3 + Number(Boolean(item.author)) * 2 + Number(Boolean(item.synopsis)) * 4
        + Math.min(3, (item.genres || []).length) + Math.min(3, (item.tags || []).length)
        + Number(Boolean(item.publicationStatus)) + Number(Boolean(item.publicationYear)) + Number(Boolean(item.coverUrl)) * 2;
}
function isDetailMetadataSufficient(item) {
    return detailMetadataScore(item) >= 9 && Boolean(item.title) && Boolean(item.synopsis || item.author);
}
function mergeDetailMetadata(items, overrides = {}) {
    const parsed = (Array.isArray(items) ? items : []).filter(Boolean).sort((a, b) => detailMetadataScore(b) - detailMetadataScore(a));
    if (!parsed.length) return null;
    const primary = parsed[0];
    const first = (key) => primary[key] || parsed.find((item) => item[key])?.[key] || null;
    const coverUrl = parsed.map((item) => item.coverUrl).find((value) => absoluteHttpsUrl(value || '', primary.sourceUrl || overrides.sourceUrl || 'https://example.invalid')) || null;
    return {
        ...primary,
        ...overrides,
        title:first('title'),
        author:first('author'),
        synopsis:first('synopsis'),
        genres:mergeUniqueText(...parsed.map((item) => item.genres || [])),
        tags:mergeUniqueText(...parsed.map((item) => item.tags || [])),
        publicationStatus:first('publicationStatus'),
        publicationYear:first('publicationYear'),
        sourceLanguage:first('sourceLanguage') || 'ko',
        coverUrl,
        rawSha256:(0, node_crypto_1.createHash)('sha256').update(parsed.map((item) => item.rawSha256 || '').join('\n')).digest('hex')
    };
}
function parseDetailDocumentList(adapter, documents, sourceUrl, remoteId, descriptionMax, canonicalSource) {
    const parsed = [];
    for (const document of Array.isArray(documents) ? documents : []) {
        const item = adapter.parseDetail(document.body, document.finalUrl || document.requestUrl || sourceUrl, descriptionMax);
        if (item) parsed.push(item);
    }
    return mergeDetailMetadata(parsed, {
        remoteId:String(remoteId || parsed[0]?.remoteId || ''),
        sourceUrl:canonicalSource || parsed[0]?.sourceUrl || sourceUrl
    });
}
function shouldFetchDetailFallbackFor(adapter, documents, sourceUrl, remoteId, descriptionMax) {
    const first = Array.isArray(documents) && documents.length ? documents[0] : null;
    if (!first) return true;
    try {
        return !isDetailMetadataSufficient(adapter.parseDetail(first.body, first.finalUrl || first.requestUrl || sourceUrl, descriptionMax));
    } catch (error) {
        if (error && ['METADATA_PLAYWRIGHT_LOGIN_REQUIRED','METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED','METADATA_PROVIDER_ACCESS_BLOCKED','METADATA_MUNPIA_ACCESS_BLOCKED'].includes(error.code)) throw error;
        return true;
    }
}
function absoluteHttpsUrl(value, baseUrl) {
    if (!value)
        return null;
    try {
        const url = new URL(value, baseUrl);
        return url.protocol === 'https:' ? url.toString() : null;
    }
    catch {
        return null;
    }
}
function strictHttpsUrl(value) {
    if (typeof value !== 'string' || value.trim().length < 8 || value.trim().length > 2000)
        return null;
    try {
        const url = new URL(value.trim());
        if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || url.hash)
            return null;
        return url;
    }
    catch {
        return null;
    }
}
function hasOnlySearchParams(url, allowed) {
    for (const key of url.searchParams.keys())
        if (!allowed.has(key))
            return false;
    return true;
}
function resolveDirectTarget(value) {
    const url = strictHttpsUrl(value);
    if (!url)
        return null;
    const host = url.hostname.toLowerCase();
    if (new Set(['series.naver.com','m.series.naver.com']).has(host) && url.pathname === '/novel/detail.series'
        && hasOnlySearchParams(url, new Set(['productNo'])) && url.searchParams.getAll('productNo').length === 1) {
        const remoteId = url.searchParams.get('productNo') ?? '';
        if (/^\d{3,}$/u.test(remoteId))
            return {
                adapterKey: 'naver-series-webnovel-v1', remoteId,
                canonicalUrl: `https://series.naver.com/novel/detail.series?productNo=${remoteId}`
            };
        return null;
    }
    if (host === 'page.kakao.com' && hasOnlySearchParams(url, new Set(['tab_type']))) {
        const match = url.pathname.match(/^\/content\/(\d{3,})\/?$/u);
        const tabTypes = url.searchParams.getAll('tab_type');
        if (match?.[1] && tabTypes.length <= 1 && (!tabTypes.length || /^(?:about|episode|home)$/u.test(tabTypes[0] ?? ''))) {
            return { adapterKey: 'kakaopage-webnovel-v1', remoteId: match[1], canonicalUrl: `https://page.kakao.com/content/${match[1]}` };
        }
        return null;
    }
    if (!url.search && host === 'novel.munpia.com' && /^\/(\d{3,})\/?$/u.test(url.pathname)) {
        const remoteId = url.pathname.match(/^\/(\d{3,})\/?$/u)?.[1] ?? '';
        return { adapterKey: 'munpia-webnovel-v1', remoteId, canonicalUrl: `https://www.munpia.com/novel/detail/${remoteId}` };
    }
    if (!url.search && new Set(['www.munpia.com','munpia.com','m.munpia.com','mm.munpia.com']).has(host) && /^\/novel\/detail\/(\d{3,})\/?$/u.test(url.pathname)) {
        const remoteId = url.pathname.match(/^\/novel\/detail\/(\d{3,})\/?$/u)?.[1] ?? '';
        return { adapterKey: 'munpia-webnovel-v1', remoteId, canonicalUrl: `https://www.munpia.com/novel/detail/${remoteId}` };
    }
    if (host === 'mm.munpia.com' && /^\d{3,}$/u.test(url.searchParams.get('id') ?? '') && /novel/iu.test(url.searchParams.get('menu') ?? '')) {
        const remoteId = url.searchParams.get('id') ?? '';
        return { adapterKey: 'munpia-webnovel-v1', remoteId, canonicalUrl: `https://www.munpia.com/novel/detail/${remoteId}` };
    }
    if ((host === 'novelpia.com' || host === 'www.novelpia.com') && !url.search && /^\/novel\/(\d{3,})\/?$/u.test(url.pathname)) {
        const remoteId = url.pathname.match(/^\/novel\/(\d{3,})\/?$/u)?.[1] ?? '';
        return { adapterKey: 'novelpia-webnovel-v1', remoteId, canonicalUrl: `https://novelpia.com/novel/${remoteId}` };
    }
    if ((host === 'joara.com' || host === 'www.joara.com') && !url.search && /^\/book\/(\d{3,})\/?$/u.test(url.pathname)) {
        const remoteId = url.pathname.match(/^\/book\/(\d{3,})\/?$/u)?.[1] ?? '';
        return { adapterKey: 'joara-search-card-v1', remoteId, canonicalUrl: `https://www.joara.com/book/${remoteId}` };
    }
    if ((host === 'ssn.so' || host === 'www.ssn.so') && !url.search && /^\/series\/(\d{3,})\/?$/u.test(url.pathname)) {
        const remoteId = url.pathname.match(/^\/series\/(\d{3,})\/?$/u)?.[1] ?? '';
        return { adapterKey: 'ssn-series-v1', remoteId, canonicalUrl: `https://ssn.so/series/${remoteId}/` };
    }
    return null;
}
function resolveMetadataSiteDirectTarget(value) {
    return resolveDirectTarget(value);
}
function contentIdFromUrl(value) {
    try {
        const match = new URL(value).pathname.match(/^\/content\/(\d{3,})/);
        return match?.[1] ?? null;
    }
    catch {
        return null;
    }
}
function contentUrlFromRecord(record, baseUrl) {
    const direct = firstString(record, ['contentUrl', 'landingUrl', 'webUrl', 'url', 'link'], 1000);
    if (direct) {
        const absolute = absoluteHttpsUrl(direct, baseUrl);
        const id = absolute ? contentIdFromUrl(absolute) : null;
        if (absolute && id)
            return { url: absolute, id };
    }
    const idText = firstString(record, ['seriesId', 'series_id', 'contentId', 'content_id', 'productId', 'product_id'], 100);
    if (/^\d{3,}$/.test(idText))
        return { url: `https://page.kakao.com/content/${idText}`, id: idText };
    return null;
}
function isWebNovelRecord(record) {
    const categoryUid = firstString(record, ['categoryUid', 'category_uid', 'categoryId', 'category_id'], 30);
    if (categoryUid && /^\d+$/.test(categoryUid) && categoryUid !== '11')
        return false;
    const type = firstString(record, ['categoryName', 'category', 'subcategoryName', 'subCategoryName', 'sub_category', 'contentType', 'productType', 'serviceType'], 200);
    if (!type)
        return true;
    if (/웹툰|comic|webtoon/i.test(type))
        return false;
    return /웹소설|소설|novel|fiction/i.test(type) || !/(도서|책|book)/i.test(type);
}
function extractClassText(html, classPattern) {
    for (const match of html.matchAll(/<([a-z0-9]+)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
        const attributes = parseAttributes(match[2] ?? '');
        const className = attributes.class ?? '';
        if (!classPattern.test(className))
            continue;
        const text = cleanText(match[3] ?? '', 300);
        if (text)
            return text;
    }
    return '';
}
function extractTagClassText(html, tagName, classPattern) {
    const escaped = tagName.replace(/[^a-z0-9]/gi, '');
    if (!escaped)
        return '';
    const pattern = new RegExp(`<${escaped}\\b([^>]*)>([\\s\\S]*?)<\\/${escaped}>`, 'gi');
    for (const match of html.matchAll(pattern)) {
        const attributes = parseAttributes(match[1] ?? '');
        if (!classPattern.test(attributes.class ?? ''))
            continue;
        const text = cleanText(match[2] ?? '', 300);
        if (text)
            return text;
    }
    return '';
}
function firstDescendantAttribute(html, attributeName) {
    const expected = attributeName.toLowerCase();
    for (const match of html.matchAll(/<[a-z0-9]+\b([^>]*)>/gi)) {
        const attributes = parseAttributes(match[1] ?? '');
        const value = attributes[expected] ?? '';
        if (value)
            return value;
    }
    return '';
}
function parseKakaoSearchAriaLabel(value) {
    const parts = decodeHtmlEntities(value).split(',').map((part) => cleanText(part, 300)).filter(Boolean);
    if (parts[0] !== '작품')
        return { title: '', author: null, isWebNovel: null };
    const title = parts[1] ?? '';
    const authorPart = parts.find((part) => /^작가\s+/u.test(part)) ?? '';
    const isWebNovel = parts.some((part) => /^(?:웹소설|소설)$/u.test(part))
        ? true
        : parts.some((part) => /^(?:웹툰|만화)$/u.test(part)) ? false : null;
    return {
        title: cleanKakaoTitle(title),
        author: cleanText(authorPart.replace(/^작가\s+/u, ''), 300) || null,
        isWebNovel
    };
}
function visibleBodyText(html, maximum = 100_000) {
    const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
    return cleanText(body.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' '), maximum);
}
function splitKakaoDescription(value, maximum) {
    const decoded = decodeHtmlEntities(value)
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<\/p\s*>/gi, '\n');
    const marker = decoded.search(/\*{0,2}\s*키워드\s*(?=#)/iu);
    const synopsisSource = marker >= 0 ? decoded.slice(0, marker) : decoded;
    const tagSource = marker >= 0 ? decoded.slice(marker) : '';
    const tags = [];
    const seen = new Set();
    for (const match of tagSource.matchAll(/#\s*([^#\s]+(?:\s+(?!#)[^#\s]+)*)/gu)) {
        const tag = cleanText(match[1] ?? '', 100).trim();
        const key = tag.toLocaleLowerCase('ko-KR');
        if (!tag || seen.has(key))
            continue;
        seen.add(key);
        tags.push(tag);
        if (tags.length >= 30)
            break;
    }
    return { synopsis: cleanText(synopsisSource, maximum) || null, tags };
}
function mergeUniqueText(...groups) {
    const output = [];
    const seen = new Set();
    for (const group of groups) {
        for (const value of group) {
            const text = cleanText(value, 100).trim();
            const key = text.toLocaleLowerCase('ko-KR');
            if (!text || seen.has(key))
                continue;
            seen.add(key);
            output.push(text);
            if (output.length >= 30)
                return output;
        }
    }
    return output;
}
function cleanKakaoTitle(value) {
    return cleanText(value, 300)
        .replace(/\s*[-|·:]\s*(?:웹소설\s*\|\s*)?카카오페이지.*$/i, '')
        .replace(/\s*[-|·:]\s*웹소설.*$/i, '')
        .trim();
}
function candidateFromRecord(record, baseUrl) {
    const location = contentUrlFromRecord(record, baseUrl);
    if (!location || !isWebNovelRecord(record))
        return null;
    const title = cleanKakaoTitle(firstString(record, ['contentTitle', 'seriesTitle', 'productName', 'title', 'name'], 300));
    if (title.length < 2)
        return null;
    const author = firstString(record, ['authorName', 'writerName', 'author', 'writer', 'creator', 'creators', 'authors'], 300) || null;
    return { remoteId: location.id, sourceUrl: location.url, title, author };
}
function recordValue(record, key) {
    const value = record[key];
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function kakaoGraphqlCandidates(document) {
    const output = new Map();
    for (const record of objectRecords(document)) {
        const eventLog = recordValue(record, 'eventLog');
        const eventMeta = eventLog ? recordValue(eventLog, 'eventMeta') : null;
        const remoteId = firstString(record, ['seriesId'], 100)
            || (eventMeta ? firstString(eventMeta, ['series_id', 'seriesId', 'id'], 100) : '');
        if (!/^\d{3,}$/u.test(remoteId))
            continue;
        const category = eventMeta ? firstString(eventMeta, ['category', 'categoryName'], 100) : '';
        const type = eventMeta ? firstString(eventMeta, ['type'], 100) : '';
        if (/웹툰|만화|comic|webtoon/iu.test(category) || (type && !/seriesId/iu.test(type)))
            continue;
        if (category && !/웹소설|소설|novel/iu.test(category))
            continue;
        const title = cleanKakaoTitle(firstString(record, ['row1', 'contentTitle', 'seriesTitle', 'title'], 300)
            || (eventMeta ? firstString(eventMeta, ['name', 'series'], 300) : ''));
        if (title.length < 2)
            continue;
        const row2 = textList(record.row2, 10);
        const author = cleanText(row2.length > 1 ? row2[row2.length - 1] : row2[0] ?? '', 300)
            || (eventMeta ? firstString(eventMeta, ['author', 'writer'], 300) : '')
            || null;
        output.set(remoteId, {
            remoteId,
            sourceUrl: `https://page.kakao.com/content/${remoteId}`,
            title,
            author
        });
    }
    return [...output.values()];
}
function novelpiaApiCandidates(document) {
    if (document && typeof document === 'object' && !Array.isArray(document)) {
        const root = document;
        const statusValue = root.status;
        const status = typeof statusValue === 'number' ? statusValue : Number.parseInt(String(statusValue ?? ''), 10);
        if (Number.isFinite(status) && status !== 200) {
            const message = cleanText(firstString(root, ['errmsg', 'message', 'error', 'code'], 500), 500) || `NovelPia search status ${status}`;
            const error = new Error(message);
            if (/성인\s*(?:인증|확인)|연령\s*(?:인증|확인)|본인\s*인증|19세\s*(?:이상|미만)|청소년\s*이용불가/iu.test(message))
                error.code = 'METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED';
            else if (/로그인|회원\s*인증/iu.test(message))
                error.code = 'METADATA_PLAYWRIGHT_LOGIN_REQUIRED';
            throw error;
        }
    }
    const output = new Map();
    for (const record of objectRecords(document)) {
        const remoteId = firstString(record, ['novel_no', 'novelNo'], 100);
        if (!/^\d{3,}$/u.test(remoteId))
            continue;
        const title = cleanNovelpiaTitle(firstString(record, ['novel_name', 'novelName', 'novel_title', 'title'], 300));
        if (title.length < 2)
            continue;
        const author = cleanText(firstString(record, ['writer_nick', 'writerNick', 'author', 'author_name'], 300), 300) || null;
        output.set(remoteId, {
            remoteId,
            sourceUrl: `https://novelpia.com/novel/${remoteId}`,
            title,
            author
        });
    }
    return [...output.values()];
}
function decodeJavascriptStringLiterals(value) {
    const output = [];
    for (const match of value.matchAll(/"(?:\\.|[^"\\])*"/g)) {
        const literal = match[0] ?? '';
        if (literal.length < 4 || literal.length > 2_000_000)
            continue;
        try {
            const decoded = JSON.parse(literal);
            if (typeof decoded === 'string' && decoded.length >= 3)
                output.push(decoded);
        }
        catch { /* ignored: not a complete JavaScript string literal */ }
    }
    return output;
}
function nearestSerializedString(source, center, keys) {
    let best = null;
    const keyPattern = keys.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const pattern = new RegExp(`(?:"|\\\\")?(?:${keyPattern})(?:"|\\\\")?\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`, 'giu');
    for (const match of source.matchAll(pattern)) {
        const raw = match[1] ?? '';
        let value = '';
        try {
            value = JSON.parse(raw);
        }
        catch {
            continue;
        }
        value = cleanText(value, 5000);
        if (!value)
            continue;
        const distance = Math.abs((match.index ?? 0) - center);
        if (!best || distance < best.distance)
            best = { distance, value };
    }
    return best?.value ?? '';
}
function nearestSerializedNumber(source, center, keys) {
    let best = null;
    const keyPattern = keys.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const pattern = new RegExp(`(?:"|\\\\")?(?:${keyPattern})(?:"|\\\\")?\\s*:\\s*(?:"|\\\\")?(\\d+)`, 'giu');
    for (const match of source.matchAll(pattern)) {
        const value = match[1] ?? '';
        if (!value)
            continue;
        const distance = Math.abs((match.index ?? 0) - center);
        if (!best || distance < best.distance)
            best = { distance, value };
    }
    return best?.value ?? '';
}
function kakaoSerializedCandidates(html, baseUrl, terms) {
    const sources = [html];
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        const raw = match[1] ?? '';
        if (!raw || raw.length > 4 * 1024 * 1024)
            continue;
        sources.push(...decodeJavascriptStringLiterals(raw));
    }
    const output = new Map();
    for (const original of sources) {
        const source = decodeHtmlEntities(original).replace(/\\\//g, '/');
        const explicitlyNonNovelIds = new Set();
        for (const document of jsonDocuments(source)) {
            for (const record of objectRecords(document)) {
                const remoteId = firstString(record, ['seriesId', 'series_id', 'contentId', 'content_id', 'productId', 'product_id'], 100);
                if (/^\d{3,}$/u.test(remoteId) && !isWebNovelRecord(record))
                    explicitlyNonNovelIds.add(remoteId);
            }
        }
        const idMatches = [
            ...source.matchAll(/(?:"|\\")?(?:seriesId|contentId|productId)(?:"|\\")?\s*:\s*(?:"|\\")?(\d{3,})/gi),
            ...source.matchAll(/\/content\/(\d{3,})/gi)
        ];
        for (const idMatch of idMatches) {
            const remoteId = idMatch[1] ?? '';
            if (!remoteId || explicitlyNonNovelIds.has(remoteId))
                continue;
            const center = idMatch.index ?? 0;
            const start = Math.max(0, center - 3500);
            const end = Math.min(source.length, center + 3500);
            const window = source.slice(start, end);
            const localCenter = center - start;
            const categoryUid = nearestSerializedNumber(window, localCenter, ['categoryUid', 'category_uid', 'categoryId', 'category_id']);
            const contentType = nearestSerializedString(window, localCenter, [
                'categoryName', 'subcategoryName', 'subCategoryName', 'contentType', 'productType', 'serviceType'
            ]);
            if ((categoryUid && categoryUid !== '11') || /웹툰|comic|webtoon/iu.test(contentType))
                continue;
            const title = cleanKakaoTitle(nearestSerializedString(window, localCenter, [
                'contentTitle', 'seriesTitle', 'productName', 'title', 'name'
            ]));
            if (title.length < 2 || metadataTitleSimilarity(terms.title, title) < 0.35)
                continue;
            const author = cleanText(nearestSerializedString(window, localCenter, [
                'authorName', 'writerName', 'author', 'writer', 'creatorName'
            ]), 300) || null;
            const candidate = { remoteId, sourceUrl: `https://page.kakao.com/content/${remoteId}`, title, author };
            const existing = output.get(remoteId);
            if (!existing || (!existing.author && author))
                output.set(remoteId, candidate);
        }
    }
    return [...output.values()];
}
function kakaoRenderedEventCandidates(html, baseUrl) {
    const output = new Map();
    const tagPattern = /<[a-z0-9]+\b([^>]*)>/gi;
    const matches = [...html.matchAll(tagPattern)];
    for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index];
        if (!match)
            continue;
        const attributes = parseAttributes(match[1] ?? '');
        const rawTracking = attributes['data-t-obj'] ?? '';
        if (!rawTracking || rawTracking.length > 20_000 || !rawTracking.includes('eventMeta'))
            continue;
        let tracking;
        try {
            tracking = JSON.parse(rawTracking);
        }
        catch {
            continue;
        }
        const eventMeta = tracking.eventMeta;
        if (!eventMeta || typeof eventMeta !== 'object' || Array.isArray(eventMeta))
            continue;
        const record = eventMeta;
        const remoteId = firstString(record, ['series_id', 'seriesId', 'id'], 100);
        if (!/^\d{3,}$/u.test(remoteId))
            continue;
        const category = firstString(record, ['category', 'categoryName', 'contentType'], 100);
        const type = firstString(record, ['type'], 100);
        if (/웹툰|comic|webtoon/iu.test(category) || (type && !/seriesId/iu.test(type)))
            continue;
        if (category && !/웹소설|소설|novel/iu.test(category))
            continue;
        const title = cleanKakaoTitle(firstString(record, ['name', 'series', 'title'], 300));
        if (title.length < 2)
            continue;
        const start = (match.index ?? 0) + (match[0]?.length ?? 0);
        const end = Math.min(html.length, start + 5000);
        const window = html.slice(start, end);
        let sourceUrl = `https://page.kakao.com/content/${remoteId}`;
        const hrefMatch = window.match(/<a\b([^>]*)>/i);
        if (hrefMatch) {
            const href = parseAttributes(hrefMatch[1] ?? '').href ?? '';
            const absolute = absoluteHttpsUrl(href, baseUrl);
            if (absolute && contentIdFromUrl(absolute) === remoteId)
                sourceUrl = absolute;
        }
        const ariaMatch = window.match(/aria-label\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
        const aria = parseKakaoSearchAriaLabel(ariaMatch?.[1] ?? ariaMatch?.[2] ?? '');
        if (aria.isWebNovel === false)
            continue;
        const author = aria.author;
        output.set(remoteId, { remoteId, sourceUrl, title, author });
    }
    return [...output.values()];
}
function anchorCandidates(html, baseUrl) {
    const output = [];
    for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
        const attributes = parseAttributes(match[1] ?? '');
        const absolute = absoluteHttpsUrl(attributes.href ?? '', baseUrl);
        const id = absolute ? contentIdFromUrl(absolute) : null;
        if (!absolute || !id)
            continue;
        const inner = match[2] ?? '';
        const descendantAria = firstDescendantAttribute(inner, 'aria-label');
        const aria = parseKakaoSearchAriaLabel(attributes['aria-label'] ?? descendantAria);
        if (aria.isWebNovel === false)
            continue;
        const title = cleanKakaoTitle(attributes['data-title'] ??
            extractTagClassText(inner, 'span', /font-medium2(?=[^"']*line-clamp-2)|line-clamp-2(?=[^"']*font-medium2)/i) ??
            aria.title) || aria.title || cleanKakaoTitle(cleanText(inner, 300));
        if (title.length < 2)
            continue;
        const author = cleanText(attributes['data-author'] ??
            aria.author ??
            extractTagClassText(inner, 'span', /(?:^|[-_\s])(author|writer|creator)(?:$|[-_\s])/i), 300) || null;
        output.push({ remoteId: id, sourceUrl: absolute, title, author });
    }
    return output;
}
function kakaoVisibleTags(html) {
    const output = [];
    const seen = new Set();
    for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
        const attributes = parseAttributes(match[1] ?? '');
        if (!/(?:\/search\/themekeyword\/|filterList=)/iu.test(attributes.href ?? ''))
            continue;
        const tag = cleanText(match[2] ?? '', 100).replace(/^#+/u, '').trim();
        const key = tag.toLocaleLowerCase('ko-KR');
        if (!tag || seen.has(key))
            continue;
        seen.add(key);
        output.push(tag);
        if (output.length >= 30)
            break;
    }
    return output;
}
function dedupeAndRank(candidates, terms, limit) {
    const byId = new Map();
    for (const candidate of candidates) {
        const existing = byId.get(candidate.remoteId);
        if (!existing || (!existing.author && candidate.author) || candidate.title.length < existing.title.length)
            byId.set(candidate.remoteId, candidate);
    }
    return [...byId.values()]
        .map((candidate) => ({ ...candidate, matchScore: metadataCandidateMatchScore(terms.title, terms.author, candidate.title, candidate.author) }))
        .filter((candidate) => candidate.matchScore >= 0.22)
        .sort((left, right) => right.matchScore - left.matchScore || left.title.localeCompare(right.title, 'ko-KR') || left.remoteId.localeCompare(right.remoteId))
        .slice(0, Math.max(1, Math.min(20, Math.trunc(limit))));
}
function bestDetailRecord(html, contentId) {
    let best = null;
    for (const document of jsonDocuments(html)) {
        for (const record of objectRecords(document)) {
            const location = contentUrlFromRecord(record, 'https://page.kakao.com');
            if (contentId && location?.id !== contentId)
                continue;
            const title = firstString(record, ['contentTitle', 'seriesTitle', 'productName', 'title', 'name'], 300);
            const author = firstString(record, ['authorName', 'writerName', 'author', 'writer', 'creator', 'creators', 'authors'], 300);
            const synopsis = firstString(record, ['synopsis', 'description', 'summary', 'introduction', 'intro', 'storySummary', 'plot'], 5000);
            const genres = firstList(record, ['genres', 'genre', 'subcategoryName', 'subCategoryName', 'categoryName']);
            let score = 0;
            if (location?.id && contentId && location.id === contentId)
                score += 8;
            else if (location?.id)
                score += 2;
            if (title)
                score += 3;
            if (author)
                score += 1;
            if (synopsis)
                score += 2;
            if (genres.length)
                score += 1;
            if (!isWebNovelRecord(record))
                score -= 6;
            if (!best || score > best.score)
                best = { score, record };
        }
    }
    return best && best.score >= 4 ? best.record : null;
}
function firstImage(record, baseUrl) {
    for (const key of ['coverImageUrl', 'thumbnailUrl', 'imageUrl', 'coverImage', 'thumbnail', 'image']) {
        const value = record[key];
        if (typeof value === 'string') {
            const url = absoluteHttpsUrl(value, baseUrl);
            if (url)
                return url;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                if (typeof item === 'string') {
                    const url = absoluteHttpsUrl(item, baseUrl);
                    if (url)
                        return url;
                }
                if (item && typeof item === 'object') {
                    const nested = firstString(item, ['url', 'imageUrl', 'src'], 1000);
                    const url = absoluteHttpsUrl(nested, baseUrl);
                    if (url)
                        return url;
                }
            }
        }
        if (value && typeof value === 'object') {
            const nested = firstString(value, ['url', 'imageUrl', 'src'], 1000);
            const url = absoluteHttpsUrl(nested, baseUrl);
            if (url)
                return url;
        }
    }
    return null;
}
function normalizeGenres(values) {
    return values.filter((value) => !/^(?:웹소설|소설|novel)$/i.test(value)).slice(0, 30);
}
function elementInnersByClass(html, tagName, className, maximum = 100) {
    const escaped = tagName.replace(/[^a-z0-9]/gi, '');
    if (!escaped)
        return [];
    const output = [];
    const pattern = new RegExp(`<${escaped}\\b([^>]*)>([\\s\\S]*?)<\\/${escaped}>`, 'gi');
    for (const match of html.matchAll(pattern)) {
        const attributes = parseAttributes(match[1] ?? '');
        const classes = new Set((attributes.class ?? '').split(/\s+/).filter(Boolean));
        if (!classes.has(className))
            continue;
        output.push(match[2] ?? '');
        if (output.length >= maximum)
            break;
    }
    return output;
}
function canonicalLink(html, baseUrl) {
    for (const match of html.matchAll(/<link\b([^>]*)>/gi)) {
        const attributes = parseAttributes(match[1] ?? '');
        const rel = (attributes.rel ?? '').toLowerCase().split(/\s+/);
        if (!rel.includes('canonical'))
            continue;
        const value = absoluteHttpsUrl(attributes.href ?? '', baseUrl);
        if (value)
            return value;
    }
    return null;
}
function naverSeriesProductNo(value) {
    try {
        const url = new URL(value);
        if (!new Set(['series.naver.com','m.series.naver.com']).has(url.hostname.toLowerCase()) || url.pathname !== '/novel/detail.series')
            return null;
        const productNo = url.searchParams.get('productNo') ?? '';
        return /^\d{3,}$/.test(productNo) ? productNo : null;
    }
    catch {
        return null;
    }
}
function cleanNaverSeriesTitle(value) {
    return cleanText(value, 300)
        .replace(/\s*\(\s*총\s*\d+\s*(?:화|편|권)\s*\/\s*(?:완결|연재중?|미완결)\s*\)\s*$/iu, '')
        .replace(/\s*[-|·:]\s*네이버\s*시리즈.*$/iu, '')
        .trim();
}
function naverSeriesSearchCandidates(html, baseUrl) {
    const output = [];
    const byId = new Map();
    const add = (absolute, titleValue, authorValue = '') => {
        const productNo = absolute ? naverSeriesProductNo(absolute) : null;
        const title = cleanNaverSeriesTitle(titleValue || '');
        if (!productNo || title.length < 2) return;
        const candidate = {
            remoteId:productNo,
            sourceUrl:`https://series.naver.com/novel/detail.series?productNo=${productNo}`,
            title,
            author:cleanText(authorValue || '', 300) || null
        };
        const previous = byId.get(productNo);
        if (!previous || (!previous.author && candidate.author)) byId.set(productNo, candidate);
    };
    const list = elementInnersByClass(html, 'ul', 'lst_list', 1)[0] ?? '';
    for (const match of list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
        const block = match[1] ?? '';
        const titleAnchor = block.match(/<h3\b[^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i);
        if (!titleAnchor) continue;
        const attributes = parseAttributes(titleAnchor[1] ?? '');
        const absolute = absoluteHttpsUrl(attributes.href ?? '', baseUrl);
        const author = block.match(/<span\b[^>]*class\s*=\s*(?:"[^"]*\bauthor\b[^"]*"|'[^']*\bauthor\b[^']*')[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '';
        add(absolute, titleAnchor[2] ?? '', author);
    }
    for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
        const attributes = parseAttributes(match[1] ?? '');
        const absolute = absoluteHttpsUrl(attributes.href ?? attributes['data-url'] ?? attributes['data-href'] ?? '', baseUrl);
        if (!absolute || !naverSeriesProductNo(absolute)) continue;
        const inner = match[2] ?? '';
        const title = attributes['data-title'] || attributes.title || attributes['aria-label']
            || firstDescendantAttribute(inner, 'alt') || extractTagClassText(inner, 'strong', /title|tit/iu)
            || extractTagClassText(inner, 'span', /title|tit/iu) || cleanText(inner, 300);
        const windowStart = Math.max(0, (match.index ?? 0) - 400);
        const windowEnd = Math.min(html.length, (match.index ?? 0) + match[0].length + 900);
        const window = html.slice(windowStart, windowEnd);
        const author = extractTagClassText(inner, 'span', /author|writer|nickname/iu)
            || extractTagClassText(inner, 'div', /author|writer|nickname/iu)
            || cleanText(window.match(/(?:작가|글)\s*[:：]?\s*([^<|·,/]{1,80})/u)?.[1] ?? '', 300);
        add(absolute, title, author);
    }
    output.push(...byId.values());
    return output;
}
function splitNaverSeriesDescription(value, maximum) {
    const decoded = decodeHtmlEntities(value).replace(/<br\s*\/?\s*>/gi, '\n');
    const marker = decoded.search(/줄거리\s*[:：]\s*/u);
    const prefix = marker >= 0 ? decoded.slice(0, marker) : decoded;
    const synopsisSource = marker >= 0 ? decoded.slice(marker).replace(/^.*?줄거리\s*[:：]\s*/u, '') : '';
    const tags = [];
    const seen = new Set();
    for (const match of prefix.matchAll(/#\s*([^,#\n]+)/gu)) {
        const tag = cleanText(match[1] ?? '', 100).trim();
        const key = tag.toLocaleLowerCase('ko-KR');
        if (!tag || /^(?:novel|웹소설)$/i.test(tag) || seen.has(key))
            continue;
        seen.add(key);
        tags.push(tag);
        if (tags.length >= 30)
            break;
    }
    return { synopsis: cleanText(synopsisSource, maximum) || null, tags };
}
function naverSeriesSynopsis(html, maximum) {
    const candidates = elementInnersByClass(html, 'div', '_synopsis', 10)
        .map((value) => cleanText(value, maximum + 100).replace(/\s*(?:더보기|접기)\s*$/u, '').trim())
        .filter(Boolean)
        .sort((left, right) => right.length - left.length);
    return candidates[0]?.slice(0, maximum) || null;
}
function naverSeriesInfo(html) {
    const block = elementInnersByClass(html, 'ul', 'end_info', 1)[0] ?? '';
    const author = cleanText(block.match(/<span\b[^>]*>\s*글\s*<\/span>\s*<a\b[^>]*>([\s\S]*?)<\/a>/iu)?.[1] ?? '', 300) || null;
    const genres = [];
    for (const match of block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
        const attributes = parseAttributes(match[1] ?? '');
        const href = attributes.href ?? '';
        if (!/(?:categoryTypeCode=genre|genreCode=)/i.test(href))
            continue;
        const genre = cleanText(match[2] ?? '', 100);
        if (genre && !genres.includes(genre))
            genres.push(genre);
    }
    return { author, genres, statusText: cleanText(block, 1000) };
}
const KOREAN_GENRE_KEYS = new Set([
    '판타지', '현대판타지', '퓨전', '무협', '로맨스', '로맨스판타지', '로판', 'bl', '백합', 'sf',
    '라이트노벨', '패러디', '스포츠', '대체역사', '공포', '미스터리', '추리', '드라마', '코미디',
    '일상', '선협', '게임', '게임판타지', '전쟁', '밀리터리'
]);
function splitKnownGenres(values) {
    const genres = [];
    const tags = [];
    for (const value of mergeUniqueText(values)) {
        const key = value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '');
        if (KOREAN_GENRE_KEYS.has(key))
            genres.push(value);
        else
            tags.push(value);
    }
    return { genres, tags };
}
function numericPathId(value, hosts, pattern) {
    try {
        const url = new URL(value);
        if (!hosts.has(url.hostname.toLowerCase()))
            return null;
        return url.pathname.match(pattern)?.[1] ?? null;
    }
    catch {
        return null;
    }
}
function canonicalNumericUrl(value, host, pathPrefix, id) {
    try {
        const url = new URL(value);
        if (url.protocol === 'https:')
            return `https://${host}${pathPrefix}${id}`;
    }
    catch { /* use canonical host */ }
    return `https://${host}${pathPrefix}${id}`;
}
function firstClassInner(html, tagName, className) {
    const escapedTag = tagName.replace(/[^a-z0-9]/gi, '');
    if (!escapedTag)
        return '';
    const opening = new RegExp(`<${escapedTag}\\b([^>]*)>`, 'gi');
    for (const match of html.matchAll(opening)) {
        const classes = new Set((parseAttributes(match[1] ?? '').class ?? '').split(/\s+/).filter(Boolean));
        if (!classes.has(className))
            continue;
        const contentStart = (match.index ?? 0) + match[0].length;
        const closing = new RegExp(`<\\/${escapedTag}>`, 'i').exec(html.slice(contentStart));
        return closing ? html.slice(contentStart, contentStart + closing.index) : '';
    }
    return '';
}
function exactClassText(html, tagName, className, maximum = 300) {
    return cleanText(firstClassInner(html, tagName, className), maximum);
}
function classElementInners(html, tagName, className, maximumItems = 30) {
    const escapedTag = tagName.replace(/[^a-z0-9]/gi, '');
    if (!escapedTag)
        return [];
    const output = [];
    const opening = new RegExp(`<${escapedTag}\\b([^>]*)>`, 'gi');
    for (const match of html.matchAll(opening)) {
        const classes = new Set((parseAttributes(match[1] ?? '').class ?? '').split(/\s+/).filter(Boolean));
        if (!classes.has(className))
            continue;
        const contentStart = (match.index ?? 0) + match[0].length;
        const tag = new RegExp(`<${escapedTag}\\b[^>]*>|<\/${escapedTag}>`, 'gi');
        tag.lastIndex = contentStart;
        let depth = 1;
        let closingIndex = -1;
        for (let token = tag.exec(html); token; token = tag.exec(html)) {
            if (token[0].startsWith('</'))
                depth -= 1;
            else if (!token[0].endsWith('/>'))
                depth += 1;
            if (depth === 0) {
                closingIndex = token.index;
                break;
            }
        }
        output.push(closingIndex >= 0 ? html.slice(contentStart, closingIndex) : html.slice(contentStart));
        if (output.length >= maximumItems)
            break;
    }
    return output;
}
function exactClassTextDeep(html, tagName, className, maximum = 300) {
    return cleanText(classElementInners(html, tagName, className, 1)[0] ?? '', maximum);
}
function cleanInlineText(value, maximum = 5000) {
    if (typeof value !== 'string')
        return '';
    return decodeHtmlEntities(value)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maximum);
}
function exactClassInlineText(html, tagName, className, maximum = 300) {
    return cleanInlineText(classElementInners(html, tagName, className, 1)[0] ?? '', maximum);
}
function classElementAttr(html, tagName, className, attrName) {
    const escapedTag = tagName.replace(/[^a-z0-9]/gi, '');
    if (!escapedTag)
        return '';
    const opening = new RegExp(`<${escapedTag}\\b([^>]*)>`, 'gi');
    for (const match of html.matchAll(opening)) {
        const attrs = parseAttributes(match[1] ?? '');
        const classes = new Set((attrs.class ?? '').split(/\s+/).filter(Boolean));
        if (classes.has(className))
            return attrs[attrName] ?? '';
    }
    return '';
}
function firstTagText(html, tagName, maximum = 300) {
    const escapedTag = tagName.replace(/[^a-z0-9]/gi, '');
    if (!escapedTag)
        return '';
    const match = new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\/${escapedTag}>`, 'iu').exec(html);
    return cleanText(match?.[1] ?? '', maximum);
}
function allExactClassTexts(html, tagName, className, maximumItems = 30) {
    const escapedTag = tagName.replace(/[^a-z0-9]/gi, '');
    if (!escapedTag)
        return [];
    const output = [];
    const opening = new RegExp(`<${escapedTag}\\b([^>]*)>`, 'gi');
    for (const match of html.matchAll(opening)) {
        const classes = new Set((parseAttributes(match[1] ?? '').class ?? '').split(/\s+/).filter(Boolean));
        if (!classes.has(className))
            continue;
        const contentStart = (match.index ?? 0) + match[0].length;
        const closing = new RegExp(`<\\/${escapedTag}>`, 'i').exec(html.slice(contentStart));
        if (!closing)
            continue;
        const text = cleanText(html.slice(contentStart, contentStart + closing.index), 100).replace(/^#/, '').trim();
        if (text && !output.includes(text))
            output.push(text);
        if (output.length >= maximumItems)
            break;
    }
    return output;
}
function cleanNovelpiaTitle(value) {
    return cleanText(value, 300)
        .replace(/^노벨피아\s*-\s*웹소설로\s*꿈꾸는\s*세상!?\s*-\s*/iu, '')
        .replace(/\s*[-|·:]\s*노벨피아.*$/iu, '')
        .trim();
}
function naverSeriesVisibleInfo(html, descriptionMax = 8000) {
    const visible = visibleBodyText(html, 120000);
    const author = cleanText(visible.match(/(?:^|\s)작가\s+(.{1,180}?)(?=\s+(?:세트\s*보기|작품\s*소개|연재상태|장르|이용가|총\s*\d+))/u)?.[1] ?? '', 300) || null;
    const genreText = cleanText(visible.match(/(?:^|\s)장르\s+(.{1,100}?)(?=\s+(?:이용가|작가|세트\s*보기|작품\s*소개|연재상태|총\s*\d+))/u)?.[1] ?? '', 300);
    const genres = genreText ? textList(genreText.replace(/\s*[|·]\s*/gu, ',')) : [];
    const statusText = cleanText(visible.match(/연재상태\s+(.{1,40}?)(?=\s+(?:장르|이용가|작가|세트\s*보기|작품\s*소개))/u)?.[1] ?? '', 100);
    const synopsis = cleanText(visible.match(/작품\s*소개\s+([\s\S]{2,10000}?)(?=\s+총\s*\d+\s*(?:화|편|권)|\s+작가\s+|$)/u)?.[1] ?? '', descriptionMax) || null;
    return { author, genres, statusText, synopsis };
}
function novelpiaNovelId(value) {
    return numericPathId(value, new Set(['novelpia.com', 'www.novelpia.com']), /^\/novel\/(\d{3,})(?:\/|$)/);
}
function novelpiaSearchCandidates(html, baseUrl) {
    const output = new Map();
    const store = (absolute, remoteId, titleValue, authorValue) => {
        const title = cleanNovelpiaTitle(titleValue);
        if (title.length < 2 || /^(?:상세정보|첫\s*화|보기|선호|알람|표지|이미지|cover)$/iu.test(title))
            return;
        const author = cleanText(authorValue ?? '', 300) || null;
        const candidate = {
            remoteId,
            sourceUrl: canonicalNumericUrl(absolute, 'novelpia.com', '/novel/', remoteId),
            title,
            author
        };
        const existing = output.get(remoteId);
        if (!existing || (!existing.author && author) || candidate.title.length < existing.title.length)
            output.set(remoteId, candidate);
    };
    for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
        const attributes = parseAttributes(match[1] ?? '');
        const absolute = absoluteHttpsUrl(attributes.href ?? '', baseUrl);
        const remoteId = absolute ? novelpiaNovelId(absolute) : null;
        if (!absolute || !remoteId)
            continue;
        const inner = match[2] ?? '';
        const aria = cleanText(attributes['aria-label'] ?? firstDescendantAttribute(inner, 'aria-label'), 500);
        const title = cleanNovelpiaTitle(attributes['data-title'] || attributes.title ||
            exactClassText(inner, 'h6', 'novel-title', 300) ||
            cleanText(inner.match(/<h[3-6]\b[^>]*>([\s\S]*?)<\/h[3-6]>/i)?.[1] ?? '', 300) ||
            extractClassText(inner, /(?:^|[-_\s])(?:novel-?title|title|subject|book-?title)(?:$|[-_\s])/i) ||
            cleanText(inner.match(/<img\b[^>]*\balt\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/i)?.[1] ?? '', 300) ||
            aria || cleanText(inner, 300));
        const author = cleanText(attributes['data-author'] ||
            exactClassText(inner, 'p', 'writer', 300) ||
            exactClassText(inner, 'a', 'writer-name', 300) ||
            extractClassText(inner, /(?:^|[-_\s])(?:writer|author|nickname)(?:$|[-_\s])/i), 300) || null;
        store(absolute, remoteId, title, author);
    }
    // Some NovelPia layouts separate the cover link from the title and writer elements.
    // Inspect a bounded card-sized window around each public /novel/{id} reference as a fallback.
    for (const match of html.matchAll(/(?:https:\/\/(?:www\.)?novelpia\.com)?\/novel\/(\d{3,})/gi)) {
        const remoteId = match[1] ?? '';
        if (!remoteId)
            continue;
        const start = Math.max(0, (match.index ?? 0) - 1800);
        const end = Math.min(html.length, (match.index ?? 0) + 4200);
        const window = html.slice(start, end);
        const title = cleanNovelpiaTitle(cleanText(window.match(/<(?:h[3-6]|div|span)\b[^>]*class\s*=\s*(?:"[^"]*(?:novel-?title|title|subject)[^"]*"|'[^']*(?:novel-?title|title|subject)[^']*')[^>]*>([\s\S]*?)<\/(?:h[3-6]|div|span)>/i)?.[1] ?? '', 300));
        const author = cleanText(window.match(/<(?:a|p|span|div)\b[^>]*class\s*=\s*(?:"[^"]*(?:writer|author|nickname)[^"]*"|'[^']*(?:writer|author|nickname)[^']*')[^>]*>([\s\S]*?)<\/(?:a|p|span|div)>/i)?.[1] ?? '', 300) || null;
        store(`https://novelpia.com/novel/${remoteId}`, remoteId, title, author);
    }
    return [...output.values()];
}
function novelpiaDetailInfo(html) {
    const title = cleanNovelpiaTitle(exactClassText(html, 'div', 'epnew-novel-title', 300));
    const author = exactClassText(html, 'a', 'writer-name', 300) || null;
    const synopsis = exactClassText(html, 'div', 'synopsis', 5000) || null;
    const tagBlock = firstClassInner(html, 'div', 'epnew-tag');
    const scopedTags = allExactClassTexts(tagBlock, 'span', 'tag');
    const fallbackTags = scopedTags.length ? [] : [...html.matchAll(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi)]
        .filter((match) => new Set((parseAttributes(match[1] ?? '').class ?? '').split(/\s+/).filter(Boolean)).has('tag'))
        .map((match) => cleanText(match[2] ?? '', 100).replace(/^#/, '').trim());
    const rawTags = mergeUniqueText(scopedTags, fallbackTags).filter((value) => !/나만의태그|태그 추가/u.test(value));
    const split = splitKnownGenres(rawTags);
    const writerBlock = firstClassInner(html, 'div', 'epnew-writer');
    let status = null;
    if (/b_(?:finish|complete)|완결/iu.test(writerBlock))
        status = 'completed';
    else if (/b_delay|휴재|연재지연/iu.test(writerBlock))
        status = 'hiatus';
    else if (/<span\b[^>]*class\s*=\s*(?:"[^"]*\bcategory-title\b[^"]*"|'[^']*\bcategory-title\b[^']*')[^>]*>\s*연재\s*<\/span>/iu.test(html))
        status = 'ongoing';
    return { title, author, synopsis, genres: split.genres, tags: split.tags, status };
}
function isNovelpiaCoverPlaceholder(value, baseUrl) {
    const url = absoluteHttpsUrl(value, baseUrl);
    if (!url)
        return true;
    let pathname = '';
    try {
        pathname = new URL(url).pathname.toLowerCase();
    }
    catch {
        return true;
    }
    return /^\/img\/\d{4}-novelpia\d*\.(?:avif|jpe?g|png|webp)$/u.test(pathname)
        || pathname === '/img/novel/adult_cover_img.jpg'
        || pathname.startsWith('/img/favicon/')
        || pathname.includes('/logo_')
        || /^\/img\/layout\/(?:readycover|none_user)/u.test(pathname);
}
function isNovelpiaNonImagePageUrl(value, baseUrl) {
    const url = absoluteHttpsUrl(value, baseUrl);
    if (!url)
        return true;
    try {
        const parsed = new URL(url);
        if (!['novelpia.com', 'www.novelpia.com'].includes(parsed.hostname.toLowerCase()))
            return false;
        return /^\/(?:novel\/\d+|login|search|proc|viewer)(?:\/|$)/u.test(parsed.pathname.toLowerCase());
    }
    catch {
        return true;
    }
}
function novelpiaAdultCoverHidden(html, baseUrl) {
    if (/\/img\/novel\/adult_cover_img\.jpg(?:[?#][^"'<>]*)?/iu.test(String(html || '')))
        return true;
    const meta = metaMap(html);
    return [meta.get('og:image:secure_url'), meta.get('og:image'), meta.get('twitter:image')]
        .some((value) => {
        const url = absoluteHttpsUrl(value, baseUrl);
        if (!url)
            return false;
        try {
            return new URL(url).pathname.toLowerCase() === '/img/novel/adult_cover_img.jpg';
        }
        catch {
            return false;
        }
    });
}
function novelpiaCoverUrl(html, baseUrl) {
    const coverBlock = firstClassInner(html, 'div', 'epnew-cover-box');
    const candidates = [];
    const collectImageAttributes = (source, tagPattern) => {
        for (const match of source.matchAll(tagPattern)) {
            const attributes = parseAttributes(match[1] ?? '');
            candidates.push(attributes.src, attributes['data-src'], attributes['data-original'], attributes['data-lazy-src']);
            const srcset = attributes.srcset ?? attributes['data-srcset'] ?? '';
            for (const item of String(srcset).split(','))
                candidates.push(item.trim().split(/\s+/u)[0]);
            const styleUrl = String(attributes.style ?? '').match(/background-image\s*:\s*url\(\s*(['"]?)(.*?)\1\s*\)/iu)?.[2];
            candidates.push(styleUrl);
        }
    };
    if (coverBlock) {
        collectImageAttributes(coverBlock, /<(?:img|source)\b([^>]*)>/gi);
        for (const match of coverBlock.matchAll(/background-image\s*:\s*url\(\s*(['"]?)(.*?)\1\s*\)/giu))
            candidates.push(match[2]);
        for (const match of coverBlock.matchAll(/<a\b([^>]*)>/gi)) {
            const attributes = parseAttributes(match[1] ?? '');
            candidates.push(attributes.href);
        }
    }
    const meta = metaMap(html);
    candidates.push(meta.get('og:image:secure_url'), meta.get('og:image'), meta.get('twitter:image'));
    for (const candidate of candidates) {
        if (!candidate || isNovelpiaCoverPlaceholder(candidate, baseUrl) || isNovelpiaNonImagePageUrl(candidate, baseUrl))
            continue;
        const url = absoluteHttpsUrl(candidate, baseUrl);
        if (url)
            return url;
    }
    return null;
}
function cleanMunpiaTitle(value) {
    return cleanText(value, 300)
        .replace(/\s*[-|·:]\s*웹소설\s*문피아.*$/iu, '')
        .replace(/\s*[-|·:]\s*문피아.*$/iu, '')
        .trim();
}
function munpiaNovelId(value) {
    try {
        const url = new URL(String(value || ''));
        const host = url.hostname.toLowerCase();
        if (host === 'novel.munpia.com')
            return url.pathname.match(/^\/(\d{3,})(?:\/|$)/u)?.[1] ?? null;
        if (!new Set(['www.munpia.com','munpia.com','m.munpia.com','mm.munpia.com']).has(host))
            return null;
        const pathId = url.pathname.match(/^\/novel\/detail\/(\d{3,})(?:\/|$)/u)?.[1]
            ?? url.pathname.match(/^\/novel\/(\d{3,})(?:\/|$)/u)?.[1]
            ?? null;
        if (pathId)
            return pathId;
        const queryId = url.searchParams.get('id') ?? url.searchParams.get('novelId') ?? url.searchParams.get('novel_id');
        if (/^\d{3,}$/u.test(String(queryId || '')) && /novel/iu.test(url.searchParams.get('menu') ?? `${url.pathname}${url.search}`))
            return String(queryId);
        return null;
    }
    catch { return null; }
}
function munpiaCanonicalUrl(remoteId) {
    return /^\d{3,}$/u.test(String(remoteId || '')) ? `https://www.munpia.com/novel/detail/${remoteId}` : null;
}
function munpiaUrlFromAttributes(attributes, baseUrl) {
    const candidates = [
        attributes.href, attributes['data-href'], attributes['data-url'], attributes['data-link'],
        attributes['data-target'], attributes['data-origin-url'], attributes['data-novel-url']
    ];
    const onclick = String(attributes.onclick || '');
    for (const match of onclick.matchAll(/(?:https:\/\/[^'"\s)]+|\/novel\/detail\/\d{3,}|https:\/\/novel\.munpia\.com\/\d{3,})/giu))
        candidates.push(match[0]);
    const inlineId = onclick.match(/(?:novel(?:Id|_id)?|\bid)\s*[:=,()]\s*['"]?(\d{3,})/iu)?.[1]
        ?? String(attributes['data-novel-id'] || attributes['data-id'] || '').match(/^\d{3,}$/u)?.[0];
    if (inlineId)
        candidates.push(munpiaCanonicalUrl(inlineId));
    for (const candidate of candidates) {
        const absolute = absoluteHttpsUrl(candidate ?? '', baseUrl);
        if (absolute && munpiaNovelId(absolute))
            return absolute;
    }
    return null;
}
function munpiaCandidateAuthor(block) {
    for (const match of block.matchAll(/<(?:a|span|div|strong)\b([^>]*)>([\s\S]*?)<\/(?:a|span|div|strong)>/giu)) {
        const attrs = parseAttributes(match[1] ?? '');
        const className = String(attrs.class || '');
        const label = `${className} ${attrs['data-role'] || ''} ${attrs.itemprop || ''}`;
        if (!/(?:author|writer|nickname|member|작가)/iu.test(label))
            continue;
        const value = cleanText(attrs.title ?? attrs['data-author'] ?? match[2] ?? '', 300);
        if (value && !/^(?:작가|저자|글)$/u.test(value))
            return value.replace(/^(?:작가|저자|글)\s*[:：]?\s*/u, '').trim() || null;
    }
    const visible = cleanText(block, 2000);
    return cleanText(visible.match(/(?:작가|저자|글)\s*[:：]\s*([^|·,/]{1,80})/u)?.[1] ?? '', 300) || null;
}
function munpiaJsonCandidates(html) {
    const output = [];
    for (const document of jsonDocuments(html)) {
        for (const record of objectRecords(document, 20_000)) {
            const title = cleanMunpiaTitle(firstString(record, ['novelTitle','novel_title','bookTitle','book_title','title','name'], 300));
            if (title.length < 2)
                continue;
            const linked = firstString(record, ['novelUrl','novel_url','detailUrl','detail_url','webUrl','web_url','url','link','href'], 2048);
            let remoteId = munpiaNovelId(linked);
            if (!remoteId) {
                const idValue = firstString(record, ['novelId','novel_id','novelNo','novel_no','bookId','book_id','id'], 80);
                if (/^\d{3,}$/u.test(idValue))
                    remoteId = idValue;
            }
            if (!remoteId)
                continue;
            const author = cleanText(firstString(record, ['authorName','author_name','writerName','writer_name','author','writer','nickname'], 300), 300) || null;
            output.push({ remoteId, sourceUrl:munpiaCanonicalUrl(remoteId), title, author });
        }
    }
    return output;
}
function munpiaSearchCandidates(html, baseUrl) {
    const output = [...munpiaJsonCandidates(html)];
    const preferredScopes = [];
    const legacySection = html.match(/<section\b(?=[^>]*\bid\s*=\s*(?:"SECTION-LIST"|'SECTION-LIST'))[^>]*>([\s\S]*?)<\/section>/i)?.[1];
    if (legacySection)
        preferredScopes.push(legacySection);
    for (const match of html.matchAll(/<(?:li|article|section|div)\b([^>]*)>([\s\S]*?)<\/(?:li|article|section|div)>/giu)) {
        const attrs = parseAttributes(match[1] ?? '');
        const marker = `${attrs.class || ''} ${attrs.id || ''} ${attrs['data-testid'] || ''}`;
        if (/(?:novel|book|search|result|item|card|list)/iu.test(marker))
            preferredScopes.push(match[0]);
        if (preferredScopes.length >= 500)
            break;
    }
    const scopes = preferredScopes.length ? [...preferredScopes, html] : [html];
    for (const block of scopes) {
        for (const anchor of block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/giu)) {
            const attributes = parseAttributes(anchor[1] ?? '');
            const absolute = munpiaUrlFromAttributes(attributes, baseUrl);
            const remoteId = absolute ? munpiaNovelId(absolute) : null;
            if (!remoteId)
                continue;
            const localStart = Math.max(0, Number(anchor.index || 0) - 900);
            const localEnd = Math.min(block.length, Number(anchor.index || 0) + anchor[0].length + 900);
            const contextBlock = block.slice(localStart, localEnd);
            const title = cleanMunpiaTitle(
                attributes.title || attributes['data-title'] || attributes['aria-label']
                || exactClassTextDeep(anchor[2] ?? '', 'span', 'title', 300)
                || anchor[2] || ''
            );
            if (title.length < 2 || /^(?:상세정보|작품정보|바로가기|목록|보기)$/u.test(title))
                continue;
            const author = cleanText(attributes['data-author'] ?? '', 300) || munpiaCandidateAuthor(contextBlock);
            output.push({ remoteId, sourceUrl:munpiaCanonicalUrl(remoteId), title, author });
        }
    }
    if (!output.length) {
        for (const match of html.matchAll(/(?:https:\/\/(?:www\.|m\.|mm\.)?munpia\.com\/novel\/detail\/(\d{3,})|https:\/\/novel\.munpia\.com\/(\d{3,}))/giu)) {
            const remoteId = match[1] ?? match[2];
            const start = Math.max(0, Number(match.index || 0) - 1000);
            const end = Math.min(html.length, Number(match.index || 0) + match[0].length + 1000);
            const block = html.slice(start, end);
            const title = cleanMunpiaTitle(
                block.match(/(?:novelTitle|novel_title|title)\s*["']?\s*[:=]\s*["']([^"']{2,300})/iu)?.[1]
                ?? block.match(/<(?:h1|h2|h3|strong)\b[^>]*>([\s\S]*?)<\/(?:h1|h2|h3|strong)>/iu)?.[1]
                ?? ''
            );
            if (title.length >= 2)
                output.push({ remoteId, sourceUrl:munpiaCanonicalUrl(remoteId), title, author:munpiaCandidateAuthor(block) });
        }
    }
    return output.filter((candidate) => candidate.remoteId && candidate.sourceUrl && candidate.title);
}
const MUNPIA_KEYWORD_NOISE = new Set([
    '글세상 문피아', 'munpia', '장르소설', '웹소설', '연재', '창작', '만화', '웹툰', '게임', '음악',
    '판타지', '무협', '로맨스', '19금', 'bl', '플래티넘', '베스트', '서재', '연재방', '유료웹소설', '무료웹소설'
].map((value) => value.toLocaleLowerCase('ko-KR')));
function munpiaStructuredDetail(html, baseUrl) {
    const candidates = [];
    for (const document of jsonDocuments(html)) {
        for (const record of objectRecords(document, 20_000)) {
            const linked = firstString(record, ['novelUrl','novel_url','detailUrl','detail_url','webUrl','web_url','url','mainEntityOfPage'], 2048);
            const remoteId = munpiaNovelId(linked || baseUrl)
                ?? (/^\d{3,}$/u.test(firstString(record, ['novelId','novel_id','novelNo','novel_no','bookId','book_id','id'], 80))
                    ? firstString(record, ['novelId','novel_id','novelNo','novel_no','bookId','book_id','id'], 80) : null);
            const title = cleanMunpiaTitle(firstString(record, ['novelTitle','novel_title','bookTitle','book_title','headline','title','name'], 300));
            if (!remoteId || !title)
                continue;
            const author = cleanText(firstString(record, ['authorName','author_name','writerName','writer_name','author','writer','creator'], 300), 300) || null;
            const synopsis = cleanText(firstString(record, ['synopsis','description','summary','introduction','intro'], 8000), 8000) || null;
            const genres = mergeUniqueText(firstList(record, ['genres','genre','category','categories']).map((value) => cleanText(String(value || ''), 100)).filter(Boolean));
            const tags = mergeUniqueText(firstList(record, ['keywords','keyword','tags','tagList','hashtags']).map((value) => cleanText(String(value || '').replace(/^#/, ''), 100)).filter(Boolean));
            const date = firstString(record, ['datePublished','publishedAt','publishDate','startDate','createdAt'], 100);
            const publicationYear = Number.parseInt(date.match(/(?:19|20)\d{2}/u)?.[0] ?? '', 10);
            candidates.push({
                remoteId,
                title,
                author,
                synopsis,
                genres,
                tags,
                status:statusFrom(firstString(record, ['publicationStatus','serialStatus','status','complete','completed','isComplete'], 300)),
                publicationYear:Number.isInteger(publicationYear) ? publicationYear : null,
                coverUrl:firstImage(record, baseUrl)
            });
        }
    }
    return candidates.sort((left, right) => {
        const completeness = (item) => Number(Boolean(item.author)) + Number(Boolean(item.synopsis)) * 2 + item.genres.length + item.tags.length + Number(Boolean(item.coverUrl));
        return completeness(right) - completeness(left);
    })[0] ?? null;
}
function munpiaDetailFields(html, baseUrl = 'https://www.munpia.com/') {
    const meta = metaMap(html);
    const structured = munpiaStructuredDetail(html, baseUrl);
    const titleWrap = firstClassInner(html, 'div', 'title-wrap');
    const titleAnchor = titleWrap.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
    const visible = cleanText(html, 120_000);
    const title = structured?.title || cleanMunpiaTitle(
        titleAnchor ? (parseAttributes(titleAnchor[1] ?? '').title ?? titleAnchor[2] ?? '')
            : (meta.get('og:title') ?? meta.get('twitter:title') ?? html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu)?.[1] ?? html.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/iu)?.[1] ?? '')
    );
    const authorBlock = firstClassInner(html, 'dl', 'meta-author');
    const author = structured?.author
        || cleanText(authorBlock.match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i)?.[1] ?? '', 300)
        || cleanText(html.match(/<(?:a|span|strong)\b[^>]*(?:class|itemprop)\s*=\s*(?:"[^"]*(?:author|writer)[^"]*"|'[^']*(?:author|writer)[^']*')[^>]*>([\s\S]*?)<\/(?:a|span|strong)>/iu)?.[1] ?? '', 300)
        || cleanText((meta.get('author') ?? meta.get('book:author') ?? '').trim(), 300)
        || cleanText((meta.get('description') ?? '').split(/\s+-\s+/, 1)[0] ?? '', 300)
        || null;
    const storyBlock = firstClassInner(html, 'div', 'story-box');
    const synopsis = structured?.synopsis
        || exactClassText(storyBlock, 'p', 'story', 5000)
        || exactClassTextDeep(html, 'div', 'synopsis', 5000)
        || exactClassTextDeep(html, 'div', 'introduce', 5000)
        || exactClassTextDeep(html, 'div', 'description', 5000)
        || cleanText(meta.get('og:description') ?? meta.get('description') ?? '', 5000)
        || null;
    const metaPathBlock = firstClassInner(html, 'p', 'meta-path');
    const metaPath = cleanText(metaPathBlock, 1000)
        || cleanText(visible.match(/(?:일반연재|작가연재|유료|무료|연재\s*이북)\s*[〉>·|]\s*([^#\n]{1,200})/u)?.[0] ?? '', 1000);
    const categoryText = exactClassTextDeep(html, 'div', 'category', 500)
        || exactClassTextDeep(html, 'p', 'category', 500)
        || exactClassTextDeep(html, 'span', 'category', 500);
    const genreText = cleanText(metaPathBlock.match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i)?.[1] ?? '', 300)
        || cleanText(categoryText.match(/[〉>·|]\s*(.+)$/u)?.[1] ?? categoryText, 300)
        || cleanText(visible.match(/(?:일반연재|작가연재|유료|무료|연재\s*이북)\s*[〉>·|]\s*([^#]{1,120}?)(?=\s+(?:조회수|선호작|좋아요|연재글|작품소개|작품등록일)|$)/u)?.[1] ?? '', 300);
    const visibleGenres = genreText.split(/[,/|>〉·]/).map((value) => value.trim()).filter((value) => value && !/^(?:일반연재|작가연재|유료|무료|연재\s*이북)$/u.test(value));
    const genres = mergeUniqueText(structured?.genres ?? [], visibleGenres);
    const titleKey = title.toLocaleLowerCase('ko-KR');
    const authorKey = author?.toLocaleLowerCase('ko-KR') ?? '';
    const genreKeys = new Set(genres.map((value) => value.toLocaleLowerCase('ko-KR')));
    const visibleTags = [...html.matchAll(/<(?:a|span)\b[^>]*>(\s*#[^<]{1,80})<\/(?:a|span)>/giu)]
        .map((match) => cleanText(match[1] ?? '', 100).replace(/^#/, '').trim()).filter(Boolean);
    const tags = mergeUniqueText(structured?.tags ?? [], visibleTags, (meta.get('keywords') ?? '').split(',').map((value) => value.trim()).filter((value) => {
        const key = value.toLocaleLowerCase('ko-KR');
        return Boolean(value) && key !== titleKey && key !== authorKey && !genreKeys.has(key) && !MUNPIA_KEYWORD_NOISE.has(key);
    }));
    const registered = html.match(/작품등록일\s*:\s*<\/dt>\s*<dd\b[^>]*>\s*((?:19|20)\d{2})[.\/-]/iu)?.[1]
        ?? visible.match(/작품등록일\s*:?\s*((?:19|20)\d{2})[.\/-]/u)?.[1]
        ?? '';
    const year = Number.parseInt(registered, 10);
    const statusText = exactClassText(html, 'p', 'iconset', 1000);
    return {
        title,
        author,
        synopsis,
        genres,
        tags,
        status:structured?.status || statusFrom(statusText, metaPath, visible.slice(0, 5000)),
        publicationYear:structured?.publicationYear ?? (Number.isInteger(year) ? year : null),
        coverUrl:structured?.coverUrl || absoluteHttpsUrl(meta.get('og:image') ?? meta.get('og:image:secure_url') ?? meta.get('twitter:image') ?? '', baseUrl)
    };
}
function joaraBookId(value) {
    return numericPathId(value, new Set(['www.joara.com', 'joara.com']), /^\/book\/(\d{3,})(?:\/|$)/);
}
function joaraCardRemoteId(title, author) {
    return `search-card-${(0, node_crypto_1.createHash)('sha256').update(`${normalizeMatchText(title)}\u0000${normalizeMatchText(author ?? '')}`).digest('hex')}`;
}
function joaraSpanTexts(html, containerClass) {
    const block = classElementInners(html, 'div', containerClass, 1)[0] ?? '';
    return [...block.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
        .map((item) => cleanText(item[1] ?? '', 100)).filter(Boolean);
}
function joaraKeywordTexts(html) {
    const values = [];
    for (const match of html.matchAll(/<(?:a|button)\b([^>]*)>([\s\S]*?)<\/(?:a|button)>/gi)) {
        const attrs = parseAttributes(match[1] ?? '');
        const keyword = cleanText(attrs['data-keyword'] ?? '', 100) || cleanText(match[2] ?? '', 100);
        if (keyword)
            values.push(keyword);
    }
    return mergeUniqueText(values);
}
function joaraCoverUrl(html, baseUrl) {
    const candidates = [];
    const background = classElementAttr(html, 'div', 'bg-img', 'style').match(/url\(["']?([^"')]+)["']?\)/iu)?.[1];
    if (background)
        candidates.push(background);
    for (const source of html.matchAll(/<(?:source|img)\b([^>]*)>/gi)) {
        const attrs = parseAttributes(source[1] ?? '');
        candidates.push((attrs.srcset ?? attrs.src ?? '').split(/\s+/)[0] ?? '');
    }
    for (const candidate of candidates) {
        const absolute = absoluteHttpsUrl(candidate, baseUrl);
        if (absolute && new URL(absolute).hostname.toLowerCase() === 'cf-image.joara.com')
            return absolute;
    }
    return null;
}
function joaraSearchCardCandidates(html, baseUrl) {
    const output = [];
    for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
        const attributes = parseAttributes(match[1] ?? '');
        if ((attributes['data-link-type'] ?? '') !== 'book-preview')
            continue;
        const inner = match[2] ?? '';
        const title = exactClassInlineText(inner, 'div', 'highlight-title', 300) || exactClassTextDeep(inner, 'div', 'tit', 300);
        const author = firstTagText(classElementInners(inner, 'div', 'nickname', 1)[0] ?? '', 'button', 300)
            || exactClassTextDeep(inner, 'div', 'nickname', 300) || null;
        if (title.length < 1)
            continue;
        const infoValues = joaraSpanTexts(inner, 'info');
        const genre = infoValues.find((value) => !/\d+\s*화|무료|노블|프리|완결|연재/iu.test(value)) ?? '';
        const storeTags = infoValues.filter((value) => value && value !== genre && !/\d+\s*화/iu.test(value));
        const statusText = infoValues.find((value) => /완결|연재/u.test(value)) ?? '';
        const adult = /badge-19|i-adult/iu.test(inner);
        const synopsis = exactClassTextDeep(inner, 'div', 'introduce', 5000) || null;
        const keywordBlock = classElementInners(inner, 'div', 'keyword-list', 1)[0] ?? '';
        const tags = mergeUniqueText(joaraKeywordTexts(keywordBlock), storeTags, adult ? ['19세'] : []);
        const coverUrl = joaraCoverUrl(inner, baseUrl);
        const linkedUrl = absoluteHttpsUrl(attributes.href ?? '', baseUrl);
        const linkedBookId = linkedUrl ? joaraBookId(linkedUrl) : null;
        const remoteId = linkedBookId ?? joaraCardRemoteId(title, author);
        const source = new URL(baseUrl);
        source.hash = `book-preview-${remoteId}`;
        const sourceUrl = linkedBookId ? `https://www.joara.com/book/${linkedBookId}` : source.toString();
        const inlineMetadata = {
            remoteId,
            sourceUrl,
            title,
            originalTitle: null,
            author,
            synopsis,
            genres: genre ? [genre] : [],
            tags,
            publicationStatus: statusFrom(statusText),
            publicationYear: null,
            sourceLanguage: 'ko',
            coverUrl,
            rawSha256: (0, node_crypto_1.createHash)('sha256').update(match[0]).digest('hex')
        };
        output.push({ remoteId, sourceUrl, title, author, inlineMetadata });
    }
    return output;
}

function ssnSeriesId(value) {
    try {
        const url = new URL(value);
        if (!new Set(['ssn.so', 'www.ssn.so']).has(url.hostname.toLowerCase()) || url.search || url.hash)
            return null;
        const match = url.pathname.match(/^\/series\/(\d{3,})\/?$/u);
        return match?.[1] ?? null;
    }
    catch {
        return null;
    }
}
function cleanSsnTitle(value) {
    return cleanText(value, 300)
        .replace(/\s*[-|·:]\s*(?:웹소설(?:\s+리뷰·평점)?|소설넷|웹소설\s+[^-]+)$/iu, '')
        .replace(/\s+완결\s*$/u, '')
        .trim();
}
function closestSsnLinkText(html, center, pathPattern, maximum = 300) {
    let best = null;
    for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
        const attributes = parseAttributes(match[1] ?? '');
        const href = attributes.href ?? '';
        if (!pathPattern.test(href)) continue;
        const text = cleanText(match[2] ?? '', maximum);
        if (!text) continue;
        const distance = Math.abs((match.index ?? 0) - Math.max(0, center));
        if (!best || distance < best.distance) best = { distance, text };
    }
    return best?.text ?? '';
}
function ssnSearchCandidates(html, baseUrl) {
    const output = new Map();
    const add = (remoteId, titleValue, center) => {
        if (!/^\d{3,}$/u.test(remoteId)) return;
        const title = cleanSsnTitle(titleValue || '');
        if (title.length < 2) return;
        const windowStart = Math.max(0, center - 1800);
        const windowEnd = Math.min(html.length, center + 1800);
        const windowHtml = html.slice(windowStart, windowEnd);
        const author = closestSsnLinkText(windowHtml, center - windowStart, /\/(?:profile\/author\/\d+\/series|series\/author\/\d+)\/?(?:[?#]|$)/iu, 300) || null;
        const candidate = { remoteId, sourceUrl:`https://ssn.so/series/${remoteId}/`, title, author };
        const previous = output.get(remoteId);
        if (!previous || (!previous.author && candidate.author) || candidate.title.length < previous.title.length) output.set(remoteId, candidate);
    };
    for (const match of html.matchAll(/<h[2-4]\b[^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>[\s\S]*?<\/h[2-4]>/gi)) {
        const attributes = parseAttributes(match[1] ?? '');
        const absolute = absoluteHttpsUrl(attributes.href ?? '', baseUrl);
        const remoteId = absolute ? ssnSeriesId(absolute) : null;
        if (!remoteId) continue;
        add(remoteId, match[2] ?? '', match.index ?? 0);
    }
    for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
        const attributes = parseAttributes(match[1] ?? '');
        const absolute = absoluteHttpsUrl(attributes.href ?? '', baseUrl);
        const remoteId = absolute ? ssnSeriesId(absolute) : null;
        if (!remoteId) continue;
        const inner = match[2] ?? '';
        const imageAlt = inner.match(/<img\b([^>]*)>/i);
        const alt = imageAlt ? parseAttributes(imageAlt[1] ?? '').alt ?? '' : '';
        add(remoteId, attributes.title || attributes['aria-label'] || alt || inner, match.index ?? 0);
    }
    return [...output.values()];
}
function ssnDetailMetadata(html, finalUrl, descriptionMax) {
    providerDocumentGate(html, '소설넷');
    const meta = metaMap(html);
    const canonical = canonicalLink(html, finalUrl) ?? absoluteHttpsUrl(meta.get('og:url') ?? '', finalUrl) ?? finalUrl;
    const remoteId = ssnSeriesId(canonical) ?? ssnSeriesId(finalUrl);
    if (!remoteId) return null;
    const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    const title = cleanSsnTitle(h1Match?.[1] ?? meta.get('og:title') ?? meta.get('twitter:title') ?? '');
    if (!title) return null;
    const center = h1Match?.index ?? Math.max(0, html.indexOf(title));
    const author = closestSsnLinkText(html, center, /\/(?:profile\/author\/\d+\/series|series\/author\/\d+)\/?(?:[?#]|$)/iu, 300) || cleanText(meta.get('author') ?? meta.get('book:author') ?? '', 300) || null;
    const genre = closestSsnLinkText(html, center, /\/series\/genre\/[a-z0-9-]+\/?(?:[?#]|$)/iu, 100);
    const tags = [];
    const tagSeen = new Set();
    for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
        const attributes = parseAttributes(match[1] ?? '');
        if (!/\/series\/tag\/[^/?#]+\/?(?:[?#]|$)/iu.test(attributes.href ?? '')) continue;
        const tag = cleanText(match[2] ?? '', 100).replace(/^#+/u, '').trim();
        const key = tag.toLocaleLowerCase('ko-KR');
        if (!tag || tagSeen.has(key)) continue;
        tagSeen.add(key); tags.push(tag);
        if (tags.length >= 30) break;
    }
    const metaDescription = cleanText(meta.get('og:description') ?? meta.get('description') ?? '', descriptionMax);
    const body = visibleBodyText(html, Math.max(20_000, descriptionMax * 4));
    const titleIndex = body.indexOf(title);
    let synopsis = metaDescription;
    if ((!synopsis || synopsis.length < 20) && titleIndex >= 0) {
        synopsis = cleanText(body.slice(titleIndex + title.length, titleIndex + title.length + descriptionMax + 800)
            .replace(/^(?:완결\s*)?/u, '')
            .split(/(?:카카오페이지|문피아|네이버시리즈|리디북스|컬렉션|공유)/u)[0] ?? '', descriptionMax);
    }
    const date = meta.get('article:published_time') ?? meta.get('date') ?? '';
    const year = Number.parseInt(String(date).match(/(?:19|20)\d{2}/u)?.[0] ?? '', 10);
    return {
        remoteId,
        sourceUrl:`https://ssn.so/series/${remoteId}/`,
        title,
        originalTitle:null,
        author,
        synopsis:synopsis || null,
        genres:genre ? [genre] : [],
        tags,
        publicationStatus:statusFrom(title, metaDescription, body.slice(Math.max(0, titleIndex - 200), Math.max(0, titleIndex) + 500)),
        publicationYear:Number.isInteger(year) ? year : null,
        sourceLanguage:'ko',
        coverUrl:absoluteHttpsUrl(meta.get('og:image') ?? meta.get('twitter:image') ?? '', canonical),
        rawSha256:(0, node_crypto_1.createHash)('sha256').update(html).digest('hex')
    };
}
const ssnSeriesAdapter = {
    key:'ssn-series-v1',
    displayName:'소설넷 웹소설 검색',
    revision:1,
    description:'소설넷 공개 검색 결과에서 작품을 찾고 상세 페이지의 제목, 작가, 장르, 소개, 연재 상태, 태그와 표지를 수집합니다. 검색 카드와 Open Graph 메타데이터를 함께 사용해 화면 구조 변경에 대한 의존도를 낮춥니다.',
    requestProfile:'browser-html',
    buildSearchUrl(terms) { return `https://ssn.so/series/?keyword=${encodeURIComponent(terms.title)}`; },
    buildSearchRequests(terms) {
        return [{ url:this.buildSearchUrl(terms), method:'GET', responseType:'html', requestProfile:'browser-html', variant:'public-search', deviceProfile:'desktop' }];
    },
    buildSearchRequest(terms) { return this.buildSearchRequests(terms)[0]; },
    buildDetailRequests(sourceUrl, remoteId) {
        const id = ssnSeriesId(sourceUrl) ?? (/^\d{3,}$/u.test(String(remoteId || '')) ? String(remoteId) : null);
        return id ? [{ url:`https://ssn.so/series/${id}/`, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'public-detail', deviceProfile:'desktop' }] : [];
    },
    shouldFetchDetailFallback() { return false; },
    isDetailUrl(url) { return ssnSeriesId(url) !== null; },
    parseSearchResults(html, finalUrl, terms, limit) {
        providerDocumentGate(html, '소설넷');
        return dedupeAndRank(ssnSearchCandidates(html, finalUrl), terms, limit);
    },
    parseDetailDocuments(documents, sourceUrl, remoteId, descriptionMax) {
        return parseDetailDocumentList(this, documents, sourceUrl, remoteId, descriptionMax, `https://ssn.so/series/${remoteId}/`);
    },
    parseDetail(html, finalUrl, descriptionMax) { return ssnDetailMetadata(html, finalUrl, descriptionMax); }
};

const novelpiaWebNovelAdapter = {
    key: 'novelpia-webnovel-v1',
    displayName: '노벨피아 웹소설 자동 검색',
    revision: 11,
    description: '로그인 Playwright 프로필의 동일 출처 fetch로 일반·19세 검색을 병합하고, 결과가 없을 때 모바일 렌더링 검색을 보조 경로로 사용합니다. 상세는 모바일·데스크톱 렌더링 결과를 병합하며 로그인, 성인 인증, 접근 차단을 분리 진단합니다.',
    requestProfile: 'browser-html',
    buildSearchUrl(terms, options = {}) {
        const age = typeof options === 'string' ? options : String(options && options.age || '');
        const params = new URLSearchParams({
            cmd: 'novel_search', page: '1', rows: '30', search_type: 'all', search_val: terms.title,
            novel_type: '', start_count_book: '', end_count_book: '', novel_age: age, start_days: '',
            sort_col: 'last_viewdate', novel_genre: '', block_out: '0', block_stop: '0',
            is_contest: '0', is_complete: '', is_challenge: '0', list_display: 'list'
        });
        return `https://novelpia.com/proc/novel?${params.toString()}`;
    },
    buildSearchRequests(terms) {
        const common = { method:'GET', responseType:'json', requestProfile:'novelpia-json', referer:'https://novelpia.com/search', deviceProfile:'desktop' };
        return [
            { ...common, url:this.buildSearchUrl(terms, { age:'' }), variant:'desktop-standard' },
            { ...common, url:this.buildSearchUrl(terms, { age:'19' }), variant:'desktop-adult', requiresBrowserProfile:true, optional:true },
            { url:`https://novelpia.com/search?search_type=all&search_val=${encodeURIComponent(terms.title)}`, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'mobile-rendered', deviceProfile:'mobile', optional:true, fallbackOnly:true }
        ];
    },
    buildSearchRequest(terms) { return this.buildSearchRequests(terms)[0]; },
    buildDetailRequests(sourceUrl, remoteId) {
        const id = novelpiaNovelId(sourceUrl) ?? (/^\d{3,}$/u.test(String(remoteId || '')) ? String(remoteId) : null);
        if (!id) return [];
        const url = `https://novelpia.com/novel/${id}`;
        return [
            { url, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'mobile-rendered', deviceProfile:'mobile', optional:true },
            { url, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'desktop-rendered', deviceProfile:'desktop', optional:true, fallbackOnly:true }
        ];
    },
    shouldFetchDetailFallback(documents, sourceUrl, remoteId, descriptionMax) {
        return shouldFetchDetailFallbackFor(this, documents, sourceUrl, remoteId, descriptionMax);
    },
    isDetailUrl(url) { return novelpiaNovelId(url) !== null; },
    parseSearchResults(document, finalUrl, terms, limit) {
        providerDocumentGate(document, '노벨피아');
        const candidates = [];
        for (const parsed of jsonDocuments(document)) candidates.push(...novelpiaApiCandidates(parsed));
        if (!candidates.length && /<html\b/iu.test(document)) candidates.push(...novelpiaSearchCandidates(document, finalUrl));
        return dedupeAndRank(candidates, terms, limit);
    },
    parseDetailDocuments(documents, sourceUrl, remoteId, descriptionMax) {
        return parseDetailDocumentList(this, documents, sourceUrl, remoteId, descriptionMax, `https://novelpia.com/novel/${remoteId}`);
    },
    parseDetail(html, finalUrl, descriptionMax) {
        providerDocumentGate(html, '노벨피아');
        if (novelpiaAdultCoverHidden(html, finalUrl)) {
            throw Object.assign(
                new Error('노벨피아 성인 작품의 실제 표지가 숨겨져 있습니다. 로그인 프로필에서 본인·연령 인증과 성인 모드 ON을 완료한 뒤 다시 수집하십시오.'),
                { code:'METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED' }
            );
        }
        const meta = metaMap(html);
        const sourceUrl = canonicalLink(html, finalUrl) ?? absoluteHttpsUrl(meta.get('og:url') ?? '', finalUrl) ?? finalUrl;
        const remoteId = novelpiaNovelId(sourceUrl) ?? novelpiaNovelId(finalUrl);
        if (!remoteId) return null;
        const fields = novelpiaDetailInfo(html);
        const title = fields.title || cleanNovelpiaTitle(meta.get('og:title') ?? meta.get('twitter:title') ?? '');
        if (!title) return null;
        const metaSynopsis = cleanText((meta.get('og:description') ?? meta.get('description') ?? '').replace(/^플러스작품\s*-\s*/u, ''), descriptionMax) || null;
        return {
            remoteId, sourceUrl:`https://novelpia.com/novel/${remoteId}`, title, originalTitle:null,
            author:fields.author, synopsis:fields.synopsis?.slice(0, descriptionMax) ?? metaSynopsis,
            genres:fields.genres, tags:fields.tags, publicationStatus:fields.status, publicationYear:null,
            sourceLanguage:'ko', coverUrl:novelpiaCoverUrl(html, sourceUrl),
            rawSha256:(0, node_crypto_1.createHash)('sha256').update(html).digest('hex')
        };
    }
};
const munpiaWebNovelAdapter = {
    key: 'munpia-webnovel-v1',
    displayName: '문피아 웹소설 자동 검색',
    revision: 5,
    description: '문피아 현재 데스크톱·모바일 검색을 함께 조회하고, 숫자 작품 ID·구형/신형 링크·구조화 데이터를 연결합니다. 상세 페이지는 모바일·데스크톱 응답을 병합해 소개, 장르, 태그, 상태, 등록 연도와 표지를 수집합니다.',
    requestProfile: 'browser-html',
    buildSearchUrl(terms) {
        return `https://www.munpia.com/search?query=${encodeURIComponent(terms.title)}&tab=TAG`;
    },
    buildSearchRequests(terms) {
        const query = encodeURIComponent(terms.title);
        return [
            { url:`https://www.munpia.com/search?query=${query}&tab=TAG`, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'desktop-current', deviceProfile:'desktop', optional:true },
            { url:`https://m.munpia.com/search?query=${query}`, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'mobile-current', deviceProfile:'mobile', optional:true, fallbackOnly:true }
        ];
    },
    buildSearchRequest(terms) { return this.buildSearchRequests(terms)[0]; },
    buildDetailRequests(sourceUrl, remoteId) {
        const id = munpiaNovelId(sourceUrl) ?? (/^\d{3,}$/u.test(String(remoteId || '')) ? String(remoteId) : null);
        if (!id)
            return [];
        return [
            { url:`https://m.munpia.com/novel/detail/${id}`, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'mobile-current', deviceProfile:'mobile', optional:true },
            { url:`https://www.munpia.com/novel/detail/${id}`, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'desktop-current', deviceProfile:'desktop', optional:true, fallbackOnly:true }
        ];
    },
    shouldFetchDetailFallback(documents, sourceUrl, remoteId, descriptionMax) {
        return shouldFetchDetailFallbackFor(this, documents, sourceUrl, remoteId, descriptionMax);
    },
    isDetailUrl(url) { return munpiaNovelId(url) !== null; },
    parseSearchResults(html, finalUrl, terms, limit) {
        const visible = cleanText(html, 30_000);
        if (/접근이\s*제한|비정상적인\s*접근|자동화된\s*요청|captcha|cloudflare|잠시\s*후\s*다시/iu.test(visible))
            throw Object.assign(new Error('문피아 검색 페이지가 자동화 요청을 제한했습니다. Playwright 로그인 프로필 상태를 확인하십시오.'), { code:'METADATA_MUNPIA_ACCESS_BLOCKED' });
        return dedupeAndRank(munpiaSearchCandidates(html, finalUrl), terms, limit);
    },
    parseDetailDocuments(documents, sourceUrl, remoteId, descriptionMax) {
        const id = String(remoteId || munpiaNovelId(sourceUrl) || '');
        return parseDetailDocumentList(this, documents, sourceUrl, id, descriptionMax, munpiaCanonicalUrl(id));
    },
    parseDetail(html, finalUrl, descriptionMax) {
        providerDocumentGate(html, '문피아', { blockCode:'METADATA_MUNPIA_ACCESS_BLOCKED' });
        const meta = metaMap(html);
        const sourceUrl = canonicalLink(html, finalUrl) ?? absoluteHttpsUrl(meta.get('og:url') ?? '', finalUrl) ?? finalUrl;
        const remoteId = munpiaNovelId(sourceUrl) ?? munpiaNovelId(finalUrl);
        if (!remoteId)
            return null;
        const fields = munpiaDetailFields(html, sourceUrl);
        const title = fields.title || cleanMunpiaTitle(meta.get('og:title') ?? meta.get('twitter:title') ?? '');
        if (!title)
            return null;
        return {
            remoteId,
            sourceUrl: munpiaCanonicalUrl(remoteId),
            title,
            originalTitle: null,
            author: fields.author,
            synopsis: fields.synopsis?.slice(0, descriptionMax) ?? (cleanText(meta.get('og:description') ?? meta.get('description') ?? '', descriptionMax) || null),
            genres: fields.genres,
            tags: fields.tags,
            publicationStatus: fields.status,
            publicationYear: fields.publicationYear,
            sourceLanguage: 'ko',
            coverUrl: fields.coverUrl || absoluteHttpsUrl(meta.get('og:image') ?? meta.get('og:image:secure_url') ?? meta.get('twitter:image') ?? '', sourceUrl),
            rawSha256: (0, node_crypto_1.createHash)('sha256').update(html).digest('hex')
        };
    }
};
function joaraDetailMetadata(html, finalUrl, descriptionMax) {
    const meta = metaMap(html);
    const sourceUrl = canonicalLink(html, finalUrl) ?? absoluteHttpsUrl(meta.get('og:url') ?? '', finalUrl) ?? finalUrl;
    const remoteId = joaraBookId(sourceUrl) ?? joaraBookId(finalUrl);
    if (!remoteId)
        return null;
    const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1] ?? '';
    const title = (exactClassTextDeep(html, 'div', 'title', 300)
        || exactClassTextDeep(html, 'h2', 'sub-title', 300)
        || cleanText(meta.get('og:title') ?? meta.get('twitter:title') ?? titleTag, 300))
        .replace(/\s*[-|·:]\s*조아라.*$/iu, '').trim();
    if (!title)
        return null;
    const nicknameBlock = classElementInners(html, 'div', 'nickname', 1)[0] ?? '';
    const author = firstTagText(nicknameBlock, 'button', 300)
        || cleanText(meta.get('author') ?? meta.get('book:author') ?? meta.get('article:author') ?? '', 300) || null;
    const synopsis = exactClassTextDeep(html, 'div', 'book-summary', descriptionMax)
        || cleanText(meta.get('og:description') ?? meta.get('description') ?? '', descriptionMax) || null;
    const sortItemsBlock = classElementInners(html, 'div', 'sort', 1)[0] ?? '';
    const sortValues = joaraSpanTexts(sortItemsBlock || html, 'items');
    const genre = sortValues.find((value) => !/무료|노블|프리|\d+\s*화|완결|연재/iu.test(value))
        || cleanText(meta.get('article:section') ?? meta.get('book:tag') ?? '', 100);
    const keywordBlock = classElementInners(html, 'div', 'keyword', 1)[0] ?? '';
    const adult = /badge-19|icon-adult/iu.test(classElementInners(html, 'div', 'book-info', 1)[0] ?? html);
    const tags = mergeUniqueText((meta.get('keywords') ?? '').split(',').map((item) => item.trim()).filter(Boolean), joaraKeywordTexts(keywordBlock), sortValues.filter((value) => value !== genre && !/\d+\s*화/iu.test(value)), adult ? ['19세'] : []);
    const date = meta.get('article:published_time') ?? '';
    const year = Number.parseInt(date.match(/(?:19|20)\d{2}/u)?.[0] ?? '', 10);
    const statusText = `${meta.get('book:release_date') ?? ''} ${sortValues.join(' ')}`;
    return {
        remoteId,
        sourceUrl: `https://www.joara.com/book/${remoteId}`,
        title,
        originalTitle: null,
        author,
        synopsis,
        genres: genre ? [genre] : [],
        tags,
        publicationStatus: statusFrom(statusText, meta.get('og:description') ?? ''),
        publicationYear: Number.isInteger(year) ? year : null,
        sourceLanguage: 'ko',
        coverUrl: joaraCoverUrl(html, sourceUrl) ?? absoluteHttpsUrl(meta.get('og:image') ?? meta.get('twitter:image') ?? '', sourceUrl),
        rawSha256: (0, node_crypto_1.createHash)('sha256').update(html).digest('hex')
    };
}
const joaraSearchCardAdapter = {
    key: 'joara-search-card-v1',
    displayName: '조아라 공개 검색 카드',
    revision: 5,
    description: '조아라 반응형 검색·상세를 데스크톱 우선, 모바일 장치 프로필 fallback으로 수집합니다. 로그인·성인 인증·접근 제한 페이지를 작품 정보로 오인하지 않고 모바일·데스크톱 상세 필드를 병합합니다.',
    buildSearchUrl(terms) {
        return `https://www.joara.com/search?target=subject&age_constrict=all&store=all&category=0&min_chapter=&max_chapter=&interval=&orderby=score&except_query=&except_target=&chk_finish=&word=${encodeURIComponent(terms.title)}&search=`;
    },
    buildSearchRequests(terms) {
        const url = this.buildSearchUrl(terms);
        return [
            { url, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'desktop-responsive', deviceProfile:'desktop', optional:true },
            { url, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'mobile-responsive', deviceProfile:'mobile', optional:true, fallbackOnly:true }
        ];
    },
    buildSearchRequest(terms) { return this.buildSearchRequests(terms)[0]; },
    buildDetailRequests(sourceUrl, remoteId) {
        const id = joaraBookId(sourceUrl) ?? (/^\d{3,}$/u.test(String(remoteId || '')) ? String(remoteId) : null);
        if (!id) return [];
        const url = `https://www.joara.com/book/${id}`;
        return [
            { url, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'mobile-responsive', deviceProfile:'mobile', optional:true },
            { url, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'desktop-responsive', deviceProfile:'desktop', optional:true, fallbackOnly:true }
        ];
    },
    shouldFetchDetailFallback(documents, sourceUrl, remoteId, descriptionMax) {
        return shouldFetchDetailFallbackFor(this, documents, sourceUrl, remoteId, descriptionMax);
    },
    isDetailUrl(url) { return joaraBookId(url) !== null; },
    parseSearchResults(html, finalUrl, terms, limit) {
        providerDocumentGate(html, '조아라');
        return dedupeAndRank(joaraSearchCardCandidates(html, finalUrl), terms, limit);
    },
    parseDetailDocuments(documents, sourceUrl, remoteId, descriptionMax) {
        return parseDetailDocumentList(this, documents, sourceUrl, remoteId, descriptionMax, `https://www.joara.com/book/${remoteId}`);
    },
    parseDetail(html, finalUrl, descriptionMax) {
        providerDocumentGate(html, '조아라');
        const direct = joaraDetailMetadata(html, finalUrl, descriptionMax);
        if (direct) return direct;
        let remoteId = '';
        try { remoteId = new URL(finalUrl).hash.replace(/^#book-preview-/, ''); } catch {}
        const candidates = joaraSearchCardCandidates(html, finalUrl);
        const selected = remoteId ? candidates.find((candidate) => candidate.remoteId === remoteId) : candidates.length === 1 ? candidates[0] : undefined;
        return selected?.inlineMetadata ?? null;
    }
};
const naverSeriesWebNovelAdapter = {
    key: 'naver-series-webnovel-v1',
    displayName: '네이버 시리즈 웹소설 자동 검색',
    revision: 4,
    description: '네이버 시리즈 데스크톱 검색을 우선 사용하고 결과가 없으면 모바일 검색으로 fallback합니다. 모바일 상세를 우선 수집하고 불충분할 때 데스크톱 상세를 병합하며 로그인·성인 인증·접근 제한을 분리 진단합니다.',
    buildSearchUrl(terms) { return `https://series.naver.com/search/search.series?t=novel&fs=default&q=${encodeURIComponent(terms.title)}`; },
    buildSearchRequests(terms) {
        return [
            { url:this.buildSearchUrl(terms), method:'GET', responseType:'html', requestProfile:'browser-html', variant:'desktop-current', deviceProfile:'desktop', optional:true },
            { url:`https://m.series.naver.com/search/web/search.series?q=${encodeURIComponent(terms.title)}`, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'mobile-current', deviceProfile:'mobile', optional:true, fallbackOnly:true }
        ];
    },
    buildSearchRequest(terms) { return this.buildSearchRequests(terms)[0]; },
    buildDetailRequests(sourceUrl, remoteId) {
        const id = naverSeriesProductNo(sourceUrl) ?? (/^\d{3,}$/u.test(String(remoteId || '')) ? String(remoteId) : null);
        if (!id) return [];
        return [
            { url:`https://m.series.naver.com/novel/detail.series?productNo=${id}`, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'mobile-current', deviceProfile:'mobile', optional:true },
            { url:`https://series.naver.com/novel/detail.series?productNo=${id}`, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'desktop-current', deviceProfile:'desktop', optional:true, fallbackOnly:true }
        ];
    },
    shouldFetchDetailFallback(documents, sourceUrl, remoteId, descriptionMax) {
        return shouldFetchDetailFallbackFor(this, documents, sourceUrl, remoteId, descriptionMax);
    },
    isDetailUrl(url) { return naverSeriesProductNo(url) !== null; },
    parseSearchResults(html, finalUrl, terms, limit) {
        providerDocumentGate(html, '네이버 시리즈');
        return dedupeAndRank(naverSeriesSearchCandidates(html, finalUrl), terms, limit);
    },
    parseDetailDocuments(documents, sourceUrl, remoteId, descriptionMax) {
        return parseDetailDocumentList(this, documents, sourceUrl, remoteId, descriptionMax, `https://series.naver.com/novel/detail.series?productNo=${remoteId}`);
    },
    parseDetail(html, finalUrl, descriptionMax) {
        providerDocumentGate(html, '네이버 시리즈');
        const meta = metaMap(html);
        const sourceUrl = canonicalLink(html, finalUrl) ?? absoluteHttpsUrl(meta.get('og:url') ?? '', finalUrl) ?? finalUrl;
        const productNo = naverSeriesProductNo(sourceUrl) ?? naverSeriesProductNo(finalUrl);
        if (!productNo) return null;
        const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
        const title = cleanNaverSeriesTitle(meta.get('og:title') ?? titleTag);
        if (!title) return null;
        const info = naverSeriesInfo(html);
        const visibleInfo = naverSeriesVisibleInfo(html, descriptionMax);
        const description = splitNaverSeriesDescription(meta.get('og:description') ?? meta.get('description') ?? '', descriptionMax);
        const synopsis = naverSeriesSynopsis(html, descriptionMax) ?? visibleInfo.synopsis ?? description.synopsis;
        const genres = mergeUniqueText(info.genres, visibleInfo.genres);
        const genreKeys = new Set(genres.map((value) => value.toLocaleLowerCase('ko-KR')));
        const tags = mergeUniqueText(description.tags.filter((value) => !genreKeys.has(value.toLocaleLowerCase('ko-KR'))));
        const date = meta.get('article:published_time') ?? '';
        const year = Number.parseInt(date.match(/(?:19|20)\d{2}/)?.[0] ?? '', 10);
        return {
            remoteId:productNo, sourceUrl:`https://series.naver.com/novel/detail.series?productNo=${productNo}`,
            title, originalTitle:null, author:info.author || visibleInfo.author, synopsis, genres, tags,
            publicationStatus:statusFrom(info.statusText, visibleInfo.statusText, meta.get('description') ?? ''), publicationYear:Number.isInteger(year) ? year : null,
            sourceLanguage:'ko', coverUrl:absoluteHttpsUrl(meta.get('og:image') ?? meta.get('twitter:image') ?? '', sourceUrl),
            rawSha256:(0, node_crypto_1.createHash)('sha256').update(html).digest('hex')
        };
    }
};
const KAKAO_BFF_ORIGIN = 'https://bff-page.kakao.com';
const KAKAO_PAGE_ORIGIN = 'https://page.kakao.com';
const KAKAO_STON_IMAGE_PREFIX = 'https://page-images.kakaoentcdn.com/download/resource?kid=';
function recordOrNull(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function kakaoBffResult(document) {
    const root = recordOrNull(document);
    if (!root)
        return null;
    return recordOrNull(root.result);
}
function kakaoOperatorTitle(record) {
    const operator = recordOrNull(record.operator_property) ?? recordOrNull(record.operatorProperty);
    return cleanKakaoTitle(operator ? firstString(operator, ['title'], 300) : '');
}
function kakaoBffSearchCandidates(document) {
    const result = kakaoBffResult(document);
    const list = result?.list;
    if (!Array.isArray(list))
        return [];
    const output = [];
    for (const item of list) {
        const record = recordOrNull(item);
        if (!record)
            continue;
        if (/^SET$/iu.test(firstString(record, ['type'], 30)))
            continue;
        if (!isWebNovelRecord(record))
            continue;
        const remoteId = firstString(record, ['series_id', 'seriesId'], 100);
        if (!/^\d{3,}$/u.test(remoteId))
            continue;
        const title = kakaoOperatorTitle(record)
            || cleanKakaoTitle(firstString(record, ['title', 'series_title', 'seriesTitle'], 300));
        if (title.length < 2)
            continue;
        const author = firstString(record, ['authors', 'author_list', 'authorList'], 300) || null;
        output.push({
            remoteId,
            sourceUrl: `${KAKAO_PAGE_ORIGIN}/content/${remoteId}`,
            title,
            author
        });
    }
    return output;
}
function kakaoBffDocument(document) {
    if (document.responseType !== 'json')
        return null;
    try {
        return recordOrNull(JSON.parse(document.body));
    }
    catch {
        return null;
    }
}
function kakaoImageUrl(value) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text)
        return null;
    if (text.startsWith('//'))
        return `https:${text}`;
    const absolute = absoluteHttpsUrl(text, KAKAO_PAGE_ORIGIN);
    if (absolute && /^https:/u.test(text))
        return absolute;
    if (!/^[A-Za-z0-9._~+/=-]+$/u.test(text))
        return null;
    return `${KAKAO_STON_IMAGE_PREFIX}${text}&filename=o1`;
}
function kakaoAuthor(about, overview) {
    const list = about?.author_list ?? about?.authorList;
    if (Array.isArray(list)) {
        const records = list.map(recordOrNull).filter((item) => Boolean(item));
        const preferred = records.find((item) => /^(?:글|작가|원작|story|writer|author)$/iu.test(firstString(item, ['role_display_name', 'roleDisplayName', 'role'], 100)))
            ?? records[0];
        const value = preferred ? firstString(preferred, ['name'], 300) : '';
        if (value)
            return value;
    }
    return firstString(overview, ['authors', 'author_list', 'authorList'], 300) || null;
}
function kakaoPublicationStatus(overview) {
    const raw = firstString(overview, ['on_issue', 'onIssue', 'state', 'pub_period', 'pubPeriod'], 300).toLocaleLowerCase('en-US');
    if (/^(?:end|ended|complete|completed|finish|finished)$/u.test(raw) || /완결/u.test(raw))
        return 'completed';
    if (/^(?:pause|paused|stop|stopped|hiatus)$/u.test(raw) || /휴재|중단/u.test(raw))
        return 'hiatus';
    if (/^(?:ing|ongoing|serial|serializing|publish|published)$/u.test(raw) || /연재/u.test(raw))
        return 'ongoing';
    return statusFrom(raw);
}
function kakaoBffDetailMetadata(documents, sourceUrl, remoteId, descriptionMax) {
    let overviewResult = null;
    let aboutResult = null;
    for (const document of documents) {
        providerDocumentGate(document.body, '카카오페이지');
        const parsed = kakaoBffDocument(document);
        const result = parsed ? recordOrNull(parsed.result) : null;
        if (!result)
            continue;
        if (document.requestUrl.includes('/content/overview'))
            overviewResult = result;
        else if (document.requestUrl.includes('/content/about'))
            aboutResult = result;
    }
    const overview = overviewResult ? recordOrNull(overviewResult.content) : null;
    if (!overview)
        return null;
    const seriesId = firstString(overview, ['series_id', 'seriesId'], 100);
    if (seriesId !== remoteId)
        return null;
    const title = kakaoOperatorTitle(overview)
        || cleanKakaoTitle(firstString(overview, ['title', 'series_title', 'seriesTitle'], 300));
    if (!title)
        return null;
    const detail = aboutResult ? recordOrNull(aboutResult.detail) : null;
    const synopsis = cleanText(firstString(aboutResult ?? {}, ['description'], descriptionMax)
        || firstString(overview, ['description'], descriptionMax), descriptionMax) || null;
    const genres = normalizeGenres(mergeUniqueText(detail ? textList(detail.category_list ?? detail.categoryList) : [], textList(overview.sub_category ?? overview.subCategory), textList(overview.category)));
    const themeKeywordValue = aboutResult?.theme_keyword_list ?? aboutResult?.themeKeywordList;
    const tags = mergeUniqueText(textList(themeKeywordValue));
    const normalizedTags = Array.isArray(themeKeywordValue)
        ? themeKeywordValue.map((item) => {
            const record = recordOrNull(item);
            return record ? firstString(record, ['title'], 100) : '';
        }).filter(Boolean)
        : tags;
    const date = firstString(overview, ['start_sale_dt', 'startSaleDt', 'last_slide_added_dt', 'lastSlideAddedDt'], 100);
    const year = Number.parseInt(date.match(/(?:19|20)\d{2}/u)?.[0] ?? '', 10);
    const lang = firstString(overview, ['lang', 'language'], 30).toLocaleLowerCase('en-US');
    const sourceLanguage = /^(?:ko|kor|ko-kr)$/u.test(lang) || !lang ? 'ko' : lang.slice(0, 16);
    const coverUrl = kakaoImageUrl(overview.thumbnail);
    const rawSha256 = (0, node_crypto_1.createHash)('sha256').update(documents
        .map((document) => `${document.requestUrl}\n${document.body}`)
        .sort()
        .join('\n---\n')).digest('hex');
    return {
        remoteId,
        sourceUrl: `${KAKAO_PAGE_ORIGIN}/content/${remoteId}`,
        title,
        originalTitle: null,
        author: kakaoAuthor(aboutResult, overview),
        synopsis,
        genres,
        tags: mergeUniqueText(normalizedTags),
        publicationStatus: kakaoPublicationStatus(overview),
        publicationYear: Number.isInteger(year) ? year : null,
        sourceLanguage,
        coverUrl,
        rawSha256
    };
}
const kakaoPageWebNovelAdapter = {
    key: 'kakaopage-webnovel-v1',
    displayName: '카카오페이지 웹소설 자동 검색',
    revision: 12,
    description: '카카오페이지 BFF 검색·overview/about 상세를 로그인 Playwright page context에서 우선 요청하고, 결과 없음 또는 상세 불충분 시 모바일 렌더링 페이지를 fallback으로 병합합니다. 로그인 요구·연령 확인·접근 제한을 별도 오류로 진단합니다.',
    requestProfile: 'kakaopage-json',
    buildSearchUrl(terms, limit) { return this.buildSearchRequest(terms, limit).url; },
    buildSearchRequest(terms, limit) {
        const url = new URL('/api/gateway/api/v2/search/series', KAKAO_BFF_ORIGIN);
        url.searchParams.set('keyword', terms.title);
        url.searchParams.set('category_uid', '11');
        url.searchParams.set('is_complete', 'false');
        url.searchParams.set('sort_type', 'ACCURACY');
        url.searchParams.set('page', '0');
        url.searchParams.set('size', String(Math.max(1, Math.min(25, Math.trunc(limit)))));
        return {
            url:url.toString(), method:'GET', responseType:'json', requestProfile:'kakaopage-json',
            referer:`${KAKAO_PAGE_ORIGIN}/search/result/?keyword=${encodeURIComponent(terms.title)}`,
            variant:'bff-desktop', deviceProfile:'desktop'
        };
    },
    buildSearchRequests(terms, limit) {
        return [
            this.buildSearchRequest(terms, limit),
            { url:`${KAKAO_PAGE_ORIGIN}/search/result/?keyword=${encodeURIComponent(terms.title)}`, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'mobile-rendered', deviceProfile:'mobile', optional:true, fallbackOnly:true }
        ];
    },
    isDetailUrl(url) { return contentIdFromUrl(url) !== null; },
    parseSearchResults(html, finalUrl, terms, limit) {
        providerDocumentGate(html, '카카오페이지');
        const candidates = [];
        const documents = jsonDocuments(html);
        let hasBffEnvelope = false;
        for (const document of documents) {
            const result = kakaoBffResult(document);
            if (Array.isArray(result?.list)) hasBffEnvelope = true;
            candidates.push(...kakaoBffSearchCandidates(document));
        }
        let host = '';
        try { host = new URL(finalUrl).hostname.toLowerCase(); } catch {}
        if (host === 'bff-page.kakao.com' && !hasBffEnvelope) throw new Error('카카오페이지 REST 검색 응답에 result.list가 없습니다.');
        if (!candidates.length && !hasBffEnvelope) {
            const renderedEventCandidates = kakaoRenderedEventCandidates(html, finalUrl);
            if (renderedEventCandidates.length) candidates.push(...renderedEventCandidates);
            else {
                const renderedAnchorCandidates = anchorCandidates(html, finalUrl);
                if (renderedAnchorCandidates.length) candidates.push(...renderedAnchorCandidates);
                else candidates.push(...kakaoSerializedCandidates(html, finalUrl, terms));
            }
        }
        return dedupeAndRank(candidates, terms, limit);
    },
    buildDetailRequests(sourceUrl, remoteId) {
        if (contentIdFromUrl(sourceUrl) !== remoteId || !/^\d{3,}$/u.test(remoteId)) return [];
        const referer = `${KAKAO_PAGE_ORIGIN}/content/${remoteId}/?tab_type=about`;
        return [
            { url:`${KAKAO_BFF_ORIGIN}/api/gateway/api/v1/content/overview?series_id=${remoteId}`, method:'GET', responseType:'json', requestProfile:'kakaopage-json', referer, variant:'bff-overview', deviceProfile:'desktop' },
            { url:`${KAKAO_BFF_ORIGIN}/api/gateway/api/v1/content/about?series_id=${remoteId}`, method:'GET', responseType:'json', requestProfile:'kakaopage-json', referer, variant:'bff-about', deviceProfile:'desktop', optional:true, fallbackOnly:true },
            { url:referer, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'mobile-rendered', deviceProfile:'mobile', optional:true, fallbackOnly:true }
        ];
    },
    shouldFetchDetailFallback(documents, sourceUrl, remoteId, descriptionMax) {
        const bff = kakaoBffDetailMetadata(documents || [], sourceUrl, remoteId, descriptionMax);
        return !isDetailMetadataSufficient(bff);
    },
    parseDetailDocuments(documents, sourceUrl, remoteId, descriptionMax) {
        const items = [];
        const bff = kakaoBffDetailMetadata(documents || [], sourceUrl, remoteId, descriptionMax);
        if (bff) items.push(bff);
        for (const document of Array.isArray(documents) ? documents : []) {
            if (document.responseType === 'json') continue;
            const parsed = this.parseDetail(document.body, document.finalUrl || document.requestUrl || sourceUrl, descriptionMax);
            if (parsed) items.push(parsed);
        }
        return mergeDetailMetadata(items, { remoteId, sourceUrl:`${KAKAO_PAGE_ORIGIN}/content/${remoteId}` });
    },
    parseDetail(html, finalUrl, descriptionMax) {
        providerDocumentGate(html, '카카오페이지');
        const meta = metaMap(html);
        const canonicalUrl = absoluteHttpsUrl(meta.get('og:url') ?? '', finalUrl) ?? finalUrl;
        const contentId = contentIdFromUrl(canonicalUrl) ?? contentIdFromUrl(finalUrl);
        if (!contentId) return null;
        const record = bestDetailRecord(html, contentId);
        const titleTag = cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '', 300);
        const metaTitle = cleanKakaoTitle(meta.get('og:title') ?? meta.get('twitter:title') ?? titleTag);
        const recordTitle = cleanKakaoTitle(record ? firstString(record, ['contentTitle','seriesTitle','productName','title','name'], 300) : '');
        const title = metaTitle || recordTitle;
        if (!title) return null;
        const author = cleanText(meta.get('author') ?? meta.get('book:author') ?? '', 300)
            || (record ? firstString(record, ['authorName','writerName','author','writer','creator','creators','authors'], 300) : '') || null;
        const metaDescription = meta.get('og:description') ?? meta.get('description') ?? '';
        const recordDescription = record ? firstString(record, ['synopsis','description','summary','introduction','intro','storySummary','plot'], descriptionMax) : '';
        const description = splitKakaoDescription(metaDescription || recordDescription, descriptionMax);
        const visible = visibleBodyText(html);
        const titleIndex = visible.indexOf(title);
        const mainWindow = titleIndex >= 0 ? visible.slice(titleIndex, titleIndex + 800) : '';
        const visibleGenre = cleanText(mainWindow.match(/웹소설\s+([^\s·|,]{1,40})/iu)?.[1] ?? '', 100);
        const recordGenres = normalizeGenres(record ? firstList(record, ['genres','genre','subcategoryName','subCategoryName','categoryName']) : []);
        const genres = normalizeGenres(mergeUniqueText(recordGenres, visibleGenre ? [visibleGenre] : []));
        const tags = mergeUniqueText(record ? firstList(record, ['keywords','keyword','tags','tagList','hashtags']) : [], description.tags, kakaoVisibleTags(html));
        const statusValue = record ? firstString(record, ['publicationStatus','serialStatus','status','complete','completed','isComplete'], 300) : '';
        const date = record ? firstString(record, ['datePublished','publishedAt','publishDate','startDate'], 100) : '';
        const year = Number.parseInt(date.match(/(?:19|20)\d{2}/)?.[0] ?? '', 10);
        return {
            remoteId:contentId, sourceUrl:`${KAKAO_PAGE_ORIGIN}/content/${contentId}`, title, originalTitle:null,
            author, synopsis:description.synopsis, genres, tags, publicationStatus:statusFrom(statusValue, mainWindow, title),
            publicationYear:Number.isInteger(year) ? year : null, sourceLanguage:'ko',
            coverUrl:absoluteHttpsUrl(meta.get('og:image') ?? meta.get('twitter:image') ?? '', canonicalUrl) ?? (record ? firstImage(record, canonicalUrl) : null),
            rawSha256:(0, node_crypto_1.createHash)('sha256').update(html).digest('hex')
        };
    }
};
const adapters = new Map([
    [ssnSeriesAdapter.key, ssnSeriesAdapter],
    [kakaoPageWebNovelAdapter.key, kakaoPageWebNovelAdapter],
    [naverSeriesWebNovelAdapter.key, naverSeriesWebNovelAdapter],
    [novelpiaWebNovelAdapter.key, novelpiaWebNovelAdapter],
    [munpiaWebNovelAdapter.key, munpiaWebNovelAdapter],
    [joaraSearchCardAdapter.key, joaraSearchCardAdapter]
]);
function getMetadataSiteAdapter(key) {
    return adapters.get(key) ?? null;
}
function listMetadataSiteAdapters() {
    return [
        {
            key: 'openlibrary-api-v1',
            displayName: 'Open Library 공개 API',
            revision: 1,
            description: '공개 JSON API의 작품명 검색 결과를 사용합니다.'
        },
        ...[...adapters.values()].map((adapter) => ({
            key: adapter.key,
            displayName: adapter.displayName,
            revision: adapter.revision,
            description: adapter.description
        }))
    ];
}
function getMetadataSiteAdapterDescriptor(key) {
    if (key === 'generic-selector')
        return {
            key: 'generic-selector',
            displayName: '고급 사용자 정의 selector',
            revision: 1,
            description: '승인된 URL과 제한 selector를 사용하는 고급 fallback provider입니다.'
        };
    return listMetadataSiteAdapters().find((adapter) => adapter.key === key) ?? null;
}

exports.METADATA_ADAPTER_CPU_GUARD_PASS = METADATA_ADAPTER_CPU_GUARD_PASS;
