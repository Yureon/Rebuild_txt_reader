#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const toolsDir = path.join(root, 'tools');
const checksDir = path.join(toolsDir, 'checks');
const sources = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'fixtures') walk(full);
    } else if (/\.(?:m?js)$/.test(entry.name)) {
      sources.push([full, fs.readFileSync(full, 'utf8')]);
    }
  }
}

walk(toolsDir);
const smokeFiles = fs.readdirSync(checksDir).filter(name => /-smoke\.(?:m?js)$/.test(name));
const orphans = smokeFiles.filter(name => !sources.some(([file, source]) => (
  file !== path.join(checksDir, name) && source.includes(name)
)));

assert.deepStrictEqual(orphans, [], `smoke files missing from every runner/supervisor: ${orphans.join(', ')}`);
console.log(JSON.stringify({ pass:'v609-smoke-runner-orphan-coverage-pass', checked:smokeFiles.length }));
