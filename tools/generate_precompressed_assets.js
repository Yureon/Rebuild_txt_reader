#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const requested = process.argv.slice(2).map(item => path.resolve(root, item));
const files = [];
const COMPRESSIBLE_EXTENSIONS = new Set(['.mjs', '.js', '.css', '.html', '.json', '.xml', '.svg']);
const STALE_SIDECAR_SOURCE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf']);

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (COMPRESSIBLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
}

if (requested.length) {
  for (const file of requested) {
    if (!COMPRESSIBLE_EXTENSIONS.has(path.extname(file).toLowerCase())) throw new Error(`asset is not eligible for precompression: ${file}`);
    files.push(file);
  }
} else {
  walk(publicDir);
  const removeStaleSidecars = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) removeStaleSidecars(full);
      else if (/\.(br|gz)$/i.test(entry.name)) {
        const source = full.replace(/\.(br|gz)$/i, '');
        if (STALE_SIDECAR_SOURCE_EXTENSIONS.has(path.extname(source).toLowerCase())) fs.rmSync(full, { force:true });
      }
    }
  };
  removeStaleSidecars(publicDir);
}

for (const file of Array.from(new Set(files))) {
  if (!file.startsWith(publicDir + path.sep) || !fs.statSync(file).isFile()) throw new Error(`invalid public asset: ${file}`);
  const source = fs.readFileSync(file);
  fs.writeFileSync(file + '.br', zlib.brotliCompressSync(source, { params:{ [zlib.constants.BROTLI_PARAM_QUALITY]:11 } }));
  fs.writeFileSync(file + '.gz', zlib.gzipSync(source, { level:9 }));
}

console.log(JSON.stringify({ pass:'precompressed-assets-generated', files:files.length }));
