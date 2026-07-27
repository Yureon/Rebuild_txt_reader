#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const css = fs.readFileSync(path.join(root, 'public/styles/app.css'), 'utf8');

assert(css.includes('body.browser-fullscreen-fit .toolbar{\n  background:var(--bg);\n}'), 'browser fullscreen toolbar must preserve theme background');
assert(css.includes('body.browser-fullscreen-fit #safe-area-bar{\n  background:var(--bg) !important;\n}'), 'fullscreen safe-area bar must preserve theme background');
assert(css.includes('html:fullscreen #toolbar,'), 'native fullscreen toolbar override is missing');
assert(css.includes('body.fullscreen-fallback #toolbar{background:var(--bg)!important;color:var(--text)!important}'), 'pseudo fullscreen toolbar override is missing');
assert(css.includes('html:fullscreen .toolbar-safe,'), 'native fullscreen safe-area override is missing');
assert(css.includes('#safe-clock{color:color-mix(in srgb,var(--text) 86%,transparent)!important}'), 'safe-area clock foreground must follow the active theme');
assert(css.includes('#safe-progress{color:color-mix(in srgb,var(--text) 62%,transparent)!important}'), 'safe-area progress foreground must follow the active theme');
assert(!css.includes('body.browser-fullscreen-fit .toolbar{\n  background:#000;\n}'), 'black browser fullscreen toolbar regression remains');
assert(!css.includes('body.browser-fullscreen-fit #safe-area-bar{\n  background:#000 !important;\n}'), 'black browser fullscreen safe-area regression remains');

console.log(JSON.stringify({ pass:'v650-reader-fullscreen-header-theme-smoke-pass' }));
