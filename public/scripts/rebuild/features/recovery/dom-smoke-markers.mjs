export const RECOVERY_DOM_SMOKE_MARKERS_SPLIT_PASS = 'v195-recovery-dom-smoke-markers-split-pass';

export const RECOVERY_LIBRARY_DOM_SMOKE_MARKER_SCHEMA_VERSION = 1;
export const RECOVERY_LIBRARY_DOM_SMOKE_MARKERS = [
  { id:'summary-section', type:'section-label', value:'Recovery status', label:'Summary recovery section', critical:true },
  { id:'cache-section', type:'section-label', value:'Cache management', label:'Cache management section', critical:true },
  { id:'search-section', type:'section-label', value:'Search diagnostics', label:'Search diagnostics section', critical:true },
  { id:'policy-section', type:'section-label', value:'Recovery policy', label:'Developer policy section', critical:false },
  { id:'diagnostics-section', type:'section-label', value:'원본 진단', label:'Lazy raw diagnostics section', critical:false },
  { id:'manual-diagnostics-section', type:'section-label', value:'수동 스크롤 진단', label:'Manual scroll diagnostics section', critical:false }
]

export function buildRecoveryLibraryDomSmokeMarkerReport(root = null) {
  const doc = root?.ownerDocument || document;
  const scope = root || doc;
  const buttons = Array.from(scope.querySelectorAll?.('button') || []);
  const textNodes = Array.from(scope.querySelectorAll?.('.recovery-cache-subtitle,.recovery-section-title,.recovery-section-title-with-badge,button') || []);
  const hasText = (value) => textNodes.some(node => String(node.textContent || '').trim().includes(value));
  const markers = RECOVERY_LIBRARY_DOM_SMOKE_MARKERS.map(marker => {
    let present = false;
    if (marker.type === 'class') {
      present = !!(scope.matches?.('.' + marker.value) || scope.querySelector?.('.' + marker.value));
    } else if (marker.type === 'button-label') {
      present = buttons.some(btn => String(btn.textContent || '').trim() === marker.value);
    } else if (marker.type === 'section-label') {
      present = hasText(marker.value);
    }
    return {
      ...marker,
      present,
      status: present ? 'present' : marker.critical ? 'missing-critical' : 'missing-optional',
      checkedAt: Date.now()
    };
  });
  const missingCritical = markers.filter(marker => marker.critical && !marker.present);
  const missingOptional = markers.filter(marker => !marker.critical && !marker.present);
  return {
    schemaVersion: RECOVERY_LIBRARY_DOM_SMOKE_MARKER_SCHEMA_VERSION,
    version: 'rebuild-v564',
    generatedAt: Date.now(),
    available: true,
    status: missingCritical.length ? 'fail' : missingOptional.length ? 'partial' : 'pass',
    markerCount: markers.length,
    presentCount: markers.filter(marker => marker.present).length,
    missingCriticalCount: missingCritical.length,
    missingOptionalCount: missingOptional.length,
    missingCriticalIds: missingCritical.map(marker => marker.id),
    missingOptionalIds: missingOptional.map(marker => marker.id),
    markers,
    policyNote: 'lightweight Recovery Center DOM marker smoke check; diagnostic-only and not an auto-enable signal'
  };
}

export function buildRecoveryLibraryDomSmokeStaticManifest() {
  return {
    schemaVersion: RECOVERY_LIBRARY_DOM_SMOKE_MARKER_SCHEMA_VERSION,
    version: 'rebuild-v564',
    generatedAt: Date.now(),
    markerCount: RECOVERY_LIBRARY_DOM_SMOKE_MARKERS.length,
    criticalCount: RECOVERY_LIBRARY_DOM_SMOKE_MARKERS.filter(marker => marker.critical).length,
    optionalCount: RECOVERY_LIBRARY_DOM_SMOKE_MARKERS.filter(marker => !marker.critical).length,
    markers: RECOVERY_LIBRARY_DOM_SMOKE_MARKERS,
    checkPolicy: 'v421 compact Recovery Center checks only the general recovery and developer diagnostics surfaces that remain in the modal'
  };
}
