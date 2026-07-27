export const CLIENT_ACCESS_STATE_FILTER_PASS = 'v613-client-access-state-filter-pass';

function positionBelongsToAllowedNovel(key, allowed) {
  const raw = String(key || '');
  if (!raw.startsWith('pos-')) return false;
  const body = raw.slice(4);
  for (const novelId of allowed) {
    if (body === novelId || body.startsWith(`${novelId}-`)) return true;
  }
  return false;
}

export function filterLocalStateForAllowedNovelIds(state, allowedNovelIds = []) {
  if (!state) return null;
  const allowed = new Set((Array.isArray(allowedNovelIds) ? allowedNovelIds : []).map(value => String(value || '')).filter(Boolean));
  const progress = state.progress && typeof state.progress === 'object' ? state.progress : {};
  const next = { lastRead:null, byNovel:{}, readMeta:{}, positions:{} };
  if (progress.lastRead?.novelId && allowed.has(String(progress.lastRead.novelId))) next.lastRead = progress.lastRead;
  for (const [novelId, value] of Object.entries(progress.byNovel || {})) if (allowed.has(String(novelId))) next.byNovel[novelId] = value;
  for (const [key, value] of Object.entries(progress.readMeta || {})) if (value?.novelId && allowed.has(String(value.novelId))) next.readMeta[key] = value;
  for (const [key, value] of Object.entries(progress.positions || {})) if (positionBelongsToAllowedNovel(key, allowed)) next.positions[key] = value;
  state.progress = next;
  if (state.favorites instanceof Set) state.favorites = new Set(Array.from(state.favorites).filter(id => allowed.has(String(id))));
  if (Array.isArray(state.recents)) state.recents = state.recents.filter(item => allowed.has(String(item?.novelId || item?.id || '')));
  if (Array.isArray(state.bookmarks)) state.bookmarks = state.bookmarks.filter(item => allowed.has(String(item?.novelId || '')));
  if (state.novelUserTags && typeof state.novelUserTags === 'object') {
    state.novelUserTags = Object.fromEntries(Object.entries(state.novelUserTags).filter(([novelId]) => allowed.has(String(novelId))));
  }
  state.clientAccessStateFilter = { pass:CLIENT_ACCESS_STATE_FILTER_PASS, allowedNovelCount:allowed.size, at:Date.now() };
  return state.clientAccessStateFilter;
}
