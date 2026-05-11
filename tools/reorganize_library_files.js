#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const LIBRARY_REORGANIZE_FILES_PASS = 'v311-library-reorganize-files-pass';
const DEFAULT_LAYOUT = 'date-title';
const DEFAULT_CONFLICT = 'rename';
const VALID_LAYOUTS = new Set(['date-title', 'date-author-title', 'author-title', 'flat-title']);
const VALID_MODES = new Set(['copy', 'move']);
const VALID_CONFLICTS = new Set(['rename', 'skip', 'error']);
const ASSET_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const TXT_READER_EPISODES_MARKER = '.txt-reader-episodes';
const DEFAULT_UNKNOWN_DATE = '_undated';
const DEFAULT_UNKNOWN_AUTHOR = '_unknown-author';

function normalizeSlashes(value = '') {
  return String(value || '').replace(/\//g, '\\');
}

function toPosix(value = '') {
  return String(value || '').replace(/\\/g, '/');
}

function parseArgs(argv = []) {
  const options = {
    input: '',
    dest: '',
    apply: false,
    mode: 'copy',
    layout: DEFAULT_LAYOUT,
    onConflict: DEFAULT_CONFLICT,
    includeAssets: false,
    marker: true,
    verifyExists: false,
    planOut: '',
    limit: 0
  };

  for (const arg of argv) {
    if (arg === '--apply') { options.apply = true; continue; }
    if (arg === '--dry-run') { options.apply = false; continue; }
    if (arg === '--include-assets') { options.includeAssets = true; continue; }
    if (arg === '--no-marker') { options.marker = false; continue; }
    if (arg === '--verify-exists') { options.verifyExists = true; continue; }
    if (arg.startsWith('--input=')) { options.input = arg.split('=').slice(1).join('='); continue; }
    if (arg.startsWith('--dest=')) { options.dest = arg.split('=').slice(1).join('='); continue; }
    if (arg.startsWith('--mode=')) { options.mode = arg.split('=').slice(1).join('='); continue; }
    if (arg.startsWith('--layout=')) { options.layout = arg.split('=').slice(1).join('='); continue; }
    if (arg.startsWith('--on-conflict=')) { options.onConflict = arg.split('=').slice(1).join('='); continue; }
    if (arg.startsWith('--plan-out=')) { options.planOut = arg.split('=').slice(1).join('='); continue; }
    if (arg.startsWith('--limit=')) { options.limit = Number(arg.split('=').slice(1).join('=')) || 0; continue; }
    if (arg === '--help' || arg === '-h') { options.help = true; continue; }
    throw new Error('unknown argument: ' + arg);
  }

  if (!VALID_MODES.has(options.mode)) throw new Error('invalid --mode. Use copy or move.');
  if (!VALID_LAYOUTS.has(options.layout)) throw new Error('invalid --layout.');
  if (!VALID_CONFLICTS.has(options.onConflict)) throw new Error('invalid --on-conflict.');
  return options;
}

function usage() {
  return [
    'Usage:',
    '  node tools/reorganize_library_files.js --input=C:\\path\\file.txt --dest=D:\\NovelLibrary [--apply]',
    '',
    'Defaults:',
    '  dry-run, --mode=copy, --layout=date-title, --on-conflict=rename',
    '',
    'Layouts:',
    '  date-title          <dest>/<source-date>/<title>/0001 - body.txt',
    '  date-author-title   <dest>/<source-date>/<author>/<title>/0001 - body.txt',
    '  author-title        <dest>/<author>/<title>/0001 - body.txt',
    '  flat-title          <dest>/<title>/0001 - body.txt',
    '',
    'Useful options:',
    '  --apply             actually copy or move files',
    '  --mode=copy|move    copy is safer; move changes the original library',
    '  --include-assets    copy jpg/png/webp files next to the novel as cover/assets',
    '  --verify-exists     fail the plan if a listed source file is missing',
    '  --plan-out=plan.json',
    '  --limit=N           plan only the first N input paths'
  ].join('\n');
}

function readPathList(inputPath) {
  if (!inputPath) throw new Error('--input is required');
  return readTextAutoEncoding(inputPath)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function readTextAutoEncoding(filePath) {
  const raw = fs.readFileSync(filePath);
  if (raw.length >= 2 && raw[0] === 0xFF && raw[1] === 0xFE) return raw.slice(2).toString('utf16le');
  if (raw.length >= 2 && raw[0] === 0xFE && raw[1] === 0xFF) {
    const swapped = Buffer.alloc(raw.length - 2);
    for (let i = 2; i + 1 < raw.length; i += 2) {
      swapped[i - 2] = raw[i + 1];
      swapped[i - 1] = raw[i];
    }
    return swapped.toString('utf16le');
  }
  const sample = raw.slice(0, Math.min(raw.length, 4096));
  let oddNulls = 0;
  let evenNulls = 0;
  for (let i = 0; i < sample.length; i += 1) {
    if (sample[i] === 0 && i % 2 === 0) evenNulls += 1;
    if (sample[i] === 0 && i % 2 === 1) oddNulls += 1;
  }
  if (oddNulls > sample.length / 8 && evenNulls < oddNulls / 4) return raw.toString('utf16le');
  return raw.toString('utf8').replace(/^\uFEFF/, '');
}

function getExtension(filePath = '') {
  return path.win32.extname(normalizeSlashes(filePath)).toLowerCase();
}

function isTxtPath(filePath = '') {
  return getExtension(filePath) === '.txt';
}

function isAssetPath(filePath = '') {
  return ASSET_EXTENSIONS.has(getExtension(filePath));
}

function normalizeSourceDate(segment = '') {
  const match = String(segment || '').match(/^(\d{2})[.-](\d{2})[.-](\d{2})$/);
  if (!match) return '';
  const year = Number(match[1]);
  const fullYear = year >= 70 ? 1900 + year : 2000 + year;
  return `${fullYear}-${match[2]}-${match[3]}`;
}

function splitWindowsPath(filePath = '') {
  return normalizeSlashes(filePath).split(/\\+/).filter(Boolean);
}

function getSourceDate(filePath = '') {
  const parts = splitWindowsPath(filePath);
  for (const part of parts) {
    const date = normalizeSourceDate(part);
    if (date) return date;
  }
  return '';
}

function stripExtension(name = '') {
  return String(name || '').replace(/\.[^.]+$/i, '');
}

function collapseWhitespace(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripAuthorAndBracketNoise(value = '') {
  return collapseWhitespace(String(value || '')
    .replace(/@([^\s()[\]{}]+)\s*$/u, '')
    .replace(/\[[^\]]*(?:\uC644\uACB0|\uC644|\u5B8C|fantasy|romance|modern|martial)[^\]]*\]/ig, '')
    .replace(/\[(?:[^\],]+,\s*)?[^\],]+\]\s*$/u, ''));
}

function cleanTitle(raw = '') {
  const original = collapseWhitespace(stripExtension(raw));
  let title = original;
  title = title.replace(/^\((?:\uC644\uC804\uD310|complete|full)\)\s*/iu, '');
  title = stripAuthorAndBracketNoise(title);
  title = title
    .replace(/\b(?:side\s*story|extra|epilogue)\b.*$/iu, '')
    .replace(/(?:\d{1,5}\s*(?:[-~+\uFF0B]\s*)?\d{0,5}\s*(?:\uD654|\uAD8C)?\s*)+(?:\uC644\uACB0|\uC644|\u5B8C|end|complete).*$/iu, '')
    .replace(/(?:\d{1,5}\s*(?:[-~]\s*)?\d{0,5}\s*(?:\uD654|\uAD8C)?\s*)+(?:\uC678\uC804|\uC678\uD3EC).*$/iu, '')
    .replace(/\s*[-_]\s*\d{1,5}\s*(?:\uC644\uACB0|\uC644|\u5B8C)?\s*$/u, '')
    .replace(/\s+\d{1,5}\s*(?:\uD654|\uAD8C)?\s*$/u, '')
    .replace(/\((?:\uC644\uACB0|\uC644|\u5B8C|end|complete)[^)]*\)\s*$/iu, '')
    .replace(/\b(?:\uC644\uACB0|\uC644|\u5B8C)\s*$/u, '');
  title = collapseWhitespace(title.replace(/[,_-]+$/g, ''));
  return title || original || 'untitled';
}

function extractAuthor(raw = '') {
  const base = stripExtension(raw);
  const tag = base.match(/@([^\s()[\]{}]+)\s*$/u);
  if (tag) return tag[1];
  const bracket = base.match(/\[([^\]]+)\]\s*$/u);
  if (bracket) {
    const parts = bracket[1].split(',').map(part => collapseWhitespace(part)).filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 1];
  }
  return '';
}

function sanitizeSegment(value = '') {
  let segment = collapseWhitespace(value);
  segment = segment.replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ');
  segment = collapseWhitespace(segment).replace(/[. ]+$/g, '');
  if (!segment) segment = 'untitled';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(segment)) segment = '_' + segment;
  return segment.slice(0, 120);
}

function createEntry(source) {
  const normalized = normalizeSlashes(source);
  const dir = path.win32.dirname(normalized);
  const base = path.win32.basename(normalized);
  return {
    source: normalized,
    dir,
    base,
    ext: getExtension(normalized),
    date: getSourceDate(normalized),
    author: extractAuthor(base),
    type: isTxtPath(normalized) ? 'txt' : (isAssetPath(normalized) ? 'asset' : 'other')
  };
}

function sortEntries(entries = []) {
  const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
  return entries.slice().sort((a, b) => collator.compare(a.base || a.source, b.base || b.source));
}

function chooseAuthor(entries = []) {
  for (const entry of entries) {
    if (entry.author) return entry.author;
  }
  return '';
}

function makeGroupFromTxtEntries(key, entries, titleSource) {
  const sorted = sortEntries(entries);
  return {
    key,
    title: cleanTitle(titleSource),
    sourceTitle: titleSource,
    sourceDir: sorted[0]?.dir || '',
    sourceDate: sorted[0]?.date || '',
    author: chooseAuthor(sorted),
    txtEntries: sorted,
    assetEntries: []
  };
}

function normalizeComparableTitle(value = '') {
  return cleanTitle(value)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

function isBucketDirectoryName(name = '') {
  const clean = String(name || '').trim();
  if (!clean) return true;
  if (/^=+/.test(clean)) return true;
  if (normalizeSourceDate(clean)) return true;
  return false;
}

function shouldGroupDirectoryAsNovel(dir, dirTxts = []) {
  if (!Array.isArray(dirTxts) || dirTxts.length < 2) return false;
  const dirName = path.win32.basename(dir);
  if (isBucketDirectoryName(dirName)) return false;
  const dirTitle = normalizeComparableTitle(dirName);
  if (!dirTitle) return false;
  let matched = 0;
  for (const entry of dirTxts) {
    const fileTitle = normalizeComparableTitle(entry.base);
    if (fileTitle === dirTitle || fileTitle.startsWith(dirTitle) || dirTitle.startsWith(fileTitle)) matched += 1;
  }
  return matched / dirTxts.length >= 0.6;
}

function groupLibraryEntries(paths = [], options = {}) {
  const entries = paths.map(createEntry);
  const txtEntries = entries.filter(entry => entry.type === 'txt');
  const assetEntries = entries.filter(entry => entry.type === 'asset');
  const byDir = new Map();
  for (const entry of txtEntries) {
    if (!byDir.has(entry.dir)) byDir.set(entry.dir, []);
    byDir.get(entry.dir).push(entry);
  }

  const groups = [];
  for (const [dir, dirTxts] of byDir) {
    if (shouldGroupDirectoryAsNovel(dir, dirTxts)) {
      groups.push(makeGroupFromTxtEntries(`dir:${dir}`, dirTxts, path.win32.basename(dir)));
      continue;
    }
    for (const single of dirTxts) {
      groups.push(makeGroupFromTxtEntries(`file:${single.source}`, [single], single.base));
    }
  }

  if (options.includeAssets) {
    const groupsByDir = new Map(groups.map(group => [group.sourceDir, group]));
    for (const asset of assetEntries) {
      const group = groupsByDir.get(asset.dir);
      if (group) group.assetEntries.push(asset);
    }
  }

  return groups;
}

function getGroupTargetParts(group, options = {}) {
  const title = sanitizeSegment(group.title);
  const date = group.sourceDate || DEFAULT_UNKNOWN_DATE;
  const author = sanitizeSegment(group.author || DEFAULT_UNKNOWN_AUTHOR);
  switch (options.layout || DEFAULT_LAYOUT) {
    case 'flat-title': return [title];
    case 'author-title': return [author, title];
    case 'date-author-title': return [date, author, title];
    case 'date-title':
    default:
      return [date, title];
  }
}

function appendNameSuffix(filePath, suffix) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return path.join(dir, `${base} (${suffix})${ext}`);
}

function resolveTargetPath(targetPath, usedTargets, options = {}) {
  const normalized = path.resolve(targetPath);
  if (!usedTargets.has(normalized) && !fs.existsSync(normalized)) {
    usedTargets.add(normalized);
    return { path: normalized, conflict: false, skipped: false };
  }
  if (options.onConflict === 'skip') return { path: normalized, conflict: true, skipped: true };
  if (options.onConflict === 'error') throw new Error('target conflict: ' + normalized);
  for (let i = 2; i < 10000; i += 1) {
    const candidate = appendNameSuffix(normalized, i);
    if (!usedTargets.has(candidate) && !fs.existsSync(candidate)) {
      usedTargets.add(candidate);
      return { path: candidate, conflict: true, skipped: false };
    }
  }
  throw new Error('could not resolve target conflict: ' + normalized);
}

function deriveEpisodeTitle(entry, group, index) {
  if (group.txtEntries.length === 1) return 'body';
  const title = collapseWhitespace(stripAuthorAndBracketNoise(stripExtension(entry.base)));
  const escaped = group.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withoutNovel = collapseWhitespace(title.replace(new RegExp('^' + escaped, 'iu'), '').replace(/^[-_\s]+/, ''));
  return withoutNovel || `episode ${index}`;
}

function buildEpisodeFileName(entry, group, index) {
  const prefix = String(index).padStart(4, '0');
  return `${prefix} - ${sanitizeSegment(deriveEpisodeTitle(entry, group, index))}.txt`;
}

function buildAssetFileName(entry, index, assetCount) {
  const ext = entry.ext || path.win32.extname(entry.base).toLowerCase();
  if (assetCount === 1 && ASSET_EXTENSIONS.has(ext)) return `cover${ext}`;
  return sanitizeSegment(stripExtension(entry.base)) + ext;
}

function buildRelocationPlan(paths = [], options = {}) {
  const dest = options.dest ? path.resolve(options.dest) : '';
  if (!dest) throw new Error('--dest is required');
  const sourcePaths = options.limit ? paths.slice(0, options.limit) : paths.slice();
  const groups = groupLibraryEntries(sourcePaths, options);
  const usedTargets = new Set();
  const actions = [];
  const missingSources = [];
  const targetDirs = new Map();

  for (const group of groups) {
    const parts = getGroupTargetParts(group, options);
    const targetDir = path.join(dest, ...parts);
    targetDirs.set(targetDir, group);
    if (options.marker !== false) {
      actions.push({
        type: 'write-marker',
        target: path.join(targetDir, TXT_READER_EPISODES_MARKER),
        bytes: 0
      });
    }

    group.txtEntries.forEach((entry, index) => {
      if (options.verifyExists && !fs.existsSync(entry.source)) missingSources.push(entry.source);
      const rawTarget = path.join(targetDir, buildEpisodeFileName(entry, group, index + 1));
      const resolved = resolveTargetPath(rawTarget, usedTargets, options);
      actions.push({
        type: options.mode || 'copy',
        source: entry.source,
        target: resolved.path,
        skipped: resolved.skipped,
        conflict: resolved.conflict,
        groupTitle: group.title,
        sourceDate: group.sourceDate || '',
        author: group.author || ''
      });
    });

    group.assetEntries.forEach((entry, index) => {
      if (options.verifyExists && !fs.existsSync(entry.source)) missingSources.push(entry.source);
      const rawTarget = path.join(targetDir, buildAssetFileName(entry, index + 1, group.assetEntries.length));
      const resolved = resolveTargetPath(rawTarget, usedTargets, options);
      actions.push({
        type: options.mode || 'copy',
        source: entry.source,
        target: resolved.path,
        skipped: resolved.skipped,
        conflict: resolved.conflict,
        groupTitle: group.title,
        asset: true
      });
    });
  }

  if (missingSources.length) throw new Error('missing source files: ' + missingSources.slice(0, 10).join(', '));

  const copyActions = actions.filter(action => action.type === 'copy');
  const moveActions = actions.filter(action => action.type === 'move');
  const txtActions = actions.filter(action => (action.type === 'copy' || action.type === 'move') && !action.asset);
  const assetActions = actions.filter(action => (action.type === 'copy' || action.type === 'move') && action.asset);
  const markerActions = actions.filter(action => action.type === 'write-marker');
  const skipped = actions.filter(action => action.skipped);
  return {
    pass: LIBRARY_REORGANIZE_FILES_PASS,
    dryRun: options.apply !== true,
    mode: options.mode || 'copy',
    layout: options.layout || DEFAULT_LAYOUT,
    inputCount: sourcePaths.length,
    groups: groups.length,
    targetDirs: targetDirs.size,
    txtFiles: txtActions.length,
    assetFiles: assetActions.length,
    markerFiles: markerActions.length,
    skipped: skipped.length,
    actions
  };
}

function applyRelocationPlan(plan, options = {}) {
  const applied = [];
  for (const action of plan.actions || []) {
    if (action.skipped) continue;
    if (action.type === 'write-marker') {
      fs.mkdirSync(path.dirname(action.target), { recursive: true });
      if (!fs.existsSync(action.target)) fs.writeFileSync(action.target, '');
      applied.push(action);
      continue;
    }
    if (action.type !== 'copy' && action.type !== 'move') continue;
    if (!fs.existsSync(action.source)) throw new Error('source missing during apply: ' + action.source);
    fs.mkdirSync(path.dirname(action.target), { recursive: true });
    if (action.type === 'move') fs.renameSync(action.source, action.target);
    else fs.copyFileSync(action.source, action.target);
    applied.push(action);
  }
  return { pass: LIBRARY_REORGANIZE_FILES_PASS, applied: applied.length, mode: options.mode || plan.mode };
}

function writePlan(plan, outputPath) {
  if (!outputPath) return null;
  const target = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({
    ...plan,
    actions: plan.actions.map(action => ({
      ...action,
      target: toPosix(action.target)
    }))
  }, null, 2) + '\n');
  return target;
}

function summarizePlan(plan) {
  return [
    `pass=${plan.pass}`,
    `dryRun=${plan.dryRun}`,
    `mode=${plan.mode}`,
    `layout=${plan.layout}`,
    `input=${plan.inputCount}`,
    `novels=${plan.groups}`,
    `txtFiles=${plan.txtFiles}`,
    `assetFiles=${plan.assetFiles || 0}`,
    `markers=${plan.markerFiles}`,
    `skipped=${plan.skipped}`
  ].join(' ');
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return { help: true };
  }
  const paths = readPathList(options.input);
  const plan = buildRelocationPlan(paths, options);
  const planPath = writePlan(plan, options.planOut);
  const applyResult = options.apply ? applyRelocationPlan(plan, options) : null;
  console.log(summarizePlan(plan));
  if (planPath) console.log('plan=' + planPath);
  if (applyResult) console.log(`applied=${applyResult.applied}`);
  else console.log('dry-run only; pass --apply to write files');
  return { plan, planPath, applyResult };
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.stack || error);
    process.exit(1);
  }
}

module.exports = {
  LIBRARY_REORGANIZE_FILES_PASS,
  TXT_READER_EPISODES_MARKER,
  parseArgs,
  readPathList,
  readTextAutoEncoding,
  cleanTitle,
  extractAuthor,
  sanitizeSegment,
  groupLibraryEntries,
  buildRelocationPlan,
  applyRelocationPlan,
  summarizePlan,
  main
};
