'use strict';

const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { metadataTitleSimilarity } = require('./metadata-site-adapters');

const CONFIGURABLE_PROVIDER_PASS = 'v667-configurable-metadata-provider-pass';
const MAX_SELECTOR_LENGTH = 240;
const MAX_CONFIGURABLE_HTML_BYTES = 2 * 1024 * 1024;
const MAX_CONFIGURABLE_DOM_NODES = 50000;
const MAX_CONFIGURABLE_DOM_DEPTH = 512;
const MAX_CONFIGURABLE_QUERY_MS = 250;
const CONFIGURABLE_PROVIDER_BUDGET_PASS = 'v671-configurable-provider-budget-pass';
const SELECTOR_FIELDS = Object.freeze([
  'searchResult','searchTitle','searchAuthor','searchLink','searchId','searchCover',
  'detailTitle','detailAuthor','detailSynopsis','detailGenres','detailTags','detailCover'
]);
const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const NAMED_ENTITIES = Object.freeze({ amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ', middot:'·', hellip:'…' });

function clean(value, max = 1000) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function decodeEntities(value) {
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_match, entity) => {
    if (/^#x/i.test(entity)) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return NAMED_ENTITIES[entity.toLowerCase()] || '';
  });
}

function normalizeText(value, max = 5000) {
  return clean(decodeEntities(String(value || '')).replace(/\s+/g, ' '), max);
}

function normalizeList(value, maxItems = 30, maxLength = 120) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[\n,|/·]+/u);
  return Array.from(new Set(list.map(item => normalizeText(item, maxLength)).filter(Boolean))).slice(0, maxItems);
}

function parseAttributes(source) {
  const attrs = Object.create(null);
  const text = String(source || '');
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = re.exec(text))) {
    const name = String(match[1] || '').toLowerCase();
    if (!name || name === '/') continue;
    attrs[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

function createBudgetError(message, code) {
  return Object.assign(new Error(message), { code, pass:CONFIGURABLE_PROVIDER_BUDGET_PASS });
}

function parseHtml(html, options = {}) {
  const root = { type:'root', tag:'#root', attrs:Object.create(null), children:[], parent:null, depth:0 };
  const stack = [root];
  const source = String(html || '');
  const maxBytes = Math.max(64 * 1024, Math.min(8 * 1024 * 1024, Number(options.maxBytes) || MAX_CONFIGURABLE_HTML_BYTES));
  const maxNodes = Math.max(1000, Math.min(200000, Number(options.maxNodes) || MAX_CONFIGURABLE_DOM_NODES));
  const maxDepth = Math.max(32, Math.min(2048, Number(options.maxDepth) || MAX_CONFIGURABLE_DOM_DEPTH));
  if (Buffer.byteLength(source, 'utf8') > maxBytes) throw createBudgetError('고급 공급자 HTML 응답이 허용 크기를 초과했습니다.', 'METADATA_SELECTOR_HTML_TOO_LARGE');
  const tokenRe = /<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>/g;
  let cursor = 0;
  let match;
  let nodes = 0;
  while ((match = tokenRe.exec(source))) {
    if (match.index > cursor) {
      const text = source.slice(cursor, match.index);
      if (text) {
        nodes += 1;
        if (nodes > maxNodes) throw createBudgetError('고급 공급자 HTML 노드 수가 제한을 초과했습니다.', 'METADATA_SELECTOR_NODE_LIMIT');
        stack[stack.length - 1].children.push({ type:'text', text, parent:stack[stack.length - 1], depth:stack.length });
      }
    }
    const token = match[0];
    cursor = tokenRe.lastIndex;
    if (token.startsWith('<!--') || token.startsWith('<!')) continue;
    const closing = /^<\//.test(token);
    const tagMatch = token.match(/^<\/?\s*([A-Za-z][\w:-]*)/);
    const tag = String(tagMatch && tagMatch[1] || '').toLowerCase();
    if (!tag) continue;
    if (closing) {
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === tag) { stack.length = index; break; }
      }
      continue;
    }
    const depth = stack.length;
    if (depth > maxDepth) throw createBudgetError('고급 공급자 HTML 중첩 깊이가 제한을 초과했습니다.', 'METADATA_SELECTOR_DEPTH_LIMIT');
    nodes += 1;
    if (nodes > maxNodes) throw createBudgetError('고급 공급자 HTML 노드 수가 제한을 초과했습니다.', 'METADATA_SELECTOR_NODE_LIMIT');
    const attrSource = token.slice(tagMatch[0].length, token.length - (token.endsWith('/>') ? 2 : 1));
    const node = { type:'element', tag, attrs:parseAttributes(attrSource), children:[], parent:stack[stack.length - 1], depth };
    stack[stack.length - 1].children.push(node);
    if (!VOID_TAGS.has(tag) && !token.endsWith('/>')) stack.push(node);
  }
  if (cursor < source.length) {
    const text = source.slice(cursor);
    if (text) {
      nodes += 1;
      if (nodes > maxNodes) throw createBudgetError('고급 공급자 HTML 노드 수가 제한을 초과했습니다.', 'METADATA_SELECTOR_NODE_LIMIT');
      stack[stack.length - 1].children.push({ type:'text', text, parent:stack[stack.length - 1], depth:stack.length });
    }
  }
  root.nodeCount = nodes;
  return root;
}

function splitSelector(selector) {
  const value = clean(selector, MAX_SELECTOR_LENGTH);
  if (!value) return [];
  if (/[>,+~:*]/u.test(value)) {
    throw Object.assign(new Error('고급 공급자 selector는 tag, #id, .class, [attr=value], 하위 선택자만 지원합니다.'), { code:'METADATA_SELECTOR_UNSUPPORTED' });
  }
  const parts = [];
  let current = '';
  let depth = 0;
  let quote = '';
  for (const char of value) {
    if (quote) {
      current += char;
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") { quote = char; current += char; continue; }
    if (char === '[') depth += 1;
    if (char === ']') depth = Math.max(0, depth - 1);
    if (/\s/u.test(char) && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  if (!parts.length || parts.length > 8) throw Object.assign(new Error('고급 공급자 selector 깊이가 올바르지 않습니다.'), { code:'METADATA_SELECTOR_INVALID' });
  return parts.map(parseSimpleSelector);
}

function parseSimpleSelector(part) {
  const source = String(part || '');
  let cursor = 0;
  const spec = { tag:'', id:'', classes:[], attrs:[] };
  const tagMatch = source.slice(cursor).match(/^[A-Za-z][\w-]*/);
  if (tagMatch) { spec.tag = tagMatch[0].toLowerCase(); cursor += tagMatch[0].length; }
  while (cursor < source.length) {
    const remaining = source.slice(cursor);
    let match;
    if ((match = remaining.match(/^#([\w-]+)/))) { spec.id = match[1]; cursor += match[0].length; continue; }
    if ((match = remaining.match(/^\.([\w-]+)/))) { spec.classes.push(match[1]); cursor += match[0].length; continue; }
    if ((match = remaining.match(/^\[([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]/))) {
      spec.attrs.push({ name:match[1].toLowerCase(), value:match[2] ?? match[3] ?? (match[4] == null ? null : match[4].trim()) });
      cursor += match[0].length;
      continue;
    }
    throw Object.assign(new Error(`지원하지 않는 selector 토큰입니다: ${source}`), { code:'METADATA_SELECTOR_INVALID' });
  }
  if (!spec.tag && !spec.id && !spec.classes.length && !spec.attrs.length) throw Object.assign(new Error('빈 selector는 사용할 수 없습니다.'), { code:'METADATA_SELECTOR_INVALID' });
  return spec;
}

function matchesSimple(node, spec) {
  if (!node || node.type !== 'element') return false;
  if (spec.tag && node.tag !== spec.tag) return false;
  if (spec.id && String(node.attrs.id || '') !== spec.id) return false;
  const classes = new Set(String(node.attrs.class || '').split(/\s+/u).filter(Boolean));
  if (spec.classes.some(item => !classes.has(item))) return false;
  return spec.attrs.every(item => Object.prototype.hasOwnProperty.call(node.attrs, item.name) && (item.value == null || String(node.attrs[item.name]) === item.value));
}

function selectorChainMatches(node, chain, boundary) {
  if (!matchesSimple(node, chain[chain.length - 1])) return false;
  let ancestor = node.parent;
  for (let index = chain.length - 2; index >= 0; index -= 1) {
    while (ancestor && ancestor !== boundary && !matchesSimple(ancestor, chain[index])) ancestor = ancestor.parent;
    if (!ancestor || ancestor === boundary) return false;
    ancestor = ancestor.parent;
  }
  return true;
}

function queryAll(root, selector, options = {}) {
  const chain = splitSelector(selector);
  if (!chain.length) return [];
  const maxMs = Math.max(10, Math.min(2000, Number(options.maxMs) || MAX_CONFIGURABLE_QUERY_MS));
  const started = performance.now();
  const results = [];
  const stack = [];
  const children = Array.isArray(root && root.children) ? root.children : [];
  for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
  let visited = 0;
  while (stack.length) {
    const node = stack.pop();
    visited += 1;
    if ((visited & 511) === 0 && performance.now() - started > maxMs) throw createBudgetError('고급 공급자 selector 처리 시간이 제한을 초과했습니다.', 'METADATA_SELECTOR_TIME_LIMIT');
    if (node && node.type === 'element') {
      if (selectorChainMatches(node, chain, root)) results.push(node);
      const descendants = Array.isArray(node.children) ? node.children : [];
      for (let index = descendants.length - 1; index >= 0; index -= 1) stack.push(descendants[index]);
    }
  }
  return results;
}

function textContent(node) {
  if (!node) return '';
  const parts = [];
  const stack = [node];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    if (current.type === 'text') { parts.push(current.text || ''); continue; }
    if (current.type === 'element' && (current.tag === 'script' || current.tag === 'style' || current.tag === 'noscript')) continue;
    const children = Array.isArray(current.children) ? current.children : [];
    for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
  }
  return parts.join(' ');
}

function firstValue(root, selector, attribute = '') {
  if (!selector) return '';
  const node = queryAll(root, selector)[0];
  if (!node) return '';
  if (attribute) return normalizeText(node.attrs[String(attribute).toLowerCase()] || '', 4000);
  return normalizeText(textContent(node), 8000);
}

function allValues(root, selector, attribute = '') {
  if (!selector) return [];
  return queryAll(root, selector).map(node => attribute
    ? normalizeText(node.attrs[String(attribute).toLowerCase()] || '', 1000)
    : normalizeText(textContent(node), 1000)).filter(Boolean);
}

function safeHttpsTemplate(value, field, requiredToken = '') {
  const template = clean(value, 2400);
  if (!template) return '';
  const probe = template.replace(/\{(?:query|limit|id|url)\}/g, 'placeholder');
  let parsed;
  try { parsed = new URL(probe); } catch { throw Object.assign(new Error(`${field} URL 템플릿이 올바르지 않습니다.`), { code:'METADATA_PROVIDER_DEFINITION_INVALID', field }); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || (parsed.port && parsed.port !== '443')) {
    throw Object.assign(new Error(`${field}는 자격 증명과 fragment가 없는 HTTPS 443 URL이어야 합니다.`), { code:'METADATA_PROVIDER_DEFINITION_INVALID', field });
  }
  if (requiredToken && !template.includes(requiredToken)) throw Object.assign(new Error(`${field}에 ${requiredToken} 토큰이 필요합니다.`), { code:'METADATA_PROVIDER_DEFINITION_INVALID', field });
  return template;
}

function templateUrl(template, values) {
  return String(template || '').replace(/\{(query|limit|id|url)\}/g, (_match, key) => encodeURIComponent(String(values[key] == null ? '' : values[key])));
}

function templateDescriptor(template) {
  if (!template) return null;
  const probe = template.replace(/\{(?:query|limit|id|url)\}/g, 'placeholder');
  const parsed = new URL(probe);
  const rawPath = String(template).replace(/^https:\/\/[^/]+/iu, '').split(/[?#]/u)[0] || '/';
  const tokenIndex = rawPath.search(/\{/u);
  let prefix = tokenIndex >= 0 ? rawPath.slice(0, tokenIndex) : rawPath;
  if (!prefix.startsWith('/')) prefix = '/';
  if (tokenIndex >= 0 && !prefix.endsWith('/')) prefix = prefix.slice(0, prefix.lastIndexOf('/') + 1) || '/';
  return { host:parsed.hostname.toLowerCase(), pathPrefix:prefix || '/' };
}

function validateSelector(selector, field, required = false) {
  const value = clean(selector, MAX_SELECTOR_LENGTH);
  if (!value && required) throw Object.assign(new Error(`${field} selector가 필요합니다.`), { code:'METADATA_PROVIDER_DEFINITION_INVALID', field });
  if (value) splitSelector(value);
  return value;
}

function normalizeDefinition(input = {}, options = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const kind = options.kind === 'builtin' ? 'builtin' : 'custom';
  const rawId = clean(options.id || source.id, 80).toLowerCase();
  const id = kind === 'builtin' ? rawId : (rawId.startsWith('custom-') ? rawId : `custom-${rawId}`);
  if (kind === 'custom' && !/^custom-[a-z0-9][a-z0-9-]{1,63}$/u.test(id)) throw Object.assign(new Error('사용자 정의 공급자 ID는 영문 소문자·숫자·하이픈으로 입력해야 합니다.'), { code:'METADATA_PROVIDER_DEFINITION_INVALID', field:'id' });
  const name = clean(source.name || options.name, 100);
  if (!name) throw Object.assign(new Error('공급자 이름이 필요합니다.'), { code:'METADATA_PROVIDER_DEFINITION_INVALID', field:'name' });
  const mode = kind === 'custom' ? 'selector' : (source.mode === 'selector' ? 'selector' : 'request');
  const searchUrlTemplate = safeHttpsTemplate(source.searchUrlTemplate, '검색 URL', '{query}');
  const detailUrlTemplate = safeHttpsTemplate(source.detailUrlTemplate, '상세정보 URL');
  const selectors = {};
  const rawSelectors = source.selectors && typeof source.selectors === 'object' ? source.selectors : {};
  const requiredSelectors = mode === 'selector' ? new Set(['searchResult','searchTitle','searchLink','detailTitle']) : new Set();
  for (const field of SELECTOR_FIELDS) selectors[field] = validateSelector(rawSelectors[field], field, requiredSelectors.has(field));
  const attributes = {
    searchLink:clean(source.attributes?.searchLink || 'href', 40).toLowerCase(),
    searchId:clean(source.attributes?.searchId || '', 40).toLowerCase(),
    searchCover:clean(source.attributes?.searchCover || 'src', 40).toLowerCase(),
    detailCover:clean(source.attributes?.detailCover || 'src', 40).toLowerCase()
  };
  for (const [field, value] of Object.entries(attributes)) if (value && !/^[a-z_:][a-z0-9_.:-]*$/u.test(value)) throw Object.assign(new Error(`${field} attribute가 올바르지 않습니다.`), { code:'METADATA_PROVIDER_DEFINITION_INVALID', field });
  const search = templateDescriptor(searchUrlTemplate);
  const detail = templateDescriptor(detailUrlTemplate || searchUrlTemplate);
  return {
    schemaVersion:1,
    kind,
    id,
    name,
    mode,
    description:clean(source.description, 500),
    searchUrlTemplate,
    detailUrlTemplate,
    selectors,
    attributes,
    revision:Math.max(1, Math.min(9999, Number(source.revision) || 1)),
    searchHosts:Array.from(new Set([search?.host].filter(Boolean))),
    detailHosts:Array.from(new Set([detail?.host, search?.host].filter(Boolean))),
    coverHosts:Array.from(new Set([...(Array.isArray(source.coverHosts) ? source.coverHosts : String(source.coverHosts || '').split(/[\s,]+/u)), search?.host, detail?.host].map(value => clean(value, 255).toLowerCase()).filter(Boolean))).slice(0, 20),
    allowedPathPrefixes:Array.from(new Set([search?.pathPrefix, detail?.pathPrefix].filter(Boolean))),
    updatedAt:clean(source.updatedAt, 40) || new Date().toISOString(),
    pass:CONFIGURABLE_PROVIDER_PASS
  };
}

function absoluteHttpsUrl(value, base) {
  const text = clean(value, 2400);
  if (!text) return '';
  try {
    const parsed = new URL(text, base);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : '';
  } catch { return ''; }
}

function remoteIdFrom(sourceUrl, explicit = '') {
  const value = clean(explicit, 160);
  if (value) return value;
  try {
    const parsed = new URL(sourceUrl);
    const queryId = ['id','productNo','series_id','novel_no','bookCode'].map(key => parsed.searchParams.get(key)).find(Boolean);
    if (queryId) return clean(queryId, 160);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return clean(segments.reverse().find(segment => /\d/u.test(segment)) || segments[0] || crypto.createHash('sha256').update(parsed.href).digest('hex').slice(0, 20), 160);
  } catch { return crypto.createHash('sha256').update(String(sourceUrl || '')).digest('hex').slice(0, 20); }
}

function createConfigurableProvider(definitionInput, baseProvider = null) {
  const definition = normalizeDefinition(definitionInput, {
    kind:baseProvider ? 'builtin' : 'custom',
    id:baseProvider?.id || definitionInput?.id,
    name:definitionInput?.name || baseProvider?.name
  });
  if (definition.mode !== 'selector') throw Object.assign(new Error('selector 공급자 정의가 필요합니다.'), { code:'METADATA_PROVIDER_DEFINITION_MODE_INVALID' });
  const adapter = {
    key:`configurable-selector:${definition.id}`,
    displayName:definition.name,
    revision:definition.revision,
    description:definition.description || '관리자 정의 URL과 제한 selector를 사용하는 공급자입니다.',
    requestProfile:'default',
    buildSearchRequest(terms, limit) {
      return { url:templateUrl(definition.searchUrlTemplate, { query:terms?.title || terms || '', limit:Math.max(1, Math.min(10, Number(limit) || 5)) }), method:'GET', responseType:'html', requestProfile:'default', variant:'configurable-selector' };
    },
    parseSearchResults(html, finalUrl, expected, limit) {
      const document = parseHtml(html);
      const cards = queryAll(document, definition.selectors.searchResult).slice(0, Math.max(1, Math.min(30, Number(limit) || 5)) * 4);
      const results = [];
      for (const card of cards) {
        const title = firstValue(card, definition.selectors.searchTitle);
        const rawLink = firstValue(card, definition.selectors.searchLink, definition.attributes.searchLink || 'href');
        const sourceUrl = absoluteHttpsUrl(rawLink, finalUrl);
        if (!title || !sourceUrl) continue;
        const author = firstValue(card, definition.selectors.searchAuthor);
        const explicitId = firstValue(card, definition.selectors.searchId, definition.attributes.searchId || '');
        const coverRemoteUrl = absoluteHttpsUrl(firstValue(card, definition.selectors.searchCover, definition.attributes.searchCover || 'src'), finalUrl);
        const titleScore = metadataTitleSimilarity(expected?.title || '', title);
        const authorScore = expected?.author && author ? metadataTitleSimilarity(expected.author, author) : 1;
        const matchScore = Math.max(0, Math.min(1, titleScore * 0.9 + authorScore * 0.1));
        results.push({
          remoteId:remoteIdFrom(sourceUrl, explicitId),
          sourceUrl,
          title,
          author,
          matchScore,
          inlineMetadata:null,
          coverRemoteUrl
        });
      }
      return results.sort((a,b) => b.matchScore - a.matchScore).slice(0, Math.max(1, Math.min(10, Number(limit) || 5)));
    },
    buildDetailRequests(sourceUrl, remoteId) {
      const url = definition.detailUrlTemplate
        ? templateUrl(definition.detailUrlTemplate, { id:remoteId, url:sourceUrl })
        : sourceUrl;
      return [{ url, method:'GET', responseType:'html', requestProfile:'default', variant:'configurable-selector-detail' }];
    },
    isDetailUrl(value) {
      try {
        const parsed = new URL(String(value || ''));
        return definition.detailHosts.includes(parsed.hostname.toLowerCase());
      } catch { return false; }
    },
    parseDetail(html, finalUrl, descriptionMax = 8000) {
      const document = parseHtml(html);
      const title = firstValue(document, definition.selectors.detailTitle);
      if (!title) throw Object.assign(new Error('상세 페이지 title selector에서 값을 찾지 못했습니다.'), { code:'METADATA_DETAIL_EMPTY' });
      const author = firstValue(document, definition.selectors.detailAuthor, '', 300);
      const synopsis = firstValue(document, definition.selectors.detailSynopsis).slice(0, descriptionMax);
      const coverRemoteUrl = absoluteHttpsUrl(firstValue(document, definition.selectors.detailCover, definition.attributes.detailCover || 'src'), finalUrl);
      return {
        remoteId:remoteIdFrom(finalUrl),
        sourceUrl:finalUrl,
        title,
        author,
        synopsis,
        genres:normalizeList(allValues(document, definition.selectors.detailGenres), 24, 100),
        tags:normalizeList(allValues(document, definition.selectors.detailTags), 40, 100),
        coverRemoteUrl,
        rawSha256:crypto.createHash('sha256').update(String(html || '')).digest('hex')
      };
    }
  };
  return {
    ...(baseProvider || {}),
    id:definition.id,
    name:definition.name,
    adapterKey:adapter.key,
    priority:Number(baseProvider?.priority) || 100,
    searchHosts:definition.searchHosts,
    detailHosts:definition.detailHosts,
    allowedPathPrefixes:definition.allowedPathPrefixes,
    coverHosts:definition.coverHosts,
    browserProfileSupported:false,
    supportsSearch:true,
    supportsDirect:true,
    revision:definition.revision,
    description:adapter.description,
    providerKind:baseProvider ? 'builtin' : 'custom',
    definitionMode:'selector',
    definition,
    adapter,
    pass:CONFIGURABLE_PROVIDER_PASS
  };
}

function replacePrimaryRequestUrl(requests, url) {
  const list = Array.isArray(requests) ? requests.map(item => ({ ...(item || {}) })) : [];
  if (!list.length) return url ? [{ url, method:'GET', responseType:'html', requestProfile:'browser-html', variant:'owner-request-override' }] : [];
  if (url) list[0].url = url;
  return list;
}

function createBuiltinRequestOverrideProvider(definitionInput, baseProvider) {
  if (!baseProvider || !baseProvider.adapter) throw new Error('builtin provider adapter is required');
  const definition = normalizeDefinition(definitionInput, { kind:'builtin', id:baseProvider.id, name:definitionInput?.name || baseProvider.name });
  if (definition.mode !== 'request') throw Object.assign(new Error('request override 공급자 정의가 필요합니다.'), { code:'METADATA_PROVIDER_DEFINITION_MODE_INVALID' });
  const baseAdapter = baseProvider.adapter;
  const adapter = { ...baseAdapter, key:`${baseAdapter.key || baseProvider.adapterKey}:request-override-r${definition.revision}`, revision:definition.revision, displayName:definition.name, description:definition.description || baseAdapter.description || '' };
  if (typeof baseAdapter.buildSearchRequests === 'function') {
    adapter.buildSearchRequests = (terms, limit) => replacePrimaryRequestUrl(
      baseAdapter.buildSearchRequests(terms, limit),
      templateUrl(definition.searchUrlTemplate, { query:terms?.title || terms || '', limit:Math.max(1, Math.min(10, Number(limit) || 5)) })
    );
  } else {
    adapter.buildSearchRequest = (terms, limit) => {
      const request = typeof baseAdapter.buildSearchRequest === 'function' ? baseAdapter.buildSearchRequest(terms, limit) : {};
      return { ...(request || {}), url:templateUrl(definition.searchUrlTemplate, { query:terms?.title || terms || '', limit:Math.max(1, Math.min(10, Number(limit) || 5)) }) };
    };
  }
  if (definition.detailUrlTemplate) {
    adapter.buildDetailRequests = (sourceUrl, remoteId) => replacePrimaryRequestUrl(
      typeof baseAdapter.buildDetailRequests === 'function' ? baseAdapter.buildDetailRequests(sourceUrl, remoteId) : [],
      templateUrl(definition.detailUrlTemplate, { id:remoteId, url:sourceUrl })
    );
  }
  return {
    ...baseProvider,
    name:definition.name,
    adapterKey:adapter.key,
    searchHosts:Array.from(new Set([...(baseProvider.searchHosts || []), ...(definition.searchHosts || [])])),
    detailHosts:Array.from(new Set([...(baseProvider.detailHosts || []), ...(definition.detailHosts || [])])),
    allowedPathPrefixes:Array.from(new Set([...(baseProvider.allowedPathPrefixes || []), ...(definition.allowedPathPrefixes || [])])),
    coverHosts:Array.from(new Set([...(baseProvider.coverHosts || []), ...(definition.coverHosts || [])])),
    revision:definition.revision,
    description:definition.description || baseProvider.description || '',
    providerKind:'builtin',
    definitionMode:'request',
    definition,
    adapter,
    pass:CONFIGURABLE_PROVIDER_PASS
  };
}

module.exports = {
  CONFIGURABLE_PROVIDER_PASS,
  CONFIGURABLE_PROVIDER_BUDGET_PASS,
  MAX_CONFIGURABLE_HTML_BYTES,
  MAX_CONFIGURABLE_DOM_NODES,
  MAX_CONFIGURABLE_DOM_DEPTH,
  SELECTOR_FIELDS,
  normalizeDefinition,
  createConfigurableProvider,
  createBuiltinRequestOverrideProvider,
  parseHtml,
  queryAll,
  firstValue
};
