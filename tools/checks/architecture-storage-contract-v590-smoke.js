#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const pkg = JSON.parse(read('package.json'));
assert.ok(pkg.dependencies && pkg.dependencies.express, 'Express dependency is required');
for (const name of ['fastify', 'sqlite', 'sqlite3', 'better-sqlite3']) {
  assert.ok(!pkg.dependencies?.[name] && !pkg.devDependencies?.[name], `${name} must not be documented or installed as the runtime store`);
}
const app = read('server/app.js');
assert.ok(app.includes("const express = require('express')"), 'server must use Express');
const paths = read('server/config/paths.js');
for (const token of ['accounts.json', 'sessions.json', 'signup-codes.json', 'audit-log.jsonl', 'user-data', 'metadata-browser-profiles']) {
  assert.ok(paths.includes(token), `path contract missing: ${token}`);
}
const doc = read('docs/storage-architecture.md');
for (const token of ['Express 4', 'JSON·JSONL', 'SQLite 데이터베이스를 사용하지 않는다', 'SQL migration은 존재하지 않는다', 'v590-storage-architecture-contract-pass']) {
  assert.ok(doc.includes(token), `storage architecture doc missing: ${token}`);
}
const readme = read('README.md');
assert.ok(readme.includes('실제 런타임·저장 구조') && readme.includes('SQLite와 SQL migration은 사용하지 않는다'));
console.log(JSON.stringify({ pass:'v590-architecture-storage-contract-pass' }));
