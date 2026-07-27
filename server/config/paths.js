const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.resolve(String(process.env.TXT_READER_DATA_DIR || path.join(ROOT_DIR, 'data')));
const SESSION_STORE_PATH = path.join(DATA_DIR, 'sessions.json');
const CHUNK_INDEX_DIR = path.join(DATA_DIR, 'chunk_indexes');
const CONTENT_CHUNK_PAYLOAD_DIR = path.join(DATA_DIR, 'content_chunks');
const NORMALIZED_CONTENT_CACHE_DIR = path.join(DATA_DIR, 'normalized_content');
const BLOCK_MANIFEST_CACHE_DIR = path.join(DATA_DIR, 'block_manifests');
const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots');
const SYNC_DATA_PATH = path.join(DATA_DIR, 'sync_data.json');
const LEGACY_SYNC_DATA_PATH = path.join(ROOT_DIR, 'sync_data.json');
const FONT_DIR = path.join(DATA_DIR, 'fonts');
const FONT_META_PATH = path.join(DATA_DIR, 'font-library.json');
const ACCOUNTS_PATH = path.join(DATA_DIR, 'accounts.json');
const USER_DATA_DIR = path.join(DATA_DIR, 'user-data');
const AUDIT_LOG_PATH = path.join(DATA_DIR, 'audit-log.jsonl');
const SIGNUP_CODES_PATH = path.join(DATA_DIR, 'signup-codes.json');
const SITE_LANGUAGES_DIR = path.join(DATA_DIR, 'site-languages');
const METADATA_STORE_PATH = path.join(DATA_DIR, 'work-metadata.json');
const METADATA_APPLIED_STORE_PATH = path.join(DATA_DIR, 'work-metadata-applied.json.gz');
const METADATA_QUEUE_PATH = path.join(DATA_DIR, 'metadata-jobs.json');
const METADATA_BROWSER_PROFILE_DIR = path.join(DATA_DIR, 'metadata-browser-profiles');
const METADATA_BROWSER_PROFILE_STATE_PATH = path.join(METADATA_BROWSER_PROFILE_DIR, 'profiles.json');
const METADATA_COVER_DIR = path.join(DATA_DIR, 'metadata-covers');
const METADATA_BULK_DIR = path.join(DATA_DIR, 'metadata-batches');
const LIBRARY_CONTENT_FINGERPRINT_PATH = path.join(DATA_DIR, 'library-content-fingerprints.json');
const LIBRARY_VARIANT_PREFERENCE_PATH = path.join(DATA_DIR, 'library-variant-preferences.json');
const LIBRARY_CATALOG_CACHE_PATH = path.join(DATA_DIR, 'library-catalog-cache.json.gz');
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
  NORMALIZED_CONTENT_CACHE_DIR,
  BLOCK_MANIFEST_CACHE_DIR,
  SNAPSHOT_DIR,
  SYNC_DATA_PATH,
  LEGACY_SYNC_DATA_PATH,
  FONT_DIR,
  FONT_META_PATH,
  ACCOUNTS_PATH,
  USER_DATA_DIR,
  AUDIT_LOG_PATH,
  SIGNUP_CODES_PATH,
  SITE_LANGUAGES_DIR,
  METADATA_STORE_PATH,
  METADATA_APPLIED_STORE_PATH,
  METADATA_QUEUE_PATH,
  METADATA_BROWSER_PROFILE_DIR,
  METADATA_BROWSER_PROFILE_STATE_PATH,
  METADATA_COVER_DIR,
  METADATA_BULK_DIR,
  LIBRARY_CONTENT_FINGERPRINT_PATH,
  LIBRARY_VARIANT_PREFERENCE_PATH,
  LIBRARY_CATALOG_CACHE_PATH,
  SITE_LANGUAGE_PACKS_DIR,
  LEGACY_FONT_DIR,
  LEGACY_FONT_META_PATH
};
