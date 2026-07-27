#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const read = rel => fs.readFileSync(rel,'utf8');
const main = read('public/scripts/rebuild/main.mjs');
const shell = read('public/fragments/app-shell.html');
const css = read('public/styles/app.css');
assert.ok(main.includes("navigationTarget.requested ? navigationTarget.view : 'shelf'"), 'library profile must default to shelf/card view');
assert.ok(shell.includes('id="library-view-tabs"'), 'library page needs a visible view switcher');
assert.ok(shell.includes('data-library-view="shelf"') && shell.includes('카드형'), 'card view button missing');
assert.ok(shell.includes('data-library-view="files"') && shell.includes('폴더 트리'), 'tree view button missing');
assert.ok(css.includes('body[data-client-profile="library"] #library-view-tabs{display:grid!important'), 'library view switcher must override the old hidden rule');
assert.ok(css.includes('rebuild-v644: library page view switcher'), 'v577 view-mode styling marker missing');
console.log('v577-library-page-view-mode-smoke-pass');
