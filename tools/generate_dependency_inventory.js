#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const lockPath = path.join(root, 'package-lock.json');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const lockBytes = fs.readFileSync(lockPath);
const lock = JSON.parse(lockBytes.toString('utf8'));
const directNames = new Set(Object.keys(pkg.dependencies || {}));
const KNOWN_LICENSES = new Map([
  ['bytes@3.1.2','MIT'],
  ['math-intrinsics@1.1.0','MIT'],
  ['media-typer@0.3.0','MIT'],
  ['mime@1.6.0','MIT'],
  ['send@0.19.2','MIT'],
  ['serve-static@1.16.3','MIT'],
  ['side-channel-weakmap@1.0.2','MIT']
]);

function resolveLicense(name, version, value) {
  const lockLicense = String(value && value.license || '').trim();
  if (lockLicense) return { license:lockLicense, source:'package-lock' };
  const installedPath = path.join(root, 'node_modules', ...String(name || '').split('/'), 'package.json');
  try {
    const installed = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
    const installedLicense = String(installed.license || '').trim();
    if (installedLicense) return { license:installedLicense, source:'installed-package' };
  } catch {}
  const known = KNOWN_LICENSES.get(`${name}@${version}`);
  return known ? { license:known, source:'verified-exact-version-fallback' } : { license:null, source:'unresolved' };
}

const packages = [];
for (const [key, value] of Object.entries(lock.packages || {})) {
  if (!key || !key.startsWith('node_modules/') || !value || typeof value !== 'object') continue;
  const name = key.slice('node_modules/'.length);
  const version = String(value.version || '');
  const resolvedLicense = resolveLicense(name, version, value);
  packages.push({
    name,
    version,
    direct:directNames.has(name),
    optional:!!value.optional,
    dev:!!value.dev,
    license:resolvedLicense.license,
    licenseSource:resolvedLicense.source,
    integrity:value.integrity || null,
    resolved:value.resolved || null
  });
}
packages.sort((a,b) => a.name.localeCompare(b.name));
const licenseCounts = {};
for (const item of packages) {
  const license = String(item.license || 'UNKNOWN');
  licenseCounts[license] = (licenseCounts[license] || 0) + 1;
}
const release = String(pkg.version || '').split('.').slice(0,2).join('').replace(/^0+/, '') || '0';
const output = process.env.DEPENDENCY_INVENTORY_JSON
  ? path.resolve(process.env.DEPENDENCY_INVENTORY_JSON)
  : path.join(root, `dependency-inventory-v${release}.json`);
const unresolvedLicenses = packages.filter(item => !item.license).map(item => `${item.name}@${item.version}`);
const payload = {
  schemaVersion:2,
  pass:`v${release}-dependency-license-inventory-pass`, // v677-dependency-license-inventory-pass
  generatedAt:new Date().toISOString(),
  package:{ name:pkg.name, version:pkg.version },
  lockfileVersion:lock.lockfileVersion,
  lockSha256:crypto.createHash('sha256').update(lockBytes).digest('hex'),
  directDependencies:[...directNames].sort(),
  packageCount:packages.length,
  licenseCounts,
  licenseInventoryComplete:unresolvedLicenses.length === 0,
  unresolvedLicenses,
  packages
};
if (unresolvedLicenses.length && process.env.ALLOW_UNKNOWN_DEPENDENCY_LICENSES !== '1') {
  throw new Error(`unresolved dependency licenses: ${unresolvedLicenses.join(', ')}`);
}
fs.writeFileSync(output, JSON.stringify(payload, null, 2) + '\n');
console.log(JSON.stringify({ pass:payload.pass, output:path.relative(root,output), packages:packages.length, direct:payload.directDependencies.length }));
