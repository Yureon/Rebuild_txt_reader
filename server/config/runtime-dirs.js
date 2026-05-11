const fs = require('fs');
const paths = require('./paths');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureRuntimeDirectories() {
  ensureDir(paths.DATA_DIR);
  ensureDir(paths.CHUNK_INDEX_DIR);
  ensureDir(paths.CONTENT_CHUNK_PAYLOAD_DIR);
  ensureDir(paths.BLOCK_MANIFEST_CACHE_DIR);
  ensureDir(paths.SNAPSHOT_DIR);
  ensureDir(paths.FONT_DIR);
  ensureDir(paths.USER_DATA_DIR);
  ensureDir(paths.SITE_LANGUAGES_DIR);
}

module.exports = {
  ensureRuntimeDirectories
};
