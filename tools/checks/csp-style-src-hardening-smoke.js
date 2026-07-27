#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildContentSecurityPolicy } = require('../../server/middleware/security');
const root = path.resolve(__dirname, '..', '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
const csp = buildContentSecurityPolicy();
assert.ok(csp.includes("style-src 'self' https://fonts.googleapis.com"), 'style-src must allow self and Google Fonts stylesheet only');
assert.ok(csp.includes("style-src-elem 'self' https://fonts.googleapis.com"), 'style-src-elem must allow self and Google Fonts stylesheet only');
assert.ok(csp.includes("style-src-attr 'none'"), 'style-src-attr must block inline style attributes');
assert.ok(!/style-src[^;]*'unsafe-inline'/.test(csp), 'style-src must not allow unsafe-inline');
assert.ok(!/style-src-elem[^;]*'unsafe-inline'/.test(csp), 'style-src-elem must not allow unsafe-inline');
assert.ok(!/style-src-attr[^;]*'unsafe-inline'/.test(csp), 'style-src-attr must not allow unsafe-inline');
const utils = read('public/scripts/rebuild/core/utils.mjs');
assert.ok(utils.includes('function applyStyleObject'), 'createEl must route style values through CSSOM helper');
assert.ok(utils.includes("else if (key === 'style') applyStyleObject(el, value);"), 'createEl must not set style attributes directly');
assert.ok(!utils.includes("el.setAttribute(key, String(value));\n  });") || utils.includes("else if (key === 'style')"), 'createEl style handling must be explicit');
console.log(JSON.stringify({ pass: 'v408-csp-style-src-hardening-smoke-pass' }));
