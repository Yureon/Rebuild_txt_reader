import { createEl } from '../../core/utils.mjs';
import { buildRecoveryLibraryDomSmokeStaticManifest } from './dom-smoke-markers.mjs';

export const RECOVERY_DOM_SMOKE_PANEL_RENDERER_SPLIT_PASS = 'v195-recovery-dom-smoke-panel-renderer-split-pass';

function getLibraryVirtualDomSmokeToneClass(tone) {
  const key = String(tone || '').toLowerCase();
  if (key === 'ok' || key === 'pass') return 'ok';
  if (key === 'bad' || key === 'fail' || key === 'blocked') return 'bad';
  if (key === 'info' || key === 'off') return 'off';
  if (key === 'trial' || key === 'running') return 'trial';
  return 'warn';
}

export function createRecoveryLibraryDomSmokeMarkerPanel(report = null) {
  const info = report || buildRecoveryLibraryDomSmokeStaticManifest();
  const live = Array.isArray(info.markers) && Object.prototype.hasOwnProperty.call(info.markers[0] || {}, 'present');
  const tone = info.status === 'pass' ? 'ok' : info.status === 'fail' ? 'bad' : 'warn';
  const rows = [
    ['Status', info.status || (live ? 'unknown' : 'manifest-only')],
    ['Markers', String(info.presentCount ?? '-') + ' present / ' + String(info.markerCount || 0) + ' tracked'],
    ['Missing critical', String(info.missingCriticalCount ?? '-')],
    ['Missing optional', String(info.missingOptionalCount ?? '-')],
    ['Policy', info.policyNote || info.checkPolicy || 'diagnostic-only']
  ];
  const markerRows = Array.isArray(info.markers) && info.markers.length
    ? createEl('div', { class:'recovery-diag-list recovery-dom-smoke-marker-list' }, info.markers.slice(0, 28).map(marker => {
        const markerTone = !live ? 'off' : marker.present ? 'ok' : marker.critical ? 'bad' : 'warn';
        return createEl('div', { class:'recovery-diag-item ' + getLibraryVirtualDomSmokeToneClass(markerTone) }, [
          createEl('div', { class:'title', text:String(marker.id || '-') + ': ' + (live ? marker.status : marker.type) }),
          createEl('div', { class:'desc', text:String(marker.label || marker.value || '-') + ' · ' + String(marker.value || '-') + ' · ' + (marker.critical ? 'critical' : 'optional') })
        ]);
      }))
    : createEl('div', { class:'recovery-cache-empty', text:'DOM smoke marker manifest가 비어 있습니다.' });
  return createEl('div', { class:'recovery-dom-smoke-panel' }, [
    createEl('div', { class:'recovery-diag-list' }, [
      createEl('div', { class:'recovery-diag-item ' + getLibraryVirtualDomSmokeToneClass(tone) }, [
        createEl('div', { class:'title', text:'Recovery Center DOM smoke markers: ' + (info.status || 'manifest') }),
        createEl('div', { class:'desc', text: live ? '현재 렌더된 Recovery Center DOM에서 주요 섹션/버튼 marker를 확인했습니다.' : '정적 marker manifest입니다. DOM smoke marker JSON 버튼은 렌더 후 live check를 복사합니다.' })
      ])
    ]),
    createEl('div', { class:'recovery-status-table' }, rows.map(([k, v]) => createEl('div', { class:'recovery-status-row' }, [
      createEl('div', { class:'recovery-status-key', text:k }),
      createEl('div', { class:'recovery-status-val', text:v })
    ]))),
    markerRows
  ]);
}
