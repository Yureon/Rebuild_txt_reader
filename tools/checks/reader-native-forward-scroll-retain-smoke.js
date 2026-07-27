#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const PASS = 'v430-reader-native-forward-scroll-retain-smoke-pass';
const root = path.resolve(__dirname, '..', '..');

async function runReaderNativeForwardScrollRetainSmoke(projectRoot = root) {
  const layoutPath = path.join(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const layout = fs.readFileSync(layoutPath, 'utf8');
  const diagnostics = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs'), 'utf8');
  const manual = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/reader/manual-diagnostics-snapshot.mjs'), 'utf8');
  const runner = fs.readFileSync(path.join(projectRoot, 'tools/run_smoke_tests.js'), 'utf8');

  assert.ok(layout.includes("READER_NATIVE_FORWARD_SCROLL_RETAIN_PASS = 'v430-reader-native-forward-scroll-retain-pass'"), 'missing v430 native forward retain marker');
  assert.ok(layout.includes("READER_SCROLL_APPEND_CHUNK_WINDOW_DEFER_PASS = 'v430-reader-scroll-append-chunk-window-defer-pass'"), 'missing v430 chunk-window append defer marker');
  assert.ok(layout.includes("READER_ACTIVE_FORWARD_RENDER_ANCHOR_SUPPRESS_PASS = 'v430-reader-active-forward-render-anchor-suppress-pass'"), 'missing v430 render anchor suppression marker');
  assert.ok(layout.includes('const scrollBufferAppend = isForwardScrollBufferAppendSource(source);'), 'append render deferral must use the shared forward buffer source helper');
  assert.ok(layout.includes('active chunk-window scroll buffer append render scheduled'), 'chunk-window append render must be deferred during active native scroll');
  assert.ok(layout.includes('native forward scroll append defers seam render to retain scrollTop'), 'native scroll must not force immediate seam render');
  assert.ok(layout.includes('active forward buffer append keeps native scrollTop without append anchor'), 'native forward append must not capture append anchor');
  assert.ok(layout.includes('native forward scroll keeps scrollTop without patch anchor restore'), 'patch anchor restore must yield to native scroll');
  assert.ok(layout.includes('phase.startsWith(\'render-window\')'), 'render-window anchors must be suppressible during native scroll');
  assert.ok(diagnostics.includes('lastNativeForwardScrollRetain'), 'diagnostics must expose native forward retain state');
  assert.ok(manual.includes('nativeForwardScrollRetainPass'), 'manual diagnostics snapshot must expose native forward retain marker');
  assert.ok(runner.includes('tools/checks/reader-native-forward-scroll-retain-smoke.js'), 'reader smoke runner must include v430 native forward retain smoke');

  const previousWindow = global.window;
  global.window = {
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    clearTimeout: () => {},
    setTimeout: () => 0
  };
  try {
    const mod = await import(pathToFileURL(layoutPath).href + `?smoke=${Date.now()}`);
    const topSpacer = { style: { height: '0px' } };
    const bottomSpacer = { style: { height: '0px' } };
    const app = {
      state: {
        current: { chunk: 1, totalChunks: 2, novel: { id: 'n1' }, episode: { id: 'folder' } },
        loadedChunks: new Map([
          [1, { chunk: 1, title: '1', totalChunks: 2, blocks: [{ index: 0, start: 0, end: 10, text: 'first block '.repeat(20) }], content: '' }],
          [2, { chunk: 2, title: '2', totalChunks: 2, blocks: [{ index: 0, start: 0, end: 10, text: 'second block '.repeat(20) }], content: '' }]
        ]),
        prefs: {},
        readerVirtual: null
      },
      els: {
        reader: { scrollTop: 0, clientHeight: 600, scrollHeight: 1200, classList: { add() {} } },
        content: {
          clientWidth: 700,
          classList: { add() {} },
          querySelector(selector) {
            if (selector === '.reader-virtual-top') return topSpacer;
            if (selector === '.reader-virtual-bottom') return bottomSpacer;
            return null;
          }
        }
      }
    };
    const v = mod.ensureVirtualState(app);
    v.rows = [{ id: '1:b:0', type: 'body', chunk: 1, blockIndex: 0, start: 0, end: 10, text: 'first block '.repeat(20) }];
    v.renderedStart = 0;
    v.renderedEnd = 1;
    v.prefix = [0, 240];
    v.totalHeight = 240;
    v.lastScrollBufferDirection = 'forward';
    v.lastUserScrollSource = 'scroll';
    v.userScrollActiveUntil = Date.now() + 500;

    mod.rebuildVirtualRows(app, 'append', 2, { source: 'v147-reader-chunk-window-buffer-pass' });

    assert.strictEqual(app.els.reader.scrollTop, 0, 'native forward append rebuild must not mutate scrollTop');
    assert.strictEqual(v.lastAppendAnchorGate?.allowed, false, 'native forward append must not capture an append anchor');
    assert.strictEqual(v.lastAppendAnchorGate?.nativeBottomGrowth, true, 'append gate must classify native bottom growth');
    assert.strictEqual(v.lastScrollAppendRenderDefer?.deferred, true, 'chunk-window append render must be deferred during active scroll');
    assert.strictEqual(v.lastScrollAppendRenderDefer?.chunkWindowDeferPass, 'v430-reader-scroll-append-chunk-window-defer-pass', 'defer diagnostics must include v430 marker');
    assert.strictEqual(v.lastAppendSeamRender?.nativeForwardRetain, true, 'seam render gate must retain native forward scroll');
    assert.strictEqual(v.lastAppendSeamRender?.immediate, false, 'native forward scroll must not force immediate seam render');
    assert.strictEqual(v.lastNativeForwardScrollRetain?.retain, true, 'native forward retain diagnostics must be recorded');
  } finally {
    global.window = previousWindow;
  }
  return { pass: PASS };
}

if (require.main === module) runReaderNativeForwardScrollRetainSmoke().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exit(1); });
module.exports = { PASS, runReaderNativeForwardScrollRetainSmoke };
