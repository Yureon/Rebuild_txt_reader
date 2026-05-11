const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const PASS = 'v427-precompressed-hash-smoke-pass';
function sha(buf){ return crypto.createHash('sha256').update(buf).digest('hex'); }
function collect(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes:true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) collect(full, out);
    else if (ent.isFile() && /\.(mjs|js|css|html|json)$/.test(ent.name) && !/\.(br|gz)$/.test(ent.name)) out.push(full);
  }
  return out;
}
const publicDir = path.join(root, 'public');
const files = collect(publicDir);
let checked = 0;
for (const file of files) {
  for (const ext of ['.br', '.gz']) {
    const sidecar = file + ext;
    if (!fs.existsSync(sidecar)) continue;
    const raw = fs.readFileSync(file);
    const packed = fs.readFileSync(sidecar);
    const unpacked = ext === '.br' ? zlib.brotliDecompressSync(packed) : zlib.gunzipSync(packed);
    assert.strictEqual(sha(unpacked), sha(raw), path.relative(root, sidecar) + ' decompressed hash mismatch');
    checked += 1;
  }
}
assert.ok(checked >= 528, 'expected substantial precompressed sidecar coverage, got ' + checked);
console.log(PASS + ' checked=' + checked);
