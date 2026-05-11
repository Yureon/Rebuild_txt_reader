const fs = require('fs');
const os = require('os');
const path = require('path');

const SERVER_LIBRARY_SERVICE_DIRECT_SMOKE_PASS = 'v348-server-library-service-direct-smoke-pass';

function runServerLibraryServiceDirectSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runServerLibraryServiceDirectSmoke requires projectRoot');
  const { createLibraryService } = require(path.join(projectRoot, 'server/services/library-service.js'));
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-library-smoke-'));
  try {
    fs.writeFileSync(path.join(tempRoot, '001.txt'), 'one', 'utf8');
    fs.mkdirSync(path.join(tempRoot, 'Series'));
    fs.writeFileSync(path.join(tempRoot, 'Series', '1화.txt'), 'episode', 'utf8');
    fs.writeFileSync(path.join(tempRoot, 'Series', '2화.txt'), 'episode', 'utf8');
    const service = createLibraryService({
      libraryPath: tempRoot,
      encodeStableId: value => 'id-' + Buffer.from(String(value)).toString('hex').slice(0, 12)
    });

    if (service.sanitizeNodeName('../bad')) throw new Error('sanitizeNodeName must reject path traversal-ish names');
    if (service.sanitizeNodeName('bad/name')) throw new Error('sanitizeNodeName must reject slash names');
    if (service.normalizeTxtBaseName('Title.txt') !== 'Title') throw new Error('normalizeTxtBaseName must trim .txt suffix');
    if (service.categoryPathToRelDir('A > B') !== path.join('A', 'B')) throw new Error('categoryPathToRelDir must normalize category separators');
    const safePath = service.safeJoinUnderLibrary('001.txt');
    if (!safePath.startsWith(tempRoot)) throw new Error('safeJoinUnderLibrary must stay under library root');
    let escaped = false;
    try { service.safeJoinUnderLibrary('../escape.txt'); } catch (error) { escaped = true; }
    if (!escaped) throw new Error('safeJoinUnderLibrary must reject parent escape');

    const library = service.buildLibrary();
    if (!Array.isArray(library) || library.length < 2) throw new Error('buildLibrary must list single-file and episode novels');
    const multi = library.find(item => item && item.isMultiFile);
    if (!multi || !Array.isArray(multi.episodes) || multi.episodes.length !== 2) throw new Error('episode directory detection smoke failed');
    const cacheStatus = service.getCacheStatus();
    if (!cacheStatus || !cacheStatus.libraryCache || typeof cacheStatus.dirScanCacheEntries !== 'number') throw new Error('getCacheStatus shape smoke failed');
    if (typeof cacheStatus.libraryCache.directorySignatureCount !== 'number') throw new Error('getCacheStatus must expose directorySignatureCount');
    if (typeof cacheStatus.libraryCache.lastDeepSignatureCheckAt !== 'number') throw new Error('getCacheStatus must expose lastDeepSignatureCheckAt');
    if (typeof cacheStatus.libraryCache.deepSignatureCheckTtlMs !== 'number') throw new Error('getCacheStatus must expose deepSignatureCheckTtlMs');
    return { pass: SERVER_LIBRARY_SERVICE_DIRECT_SMOKE_PASS, novels: library.length };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

module.exports = {
  SERVER_LIBRARY_SERVICE_DIRECT_SMOKE_PASS,
  runServerLibraryServiceDirectSmoke
};
