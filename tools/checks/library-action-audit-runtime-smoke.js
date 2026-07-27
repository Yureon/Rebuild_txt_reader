const fs = require('fs');
const path = require('path');

const LIBRARY_ACTION_AUDIT_RUNTIME_SMOKE_PASS = 'v276-library-action-audit-runtime-smoke-pass';

function requireMarker(source, marker, label) {
  if (!source.includes(marker)) throw new Error(label + ' missing marker: ' + marker);
}

function runLibraryActionAuditRuntimeSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const libraryPath = path.join(root, 'public/scripts/rebuild/features/library.mjs');
  const runtimePath = path.join(root, 'public/scripts/rebuild/features/library-action-audit-runtime.mjs');
  const library = fs.readFileSync(libraryPath, 'utf8');
  const runtime = fs.readFileSync(runtimePath, 'utf8');

  requireMarker(library, "from './library-action-audit-runtime.mjs'", 'library action audit runtime import');
  requireMarker(library, 'buildLibraryActionAuditRuntimeDiagnostics(app, {', 'library diagnostics delegation');
  requireMarker(library, 'supportsNativeLibraryDnd', 'library action audit helper pass-through');
  requireMarker(runtime, 'export function getLibraryActionAuditDiagnostics', 'runtime export');
  requireMarker(runtime, 'auditLibraryActionRows(app, actualRows', 'runtime actual audit delegation');
  requireMarker(runtime, 'auditLibraryActionRows(app, prototypeRows.rows', 'runtime prototype audit delegation');
  requireMarker(runtime, 'library-action-audit-runtime-no-prototype-builder', 'runtime defensive fallback marker');

  if (library.includes("from './library-action-audit-diagnostics.mjs'")) throw new Error('library.mjs still directly imports action audit diagnostics internals');
  if (/function\s+getActualLibraryActionAuditRows\s*\(/.test(library)) throw new Error('library.mjs still owns actual action audit row collector');
  if (/function\s+getPrototypeLibraryActionAuditRows\s*\(/.test(library)) throw new Error('library.mjs still owns prototype action audit row collector');

  return { pass: LIBRARY_ACTION_AUDIT_RUNTIME_SMOKE_PASS, modules: 1 };
}

module.exports = { LIBRARY_ACTION_AUDIT_RUNTIME_SMOKE_PASS, runLibraryActionAuditRuntimeSmoke };
