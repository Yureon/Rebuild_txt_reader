'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'tools', 'release_verify.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert.match(source, /pnpm\.cmd import && pnpm\.cmd install --prod --frozen-lockfile --ignore-scripts/,
  'Windows pnpm fallback must import package-lock.json before a frozen install');
assert.match(source, /run\('pnpm', \['import'\]/,
  'POSIX pnpm fallback must import package-lock.json');
assert.match(source, /run\('pnpm', \['install', '--prod', '--frozen-lockfile', '--ignore-scripts'\]/,
  'POSIX pnpm fallback must use the imported frozen lockfile');
assert.doesNotMatch(source, /--no-frozen-lockfile/,
  'release verification must not resolve dependency ranges outside package-lock.json');
assert.strictEqual(packageJson.scripts?.['smoke:audit'], 'node tools/run_smoke_tests.js --audit',
  'the audit group must be exposed through the package script contract');

console.log(JSON.stringify({ pass: 'v609-release-verify-lockfile-fallback-pass' }));
