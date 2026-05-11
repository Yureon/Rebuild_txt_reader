const fs = require('fs');
const path = require('path');

const RECOVERY_LIBRARY_DOM_SNAPSHOT_PAYLOAD_SMOKE_PASS = 'v295-recovery-library-dom-snapshot-payload-smoke-pass';

function runRecoveryLibraryDomSnapshotPayloadSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const mod = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-dom-snapshot-payload.mjs'), 'utf8');
  [
    'v295-recovery-library-dom-snapshot-payload-pass',
    'buildRecoveryLibraryDomSnapshotPayload',
    'validateLibraryTreeRenderBrowserFixtureSample',
    'rootDropZone',
    'favoriteRows',
    'bookmarkMarkers',
    'read-only Recovery Center DOM snapshot payload'
  ].forEach(marker => {
    if (!mod.includes(marker)) throw new Error('recovery library DOM snapshot payload marker missing: ' + marker);
  });
  const panel = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-panel.mjs'), 'utf8');
  const specs = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-copy-groups.mjs'), 'utf8');
  if (!panel.includes('LIBRARY_DIAGNOSTICS_PANEL_COPY_SPECS') || !specs.includes('Library DOM snapshot JSON')) throw new Error('Recovery panel DOM snapshot copy button spec missing');
  const exportPayload = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-export-payload.mjs'), 'utf8');
  if (!exportPayload.includes('libraryDomSnapshot: buildRecoveryLibraryDomSnapshotPayload(app)')) throw new Error('full diagnostics export missing DOM snapshot payload');
  return { pass: RECOVERY_LIBRARY_DOM_SNAPSHOT_PAYLOAD_SMOKE_PASS };
}

module.exports = { RECOVERY_LIBRARY_DOM_SNAPSHOT_PAYLOAD_SMOKE_PASS, runRecoveryLibraryDomSnapshotPayloadSmoke };
if (require.main === module) runRecoveryLibraryDomSnapshotPayloadSmoke();
