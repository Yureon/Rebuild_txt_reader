#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'fixtures') walk(full);
    } else if (entry.name.endsWith('.js')) files.push(full);
  }
}

walk(path.join(root, 'server'));
walk(path.join(root, 'tools'));
const unused = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/^\s*const\s*\{([^}]+)\}\s*=\s*require\s*\(/gm)) {
    for (const part of match[1].split(',')) {
      const names = part.trim().split(/\s*:\s*/);
      const localName = String(names[1] || names[0] || '').trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(localName)) continue;
      const escaped = localName.replace(/[$]/g, '\\$&');
      const references = source.match(new RegExp(`\\b${escaped}\\b`, 'g')) || [];
      if (references.length === 1) unused.push(`${path.relative(root, file).replace(/\\/g, '/')}:${localName}`);
    }
  }
}

assert.deepStrictEqual(unused, [], `unused destructured CommonJS requires: ${unused.join(', ')}`);
console.log(JSON.stringify({ pass:'v609-cjs-unused-destructured-require-pass', files:files.length }));
