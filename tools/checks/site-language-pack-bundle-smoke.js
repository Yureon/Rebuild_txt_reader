const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'site-language-packs');
const files = fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort();
if (files.length < 20) throw new Error('expected at least 20 site language pack json files');
const ids = new Set();
for (const file of files) {
  const full = path.join(dir, file);
  const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (!parsed.id || !/^[a-z0-9_-]+$/.test(parsed.id)) throw new Error(file + ': invalid id');
  if (ids.has(parsed.id)) throw new Error(file + ': duplicate id');
  ids.add(parsed.id);
  if (!parsed.name) throw new Error(file + ': missing name');
  if (parsed.enabled !== true) throw new Error(file + ': must be enabled by default');
  if (!parsed.map || typeof parsed.map !== 'object' || Array.isArray(parsed.map)) throw new Error(file + ': invalid map');
  const entries = Object.entries(parsed.map);
  if (entries.length < 50) throw new Error(file + ': expected at least 50 translated entries');
  for (const [key, value] of entries) {
    if (!String(key).trim()) throw new Error(file + ': empty source key');
    if (!String(value).trim()) throw new Error(file + ': empty translation for ' + key);
    if (String(key).length > 260) throw new Error(file + ': key too long');
    if (String(value).length > 800) throw new Error(file + ': value too long for ' + key);
  }
}
console.log('[site-language-pack-bundle-smoke] pass', { files: files.length });
