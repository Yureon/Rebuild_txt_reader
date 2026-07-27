import { createEl, formatPercent } from '../../core/utils.mjs';
import { toast } from '../ui.mjs';
import { getSyncShare } from './device-management.mjs';
import { formatRelativeTime } from './sync-formatters.mjs';
import { openOptionsFromSnapshot } from '../library-paths.mjs';

export const REMOTE_RESUME_REFACTOR_PASS = 'v177-remote-resume-pass';

export function installRemoteResumeActions(app) {
  app.resumeRemotePosition = () => resumeRemotePosition(app);
  app.syncRemoteResume = {
    resume: () => resumeRemotePosition(app),
    hide: () => hideRemoteResumeDock(app),
    offer: (summary, options = {}) => handleRemoteResumeOffer(app, summary, options)
  };
  return app.syncRemoteResume;
}

export function handleRemoteResumeOffer(app, summary, options = {}) {
  const share = getSyncShare(app);
  if (share.otherDeviceAlert === false) {
    hideRemoteResumeDock(app);
    return;
  }
  const authority = summary?.progressAuthority || null;
  const lastRead = authority?.lastRead || null;
  if (!authority?.shouldOfferRemoteResume || !lastRead) {
    hideRemoteResumeDock(app);
    return;
  }
  const key = remoteResumeKey(authority);
  if (!key || key === app.state.remoteResumeAcceptedKey || key === app.state.remoteResumeDismissedKey) return;
  app.state.remoteResumeOfferKey = key;
  showRemoteResumeDock(app, authority);
  if (options.notify && app.state.remoteResumeNotifiedKey !== key) {
    app.state.remoteResumeNotifiedKey = key;
    toast(app, authority.isFromPreferredDevice ? 'success' : 'info', '다른 기기 위치 감지', `${authority.sourceDeviceName || '다른 기기'}에서 저장된 읽기 위치가 있습니다.`, 5200);
  }
}

export function remoteResumeKey(authority) {
  const lastRead = authority?.lastRead || null;
  if (!lastRead) return '';
  return [authority.sourceDeviceId || '', lastRead.novelId || '', lastRead.episodeId || 'single', authority.sourceSavedAt || lastRead.ts || 0].join('|');
}

function ensureRemoteResumeDock(app) {
  let dock = document.getElementById('remote-resume-dock');
  if (!dock) {
    dock = createEl('div', { id:'remote-resume-dock', class:'remote-resume-dock', hidden:'hidden' }, [
      createEl('div', { class:'remote-resume-dock__body' }, [
        createEl('div', { class:'remote-resume-dock__title', text:'다른 기기 위치' }),
        createEl('div', { id:'remote-resume-dock-text', class:'remote-resume-dock__text', text:'-' })
      ]),
      createEl('button', { id:'remote-resume-dock-go', class:'remote-resume-dock__btn', type:'button', text:'이동' }),
      createEl('button', { id:'remote-resume-dock-close', class:'remote-resume-dock__close', type:'button', text:'✕', title:'닫기' })
    ]);
    document.body.append(dock);
  }
  installRemoteResumeDockHandlers(app, dock);
  return dock;
}

function installRemoteResumeDockHandlers(app, dock) {
  if (app.remoteResumeDockElement === dock && app.remoteResumeDockCleanup) return;
  app.remoteResumeDockCleanup?.();
  const go = dock.querySelector('#remote-resume-dock-go');
  const close = dock.querySelector('#remote-resume-dock-close');
  if (go) go.onclick = () => resumeRemotePosition(app);
  if (close) close.onclick = () => {
    app.state.remoteResumeDismissedKey = app.state.remoteResumeOfferKey || '';
    hideRemoteResumeDock(app);
  };
  app.remoteResumeDockElement = dock;
  app.remoteResumeDockCleanup = () => {
    if (go) go.onclick = null;
    if (close) close.onclick = null;
    if (app.remoteResumeDockElement === dock) app.remoteResumeDockElement = null;
    app.remoteResumeDockCleanup = null;
  };
}

function showRemoteResumeDock(app, authority) {
  const dock = ensureRemoteResumeDock(app);
  const lastRead = authority?.lastRead || null;
  const pos = typeof lastRead?.documentRatio === 'number' ? ` · ${formatPercent(lastRead.documentRatio, 1)}` : '';
  const when = authority?.sourceSavedAt ? ` · ${formatRelativeTime(authority.sourceSavedAt)}` : '';
  const text = `${authority?.sourceDeviceName || '다른 기기'}${pos}${when}`;
  const textEl = dock.querySelector('#remote-resume-dock-text');
  if (textEl) textEl.textContent = text;
  dock.hidden = false;
}

export function hideRemoteResumeDock(app) {
  const dock = document.getElementById('remote-resume-dock');
  if (dock) dock.hidden = true;
}

export async function resumeRemotePosition(app) {
  const authority = app.state.syncPolicySummary?.progressAuthority || null;
  const lastRead = authority?.lastRead || null;
  if (!lastRead?.novelId) {
    toast(app, 'info', '이동할 위치 없음', '다른 기기에서 저장한 위치를 찾지 못했습니다.');
    return;
  }
  const novel = app.state.novelById.get(lastRead.novelId);
  if (!novel) {
    toast(app, 'error', '작품을 찾을 수 없음', '현재 목록에서 해당 작품을 찾지 못했습니다.');
    return;
  }
  try {
    await app.reader.openNovel(novel, openOptionsFromSnapshot({
      episodeId: lastRead.episodeId || null,
      totalChunks: lastRead.totalChunks || 1
    }, lastRead));
    const key = remoteResumeKey(authority);
    app.state.remoteResumeAcceptedKey = key;
    app.state.remoteResumeDismissedKey = key;
    hideRemoteResumeDock(app);
    app.closeLayer?.('settingsOverlay', 'settingsPanel');
    toast(app, 'success', '위치 이동 완료', `${authority.sourceDeviceName || '다른 기기'}에서 저장한 위치로 이동했습니다.`);
  } catch (e) {
    toast(app, 'error', '위치 이동 실패', e.message || String(e));
  }
}
