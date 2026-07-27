#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.resolve(__dirname, '../../server/app.js'), 'utf8');
const importPattern = /const\s*\{\s*BUILD_ID\s*\}\s*=\s*require\(['\"]\.\/version-contract['\"]\);/;
const importMatch = importPattern.exec(source);
const importIndex = importMatch ? importMatch.index : -1;
const routeUseIndex = source.indexOf('app.get(`/sw-${BUILD_ID}.js`');
assert(importIndex >= 0, 'version contract import is required');
assert(routeUseIndex > importIndex, 'BUILD_ID must be declared before route registration');
assert(source.indexOf('module.exports = {\n  app,\n  start,\n  stop\n};\nconst { BUILD_ID') === -1, 'version import must not trail module.exports');
console.log(JSON.stringify({ pass:'v641-version-contract-import-order-pass' }));
