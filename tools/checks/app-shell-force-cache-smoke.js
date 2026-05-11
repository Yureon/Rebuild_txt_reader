#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '../..');
const PASS = 'v457-app-shell-force-cache-smoke-pass';
const shell = fs.readFileSync(path.join(root, 'public/scripts/rebuild/core/app-shell.mjs'), 'utf8');
const policy = fs.readFileSync(path.join(root, 'server/middleware/cache-policy.js'), 'utf8');
assert.ok(shell.includes(`APP_SHELL_FORCE_CACHE_PASS = '${PASS}'`), 'app shell force-cache marker missing');
assert.ok(shell.includes("/fragments/app-shell.html?v=rebuild-v564"), 'app shell URL must be versioned');
assert.ok(shell.includes("cache: 'force-cache'"), 'app shell fetch must allow immutable browser cache reuse');
assert.ok(!shell.includes("cache: 'no-cache'"), 'app shell fetch must not force revalidation');
assert.ok(policy.includes('/public/fragments/'), 'fragment cache policy must cover app-shell fragment');
assert.ok(policy.includes('public, max-age=31536000, immutable'), 'versioned immutable static cache policy missing');
console.log(JSON.stringify({ pass: PASS }));
