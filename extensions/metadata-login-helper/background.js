importScripts('url-policy.js');
const CAPTURE_STORAGE_KEY = 'txtReaderMetadataCaptureWorkflowV1';
const NAVIGATION_SCHEMA_VERSION = 1;

const URL_POLICY = self.TxtReaderMetadataUrlPolicy;
if (!URL_POLICY) throw new Error('metadata URL policy failed to load');
const { normalizeHttpsUrl, canonicalDetailTarget, recoverTargetFromAuthUrl, isAuthHost } = URL_POLICY;

function isValidWorkflow(value) {
  return Boolean(value && typeof value === 'object' && value.pairing?.token && value.pairing?.workId
    && Date.parse(value.pairing.expiresAt) > Date.now());
}

async function readWorkflow() {
  const stored = await chrome.storage.local.get(CAPTURE_STORAGE_KEY);
  const workflow = stored?.[CAPTURE_STORAGE_KEY] || null;
  if (!isValidWorkflow(workflow)) {
    if (workflow) await chrome.storage.local.remove(CAPTURE_STORAGE_KEY);
    return null;
  }
  return workflow;
}

async function writeWorkflow(workflow) {
  await chrome.storage.local.set({ [CAPTURE_STORAGE_KEY]: workflow });
}

function providerNameForWorkflow(workflow, providerId) {
  return (workflow?.pairing?.providers || []).find((provider) => provider?.id === providerId)?.name || providerId;
}

function navigationForTab(workflow, tabId, currentUrl) {
  const current = workflow?.navigation;
  if (current?.schemaVersion === NAVIGATION_SCHEMA_VERSION
    && (!current.tabId || current.tabId === tabId)
    && canonicalDetailTarget(current.providerId, current.targetUrl)) {
    return current;
  }
  for (const provider of workflow?.pairing?.providers || []) {
    const targetUrl = canonicalDetailTarget(provider?.id, currentUrl);
    if (!targetUrl) continue;
    return {
      schemaVersion: NAVIGATION_SCHEMA_VERSION,
      providerId: provider.id,
      providerName: provider.name || provider.id,
      targetUrl,
      targetTitle: workflow?.pairing?.workTitle || '',
      tabId,
      phase: 'opening-detail',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      restoreCount: 0,
      discoveredFromDetailUrl: true
    };
  }
  const recovered = recoverTargetFromAuthUrl(currentUrl);
  if (!recovered) return null;
  const target = canonicalDetailTarget(recovered.providerId, recovered.targetUrl);
  if (!target) return null;
  return {
    schemaVersion: NAVIGATION_SCHEMA_VERSION,
    providerId: recovered.providerId,
    providerName: providerNameForWorkflow(workflow, recovered.providerId),
    targetUrl: target,
    targetTitle: workflow?.pairing?.workTitle || '',
    tabId,
    phase: 'login',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    seenLoginAt: new Date().toISOString(),
    recoveredFromAuthUrl: true,
    restoreCount: 0
  };
}

async function patchNavigation(workflow, navigation, patch) {
  const next = {
    ...navigation,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  await writeWorkflow({ ...workflow, navigation: next });
  return next;
}

async function continueKakaoAgeGate(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        const text = String(document.body?.innerText || '');
        const hasGateText = text.includes('서비스 이용을 위해 연령 확인이 필요')
          && text.includes('로그인 후 이용해 주세요');
        if (!hasGateText) return { detected: false, clicked: false };
        const buttons = [...document.querySelectorAll('button')];
        const loginButton = buttons.find((button) => {
          if (String(button.textContent || '').trim() !== '로그인') return false;
          const scopeText = String(button.parentElement?.parentElement?.innerText || button.parentElement?.innerText || '');
          return scopeText.includes('연령 확인') && scopeText.includes('로그인 후 이용');
        });
        if (!loginButton) return { detected: true, clicked: false };
        loginButton.click();
        return { detected: true, clicked: true };
      }
    });
    return result?.result || { detected: false, clicked: false };
  } catch {
    return { detected: false, clicked: false };
  }
}

async function handleUpdatedTab(tabId, changeInfo, tab) {
  const workflow = await readWorkflow();
  if (!workflow) return;

  const href = String(changeInfo.url || tab?.url || '');
  if (!href) return;
  const url = normalizeHttpsUrl(href);
  if (!url) return;

  let navigation = navigationForTab(workflow, tabId, href);
  if (!navigation) return;
  if (navigation !== workflow.navigation) {
    await writeWorkflow({ ...workflow, navigation });
  }
  if (navigation.tabId && navigation.tabId !== tabId) return;

  const providerId = navigation.providerId;
  const targetUrl = canonicalDetailTarget(providerId, navigation.targetUrl);
  if (!targetUrl) return;
  const currentTarget = canonicalDetailTarget(providerId, href);

  if (isAuthHost(providerId, url.hostname)) {
    if (navigation.phase !== 'login' || !navigation.seenLoginAt) {
      await patchNavigation(workflow, navigation, {
        phase: 'login',
        seenLoginAt: navigation.seenLoginAt || new Date().toISOString(),
        lastAuthHost: url.hostname
      });
    }
    return;
  }

  if (providerId === 'builtin-kakaopage'
    && url.hostname === 'page.kakao.com'
    && url.pathname === '/relay/login') {
    await patchNavigation(workflow, navigation, { phase: 'relay', lastRelayAt: new Date().toISOString() });
    return;
  }

  if (currentTarget === targetUrl) {
    if (changeInfo.status !== 'complete') return;
    if (providerId === 'builtin-kakaopage' && !navigation.gateContinuedAt) {
      const gate = await continueKakaoAgeGate(tabId);
      if (gate.detected) {
        await patchNavigation(workflow, navigation, {
          phase: gate.clicked ? 'age-gate-continued' : 'age-gate',
          gateDetectedAt: navigation.gateDetectedAt || new Date().toISOString(),
          gateContinuedAt: gate.clicked ? new Date().toISOString() : null
        });
        return;
      }
    }
    await patchNavigation(workflow, navigation, {
      phase: 'detail-ready',
      arrivedAt: navigation.arrivedAt || new Date().toISOString()
    });
    return;
  }

  const providerHome = providerId === 'builtin-naver-series'
    ? url.hostname === 'series.naver.com'
    : providerId === 'builtin-kakaopage'
      ? url.hostname === 'page.kakao.com'
      : providerId === 'builtin-ssn'
        ? (url.hostname === 'ssn.so' || url.hostname === 'www.ssn.so') && !canonicalDetailTarget(providerId, href)
        : false;
  if (navigation.seenLoginAt && providerHome && changeInfo.status === 'complete'
    && Number(navigation.restoreCount || 0) < 1) {
    const restored = await patchNavigation(workflow, navigation, {
      phase: 'restoring-detail',
      restoredAt: new Date().toISOString(),
      restoreCount: Number(navigation.restoreCount || 0) + 1
    });
    try {
      await chrome.tabs.update(tabId, { url: targetUrl });
    } catch {
      await patchNavigation(workflow, restored, { phase: 'restore-failed' });
    }
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== 'complete') return;
  void handleUpdatedTab(tabId, changeInfo, tab).catch(() => {});
});
