#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

for (const rel of [
  'tools/checks/v673-metadata-applied-shard-smoke.js',
  'tools/checks/v673-metadata-sparse-shard-init-smoke.js'
]) {
  assert(read(rel).includes(".split(path.sep).join('/')"), `${rel} must normalize platform separators`);
}
for (const rel of [
  'tools/checks/metadata-manual-fast-path-v648-smoke.mjs',
  'tools/checks/v648-audit-runtime-fixes-smoke.mjs'
]) {
  assert(read(rel).includes('fileURLToPath(import.meta.url)'), `${rel} must resolve an ESM file URL portably`);
}

const archiveFallback = read('tools/checks/package-archive-fallback-v610-smoke.js');
assert(archiveFallback.includes("blockedCapabilities:['zip-create']"));
assert(archiveFallback.includes('process.exit(77)'));
const archiveSafety = read('tools/archive-safety.js');
assert(archiveSafety.includes("return { entries, rawEntryCount:rawNames.length, inspectionTool:'tar' }"));

const serverStructure = read('tools/check_server_structure.js');
assert(serverStructure.includes("./server/node-launcher"));
assert(serverStructure.includes('server/node-launcher.js must delegate to bootstrap'));
assert(serverStructure.includes('Dockerfile must keep release and smoke tools outside the production image'));
assert(read('tools/checks/server-fileops-service-smoke.js').includes('performDurableFsMutation'));
assert(read('tools/checks/server-middleware-smoke.js').includes("require(projectRoot + '/server/version-contract.js')"));
assert(read('tools/checks/server-route-handler-negative-smoke.js').includes('uploadFontAsync: async'));

console.log(JSON.stringify({
  pass:'v674-cross-platform-gate-contract-smoke-pass',
  pathSeparatorFixtures:2,
  esmFileUrlFixtures:2,
  environmentBlockExitCode:77,
  zipSafetyTarFallback:true,
  serverStructureCurrent:true
}));
