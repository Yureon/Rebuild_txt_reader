#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
const ui = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/ui.mjs'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles/app.css'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');
const PASS = 'v574-site-reader-back-to-library-smoke-pass';
assert.ok(ui.includes('if (app.separateLibraryReaderPages)'), 'reader UI must use the separate-page sidebar contract');
assert.ok(ui.includes("import { buildLibraryPageUrlForReader } from './library-navigation-context.mjs'"), 'reader UI must import the context-aware library URL builder');
assert.ok(ui.includes("window.location.assign(buildLibraryPageUrlForReader(app, { view:'shelf' }))"), 'reader menu must navigate to the library page with the current novel and episode context');
assert.ok(ui.includes("menuBtn.textContent = '←'"), 'reader menu must become a back control');
assert.ok(css.includes('body[data-client-profile="site"] .sidebar'), 'site reader sidebar selector missing');
assert.ok(css.includes('body[data-client-profile="mobile"] .sidebar'), 'mobile reader sidebar selector missing');
assert.ok(css.includes('display: none !important;'), 'separate reader pages must hide the embedded library sidebar');
assert.ok(runner.includes('tools/checks/site-responsive-sidebar-close-smoke.js'), 'smoke runner must keep the reader navigation smoke');
console.log(JSON.stringify({ pass: PASS }));
