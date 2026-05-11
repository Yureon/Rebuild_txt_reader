const fs = require('fs');
const path = require('path');

function loadJsonWithBackup(filePath, fallbackValue) {
  const fallback = typeof fallbackValue === 'undefined' ? null : fallbackValue;
  const targets = [filePath, `${filePath}.bak`];
  for (const targetPath of targets) {
    try {
      if (!fs.existsSync(targetPath)) continue;
      const raw = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      return {
        ok: true,
        data: raw,
        source: targetPath === filePath ? 'primary' : 'backup',
        path: targetPath
      };
    } catch (e) {}
  }
  return {
    ok: false,
    data: fallback,
    source: 'fallback',
    path: ''
  };
}

function atomicWriteJson(filePath, value, callback) {
  const dir = path.dirname(filePath);
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const bak = `${filePath}.bak`;
  fs.mkdir(dir, { recursive: true }, (mkdirError) => {
    if (mkdirError) return callback && callback(mkdirError);
    const body = JSON.stringify(value, null, 2);
    fs.writeFile(tmp, body, 'utf-8', (writeError) => {
      if (writeError) return callback && callback(writeError);
      fs.copyFile(filePath, bak, () => {
        fs.rename(tmp, filePath, (renameError) => callback && callback(renameError || null));
      });
    });
  });
}

module.exports = {
  loadJsonWithBackup,
  atomicWriteJson
};
