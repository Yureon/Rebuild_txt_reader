const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SESSION_STORE_PATH = path.join(DATA_DIR, 'sessions.json');
const CHUNK_INDEX_DIR = path.join(DATA_DIR, 'chunk_indexes');
const CONTENT_CHUNK_PAYLOAD_DIR = path.join(DATA_DIR, 'content_chunks');
const BLOCK_MANIFEST_CACHE_DIR = path.join(DATA_DIR, 'block_manifests');
const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots');
const SYNC_DATA_PATH = path.join(ROOT_DIR, 'sync_data.json');
const FONT_DIR = path.join(DATA_DIR, 'fonts');
const FONT_META_PATH = path.join(DATA_DIR, 'font-library.json');
const ACCOUNTS_PATH = path.join(DATA_DIR, 'accounts.json');
const USER_DATA_DIR = path.join(DATA_DIR, 'user-data');
const AUDIT_LOG_PATH = path.join(DATA_DIR, 'audit-log.jsonl');
const SIGNUP_CODES_PATH = path.join(DATA_DIR, 'signup-codes.json');
const SITE_LANGUAGES_DIR = path.join(DATA_DIR, 'site-languages');
const SITE_LANGUAGE_PACKS_DIR = path.join(ROOT_DIR, 'site-language-packs');
const LEGACY_FONT_DIR = path.join(ROOT_DIR, 'fonts');
const LEGACY_FONT_META_PATH = path.join(ROOT_DIR, 'font-library.json');

module.exports = {
  ROOT_DIR,
  PUBLIC_DIR,
  DATA_DIR,
  SESSION_STORE_PATH,
  CHUNK_INDEX_DIR,
  CONTENT_CHUNK_PAYLOAD_DIR,
  BLOCK_MANIFEST_CACHE_DIR,
  SNAPSHOT_DIR,
  SYNC_DATA_PATH,
  FONT_DIR,
  FONT_META_PATH,
  ACCOUNTS_PATH,
  USER_DATA_DIR,
  AUDIT_LOG_PATH,
  SIGNUP_CODES_PATH,
  SITE_LANGUAGES_DIR,
  SITE_LANGUAGE_PACKS_DIR,
  LEGACY_FONT_DIR,
  LEGACY_FONT_META_PATH
};
