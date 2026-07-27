#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'tools', 'release_verify.js'), 'utf8');
const install = "step('runtime dependency install');";
const staticStep = "step('static release smoke set');";
assert.ok(source.includes(install), 'release verify must install runtime dependencies for default clean ZIP verification');
assert.ok(source.indexOf(install) < source.indexOf(staticStep), 'runtime dependencies must be installed before static/API smoke scripts');
assert.ok(!/if \(withServer\) \{\s*step\('(?:server|runtime) dependency install'\)/u.test(source), 'dependency install must not be gated by --with-server');
assert.ok(source.includes("'tools/checks/library-variant-api-smoke.js'"), 'dependency-requiring API smoke must remain in clean release verification');
console.log('v589-release-verify-default-deps-pass');
