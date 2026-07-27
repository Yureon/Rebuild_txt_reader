#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const css = fs.readFileSync('public/styles/app.css','utf8');
for (const marker of [
  'body[data-client-profile="library"]:not(.library-shelf-mode) .cat-header',
  "content:'📁'",
  'body[data-client-profile="library"]:not(.library-shelf-mode) .cat-body',
  'body[data-client-profile="library"]:not(.library-shelf-mode) .novel-item',
  'body[data-client-profile="library"]:not(.library-shelf-mode) .ep-list',
  'body[data-client-profile="library"]:not(.library-shelf-mode) .folder-bulk-actions'
]) assert.ok(css.includes(marker), `tree redesign marker missing: ${marker}`);
assert.ok(css.includes('contain:layout'), 'tree branch layout containment must remain enabled');
console.log('v577-library-tree-redesign-smoke-pass');
