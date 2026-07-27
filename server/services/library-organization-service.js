const path = require('path');
const crypto = require('crypto');

const LIBRARY_ORGANIZATION_PLAN_PASS = 'v643-library-organization-plan-pass';
const LIBRARY_ORGANIZATION_SCRIPT_PASS = 'v643-library-organization-script-pass';
const LAYOUTS = new Set(['author-title', 'category-author-title', 'title']);
const MODES = new Set(['copy', 'move']);
const RESERVED_WINDOWS_NAMES = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;

function portablePath(value) {
  return String(value || '').replaceAll('\\', '/').replace(/^\/+/, '');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function hash(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function safeSegment(value, fallback) {
  let text = String(value || '').normalize('NFC').trim();
  text = text.replace(/[<>:"/\\|?*\u0000-\u001f]/gu, ' ').replace(/\s+/gu, ' ').replace(/[. ]+$/gu, '').slice(0, 96);
  if (!text || text === '.' || text === '..' || RESERVED_WINDOWS_NAMES.test(text)) text = String(fallback || '_미분류');
  return text;
}

function categorySegments(novel) {
  if (Array.isArray(novel?.category)) return novel.category.map(item => safeSegment(item, '_미분류')).filter(Boolean).slice(0, 8);
  return String(novel?.categoryPath || '').split(/\s*>\s*|\//u).map(item => safeSegment(item, '_미분류')).filter(Boolean).slice(0, 8);
}

function extnameTxt(sourcePath) {
  const ext = path.extname(sourcePath);
  return /^\.txt$/iu.test(ext) ? ext : '.txt';
}

function basenamePortable(sourcePath) {
  const normalized = portablePath(sourcePath);
  return normalized.slice(normalized.lastIndexOf('/') + 1) || 'novel.txt';
}

function appendCollisionSuffix(targetPath, seed) {
  const ext = path.posix.extname(targetPath);
  const base = ext ? targetPath.slice(0, -ext.length) : targetPath;
  return `${base}__${crypto.createHash('sha256').update(String(seed || targetPath)).digest('hex').slice(0, 8)}${ext || '.txt'}`;
}

function normalizeOptions(input = {}) {
  const layout = LAYOUTS.has(String(input.layout || '')) ? String(input.layout) : 'author-title';
  const mode = MODES.has(String(input.mode || '')) ? String(input.mode) : 'copy';
  return {
    layout,
    mode,
    includeUnchanged:input.includeUnchanged === true
  };
}

function createLibraryOrganizationService(options = {}) {
  const libraryService = options.libraryService;
  const metadataService = options.metadataService || null;
  if (!libraryService) throw new Error('createLibraryOrganizationService requires libraryService');

  async function getLibrary() {
    return typeof libraryService.getLibraryCachedForRequestAsync === 'function'
      ? libraryService.getLibraryCachedForRequestAsync()
      : typeof libraryService.getLibraryCachedAsync === 'function'
        ? libraryService.getLibraryCachedAsync()
        : libraryService.getLibraryCached();
  }

  function enrich(novel) {
    return metadataService && typeof metadataService.enrichNovel === 'function' ? metadataService.enrichNovel(novel) : novel;
  }

  function targetDirectory(novel, config) {
    const title = safeSegment(novel?.title, '_제목 없음');
    const author = safeSegment(novel?.author, '_작가 미상');
    if (config.layout === 'title') return [title];
    if (config.layout === 'category-author-title') return [...categorySegments(novel), author, title];
    return [author, title];
  }

  function sourceEntries(novel) {
    if (novel?.singlePath) return [{ id:String(novel.id || ''), sourcePath:portablePath(novel.singlePath), fileName:basenamePortable(novel.singlePath) }];
    return (Array.isArray(novel?.episodes) ? novel.episodes : [])
      .filter(episode => episode?.path)
      .map(episode => ({ id:String(episode.id || novel.id || ''), sourcePath:portablePath(episode.path), fileName:basenamePortable(episode.path) }));
  }

  async function buildPlan(input = {}) {
    const config = normalizeOptions(input);
    const library = await getLibrary();
    const raw = Array.isArray(library) ? library : [];
    const seenTargets = new Map();
    const seenSources = new Set();
    const entries = [];
    const skipped = [];
    let scannedFileCount = 0;
    let unchangedCount = 0;
    let collisionResolvedCount = 0;

    for (const rawNovel of raw) {
      const novel = enrich(rawNovel) || rawNovel;
      const directory = targetDirectory(novel, config);
      const sources = sourceEntries(rawNovel);
      if (!sources.length) {
        skipped.push({ novelId:String(rawNovel?.id || ''), reason:'source-path-missing' });
        continue;
      }
      for (const source of sources) {
        const sourcePath = portablePath(source.sourcePath);
        if (!sourcePath || sourcePath.split('/').some(part => !part || part === '.' || part === '..')) {
          skipped.push({ novelId:String(rawNovel?.id || ''), sourcePath, reason:'unsafe-source-path' });
          continue;
        }
        const sourceKey = sourcePath.toLocaleLowerCase('en-US');
        if (seenSources.has(sourceKey)) {
          skipped.push({ novelId:String(rawNovel?.id || ''), sourcePath, reason:'duplicate-source-path' });
          continue;
        }
        seenSources.add(sourceKey);
        scannedFileCount += 1;
        const originalName = safeSegment(path.posix.basename(source.fileName, path.posix.extname(source.fileName)), 'novel') + extnameTxt(source.fileName);
        const originalTargetPath = portablePath(path.posix.join(...directory, originalName));
        let targetPath = originalTargetPath;
        let collisionSerial = 0;
        while (true) {
          const targetKey = targetPath.toLocaleLowerCase('en-US');
          const existing = seenTargets.get(targetKey);
          if (!existing || existing === sourcePath) {
            seenTargets.set(targetKey, sourcePath);
            break;
          }
          collisionSerial += 1;
          targetPath = appendCollisionSuffix(originalTargetPath, `${source.id}\0${sourcePath}\0${collisionSerial}`);
        }
        if (collisionSerial > 0) collisionResolvedCount += 1;
        const unchanged = sourcePath.toLocaleLowerCase('en-US') === targetPath.toLocaleLowerCase('en-US');
        if (unchanged) unchangedCount += 1;
        if (!unchanged || config.includeUnchanged) {
          entries.push({
            novelId:String(rawNovel?.id || ''),
            sourceId:String(source.id || ''),
            title:String(novel?.title || rawNovel?.title || ''),
            author:String(novel?.author || ''),
            sourcePath,
            targetPath,
            unchanged
          });
        }
      }
    }

    entries.sort((a, b) => a.targetPath.localeCompare(b.targetPath, 'ko', { numeric:true, sensitivity:'base' }) || a.sourcePath.localeCompare(b.sourcePath, 'ko', { numeric:true, sensitivity:'base' }));
    const actionable = entries.filter(entry => !entry.unchanged);
    const core = {
      pass:LIBRARY_ORGANIZATION_PLAN_PASS,
      config,
      summary:{
        novelCount:raw.length,
        fileCount:scannedFileCount,
        moveCount:actionable.length,
        unchangedCount,
        skippedCount:skipped.length,
        collisionResolvedCount
      },
      entries:actionable,
      skipped
    };
    return { ...core, planHash:hash(core) };
  }

  function renderPowerShell(plan) {
    const planBase64 = Buffer.from(JSON.stringify(plan.entries), 'utf8').toString('base64').match(/.{1,120}/gu)?.join('\n') || '';
    const mode = plan.config.mode;
    return `# TXT Reader Multi library organization script
# pass: ${LIBRARY_ORGANIZATION_SCRIPT_PASS}
# source plan: ${plan.planHash}
#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Library,
  [Parameter(Mandatory=$true)][string]$Destination,
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$Mode = '${mode}'
$PlanBase64 = @'
${planBase64}
'@
$PlanJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(($PlanBase64 -replace '\\s', '')))
$Plan = $PlanJson | ConvertFrom-Json

function Get-FullRoot([string]$Value) {
  $full = [System.IO.Path]::GetFullPath($Value)
  if (-not $full.EndsWith([System.IO.Path]::DirectorySeparatorChar)) { $full += [System.IO.Path]::DirectorySeparatorChar }
  return $full
}
function Assert-UnderRoot([string]$Root, [string]$Candidate) {
  $full = [System.IO.Path]::GetFullPath($Candidate)
  if (-not $full.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Path escaped root: $Candidate" }
  return $full
}
function Get-RelativePathCompat([string]$Root, [string]$Candidate) {
  # [System.IO.Path]::GetRelativePath is unavailable in Windows PowerShell 5.1/.NET Framework.
  # Normalize both paths and remove the already-enforced root prefix instead.
  $rootFull = Get-FullRoot $Root
  $candidateFull = [System.IO.Path]::GetFullPath($Candidate)
  $separators = [char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $rootWithoutSeparator = $rootFull.TrimEnd($separators)
  if ($candidateFull.Equals($rootWithoutSeparator, [System.StringComparison]::OrdinalIgnoreCase)) { return '' }
  if (-not $candidateFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Path escaped root: $Candidate" }
  return $candidateFull.Substring($rootFull.Length)
}
function Assert-NoReparsePath([string]$Root, [string]$Candidate, [switch]$AllowMissingLeaf) {
  if (Test-Path -LiteralPath $Root) {
    $rootItem = Get-Item -LiteralPath $Root -Force
    if (($rootItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "symlink/reparse root rejected: $Root" }
  }
  $relative = Get-RelativePathCompat $Root $Candidate
  if ([string]::IsNullOrEmpty($relative)) { return }
  $cursor = $Root.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
  $segments = $relative -split '[\\/]'
  for ($index = 0; $index -lt $segments.Length; $index += 1) {
    $cursor = Join-Path $cursor $segments[$index]
    if (-not (Test-Path -LiteralPath $cursor)) {
      if ($AllowMissingLeaf) { break }
      throw "path component missing: $cursor"
    }
    $entry = Get-Item -LiteralPath $cursor -Force
    if (($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "symlink/reparse point rejected: $cursor" }
  }
}

$libraryRoot = Get-FullRoot $Library
$destinationRoot = Get-FullRoot $Destination
if ($libraryRoot -eq $destinationRoot) { throw 'Library and Destination must be different directories.' }
if ($destinationRoot.StartsWith($libraryRoot, [System.StringComparison]::OrdinalIgnoreCase) -or $libraryRoot.StartsWith($destinationRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Library and Destination must not overlap.' }
if (-not (Test-Path -LiteralPath $libraryRoot -PathType Container)) { throw 'Library root does not exist.' }
$results = New-Object System.Collections.Generic.List[object]

foreach ($item in $Plan) {
  $source = Assert-UnderRoot $libraryRoot (Join-Path $libraryRoot ([string]$item.sourcePath))
  $target = Assert-UnderRoot $destinationRoot (Join-Path $destinationRoot ([string]$item.targetPath))
  $status = 'planned'
  $message = ''
  try {
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'source file missing' }
    Assert-NoReparsePath $libraryRoot $source
    Assert-NoReparsePath $destinationRoot ([System.IO.Path]::GetDirectoryName($target)) -AllowMissingLeaf
    if (Test-Path -LiteralPath $target) { throw 'target already exists' }
    if ($Apply) {
      New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($target)) | Out-Null
      Assert-NoReparsePath $destinationRoot ([System.IO.Path]::GetDirectoryName($target))
      if ($Mode -eq 'move') { [System.IO.File]::Move($source, $target) } else { [System.IO.File]::Copy($source, $target, $false) }
      $status = $Mode + 'd'
    } else {
      Write-Host ("[DRY-RUN] {0} -> {1}" -f $source, $target)
    }
  } catch {
    $status = 'skipped'
    $message = $_.Exception.Message
    Write-Warning ("SKIP {0}: {1}" -f $source, $message)
  }
  $results.Add([pscustomobject]@{ source=$source; target=$target; status=$status; message=$message })
}

if ($Apply) {
  New-Item -ItemType Directory -Force -Path $destinationRoot | Out-Null
  $manifest = Join-Path $destinationRoot 'txt-reader-library-organization-result.json'
  $results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifest -Encoding UTF8
  Write-Host ("Completed. Manifest: {0}" -f $manifest)
} else {
  Write-Host 'Dry-run only. Re-run with -Apply after reviewing the output.'
}
`;
  }

  async function generateScript(input = {}) {
    const plan = await buildPlan(input);
    return {
      pass:LIBRARY_ORGANIZATION_SCRIPT_PASS,
      planHash:plan.planHash,
      summary:plan.summary,
      config:plan.config,
      fileName:`txt-reader-library-organization-${plan.config.layout}-${plan.config.mode}.ps1`,
      contentType:'text/plain;charset=utf-8',
      script:renderPowerShell(plan)
    };
  }

  return { buildPlan, generateScript, normalizeOptions, pass:LIBRARY_ORGANIZATION_PLAN_PASS, scriptPass:LIBRARY_ORGANIZATION_SCRIPT_PASS };
}

module.exports = {
  LIBRARY_ORGANIZATION_PLAN_PASS,
  LIBRARY_ORGANIZATION_SCRIPT_PASS,
  createLibraryOrganizationService,
  normalizeOptions,
  safeSegment
};
