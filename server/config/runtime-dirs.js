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
  ensureDir(paths.NORMALIZED_CONTENT_CACHE_DIR);
  ensureDir(paths.BLOCK_MANIFEST_CACHE_DIR);
  ensureDir(paths.SNAPSHOT_DIR);
  ensureDir(paths.FONT_DIR);
  ensureDir(paths.USER_DATA_DIR);
  ensureDir(paths.SITE_LANGUAGES_DIR);
  ensureDir(paths.METADATA_COVER_DIR);
  ensureDir(paths.METADATA_BROWSER_PROFILE_DIR);
}

module.exports = {
  ensureRuntimeDirectories
};
