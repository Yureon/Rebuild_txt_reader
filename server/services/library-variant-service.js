const crypto = require('crypto');
const path = require('path');
const { decodeSketch, sketchSimilarity } = require('./library-fingerprint-sketch');

const LIBRARY_VARIANT_GROUPING_PASS = 'v628-library-variant-grouping-pass';
const LIBRARY_VARIANT_PRESENTATION_PASS = 'v628-library-variant-presentation-pass';
const LIBRARY_VARIANT_RANGE_SHAPE_PASS = 'v628-library-variant-range-shape-pass';
const LIBRARY_VARIANT_SIMILARITY_PASS = 'v642-library-variant-similarity-pass';
const LIBRARY_VARIANT_REPRESENTATIVE_PASS = 'v642-library-variant-representative-quality-pass';
const LIBRARY_VARIANT_LARGE_GROUP_PASS = 'v649-library-variant-large-group-linear-pass';
const LIBRARY_VARIANT_COARSE_BUCKET_PASS = 'v673-library-variant-coarse-bucket-pass';
const EXACT_CONTENT_FAST_PATH_THRESHOLD = 64;
const MAX_PAIRWISE_COMPONENT = 128;

const RANGE_UNIT = String.raw`(?:화|회|편|장|권|부|chapter|chap|ch|episode|ep|book|vol(?:ume)?)`;
const COMPLETE_OR_RELEASE = String.raw`(?:완결|완외|완|完|연재중|연재|미\s*완|미\s*完|작업완료|작업중|외전|번외|에필(?:로그)?|후기|후일담|외포|포함|본편|#?ex|공금|갠소)`;
const COPY_RELEASE_MARKER = String.raw`(?:완결|완외|완|完|작업완료|외전|번외|에필(?:로그)?|후기|후일담|외포|포함|#?ex|공금|갠소)`;
const TRAILING_METADATA_GENRE = String.raw`(?:판타지|퓨전\s*판타지|현대\s*판타지|무협|현대|로맨스|로판|BL|라이트\s*노벨|게임|스포츠|대체역사|공포|미스터리|SF)`;

function compact(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]+/gu, ' ')
    .replace(/\++/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeWorkVariantKey(value) {
  return compact(value).toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]+/gu, '');
}

function stripTextExtension(value) {
  return compact(String(value || '').replaceAll('\\', '/').split('/').pop() || '')
    .replace(/(?:\.(?:txt|text))+$/giu, '')
    .trim();
}

function hasExplicitCopySuffix(value) {
  const basename = stripTextExtension(value);
  if (!basename) return false;
  if (/(?:\(\s*[1-9]\d{0,2}\s*\)|（\s*[1-9]\d{0,2}\s*）|@[^/]{1,80}[-_]\s*[1-9]\d{0,2})$/u.test(basename)) return true;
  return new RegExp(String.raw`${COPY_RELEASE_MARKER}[\s)\]}）]*[-_]\s*[1-9]\d{0,2}$`, 'iu').test(basename);
}

function rangeUnit(value) {
  if (/(?:권|부|book|vol)/iu.test(value)) return 'volume';
  if (/(?:화|회|편|장|chapter|chap|ch|episode|ep)/iu.test(value)) return 'episode';
  return 'unknown';
}

function plausible(start, end) {
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && end >= start && end <= 10_000_000;
}

function sourcePriority(source) {
  if (source === 'explicit-range') return 0;
  if (source === 'space-range') return 1;
  return 2;
}

function addRange(target, signal) {
  if (!plausible(signal.start, signal.end)) return;
  const key = `${signal.start}\0${signal.end}\0${signal.unit}`;
  const current = target.get(key);
  if (!current || sourcePriority(signal.source) < sourcePriority(current.source)) target.set(key, signal);
}

function extractWorkRanges(value) {
  const raw = stripTextExtension(value);
  if (!raw) return [];
  const found = new Map();
  const explicitPattern = new RegExp(
    String.raw`(?<!\d)(?:prol(?:ogue)?\.?\s*[-.]?\s*)?(\d{1,7})(?!\d)\s*(${RANGE_UNIT})?\s*[-~～–—]\s*(\d{1,7})(?!\d)\s*(${RANGE_UNIT})?`,
    'giu'
  );
  for (const match of raw.matchAll(explicitPattern)) {
    addRange(found, {
      start:Number.parseInt(match[1] || '', 10),
      end:Number.parseInt(match[3] || '', 10),
      unit:rangeUnit(`${match[2] || ''}${match[4] || ''}`),
      source:'explicit-range'
    });
  }
  const spacePattern = new RegExp(
    String.raw`(?<!\d)(\d{1,7})(?!\d)\s+(\d{1,7})(?!\d)\s*(${RANGE_UNIT})?\s*(?=${COMPLETE_OR_RELEASE}|[,()[\]{}@]|$)`,
    'giu'
  );
  for (const match of raw.matchAll(spacePattern)) {
    addRange(found, {
      start:Number.parseInt(match[1] || '', 10),
      end:Number.parseInt(match[2] || '', 10),
      unit:rangeUnit(match[3] || ''),
      source:'space-range'
    });
  }
  const prologueEndPattern = /\bprol(?:ogue)?\.?\s*[-~～–—]\s*(\d{1,7})(?!\d)/giu;
  for (const match of raw.matchAll(prologueEndPattern)) {
    addRange(found, { start:0, end:Number.parseInt(match[1] || '', 10), unit:'episode', source:'implicit-end' });
  }
  const markedCountPattern = new RegExp(String.raw`(?<!\d)(\d{1,7})(?!\d)\s*(${RANGE_UNIT})(?![\p{L}\p{N}])`, 'giu');
  for (const match of raw.matchAll(markedCountPattern)) {
    const unit = rangeUnit(match[2] || '');
    const end = Number.parseInt(match[1] || '', 10);
    addRange(found, {
      start:unit === 'volume' ? end : 1,
      end,
      unit,
      source:unit === 'volume' ? 'single-unit' : 'implicit-end'
    });
  }
  const statusCountPattern = new RegExp(
    String.raw`(?:^|[\s([{@,+])(?<end>\d{1,7})(?!\d)\s*(?:\[[^\]]{0,80}\]\s*)?(?=${COMPLETE_OR_RELEASE})`,
    'giu'
  );
  for (const match of raw.matchAll(statusCountPattern)) {
    addRange(found, { start:1, end:Number.parseInt(match.groups?.end || '', 10), unit:'unknown', source:'implicit-end' });
  }
  const withoutCopySuffix = raw.replace(/\s*[[(（]\s*\d{1,3}\s*[\])）]\s*$/u, '').trim();
  const identifierLike = /^(?:file|scalog)\b/iu.test(withoutCopySuffix)
    || /\b(?:19|20)\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}\b/u.test(withoutCopySuffix)
    || /\b\d{8}\b/u.test(withoutCopySuffix);
  if (!identifierLike) {
    const endOnly = withoutCopySuffix.match(new RegExp(
      String.raw`(?:^|\s)[-~～–—]\s*(\d{2,7})(?!\d)\s*(?:${RANGE_UNIT})?\s*(?=${COMPLETE_OR_RELEASE}|@|[,()[\]{}]|$)`,
      'iu'
    ));
    const endOnlyValue = Number.parseInt(endOnly?.[1] || '', 10);
    if (endOnly && endOnlyValue >= 20 && endOnlyValue <= 10_000_000 && (endOnlyValue < 1900 || endOnlyValue > 2099)) {
      addRange(found, { start:1, end:endOnlyValue, unit:rangeUnit(endOnly[0] || ''), source:'implicit-end' });
    }
    const bareTrailing = withoutCopySuffix.match(/(?:^|\s)(\d{2,5})$/u);
    const end = Number.parseInt(bareTrailing?.[1] || '', 10);
    if (bareTrailing && end >= 20 && end <= 20_000 && (end < 1900 || end > 2099)) {
      addRange(found, { start:1, end, unit:'unknown', source:'implicit-end' });
    }
  }
  return [...found.values()].sort((left, right) =>
    sourcePriority(left.source) - sourcePriority(right.source)
      || left.start - right.start
      || left.end - right.end
      || left.unit.localeCompare(right.unit)
  );
}

function extractWorkRange(value) {
  const ranges = extractWorkRanges(value);
  if (!ranges.length) return null;
  const nonVolume = ranges.filter(item => item.unit !== 'volume');
  const selected = nonVolume.length ? nonVolume : ranges;
  return {
    start:Math.min(...selected.map(item => item.start)),
    end:Math.max(...selected.map(item => item.end)),
    unit:selected.some(item => item.unit === 'episode') ? 'episode' : selected.every(item => item.unit === 'volume') ? 'volume' : 'unknown',
    source:[...selected].sort((a, b) => sourcePriority(a.source) - sourcePriority(b.source))[0]?.source || 'implicit-end'
  };
}

function stripCopySuffix(value) {
  let out = compact(value);
  out = out.replace(/\s*[[(（]\s*[1-9]\d{0,2}\s*[\])）]\s*$/u, '');
  out = out.replace(/(@[^/]{1,80})[-_]\s*[1-9]\d{0,2}\s*$/u, '$1');
  out = out.replace(new RegExp(String.raw`(${COPY_RELEASE_MARKER})[\s)\]}）]*[-_]\s*[1-9]\d{0,2}\s*$`, 'iu'), '$1');
  return compact(out);
}

function extractAuthor(value) {
  const raw = stripCopySuffix(stripTextExtension(value));
  const match = raw.match(/@\s*([^@]{1,100})\s*$/u);
  if (match) {
    const tail = compact(match[1]).replace(/[-_]\s*[1-9]\d{0,2}\s*$/u, '').trim();
    const metadataBoundary = tail.search(new RegExp(
      String.raw`\s+(?=(?:(?:\d{1,7}\s*[-~～–—]\s*\d{1,7})|(?:[-~～–—]\s*\d{2,7})|(?:\d{1,7}\s+\d{1,7}\s*(?:${COMPLETE_OR_RELEASE}))|(?:${COMPLETE_OR_RELEASE})(?:\s|$)))`,
      'iu'
    ));
    const author = compact(metadataBoundary >= 0 ? tail.slice(0, metadataBoundary) : tail);
    const trailingMetadata = compact(metadataBoundary >= 0 ? tail.slice(metadataBoundary) : '');
    return {
      author,
      withoutAuthor:compact(`${raw.slice(0, match.index)} ${trailingMetadata}`)
    };
  }
  const genreAuthor = raw.match(new RegExp(String.raw`\[\s*${TRAILING_METADATA_GENRE}\s*,\s*([^\],]{1,80})\s*\]\s*$`, 'iu'));
  if (genreAuthor) {
    return { author:compact(genreAuthor[1]), withoutAuthor:compact(raw.slice(0, genreAuthor.index)) };
  }
  const taggedAuthor = raw.match(new RegExp(String.raw`\[\s*${TRAILING_METADATA_GENRE}\s*\]\s*\[\s*(?:완결|완|完)\s*\]\s*[-–—]\s*([^\[\]@]{1,80})\s*$`, 'iu'));
  if (taggedAuthor) {
    return { author:compact(taggedAuthor[1]), withoutAuthor:compact(raw.slice(0, taggedAuthor.index)) };
  }
  return { author:'', withoutAuthor:raw };
}

function removeVariantDecorations(value) {
  let out = compact(value);
  out = out.replace(new RegExp(String.raw`(?<!\d)(?:prol(?:ogue)?\.?\s*[-.]?\s*)?\d{1,7}(?!\d)\s*(?:${RANGE_UNIT})?\s*[-~～–—]\s*\d{1,7}(?!\d)\s*(?:${RANGE_UNIT})?`, 'giu'), ' ');
  out = out.replace(new RegExp(String.raw`(?<!\d)\d{1,7}(?!\d)\s+\d{1,7}(?!\d)\s*(?:${RANGE_UNIT})?\s*(?=${COMPLETE_OR_RELEASE}|[,()[\]{}]|$)`, 'giu'), ' ');
  out = out.replace(new RegExp(String.raw`(?<!\d)\d{1,7}(?!\d)\s*(?:${RANGE_UNIT})(?![\p{L}\p{N}])`, 'giu'), ' ');
  out = out.replace(new RegExp(String.raw`(?:^|\s)[-~～–—]\s*\d{1,7}(?!\d)\s*(?:${RANGE_UNIT})?`, 'giu'), ' ');
  out = out.replace(new RegExp(String.raw`(?:^|\s)\d{2,5}(?=\s*(?:${COMPLETE_OR_RELEASE}|$))`, 'giu'), ' ');
  out = out.replace(new RegExp(String.raw`(?:^|[\s()[\]{}+,_-])(?:${COMPLETE_OR_RELEASE})(?=$|[\s()[\]{}+,_-])`, 'giu'), ' ');
  out = out.replace(new RegExp(String.raw`\[\s*(?:${TRAILING_METADATA_GENRE}|완결|완|完)\s*\]`, 'giu'), ' ');
  out = out.replace(/[()[\]{}（）]+/gu, ' ');
  out = out.replace(/[._]+/gu, ' ');
  out = out.replace(/\s*[-_]+\s*$/u, ' ');
  return compact(out);
}

function normalizeSimilarityText(value, limit = 12000) {
  return compact(value).toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]+/gu, '').slice(0, limit);
}

function ngramSet(value, width = 3) {
  const text = normalizeSimilarityText(value);
  const out = new Set();
  if (!text) return out;
  if (text.length <= width) { out.add(text); return out; }
  for (let index = 0; index <= text.length - width; index += 1) out.add(text.slice(index, index + width));
  return out;
}

function textSimilarity(left, right) {
  const aText = normalizeSimilarityText(left);
  const bText = normalizeSimilarityText(right);
  if (!aText || !bText) return null;
  if (aText === bText) return 1;
  const a = ngramSet(aText, aText.length < 24 || bText.length < 24 ? 2 : 3);
  const b = ngramSet(bText, aText.length < 24 || bText.length < 24 ? 2 : 3);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  const jaccard = intersection / Math.max(1, a.size + b.size - intersection);
  const containment = intersection / Math.max(1, Math.min(a.size, b.size));
  return Math.max(jaccard, containment * 0.94);
}

function deriveVariantSignal(novel, options = {}) {
  const sourcePath = String(novel?.singlePath || '');
  const sourceName = stripTextExtension(sourcePath || novel?.fileName || novel?.title || '');
  const explicitCopy = hasExplicitCopySuffix(sourceName);
  const copyStripped = stripCopySuffix(sourceName);
  const parsed = extractAuthor(copyStripped);
  const fileAuthor = parsed.author;
  const withoutAuthor = parsed.withoutAuthor;
  const range = extractWorkRange(withoutAuthor);
  const complete = /(?:완결|작업완료|(?<!\p{L})완(?!\p{L})|完)/iu.test(withoutAuthor);
  const releaseMarked = new RegExp(COMPLETE_OR_RELEASE, 'iu').test(withoutAuthor);
  const baseTitle = removeVariantDecorations(withoutAuthor) || compact(novel?.title || sourceName) || 'Untitled';
  const metadataTitle = compact(novel?.title || '');
  const author = compact(novel?.author || fileAuthor || '');
  const baseKey = normalizeWorkVariantKey(baseTitle);
  const metadataKey = normalizeWorkVariantKey(metadataTitle);
  const normalizedSource = normalizeWorkVariantKey(copyStripped);
  const normalizedAuthor = normalizeWorkVariantKey(author);
  const synopsis = compact(novel?.description || novel?.synopsis || '').slice(0, 12000);
  const fingerprint = options.fingerprintService && typeof options.fingerprintService.getCached === 'function'
    ? options.fingerprintService.getCached(novel, { queueRefresh:options.queueFingerprintWork !== false })
    : novel?.contentFingerprint || null;
  return {
    id:String(novel?.id || ''),
    sourceName,
    sourcePath,
    baseTitle,
    baseKey,
    metadataTitle,
    metadataKey,
    author,
    fileAuthor,
    normalizedAuthor,
    normalizedSource,
    synopsis,
    hasAppliedMetadata:!!novel?.metadata,
    explicitCopy,
    range,
    complete,
    releaseMarked,
    fingerprint,
    hasEvidence:explicitCopy || !!range || releaseMarked || !!novel?.metadata || !!fingerprint
  };
}

function authorsCompatible(left, right) {
  return !left || !right || left === right;
}

function rangesUseCompatibleUnits(left, right) {
  const leftUnit = String(left?.unit || 'unknown');
  const rightUnit = String(right?.unit || 'unknown');
  if (leftUnit === rightUnit) return true;
  if (leftUnit === 'volume' || rightUnit === 'volume') return false;
  return leftUnit === 'unknown' || rightUnit === 'unknown';
}

function rangeSimilarity(left, right) {
  if (!left || !right || !rangesUseCompatibleUnits(left, right)) return null;
  const leftStart = Number(left.start) || 0;
  const rightStart = Number(right.start) || 0;
  const leftEnd = Number(left.end) || 0;
  const rightEnd = Number(right.end) || 0;
  if (!leftEnd || !rightEnd) return null;
  const overlap = Math.max(0, Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart) + 1);
  const span = Math.max(1, Math.max(leftEnd, rightEnd) - Math.min(leftStart, rightStart) + 1);
  return overlap / span;
}

function pairAnalysis(left, right, options = {}) {
  const preferenceService = options.preferenceService || null;
  const excluded = !!(preferenceService && typeof preferenceService.isExcluded === 'function' && preferenceService.isExcluded(left.signal.id, right.signal.id));
  const title = Math.max(
    textSimilarity(left.signal.baseTitle, right.signal.baseTitle) ?? 0,
    textSimilarity(left.signal.metadataTitle, right.signal.metadataTitle) ?? 0
  );
  const authorKnown = !!(left.signal.normalizedAuthor && right.signal.normalizedAuthor);
  const author = authorKnown ? (left.signal.normalizedAuthor === right.signal.normalizedAuthor ? 1 : 0) : null;
  const synopsis = textSimilarity(left.signal.synopsis, right.signal.synopsis);
  const prefix = sketchSimilarity(left.signal.fingerprint?.prefixSketch, right.signal.fingerprint?.prefixSketch);
  const middle = sketchSimilarity(left.signal.fingerprint?.middleSketch, right.signal.fingerprint?.middleSketch);
  const range = rangeSimilarity(left.signal.range, right.signal.range);
  const signals = [
    ['title', title, 25],
    ['author', author, 15],
    ['synopsis', synopsis, 20],
    ['prefix', prefix, 30],
    ['middle', middle, 5],
    ['range', range, 5]
  ];
  let weighted = 0;
  let availableWeight = 0;
  const breakdown = {};
  for (const [key, value, weight] of signals) {
    breakdown[key] = value == null ? null : Math.max(0, Math.min(1, Number(value) || 0));
    if (value == null) continue;
    weighted += breakdown[key] * weight;
    availableWeight += weight;
  }
  const score = availableWeight ? weighted / availableWeight : 0;
  const authorConflict = authorKnown && author === 0;
  const exactSource = left.signal.normalizedSource && left.signal.normalizedSource === right.signal.normalizedSource;
  const filenameEvidence = exactSource || left.signal.explicitCopy || right.signal.explicitCopy
    || (left.signal.baseKey && left.signal.baseKey === right.signal.baseKey && left.signal.hasEvidence && right.signal.hasEvidence);
  const bothHaveRanges = !!(left.signal.range && right.signal.range);
  const filenameRangeCompatible = exactSource || left.signal.explicitCopy || right.signal.explicitCopy
    || !bothHaveRanges || (range != null && range > 0);
  const metadataStrong = title >= 0.94 && !authorConflict && (synopsis == null ? left.signal.hasAppliedMetadata && right.signal.hasAppliedMetadata : synopsis >= 0.82);
  const contentStrong = prefix != null && prefix >= 0.90 && (middle == null || middle >= 0.72);
  const contentIdentityStrong = prefix != null && prefix >= 0.98 && title >= 0.88 && !authorConflict && (middle == null || middle >= 0.90);
  const contentReview = prefix != null && prefix >= 0.88 && !authorConflict && (middle == null || middle >= 0.65)
    && (author === 1 || (synopsis != null && synopsis >= 0.70));
  const exactContent = !!(left.signal.fingerprint?.prefixHash && left.signal.fingerprint.prefixHash === right.signal.fingerprint?.prefixHash
    && (!left.signal.fingerprint.middleHash || !right.signal.fingerprint?.middleHash || left.signal.fingerprint.middleHash === right.signal.fingerprint.middleHash));
  const auto = !excluded && !authorConflict && (
    (score >= 0.92 && (contentStrong || metadataStrong))
    || exactContent
    || contentIdentityStrong
    || (prefix == null && synopsis == null && filenameEvidence && filenameRangeCompatible && title >= 0.98)
  );
  const review = !excluded && !authorConflict && !auto && ((score >= 0.82 && title >= 0.82) || contentReview);
  return {
    pass:LIBRARY_VARIANT_SIMILARITY_PASS,
    leftId:left.signal.id,
    rightId:right.signal.id,
    score:Number(score.toFixed(4)),
    confidence:score >= 0.92 ? 'high' : score >= 0.82 ? 'review' : 'low',
    auto,
    review,
    excluded,
    authorConflict,
    exactContent,
    metadataStrong,
    contentStrong,
    contentIdentityStrong,
    contentReview,
    filenameEvidence,
    filenameRangeCompatible,
    breakdown
  };
}

function sketchCandidateKeys(value, prefix = 'sketch') {
  const values = decodeSketch(value).slice(0, 24);
  const keys = new Set();
  for (let index = 0; index < Math.min(12, values.length); index += 1) {
    keys.add(`${prefix}-value:${values[index].toString(16).padStart(8, '0')}`);
  }
  for (let index = 0; index + 1 < Math.min(16, values.length); index += 2) {
    keys.add(`${prefix}-band:${values[index].toString(16).padStart(8, '0')}:${values[index + 1].toString(16).padStart(8, '0')}`);
  }
  return keys;
}

function createDisjointSet(size) {
  const parent = Array.from({ length:size }, (_, index) => index);
  function find(index) {
    let cursor = index;
    while (parent[cursor] !== cursor) { parent[cursor] = parent[parent[cursor]]; cursor = parent[cursor]; }
    return cursor;
  }
  function union(left, right) {
    const a = find(left); const b = find(right);
    if (a !== b) parent[b] = a;
  }
  return { find, union };
}

function buildCandidateComponents(source, options = {}) {
  const members = [];
  for (const novel of source) {
    if (!novel || novel.isMultiFile || !novel.singlePath) continue;
    const signal = deriveVariantSignal(novel, options);
    if (!signal.baseKey && !signal.metadataKey) continue;
    members.push({ novel, signal });
  }
  const dsu = createDisjointSet(members.length);
  const exactBuckets = new Map();
  const coarseBuckets = new Map();
  members.forEach((member, index) => {
    const signal = member.signal;
    const exactKeys = new Set([signal.baseKey ? `title:${signal.baseKey}` : '', signal.metadataKey ? `title:${signal.metadataKey}` : '', signal.fingerprint?.prefixHash ? `content:${signal.fingerprint.prefixHash}` : ''].filter(Boolean));
    const titles = [...new Set([signal.metadataKey, signal.baseKey].filter(Boolean))];
    const coarseKeys = new Set();
    for (const title of titles) {
      // A prefix-only bucket merged unrelated large catalogs such as numbered
      // works that happened to share the same first few characters. Those
      // false components later triggered quadratic pair analysis. Keep coarse
      // recall, but require both edges and a bounded length band.
      const lengthBand = Math.floor(title.length / 3);
      if (title.length >= 5) coarseKeys.add(`title:${title.slice(0, 8)}:${title.slice(-6)}:${lengthBand}`);
      if (signal.normalizedAuthor && title.length >= 4) coarseKeys.add(`author-title:${signal.normalizedAuthor}:${title.slice(0, 6)}:${title.slice(-4)}:${lengthBand}`);
    }
    if (signal.fingerprint?.prefixSketch) {
      for (const key of sketchCandidateKeys(signal.fingerprint.prefixSketch, 'prefix')) coarseKeys.add(key);
    }
    if (signal.fingerprint?.middleSketch) {
      for (const key of sketchCandidateKeys(signal.fingerprint.middleSketch, 'middle')) coarseKeys.add(key);
    }
    for (const key of exactKeys) {
      const list = exactBuckets.get(key) || []; list.push(index); exactBuckets.set(key, list);
    }
    for (const key of coarseKeys) {
      const list = coarseBuckets.get(key) || []; list.push(index); coarseBuckets.set(key, list);
    }
  });
  for (const [key,indexes] of exactBuckets.entries()) {
    if (key.startsWith('title:') && indexes.length > 128) continue;
    for (let position = 1; position < indexes.length; position += 1) dsu.union(indexes[0], indexes[position]);
  }
  for (const indexes of coarseBuckets.values()) {
    if (indexes.length < 2 || indexes.length > 64) continue;
    for (let position = 1; position < indexes.length; position += 1) dsu.union(indexes[0], indexes[position]);
  }
  const components = new Map();
  members.forEach((member, index) => {
    const root = dsu.find(index);
    const list = components.get(root) || [];
    list.push(member);
    components.set(root, list);
  });
  return { members, components:[...components.values()] };
}


function componentHasUniformExactContent(component = []) {
  if (component.length < EXACT_CONTENT_FAST_PATH_THRESHOLD) return false;
  const prefixHashes = new Set(component.map(item => String(item.signal.fingerprint?.prefixHash || '')).filter(Boolean));
  if (prefixHashes.size !== 1) return false;
  const middleHashes = new Set(component.map(item => String(item.signal.fingerprint?.middleHash || '')).filter(Boolean));
  return middleHashes.size <= 1;
}

function excludedAdjacency(component = [], preferenceService = null) {
  const ids = new Set(component.map(item => String(item.signal.id || '')).filter(Boolean));
  const adjacency = new Map();
  let exclusions = {};
  try { exclusions = preferenceService && typeof preferenceService.list === 'function' ? preferenceService.list().exclusions || {} : {}; } catch {}
  for (const key of Object.keys(exclusions)) {
    if (exclusions[key] !== true) continue;
    const [left, right] = String(key).split('\0');
    if (!ids.has(left) || !ids.has(right)) continue;
    if (!adjacency.has(left)) adjacency.set(left, new Set());
    if (!adjacency.has(right)) adjacency.set(right, new Set());
    adjacency.get(left).add(right);
    adjacency.get(right).add(left);
  }
  return adjacency;
}

function partitionExactContentComponent(component = [], options = {}) {
  const adjacency = excludedAdjacency(component, options.preferenceService);
  const byAuthor = new Map();
  for (const member of component.slice().sort((a, b) => String(a.signal.id).localeCompare(String(b.signal.id)))) {
    const authorKey = member.signal.normalizedAuthor || '__unknown_author__';
    const list = byAuthor.get(authorKey) || [];
    list.push(member);
    byAuthor.set(authorKey, list);
  }
  const groups = [];
  for (const members of byAuthor.values()) {
    const authorGroups = [];
    for (const member of members) {
      const id = String(member.signal.id || '');
      const blocked = adjacency.get(id) || new Set();
      let target = null;
      for (const group of authorGroups) {
        let conflict = false;
        for (const blockedId of blocked) {
          if (group.ids.has(blockedId)) { conflict = true; break; }
        }
        if (!conflict) { target = group; break; }
      }
      if (!target) { target = { members:[], ids:new Set() }; authorGroups.push(target); }
      target.members.push(member);
      target.ids.add(id);
    }
    groups.push(...authorGroups.map(group => group.members));
  }
  return groups;
}

function partitionOversizedComponent(component = []) {
  if (component.length <= MAX_PAIRWISE_COMPONENT) return [component];
  const buckets = new Map();
  for (const member of component) {
    const signal = member.signal;
    const key = [signal.metadataKey || signal.baseKey || '', signal.normalizedAuthor || '', signal.fingerprint?.prefixHash || ''].join('\0');
    const list = buckets.get(key) || [];
    list.push(member);
    buckets.set(key, list);
  }
  const out = [];
  for (const members of buckets.values()) {
    const ordered = members.slice().sort((a, b) => String(a.signal.id).localeCompare(String(b.signal.id)));
    for (let index = 0; index < ordered.length; index += MAX_PAIRWISE_COMPONENT) out.push(ordered.slice(index, index + MAX_PAIRWISE_COMPONENT));
  }
  return out;
}

function groupPreferenceKey(members) {
  const titleKeys = [...new Set(members.flatMap(item => [item.signal.metadataKey, item.signal.baseKey]).filter(Boolean))].sort();
  const authors = [...new Set(members.map(item => item.signal.normalizedAuthor).filter(Boolean))].sort();
  return crypto.createHash('sha256').update(`library-work-v642\0${titleKeys.join('\0')}\0${authors.join('\0')}`).digest('hex').slice(0, 40);
}

function representativeQuality(member, manualId = '') {
  const signal = member.signal;
  const fp = signal.fingerprint || {};
  const rangeEnd = Number(signal.range?.end) || 0;
  const rangeStart = Number(signal.range?.start) || 1;
  const bytes = Math.max(0, Number(fp.bytes) || Number(member.novel?.fileBytes) || 0);
  const mtimeMs = Math.max(0, Number(fp.mtimeMs) || Number(member.novel?.fileMtimeMs) || 0);
  const metadataCompleteness = [member.novel?.author, member.novel?.description || member.novel?.synopsis, member.novel?.coverUrl].filter(Boolean).length;
  const replacementPenalty = Math.min(100, Math.max(0, Number(fp.replacementRatio) || 0) * 10000);
  const score = (signal.id === manualId ? 1_000_000_000 : 0)
    + Math.min(100_000_000, rangeEnd * 100)
    + (signal.complete ? 2000 : 0)
    + Math.min(5000, Math.log2(bytes + 1) * 180)
    + metadataCompleteness * 120
    - replacementPenalty * 40
    - (signal.explicitCopy ? 300 : 0)
    + Math.min(9_999_999_999_999, mtimeMs) / 1e15;
  return {
    pass:LIBRARY_VARIANT_REPRESENTATIVE_PASS,
    score:Number(score.toFixed(3)),
    manual:signal.id === manualId,
    rangeStart:rangeStart || null,
    rangeEnd:rangeEnd || null,
    complete:!!signal.complete,
    bytes,
    mtimeMs,
    replacementRatio:Number((Number(fp.replacementRatio) || 0).toFixed(6)),
    metadataCompleteness,
    reasons:[
      signal.id === manualId ? 'manual-representative' : '',
      rangeEnd ? `range-end:${rangeEnd}` : '',
      signal.complete ? 'complete' : '',
      bytes ? `bytes:${bytes}` : '',
      replacementPenalty === 0 && fp.prefixHash ? 'decode-clean' : ''
    ].filter(Boolean)
  };
}

function relationForMember(member, preferred, analysis) {
  if (member.novel.id === preferred.novel.id) return 'canonical';
  const memberStart = Number(member.signal.range?.start) || 0;
  const memberEnd = Number(member.signal.range?.end) || 0;
  const preferredStart = Number(preferred.signal.range?.start) || 0;
  const preferredEnd = Number(preferred.signal.range?.end) || 0;
  const memberBytes = Math.max(0, Number(member.signal.fingerprint?.bytes) || Number(member.novel?.fileBytes) || 0);
  const preferredBytes = Math.max(0, Number(preferred.signal.fingerprint?.bytes) || Number(preferred.novel?.fileBytes) || 0);
  const rangeSuperset = memberStart && memberEnd && preferredStart && preferredEnd
    && preferredStart <= memberStart && preferredEnd >= memberEnd && (preferredStart < memberStart || preferredEnd > memberEnd);
  if (rangeSuperset) return 'superseded';
  if (analysis?.contentStrong && preferredBytes > memberBytes * 1.08) return 'superseded';
  const sizeRatio = memberBytes && preferredBytes ? Math.min(memberBytes, preferredBytes) / Math.max(memberBytes, preferredBytes) : 1;
  const rangesEquivalent = (!memberEnd && !preferredEnd) || (memberStart === preferredStart && memberEnd === preferredEnd);
  if (member.signal.explicitCopy || member.signal.normalizedSource === preferred.signal.normalizedSource
    || (analysis?.exactContent && sizeRatio >= 0.98 && rangesEquivalent)) return 'duplicate-copy';
  return 'alternate-edition';
}

function buildPresentedGroup(members, pairMap, collator, options = {}) {
  const preferenceKey = groupPreferenceKey(members);
  const manualId = options.preferenceService && typeof options.preferenceService.getRepresentative === 'function'
    ? options.preferenceService.getRepresentative(preferenceKey)
    : '';
  const qualityById = new Map(members.map(member => [member.signal.id, representativeQuality(member, manualId)]));
  const ordered = members.slice().sort((left, right) => {
    const delta = qualityById.get(right.signal.id).score - qualityById.get(left.signal.id).score;
    if (delta !== 0) return delta;
    const titleCmp = collator.compare(String(left.novel.title || ''), String(right.novel.title || ''));
    if (titleCmp !== 0) return titleCmp;
    return collator.compare(String(left.novel.singlePath || ''), String(right.novel.singlePath || ''));
  });
  const preferred = ordered[0];
  const aliases = ordered.map(item => String(item.novel.id || '')).filter(Boolean);
  let variantConfidence = 1;
  const variants = ordered.map(item => {
    const key = [item.signal.id, preferred.signal.id].sort().join('\0');
    const comparison = item.signal.id === preferred.signal.id ? null : pairMap.get(key) || pairAnalysis(item, preferred, options);
    if (comparison && Number.isFinite(Number(comparison.score))) variantConfidence = Math.min(variantConfidence, Number(comparison.score));
    return {
      id:String(item.novel.id || ''),
      title:String(item.novel.title || ''),
      fileName:path.basename(String(item.novel.singlePath || ''), '.txt'),
      relativePath:String(item.novel.singlePath || ''),
      categoryPath:String(item.novel.categoryPath || ''),
      author:item.signal.author || '',
      rangeStart:Number(item.signal.range?.start) || null,
      rangeEnd:Number(item.signal.range?.end) || null,
      complete:!!item.signal.complete,
      explicitCopy:!!item.signal.explicitCopy,
      relation:relationForMember(item, preferred, comparison),
      similarity:comparison,
      representativeQuality:qualityById.get(item.signal.id)
    };
  });
  const groupId = crypto.createHash('sha256').update(`library-variant-v642\0${preferenceKey}\0${aliases.slice().sort().join('\0')}`).digest('hex').slice(0, 32);
  const hiddenVariantCount = Math.max(0, ordered.length - 1);
  const representative = {
    ...preferred.novel,
    title:preferred.signal.hasAppliedMetadata
      ? (preferred.novel.title || preferred.signal.metadataTitle || preferred.signal.baseTitle)
      : (preferred.signal.baseTitle || preferred.novel.title),
    author:preferred.signal.author || preferred.novel.author || '',
    variantGroupId:groupId,
    variantPreferenceKey:preferenceKey,
    variantCount:ordered.length,
    hiddenVariantCount,
    isVariantGroup:hiddenVariantCount > 0,
    variantMemberIds:aliases,
    progressAliases:aliases,
    variants,
    representativeQuality:qualityById.get(preferred.signal.id),
    variantConfidence,
    variantSimilarityPass:LIBRARY_VARIANT_SIMILARITY_PASS,
    shelfSearchKey:[
      preferred.signal.baseTitle,
      preferred.signal.metadataTitle,
      preferred.signal.author,
      ...ordered.flatMap(item => [item.novel.title, item.novel.singlePath, item.novel.categoryPath, item.signal.author, item.signal.synopsis])
    ].map(value => compact(value)).filter(Boolean).join(' ').toLocaleLowerCase('ko-KR')
  };
  return { representative, aliases, preferenceKey };
}

function standaloneNovel(member) {
  return {
    ...member.novel,
    author:member.signal.author || member.novel.author || '',
    variantCount:1,
    hiddenVariantCount:0,
    isVariantGroup:false,
    variantMemberIds:[member.signal.id],
    progressAliases:[member.signal.id],
    variants:[],
    variantSimilarityPass:LIBRARY_VARIANT_SIMILARITY_PASS
  };
}

function buildLibraryVariantPresentation(library = [], options = {}) {
  const collator = options.collator || new Intl.Collator('ko', { numeric:true, sensitivity:'base' });
  const source = Array.isArray(library) ? library : [];
  if (options.queueFingerprintWork !== false) options.fingerprintService?.requestLibrary?.(source, { limit:Number(options.fingerprintBackgroundBatch) || 64 });
  const standalone = source.filter(novel => !novel || novel.isMultiFile || !novel.singlePath).map(novel => ({
    ...novel,
    variantCount:1,
    hiddenVariantCount:0,
    isVariantGroup:false,
    variantMemberIds:[String(novel?.id || '')].filter(Boolean),
    progressAliases:[String(novel?.id || '')].filter(Boolean),
    variants:[],
    variantSimilarityPass:LIBRARY_VARIANT_SIMILARITY_PASS
  }));
  const { components } = buildCandidateComponents(source, options);
  const items = standalone.slice();
  const reviewGroups = [];

  for (const originalComponent of components) {
    if (originalComponent.length < 2) { items.push(standaloneNovel(originalComponent[0])); continue; }
    if (options.queueFingerprintWork !== false) options.fingerprintService?.requestCandidates?.(originalComponent.map(item => item.novel));

    if (componentHasUniformExactContent(originalComponent)) {
      const exactGroups = partitionExactContentComponent(originalComponent, options);
      for (const members of exactGroups) {
        if (members.length >= 2) {
          const presented = buildPresentedGroup(members, new Map(), collator, options).representative;
          presented.variantLargeGroupPass = LIBRARY_VARIANT_LARGE_GROUP_PASS;
          items.push(presented);
        } else if (members.length === 1) items.push(standaloneNovel(members[0]));
      }
      continue;
    }

    for (const component of partitionOversizedComponent(originalComponent)) {
      if (component.length < 2) { items.push(standaloneNovel(component[0])); continue; }
      const pairMap = new Map();
      const reviewPairs = [];
      for (let left = 0; left < component.length; left += 1) {
        for (let right = left + 1; right < component.length; right += 1) {
          const analysis = pairAnalysis(component[left], component[right], options);
          pairMap.set([component[left].signal.id, component[right].signal.id].sort().join('\0'), analysis);
          if (analysis.review) reviewPairs.push(analysis);
        }
      }
      const autoGroups = [];
      const deterministicMembers = component.slice().sort((a, b) => String(a.signal.id).localeCompare(String(b.signal.id)));
      for (const member of deterministicMembers) {
        const compatible = autoGroups.find(group => group.every(existing => {
          const key = [member.signal.id, existing.signal.id].sort().join('\0');
          return pairMap.get(key)?.auto === true;
        }));
        if (compatible) compatible.push(member);
        else autoGroups.push([member]);
      }
      for (const members of autoGroups) {
        if (members.length >= 2) items.push(buildPresentedGroup(members, pairMap, collator, options).representative);
        else items.push(standaloneNovel(members[0]));
      }
      if (reviewPairs.length) {
        reviewGroups.push({
          id:crypto.createHash('sha256').update(`library-review-v642\0${component.map(item => item.signal.id).sort().join('\0')}`).digest('hex').slice(0, 32),
          title:component[0].signal.metadataTitle || component[0].signal.baseTitle,
          members:component.map(item => ({ id:item.signal.id, title:item.novel.title, relativePath:item.novel.singlePath, author:item.signal.author })),
          pairs:reviewPairs
        });
      }
    }
  }

  items.sort((a, b) => {
    const titleCmp = collator.compare(String(a.title || ''), String(b.title || ''));
    if (titleCmp !== 0) return titleCmp;
    return collator.compare(String(a.categoryPath || ''), String(b.categoryPath || ''));
  });
  const byAlias = new Map();
  for (const item of items) {
    const aliases = Array.isArray(item.progressAliases) ? item.progressAliases : [item.id];
    for (const alias of aliases) if (alias) byAlias.set(String(alias), item);
  }
  return {
    pass:LIBRARY_VARIANT_PRESENTATION_PASS,
    groupingPass:LIBRARY_VARIANT_GROUPING_PASS,
    similarityPass:LIBRARY_VARIANT_SIMILARITY_PASS,
    largeGroupPass:LIBRARY_VARIANT_LARGE_GROUP_PASS,
    coarseBucketPass:LIBRARY_VARIANT_COARSE_BUCKET_PASS,
    representativePass:LIBRARY_VARIANT_REPRESENTATIVE_PASS,
    items,
    byAlias,
    reviewGroups,
    hiddenVariantCount:items.reduce((sum, item) => sum + Math.max(0, Number(item.hiddenVariantCount) || 0), 0)
  };
}

module.exports = {
  LIBRARY_VARIANT_GROUPING_PASS,
  LIBRARY_VARIANT_PRESENTATION_PASS,
  LIBRARY_VARIANT_RANGE_SHAPE_PASS,
  LIBRARY_VARIANT_SIMILARITY_PASS,
  LIBRARY_VARIANT_REPRESENTATIVE_PASS,
  LIBRARY_VARIANT_COARSE_BUCKET_PASS,
  normalizeWorkVariantKey,
  hasExplicitCopySuffix,
  extractWorkRanges,
  extractWorkRange,
  deriveVariantSignal,
  buildLibraryVariantPresentation,
  authorsCompatible,
  textSimilarity,
  pairAnalysis,
  representativeQuality,
  groupPreferenceKey,
  sketchCandidateKeys
};
