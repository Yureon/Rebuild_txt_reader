const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ARCHIVE_SAFETY_PASS = 'v612-archive-format-aware-safety-pass';

function run(command, args) {
  const result = spawnSync(command, args, { encoding:'utf8', stdio:'pipe', maxBuffer:64 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`archive inspection failed: ${command} ${args.join(' ')}: ${result.stderr || result.stdout || result.error?.message || result.status}`);
  }
  return String(result.stdout || '');
}

function commandAvailable(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding:'utf8', stdio:'pipe' });
  return !result.error && result.status === 0;
}

function normalizeArchiveEntryName(value) {
  const raw = String(value || '').replace(/\r$/, '');
  if (!raw || raw.includes('\0') || raw.includes('\\')) throw new Error(`unsafe archive entry path: ${JSON.stringify(raw)}`);
  if (raw.startsWith('/') || /^[a-zA-Z]:/.test(raw)) throw new Error(`absolute archive entry path: ${raw}`);
  let candidate = raw;
  while (candidate.startsWith('./')) candidate = candidate.slice(2);
  if (!candidate || candidate === '.') return '';
  const directory = candidate.endsWith('/');
  if (directory) candidate = candidate.slice(0, -1);
  const parts = candidate.split('/');
  if (!parts.length || parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error(`traversal or ambiguous archive entry path: ${raw}`);
  }
  return parts.join('/') + (directory ? '/' : '');
}

function validateArchiveEntryNames(entryNames = []) {
  const seenExact = new Set();
  const seenPortable = new Map();
  const entries = [];
  for (const raw of entryNames) {
    const normalized = normalizeArchiveEntryName(raw);
    if (!normalized) continue;
    const collisionKey = normalized.replace(/\/$/, '').toLocaleLowerCase('en-US');
    if (seenExact.has(normalized)) throw new Error(`duplicate archive entry: ${normalized}`);
    if (seenPortable.has(collisionKey)) {
      throw new Error(`portable archive path collision: ${seenPortable.get(collisionKey)} <> ${normalized}`);
    }
    seenExact.add(normalized);
    seenPortable.set(collisionKey, normalized);
    entries.push(normalized);
  }
  return entries;
}

function detectArchiveFormat(archivePath) {
  const target = path.resolve(archivePath || '');
  const fd = fs.openSync(target, 'r');
  try {
    const header = Buffer.alloc(512);
    const bytes = fs.readSync(fd, header, 0, header.length, 0);
    if (bytes >= 4) {
      const signature = header.readUInt32LE(0);
      if ([0x04034b50, 0x06054b50, 0x08074b50].includes(signature)) return 'zip';
    }
    if (bytes >= 262 && header.toString('ascii', 257, 262) === 'ustar') return 'tar';
    if (bytes >= 2 && header[0] === 0x1f && header[1] === 0x8b) return 'tar-gzip';
    return 'unknown';
  } finally {
    fs.closeSync(fd);
  }
}

function inspectZipArchive(target) {
  if (!commandAvailable('unzip', ['-v'])) {
    if (!commandAvailable('tar')) throw new Error('unzip or tar is required for ZIP safety inspection');
    const rawNames = run('tar', ['-tf', target]).split(/\r?\n/).filter(Boolean);
    const verboseLines = run('tar', ['-tvf', target]).split(/\r?\n/).filter(Boolean);
    if (rawNames.length !== verboseLines.length) {
      throw new Error(`ZIP listing mismatch or newline-bearing entry: names=${rawNames.length} verbose=${verboseLines.length}`);
    }
    const entries = validateArchiveEntryNames(rawNames);
    const unsupported = [];
    verboseLines.forEach((line, index) => {
      const type = String(line || '')[0] || '';
      if (type !== '-' && type !== 'd') unsupported.push(`${type || '?'}:${rawNames[index] || index}`);
    });
    if (unsupported.length) throw new Error(`archive contains link or special entries: ${unsupported.join(', ')}`);
    return { entries, rawEntryCount:rawNames.length, inspectionTool:'tar' };
  }
  const rawNames = run('unzip', ['-Z1', target]).split(/\r?\n/).filter(Boolean);
  const entries = validateArchiveEntryNames(rawNames);
  const listingCommand = commandAvailable('zipinfo', ['-h']) ? 'zipinfo' : 'unzip';
  const listingArgs = listingCommand === 'zipinfo' ? ['-l', target] : ['-Z', '-l', target];
  const typeLines = run(listingCommand, listingArgs)
    .split(/\r?\n/)
    .filter(line => /^[bcdlps-][rwxStTs-]{9}\s/.test(String(line || '')));
  if (rawNames.length !== typeLines.length) {
    throw new Error(`ZIP listing mismatch or newline-bearing entry: names=${rawNames.length} verbose=${typeLines.length}`);
  }
  const unsupported = [];
  typeLines.forEach((line, index) => {
    const type = String(line || '')[0] || '';
    if (type !== '-' && type !== 'd') unsupported.push(`${type || '?'}:${rawNames[index] || index}`);
  });
  if (unsupported.length) throw new Error(`archive contains link or special entries: ${unsupported.join(', ')}`);
  return { entries, rawEntryCount:rawNames.length, inspectionTool:'unzip' };
}

function inspectTarArchive(target) {
  if (!commandAvailable('tar')) throw new Error('tar is required for TAR safety inspection');
  const rawNames = run('tar', ['-tf', target]).split(/\r?\n/).filter(Boolean);
  const verboseLines = run('tar', ['-tvf', target]).split(/\r?\n/).filter(Boolean);
  if (rawNames.length !== verboseLines.length) {
    throw new Error(`TAR listing mismatch or newline-bearing entry: names=${rawNames.length} verbose=${verboseLines.length}`);
  }
  const entries = validateArchiveEntryNames(rawNames);
  const unsupported = [];
  verboseLines.forEach((line, index) => {
    const type = String(line || '')[0] || '';
    if (type !== '-' && type !== 'd') unsupported.push(`${type || '?'}:${rawNames[index] || index}`);
  });
  if (unsupported.length) throw new Error(`archive contains link or special entries: ${unsupported.join(', ')}`);
  return { entries, rawEntryCount:rawNames.length };
}

function inspectArchiveBeforeExtract(archivePath, options = {}) {
  const target = path.resolve(archivePath || '');
  if (!target || !fs.existsSync(target)) throw new Error(`archive is missing: ${target}`);
  const format = detectArchiveFormat(target);
  const expectedFormat = String(options.expectedFormat || '').trim().toLowerCase();
  if (expectedFormat && format !== expectedFormat) throw new Error(`archive format mismatch: expected ${expectedFormat}, detected ${format}`);
  let result;
  if (format === 'zip') result = inspectZipArchive(target);
  else if (format === 'tar' || format === 'tar-gzip') result = inspectTarArchive(target);
  else throw new Error(`unsupported or unrecognized archive format: ${format}`);
  return { pass:ARCHIVE_SAFETY_PASS, archivePath:target, format, ...result };
}

function assertExtractedTreeHasNoLinks(rootDir) {
  const root = path.resolve(rootDir);
  const links = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) { links.push(path.relative(root, full).replace(/\\/g, '/')); continue; }
      if (stat.isDirectory()) walk(full);
    }
  }
  walk(root);
  if (links.length) throw new Error(`extracted tree contains links: ${links.join(', ')}`);
  return { pass:ARCHIVE_SAFETY_PASS, links:0 };
}

module.exports = {
  ARCHIVE_SAFETY_PASS,
  normalizeArchiveEntryName,
  validateArchiveEntryNames,
  detectArchiveFormat,
  inspectArchiveBeforeExtract,
  assertExtractedTreeHasNoLinks
};
