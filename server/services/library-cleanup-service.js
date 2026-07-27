const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { buildLibraryVariantPresentation } = require('./library-variant-service');

const LIBRARY_CLEANUP_PLAN_PASS = 'v628-library-cleanup-plan-pass';
const LIBRARY_CLEANUP_SCRIPT_PASS = 'v630-library-cleanup-powershell-script-pass';
const LIBRARY_CLEANUP_PLAN_CACHE_PASS = 'v661-library-cleanup-plan-cache-pass';
const CLEANUP_RELATIONS = new Set(['duplicate-copy', 'superseded']);

function portablePath(value) {
  return String(value || '').replaceAll('\\', '/');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function hashPlan(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

async function mapLimit(items, limit, mapper) {
  const source = Array.isArray(items) ? items : [];
  const results = new Array(source.length);
  let cursor = 0;
  const workers = Array.from({ length:Math.min(Math.max(1, limit), Math.max(1, source.length)) }, async () => {
    while (cursor < source.length) {
      const index = cursor++;
      results[index] = await mapper(source[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function createLibraryCleanupService(options = {}) {
  const libraryService = options.libraryService;
  const metadataService = options.metadataService || null;
  const fingerprintService = options.fingerprintService || null;
  const preferenceService = options.preferenceService || null;
  if (!libraryService) throw new Error('createLibraryCleanupService requires libraryService');

  const planCacheTtlMs = Math.max(1000, Math.min(5 * 60 * 1000, Number(options.planCacheTtlMs) || 15000));
  let cachedPlan = null;
  let cachedPlanAt = 0;
  let planPromise = null;
  let planBuilds = 0;
  let planCacheHits = 0;
  let planInflightJoins = 0;


  async function getLibrary() {
    return typeof libraryService.getLibraryCachedForRequestAsync === 'function'
      ? libraryService.getLibraryCachedForRequestAsync()
      : typeof libraryService.getLibraryCachedAsync === 'function'
        ? libraryService.getLibraryCachedAsync()
        : libraryService.getLibraryCached();
  }

  async function statRegularFile(relativePath) {
    const absolutePath = libraryService.safeJoinUnderLibrary(relativePath);
    const stat = await fs.promises.lstat(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      const error = new Error('cleanup target is not a regular file');
      error.code = 'LIBRARY_CLEANUP_NOT_REGULAR_FILE';
      throw error;
    }
    return {
      bytes:Number(stat.size) || 0,
      mtimeMs:Math.trunc(Number(stat.mtimeMs) || 0)
    };
  }

  async function computePlan() {
    const library = await getLibrary();
    const raw = Array.isArray(library) ? library : [];
    const enriched = metadataService && typeof metadataService.enrichNovel === 'function' ? raw.map(item => metadataService.enrichNovel(item)) : raw;
    const rawById = new Map(raw.map(novel => [String(novel?.id || ''), novel]));
    const presentation = buildLibraryVariantPresentation(enriched, { fingerprintService, preferenceService });
    const preferenceState = preferenceService && typeof preferenceService.list === 'function' ? preferenceService.list() : null;
    const groups = [];
    const skipped = [];

    const presentedGroups = presentation.items.filter(presented => presented?.isVariantGroup && Array.isArray(presented.variants));
    const groupResults = await mapLimit(presentedGroups, 8, async presented => {
      const canonicalRaw = rawById.get(String(presented.id || ''));
      if (!canonicalRaw?.singlePath) {
        skipped.push({ groupId:String(presented.variantGroupId || ''), reason:'canonical-path-missing' });
        return null;
      }
      let canonicalStat;
      try { canonicalStat = await statRegularFile(canonicalRaw.singlePath); }
      catch (error) {
        skipped.push({ groupId:String(presented.variantGroupId || ''), reason:String(error?.code || 'canonical-stat-failed') });
        return null;
      }
      const candidates = [];
      for (const variant of presented.variants) {
        const relation = String(variant?.relation || '');
        const rawNovel = rawById.get(String(variant?.id || ''));
        if (!rawNovel?.singlePath || rawNovel.id === canonicalRaw.id) continue;
        try {
          const fileStat = await statRegularFile(rawNovel.singlePath);
          candidates.push({
            id:String(rawNovel.id || ''),
            relativePath:portablePath(rawNovel.singlePath),
            title:String(rawNovel.title || variant.title || ''),
            categoryPath:String(rawNovel.categoryPath || ''),
            relation,
            rangeStart:Number(variant.rangeStart) || null,
            rangeEnd:Number(variant.rangeEnd) || null,
            bytes:fileStat.bytes,
            mtimeMs:fileStat.mtimeMs,
            similarity:variant.similarity || null,
            representativeQuality:variant.representativeQuality || null,
            cleanupEligible:CLEANUP_RELATIONS.has(relation)
          });
        } catch (error) {
          skipped.push({ groupId:String(presented.variantGroupId || ''), id:String(rawNovel.id || ''), reason:String(error?.code || 'candidate-stat-failed') });
        }
      }
      if (!candidates.length) return null;
      return {
        groupId:String(presented.variantGroupId || ''),
        preferenceKey:String(presented.variantPreferenceKey || ''),
        title:String(presented.title || canonicalRaw.title || ''),
        confidence:Number(presented.variantConfidence) || 0,
        representativeQuality:presented.representativeQuality || null,
        canonical:{
          id:String(canonicalRaw.id || ''),
          relativePath:portablePath(canonicalRaw.singlePath),
          title:String(canonicalRaw.title || ''),
          categoryPath:String(canonicalRaw.categoryPath || ''),
          bytes:canonicalStat.bytes,
          mtimeMs:canonicalStat.mtimeMs
        },
        candidates
      };
    });
    groups.push(...groupResults.filter(Boolean));
    const reviewGroups = (presentation.reviewGroups || []).map(group => ({
      id:String(group.id || ''),
      title:String(group.title || ''),
      members:Array.isArray(group.members) ? group.members : [],
      pairs:Array.isArray(group.pairs) ? group.pairs : []
    }));
    const excludedPairs = Object.keys(preferenceState?.exclusions || {}).map(key => {
      const [leftId, rightId] = String(key).split('\0');
      const left = rawById.get(leftId);
      const right = rawById.get(rightId);
      return {
        leftId,
        rightId,
        left:{ id:leftId, title:String(left?.title || ''), relativePath:portablePath(left?.singlePath || '') },
        right:{ id:rightId, title:String(right?.title || ''), relativePath:portablePath(right?.singlePath || '') }
      };
    }).filter(pair => pair.leftId && pair.rightId);
    const allCandidates = groups.flatMap(group => group.candidates || []);
    const summary = {
      groupCount:groups.length,
      candidateCount:allCandidates.filter(item => item.cleanupEligible).length,
      duplicateCopyCount:allCandidates.filter(item => item.relation === 'duplicate-copy').length,
      supersededCount:allCandidates.filter(item => item.relation === 'superseded').length,
      alternateEditionCount:allCandidates.filter(item => item.relation === 'alternate-edition').length,
      suspectedMatchCount:reviewGroups.reduce((sum, group) => sum + (group.pairs || []).length, 0),
      reviewGroupCount:reviewGroups.length,
      skippedCount:skipped.length,
      excludedPairCount:excludedPairs.length,
      fingerprintStatus:fingerprintService && typeof fingerprintService.getStatus === 'function' ? fingerprintService.getStatus() : null
    };
    const planCore = { pass:LIBRARY_CLEANUP_PLAN_PASS, similarityPass:presentation.similarityPass || '', representativePass:presentation.representativePass || '', summary, groups, reviewGroups, excludedPairs, skipped };
    return { ...planCore, planHash:hashPlan(planCore) };
  }

  function currentFingerprintStatus() {
    return fingerprintService && typeof fingerprintService.getStatus === 'function' ? fingerprintService.getStatus() : null;
  }

  function invalidatePlanCache() {
    cachedPlan = null;
    cachedPlanAt = 0;
  }

  async function buildPlan(options = {}) {
    const force = options && options.force === true;
    const now = Date.now();
    if (!force && cachedPlan && now - cachedPlanAt < planCacheTtlMs) {
      planCacheHits += 1;
      return cachedPlan;
    }
    if (planPromise) {
      planInflightJoins += 1;
      return planPromise;
    }
    planBuilds += 1;
    planPromise = computePlan().then(plan => {
      cachedPlan = plan;
      cachedPlanAt = Date.now();
      return plan;
    }).finally(() => { planPromise = null; });
    return planPromise;
  }

  function getPlanStatus(planHash = '') {
    const fingerprintStatus = currentFingerprintStatus();
    const cachedFingerprint = cachedPlan?.summary?.fingerprintStatus || null;
    const requestedHash = String(planHash || '');
    const cacheMatches = !!cachedPlan && (!requestedHash || requestedHash === cachedPlan.planHash);
    const currentQueue = Math.max(0, Number(fingerprintStatus?.queueLength) || 0);
    const cachedQueue = Math.max(0, Number(cachedFingerprint?.queueLength) || 0);
    return {
      pass:LIBRARY_CLEANUP_PLAN_CACHE_PASS,
      planHash:String(cachedPlan?.planHash || ''),
      cacheMatches,
      cacheAgeMs:cachedPlanAt ? Math.max(0, Date.now() - cachedPlanAt) : null,
      cacheTtlMs:planCacheTtlMs,
      building:!!planPromise,
      planBuilds,
      cacheHits:planCacheHits,
      inflightJoins:planInflightJoins,
      fingerprintStatus,
      refreshRecommended:cacheMatches && currentQueue === 0 && cachedQueue > 0
    };
  }

  function selectPlan(plan, input = {}) {
    const requestedRelations = Array.isArray(input.relations)
      ? new Set(input.relations.map(String).filter(value => CLEANUP_RELATIONS.has(value)))
      : new Set(CLEANUP_RELATIONS);
    const requestedGroupIds = Array.isArray(input.groupIds)
      ? new Set(input.groupIds.map(String).filter(Boolean))
      : null;
    const groups = plan.groups
      .filter(group => !requestedGroupIds || requestedGroupIds.has(group.groupId))
      .map(group => ({
        ...group,
        candidates:group.candidates.filter(candidate => requestedRelations.has(candidate.relation))
      }))
      .filter(group => group.candidates.length);
    const summary = {
      groupCount:groups.length,
      candidateCount:groups.reduce((sum, group) => sum + group.candidates.length, 0),
      duplicateCopyCount:groups.reduce((sum, group) => sum + group.candidates.filter(item => item.relation === 'duplicate-copy').length, 0),
      supersededCount:groups.reduce((sum, group) => sum + group.candidates.filter(item => item.relation === 'superseded').length, 0)
    };
    const core = { pass:LIBRARY_CLEANUP_SCRIPT_PASS, sourcePlanHash:plan.planHash, summary, groups };
    return { ...core, scriptPlanHash:hashPlan(core) };
  }

  function renderNodeScript(selected) {
    const serializedPlan = JSON.stringify(selected, null, 2).replace(/\u2028/gu, '\\u2028').replace(/\u2029/gu, '\\u2029');
    return `#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PLAN = ${serializedPlan};
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const rootIndex = args.indexOf('--library');
const quarantineIndex = args.indexOf('--quarantine');
if (rootIndex < 0 || !args[rootIndex + 1]) {
  console.error('Usage: node txt-reader-library-cleanup.cjs --library <library-root> [--apply] [--quarantine <relative-dir>]');
  process.exit(2);
}

const libraryRoot = fs.realpathSync(path.resolve(args[rootIndex + 1]));
const quarantineRel = quarantineIndex >= 0 && args[quarantineIndex + 1]
  ? String(args[quarantineIndex + 1])
  : '.txt-reader-cleanup/' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + PLAN.scriptPlanHash.slice(0, 12);

function resolveUnder(base, portableRelative) {
  const value = String(portableRelative || '');
  if (!value || value.includes('\\0') || value.startsWith('/') || /^[A-Za-z]:/u.test(value)) {
    throw new Error('unsafe relative path: ' + value);
  }
  const segments = value.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error('unsafe path segment: ' + value);
  }
  const target = path.resolve(base, ...segments);
  const relative = path.relative(base, target);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('path escaped root: ' + value);
  }
  return target;
}

function inspectRegular(relativePath, expected) {
  const absolutePath = resolveUnder(libraryRoot, relativePath);
  const stat = fs.lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('not a regular file: ' + relativePath);
  const real = fs.realpathSync(absolutePath);
  const realRelative = path.relative(libraryRoot, real);
  if (!realRelative || realRelative === '..' || realRelative.startsWith('..' + path.sep) || path.isAbsolute(realRelative)) {
    throw new Error('real path escaped root: ' + relativePath);
  }
  if (Number(stat.size) !== Number(expected.bytes)) throw new Error('size changed: ' + relativePath);
  if (Math.abs(Math.trunc(Number(stat.mtimeMs)) - Number(expected.mtimeMs)) > 2000) {
    throw new Error('mtime changed: ' + relativePath);
  }
  return absolutePath;
}

function prepareQuarantineRoot() {
  const lexicalRoot = resolveUnder(libraryRoot, quarantineRel);
  let current = libraryRoot;
  for (const segment of String(quarantineRel).split('/')) {
    const next = path.join(current, segment);
    if (!fs.existsSync(next)) {
      if (!apply) return lexicalRoot;
      fs.mkdirSync(next);
    }
    const stat = fs.lstatSync(next);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('quarantine path is not a regular directory');
    current = next;
  }
  const realRoot = fs.realpathSync(lexicalRoot);
  const relative = path.relative(libraryRoot, realRoot);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('quarantine path escaped library root');
  }
  return realRoot;
}

const selected = PLAN.groups.flatMap(group => group.candidates.map(candidate => ({ group, candidate })));
const quarantineRoot = prepareQuarantineRoot();
const report = {
  pass:PLAN.pass,
  scriptPlanHash:PLAN.scriptPlanHash,
  mode:apply ? 'apply' : 'dry-run',
  libraryRoot,
  quarantineRelativePath:quarantineRel,
  selected:selected.length,
  ready:[],
  moved:[],
  skipped:[]
};

for (const entry of selected) {
  const candidate = entry.candidate;
  try {
    inspectRegular(entry.group.canonical.relativePath, entry.group.canonical);
    const source = inspectRegular(candidate.relativePath, candidate);
    const target = resolveUnder(quarantineRoot, candidate.relativePath);
    if (fs.existsSync(target)) throw new Error('quarantine target exists: ' + candidate.relativePath);
    report.ready.push({ groupId:entry.group.groupId, title:entry.group.title, relation:candidate.relation, relativePath:candidate.relativePath });
    if (!apply) continue;
    fs.mkdirSync(path.dirname(target), { recursive:true });
    fs.renameSync(source, target);
    report.moved.push({ groupId:entry.group.groupId, title:entry.group.title, relation:candidate.relation, from:candidate.relativePath, to:path.relative(libraryRoot, target).split(path.sep).join('/') });
  } catch (error) {
    report.skipped.push({ groupId:entry.group.groupId, relativePath:candidate.relativePath, reason:String(error && error.message || error) });
  }
}

if (apply && report.moved.length) {
  const manifestPath = path.join(quarantineRoot, 'cleanup-manifest.json');
  if (fs.existsSync(manifestPath)) throw new Error('cleanup manifest already exists: ' + manifestPath);
  fs.writeFileSync(manifestPath, JSON.stringify(report, null, 2) + '\\n', { encoding:'utf8', flag:'wx' });
  report.manifestPath = manifestPath;
}

console.log(JSON.stringify(report, null, 2));
if (report.skipped.length) process.exitCode = 1;
`;
  }

  function renderPowerShellScript(selected) {
    const planBase64 = Buffer.from(JSON.stringify(selected), 'utf8').toString('base64');
    return `#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Library,
  [switch]$Apply,
  [string]$Quarantine = ''
)

$ErrorActionPreference = 'Stop'
$PlanJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${planBase64}'))
$Plan = $PlanJson | ConvertFrom-Json
$RootItem = Get-Item -LiteralPath ([IO.Path]::GetFullPath($Library)) -Force
if (-not $RootItem.PSIsContainer) { throw 'Library must be an existing directory.' }
$LibraryRoot = $RootItem.FullName.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
$RootPrefix = $LibraryRoot + [IO.Path]::DirectorySeparatorChar
if (-not $Quarantine) {
  $Stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH-mm-ssZ')
  $Quarantine = ".txt-reader-cleanup/$Stamp-$($Plan.scriptPlanHash.Substring(0, 12))"
}

function Resolve-SafeRelativePath {
  param([string]$Base, [string]$Relative)
  if ([string]::IsNullOrWhiteSpace($Relative) -or [IO.Path]::IsPathRooted($Relative) -or $Relative.IndexOf([char]0) -ge 0) {
    throw "Unsafe relative path: $Relative"
  }
  $Segments = $Relative -split '[/\\\\]'
  if ($Segments | Where-Object { [string]::IsNullOrWhiteSpace($_) -or $_ -eq '.' -or $_ -eq '..' }) {
    throw "Unsafe path segment: $Relative"
  }
  $Target = [IO.Path]::GetFullPath([IO.Path]::Combine($Base, ($Segments -join [IO.Path]::DirectorySeparatorChar)))
  $BasePrefix = $Base.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $Target.StartsWith($BasePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Path escaped root: $Relative"
  }
  return $Target
}

function Get-RegularFile {
  param([string]$Relative, [object]$Expected)
  $Target = Resolve-SafeRelativePath -Base $LibraryRoot -Relative $Relative
  $Item = Get-Item -LiteralPath $Target -Force
  if ($Item.PSIsContainer -or (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
    throw "Not a regular file: $Relative"
  }
  $Resolved = $Item.FullName
  if (-not $Resolved.StartsWith($RootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Real path escaped root: $Relative"
  }
  if ([int64]$Item.Length -ne [int64]$Expected.bytes) { throw "Size changed: $Relative" }
  $Epoch = [DateTime]::SpecifyKind([DateTime]'1970-01-01', [DateTimeKind]::Utc)
  $MtimeMs = [int64][Math]::Truncate(($Item.LastWriteTimeUtc - $Epoch).TotalMilliseconds)
  if ([Math]::Abs($MtimeMs - [int64]$Expected.mtimeMs) -gt 2000) { throw "Mtime changed: $Relative" }
  return $Resolved
}

$QuarantinePath = Resolve-SafeRelativePath -Base $LibraryRoot -Relative $Quarantine
if (Test-Path -LiteralPath $QuarantinePath) {
  $QuarantineItem = Get-Item -LiteralPath $QuarantinePath -Force
  if (-not $QuarantineItem.PSIsContainer -or (($QuarantineItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
    throw 'Quarantine path is not a regular directory.'
  }
} elseif ($Apply) {
  New-Item -ItemType Directory -Path $QuarantinePath -Force | Out-Null
}

$Ready = [Collections.ArrayList]::new()
$Moved = [Collections.ArrayList]::new()
$Skipped = [Collections.ArrayList]::new()
foreach ($Group in $Plan.groups) {
  foreach ($Candidate in $Group.candidates) {
    try {
      $null = Get-RegularFile -Relative $Group.canonical.relativePath -Expected $Group.canonical
      $Source = Get-RegularFile -Relative $Candidate.relativePath -Expected $Candidate
      $Target = Resolve-SafeRelativePath -Base $QuarantinePath -Relative $Candidate.relativePath
      if (Test-Path -LiteralPath $Target) { throw "Quarantine target exists: $($Candidate.relativePath)" }
      $null = $Ready.Add([ordered]@{
        groupId = $Group.groupId; title = $Group.title; relation = $Candidate.relation; relativePath = $Candidate.relativePath
      })
      if (-not $Apply) { continue }
      $TargetParent = Split-Path -Parent $Target
      if (-not (Test-Path -LiteralPath $TargetParent)) { New-Item -ItemType Directory -Path $TargetParent -Force | Out-Null }
      Move-Item -LiteralPath $Source -Destination $Target
      $DestinationRelative = $Target.Substring($RootPrefix.Length).Replace([IO.Path]::DirectorySeparatorChar, '/')
      $null = $Moved.Add([ordered]@{
        groupId = $Group.groupId; title = $Group.title; relation = $Candidate.relation; from = $Candidate.relativePath; to = $DestinationRelative
      })
    } catch {
      $null = $Skipped.Add([ordered]@{
        groupId = $Group.groupId; relativePath = $Candidate.relativePath; reason = $_.Exception.Message
      })
    }
  }
}

$Report = [ordered]@{
  pass = $Plan.pass
  scriptPlanHash = $Plan.scriptPlanHash
  mode = $(if ($Apply) { 'apply' } else { 'dry-run' })
  libraryRoot = $LibraryRoot
  quarantineRelativePath = $Quarantine
  selected = @($Plan.groups | ForEach-Object { @($_.candidates).Count } | Measure-Object -Sum).Sum
  ready = @($Ready)
  moved = @($Moved)
  skipped = @($Skipped)
}
if ($Apply -and $Moved.Count -gt 0) {
  $ManifestPath = Join-Path $QuarantinePath 'cleanup-manifest.json'
  if (Test-Path -LiteralPath $ManifestPath) { throw "Cleanup manifest already exists: $ManifestPath" }
  $Report.manifestPath = $ManifestPath
  [IO.File]::WriteAllText($ManifestPath, (($Report | ConvertTo-Json -Depth 8) + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
}
$Report | ConvertTo-Json -Depth 8
if ($Skipped.Count -gt 0) { exit 1 }
`;
  }

  async function generateScript(input = {}) {
    const plan = await buildPlan({ force:true });
    const selected = selectPlan(plan, input);
    const script = renderPowerShellScript(selected);
    return {
      pass:LIBRARY_CLEANUP_SCRIPT_PASS,
      fileName:`txt-reader-library-cleanup-${selected.scriptPlanHash.slice(0, 12)}.ps1`,
      contentType:'text/plain; charset=utf-8',
      scriptFormat:'ps1',
      planHash:selected.scriptPlanHash,
      sourcePlanHash:plan.planHash,
      summary:selected.summary,
      script
    };
  }

  async function setRepresentative(groupKey, novelId, planHash = '') {
    if (!preferenceService || typeof preferenceService.setRepresentative !== 'function') throw Object.assign(new Error('variant preference service unavailable'), { code:'LIBRARY_VARIANT_PREFERENCE_UNAVAILABLE' });
    const key = String(groupKey || '').trim();
    const id = String(novelId || '').trim();
    const expectedHash = String(planHash || '').trim();
    if (!cachedPlan || !expectedHash || cachedPlan.planHash !== expectedHash) {
      throw Object.assign(new Error('cleanup plan is stale; refresh the preview and retry'), { code:'LIBRARY_CLEANUP_PLAN_STALE', statusCode:409, pass:LIBRARY_CLEANUP_PLAN_CACHE_PASS });
    }
    const group = cachedPlan.groups.find(item => item.preferenceKey === key);
    const allowed = group && [group.canonical?.id, ...(group.candidates || []).map(item => item.id)].filter(Boolean);
    if (!group || !allowed.includes(id)) throw Object.assign(new Error('representative must belong to the current group'), { code:'LIBRARY_VARIANT_REPRESENTATIVE_INVALID', statusCode:400 });
    const result = await Promise.resolve(preferenceService.setRepresentative(key, id));
    invalidatePlanCache();
    return result;
  }

  async function clearRepresentative(groupKey) {
    if (!preferenceService || typeof preferenceService.clearRepresentative !== 'function') throw Object.assign(new Error('variant preference service unavailable'), { code:'LIBRARY_VARIANT_PREFERENCE_UNAVAILABLE' });
    const result = await Promise.resolve(preferenceService.clearRepresentative(groupKey));
    invalidatePlanCache();
    return result;
  }

  async function setExcluded(leftId, rightId, excluded) {
    if (!preferenceService || typeof preferenceService.setExcluded !== 'function') throw Object.assign(new Error('variant preference service unavailable'), { code:'LIBRARY_VARIANT_PREFERENCE_UNAVAILABLE' });
    const result = await Promise.resolve(preferenceService.setExcluded(leftId, rightId, excluded !== false));
    invalidatePlanCache();
    return result;
  }

  return { buildPlan, getPlanStatus, invalidatePlanCache, generateScript, setRepresentative, clearRepresentative, setExcluded, planCachePass:LIBRARY_CLEANUP_PLAN_CACHE_PASS };
}

module.exports = {
  LIBRARY_CLEANUP_PLAN_PASS,
  LIBRARY_CLEANUP_SCRIPT_PASS,
  LIBRARY_CLEANUP_PLAN_CACHE_PASS,
  createLibraryCleanupService
};
