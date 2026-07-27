#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const lockPath = path.join(root, 'package-lock.json');
const stat = fs.lstatSync(lockPath);
assert.ok(stat.isFile(), 'package-lock.json must be a regular file');
assert.ok(!stat.isSymbolicLink(), 'package-lock.json must not be a symbolic link');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
assert.strictEqual(lock.lockfileVersion, 3, 'package-lock.json must be npm lockfileVersion 3');
const packageRebuild = fs.readFileSync(path.join(root, 'tools/package_rebuild.js'), 'utf8');
const backup = fs.readFileSync(path.join(root, 'tools/package_release_archive_backup.js'), 'utf8');
assert.ok(packageRebuild.includes('v532-package-lock-regular-file-pass'), 'zip packager must reject symlink package-lock.json');
assert.ok(backup.includes('v532-package-lock-regular-file-pass'), 'tar packager must reject symlink package-lock.json');
console.log(JSON.stringify({ pass: 'v532-package-lock-regular-file-smoke-pass', bytes: stat.size }));
