import { setText } from './control-dom-utils.mjs';

export function formatLibraryVirtualSettingsChecklistDiff(app) {
  const diff = app?.state?.libraryVirtualChecklistLastDiff || null;
  const filter = String(app?.state?.libraryVirtualChecklistDiffFilter || 'all');
  if (!diff) return 'snapshot diff 없음';
  const summary = diff.summary || {};
  const status = diff.status || 'unknown';
  const filterLabel = filter === 'critical-changed' ? 'critical changed' : 'all';
  if (!diff.available) return `${status} · ${filterLabel}`;
  return `${status} · changed ${summary.changed || 0} · added ${summary.added || 0} · removed ${summary.removed || 0} · filter ${filterLabel}`;
}


export function formatLibraryVirtualSettingsRelativeTime(ts) {
  const value = Number(ts) || 0;
  if (!value) return 'not generated';
  const diffMs = Math.max(0, Date.now() - value);
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.round(min / 60);
  if (hour < 48) return `${hour}h ago`;
  const day = Math.round(hour / 24);
  return `${day}d ago`;
}


export function getLibraryVirtualSettingsReadinessSummary(app) {
  const summary = app?.state?.libraryVirtualSettingsReadinessSummary || null;
  const bundle = app?.state?.libraryVirtualManualReviewLastBundle || null;
  const limited = summary?.limitedOptInReadiness || bundle?.limitedOptInReadiness || app?.state?.libraryVirtualLimitedOptInReadinessLast || null;
  const blockers = summary?.criticalBlockers || bundle?.criticalBlockers || null;
  const reviewer = summary?.reviewerSummary || bundle?.reviewerSummary || null;
  const lightweight = summary?.diagnosticLightweightTest || bundle?.diagnosticLightweightTest || app?.state?.libraryVirtualDiagnosticsLightweightLastTest || null;
  const finalAudit = summary?.finalOptInAudit || bundle?.finalOptInAudit || app?.state?.libraryVirtualFinalOptInAuditLast || null;
  const evidenceFreshness = summary?.evidenceFreshness || bundle?.evidenceFreshness || finalAudit?.evidenceFreshness || null;
  const generatedAt = summary?.generatedAt || finalAudit?.generatedAt || limited?.generatedAt || bundle?.generatedAt || reviewer?.generatedAt || 0;
  const readinessStatus = limited?.statusLabel || limited?.status || reviewer?.limitedOptInReadiness?.statusLabel || reviewer?.limitedOptInReadiness?.status || 'not generated';
  const blockerCount = Number(blockers?.count ?? reviewer?.criticalBlockerCount ?? summary?.criticalBlockerCount ?? 0);
  const lightweightStatus = lightweight?.statusLabel || lightweight?.status || 'not run';
  const finalAuditStatus = finalAudit?.statusLabel || finalAudit?.status || 'not generated';
  const freshnessStatus = evidenceFreshness?.statusLabel || evidenceFreshness?.status || 'freshness not generated';
  const freshnessLabel = evidenceFreshness ? `${freshnessStatus} · stale blocker ${evidenceFreshness.counts?.staleBlocker || 0} · warning ${evidenceFreshness.counts?.staleWarning || 0}` : freshnessStatus;
  const readinessLabel = generatedAt
    ? `${readinessStatus} · ${formatLibraryVirtualSettingsRelativeTime(generatedAt)}`
    : readinessStatus;
  const blockerLabel = blockers || reviewer || summary
    ? `${blockerCount} critical${blockers?.status ? ' · ' + blockers.status : ''}`
    : '-';
  const lightweightLabel = lightweight?.counts
    ? `${lightweightStatus} · pass ${lightweight.counts.pass || 0} · warn ${lightweight.counts.warning || 0} · fail ${lightweight.counts.fail || 0}`
    : lightweightStatus;
  const finalAuditLabel = finalAudit?.counts
    ? `${finalAuditStatus} · blockers ${finalAudit.counts.blocker || 0} · warn ${finalAudit.counts.warning || 0}`
    : finalAuditStatus;
  const readyForReviewer = !!(limited?.decision?.readyForReviewerConsideration || reviewer?.limitedOptInReadiness?.readyForReviewerConsideration);
  const enableActionAvailable = !!(limited?.decision?.enableActionAvailable || reviewer?.limitedOptInReadiness?.enableActionAvailable);
  const policy = summary?.policy || limited?.policy || reviewer?.policy || bundle?.policy || null;
  return {
    available: !!(summary || bundle || limited || reviewer || blockers || lightweight || finalAudit),
    generatedAt,
    source: summary?.source || 'settings-readiness-runtime-cache',
    readinessStatus,
    readinessLabel,
    blockerCount,
    blockerLabel,
    lightweightStatus,
    lightweightLabel,
    finalAuditStatus,
    finalAuditLabel,
    freshnessStatus,
    freshnessLabel,
    readyForReviewer,
    enableActionAvailable,
    policy,
    limitedOptInReadiness: limited,
    criticalBlockers: blockers,
    reviewerSummary: reviewer,
    diagnosticLightweightTest: lightweight,
    finalOptInAudit: finalAudit,
    evidenceFreshness,
    note: summary || limited || reviewer
      ? `read-only readiness summary · ${readinessStatus} · blockers ${blockerCount} · final audit ${finalAuditStatus} · freshness ${freshnessLabel} · enable action ${enableActionAvailable ? 'invalid/exposed' : 'not exposed'}`
      : 'readiness summary는 아직 생성되지 않았습니다. 복구 센터에서 Manual review bundle 또는 Limited opt-in readiness JSON을 생성하면 여기에 읽기 전용으로 표시됩니다.'
  };
}


export function renderLibraryVirtualSettingsStatus(app) {
  const snap = getLibraryVirtualSettingsSnapshot(app);
  const chip = app.els.libraryVirtualSettingsStatus;
  if (chip) {
    chip.classList.remove('off', 'ok', 'warn', 'bad', 'trial');
    chip.classList.add(snap.tone || 'off');
    chip.textContent = snap.statusLabel;
  }
  setText(app.els.libraryVirtualSettingsRequested, snap.requestedLabel);
  setText(app.els.libraryVirtualSettingsActual, snap.actualLabel);
  setText(app.els.libraryVirtualSettingsTrial, snap.trialLabel);
  setText(app.els.libraryVirtualSettingsFallback, snap.fallbackLabel);
  setText(app.els.libraryVirtualSettingsDiff, snap.diffLabel);
  setText(app.els.libraryVirtualSettingsReadiness, snap.readinessLabel);
  setText(app.els.libraryVirtualSettingsBlockers, snap.blockerLabel);
  setText(app.els.libraryVirtualSettingsLightweight, snap.lightweightLabel);
  setText(app.els.libraryVirtualSettingsFinalAudit, snap.finalAuditLabel);
  setText(app.els.libraryVirtualSettingsNote, snap.note);
  if (app.els.libraryVirtualOpenRecoveryBtn) {
    app.els.libraryVirtualOpenRecoveryBtn.disabled = !app.openRecoveryCenter && !app.els.devdbgRecoveryBtn;
  }
}


export function getLibraryVirtualSettingsSnapshot(app) {
  const diag = app.library?.getRenderDiagnostics?.() || null;
  const fallback = diag?.fallback || app.library?.getFallbackDiagnostics?.() || null;
  const trial = diag?.safeTrial || app.library?.getVirtualTrialDiagnostics?.() || null;
  const persistentFlag = !!app?.state?.prefs?.libraryVirtualRenderer;
  const guardedDefault = !!diag?.defaultRollout?.enabledByDefault;
  const autoFallbackActive = !!diag?.defaultRollout?.autoFallbackActive;
  const trialActive = !!trial?.active || !!trial?.current?.active;
  const requested = !!(diag?.enabled || fallback?.requested || persistentFlag || trialActive || guardedDefault);
  const active = !!diag?.active;
  const actual = fallback?.actualRenderer || (active ? 'windowed' : (requested ? 'full fallback' : 'full'));
  const latestFallback = fallback?.latestBlocking || fallback?.latest || diag?.lastBlockingFallback || diag?.lastFallback || null;
  const latestFullRenderInfo = fallback?.latestInformationalFullRender || diag?.latestInformationalFullRender || null;
  const latestCategoryLabel = fallback?.latestCategoryLabel || latestFallback?.categoryLabel || latestFallback?.category || '';
  const latestReason = latestFallback?.reason || fallback?.latestGate?.reason || '';
  const fallingBack = !!fallback?.fallingBack || (!!requested && !active && actual !== 'windowed');
  const blockingFallback = !!fallback?.blockingFailure || (!!fallingBack && !!latestFallback);
  const trialSummary = trial?.current || (trial?.active ? trial : null);
  const lastTrial = trial?.lastResult || null;
  const confidence = trial?.confidenceSummary || null;
  const rowHeight = diag?.rowHeightMeasurement || app.library?.getRowHeightDiagnostics?.() || null;
  const diffLabel = formatLibraryVirtualSettingsChecklistDiff(app);
  const readiness = getLibraryVirtualSettingsReadinessSummary(app);
  let tone = 'off';
  let statusLabel = 'OFF';
  if (trialActive) {
    tone = 'trial';
    statusLabel = 'trial';
  } else if (autoFallbackActive) {
    tone = 'bad';
    statusLabel = 'full 고정';
  } else if (fallingBack) {
    tone = blockingFallback ? 'bad' : 'warn';
    statusLabel = blockingFallback ? 'fallback' : 'full';
  } else if (active) {
    tone = 'ok';
    statusLabel = 'windowed';
  } else if (persistentFlag) {
    tone = 'warn';
    statusLabel = '대기';
  }
  const trialLabel = trialActive
    ? `running · ${Math.ceil((Number(trialSummary?.remainingMs) || 0) / 1000)}s left`
    : (lastTrial ? `${lastTrial.resultLabel || lastTrial.status || '-'} · ${Math.round((Number(lastTrial.elapsedMs) || 0) / 1000)}s · windowed ${Number(lastTrial.windowedRenders) || 0}` : 'idle');
  const fallbackLabel = latestFallback
    ? [latestCategoryLabel || 'Unknown', latestReason].filter(Boolean).join(' · ')
    : (latestFullRenderInfo ? 'blocking 없음 · full render ' + (latestFullRenderInfo.reason || '-') : '없음');
  const requestedParts = [];
  if (guardedDefault) requestedParts.push('guarded default');
  if (persistentFlag) requestedParts.push('flag ON');
  if (trialActive) requestedParts.push('trial');
  const requestedLabel = requestedParts.length ? requestedParts.join(' + ') : 'OFF';
  const confidenceText = confidence
    ? `신뢰도 ${confidence.level || 'no-history'} · 연속 pass+render ${confidence.consecutivePassWindowedRendered || 0}/${confidence.passTarget || 3} · windowed coverage complete ${confidence.coverageCounts?.complete || 0}`
    : '';
  const rowHeightText = rowHeight?.available
    ? `row height ${rowHeight.risk?.level || 'unknown'} · avg ${rowHeight.stats?.average || 0}px · range ${rowHeight.stats?.range || 0}px`
    : '';
  const note = fallingBack
    ? (blockingFallback
      ? `현재 full fallback입니다. 권장 조치: ${fallback?.latestSuggestedAction || latestFallback?.suggestedAction || 'Fallback sample JSON을 복사해 blocking gate failure를 확인하세요.'}`
      : '현재 full renderer를 사용 중이지만 blocking gate failure는 기록되지 않았습니다. 최근 full-render reason과 gate 상태를 확인하세요.')
    : active
      ? 'windowed renderer가 현재 실제 DOM renderer로 사용 중입니다. v140 guarded default가 적용 중이며 문제가 감지되면 full renderer로 자동 고정됩니다.'
      : trialActive
        ? 'safe trial이 런타임 전용으로 실행 중입니다. prefs.libraryVirtualRenderer는 저장 변경하지 않습니다.'
        : lastTrial?.resultLabel === 'pass-no-render'
          ? '마지막 safe trial은 fallback/exception 없이 끝났지만 windowed render가 관측되지 않았습니다. 더 큰 목록 또는 스크롤 후 trial을 다시 확인하세요.'
          : (confidenceText
            ? confidenceText + (rowHeightText ? ' · ' + rowHeightText : '') + (readiness.available ? ' · ' + readiness.note : '') + ' · v140 guarded default 적용 중입니다.'
            : (readiness.available ? readiness.note + ' · ' : '') + '기본값은 virtual guarded이며 문제 감지 시 full renderer로 자동 고정됩니다.' + (rowHeightText ? ' · ' + rowHeightText : ''));
  return {
    available: !!diag || !!fallback || !!app?.library,
    statusLabel,
    tone,
    requested,
    requestedLabel,
    actualLabel: actual,
    trialLabel,
    fallbackLabel,
    diffLabel,
    readinessLabel: readiness.readinessLabel,
    blockerLabel: readiness.blockerLabel,
    lightweightLabel: readiness.lightweightLabel,
    finalAuditLabel: readiness.finalAuditLabel,
    readiness,
    note,
    persistentFlag,
    trialActive,
    active,
    fallingBack,
    diagnostics: diag,
    fallback,
    trial,
    confidence,
    rowHeight,
    copiedAt: Date.now()
  };
}


export function openLibraryVirtualRecoveryCenter(app) {
  app.closeLayer?.('settingsOverlay', 'settingsPanel');
  if (typeof app.openRecoveryCenter === 'function') {
    app.openRecoveryCenter({ focus: 'diagnostics' });
    window.setTimeout(() => document.querySelector('[data-recovery-section="diagnostics"]')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 180);
    return;
  }
  app.els.devdbgRecoveryBtn?.click?.();
  window.setTimeout(() => document.querySelector('[data-recovery-section="diagnostics"]')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 180);
}


export async function copyLibraryVirtualSettingsStatus(app) {
  const snap = getLibraryVirtualSettingsSnapshot(app);
  const payload = {
    version: app.state?.version || '',
    profile: app.profile || app.state?.profile || '',
    prefs: {
      libraryVirtualRenderer: !!app.state?.prefs?.libraryVirtualRenderer,
      guardedDefault: !!snap.diagnostics?.defaultRollout?.enabledByDefault,
      autoFallbackActive: !!snap.diagnostics?.defaultRollout?.autoFallbackActive
    },
    summary: {
      status: snap.statusLabel,
      requested: snap.requestedLabel,
      actual: snap.actualLabel,
      trial: snap.trialLabel,
      fallback: snap.fallbackLabel,
      checklistDiff: snap.diffLabel,
      readiness: snap.readinessLabel,
      blockers: snap.blockerLabel,
      lightweight: snap.lightweightLabel,
      finalAudit: snap.finalAuditLabel,
      note: snap.note
    },
    readiness: snap.readiness,
    diagnostics: snap.diagnostics,
    fallback: snap.fallback,
    trial: snap.trial,
    confidence: snap.confidence,
    rowHeightMeasurement: snap.rowHeight,
    checklistDiff: app.state?.libraryVirtualChecklistLastDiff || null,
    checklistDiffFilter: app.state?.libraryVirtualChecklistDiffFilter || 'all',
    copiedAt: Date.now()
  };
  const text = JSON.stringify(payload, null, 2);
  try {
    await navigator.clipboard?.writeText(text);
    setText(app.els.libraryVirtualSettingsNote, '목록 성능 상태 JSON을 클립보드에 복사했습니다.');
  } catch {
    window.prompt('대형 목록 성능 상태 JSON 복사', text);
  }
}
