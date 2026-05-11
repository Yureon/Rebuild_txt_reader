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

    const init = {
      method,
      credentials: 'same-origin',
      headers,
      cache: this.shouldUseReaderRevalidationCache(path, method) ? 'no-cache' : 'no-store'
    };
    if (options.signal) init.signal = options.signal;

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
      if (res.status === 403 && data && data.error === 'reader_user_session_required' && !options.noRedirect) {
        try { sessionStorage.setItem('txtReaderOwnerReaderShellRedirectPass', OWNER_SESSION_READER_SHELL_REDIRECT_PASS); } catch (e) {}
        if (typeof location !== 'undefined' && !/\/admin\/users\.html$/.test(location.pathname || '')) location.href = '/admin/users.html';
      }
      const err = new Error((data && (data.error || data.message)) || `${res.status} ${res.statusText}`);
      err.status = res.status;
      err.data = data;
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
  userAccessSnapshot(options) { return this.get('/api/user-access/snapshot', options); }
  userState(options) { return this.get('/api/user-state', options); }
  putShared(shared, options) { return this.put('/api/user-state/shared', shared, options); }
  putProgress(progressEnvelope, options) { return this.put('/api/user-state/progress', progressEnvelope, options); }
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
