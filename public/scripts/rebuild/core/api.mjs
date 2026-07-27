export const OWNER_SESSION_READER_SHELL_REDIRECT_PASS = 'v455-owner-session-reader-shell-redirect-pass';

export class ApiClient {
  constructor({ deviceId }) {
    this.deviceId = deviceId;
    this.csrfToken = '';
  }

  async ensureCsrf() {
    if (this.csrfToken) return this.csrfToken;
    const data = await this.get('/api/csrf', { noRedirect: true });
    this.csrfToken = data.csrfToken || '';
    return this.csrfToken;
  }


  shouldUseReaderRevalidationCache(path, method) {
    if (String(method || '').toUpperCase() !== 'GET') return false;
    let pathname = '';
    try {
      pathname = new URL(String(path || ''), window.location.origin).pathname;
    } catch {
      pathname = String(path || '').split('?')[0];
    }
    if (pathname === '/api/novels') return true;
    if (pathname === '/api/novels/shelf') return true;
    if (pathname === '/api/novels/shelf/filters') return true;
    if (pathname === '/api/novels/shelf/filter-folders') return true;
    if (pathname === '/api/novels/shelf/filter-tags') return true;
    if (pathname === '/api/novels/tree') return true;
    if (/^\/api\/novels\/[^/]+\/meta$/.test(pathname)) return true;
    if (/^\/api\/novels\/[^/]+\/episodes$/.test(pathname)) return true;
    if (/^\/api\/novels\/[^/]+\/content$/.test(pathname)) return true;
    if (/^\/api\/novels\/[^/]+\/block-manifest$/.test(pathname)) return true;
    if (/^\/api\/novels\/[^/]+\/episodes\/[^/]+$/.test(pathname)) return true;
    if (/^\/api\/novels\/[^/]+\/episodes\/[^/]+\/block-manifest$/.test(pathname)) return true;
    return false;
  }

  async request(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    headers.set('X-Device-Id', this.deviceId);
    const resolvedSiteLanguage = String(
      globalThis.document?.documentElement?.dataset?.siteLanguage
      || globalThis.localStorage?.getItem?.('txtReaderSiteLanguageResolved')
      || globalThis.navigator?.language
      || 'ko'
    ).trim().slice(0, 48);
    headers.set('X-Txt-Reader-Site-Language', resolvedSiteLanguage || 'ko');

    const init = {
      method,
      credentials: 'same-origin',
      headers,
      cache: this.shouldUseReaderRevalidationCache(path, method) ? 'no-cache' : 'no-store'
    };
    if (options.signal) init.signal = options.signal;
    if (options.keepalive === true) init.keepalive = true;

    if (method !== 'GET' && method !== 'HEAD') {
      const csrf = await this.ensureCsrf();
      if (csrf) headers.set('X-CSRF-Token', csrf);
      if (options.rawBody != null) {
        init.body = options.rawBody;
      } else if (options.body != null) {
        headers.set('Content-Type', 'application/json');
        init.body = JSON.stringify(options.body);
      }
    }

    const res = await fetch(path, init);
    if (res.status === 401 && !options.noRedirect) {
      location.href = '/login.html';
      throw new Error('로그인이 필요합니다.');
    }

    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
    }
    if (!res.ok) {
      if (res.status === 403 && data && data.error === 'csrf blocked' && method !== 'GET' && method !== 'HEAD' && !options._csrfRetried) {
        this.csrfToken = '';
        return this.request(path, { ...options, _csrfRetried:true });
      }
      if (res.status === 403 && data && data.error === 'reader_user_session_required' && !options.noRedirect) {
        try { sessionStorage.setItem('txtReaderOwnerReaderShellRedirectPass', OWNER_SESSION_READER_SHELL_REDIRECT_PASS); } catch (e) {}
        if (typeof location !== 'undefined' && !/\/admin\/users\.html$/.test(location.pathname || '')) location.href = '/admin/users.html';
      }
      const err = new Error((data && (data.message || data.error)) || `${res.status} ${res.statusText}`);
      err.status = res.status;
      err.data = data;
      err.code = String(data?.error || '');
      err.retryAfterSeconds = Math.max(0, Number(res.headers.get('Retry-After')) || 0);
      throw err;
    }
    return data || {};
  }

  get(path, options) { return this.request(path, { ...(options || {}), method: 'GET' }); }
  post(path, body, options) { return this.request(path, { ...(options || {}), method: 'POST', body }); }
  put(path, body, options) { return this.request(path, { ...(options || {}), method: 'PUT', body }); }
  patch(path, body, options) { return this.request(path, { ...(options || {}), method: 'PATCH', body }); }
  delete(path, body, options) { return this.request(path, { ...(options || {}), method: 'DELETE', body }); }

  withFileopsConfirmation(options, action) {
    const nextOptions = { ...(options || {}) };
    const headers = new Headers(nextOptions.headers || {});
    headers.set('X-Confirm-Action', action);
    nextOptions.headers = headers;
    return nextOptions;
  }

  novels(options) { return this.get('/api/novels', options); }
  novelShelf({ scope = 'all', sort = 'title', query = '', cursor = '', limit = 48, focusNovelId = '', filters = {} } = {}, options) {
    const qs = new URLSearchParams();
    qs.set('scope', String(scope || 'all'));
    qs.set('sort', String(sort || 'title'));
    qs.set('limit', String(Math.max(12, Math.min(100, Number(limit) || 48))));
    if (cursor) qs.set('cursor', String(cursor));
    if (query) qs.set('q', String(query).trim().slice(0, 80));
    if (focusNovelId) qs.set('focusNovelId', String(focusNovelId));
    const appendMany = (key, values) => {
      const source = Array.isArray(values) ? values : [];
      source.map(value => String(value || '').trim()).filter(Boolean).forEach(value => qs.append(key, value));
    };
    appendMany('status', filters.publicationStatuses);
    appendMany('author', filters.authors);
    appendMany('category', filters.categories);
    appendMany('tag', filters.tags);
    appendMany('group', filters.groupKinds);
    appendMany('metadataStatus', filters.metadataStatuses);
    appendMany('metadataProvider', filters.metadataProviderIds);
    appendMany('folder', filters.folderPaths);
    return this.get(`/api/novels/shelf?${qs.toString()}`, options);
  }
  novelShelfFilters(options) { return this.get('/api/novels/shelf/filters', options); }
  novelShelfFilterFolders({ cursor = '', limit = 500, query = '', selected = '' } = {}, options) {
    const qs = new URLSearchParams();
    qs.set('limit', String(Math.max(1, Math.min(500, Number(limit) || 500))));
    if (cursor) qs.set('cursor', String(cursor));
    if (query) qs.set('q', String(query).trim().slice(0, 160));
    if (selected) qs.set('selected', String(selected).trim().slice(0, 480));
    return this.get(`/api/novels/shelf/filter-folders?${qs.toString()}`, options);
  }
  novelShelfFilterTags({ cursor = '', limit = 500, minCount = 1, query = '' } = {}, options) {
    const qs = new URLSearchParams();
    qs.set('limit', String(Math.max(1, Math.min(500, Number(limit) || 500))));
    qs.set('minCount', String(Math.max(1, Math.floor(Number(minCount) || 1))));
    if (cursor) qs.set('cursor', String(cursor));
    if (query) qs.set('q', String(query).trim().slice(0, 80));
    return this.get(`/api/novels/shelf/filter-tags?${qs.toString()}`, options);
  }
  novelTree({ cursor = '', limit = 1000, focusNovelId = '' } = {}, options) {
    const qs = new URLSearchParams();
    qs.set('limit', String(Math.max(100, Math.min(2000, Number(limit) || 1000))));
    if (cursor) qs.set('cursor', String(cursor));
    if (focusNovelId) qs.set('focusNovelId', String(focusNovelId));
    return this.get(`/api/novels/tree?${qs.toString()}`, options);
  }
  novelMeta(novelId, options) { return this.get(`/api/novels/${encodeURIComponent(novelId)}/meta`, options); }
  metadataProviders(options) { return this.get('/api/metadata/providers', options); }
  metadataStorage(options) { return this.get('/api/metadata/storage', options); }
  previewMetadataCandidateCleanup(payload = {}, options) { return this.post('/api/metadata/storage/cleanup/preview', payload, options); }
  cleanupMetadataCandidates(payload = {}, options) { return this.post('/api/metadata/storage/cleanup', payload, options); }
  rewriteMetadataCompressedStore(options) { return this.post('/api/metadata/storage/rewrite', {}, options); }
  novelMetadata(novelId, options) { return this.get(`/api/novels/${encodeURIComponent(novelId)}/metadata`, options); }
  collectNovelMetadata(novelId, payload = {}, options) { return this.post(`/api/novels/${encodeURIComponent(novelId)}/metadata/collect`, payload, options); }
  createMetadataBrowserCapturePairing(novelId, options) { return this.post(`/api/novels/${encodeURIComponent(novelId)}/metadata/browser-capture/pairing`, {}, options); }
  importMetadataBrowserCapture(novelId, payload = {}, options) { return this.post(`/api/novels/${encodeURIComponent(novelId)}/metadata/browser-capture/import`, payload, options); }
  collectMissingMetadata(payload = {}, options) { return this.post('/api/metadata/collect-missing', payload, options); }
  applyPendingMetadata(options) { return this.post('/api/metadata/apply-pending', {}, options); }
  applyNovelMetadata(novelId, payload = {}, options) { return this.post(`/api/novels/${encodeURIComponent(novelId)}/metadata/apply`, payload, options); }
  saveManualNovelMetadata(novelId, payload = {}, options) { return this.put(`/api/novels/${encodeURIComponent(novelId)}/metadata/manual`, payload, options); }
  uploadManualNovelCover(novelId, file, options = {}) {
    const headers = new Headers(options.headers || {});
    // The browser-reported File.type is advisory and may be text/plain,
    // application/json, or empty for renamed/.file cover images. Always use a
    // binary transport type so the route-specific raw parser receives the body;
    // the server performs the authoritative signature check.
    headers.set('Content-Type', 'application/octet-stream');
    const originalType = String(file?.type || '').trim().slice(0, 120);
    if (originalType) headers.set('X-Cover-Original-Type', originalType);
    headers.set('X-Cover-Filename', encodeURIComponent(String(file?.name || 'cover').slice(0, 240)));
    return this.request(`/api/novels/${encodeURIComponent(novelId)}/metadata/manual-cover`, {
      ...options,
      method:'POST',
      headers,
      rawBody:file
    });
  }
  deleteMetadataCandidate(novelId, candidateId, options) { return this.delete(`/api/novels/${encodeURIComponent(novelId)}/metadata/candidates/${encodeURIComponent(candidateId)}`, {}, options); }
  deleteMetadataCandidateGroup(novelId, candidateGroupId, options) { return this.delete(`/api/novels/${encodeURIComponent(novelId)}/metadata/candidate-groups/${encodeURIComponent(candidateGroupId)}`, {}, options); }
  deleteNovelMetadata(novelId, options) { return this.delete(`/api/novels/${encodeURIComponent(novelId)}/metadata`, {}, options); }
  metadataJobs(limit = 50, options) { return this.get(`/api/metadata/jobs?limit=${encodeURIComponent(Math.max(1, Math.min(200, Number(limit) || 50)))}`, options); }
  metadataJob(jobId, options) { return this.get(`/api/metadata/jobs/${encodeURIComponent(jobId)}`, options); }
  cancelMetadataJob(jobId, options) { return this.post(`/api/metadata/jobs/${encodeURIComponent(jobId)}/cancel`, {}, options); }
  probeMetadataProvider(providerId, payload = {}, options) { return this.post(`/api/metadata/providers/${encodeURIComponent(providerId)}/probe`, payload, options); }
  updateMetadataProvider(providerId, payload = {}, options) { return this.put(`/api/metadata/providers/${encodeURIComponent(providerId)}`, payload, options); }
  createCustomMetadataProvider(payload = {}, options) { return this.post('/api/metadata/providers/custom', payload, options); }
  updateMetadataProviderDefinition(providerId, payload = {}, options) { return this.put(`/api/metadata/providers/${encodeURIComponent(providerId)}/definition`, payload, options); }
  deleteMetadataProviderDefinition(providerId, options) { return this.delete(`/api/metadata/providers/${encodeURIComponent(providerId)}/definition`, {}, options); }
  startMetadataProviderBrowserLogin(providerId, payload = {}, options) { return this.post(`/api/metadata/providers/${encodeURIComponent(providerId)}/browser-login/start`, payload, options); }
  metadataProviderBrowserLoginSession(providerId, sessionId, options) { return this.get(`/api/metadata/providers/${encodeURIComponent(providerId)}/browser-login/session?sessionId=${encodeURIComponent(sessionId)}`, options); }
  metadataProviderBrowserLoginAction(providerId, payload = {}, options) { return this.post(`/api/metadata/providers/${encodeURIComponent(providerId)}/browser-login/action`, payload, options); }
  finishMetadataProviderBrowserLogin(providerId, sessionId, options) { return this.post(`/api/metadata/providers/${encodeURIComponent(providerId)}/browser-login/finish`, { sessionId }, options); }
  cancelMetadataProviderBrowserLogin(providerId, sessionId, options) { return this.delete(`/api/metadata/providers/${encodeURIComponent(providerId)}/browser-login/session`, { sessionId }, options); }
  deleteMetadataProviderBrowserProfile(providerId, options) { return this.delete(`/api/metadata/providers/${encodeURIComponent(providerId)}/browser-profile`, {}, options); }
  metadataProviderBrowserScreenshotUrl(providerId, sessionId, serial = Date.now()) { return `/api/metadata/providers/${encodeURIComponent(providerId)}/browser-login/screenshot?sessionId=${encodeURIComponent(sessionId)}&v=${encodeURIComponent(serial)}`; }

  novelEpisodes(novelId, options) { return this.get(`/api/novels/${encodeURIComponent(novelId)}/episodes`, options); }
  userAccessSnapshot(options = {}) {
    const requestOptions = { ...(options || {}) };
    const includeNovelIds = requestOptions.includeNovelIds === true;
    delete requestOptions.includeNovelIds;
    return this.get(`/api/user-access/snapshot${includeNovelIds ? '?includeNovelIds=1' : ''}`, requestOptions);
  }
  themeBootstrap(options) { return this.get('/api/theme-bootstrap', options); }
  userState(options) { return this.get('/api/user-state', options); }
  putShared(shared, options) { return this.put('/api/user-state/shared', shared, options); }
  putProgress(progressEnvelope, options) { return this.put('/api/user-state/progress', progressEnvelope, options); }
  patchProgressNovel(novelId, progressEnvelope, options) { return this.patch(`/api/user-state/progress/${encodeURIComponent(novelId)}`, progressEnvelope, options); }
  putDevice(device, options) { return this.put('/api/user-state/device', device, options); }
  fonts(options) { return this.get('/api/fonts', options); }
  searchPerformanceProfile(options) { return this.get('/api/search-performance-profile', options); }
  changeAccountPassword(currentPassword, newPassword, newPasswordConfirm, options) { return this.post('/api/account/password', { currentPassword, newPassword, newPasswordConfirm }, options); }
  logout(options) { return this.post('/api/logout', {}, options); }

  renameNovel(novelId, title, options) { return this.patch(`/api/novels/${encodeURIComponent(novelId)}/rename`, { title }, this.withFileopsConfirmation(options, 'fileops-rename')); }
  moveNovel(novelId, targetCategoryPath, options) { return this.patch(`/api/novels/${encodeURIComponent(novelId)}/move`, { targetCategoryPath: targetCategoryPath || '' }, this.withFileopsConfirmation(options, 'fileops-move')); }
  deleteNovel(novelId, options) { return this.delete(`/api/novels/${encodeURIComponent(novelId)}`, { confirmText: 'DELETE' }, this.withFileopsConfirmation(options, 'fileops-delete')); }
  renameEpisode(novelId, episodeId, title, options) { return this.patch(`/api/novels/${encodeURIComponent(novelId)}/episodes/${encodeURIComponent(episodeId)}/rename`, { title }, this.withFileopsConfirmation(options, 'fileops-rename')); }
  moveEpisode(novelId, episodeId, targetCategoryPath, options) { return this.patch(`/api/episodes/${encodeURIComponent(novelId)}/${encodeURIComponent(episodeId)}/move`, { targetCategoryPath: targetCategoryPath || '' }, this.withFileopsConfirmation(options, 'fileops-move')); }
  deleteEpisode(novelId, episodeId, options) { return this.delete(`/api/novels/${encodeURIComponent(novelId)}/episodes/${encodeURIComponent(episodeId)}`, { confirmText: 'DELETE' }, this.withFileopsConfirmation(options, 'fileops-delete')); }
  renameFolder(categoryPath, newName, options) { return this.patch('/api/folders/rename', { categoryPath, newName }, this.withFileopsConfirmation(options, 'fileops-rename')); }
  moveFolder(categoryPath, targetCategoryPath, options) { return this.patch('/api/folders/move', { categoryPath, targetCategoryPath: targetCategoryPath || '' }, this.withFileopsConfirmation(options, 'fileops-move')); }
  deleteFolder(categoryPath, options) { return this.delete('/api/folders', { categoryPath, confirmText: options?.confirmText || 'DELETE' }, this.withFileopsConfirmation(options, 'fileops-delete')); }

  async uploadFont(file, family) {
    const headers = {
      'Content-Type': 'application/octet-stream',
      'X-Font-Filename': encodeURIComponent(file.name),
      'X-Font-Family': family || file.name.replace(/\.[^.]+$/, '')
    };
    return this.request('/api/fonts/upload', {
      method: 'POST',
      headers,
      rawBody: await file.arrayBuffer()
    });
  }

  deleteFont(filename) {
    return this.delete(`/api/fonts/${encodeURIComponent(filename)}`);
  }

  appendPreprocessFlags(qs, preprocess = {}) {
    const p = preprocess || {};
    const setFlag = (name, value) => qs.set(name, value ? '1' : '0');
    setFlag('preRemoveNoise', !!p.removeNoise);
    setFlag('preChapterSpacing', !!p.chapterSpacing);
    setFlag('preCollapseBreaks', !!p.collapseBreaks);
    setFlag('preSplitDense', !!p.splitDense);
    setFlag('preDialogueBreak', !!p.dialogueBreak);
    setFlag('preParagraphOptimize', !!p.paragraphOptimize);
    setFlag('preAggressive', !!p.aggressive);
    return qs;
  }

  contentUrl({ novelId, episodeId, chunk = 1, preprocess = {} }) {
    const qs = this.appendPreprocessFlags(new URLSearchParams(), preprocess);
    qs.set('chunk', String(chunk));
    const base = episodeId
      ? `/api/novels/${encodeURIComponent(novelId)}/episodes/${encodeURIComponent(episodeId)}`
      : `/api/novels/${encodeURIComponent(novelId)}/content`;
    return `${base}?${qs.toString()}`;
  }

  content(args, options = {}) {
    return this.get(this.contentUrl(args), options);
  }

  blockManifestUrl({ novelId, episodeId, preprocess = {}, centerEpisodeId = '', centerEpisodeIndex = null, folderManifestScope = '', folderManifestRadius = null } = {}) {
    const qs = this.appendPreprocessFlags(new URLSearchParams(), preprocess);
    const base = episodeId
      ? `/api/novels/${encodeURIComponent(novelId)}/episodes/${encodeURIComponent(episodeId)}/block-manifest`
      : `/api/novels/${encodeURIComponent(novelId)}/block-manifest`;
    if (!episodeId) {
      if (centerEpisodeId) qs.set('centerEpisodeId', String(centerEpisodeId));
      if (Number.isInteger(Number(centerEpisodeIndex))) qs.set('centerEpisodeIndex', String(Math.max(0, Number(centerEpisodeIndex))));
      if (folderManifestScope) qs.set('folderManifestScope', String(folderManifestScope));
      if (Number.isInteger(Number(folderManifestRadius))) qs.set('folderManifestRadius', String(Math.max(0, Number(folderManifestRadius))));
    }
    return `${base}?${qs.toString()}`;
  }

  blockManifest(args, options = {}) {
    return this.get(this.blockManifestUrl(args), options);
  }
}
