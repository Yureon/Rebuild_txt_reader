#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileopsService } = require('../../server/services/fileops-service');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fileops-link-v605-'));
  try {
    const library = path.join(root, 'library');
    const outside = path.join(root, 'outside');
    fs.mkdirSync(library);
    fs.mkdirSync(outside);
    fs.mkdirSync(path.join(library, 'safe'));
    try {
      fs.symlinkSync(outside, path.join(library, 'escape'), 'dir');
    } catch (error) {
      if (error && ['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
        console.log(JSON.stringify({
          blocked: 'v605-fileops-symlink-boundary-smoke',
          reason: `symlink unavailable: ${error.code}`
        }));
        process.exitCode = 77;
        return;
      }
      throw error;
    }

    const safeJoinUnderLibrary = (rel = '') => {
      const target = path.resolve(library, String(rel || ''));
      if (target !== library && !target.startsWith(library + path.sep)) throw Error('Invalid path');
      return target;
    };
    const libraryService = {
      libraryPath: library,
      getLibraryCachedAsync: async () => [],
      invalidateLibraryCache() {},
      sanitizeNodeName: value => String(value || ''),
      normalizeTxtBaseName: value => String(value || ''),
      safeJoinUnderLibrary,
      categoryPathToRelDir: value => String(value || ''),
      sendFsError() {},
      clearFileCachePath() {},
      clearAllFileCache() {},
      isSubPath(parent, child) { return path.resolve(child).startsWith(path.resolve(parent) + path.sep); },
      getNovelStorageInfo() {},
      getEpisodeStorageInfo() {},
      clearNovelCachesByInfo() {}
    };
    const service = createFileopsService({ libraryService, logger: { warn() {} } });
    await service.assertNoSymlinkSegments(path.join(library, 'safe'));
    await service.assertNoSymlinkSegments(path.join(library, 'safe', 'new'), { allowMissingTail: true });

    const rootLink = path.join(root, 'library-link');
    fs.symlinkSync(library, rootLink, 'dir');
    const linkedService = createFileopsService({
      libraryService: {
        ...libraryService,
        libraryPath: rootLink,
        LIBRARY_PATH: rootLink,
        safeJoinUnderLibrary: (rel = '') => path.resolve(rootLink, String(rel || ''))
      },
      logger: { warn() {} }
    });
    await linkedService.assertNoSymlinkSegments(path.join(rootLink, 'safe'));
    await assert.rejects(
      () => service.assertNoSymlinkSegments(path.join(library, 'escape', 'child'), { allowMissingTail: true }),
      /Invalid path/
    );
    await assert.rejects(() => service.assertNoSymlinkSegments(outside), /Invalid path/);
    console.log(JSON.stringify({ pass: 'v605-fileops-symlink-boundary-smoke-pass' }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
