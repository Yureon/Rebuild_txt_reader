const fs = require('fs');
const path = require('path');
const assert = require('assert');

const source = fs.readFileSync(path.join(__dirname, '../../server/services/library-service.js'), 'utf8');
const start = source.indexOf('function clearNovelCachesByInfo(info)');
assert(start >= 0, 'clearNovelCachesByInfo missing');
const end = source.indexOf('\n  function getCacheStatus()', start);
assert(end > start, 'clearNovelCachesByInfo boundary missing');
const body = source.slice(start, end);
assert(!/scanLibrary\s*\(/.test(body), 'folder cache invalidation must not recursively scan the library');
assert(/clearAllFileCache\s*\(\s*\)/.test(body), 'folder cache invalidation must abort/clear global file cache before mutation');
console.log(JSON.stringify({ pass: 'v605-fileops-folder-cache-prescan-pass' }));
