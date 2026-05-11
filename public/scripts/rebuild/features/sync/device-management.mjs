import { createEl, formatPercent, setDeviceName } from '../../core/utils.mjs';
import { saveLocal } from '../../core/storage.mjs';
import { toast } from '../ui.mjs';
import { copyRecoveryTextWithFallback } from '../recovery/export-utils.mjs';
import { formatDeviceName, formatRelativeTime, shortDeviceId } from './sync-formatters.mjs';

export const SYNC_DEVICE_MANAGEMENT_REFACTOR_PASS = 'v177-sync-device-management-pass';

export const DEFAULT_SYNC_SHARE = {
  progress: true,
  favorites: true,
  bookmarks: true,
  recents: true,
  searchHistory: true,
  lastOpenedNovelId: true,
  collapsedFolders: false,
  theme: false,
  otherDeviceAlert: true,
  otherDeviceConnectToast: true
};

export const DEVICE_MANAGEMENT_QUALITY_PASS = 'v140';

export const DEVICE_MANAGEMENT_STATUS_LABELS = {
  sharedPolicy: '공유 정책',
  deviceState: '이 기기 상태',
  remoteOffer: '원격 위치 제안',
  alertToast: '알림 toast'
};

export function getSyncShare(app) {
  const fromShared = app.state.shared?.syncPolicy?.share || null;
  const fromSummary = app.state.syncPolicySummary?.share || null;
  return { ...DEFAULT_SYNC_SHARE, ...(fromShared || {}), ...(fromSummary || {}) };
}

export function getSyncDevices(app) {
  const summary = app.state.syncPolicySummary || {};
  const devices = Array.isArray(summary.devices) ? summary.devices : [];
  if (devices.some(device => device.id === app.state.deviceId)) return devices;
  return [{ id: app.state.deviceId, name: app.state.deviceName, isCurrent: true, lastSeenAt: Date.now() }, ...devices];
}

export function renderSyncDevicePanel(app) {
  const summary = app.state.syncPolicySummary || null;
  const devices = getSyncDevices(app);
  const share = getSyncShare(app);
  const currentDevice = devices.find(device => device.id === app.state.deviceId || device.isCurrent) || devices[0] || null;
  const preferredId = summary?.preferredDeviceId || summary?.effectiveDeviceId || app.state.deviceId;
  const preferredDevice = devices.find(device => device.id === preferredId) || null;
  const otherCount = devices.filter(device => !device.isCurrent && device.id !== app.state.deviceId).length;
  markDeviceManagementQuality(app, { devices, share, summary, preferredId });

  if (app.els.syncDeviceSummary) {
    const preferredLabel = preferredDevice ? formatDeviceName(preferredDevice, '우선 기기') : '현재 기기';
    app.els.syncDeviceSummary.textContent = summary
      ? `등록 ${devices.length}대 · 다른 기기 ${otherCount}대 · 우선 기준 ${preferredLabel} · ${summary.progressAuthority?.hasLastRead ? '읽기 위치 있음' : '읽기 위치 없음'}`
      : '서버 동기화 상태를 아직 가져오지 못했습니다. 로컬 기기 정보만 표시합니다.';
  }
  if (app.els.syncDeviceScopeSummary) app.els.syncDeviceScopeSummary.textContent = formatDeviceScopeSummary(summary, share);
  if (app.els.syncDeviceRemoteSummary) app.els.syncDeviceRemoteSummary.textContent = formatRemoteResumeSummary(summary);
  if (app.els.syncCurrentDeviceName) app.els.syncCurrentDeviceName.textContent = formatDeviceName(currentDevice, app.state.deviceName);
  if (app.els.syncPreferredDeviceName) app.els.syncPreferredDeviceName.textContent = formatDeviceName(preferredDevice, preferredId ? '선택 필요' : '현재 기기');
  if (app.els.syncDeviceNameInput && document.activeElement !== app.els.syncDeviceNameInput) app.els.syncDeviceNameInput.value = app.state.deviceName || '';
  renderSyncPolicyNote(app, summary, preferredId);

  renderSyncChips(app, summary, devices);
  renderPreferredSelect(app, devices, preferredId);
  renderDeviceList(app, devices);
  renderRemoteResumeCard(app, summary);

  if (app.els.syncOtherDeviceAlertToggle) app.els.syncOtherDeviceAlertToggle.checked = share.otherDeviceAlert !== false;
  if (app.els.syncOtherDeviceConnectToggle) app.els.syncOtherDeviceConnectToggle.checked = share.otherDeviceConnectToast !== false;
}

function markDeviceManagementQuality(app, context = {}) {
  const modal = app.els.deviceManagementModal;
  const panel = app.els.settingsSyncLivePanel;
  [modal, panel].filter(Boolean).forEach(el => {
    el.dataset.deviceQualityPass = DEVICE_MANAGEMENT_QUALITY_PASS;
    el.dataset.deviceSyncPolicy = DEVICE_MANAGEMENT_STATUS_LABELS.sharedPolicy;
  });
  if (panel) {
    panel.dataset.deviceCount = String(context.devices?.length || 0);
    panel.dataset.deviceAlert = context.share?.otherDeviceAlert === false ? 'off' : 'on';
    panel.dataset.deviceConnectToast = context.share?.otherDeviceConnectToast === false ? 'off' : 'on';
    panel.dataset.devicePreferred = context.preferredId ? 'selected' : 'current';
  }
}

function formatDeviceScopeSummary(summary, share) {
  if (!summary) return '서버 상태 미수신 · 로컬 설정 기준';
  const alert = share.otherDeviceAlert === false ? '위치 알림 OFF' : '위치 알림 ON';
  const connect = share.otherDeviceConnectToast === false ? '접속 알림 OFF' : '접속 알림 ON';
  return `${DEVICE_MANAGEMENT_STATUS_LABELS.sharedPolicy} + ${DEVICE_MANAGEMENT_STATUS_LABELS.deviceState} · ${alert} · ${connect}`;
}

function formatRemoteResumeSummary(summary) {
  const authority = summary?.progressAuthority || null;
  if (!authority?.hasLastRead) return '저장된 원격 읽기 위치 없음';
  if (authority?.shouldOfferRemoteResume) {
    const source = authority.sourceDeviceName || '다른 기기';
    const ratio = typeof authority.lastRead?.documentRatio === 'number' ? ` · ${formatPercent(authority.lastRead.documentRatio, 1)}` : '';
    return `${DEVICE_MANAGEMENT_STATUS_LABELS.remoteOffer} 가능 · ${source}${ratio}`;
  }
  if (authority?.blockedByPreferredDevice) return '우선 기기 출처가 아니라 제안 숨김';
  if (authority?.isRemoteForCurrent === false) return '현재 기기 위치가 최신 기준';
  return '원격 위치 확인됨 · 자동 제안 조건 아님';
}

function renderSyncChips(app, summary, devices) {
  const wrap = app.els.syncDeviceChips;
  if (!wrap) return;
  wrap.innerHTML = '';
  const share = getSyncShare(app);
  const chips = [
    `현재 기기: ${app.state.deviceName}`,
    `등록 기기: ${devices.length}대`,
    summary?.preferredDeviceId ? `우선 기준: ${shortDeviceId(summary.preferredDeviceId)}` : '우선 기준: 현재 기기',
    share.otherDeviceAlert === false ? '위치 제안 꺼짐' : '위치 제안 켜짐',
    share.otherDeviceConnectToast === false ? '접속 알림 꺼짐' : '접속 알림 켜짐'
  ];
  chips.forEach(text => wrap.append(createEl('span', { class:'settings-sync-chip', text, title:text })));
}

function renderSyncPolicyNote(app, summary, preferredId) {
  const el = app.els.syncPolicyNote;
  if (!el) return;
  const authority = summary?.progressAuthority || null;
  const parts = [];
  if (preferredId) {
    parts.push(authority?.isPreferredAuthoritative === false
      ? '우선 기기가 아닌 기기의 위치는 자동 이동 제안에서 제외됩니다.'
      : '우선 기기의 읽기 위치를 원격 위치 판단에 우선 사용합니다.');
  } else {
    parts.push('우선 기기가 없으면 가장 최근 공유 읽기 위치를 기준으로 판단합니다.');
  }
  if (authority?.isRemoteForCurrent && authority?.sourceDeviceName) {
    parts.push(`현재 원격 위치 출처: ${authority.sourceDeviceName}`);
  }
  if (authority?.blockedByPreferredDevice) {
    parts.push('현재 감지된 위치는 우선 기기 출처가 아니라 dock 제안을 숨깁니다.');
  }
  el.textContent = parts.join(' ');
}

export async function saveCurrentDeviceName(app) {
  const input = app.els.syncDeviceNameInput;
  const nextName = setDeviceName(input?.value || app.state.deviceName || 'Browser');
  app.state.deviceName = nextName;
  if (input) input.value = nextName;
  try {
    const devices = getSyncDevices(app).map(device => ({
      id: device.id,
      name: device.id === app.state.deviceId ? nextName : formatDeviceName(device, '이름 없는 기기'),
      lastSeenAt: Number(device.lastSeenAt) || 0
    }));
    await saveSyncPolicy(app, { devices });
    if (app.deviceSync?.push) await app.deviceSync.push();
    serverNotify(app, 'success', '기기 이름 저장', nextName);
  } catch (error) {
    renderSyncDevicePanel(app);
    serverNotify(app, 'error', '기기 이름 저장 실패', error.message || String(error));
  }
}

export async function copyDeviceId(app, id) {
  const text = String(id || '').trim();
  if (!text) return;
  try {
    await copyRecoveryTextWithFallback(app, text, { label:'debug-text', mime:'text/plain' });
    toast(app, 'success', '기기 ID 복사', shortDeviceId(text));
  } catch (error) {
    toast(app, 'error', '기기 ID 복사 실패', error.message || String(error));
  }
}

function renderPreferredSelect(app, devices, preferredId) {
  const select = app.els.syncPreferredSelect;
  if (!select) return;
  select.innerHTML = '';
  devices.forEach(device => {
    const opt = document.createElement('option');
    opt.value = device.id;
    opt.textContent = `${formatDeviceName(device, '이름 없는 기기')}${device.isCurrent || device.id === app.state.deviceId ? ' · 현재' : ''}`;
    select.append(opt);
  });
  if (preferredId && devices.some(device => device.id === preferredId)) select.value = preferredId;
  else select.value = app.state.deviceId;
}

function renderDeviceList(app, devices) {
  const list = app.els.syncDeviceList;
  if (!list) return;
  list.innerHTML = '';
  if (!devices.length) {
    list.append(createEl('div', { class:'settings-sync-live-item info', text:'등록된 기기 정보가 없습니다.' }));
    return;
  }
  devices.forEach(device => {
    const tags = [];
    if (device.isCurrent || device.id === app.state.deviceId) tags.push('이 기기');
    if (device.isPreferred) tags.push('우선 위치 기준');
    const meta = [
      `식별자 ${shortDeviceId(device.id)}`,
      device.lastSeenAt ? `마지막 활동 ${formatRelativeTime(device.lastSeenAt)}` : '최근 활동 기록 없음',
      Number(device.syncVersion) ? `동기화 버전 ${Number(device.syncVersion)}` : ''
    ].filter(Boolean).join(' · ');
    list.append(createEl('div', {
      class:`settings-sync-live-item ${device.isPreferred ? 'ok' : 'info'}${device.isCurrent || device.id === app.state.deviceId ? ' current' : ''}${device.isPreferred ? ' preferred' : ''}`,
      'data-device-quality-pass': DEVICE_MANAGEMENT_QUALITY_PASS,
      'data-device-current': device.isCurrent || device.id === app.state.deviceId ? 'true' : 'false',
      'data-device-preferred': device.isPreferred ? 'true' : 'false'
    }, [
      createEl('div', { class:'settings-sync-device-main' }, [
        createEl('div', { class:'settings-sync-device-title' }, [
          createEl('span', { class:'settings-sync-device-name', text:formatDeviceName(device, '이름 없는 기기') }),
          ...tags.map(tag => createEl('span', { class:'settings-sync-device-badge', text:tag }))
        ]),
        createEl('div', { class:'settings-sync-device-meta', text:meta })
      ]),
      renderDeviceActions(app, device)
    ]));
  });
}

function renderDeviceActions(app, device) {
  const actions = createEl('div', { class:'settings-sync-device-actions' });
  const isCurrent = device.isCurrent || device.id === app.state.deviceId;
  const isPreferred = !!device.isPreferred;
  const preferredBtn = createEl('button', { class:'settings-sync-mini-btn', type:'button', text:isPreferred ? '우선 기준' : '우선으로 지정', title:'이 기기를 원격 위치 우선 기준으로 지정', 'aria-label':`${formatDeviceName(device, '기기')} 우선 기기 지정` });
  preferredBtn.disabled = isPreferred;
  preferredBtn.addEventListener('click', () => savePreferredDeviceById(app, device.id));
  const copyBtn = createEl('button', { class:'settings-sync-mini-btn', type:'button', text:'식별자 복사', title:'기기 식별자 복사', 'aria-label':`${formatDeviceName(device, '기기')} ID 복사` });
  copyBtn.addEventListener('click', () => copyDeviceId(app, device.id));
  actions.append(preferredBtn, copyBtn);
  const authority = app.state.syncPolicySummary?.progressAuthority || null;
  if (!isCurrent && authority?.lastRead && authority.sourceDeviceId === device.id) {
    const goBtn = createEl('button', { class:'settings-sync-mini-btn accent', type:'button', text:'위치 이동', title:'이 기기에서 저장된 위치로 이동', 'aria-label':`${formatDeviceName(device, '기기')} 저장 위치로 이동` });
    goBtn.addEventListener('click', () => {
      if (typeof app.resumeRemotePosition === 'function') app.resumeRemotePosition();
      else if (typeof app.syncRemoteResume?.resume === 'function') app.syncRemoteResume.resume();
      else toast(app, 'info', '위치 이동 대기', '원격 위치 이동 핸들러가 아직 준비되지 않았습니다.');
    });
    actions.append(goBtn);
  }
  return actions;
}

function renderRemoteResumeCard(app, summary) {
  const card = app.els.syncRemoteResumeCard;
  if (!card) return;
  const authority = summary?.progressAuthority || null;
  const lastRead = authority?.lastRead || null;
  const canOffer = !!(lastRead && authority?.shouldOfferRemoteResume);
  card.hidden = !canOffer;
  if (!canOffer) return;
  const name = authority.sourceDeviceName || '다른 기기';
  const pos = typeof lastRead.documentRatio === 'number' ? ` · ${formatPercent(lastRead.documentRatio, 1)}` : '';
  const when = authority.sourceSavedAt ? ` · ${formatRelativeTime(authority.sourceSavedAt)}` : '';
  if (app.els.syncRemoteResumeText) app.els.syncRemoteResumeText.textContent = `${name}${pos}${when}`;
}

export async function savePreferredDevice(app) {
  const selected = app.els.syncPreferredSelect?.value || app.state.deviceId;
  return savePreferredDeviceById(app, selected);
}

export async function savePreferredDeviceById(app, selected) {
  const devices = getSyncDevices(app).map(device => ({
    id: device.id,
    name: formatDeviceName(device, device.id === app.state.deviceId ? app.state.deviceName : '이름 없는 기기'),
    lastSeenAt: Number(device.lastSeenAt) || 0
  }));
  try {
    await saveSyncPolicy(app, { preferredDeviceId: selected, devices });
    serverNotify(app, 'success', '우선 기기 적용', '기기 우선순위를 저장했습니다.');
  } catch (e) {
    serverNotify(app, 'error', '우선 기기 저장 실패', e.message || String(e));
    renderSyncDevicePanel(app);
  }
}

export async function saveSyncShareSetting(app, key, value) {
  const share = getSyncShare(app);
  share[key] = !!value;
  try {
    await saveSyncPolicy(app, { share });
    serverNotify(app, 'success', '동기화 설정 저장', '기기 알림 설정을 저장했습니다.');
  } catch (e) {
    serverNotify(app, 'error', '동기화 설정 저장 실패', e.message || String(e));
    renderSyncDevicePanel(app);
  }
}

export async function saveSyncPolicy(app, patch) {
  const currentPolicy = app.state.shared?.syncPolicy || {};
  const summary = app.state.syncPolicySummary || {};
  const nextPolicy = {
    preferredDeviceId: patch.preferredDeviceId || currentPolicy.preferredDeviceId || summary.preferredDeviceId || app.state.deviceId,
    devices: patch.devices || currentPolicy.devices || summary.devices || [],
    share: { ...DEFAULT_SYNC_SHARE, ...(currentPolicy.share || {}), ...(summary.share || {}), ...(patch.share || {}) }
  };
  const shared = {
    ...(app.state.shared || {}),
    syncPolicy: nextPolicy,
    updatedAt: Date.now()
  };
  const res = await app.api.putShared(shared);
  if (res && res.shared) app.state.shared = res.shared;
  if (res && res.syncPolicySummary) app.state.syncPolicySummary = res.syncPolicySummary;
  if (Number(res?.sharedVersion)) app.state.sharedVersion = Number(res.sharedVersion);
  renderSyncDevicePanel(app);
}

export function updateKnownDeviceSeen(app, summary, options = {}) {
  const share = getSyncShare(app);
  const devices = Array.isArray(summary?.devices) ? summary.devices : [];
  const known = app.state.knownDeviceSeenAt || {};
  const toasted = app.state.knownDeviceToastAt || {};
  const now = Date.now();
  devices.forEach(device => {
    if (!device || !device.id || device.id === app.state.deviceId || device.isCurrent) return;
    const lastSeenAt = Number(device.lastSeenAt) || 0;
    const previous = Number(known[device.id]) || 0;
    const previousToast = Number(toasted[device.id]) || 0;
    const isFreshUpdate = lastSeenAt > previous && now - lastSeenAt < 180_000;
    const toastAllowed = now - previousToast > 120_000;
    if (options.notify && share.otherDeviceConnectToast !== false && isFreshUpdate && toastAllowed) {
      toast(app, 'info', '다른 기기 접속', `${formatDeviceName(device, '다른 기기')} 상태가 갱신되었습니다.`, 3600);
      toasted[device.id] = now;
    }
    known[device.id] = Math.max(previous, lastSeenAt);
  });
  app.state.knownDeviceSeenAt = known;
  app.state.knownDeviceToastAt = toasted;
  saveLocal('knownDeviceSeenAt', known);
  saveLocal('knownDeviceToastAt', toasted);
}

function serverNotify(app, type, title, message) {
  const prefs = app.state.prefs || {};
  if (prefs.serverCommNotify === false) return;
  const now = Date.now();
  const minMs = Math.max(2000, Math.min(30000, Number(prefs.serverCommNotifyInterval || 6) * 1000));
  if (type !== 'error' && now - Number(app.state.serverCommLastToastAt || 0) < minMs) return;
  app.state.serverCommLastToastAt = now;
  toast(app, type, title, message);
}
