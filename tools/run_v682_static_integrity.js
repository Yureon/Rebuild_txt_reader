#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const staticOutput = path.join(root, 'v682_full_tree_static_scan.json');
const integrityOutput = path.join(root, 'v682_static_integrity_results.json');
const ignoredDirectories = new Set(['node_modules', '.git', 'data', 'test_novels', 'normalized_content', 'dist', '.cache']);

function walk(directory, predicate, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes:true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walk(full, predicate, output);
    else if (entry.isFile() && predicate(full)) output.push(full);
  }
  return output;
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

const syntaxFiles = walk(root, file => /\.(?:cjs|mjs|js)$/iu.test(file)).sort();
const syntaxFailures = [];
for (const file of syntaxFiles) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd:root,
    encoding:'utf8',
    timeout:30_000,
    windowsHide:true
  });
  if (result.status !== 0) {
    syntaxFailures.push({
      file:rel(file),
      status:result.status,
      error:String(result.stderr || result.stdout || result.error?.message || '').trim()
    });
  }
}

const frontendRun = spawnSync(process.execPath, ['tools/check_rebuild_frontend.js', '--quiet-ok'], {
  cwd:root,
  encoding:'utf8',
  timeout:180_000,
  windowsHide:true,
  maxBuffer:16 * 1024 * 1024
});
const frontendOutput = String(frontendRun.stdout || frontendRun.stderr || '').trim();
const requiredMatch = frontendOutput.match(/OK \((\d+) required/iu);
const frontendRequired = Number(requiredMatch?.[1]) || 0;

const compressibleExtensions = new Set(['.mjs', '.js', '.css', '.html', '.json', '.xml', '.svg']);
const publicRoot = path.join(root, 'public');
const sourceFiles = walk(publicRoot, file => compressibleExtensions.has(path.extname(file).toLowerCase())).sort();
const gzipFailures = [];
const brotliFailures = [];
for (const sourceFile of sourceFiles) {
  const source = fs.readFileSync(sourceFile);
  try {
    const inflated = zlib.gunzipSync(fs.readFileSync(sourceFile + '.gz'));
    if (!source.equals(inflated)) gzipFailures.push({ file:rel(sourceFile), reason:'byte-mismatch' });
  } catch (error) {
    gzipFailures.push({ file:rel(sourceFile), reason:error.code || error.message });
  }
  try {
    const inflated = zlib.brotliDecompressSync(fs.readFileSync(sourceFile + '.br'));
    if (!source.equals(inflated)) brotliFailures.push({ file:rel(sourceFile), reason:'byte-mismatch' });
  } catch (error) {
    brotliFailures.push({ file:rel(sourceFile), reason:error.code || error.message });
  }
}

const scanRoots = ['.'];
const scanExtensions = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.md', '.json', '.yml', '.yaml', '.sh', '.env', '.txt', '.xml']);
const scanFiles = walk(root, file => {
  const base = path.basename(file);
  const ext = path.extname(file).toLowerCase();
  if (scanExtensions.has(ext)) return true;
  return base === 'Dockerfile' || base.startsWith('.env');
}).sort();
const patterns = {
  sync_fs:/\b(?:accessSync|appendFileSync|closeSync|copyFileSync|existsSync|fsyncSync|lstatSync|mkdirSync|openSync|readFileSync|readdirSync|readlinkSync|realpathSync|renameSync|rmSync|rmdirSync|statSync|unlinkSync|writeFileSync|writeSync)\b/gu,
  collection_materialization:/\bObject\.(?:entries|keys|values)\s*\(/gu,
  sort_calls:/\.sort\s*\(/gu,
  structured_clone:/\bstructuredClone\s*\(/gu,
  json_stringify:/\bJSON\.stringify\s*\(/gu,
  compression_calls:/\b(?:brotliCompress|gzip|gunzip|deflate|inflate)(?:Sync)?\s*\(/giu,
  map_set_allocations:/\bnew\s+(?:Map|Set)\s*\(/gu,
  recurring_timers:/\bsetInterval\s*\(/gu
};
const patternResults = {};
let staticBytes = 0;
for (const [name, regex] of Object.entries(patterns)) {
  const hitsByFile = [];
  let hits = 0;
  for (const file of scanFiles) {
    const body = fs.readFileSync(file, 'utf8');
    if (name === Object.keys(patterns)[0]) staticBytes += Buffer.byteLength(body);
    regex.lastIndex = 0;
    const count = Array.from(body.matchAll(regex)).length;
    if (count) {
      hits += count;
      hitsByFile.push([rel(file), count]);
    }
  }
  hitsByFile.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  patternResults[name] = { hits, files:hitsByFile.length, topFiles:hitsByFile.slice(0, 20) };
}

const staticPayload = {
  pass:'v682-full-tree-static-pattern-scan-pass',
  generatedAt:new Date().toISOString(),
  files:scanFiles.length,
  bytes:staticBytes,
  roots:scanRoots,
  patterns:patternResults,
  note:'Pattern hits are review inventory, not automatically confirmed defects.'
};
fs.writeFileSync(staticOutput, JSON.stringify(staticPayload, null, 2) + '\n');

const parserRun = spawnSync(process.execPath, ['tools/checks/v677-package-format-parser-smoke.js'], {
  cwd:root, encoding:'utf8', timeout:180_000, windowsHide:true, maxBuffer:16 * 1024 * 1024
});
const runtimeRun = spawnSync(process.execPath, ['tools/checks/v677-runtime-dependency-install-smoke.js'], {
  cwd:root, encoding:'utf8', timeout:60_000, windowsHide:true, maxBuffer:4 * 1024 * 1024
});

const payload = {
  schemaVersion:1,
  pass:'v682-static-integrity-pass',
  version:682,
  packageVersion:'6.82.0',
  buildId:'rebuild-v682',
  generatedAt:new Date().toISOString(),
  javascriptSyntax:{
    pass:'v682-javascript-syntax-pass',
    total:syntaxFiles.length,
    passed:syntaxFiles.length - syntaxFailures.length,
    failed:syntaxFailures.length,
    failures:syntaxFailures
  },
  frontendModules:{
    required:frontendRequired,
    passed:frontendRun.status === 0 ? frontendRequired : 0,
    failed:frontendRun.status === 0 ? 0 : Math.max(1, frontendRequired),
    output:frontendOutput
  },
  precompressed:{
    sourceFiles:sourceFiles.length,
    gzip:{ total:sourceFiles.length, passed:sourceFiles.length - gzipFailures.length, failed:gzipFailures.length, failures:gzipFailures },
    brotli:{ total:sourceFiles.length, passed:sourceFiles.length - brotliFailures.length, failed:brotliFailures.length, failures:brotliFailures }
  },
  fullTreeStaticScan:{ pass:staticPayload.pass, files:staticPayload.files, bytes:staticPayload.bytes, roots:staticPayload.roots },
  packageFormatParser:{ passed:parserRun.status === 0, environmentBlocked:parserRun.status === 77, exitCode:parserRun.status, output:String(parserRun.stdout || parserRun.stderr || '').trim() },
  runtimeDependencies:{ passed:runtimeRun.status === 0, environmentBlocked:runtimeRun.status === 77, exitCode:runtimeRun.status, output:String(runtimeRun.stdout || runtimeRun.stderr || '').trim() }
};
fs.writeFileSync(integrityOutput, JSON.stringify(payload, null, 2) + '\n');
console.log(JSON.stringify({ ...payload, javascriptSyntax:{ ...payload.javascriptSyntax, failures:undefined }, precompressed:{ sourceFiles:sourceFiles.length, gzip:{ ...payload.precompressed.gzip, failures:undefined }, brotli:{ ...payload.precompressed.brotli, failures:undefined } } }, null, 2));
if (syntaxFailures.length || frontendRun.status !== 0 || gzipFailures.length || brotliFailures.length || (parserRun.status !== 0 && parserRun.status !== 77) || (runtimeRun.status !== 0 && runtimeRun.status !== 77)) process.exitCode = 1;
