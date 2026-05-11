#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v373-settings-reader-preset-buttons-smoke-pass';
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function runSettingsReaderPresetButtonsSmoke() {
  const appShell = read('public/fragments/app-shell.html');
  const appearance = read('public/scripts/rebuild/features/settings/appearance.mjs');
  const runner = read('tools/run_smoke_tests.js');
  for (const marker of ['data-lh="1.7"', 'data-lh="2.1"', 'data-lh="2.6"', 'data-lw="480"', 'data-lw="680"', 'data-lw="900"', 'data-lw="9999"']) {
    assert.ok(appShell.includes(marker), `app shell missing preset marker: ${marker}`);
  }
  assert.ok(appearance.includes("document.querySelectorAll('button[data-lh]')"), 'line-height preset buttons must be bound');
  assert.ok(appearance.includes("document.querySelectorAll('button[data-lw]')"), 'line-width preset buttons must be bound');
  assert.ok(appearance.includes('set({ lineHeight: clamp(button.dataset.lh, 1.2, 3.5) })'), 'line-height preset must update prefs.lineHeight');
  assert.ok(appearance.includes('set({ width: value >= 9999 ? 9999 : clamp(value, 320, 1400) })'), 'line-width preset must update prefs.width');
  assert.ok(appearance.includes("readerWidth >= 9999 ? 'none'"), 'screen-fit width must map to max-width none');
  assert.ok(appearance.includes('syncReaderPresetButtons(p)'), 'active preset state must sync from prefs');
  assert.ok(appearance.includes('aria-pressed'), 'preset button accessibility state must be synced');
  assert.ok(runner.includes('tools/checks/settings-reader-preset-buttons-smoke.js'), 'settings smoke runner must include preset button smoke');
  return { pass: PASS };
}

if (require.main === module) console.log(JSON.stringify(runSettingsReaderPresetButtonsSmoke()));
module.exports = { PASS, runSettingsReaderPresetButtonsSmoke };
