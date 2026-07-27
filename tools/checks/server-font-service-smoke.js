const fs = require('fs');
const os = require('os');
const path = require('path');

const SERVER_FONT_SERVICE_DIRECT_SMOKE_PASS = 'v214-server-font-service-direct-smoke-pass';

function makeTtfBuffer() {
  return Buffer.from([0x00, 0x01, 0x00, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x03, 0x00, 0x50]);
}

function expectHttpError(fn, status, label) {
  let thrown = null;
  try { fn(); } catch (error) { thrown = error; }
  if (!thrown) throw new Error(label + ' did not throw');
  if (Number(thrown.status) !== status) throw new Error(label + ' threw unexpected status: ' + thrown.status);
}

function runServerFontServiceDirectSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runServerFontServiceDirectSmoke requires projectRoot');
  const { createFontService, FONT_FILE_MAX_BYTES, FONT_LIBRARY_MAX_FILES, FONT_LIBRARY_MAX_TOTAL_BYTES } = require(path.join(projectRoot, 'server/services/font-service.js'));
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-font-smoke-'));
  const fontDir = path.join(tempRoot, 'fonts');
  const legacyFontDir = path.join(tempRoot, 'legacy-fonts');
  const fontMetaPath = path.join(tempRoot, 'font-meta.json');
  const legacyFontMetaPath = path.join(tempRoot, 'legacy-font-meta.json');
  fs.mkdirSync(legacyFontDir, { recursive: true });
  try {
    const service = createFontService({ fontDir, fontMetaPath, legacyFontDir, legacyFontMetaPath, now: () => 1700000000000 });
    if (service.safeFontName('../bad.ttf').includes('/') || service.safeFontName('../bad.ttf').includes('\\')) throw new Error('safeFontName must strip directory separators');
    if (service.safeFontName('...') !== '') throw new Error('safeFontName must reject dot-only names');
    if (service.detectFontMagic(makeTtfBuffer()) !== 'ttf') throw new Error('detectFontMagic must recognize ttf magic');
    if (service.getFontLibraryUsage([{ size: 10 }, { size: '5' }]).totalBytes !== 15) throw new Error('font usage total smoke failed');
    const limits = service.getLimits();
    if (limits.maxFileBytes !== FONT_FILE_MAX_BYTES || limits.maxFiles !== FONT_LIBRARY_MAX_FILES || limits.maxTotalBytes !== FONT_LIBRARY_MAX_TOTAL_BYTES) throw new Error('font limits export smoke failed');
    expectHttpError(() => service.uploadFont({ rawFilename: 'bad.txt', rawFamily: 'Bad', bodyBuffer: makeTtfBuffer() }), 400, 'invalid font extension');
    expectHttpError(() => service.uploadFont({ rawFilename: 'bad.ttf', rawFamily: 'Bad', bodyBuffer: Buffer.from('xxxx') }), 400, 'font signature mismatch');
    const uploaded = service.uploadFont({ rawFilename: 'My Font.ttf', rawFamily: 'My Font', bodyBuffer: makeTtfBuffer() });
    if (!uploaded.success || uploaded.family !== 'My Font' || !uploaded.filename.endsWith('.ttf')) throw new Error('font upload response smoke failed');
    const list = service.getFontListResponse();
    if (!Array.isArray(list.items) || list.items.length !== 1 || list.items[0].url !== '/api/fonts/file/' + encodeURIComponent(uploaded.filename)) throw new Error('font list response smoke failed');
    const responseFile = service.getFontFileForResponse(uploaded.filename);
    if (responseFile.mimeType !== 'font/ttf' || !fs.existsSync(responseFile.filePath)) throw new Error('font file response smoke failed');
    expectHttpError(() => service.uploadFont({ rawFilename: 'Other.ttf', rawFamily: 'My Font', bodyBuffer: makeTtfBuffer() }), 409, 'duplicate font family');
    service.deleteFont(uploaded.filename);
    if (service.getFontListResponse().items.length !== 0) throw new Error('font delete/list smoke failed');
    return { pass: SERVER_FONT_SERVICE_DIRECT_SMOKE_PASS };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

module.exports = { SERVER_FONT_SERVICE_DIRECT_SMOKE_PASS, runServerFontServiceDirectSmoke };
