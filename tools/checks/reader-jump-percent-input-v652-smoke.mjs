#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const shell = read('public/fragments/app-shell.html');
const jump = read('public/scripts/rebuild/features/reader/jump-panel.mjs');

assert(shell.includes('type="text" id="chunk-input"'), 'percent input must use text mode so partial decimal input is preserved');
assert(shell.includes('inputmode="decimal"'), 'percent input must keep the mobile decimal keyboard');
assert(shell.includes('autocomplete="off"'), 'percent input must not be rewritten by browser autofill');

for (const marker of [
  'function parsePercentValue(rawValue)',
  "replace(',', '.')",
  'function formatPercentValue(value)',
  "on(percentInput, 'compositionstart'",
  "on(percentInput, 'compositionend'",
  "on(percentInput, 'blur'",
  'syncSliderFromPercentInput',
  'normalizePercentInput()'
]) assert(jump.includes(marker), `percent input runtime missing: ${marker}`);

const inputHandler = jump.match(/on\(percentInput, 'input',[\s\S]*?\n  \}\);/);
assert(inputHandler, 'percent input handler was not found');
assert(!inputHandler[0].includes('percentInput.value ='), 'typing must not rewrite the input value or move the caret');
assert(inputHandler[0].includes('syncSliderFromPercentInput()'), 'typing should update only the slider preview');
assert(jump.includes('const percentValue = normalizePercentInput();'), 'Go must normalize and clamp once at commit time');
assert(!jump.includes("on(percentInput, 'input', ev => syncPercent(ev.target.value))"), 'legacy per-keystroke fixed-decimal rewrite remains');

console.log(JSON.stringify({
  pass:'v652-reader-jump-percent-input-smoke-pass',
  caretRewrite:false,
  imeComposition:true,
  commitClamp:true
}));
