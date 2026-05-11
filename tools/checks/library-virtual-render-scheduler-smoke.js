const fs = require('fs');
const path = require('path');

const LIBRARY_VIRTUAL_RENDER_SCHEDULER_SMOKE_PASS = 'v297-library-virtual-render-scheduler-smoke-pass';

function runLibraryVirtualRenderSchedulerSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const scheduler = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-virtual-render-scheduler.mjs'), 'utf8');
  const library = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  [
    'LIBRARY_VIRTUAL_RENDER_SCHEDULER_PASS',
    'v297-library-virtual-render-scheduler-pass',
    'scheduleLibraryVirtualRenderRuntime',
    'cancelLibraryVirtualRenderRuntime',
    "deps.renderLibrary?.(app, { source:'virtual-scroll' })"
  ].forEach(marker => {
    if (!scheduler.includes(marker)) throw new Error('library virtual render scheduler marker missing: ' + marker);
  });
  if (!library.includes("from './library-virtual-render-scheduler.mjs'")) throw new Error('library.mjs does not import virtual render scheduler');
  if (!library.includes('scheduleLibraryVirtualRenderRuntime(app, { isLibraryVirtualRendererEnabled, renderLibrary })')) throw new Error('schedule bridge missing');
  if (!library.includes('cancelLibraryVirtualRenderRuntime(app)')) throw new Error('cancel bridge missing');
  if (library.includes('window.requestAnimationFrame(() => {\n    app.state.libraryVirtualRenderRaf = 0;\n    renderLibrary(app, { source:\'virtual-scroll\' });')) throw new Error('library.mjs still owns scheduler RAF body');
  return { pass: LIBRARY_VIRTUAL_RENDER_SCHEDULER_SMOKE_PASS };
}

module.exports = { LIBRARY_VIRTUAL_RENDER_SCHEDULER_SMOKE_PASS, runLibraryVirtualRenderSchedulerSmoke };
if (require.main === module) runLibraryVirtualRenderSchedulerSmoke();
