#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { collectPackageFileInventory } = require('../package_rebuild');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v641-inventory-exclude-'));
try {
  fs.mkdirSync(path.join(tmp, 'docs/archive'), { recursive:true });
  fs.mkdirSync(path.join(tmp, 'data'), { recursive:true });
  fs.mkdirSync(path.join(tmp, 'public'), { recursive:true });
  fs.writeFileSync(path.join(tmp, 'docs/archive/old.md'), 'old');
  fs.writeFileSync(path.join(tmp, 'data/state.json'), '{}');
  fs.writeFileSync(path.join(tmp, 'public/app.js'), 'ok');
  fs.writeFileSync(path.join(tmp, 'package-lock.json'), '{}');
  const files = collectPackageFileInventory(tmp, { version:641, manifestPath:'package-manifest-v641.json', excludes:['data','docs/archive','*.zip'] });
  assert.deepStrictEqual(files.map(item => item.path), ['package-lock.json','public/app.js']);
  console.log(JSON.stringify({ pass:'v641-package-inventory-path-exclude-pass', files:files.length }));
} finally { fs.rmSync(tmp, { recursive:true, force:true }); }
