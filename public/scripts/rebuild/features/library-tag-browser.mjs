export const LIBRARY_TAG_BROWSER_PASS = 'v603-library-tag-browser-pass';
const PAGE_LIMIT = 500;
const INITIAL_EXPANDED_LIMIT = 500;

function tagKey(value) { return String(value || '').trim().toLocaleLowerCase('ko-KR'); }
function mergeItems(base = [], additions = []) {
  const out = Array.isArray(base) ? base.slice() : [];
  const known = new Set(out.map(item => tagKey(item?.value)).filter(Boolean));
  for (const item of (Array.isArray(additions) ? additions : [])) {
    const key = tagKey(item?.value);
    if (!key || known.has(key)) continue;
    known.add(key);
    out.push(item);
  }
  return out;
}

export async function loadInitialExpandedTagFacets(app, payload, initialItems, signal, minCount = 1, maxItems = INITIAL_EXPANDED_LIMIT) {
  const threshold = Math.max(1, Number(minCount) || 1);
  let items = Array.isArray(initialItems) ? initialItems.slice() : [];
  let cursor = threshold === 1 ? String(payload?.tagPage?.nextCursor || '') : '';
  let hasMore = threshold === 1 ? !!payload?.tagPage?.hasMore : true;
  let total = threshold === 1 ? Math.max(items.length, Number(payload?.tagPage?.total) || 0) : items.length;
  while (hasMore && items.length < maxItems) {
    const page = await app.api.novelShelfFilterTags({ cursor, limit:Math.min(PAGE_LIMIT, maxItems-items.length), minCount:threshold }, { signal });
    items = mergeItems(items, page?.items);
    total = Math.max(total, Number(page?.total) || 0);
    const nextCursor = String(page?.nextCursor || '');
    hasMore = !!page?.hasMore && !!nextCursor && nextCursor !== cursor;
    cursor = nextCursor;
  }
  return { items, nextCursor:cursor, hasMore, total, minCount:threshold, pass:LIBRARY_TAG_BROWSER_PASS };
}

export async function loadMoreTagFacets(app, pageState = {}, signal) {
  const minCount = Math.max(1, Number(pageState.minCount) || 1);
  const cursor = String(pageState.nextCursor || '');
  if (!pageState.hasMore || !cursor) return { items:[], nextCursor:'', hasMore:false, total:Number(pageState.total)||0, minCount, pass:LIBRARY_TAG_BROWSER_PASS };
  const page = await app.api.novelShelfFilterTags({ cursor, limit:PAGE_LIMIT, minCount }, { signal });
  return { items:Array.isArray(page?.items)?page.items:[], nextCursor:String(page?.nextCursor||''), hasMore:!!page?.hasMore, total:Math.max(0,Number(page?.total)||0), minCount, pass:LIBRARY_TAG_BROWSER_PASS };
}

export async function searchTagFacets(app, query, minCount, signal) {
  const text = String(query || '').trim().slice(0,80);
  const threshold = Math.max(1,Number(minCount)||1);
  if (!text) return { query:'', items:[], total:0, nextCursor:'', hasMore:false, minCount:threshold, pass:LIBRARY_TAG_BROWSER_PASS };
  const page = await app.api.novelShelfFilterTags({ query:text, limit:200, minCount:threshold }, { signal });
  return { query:text, items:Array.isArray(page?.items)?page.items:[], total:Math.max(0,Number(page?.total)||0), nextCursor:String(page?.nextCursor||''), hasMore:!!page?.hasMore, minCount:threshold, pass:LIBRARY_TAG_BROWSER_PASS };
}

export async function loadMoreTagSearchFacets(app, searchState = {}, signal) {
  const query = String(searchState.query || '').trim().slice(0,80);
  const cursor = String(searchState.nextCursor || '');
  const minCount = Math.max(1, Number(searchState.minCount) || 1);
  if (!query || !cursor || !searchState.hasMore) return { query, items:[], total:Number(searchState.total)||0, nextCursor:'', hasMore:false, minCount, pass:LIBRARY_TAG_BROWSER_PASS };
  const page = await app.api.novelShelfFilterTags({ query, cursor, limit:200, minCount }, { signal });
  return { query, items:Array.isArray(page?.items)?page.items:[], total:Math.max(0,Number(page?.total)||0), nextCursor:String(page?.nextCursor||''), hasMore:!!page?.hasMore, minCount, pass:LIBRARY_TAG_BROWSER_PASS };
}
