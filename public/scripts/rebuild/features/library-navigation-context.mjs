export const LIBRARY_NAVIGATION_CONTEXT_PASS = 'v575-library-navigation-context-pass';

function clean(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

export function readLibraryNavigationContext(locationObject = globalThis.location) {
  try {
    const url = new URL(locationObject?.href || '', locationObject?.origin || 'http://local.invalid');
    const requestedView = url.searchParams.get('view');
    const view = ['files','explorer'].includes(requestedView) ? requestedView : 'shelf';
    const novelId = clean(url.searchParams.get('focusNovelId') || url.searchParams.get('novelId'), 200);
    const episodeId = clean(url.searchParams.get('focusEpisodeId') || url.searchParams.get('episodeId'), 200);
    return {
      pass:LIBRARY_NAVIGATION_CONTEXT_PASS,
      novelId,
      episodeId,
      view,
      source:clean(url.searchParams.get('from'), 40),
      requested:!!novelId,
      shelfPending:!!novelId,
      treePending:!!novelId,
      createdAt:Date.now()
    };
  } catch {
    return { pass:LIBRARY_NAVIGATION_CONTEXT_PASS, novelId:'', episodeId:'', view:'shelf', source:'', requested:false, shelfPending:false, treePending:false, createdAt:Date.now() };
  }
}

export function currentReaderIdentity(app, locationObject = globalThis.location) {
  const current = app?.state?.current || null;
  if (current?.novel?.id) {
    return {
      novelId:clean(current.novel.id, 200),
      episodeId:clean(current.episode?.id, 200)
    };
  }
  try {
    const url = new URL(locationObject?.href || '', locationObject?.origin || 'http://local.invalid');
    return {
      novelId:clean(url.searchParams.get('novelId'), 200),
      episodeId:clean(url.searchParams.get('episodeId'), 200)
    };
  } catch {
    return { novelId:'', episodeId:'' };
  }
}

export function buildLibraryPageUrlForReader(app, options = {}) {
  const locationObject = options.locationObject || globalThis.location;
  const identity = currentReaderIdentity(app, locationObject);
  const url = new URL('/library.html', locationObject?.origin || 'http://local.invalid');
  if (identity.novelId) url.searchParams.set('focusNovelId', identity.novelId);
  if (identity.episodeId) url.searchParams.set('focusEpisodeId', identity.episodeId);
  url.searchParams.set('view', ['files','explorer'].includes(options.view) ? options.view : 'shelf');
  url.searchParams.set('from', 'reader');
  return `${url.pathname}${url.search}`;
}

export function getLibraryNavigationIdentity(state = {}) {
  const target = state.libraryNavigationTarget || null;
  if (!target?.novelId) return { novelId:'', episodeId:'' };
  return { novelId:String(target.novelId || ''), episodeId:String(target.episodeId || '') };
}

export function novelMatchesNavigationTarget(novel, target) {
  const id = String(target?.novelId || '');
  if (!id || !novel) return false;
  if (String(novel.id || '') === id) return true;
  const aliases = Array.isArray(novel.progressAliases) ? novel.progressAliases : Array.isArray(novel.variantMemberIds) ? novel.variantMemberIds : [];
  return aliases.map(String).includes(id);
}
