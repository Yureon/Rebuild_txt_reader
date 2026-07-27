#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const scriptsRoot = path.join(root, 'public', 'scripts');
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.mjs')) files.push(full);
  }
}

walk(scriptsRoot);
const unused = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/^\s*import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/gm)) {
    for (const part of match[1].split(',')) {
      const names = part.trim().split(/\s+as\s+/);
      const localName = String(names[1] || names[0] || '').trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(localName)) continue;
      const escaped = localName.replace(/[$]/g, '\\$&');
      const references = source.match(new RegExp(`\\b${escaped}\\b`, 'g')) || [];
      if (references.length === 1) unused.push(`${path.relative(root, file).replace(/\\/g, '/')}:${localName}`);
    }
  }
}

assert.deepStrictEqual(unused, [], `unused named ESM imports: ${unused.join(', ')}`);
console.log(JSON.stringify({ pass:'v609-esm-unused-named-import-pass', modules:files.length }));
