#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const css = fs.readFileSync(path.join(root, 'public/styles/app.css'), 'utf8');
const fixed = 'grid-template-areas:"heading heading" "search search" "view view" "scope scope" "status status" "chips chips";';
const broken = 'grid-template-areas:"heading" "search" "view scope" "status status" "chips chips";';
assert(css.includes(fixed), 'mobile library header must use full-width view and scope rows');
assert(!css.includes(broken), 'invalid one-cell/two-cell mixed grid template must not remain');
assert(css.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr);'), 'mobile library header two-column contract missing');
console.log(JSON.stringify({ pass:'v644-library-mobile-header-layout-pass' }));
