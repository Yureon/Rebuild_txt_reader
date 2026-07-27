#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { createLibraryService, LIBRARY_EPISODE_SEQUENCE_GROUPING_PASS } = require('../../server/services/library-service');
const {
  LIBRARY_VARIANT_GROUPING_PASS,
  LIBRARY_VARIANT_RANGE_SHAPE_PASS,
  buildLibraryVariantPresentation,
  deriveVariantSignal
} = require('../../server/services/library-variant-service');
const {
  LIBRARY_CLEANUP_PLAN_PASS,
  LIBRARY_CLEANUP_SCRIPT_PASS,
  createLibraryCleanupService
} = require('../../server/services/library-cleanup-service');

function stableId(value) {
  return Buffer.from(String(value)).toString('base64url');
}

function write(root, relativePath, content = 'fixture') {
  const target = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive:true });
  fs.writeFileSync(target, content);
  return target;
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v628-cleanup-'));
  try {
    [
      '옛날/아이리스01권.txt',
      '옛날/아이리스02권.txt',
      '옛날/아이리스03권.txt',
      '옛날/로엔의 마나뱅크 01 001-025.txt',
      '옛날/로엔의 마나뱅크 02 026-050.txt',
      '옛날/로엔의 마나뱅크 03 051-075.txt',
      '업데이트/전생을 그리는 개발자 1-260.txt',
      '업데이트/전생을 그리는 개발자 -426.txt',
      '업데이트/전생을 그리는 개발자 -426 (2).txt',
      '업데이트/66666년 만에 환생한 흑마법사 1-400 @화봉.txt',
      '업데이트/66666년 만에 환생한 흑마법사 1-512 완외 [판타지, 화봉].txt',
      '업데이트/서부전선 이상있다 1-300 @겨울까마귀.txt',
      '옛날/서부전선 이상있다 @겨울까마귀 1-242 완결 작업완료.txt',
      '업데이트/배드 본 블러드 1-353 완.txt',
      '옛날/배드 본 블러드 341-353 完.txt'
    ].forEach((relativePath, index) => write(root, relativePath, `fixture-${index}`));

    const libraryService = createLibraryService({ libraryPath:root, encodeStableId:stableId });
    const library = libraryService.buildLibrary();
    const iris = library.find(item => item.isVirtualEpisodeGroup && item.title === '아이리스');
    const manaBank = library.find(item => item.isVirtualEpisodeGroup && item.title === '로엔의 마나뱅크');
    assert.ok(iris, 'attached volume numbers must become one virtual episode novel');
    assert.equal(iris.episodes.length, 3);
    assert.equal(iris.episodeGroupingPass, LIBRARY_EPISODE_SEQUENCE_GROUPING_PASS);
    assert.ok(manaBank, 'numbered disjoint ranges must become one virtual episode novel');
    assert.equal(manaBank.episodes.length, 3);

    const presentation = buildLibraryVariantPresentation(library);
    const developer = presentation.items.find(item => item.title === '전생을 그리는 개발자');
    assert.ok(developer?.isVariantGroup);
    assert.ok(developer.singlePath.endsWith('전생을 그리는 개발자 -426.txt'), 'end-only latest range must become canonical');
    assert.equal(deriveVariantSignal(developer).range.end, 426);
    assert.equal(developer.variants.find(item => item.fileName === '전생을 그리는 개발자 1-260').relation, 'superseded');
    assert.equal(developer.variants.find(item => item.fileName === '전생을 그리는 개발자 -426 (2)').relation, 'duplicate-copy');

    const reincarnated = presentation.items.find(item => item.title === '66666년 만에 환생한 흑마법사');
    assert.ok(reincarnated?.isVariantGroup, 'genre/author suffixes from the real fixture must normalize');
    assert.equal(reincarnated.author, '화봉');
    assert.ok(reincarnated.singlePath.endsWith('1-512 완외 [판타지, 화봉].txt'));

    const western = presentation.items.find(item => item.title === '서부전선 이상있다');
    assert.ok(western?.isVariantGroup, 'author-before-range suffixes must retain both the author and the range');
    assert.equal(western.author, '겨울까마귀');
    assert.ok(western.singlePath.endsWith('서부전선 이상있다 1-300 @겨울까마귀.txt'));
    assert.equal(western.variants.find(item => item.fileName.includes('@겨울까마귀 1-242')).rangeEnd, 242);

    const badBlood = presentation.items.find(item => item.title === '배드 본 블러드');
    assert.ok(badBlood?.isVariantGroup, 'a segment fully covered by a cumulative file must be superseded');
    assert.equal(badBlood.variants.find(item => item.fileName.includes('341-353')).relation, 'superseded');

    const discrete = buildLibraryVariantPresentation([
      { id:'v1', title:'제로니스01권', singlePath:'옛날/제로니스01권.txt', isMultiFile:false },
      { id:'v2', title:'제로니스02권', singlePath:'옛날/제로니스02권.txt', isMultiFile:false },
      { id:'s1', title:'로엔의 마나뱅크 01 001-025', singlePath:'옛날/로엔의 마나뱅크 01 001-025.txt', isMultiFile:false },
      { id:'s2', title:'로엔의 마나뱅크 02 026-050', singlePath:'옛날/로엔의 마나뱅크 02 026-050.txt', isMultiFile:false }
    ]);
    assert.equal(discrete.hiddenVariantCount, 0, 'separate volumes and disjoint ranges must never become cleanup variants');

    const cleanupService = createLibraryCleanupService({ libraryService:{
      getLibraryCachedAsync:async () => library,
      safeJoinUnderLibrary:relativePath => {
        const target = path.resolve(root, relativePath);
        const relative = path.relative(root, target);
        if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('unsafe path');
        return target;
      }
    } });
    const plan = await cleanupService.buildPlan();
    assert.equal(plan.pass, LIBRARY_CLEANUP_PLAN_PASS);
    assert.equal(plan.summary.candidateCount, 5);
    assert.equal(plan.summary.supersededCount, 4);
    assert.equal(plan.summary.duplicateCopyCount, 1);
    assert.ok(!plan.groups.flatMap(group => group.candidates).some(item => /아이리스|마나뱅크/u.test(item.relativePath)));

    const generated = await cleanupService.generateScript({ relations:['duplicate-copy', 'superseded'] });
    assert.equal(generated.pass, LIBRARY_CLEANUP_SCRIPT_PASS);
    const emptySelection = await cleanupService.generateScript({ relations:[] });
    assert.equal(emptySelection.summary.candidateCount, 0, 'an explicit empty relation selection must never fall back to all files');
    assert.equal(generated.scriptFormat, 'ps1');
    const scriptPath = path.join(root, 'cleanup.ps1');
    fs.writeFileSync(scriptPath, generated.script);
    const powerShell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
    const dryRun = spawnSync(powerShell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Library', root], { encoding:'utf8' });
    const powershellAvailable = !(dryRun.status === null && dryRun.error && dryRun.error.code === 'ENOENT');
    if (powershellAvailable) {
      assert.equal(dryRun.status, 0, dryRun.stderr);
      const report = JSON.parse(dryRun.stdout);
      assert.equal(report.mode, 'dry-run');
      assert.equal(report.ready.length, 5);
      assert.equal(report.moved.length, 0);
      const applyRun = spawnSync(powerShell, [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath,
        '-Library', root,
        '-Apply',
        '-Quarantine', '.test-quarantine'
      ], { encoding:'utf8' });
      assert.equal(applyRun.status, 0, applyRun.stderr);
      const applyReport = JSON.parse(applyRun.stdout);
      assert.equal(applyReport.mode, 'apply');
      assert.equal(applyReport.moved.length, 5);
      assert.equal(applyReport.skipped.length, 0);
      assert.ok(fs.existsSync(path.join(root, '.test-quarantine', 'cleanup-manifest.json')));
      assert.ok(!fs.existsSync(path.join(root, '업데이트', '전생을 그리는 개발자 1-260.txt')), 'superseded file must be quarantined');
      assert.ok(fs.existsSync(path.join(root, '업데이트', '전생을 그리는 개발자 -426.txt')), 'canonical file must remain in the library');
    } else {
      assert(generated.script.includes('cleanup-manifest.json'), 'generated cleanup script must retain quarantine manifest support');
      assert(generated.script.includes('[switch]$Apply'), 'generated cleanup script must default to dry-run with explicit apply');
    }

    console.log(JSON.stringify({
      pass:'v628-library-cleanup-real-fixture-smoke-pass',
      groupingPass:LIBRARY_VARIANT_GROUPING_PASS,
      rangeShapePass:LIBRARY_VARIANT_RANGE_SHAPE_PASS,
      planPass:LIBRARY_CLEANUP_PLAN_PASS,
      scriptPass:LIBRARY_CLEANUP_SCRIPT_PASS,
      candidates:plan.summary.candidateCount,
      powershellAvailable
    }));
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
}

run().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
